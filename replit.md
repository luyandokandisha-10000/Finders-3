# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Finders Landing Page (`artifacts/finders`)

React + Vite landing page for the Finders mobile app. Black / dark-gold (#8B6914 → #C9A84C) theme.

### Features
- Public landing page with waitlist signup (PostgreSQL-backed)
- `/admin` dashboard: searchable/paginated waitlist table, CSV export, password protection
- **Notify All**: sends branded HTML launch emails to waitlist subscribers via Resend

### Email (Resend)
- Uses Resend REST API directly (no SDK) — secrets: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- NOTE: The Resend Replit integration connector was dismissed by the user; credentials are stored as plain secrets instead.
- Endpoint: `POST /api/admin/notify` — requires admin Bearer token
- Tracks sent status via `notified_at` column on `waitlist` table
- Supports sending to "new only" (unnotified) or everyone

### Admin Auth
- In-memory token Set in `artifacts/api-server/src/routes/admin.ts` — resets on server restart
- Secret: `ADMIN_PASSWORD`
