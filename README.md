# David's Work-Week Assistant

A production-oriented foundation for a personal Sunday-to-Thursday work-week assistant. The application uses Next.js App Router, strict TypeScript, Tailwind CSS, shadcn/ui conventions, and Supabase Auth/PostgreSQL/RLS.

Phase 1 establishes authentication, the responsive application shell, the normalized database and ownership policies, shared domain contracts, and automated test infrastructure. Mission planning, scheduling, meetings, Telegram, reminders, and exports are intentionally delivered in later phases.

## Quick start

1. Install Node.js 22.12.x or Node.js 24+ and pnpm 11.
2. Copy `.env.example` to `.env.local` and configure a Supabase project.
3. Run `pnpm install`.
4. Run `pnpm dev` and open `http://localhost:3000`.

For local Supabase, install Docker, run `pnpm exec supabase start`, then `pnpm exec supabase db reset` to apply migrations. Confirmation emails are captured by local Inbucket at `http://127.0.0.1:54324`. See [CODEBASE_GUIDE.md](./CODEBASE_GUIDE.md) for architecture, security, testing, deployment, and future-phase details.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm test:db
pnpm test:e2e
pnpm build
```
