import { Telegraf } from 'telegraf'
import { message } from 'telegraf/filters'
import { chatWithOllama, getOllamaModels, type OllamaMessage } from '../clients/electron/ollama'

const history = new Map<number, OllamaMessage[]>()

export async function startTelegramBot(token: string): Promise<void> {
  const models = await getOllamaModels()
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
      let fullResponse = ''
      for await (const chunk of chatWithOllama(model!, messages)) {
        fullResponse += chunk
      }
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
