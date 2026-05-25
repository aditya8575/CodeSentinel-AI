# CodeSentinel AI

Your 24/7 senior code reviewer — an AI-powered pull request analysis tool that detects bugs, security vulnerabilities, performance issues, and code smells automatically.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/codesentinel run dev` — run the frontend (port 20593)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit-managed AI proxy

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TanStack Query, Wouter, Tailwind CSS, shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI GPT-5.4 via Replit AI Integrations (no key needed)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — DB schema: `reviews.ts`, `findings.ts`, `chat_messages.ts`
- `artifacts/api-server/src/routes/reviews.ts` — review CRUD + AI analysis trigger
- `artifacts/api-server/src/routes/chat.ts` — SSE streaming chat
- `artifacts/api-server/src/lib/ai-reviewer.ts` — AI analysis engine (GPT-5.4)
- `artifacts/codesentinel/src/pages/` — Dashboard, SubmitReview, ReviewDetail

## Architecture decisions

- Reviews are created immediately (status=analyzing), then AI analysis runs as a background async job so the API responds fast
- AI reviewer uses `response_format: json_object` to force structured JSON output for reliable finding extraction
- Chat endpoint streams SSE using the OpenAI streaming API; includes the review's diff and findings as system context
- All findings are ordered by severity (critical → high → medium → low) at the DB query level
- Re-analyze flow deletes existing findings and re-runs the AI analysis from scratch

## Product

- **Dashboard** — aggregate stats (total reviews, finding counts by severity), recent reviews list with severity badges
- **Submit Review** — form to paste a diff + optional PR URL, language selector, triggers real AI analysis
- **Review Detail** — full findings list with code snippets, file paths, line numbers, severity badges, category labels; AI chat panel for asking questions about specific findings
- **Re-analyze** — re-run AI analysis on any existing review

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run codegen after changing `lib/api-spec/openapi.yaml` before touching routes or the frontend
- The AI analysis is async (fire-and-forget after the 201 response); poll `/api/reviews/:id` for status updates
- Chat SSE response is streamed; do NOT use the generated mutation hook — use raw `fetch` with `ReadableStream`
- `pnpm --filter @workspace/db run push-force` if schema push fails with column conflicts

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
