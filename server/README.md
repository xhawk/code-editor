# server

Hono-based REST server that exposes all application logic over HTTP. It runs embedded inside the Electron process (local mode) or as a standalone Node.js process (headless/remote modes).

## Stack

- **Framework**: [Hono](https://hono.dev/) + `@hono/node-server`
- **Settings**: [`conf`](https://github.com/sindresorhus/conf) — file-based persistence, no Electron dependency
- **AI**: Ollama client with streaming tool-call loop
- **Base URL**: `http://127.0.0.1:3579/api/v1`

## Running

```bash
# Development (hot-reload)
WORKDIR=/path/to/project yarn server:dev

# Production
yarn server:build
WORKDIR=/path/to/project yarn server:start
```

## Authentication

Set `API_TOKEN` to require a bearer token on all `/api/*` routes:

```bash
API_TOKEN=secret yarn server:dev
# requests must include: Authorization: Bearer secret
```

## Endpoints

### Health

```
GET /api/v1/health
→ { status: "ok", workingDirectory: string }
```

### Models

```
GET /api/v1/models
→ string[]           # list of Ollama model names
```

### Chat

```
POST /api/v1/chat
Body: { model: string, messages: OllamaMessage[], agentMode?: "code" | "plan" }
→ SSE stream
```

SSE event types:

| Event | Data |
|---|---|
| `worktree` | `{ path: string }` — emitted once if a worktree was auto-created |
| `chunk` | `{ text: string }` — streamed response tokens |
| `done` | `{ fullResponse: string }` — final assembled response |
| `error` | `{ message: string }` |

On the first chat in a git repository, the server automatically creates a worktree under `workspace/` and emits a `worktree` event before streaming begins.

### Git

```
GET  /api/v1/git/check
→ { isRepo: boolean }

GET  /api/v1/git/status?worktreePath=<path>
→ { branch: string, files: GitStatusFile[] }   # 404 if not a git repo

POST /api/v1/git/commit
Body: { message: string, worktreePath?: string }
→ { committed: true }

GET  /api/v1/git/staged-diff-stat?worktreePath=<path>
→ { stat: string }
```

### Files

All file operations use `getBaseDirectory()` (`selectedWorktreePath || worktreePath || workingDirectory`) unless overridden.

```
GET    /api/v1/files?path=<dir>&worktreePath=<path>
→ { items: FileItem[] }

GET    /api/v1/files/content?path=<file>&worktreePath=<path>
→ { content: string }

POST   /api/v1/files
Body: { relativePath: string, content: string }
→ { path: string }

DELETE /api/v1/files?path=<file>
→ { deleted: string }
```

### Worktrees

```
GET  /api/v1/worktrees/status
→ { created: boolean, path: string | null }

GET  /api/v1/worktrees
→ GitWorktree[]

POST /api/v1/worktrees
→ { path: string }   # creates a new named worktree under workspace/

DELETE /api/v1/worktrees/:encodedPath
→ { archived: string }

POST /api/v1/worktrees/select
Body: { path: string | null }
→ { selected: string | null }
```

### Settings

```
GET /api/v1/settings/working-directory
→ { workingDirectory: string }

PUT /api/v1/settings/working-directory
Body: { workingDirectory: string }

GET /api/v1/settings/theme
→ { theme: string }

PUT /api/v1/settings/theme
Body: { theme: string }

GET /api/v1/settings/agent-mode
→ { agentMode: "code" | "plan" }

PUT /api/v1/settings/agent-mode
Body: { agentMode: "code" | "plan" }

GET /api/v1/settings/chat-messages/:key
→ ChatMessage[]

PUT /api/v1/settings/chat-messages/:key
Body: ChatMessage[]
```

## Directory Layout

```
server/
├── app.ts          # createApp() + startHttpServer()
├── index.ts        # Standalone entry (reads env, starts server + Telegram)
├── ollama.ts       # Ollama client — streaming, tool-call loop, agent dispatch
├── git.ts          # checkGitRepo, getGitStatus, gitCommit, getStagedDiffStat, …
├── worktree.ts     # createWorktree — random name, workspace/ subdir
├── storage.ts      # conf-backed persistence: theme, agentMode, chat history
├── telegram.ts     # Telegraf bot — proxies chat to REST API via SSE
├── agents/
│   ├── agents.ts   # AgentMode type, AGENTS map, DEFAULT_AGENT_MODE
│   ├── code.ts     # Code agent config (system prompt, allowed tools)
│   └── plan.ts     # Plan agent config (read-only tools)
├── routes/
│   ├── chat.ts
│   ├── files.ts
│   ├── git.ts
│   ├── models.ts
│   ├── settings.ts
│   └── worktrees.ts
└── tools/
    ├── index.ts          # executeTool dispatcher + getToolsForMode
    ├── create_file.ts
    ├── read_file.ts
    ├── delete_file.ts
    ├── list_files.ts
    └── get_git_status.ts
```

## Agent Modes

| Mode | Description |
|---|---|
| `code` | Full tool access — create, read, delete files, git status |
| `plan` | Read-only — list and read files only |

The active agent mode is stored via `storage.ts` and defaults to `code`.

## Telegram Bot

When `TELEGRAM_TOKEN` is set, `startTelegramBot()` is called from `index.ts`. The bot proxies messages to `POST /api/v1/chat` and reads the SSE stream to collect the full response before replying to the user. Per-chat conversation history is kept in memory.

```
/clear  — reset conversation history for this chat
```
