# Repository instructions for coding agents

These instructions apply to every change in this repository.

1. Read `/CODEBASE_GUIDE.md` before modifying the project.
2. Inspect the source files relevant to the requested change and treat code as authoritative when it conflicts with documentation.
3. Keep Supabase PostgreSQL as the single source of truth.
4. Reuse shared domain services and server-side repositories. Do not duplicate scheduling, completion, recurrence, reminder, export, or notification logic in the UI, API routes, Edge Functions, or Telegram handlers.
5. Never expose Supabase service-role keys, Telegram secrets, cron secrets, private export URLs, or other credentials to client-side code or logs.
6. Represent every database change as an ordered migration. Preserve owner isolation and Row Level Security on every user-owned table.
7. Run the relevant lint, type-check, unit, integration, database, end-to-end, and build checks after changes.
8. Before completing any task, update `/CODEBASE_GUIDE.md` so its architecture, directory map, schema, APIs, environment variables, decisions, limitations, and change history match the implementation.
9. Do not claim planned functionality is implemented. Avoid fake actions, hardcoded personal data, unfinished core buttons, and undocumented dashboard-only configuration.
