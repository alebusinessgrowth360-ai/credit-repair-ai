# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Monorepo with two independent services, each with its own Dockerfile deployed on EasyPanel:

- `backend/` — Express + TypeScript API, runs on port 4000
- `frontend/` — Next.js 14 App Router, runs on port 3000

The frontend communicates with the backend via `NEXT_PUBLIC_API_URL` (env var injected at Docker build time as a build arg). All API calls are prefixed with `/api/`.

## Development Commands

**Backend:**
```bash
cd backend
npm run dev      # ts-node-dev with hot reload
npm run build    # tsc → dist/
npm start        # node dist/index.js
```

**Frontend:**
```bash
cd frontend
npm run dev      # next dev
npm run build    # next build
npm start        # next start
```

## Authentication

Custom auth — no Supabase Auth. The `usuarios` table stores users with SHA256-hashed passwords. The auth middleware (`backend/src/middleware/auth.ts`) reads a base64-encoded JSON token from the `Authorization: Bearer` header. The token contains `{ id, exp }`. There is no JWT signing — just base64 encoding.

## Database

Plain PostgreSQL (not Supabase). All tables reference `public.usuarios`, not `auth.users`.

Migration files are in `backend/src/db/migrations/`. The canonical schema is `005_schema_postgresql.sql` — this is the one that actually works on EasyPanel. Files `001` through `004` predate the migration to plain PostgreSQL and some may have Supabase-specific syntax.

Core tables: `usuarios`, `configuracion_ia`, `clientes`, `reportes_credito`, `analisis_reportes`, `comparaciones_reportes`, `cartas`, `disputas`, `branding`, `rapid_rescore`.

Connection pool is in `backend/src/db/client.ts`.

## Cascade Delete Order

When deleting a client, the correct order to avoid FK constraint violations is:
1. `cartas` (cliente_id)
2. `disputas` (cliente_id)
3. `rapid_rescore` (cliente_id)
4. `comparaciones_reportes` (cliente_id)
5. `analisis_reportes` (via reporte_id IN reportes_credito where cliente_id)
6. `reportes_credito` (cliente_id)
7. `clientes`

## AI Analysis

`backend/src/routes/analisis.ts` — uploads a PDF credit report, extracts text with `pdf-parse`, sends up to 30,000 chars to GPT-4o with `response_format: json_object` and `max_tokens: 8000`. Returns structured analysis including accounts, errors, inquiries, and recommendations.

## PDF Export

`backend/src/routes/exportar.ts` — generates a full HTML document (returned as string) that includes the AI analysis, errors, rapid rescore data, and branding. The frontend downloads it as `.html` and the user opens it in a browser to print as PDF.

## Frontend State Persistence

Analysis page (`/analisis/[id]`) caches fetched data in `sessionStorage` keyed by report ID (`analisis_<id>`, `reporte_<id>`) so navigating away and back restores the view instantly without re-fetching.

## Print/PDF CSS Pattern

Elements with `className="no-print"` are hidden in `@media print`. Elements with `className="print-only"` use `display:none` normally and `display:block` in `@media print`. This is defined inline in each page — there is no global stylesheet.

## Deployment

Both services deploy via Docker on EasyPanel, triggered by pushing to `main` on GitHub. EasyPanel will sometimes "restart" without rebuilding the image (shows "0 seconds"). To force a full rebuild, click the green **Deploy** button manually. A real build takes ~40 seconds for the frontend, ~15 seconds for the backend.

TypeScript type errors are non-blocking — the build runs with `"skipLibCheck": true` and Next.js skips type validation during `next build`.
