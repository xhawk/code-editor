# Code Editor AI

An Electron desktop application that pairs an Ollama-backed AI agent with a full REST server, enabling local, remote, and headless deployment modes.

## Features

- AI chat with streaming responses (SSE) and two agent modes: `code` and `plan`
- Automatic git worktree creation per session for isolated development
- Git status sidebar, staged diff, and one-command commits
- File browser, syntax-highlighted file viewer
- Persistent chat history and theme preference per worktree
- Telegram bot integration (headless mode)
- Three deployment modes: Local, Remote, Headless

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Yarn](https://yarnpkg.com/) v1.22+
- [Ollama](https://ollama.ai/) running locally (`http://127.0.0.1:11434`)
- Git (for worktree and status features)

## Quick Start

```bash
yarn install

# Local mode — Electron + bundled REST server
yarn dev

# Headless — REST server + optional Telegram bot
yarn server:dev

# Remote mode — start server separately, point Electron at it
REMOTE_API_URL=http://127.0.0.1:3579 yarn dev
```

## Scripts

| Script | Description |
|---|---|
| `yarn dev` | Start REST server + Electron together (server hot-reloads independently) |
| `yarn dev:server` | REST server only with hot-reload (`tsx watch`) |
| `yarn dev:electron` | Electron/Vite only — waits for server on `:3579` first |
| `yarn build` | Production build (Vite + electron-builder) |
| `yarn typecheck` | TypeScript type check |
| `yarn server:dev` | Alias for `dev:server` |
| `yarn server:build` | Compile server to `dist-server/` |
| `yarn server:start` | Run compiled server |

## Deployment Modes

### Local
Electron starts the REST server automatically on `http://127.0.0.1:3579`.

```bash
yarn dev
# or with a specific working directory:
WORKDIR=/path/to/project yarn dev
```

### Remote
Set `REMOTE_API_URL` to skip starting the bundled server. Electron connects to the given URL instead.

```bash
# Terminal 1 — server
WORKDIR=/path/to/project yarn server:dev

# Terminal 2 — Electron
REMOTE_API_URL=http://127.0.0.1:3579 yarn dev
```

### Headless
REST server only — no Electron window. Useful for CI, containers, or Telegram-only use.

```bash
WORKDIR=/path/to/project yarn server:start
curl http://127.0.0.1:3579/api/v1/health
```

Optional Telegram bot:
```bash
TELEGRAM_TOKEN=your_token WORKDIR=/path/to/project yarn server:start
```

## Environment Variables

| Variable         | Default                  | Description                                                       |
|------------------|--------------------------|-------------------------------------------------------------------|
| `WORKDIR`        | `process.cwd()`          | Working directory for file and git operations                     |
| `PORT`           | `3579`                   | HTTP server port                                                  |
| `REMOTE_API_URL` | —                        | If set, Electron connects here instead of starting its own server |
| `API_TOKEN`      | —                        | Bearer token for REST API authentication                          |
| `TELEGRAM_TOKEN` | —                        | Telegram bot token                                                |
| `OLLAMA_HOST`    | `http://127.0.0.1:11434` | Ollama endpoint (set inside `server/ollama.ts`)                   |

## Repository Layout

```
├── clients/
│   └── electron/          # Electron main/preload + React frontend
│       ├── main.ts        # App entry — mode detection, server start, window
│       ├── preload.ts     # Injects __API_CONFIG__ into renderer
│       ├── state.ts       # Shared in-memory state (workingDirectory, worktreePath)
│       └── src/           # React frontend
│           ├── api/       # HTTP client (api.*) and shared types
│           └── components/
├── server/                # Hono REST server
│   ├── app.ts             # Router setup
│   ├── index.ts           # Standalone entry point
│   ├── ollama.ts          # Ollama client + tool-call loop
│   ├── git.ts             # Git helpers
│   ├── worktree.ts        # Worktree creation
│   ├── storage.ts         # Persistent settings (conf)
│   ├── telegram.ts        # Telegram bot
│   ├── agents/            # Agent configs (code / plan)
│   ├── routes/            # Route handlers
│   └── tools/             # AI tool implementations
├── workspace/             # Auto-created worktrees land here
└── vite.config.ts
```

## Building for Distribution

```bash
yarn build
```
        
Output is placed in `release/`. Targets: macOS (dmg), Windows (nsis), Linux (AppImage).

## REST API

The REST server at `http://127.0.0.1:3579/api/v1` is the single source of truth for all operations. See [`server/README.md`](server/README.md) for full endpoint documentation.
