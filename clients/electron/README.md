# clients/electron

Electron desktop application. Hosts the React frontend and, in local mode, starts the REST server automatically. In remote mode it connects to an externally-started server instead.

## Structure

```
clients/electron/
├── main.ts          # Electron entry — mode detection, server start, window creation
├── preload.ts       # Injects window.__API_CONFIG__ into the renderer
├── state.ts         # In-memory shared state (workingDirectory, worktreePath, …)
└── src/             # React frontend (Vite root)
    ├── main.tsx
    ├── App.tsx
    ├── api/
    │   ├── types.ts    # Shared interfaces (GitStatus, GitWorktree, AgentMode, …)
    │   └── client.ts   # Typed HTTP client (api.*)
    └── components/
        ├── ChatPanel.tsx
        ├── ChatArea.tsx
        ├── Message.tsx
        ├── Input.tsx
        ├── Header.tsx
        ├── GitSidebar.tsx
        ├── WorktreeList.tsx
        ├── FilePanel.tsx
        └── TabSystem.tsx
```

## Deployment Modes

`main.ts` detects the mode at startup:

| Mode       | How     | `REMOTE_API_URL` | Server started?               |
|------------|---------|------------------|-------------------------------|
| **local**  | default | not set          | yes — `startHttpServer(port)` |
| **remote** | env var | `http://…`       | no                            |

The chosen `apiUrl` and `mode` are passed to the renderer via `additionalArguments`:

```ts
additionalArguments: [`--api-url=${apiUrl}`, `--mode=${mode}`]
```

`preload.ts` reads these and exposes them:

```ts
contextBridge.exposeInMainWorld('__API_CONFIG__', { apiUrl, mode })
```

## API Client (`src/api/client.ts`)

All data-fetching goes through the `api` object — no IPC, no `window.electron`.

```ts
import { api } from './api/client'

// examples
const models   = await api.getModels()
const status   = await api.getGitStatus(worktreePath)
const theme    = await api.getTheme()

const abort = api.chatStream(
  { model, messages, agentMode },
  (chunk) => { /* streaming token */ },
  (full)  => { /* done */ },
  (err)   => { /* error */ },
  (path)  => { /* worktree auto-created */ }
)
// call abort() to cancel
```

The base URL is read from `window.__API_CONFIG__.apiUrl` at call time, falling back to `http://127.0.0.1:3579`.

### Full API surface

| Method                                                | REST call                                       |
|-------------------------------------------------------|-------------------------------------------------|
| `getModels()`                                         | `GET /api/v1/models`                            |
| `getWorkingDirectory()`                               | `GET /api/v1/settings/working-directory`        |
| `getTheme()` / `setTheme(t)`                          | `GET / PUT /api/v1/settings/theme`              |
| `getAgentMode()` / `setAgentMode(m)`                  | `GET / PUT /api/v1/settings/agent-mode`         |
| `getChatMessages(key)` / `setChatMessages(key, msgs)` | `GET / PUT /api/v1/settings/chat-messages/:key` |
| `checkGitRepo()`                                      | `GET /api/v1/git/check`                         |
| `getGitStatus(worktreePath?)`                         | `GET /api/v1/git/status`                        |
| `gitCommit(msg, worktreePath?)`                       | `POST /api/v1/git/commit`                       |
| `getStagedDiffStat(worktreePath?)`                    | `GET /api/v1/git/staged-diff-stat`              |
| `getAllWorktrees()`                                   | `GET /api/v1/worktrees`                         |
| `getWorktreeStatus()`                                 | `GET /api/v1/worktrees/status`                  |
| `createWorktree()`                                    | `POST /api/v1/worktrees`                        |
| `archiveWorktree(path)`                               | `DELETE /api/v1/worktrees/:path`                |
| `setSelectedWorktree(path)`                           | `POST /api/v1/worktrees/select`                 |
| `createFile(params)`                                  | `POST /api/v1/files`                            |
| `readFile(params)`                                    | `GET /api/v1/files/content`                     |
| `deleteFile(params)`                                  | `DELETE /api/v1/files`                          |
| `listFiles(params)`                                   | `GET /api/v1/files`                             |
| `chatStream(params, …)`                               | `POST /api/v1/chat` (SSE)                       |

## Shared Types (`src/api/types.ts`)

Single source of truth for types shared between the frontend and the REST API:

- `FileItem`, `FileOperationResult`
- `WorktreeStatus`
- `GitStatusFile`, `GitStatus`, `GitWorktree`
- `AgentMode` (`'code' | 'plan'`)
- `ChatMessage`

## Components

| Component              | Responsibility                                                     |
|------------------------|--------------------------------------------------------------------|
| `App.tsx`              | Root — initialises state, owns theme/model/worktree selection      |
| `Header`               | Model selector, working dir display, theme toggle                  |
| `ChatPanel`            | Chat input/output, commit shortcut, file-creation from code blocks |
| `ChatArea` + `Message` | Renders message history with markdown/code highlighting            |
| `Input`                | Textarea + agent-mode toggle (code / plan)                         |
| `GitSidebar`           | Live git status grouped by change type, click-to-open files        |
| `WorktreeList`         | Lists non-main worktrees, select or archive                        |
| `FilePanel`            | Syntax-highlighted file viewer (prism, 30+ languages)              |
| `TabSystem`            | Multi-tab layout (chat tab always present)                         |

## State.ts

Mutable in-memory state shared between `main.ts` and the server routes:

| Export                 | Description                                                            |
|------------------------|------------------------------------------------------------------------|
| `workingDirectory`     | Root project directory                                                 |
| `worktreePath`         | Path of the auto-created worktree for this session                     |
| `worktreeCreated`      | Whether `createWorktree()` has already run                             |
| `selectedWorktreePath` | User-selected worktree (overrides `worktreePath`)                      |
| `getBaseDirectory()`   | Returns `selectedWorktreePath \|\| worktreePath \|\| workingDirectory` |

## Building

```bash
# From the repo root:
yarn build          # full production build + electron-builder
yarn build:vite     # Vite only (no packaging)
```

Output: `dist/` (renderer), `dist-electron/` (main + preload), `release/` (installers).
