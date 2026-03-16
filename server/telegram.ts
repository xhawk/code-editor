import { Telegraf } from 'telegraf'
import { message } from 'telegraf/filters'

type OllamaMessage = { role: string; content: string }

const history = new Map<number, OllamaMessage[]>()

const PORT = parseInt(process.env.PORT ?? '3579', 10)
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`

async function getModels(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/models`)
  if (!res.ok) throw new Error(`Failed to get models: ${res.status}`)
  return res.json() as Promise<string[]>
}

async function chatViaHttp(model: string, messages: OllamaMessage[], agentMode?: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, agentMode })
  })

  if (!res.ok || !res.body) throw new Error(`Chat request failed: ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullResponse = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    let event = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        event = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        const data = line.slice(6)
        try {
          const parsed = JSON.parse(data)
          if (event === 'chunk') fullResponse += parsed.text
          else if (event === 'done') fullResponse = parsed.fullResponse
          else if (event === 'error') throw new Error(parsed.message)
        } catch (e) {
          if (e instanceof Error && event === 'error') throw e
        }
        event = ''
      }
    }
  }

  return fullResponse
}

export async function startTelegramBot(token: string): Promise<void> {
  const models = await getModels()
  const model = models[0]
  console.log(`Telegram bot using model: ${model}`)

  const bot = new Telegraf(token)

  bot.command('clear', (ctx) => {
    history.set(ctx.chat.id, [])
    void ctx.reply('Conversation cleared.')
  })

  bot.on(message('text'), async (ctx) => {
    const chatId = ctx.chat.id
    const messages = history.get(chatId) ?? []
    messages.push({ role: 'user', content: ctx.message.text })
    history.set(chatId, messages)

    const typingInterval = setInterval(() => {
      void ctx.sendChatAction('typing')
    }, 4000)
    void ctx.sendChatAction('typing')

    try {
      const fullResponse = await chatViaHttp(model!, messages)
      clearInterval(typingInterval)
      messages.push({ role: 'assistant', content: fullResponse })
      await ctx.reply(fullResponse)
    } catch (err) {
      clearInterval(typingInterval)
      const msg = err instanceof Error ? err.message : String(err)
      await ctx.reply(`Error: ${msg}`)
    }
  })

  void bot.launch()
  console.log('Telegram bot started (polling)')

  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}
