import { Hono } from 'hono'
import { getOllamaModels } from '../../clients/electron/ollama'

const models = new Hono()

models.get('/', async (c) => {
  const list = await getOllamaModels()
  return c.json(list)
})

export default models
