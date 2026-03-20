import { resolve, isAbsolute } from 'path'
import { existsSync } from 'fs'
import { setWorkingDirectory } from '../clients/electron/state'
import { startHttpServer } from './app'
import { startTelegramBot } from './telegram'

const args = process.argv.slice(2)
const dirArg = args.find(a => a.startsWith('--dir='))?.slice(6)
const rawDir = process.env.WORKDIR ?? dirArg

let workDir: string
if (rawDir) {
  const resolved = isAbsolute(rawDir) ? rawDir : resolve(process.cwd(), rawDir)
  if (!existsSync(resolved)) {
    console.error(`Directory does not exist: ${resolved}`)
    process.exit(1)
  }
  workDir = resolved
} else {
  workDir = process.cwd()
}

setWorkingDirectory(workDir)
console.log(`Working directory: ${workDir}`)

const port = parseInt(process.env.PORT ?? '3579', 10)
console.log("PORT", port);

void startHttpServer(port)

console.log("ENVs", process.env);
if (process.env.TELEGRAM_TOKEN) {
  void startTelegramBot(process.env.TELEGRAM_TOKEN)
}
