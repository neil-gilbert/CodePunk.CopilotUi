# Copilot UI Wrapper

Electron desktop app that wraps GitHub Copilot CLI using the official `@github/copilot-sdk`.

## Stack

- Electron + React + TypeScript + Vite (`electron-vite`)
- Copilot integration via `@github/copilot-sdk`
- Local persistence via `better-sqlite3`

## Features

- Codex/Cursor-style shell UI
- Repo-grouped threads with folder-based context
- Streaming chat events from Copilot sessions
- File attachments from composer
- Model dropdown sourced from Copilot `listModels()`
- Skills browser + creation for:
  - `~/.copilot/skills`
  - `<repo>/.copilot/skills`
- `Commit` and `Commit & Push` actions for active repo
- `Automations` sidebar item with placeholder view

## Scripts

- `npm run dev` - launch app in development mode
- `npm run typecheck` - TypeScript checks
- `npm test` - Vitest unit/integration tests
- `npm run test:e2e` - Playwright end-to-end scenarios against the built Electron app
- `npm run build` - production build
- `npm run dist` - package installers with electron-builder

## Notes

- Requires GitHub Copilot CLI installed on PATH as `copilot`.
- SDK version pinned to `0.1.22` for Node 22 compatibility.
- App-owned thread metadata is stored in local SQLite under Electron userData.
- `better-sqlite3` is a native module with separate Node/Electron ABIs. Scripts handle this automatically:
  - `npm run dev` / `npm run dist` rebuild for Electron
  - `npm test` rebuilds for Node (Vitest)
