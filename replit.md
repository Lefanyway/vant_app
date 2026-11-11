# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## Valorant phase

This phase shows only Valorant on the main scores screen. CS2 and League of Legends stay on the profile as a static “Em breve” note and do not call PandaScore.

- Required env: `PANDASCORE_API_TOKEN` — token stays on the API server. The app reads Valorant through `/api`.
- PandaScore Free returns Valorant matches, teams, current rosters, leagues, scores, and stream links.
- The free plan does not return map names, per-map scores, confirmed match lineups, or player stats such as ACS, ADR, KAST, agents, and economy. Those stay hidden. A higher PandaScore plan, or the optional VLR stats provider, is required before they can be shown.
- A finished or scheduled 0–0 score is treated as unconfirmed. A live 0–0 stays visible.
- Current roster on a team page is the current squad, not the lineup of an old match.
