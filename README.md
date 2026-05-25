# CodeSentinel-AI

Code Review Bot is a modular monorepo that automates code reviews using AI, provides a developer UX for submitting and browsing reviews, and includes integrations for running checks locally or in CI. This README explains the architecture, how to run the system locally, a short demo script for a hackathon pitch, and deployment recommendations to help you win the hackathon.

**Repository layout**
- [artifacts/codesentinel](artifacts/codesentinel): UI frontend (Vite + React). Primary demo surface.
- [api-server](api-server): Backend API and AI orchestration (Express/Node/TS). Hosts endpoints used by the frontend and any integrations.
- lib/api-client-react: Shared TypeScript API client used by the frontend.
- [db](db): Drizzle schema and DB utilities for persisting conversations, findings, and review metadata.
- integrations / integrations-openai-ai-server: connectors for AI providers and batch/image/audio helpers.
- scripts: helper scripts and small utilities used during development.

High-level architecture
- Frontend (`artifacts/codesentinel`) — React app that collects code or PR links, sends them to the API, and displays structured findings and suggested fixes.
- API (`api-server`) — Receives requests, prepares prompts, orchestrates calls to AI providers, persists results in `db`, and returns structured findings.
- Shared libs (`lib/*`) — Reusable clients, types, and utilities used across frontend and backend.
- Integrations — Provider adapters and optional connectors for GitHub/GitLab/CI.

Why this wins
- End-to-end: UI + backend + persistence + provider adapters are present, so judges can see a complete flow.
- Extensible: adapter architecture makes it easy to swap AI providers or add a CI integration during the hackathon.
- Developer-friendly demo: local dev mode runs fast, and artifacts/codesentinel is crafted to be a clear, visual demo surface.

Prerequisites
- Node.js 18+ and pnpm (pnpm is required for workspace handling)
- Git (to clone)

Quickstart (recommended — full workspace)
1. Clone the repo and install dependencies at the workspace root:

```bash
git clone <repo-url>
cd Code-Review-Bot
pnpm install
```

2. Run the API and frontend from the workspace root (parallel terminals):

```bash
# Start the API
pnpm --filter @workspace/api-server run dev

# Start the frontend (codesentinel)
pnpm --filter @workspace/codesentinel run dev
```

Notes: `artifacts/codesentinel` references local workspace packages (e.g. `@workspace/api-client-react`) so running from the workspace root with `pnpm install` ensures the workspace links are resolved automatically.

Quickstart (frontend-only, best-effort)
- If you want to iterate on UI only: open `artifacts/codesentinel`, run `pnpm install` there, then `pnpm run dev`. Some workspace-linked packages may need to be built or copied if the root workspace isn't available.

Configuration
- Environment variables are read by the API and integrations. Create a `.env` file in `api-server` with provider keys and DB settings. Example keys:

```
OPENAI_API_KEY=...
DATABASE_URL=sqlite:./db/dev.sqlite
```

Data model and persistence
- `db` contains Drizzle schema for conversations, messages and findings. The API persists AI responses and review metadata so the UI can present history and diffs.


