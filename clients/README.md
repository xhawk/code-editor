# clients

This directory contains client implementations for the Code Editor AI REST API.

## Structure

```
clients/
└── electron/    # Electron desktop app + React frontend
```

The Electron client is currently the only client. Because the API layer is a plain `fetch`-based HTTP client (see `electron/src/api/`), additional clients (web app, CLI, VS Code extension) can import the same `api/*` module or reimplement it against the same REST API documented in [`../../server/README.md`](../../server/README.md).

## Shared API Contract

All clients communicate with the REST server at a configurable base URL (default `http://127.0.0.1:3579`). The shared types used across the API boundary live in:

```
clients/electron/src/api/types.ts
```

See [`electron/README.md`](electron/README.md) for the full Electron client documentation.
