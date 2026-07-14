# Codebase Guide

Last updated: 2026-07-14  
Implementation baseline: Phase 1, initial Phase 2 app slices, and the Phase 3 pure deterministic planner core

This document is the durable map of David's Work-Week Assistant. Code and ordered Supabase migrations remain authoritative if this guide ever drifts. Every change must update the affected sections, the decision log when a new architectural choice is made, and the change history.

Status labels used below:

- **Implemented** means executable Phase 1 code or a migrated database invariant exists.
- **Foundation only** means a schema or TypeScript contract exists, but no end-user workflow or background worker uses it yet.
- **Planned** means the behavior belongs to Phases 2–8 and must not be presented as available.

## 1. Product overview

David's Work-Week Assistant is a private planning workspace centered on a Sunday-to-Thursday work week. Each signed-in person owns an isolated workspace for missions, working hours, meetings, reminders, contacts, Telegram interactions, and weekly reports. The intended primary user is an individual planning their own work; the schema is multi-tenant so separate accounts cannot see one another's data.

The planned journeys are: create an account; define normal and date-specific work hours; capture missions; automatically plan fixed and flexible work around meetings and unavailable time; track recurring occurrences and completion; interact through the web or Telegram; receive reliable reminders; and export a selected week to PDF or DOCX.

Implemented so far:

- A Next.js App Router application with strict TypeScript, Tailwind CSS v4, shadcn/ui conventions, security headers, linting, build scripts, and CI.
- Supabase email/password sign-up, sign-in, confirmation routes, sign-out, SSR cookie handling, protected `/app` routes, and safe same-origin redirects.
- A responsive authenticated shell with My Week, Mission Inbox, People and Meetings, and Settings destinations. These are honest empty states, not working planning screens.
- A normalized PostgreSQL foundation with owner-preserving foreign keys, RLS, integrity triggers, query indexes, a read-only calendar view, and a private export bucket.
- Shared serializable domain types, validation/error contracts, English/Hebrew translation scaffolding, and timezone-safe Sunday-to-Thursday date helpers.
- Unit, browser smoke-test, pgTAP database/RLS, and GitHub Actions infrastructure.
- A first Phase 2 Mission Inbox slice: signed-in users can create selected-date, unscheduled missions through a React Hook Form client backed by a Server Action, a shared Mission service, a Supabase repository, and the existing RLS-protected `missions` table. The inbox lists the user's latest selected-date unscheduled missions from PostgreSQL.
- A first Phase 2 Settings slice: signed-in users can view and save normal Sunday-to-Thursday work hours through a React Hook Form client backed by a Server Action, shared Work Hours service, Supabase repository, and the existing `weekly_work_schedules` / `work_schedule_periods` tables.
- A first Phase 2 My Week slice: signed-in users can view the current Sunday-to-Thursday week with saved work hours and selected-date inbox missions grouped by target date. This is a read model, not an automatic scheduler.
- A pure Phase 3 planner core: validated UTC planning windows and blocking intervals, deterministic mission ranking, deadline/date/weekday eligibility, buffers and daily caps, fixed-time conflict reporting, whole-session placement, feasible splitting, and explicit unscheduled reasons. It does not yet load or save plans.

The remaining Phase 2–8 work is still planned: broader work-schedule and mission CRUD, planner orchestration and persistence, the calendar, rescheduling, recurrence generation, meetings and contacts UI, Telegram and reminder workers, PDF/DOCX generation, and production hardening. The foundation schema and pure planner anticipate those capabilities; they do not make them operational.

Current Phase 2 note: basic selected-date mission capture, Mission Inbox reading, normal weekly work-hours settings, and a read-only My Week dashboard are now operational. The rest of Phase 2 and later phases remain planned.

## 2. Architecture overview

### Implemented architecture

Next.js renders public authentication screens and the protected application shell. Browser and server Supabase clients use the public project URL and anonymous/publishable key. The proxy refreshes auth cookies and verifies signed claims for `/app`; the protected layout verifies claims again before rendering. Supabase Auth owns credentials. An `auth.users` trigger creates the corresponding profile and preferences. PostgreSQL is the source of truth and RLS is the final per-row authorization boundary.

```text
Browser
  |
  | HTTPS: React forms, Server Actions, route handlers
  v
Next.js App Router on Vercel/local Node
  |-- public /login and /sign-up
  |-- src/proxy.ts: refresh cookies + verify claims for /app/**
  |-- protected Server Components: verify claims again
  |
  | public Supabase URL + anon/publishable key, user JWT
  v
Supabase
  |-- Auth ---- auth.users
  |                 |
  |                 `-- handle_new_auth_user trigger
  |                       -> profiles + user_preferences
  |-- PostgREST/Data API -> RLS-protected public tables
  |-- PostgreSQL --------> constraints, triggers, indexes, calendar_items view
  `-- Storage -----------> private work-week-exports bucket
```

The first domain data-access paths now exist for Mission Inbox, Work Hours settings, and My Week. `/app/inbox` delegates to `src/lib/services/missions.ts` and `src/lib/repositories/missions.ts`; `/app/settings` delegates to `src/lib/services/work-hours.ts` and `src/lib/repositories/work-hours.ts`; `/app` delegates to `src/lib/services/my-week.ts`, composing existing mission and work-hours repositories through a pure read model in `src/lib/my-week/read-model.ts`. Those modules use the regular SSR Supabase client plus the signed-in user's JWT, so PostgreSQL/RLS remains the final authorization boundary. Other domain tables are not yet read or written by the UI.

### Target architecture for later phases

Shared server-side repositories and services will be the only business-logic layer used by web actions, Edge Functions, scheduled workers, and Telegram handlers. Presentation and provider adapters must not duplicate scheduling, recurrence, completion, reminder, or notification rules.

```text
Web UI -----------+
Telegram webhook -+--> authenticated boundary --> shared services
Cron/Edge jobs ---+                              |-- repositories --> PostgreSQL/RLS
                                                   |-- audit service --> audit_log
                                                   |-- reminder service --> reminders
                                                   |-- notification service --> outbox
                                                   |                         --> provider adapter
                                                   `-- export service --> private Storage

Provider adapters: Telegram (Phase 6), then optional Email/SMS/WhatsApp
```

Planned background work must run in Supabase scheduled jobs/Edge Functions or another durable worker, not inside an unreliable browser or long-running Vercel request. No Edge Function, cron job, Telegram webhook, notification sender, recurrence generator, scheduler, or export generator exists in Phase 1.

## 3. Directory structure

| Path | Responsibility and what belongs here | What must not be placed here |
| --- | --- | --- |
| `src/app/` | Next.js routes, layouts, metadata, route handlers, and thin Server Action entry points. Route groups separate auth pages from `/app`. | Reusable business rules, provider clients, secret constants, or duplicated repository queries. |
| `src/app/(auth)/` | Public login/sign-up pages and the three current auth Server Actions. | Scheduling, mission, meeting, or notification logic. |
| `src/app/auth/` | Supabase callback/OTP confirmation handlers and the user-safe auth error page. | Arbitrary redirect handling or internal error details. |
| `src/app/app/` | Authenticated shell layout and destination pages. `/app/inbox` and `/app/settings` own thin route and Server Action entry points. | Fake sample data or duplicated repository/business logic. |
| `src/components/auth/` | Auth presentation, React Hook Form clients, localized field errors, and copy. | Direct service-role access or raw database mutations. |
| `src/components/app-shell/` | Navigation configuration, responsive desktop/mobile navigation, account display, and shell header. | Domain data fetching or scheduling decisions. |
| `src/components/foundation/` | Honest empty-state presentation used by unfinished destinations. | Placeholder buttons with no real behavior. |
| `src/components/missions/` | Mission Inbox presentation, create form, and mission-specific form messages. | Direct database queries, service-role access, or scheduling decisions. |
| `src/components/my-week/` | Read-only My Week presentation combining saved work hours and selected-date inbox missions. | Scheduling/rescheduling algorithms or direct database queries. |
| `src/components/settings/` | Settings presentation, weekly work-hours form, and settings-specific form messages. | Direct database queries, service-role access, or scheduling decisions. |
| `src/components/ui/` | Small reusable shadcn-style primitives (`Button`, `Card`, `Input`, `Label`). | Product-specific workflows or network calls. |
| `src/lib/domain/` | Serializable domain values, discriminated unions, transition/split invariants, notification capabilities, and public error shapes. | React components, Next.js APIs, provider SDK calls, or persistence-specific query code. |
| `src/lib/dates/` | IANA-timezone-aware local-date and Sunday-to-Thursday week calculations. | Locale copy, UI rendering, or database access. |
| `src/lib/i18n/` | Translation dictionaries, locale normalization, language tags, and LTR/RTL metadata. | Scattered feature logic. New user-facing copy should be centralized here as localization is completed. |
| `src/lib/my-week/` | Pure My Week read-model assembly helpers that group already-fetched work-hours and mission data for presentation. | Supabase access, React components, or scheduling side effects. |
| `src/lib/security/` | Cross-cutting input-security helpers such as same-origin redirect validation. | Secrets or provider configuration. |
| `src/lib/supabase/` | Browser, server, and proxy client construction plus public-env validation. | Service-role clients in browser-reachable modules or domain-specific queries. Future privileged clients must be explicitly server-only. |
| `src/lib/repositories/` | Server-only persistence adapters that map Supabase rows to domain-facing DTOs. The current implementation covers Mission Inbox and Work Hours queries/writes. | React components, form state, or business decisions that belong in services. |
| `src/lib/services/` | Server-only business workflow functions shared by route actions/components. The current implementation covers basic selected-date mission creation/listing and weekly work-hours saving. | Provider SDK details, UI state, or direct browser imports. |
| `src/lib/validation/` | Reusable Zod boundary schemas and safe field-error mapping. | Database writes or UI state. |
| `supabase/migrations/` | Ordered, reviewable schema, RLS, function, trigger, index, and Storage changes. | Production personal data, plaintext secrets, or undocumented dashboard-only assumptions. |
| `supabase/tests/` | Transactional pgTAP structural and behavioral database/RLS verification. | Tests that require production users or production data. |
| `tests/unit/` | Fast Vitest tests for pure domain, date, validation, i18n, and security behavior. | Live Supabase, Telegram, or paid-service calls. |
| `e2e/` | Playwright browser journeys. The current test is a public auth-form smoke test. | Live paid-provider dependencies. |
| `.github/` | CI and dependency-update automation. | Runtime credentials or deploy-specific secrets in source. |
| Root configuration | Next.js, TypeScript, ESLint, PostCSS/Tailwind, Vitest, Playwright, pnpm, shadcn, environment example, and repository instructions. | Feature implementations that belong under `src/` or migrations. |

Future workers, provider adapters, report models, and export templates do not exist yet. Existing and future repositories/services must stay server-only and preserve dependency direction: routes/handlers -> services -> repositories/providers, never the reverse.

## 4. Database schema

### Conventions and extensions

The schema is defined by three ordered migrations dated `20260711`. UUID primary keys use `gen_random_uuid()` from `pgcrypto`; `btree_gist` supports owner-plus-time-range indexes. All instants are `timestamptz` and are UTC on the wire. A profile stores the IANA timezone used to interpret civil dates and times. Weekdays follow PostgreSQL `extract(dow)`: Sunday `0` through Saturday `6`.

All time intervals use half-open semantics, `[start, end)`. Adjacent intervals are valid; intervals overlap only when `existing.start < candidate.end AND existing.end > candidate.start`. Date helpers similarly expose `startsAt` and exclusive `endsBefore` boundaries.

Every user-owned child carries `owner_id`; composite `(parent_id, owner_id)` foreign keys prevent a child from pointing across owners. `owner_id` is immutable. The only exception is a Telegram update's one-way transition from unresolved `NULL` to a resolved owner. There is no seed data.

### Enums

| Enum | Values |
| --- | --- |
| `language_code` | `en`, `he` |
| `mission_priority` | `urgent`, `high`, `medium`, `low` |
| `mission_status` | `unscheduled`, `planned`, `in_progress`, `completed`, `partially_completed`, `postponed`, `not_completed`, `cancelled` |
| `scheduling_mode` | `fixed_time`, `selected_date`, `selected_weekdays`, `selected_dates`, `flexible_before_deadline`, `flexible_date_range` |
| `schedule_period_kind` | `work`, `break` |
| `date_override_kind` | `custom_hours`, `day_off` |
| `recurrence_frequency` | `daily`, `workdays`, `weekly`, `monthly`, `custom` |
| `recurrence_interval_unit` | `days`, `weeks`, `months` |
| `source_channel` | `web`, `telegram`, `system`, `api` |
| `notification_provider` | `telegram`, `email`, `sms`, `whatsapp` |
| `provider_connection_status` | `disconnected`, `pending`, `active`, `error`, `revoked` |
| `reminder_status` | `pending`, `processing`, `sent`, `failed`, `cancelled` |
| `notification_outbox_status` | `pending`, `processing`, `sent`, `failed`, `cancelled` |
| `notification_attempt_result` | `sent`, `retryable_failure`, `permanent_failure` |
| `contact_consent_status` | `unknown`, `pending`, `opted_in`, `opted_out` |
| `participant_role` | `organizer`, `required`, `optional` |
| `participant_status` | `pending`, `accepted`, `declined`, `reschedule_requested`, `cancelled` |
| `unavailable_kind` | `break`, `travel`, `personal`, `unavailable` |
| `export_format` | `pdf`, `docx` |
| `export_status` | `pending`, `processing`, `ready`, `failed`, `expired` |

### RLS and grant classes

All 25 public tables have RLS enabled. `anon` and `PUBLIC` have no table access.

- **Profile-own:** `profiles` permits authenticated owner `SELECT` and `UPDATE`; creation/deletion is not exposed.
- **Preference-own:** `user_preferences` permits authenticated owner `SELECT`, `INSERT`, and `UPDATE`, but not deletion.
- **Owner CRUD:** weekly schedules and periods, date overrides and periods, recurrence rules, unavailable periods, meetings, contacts, and participants permit authenticated owner `SELECT/INSERT/UPDATE/DELETE`.
- **Mission lifecycle:** missions, occurrences, and sessions permit authenticated owner `SELECT/INSERT/UPDATE`, but not physical deletion. Browser writes cannot set completion outcomes, forge non-web mission provenance, or violate the status-transition matrix; those paths belong to the planned trusted Completion service.
- **Owner read / trusted write:** provider connections, Telegram connections, reminders, outbox, delivery attempts, mission status history, completion records, exports, and audit records permit authenticated owner `SELECT`; only trusted `service_role` code writes them.
- **Service only:** `telegram_link_tokens` and `telegram_update_log` expose no authenticated/anonymous policies or grants.
- `service_role` has all table privileges and bypasses RLS by Supabase design. It must only exist in trusted server/Edge environments.

The Mission Inbox runtime path reads and writes the `missions` table for authenticated owners using RLS-protected selected-date, unscheduled mission rows. The Work Hours settings runtime path reads/writes `weekly_work_schedules` and `work_schedule_periods` for authenticated owners using RLS-protected rows. The My Week runtime path reads those same mission and work-hours tables and groups them into the current Sunday-to-Thursday week. Other service names in the catalog below still identify planned ownership boundaries, not existing executable classes.

### Identity and preferences tables

#### `profiles`

One-to-one application identity for `auth.users`. Columns: `id` (PK/FK to `auth.users`, cascade), nullable `display_name`, `timezone`, `language`, `created_at`, `updated_at`. Name and timezone lengths are checked; the timezone trigger validates against `pg_timezone_names`. The auth bootstrap trigger creates it and the future Profile/Settings service reads or updates it. RLS: Profile-own. Indexes: PK; no additional named index.

#### `user_preferences`

One row per owner. Columns cover week shape (`week_start`, `work_week_days`), default before/after buffers, daily work cap, split/reschedule/manual-position preferences, maximum reschedules, morning summary and reminder time, export language/orientation/content toggles, organization/signature labels, logo path, and timestamps. `owner_id` is unique and cascades from `profiles`. Checks bound weekdays, minutes, reschedules, and orientation. The auth bootstrap inserts defaults. Planned Settings, Scheduling, Reminder, and Export services read it; Settings writes it. RLS: Preference-own. Indexes: PK and unique owner.

### Work schedule tables

#### `weekly_work_schedules`

Versioned weekly schedule header. Columns: `id`, `owner_id`, `name`, `effective_from`, nullable `effective_until`, `is_active`, timestamps. The date range and trimmed name are checked; `(id, owner_id)` is unique for child FKs. Only one active row per owner is allowed by `weekly_work_schedules_one_active_per_owner_idx`; `weekly_work_schedules_owner_effective_idx` supports effective-date lookup. The implemented Work Hours settings service creates or reads the active default schedule. Planned Scheduling services will consume it. RLS: Owner CRUD.

#### `work_schedule_periods`

Civil-time work or break periods for a schedule weekday. Columns: `id`, `owner_id`, `schedule_id`, `weekday`, `period_kind`, `starts_at`, `ends_at`, timestamps. The composite FK to the schedule cascades and preserves ownership. Weekday and time order are checked; exact duplicates are unique. A serialized trigger rejects overlapping periods of the same kind, while a break may overlap a work interval so it can subtract availability. Break containment remains a service rule. `work_schedule_periods_owner_weekday_idx` serves owner/day scans. The implemented Work Hours settings service replaces one normal `work` period per Sunday-to-Thursday day. Planned Scheduling services will read those periods. RLS: Owner CRUD.

#### `date_schedule_overrides`

One override header per owner/date. Columns: `id`, `owner_id`, `override_date`, `override_kind` (`custom_hours` or `day_off`), optional `reason`, timestamps. `(owner_id, override_date)` is unique; reason length is bounded. A trigger prevents a `day_off` row from retaining periods. Planned WorkSchedule, Scheduling, and Audit services use it. RLS: Owner CRUD. Indexes: PK and owner/date unique.

#### `date_schedule_override_periods`

Work/break periods for a custom-hours override. Columns: `id`, `owner_id`, `override_id`, `period_kind`, `starts_at`, `ends_at`, timestamps. Composite FK cascades and preserves ownership; time order and exact uniqueness are checked. Triggers lock/verify the parent is `custom_hours` and reject same-kind overlap. `date_schedule_override_periods_owner_idx` supports owner/override scans. Planned WorkSchedule and Scheduling services use it. RLS: Owner CRUD.

#### `unavailable_periods`

Absolute blocking intervals for breaks, travel, personal time, or general unavailability. Columns: `id`, `owner_id`, `starts_at`, `ends_at`, optional `reason`, `kind`, `is_active`, `source_channel`, timestamps. Time order and reason length are checked. The calendar-slot trigger rejects active overlap with blocking meetings, mission sessions, or other active unavailable periods. `unavailable_periods_owner_range_idx` and GiST `unavailable_periods_owner_range_gist_idx` support active `[start,end)` range queries. Planned WorkSchedule and Scheduling services read/write it; Calendar reads it. RLS: Owner CRUD.

### Recurrence and mission tables

#### `recurrence_rules`

Normalized series rule shared by recurring missions or meetings. Columns: `id`, `owner_id`, `frequency`, `interval_count`, optional `interval_unit`, optional `by_weekdays`, optional `day_of_month`, `starts_on`, optional `ends_on` or `maximum_occurrences`, `timezone`, nullable `generation_cursor_date`, `is_active`, timestamps. Checks enforce valid/unique weekdays, legal dates and counts, mutually exclusive end conditions, and frequency-specific shapes. A trigger validates the IANA timezone. `recurrence_rules_generation_idx` supports active incremental generation. Planned Recurrence service writes and advances it; Mission, Meeting, and Scheduling services read it. RLS: Owner CRUD.

#### `missions`

The durable mission definition and scheduling intent, not a calendar block. Columns: identity/ownership/optional `recurrence_rule_id`; title/description/priority/status; `scheduling_mode` and duration; mode-specific `earliest_start_date`, `latest_date`, `deadline`, fixed timestamps, selected date, allowed weekday/date arrays; lock and split fields; category/notes/source; postponed count; timestamps. Composite recurrence FK preserves ownership and restricts deletion. Checks enforce text/duration/count bounds, valid dates/weekdays, a feasible split partition, and an exact shape for each scheduling mode. Status/provenance triggers enforce the shared transition matrix, reserve completion outcomes for trusted transactions, and prevent browser writes from claiming system/Telegram/API provenance. Named indexes cover owner/status, active deadline, mode, recurrence, and GIN weekday/date membership. The implemented Mission Inbox service currently inserts and lists `selected_date` + `unscheduled` rows with `source_channel = web`. Planned Scheduling, Recurrence, Completion, and Audit services will use the remaining lifecycle capabilities. RLS: owner `SELECT/INSERT/UPDATE`; no browser physical delete.

#### `mission_occurrences`

A concrete stateful instance of a mission, including a single non-recurring instance or one generated recurrence. Columns: `id`, `owner_id`, `mission_id`, stable `recurrence_key`, `occurrence_date`, optional `sequence_number`, status, lock flag, reschedule count, optional duration override/notes, `generated_at`, timestamps. Composite mission FK cascades unless retained history/completion records restrict removal. The mission plus recurrence key and mission plus occurrence date are unique, preventing duplicate generation; counts and duration are checked. Status writes use the same transition/completion guard as missions. `mission_occurrences_owner_date_idx` and `mission_occurrences_generation_idx` support calendar and idempotent-generation lookups. Planned Recurrence, Scheduling, Mission, and Completion services use it. RLS: owner `SELECT/INSERT/UPDATE`; no browser physical delete.

#### `mission_sessions`

One scheduled `[starts_at, ends_at)` block for an occurrence; a split mission can have several. Columns: `id`, `owner_id`, `occurrence_id`, positive `session_index`, timestamps for the slot, non-`unscheduled` status, lock flag, record timestamps. Composite occurrence FK cascades; `(occurrence_id, session_index)` is unique and end must follow start. The calendar-slot trigger rejects blocking overlap, and status writes use the shared transition/completion guard. B-tree and partial GiST owner/range indexes support calendar and conflict queries. Planned Scheduling and Completion services write it; Calendar, Reminder, and Export services read it. RLS: owner `SELECT/INSERT/UPDATE`; no browser physical delete.

#### `mission_status_history`

Append-only status transition history. Columns: `id`, ownership, mission/optional occurrence, `from_status`, `to_status`, optional `changed_by`, source, reason, JSON details, creation time. Composite FKs preserve owner and occurrence identity and restrict parent deletion; same-state history rows are rejected and details must be an object. Database triggers on mission, occurrence, and session status updates insert rows; session details include its ID. `mission_status_history_owner_mission_idx` supports history. Planned Completion/Audit views read it; trusted database/service code writes it. RLS: Owner read / trusted write.

#### `mission_completion_records`

One authoritative completion outcome per occurrence. Columns: ownership and immutable mission/occurrence identity, terminal completion status, `completed_at`, protected `completed_by`, optional actual duration/percentage/notes, original and final scheduled starts, immutable `reschedule_count_at_completion`, source, timestamps. The composite occurrence FK restricts deletion, occurrence is unique, status is limited to completed/partially completed/not completed, and duration/percentage shapes are checked. A trigger sets `completed_by` from `auth.uid()`, snapshots the occurrence reschedule count on insert, and prevents later identity/actor/snapshot rewriting. `mission_completion_records_owner_completed_idx` supports history. Planned Completion service writes; Mission, Export, and Audit services read. RLS: Owner read / trusted write.

### Meeting and people tables

#### `contacts`

An owner's address-book person. Columns: `id`, owner, `full_name`, optional phone/email/preferred provider, consent status/time, notes, active flag, timestamps. Name and consent timestamp shape are checked. `contacts_owner_name_idx` supports name search and a partial unique owner/lowercase-email index prevents duplicate non-null email. Planned Contact, Meeting, Telegram, and Notification services use it. RLS: Owner CRUD.

#### `meetings`

A fixed calendar commitment. Columns: `id`, owner, optional recurrence rule and series key, title/description, absolute start/end, all-day/cancel flags, location/URL, optional organizer contact, notes/source, timestamps. Composite recurrence and organizer-contact FKs preserve ownership; title/time and recurrence-pair shapes are checked. Series instance uniqueness prevents duplicate generation. Active owner/start B-tree and owner/range GiST indexes serve calendar/conflict reads. The calendar-slot trigger rejects overlap while the row is not cancelled. Planned Meeting, Recurrence, Scheduling, Reminder, and Export services use it. RLS: Owner CRUD.

#### `meeting_participants`

A participant snapshot/link on a meeting. Columns: `id`, owner, `meeting_id`, optional `contact_id`, optional display name/email, role, status, timestamps. Composite meeting/contact FKs preserve ownership; meeting deletion cascades and contact deletion is restricted. At least a contact, name, or email is required; a contact can appear once per meeting. `meeting_participants_owner_meeting_idx` supports meeting loads. Planned Meeting, Contact, and Notification services use it. RLS: Owner CRUD.

### Notification and Telegram tables

#### `notification_provider_connections`

Owner-level channel configuration and capability snapshot. Columns: `id`, owner, provider, status, external label, JSON capabilities, **non-secret** JSON configuration, verification time, timestamps. Owner/provider is unique; composite identity supports provider-consistent FKs; JSON values must be objects. Secrets must remain in environment/secret storage. Planned Notification service writes; Settings reads. RLS: Owner read / trusted write.

#### `telegram_connections`

Verified Telegram owner or contact binding. Columns: `id`, owner, provider connection/provider, optional contact, connection kind, Telegram user/chat IDs and username, link/revoke times, timestamps. Composite provider/contact FKs preserve ownership; provider must be Telegram and the owner/contact shape is enforced. Positive user IDs and owner/user uniqueness are checked. Partial unique indexes allow one active owner connection and one active contact connection; global partial uniques prevent one active Telegram user or chat from silently attaching to two owner accounts. Planned Telegram/Notification services write it. RLS: Owner read / trusted write.

#### `telegram_link_tokens`

Service-only, hashed, single-purpose linking challenges. Columns: `id`, owner, optional contact, unique `token_hash`, scope, expiry/consumption/creation times. Scope determines contact presence; expiry must be after creation and no more than 30 minutes later; consumption must occur inside that window. `telegram_link_tokens_active_idx` supports unused token lookup. Planned Telegram service writes and atomically consumes it. RLS: Service only; authenticated browsers cannot read hashes.

#### `reminders`

Logical scheduled reminder. Columns: `id`, owner, optional provider connection, entity type/ID, `remind_at`, provider/status, unique owner idempotency key, JSON payload, send/error fields, timestamps. Entity type is one of mission occurrence/session, meeting, or daily agenda; only daily agenda omits an entity ID. Provider-consistent composite FK nulls the connection field on deletion. `reminders_due_idx` serves pending due work and `reminders_owner_entity_idx` serves cancellation/rescheduling. Planned Reminder service writes; Settings/agenda views may read. RLS: Owner read / trusted write.

#### `notification_outbox`

Durable provider-delivery work item. Columns: `id`, owner, optional reminder and provider connection, provider/type/payload, status and availability/processing/send times, attempt counters, idempotency key, last error, timestamps. Composite FKs enforce matching owner/provider and null only the removed reference. JSON, retry counts, and owner idempotency are constrained. `notification_outbox_pending_idx` supports worker claims and `notification_outbox_owner_status_idx` supports history. Planned Notification service enqueues; provider workers claim/update it. RLS: Owner read / trusted write.

#### `notification_attempts`

Immutable-style delivery attempt detail. Columns: `id`, owner, outbox ID, attempt number/result, provider message/response fields, retry time, safe error code/summary, start/finish/creation times. Composite outbox FK cascades; attempt number is positive and unique per outbox; times and error length are checked. `notification_attempts_owner_created_idx` serves history. Planned provider workers write and Notification support views read. RLS: Owner read / trusted write.

#### `telegram_update_log`

Service-only webhook idempotency and diagnostics. `owner_id`/`connection_id` may start null until verified. Other columns: globally unique Telegram update ID, type, 64-character payload SHA-256, processing status, receive/process times, safe error code, creation time. Composite connection FK preserves resolved ownership. Status/time/hash shapes are checked. Pending-processing and owner-history indexes support worker recovery and diagnostics. Planned Telegram webhook writes it before processing. RLS: Service only.

### Export and audit tables

#### `exports`

Metadata for a selected week's generated report. Columns: `id`, owner, `week_start`, format/language/orientation/status, JSON filters, template version, optional storage bucket/path, error/generation/expiry times, timestamps. The storage pair must be both null or both present; the only bucket is `work-week-exports`; paths must begin with `<owner_id>/`; orientation, JSON, version, and expiry are checked. `exports_owner_week_idx` supports history and the bucket/path pair is unique. Planned Export service writes; export history reads. RLS: Owner read / trusted write.

#### `audit_log`

Trusted append-only action record. Columns: `id`, owner, optional actor, action, entity type/optional ID, source, optional JSON before/after summaries, optional correlation ID, creation time. Text and JSON shapes are checked. Owner/time and owner/entity/time indexes support review. Planned shared services write safe summaries without secrets or full sensitive payloads. RLS: Owner read / trusted write.

### Functions and triggers

| Function | Behavior and trigger/RPC exposure |
| --- | --- |
| `is_valid_weekdays`, `is_valid_dates` | Immutable CHECK helpers for non-empty duplicate-free arrays. Authenticated execution is granted because user writes invoke them. |
| `has_valid_mission_split_policy` | Immutable CHECK helper proving that some permitted session count can partition the total duration within minimum/maximum/session-count bounds. |
| `is_valid_mission_status_transition` | Immutable mission-status transition matrix shared by the database guard and mirrored in TypeScript. |
| `set_updated_at` | Stamps `updated_at` before updates on all mutable timestamped tables. Not exposed as RPC. |
| `protect_record_owner` | Rejects owner changes on all owner tables, except unresolved -> resolved Telegram update ownership. Not exposed as RPC. |
| `ensure_schedule_period_no_overlap` | Uses advisory transaction locks and rejects same-kind weekly/override period overlap. Triggered before relevant inserts/updates. |
| `validate_date_override_period`, `validate_day_off_override` | Enforce that only `custom_hours` overrides contain periods and `day_off` contains none, regardless of write order. |
| `validate_iana_timezone` | Validates profile and recurrence-rule timezones against PostgreSQL timezone names. |
| `ensure_calendar_slot_available` | Serializes writes per owner and rejects `[start,end)` overlap among blocking mission sessions, meetings, and unavailable periods. Cancelled/postponed/inactive rows do not block. |
| `validate_mission_status_write` | Rejects invalid transitions, browser-forged trusted provenance, and browser terminal completion writes that would bypass the future transactional Completion service. Not exposed as RPC. |
| `record_mission_status_change` | Security-definer trigger records actual mission, occurrence, and session status changes in `mission_status_history`. |
| `protect_completion_actor` | Sets a user-driven completion actor, snapshots the occurrence reschedule count, and keeps mission/occurrence identity, actor, and snapshot immutable. |
| `handle_new_auth_user` | Security-definer auth trigger creates `profiles` and `user_preferences`; invalid requested timezone falls back to `Asia/Jerusalem`. The migration safely backfills existing auth users. |

All trigger helpers set an empty `search_path` and mutating helpers are revoked from public/anon/authenticated RPC use. The migration creates owner-protection triggers on 24 owner tables, update-timestamp triggers on 20 mutable tables, status-validation and history triggers on missions/occurrences/sessions, overlap triggers, override-shape triggers, timezone triggers, the completion-record protection trigger, and `auth.users.on_auth_user_created`.

### Views, Storage, cron, and materialization

`calendar_items` is a read-only `security_invoker = true` view, deliberately not a duplicate writable table. It unions mission sessions (joined to occurrences/missions), meetings, and active unavailable periods into a common projection: item/owner/type/domain/occurrence IDs, `[starts_at, ends_at)`, title, priority, status, lock flag, and JSON metadata. Base-table RLS continues to apply. Authenticated and service roles may select it; anonymous users may not. It contains cancelled meetings and nonblocking mission sessions with their status, while inactive unavailable periods are omitted.

The `work-week-exports` Storage bucket is private, limited to 25 MiB, and accepts only PDF and DOCX MIME types. There are intentionally no browser `storage.objects` policies; a future trusted Export service will upload owner-prefixed objects and issue short-lived signed URLs.

There are no materialized views, cron/`pg_cron` jobs, Edge Functions, or database webhooks in Phase 1. Add scheduled work only with its executable service and migration/configuration in the same change.

## 5. Domain model

- A **Mission** is the durable work definition and scheduling intent: title, priority, estimate, constraints, split policy, recurrence link, and overall status. It is not itself a placed time block.
- A **Recurring series** is a normalized `recurrence_rules` row referenced by a mission or meeting. The rule describes frequency, interval, eligible weekdays/day, timezone, and termination; no human-only repeat string is authoritative.
- A **Mission occurrence** is one concrete, independently stateful instance of a mission. Completion, movement, cancellation, postponement, duration override, and reschedule count belong here. Its recurrence key/date uniques prevent duplicates.
- A **Mission session** is a scheduled block for an occurrence. Non-splittable work normally has one; splittable work may have several indexed sessions.
- A **Meeting** is a fixed commitment. It has its own recurrence link and participants and is never split. Later scheduling must move eligible flexible mission sessions around it, not move the meeting silently.
- A **Calendar item** is a read projection, not an authoritative entity. The view normalizes mission sessions, meetings, and unavailable periods while each domain table remains the source of truth.
- A **Work schedule** is an effective-dated weekly header plus one or more civil-time work/break periods per weekday. The TypeScript `WeeklyWorkSchedule` represents the aggregate, not a generated database row type.
- A **Date-specific work-hours override** replaces a date with custom work/break periods or marks it as a day off. Absolute `unavailable_periods` are separate blocking intervals and can supplement normal/override hours.
- A **Reminder** is the logical intent to notify at a UTC instant for an entity or agenda. It is separate from an **outbox item** (one durable provider delivery) and a **notification attempt** (one send result).
- A **Contact** is an owner-managed person with channel preference and consent. A **participant** is that person's role/status snapshot within a meeting; it may also be a name/email not yet linked to a contact.
- A **Notification** is provider-neutral message work selected by capability. Provider connection state and Telegram bindings are separate from domain entities.
- An **Export** is metadata and lifecycle state for one week/report format. The binary stays in private Storage and is never a public URL.

At TypeScript boundaries, local dates/times remain strings and instants are explicit-offset ISO strings. Database and calendar ranges are always half-open `[start,end)`.

## 6. Scheduling engine

**Status: pure core implemented; orchestration, preview UI, persistence, and rescheduling remain planned for Phase 3.** The core accepts work windows already resolved to UTC, subtracts buffered blocking intervals, ranks and places candidates deterministically, and returns scheduled sessions or explicit unscheduled reasons. It has no Supabase dependency and does not mutate data. A later service must resolve weekly schedules/date overrides in the owner's timezone, load meetings/unavailable/locked work, call the core, present a preview, and persist accepted changes transactionally.

### Planned rules

Availability for a date range will be calculated in the owner's IANA timezone:

1. Resolve the effective weekly schedule for each civil date.
2. Replace it with a date override; a day off yields no work intervals.
3. Start with work periods, subtract schedule/override breaks, then subtract active unavailable periods, fixed non-cancelled meetings, and locked/blocking mission sessions.
4. Expand blocking items by configured before/after/minimum buffers and enforce daily mission, meeting, and total-work caps from preferences. Clip all results to work periods.
5. Treat all intervals as `[start,end)` so adjacent assignments do not conflict.

Fixed-time missions are validated as fixed placements and never moved automatically. Selected-date missions may use any valid slot on that date. Selected-weekday and selected-date missions are limited to those candidates. Flexible-before-deadline missions must end no later than the deadline; flexible-range missions remain between earliest and latest dates. Expired deadlines and empty eligible date sets produce explicit unscheduled reasons.

The implemented rank is an ordered tuple rather than an AI score. Fixed-time candidates are placed first in start-time order. Flexible candidates sort by: earliest deadline (no deadline last), priority (`urgent > high > medium > low`), higher reschedule count, fewer eligible dates, earlier creation instant, occurrence ID, then mission ID. Placement uses the earliest feasible window, preferring one whole session; splits use the fewest feasible sessions and the largest feasible early part without making the remainder impossible. Workload and buffer constraints filter feasible placements rather than changing rank.

Only missions with a valid split policy may split. Every part must respect minimum/maximum session length, maximum session count, total duration, allowed dates, deadlines, daily caps, and buffers. Meetings never split. If no valid partition exists, return `minimum_session_duration_cannot_fit` rather than silently truncating work.

### Planned deterministic process

```text
plan(owner, civilDateRange, previewOnly):
  preferences = load owner profile/preferences
  workWindows = effective weekly periods for each date
  workWindows = apply custom-hours/day-off overrides
  blocking = active unavailable + fixed meetings + locked sessions
  free = subtract(expandWithBuffers(blocking), workWindows)
  free = apply daily mission/meeting/total caps

  occurrences = load eligible, nonterminal mission occurrences
  fixed, flexible = partition occurrences by scheduling mode/lock
  validate fixed assignments against constraints and report conflicts
  ranked = stableSort(flexible, explicit rank tuple)

  for occurrence in ranked:
    candidates = filter free slots by mode, dates, weekdays, deadline, caps
    placement = first deterministic whole-slot fit
    if no placement and mission is splittable:
      placement = first deterministic valid partition
    if placement:
      reserve placement in in-memory free set
      add scheduled/moved/split result with old and new slots
    else:
      add unscheduled result with machine-readable reason and warning

  if not previewOnly:
    in one transaction:
      lock owner scheduling scope
      recheck conflicts
      upsert/delete only superseded mission sessions
      preserve completed and locked records
      cancel obsolete reminders and create replacement idempotency keys
      append status/audit records
  return scheduled, moved, split, unscheduled, conflicts, warnings
```

Recurrence generation (Phase 4) must be idempotent and create concrete occurrences before scheduling. Editing scopes will be this occurrence, this and future, or entire series; the exact series-splitting transaction is not designed yet.

When work hours or a fixed meeting change, the planned service will first preview affected flexible occurrences, preserve completed/locked work and fixed meetings, then transactionally move only eligible sessions. It must record old/new times, replace reminders without duplicates, and return a user-visible summary. A not-completed/postponed mission will be reconsidered only within its constraints and reschedule limit; it must never be deleted silently.

The database overlap trigger is a final safety net, not the scheduler. To insert a meeting over an existing flexible session, the service must move/delete the superseded session in the same serialized transaction before inserting the fixed meeting.

## 7. Telegram integration

**Status: planned for Phase 6; inactive in Phase 1.** The database has provider/connection, hashed-link-token, update-log, reminder, outbox, and attempt tables, and the domain layer has parsed-action contracts. There is no bot client, webhook route, account-link UI, message parser, callback handler, or delivery worker.

### Planned user behavior

Commands/actions will include `/start`, `/today`, `/week`, `/next`, `/addmission`, `/addmeeting`, `/complete`, `/reschedule`, `/workhours`, and `/help`, with equivalent menu buttons. Natural language must not execute ambiguous mutations directly. The flow is:

```text
message -> parse to ParsedAssistantAction -> validate and resolve owner/timezone
        -> if read-only and unambiguous: call shared query service
        -> if state-changing: show structured summary + Confirm/Change/Cancel
        -> on Confirm: call the same Mission/Meeting/Schedule/Completion service as web
        -> persist transaction/audit -> edit/send result
```

The parser may use deterministic parsing or a later AI interpreter, but its output is only a candidate typed action. Zod/domain validation, ownership checks, business rules, and explicit confirmation remain authoritative.

Inline callbacks must carry an opaque or signed, short-lived, owner/action-scoped reference rather than trusting raw entity IDs or commands. `Confirm`, `Change`, and `Cancel`, plus completion options (`Complete`, `Partially complete`, `Postpone`, `Reschedule`, `Not completed`), must be idempotent. Expired or already-used callbacks return a safe prompt to restart.

Reminder messages will cover daily agenda, upcoming mission/meeting reminders, end-of-session unfinished prompts, and optional weekly planning. They will be created in the user's timezone but stored/sent as UTC instants through `reminders` -> `notification_outbox` -> Telegram adapter.

### Planned linking and webhook security

1. An authenticated web action asks trusted server code to generate a high-entropy token, stores only its hash with owner/scope/contact and an expiry no more than 30 minutes away, and returns a Telegram deep link.
2. `/start <token>` arrives only through the verified webhook. Trusted code hashes the presented token, locks the unused row, validates scope/expiry, checks global active Telegram user/chat uniqueness, creates the connection, and sets `consumed_at` atomically.
3. Link/unlink actions write safe audit events. Browser-supplied chat IDs are never trusted. A token is single-use and cannot silently rebind an active Telegram identity to another owner.

The webhook will require HTTPS POST, validate Telegram's secret header against `TELEGRAM_WEBHOOK_SECRET` with constant-time comparison, enforce body-size/content-type limits, and parse a strict update schema. Before any side effect it will insert the unique `telegram_update_id` and a SHA-256 diagnostic hash into `telegram_update_log`. Duplicate IDs return success without replay. After resolving a verified active connection, every service call is scoped to that stored owner; service-role access never substitutes a chat ID for authorization.

Unknown users receive linking instructions without data disclosure. Unsupported updates are marked `ignored`. Validation/ownership failures are permanent; internal/database/provider failures are logged with safe codes and a correlation ID, without tokens or full sensitive payloads.

Telegram `429` responses will honor `retry_after`; retryable network/5xx failures use bounded exponential backoff and increment outbox/attempt state. Permanent 4xx failures stop, and revoked/blocked chats mark the provider connection appropriately. Workers claim outbox rows atomically, use owner idempotency keys, and never retry past `maximum_attempts`. Webhook processing should acknowledge quickly and enqueue durable work instead of waiting for slow provider calls.

## 8. Notification architecture

**Status: foundation only.** `src/lib/domain/notification.ts` currently defines provider values, a capability matrix, provider-neutral message/buttons, and an outbox item shape. The database persists connections, reminders, outbox rows, and attempts. No provider adapter or sender runs in Phase 1.

Current capability metadata models plain text, buttons, links, delivery status, incoming replies, templates, and attachments for Telegram, Email, SMS, and WhatsApp. It is a planning/default contract, not proof that any provider is connected.

| Provider | Plain text | Buttons | Links | Delivery status | Incoming replies | Templates | Attachments |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Telegram | Yes | Yes | Yes | No | Yes | No | Yes |
| Email | Yes | No | Yes | No | No | Yes | Yes |
| SMS | Yes | No | Yes | Yes | No | Yes | No |
| WhatsApp | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

The planned server-only interface is conceptually:

```ts
interface NotificationProviderAdapter {
  readonly channel: NotificationProvider;
  readonly capabilities: NotificationCapabilities;
  send(input: ProviderNeutralMessage): Promise<ProviderSendResult>;
}
```

Domain services will request a logical notification from a shared Notification service. That service validates recipient consent/connection and required capabilities, creates a deterministic idempotency key, and commits an outbox row in the same durable workflow as the domain change. A worker selects the adapter by provider, records every attempt, updates sent/retry/failure state, and emits an audit summary. Mission, meeting, recurrence, scheduling, and reminder code must never import Telegram/Email/SMS/WhatsApp SDKs.

Telegram is the first planned active adapter in Phase 6. Email, SMS, and WhatsApp remain future adapters. Adding one requires: server-only credentials; a provider adapter; capability mapping; connection/consent setup; provider-neutral contract tests; retry/error classification; environment/deployment documentation; and UI configuration. It must not require changes to mission or meeting logic.

## 9. Authentication and authorization

### Implemented flow

- Sign-up validates full name, normalized lowercase email, password length, and confirmation match on client and server. The Server Action calls Supabase Auth with `full_name` metadata and a callback URL derived from the configured canonical HTTPS origin. Only non-production loopback development may fall back to the request origin.
- Email confirmations are enabled in `supabase/config.toml`. When Supabase returns no session, the form shows a confirmation-sent state.
- `/auth/callback` exchanges a PKCE `code` for a session. `/auth/confirm` verifies a `token_hash` for `email`, `email_change`, `magiclink`, or `signup`; invite and recovery types are not accepted. Both routes normalize `next` through the same-origin redirect helper and fall back to `/app`.
- Sign-in validates input, calls `signInWithPassword`, then replaces the browser route with a safe internal path.
- `src/proxy.ts` matches `/app/:path*`. It refreshes SSR cookies, calls `auth.getClaims()` to verify the JWT, redirects unauthenticated requests to `/login?next=...`, preserves response cookies, and sets `Cache-Control: private, no-store`.
- The protected layout calls `getClaims()` again. Missing/invalid claims redirect to `/login?next=/app`; verified claims supply email/display name to the shell.
- Sign-out calls Supabase Auth. Success redirects to `/login`; failure routes to a safe auth error and offers return to the workspace rather than claiming the session ended.

Cookies are path `/`, `SameSite=Lax`, and `Secure` in production. Server Components use best-effort cookie writes because they are read-only and the proxy owns refresh; Server Actions and auth routes require cookie writes and propagate unexpected failures. No code trusts `getSession()` for route authorization. Global headers disable framing, MIME sniffing, camera/microphone/geolocation/browsing-topics permissions, and use strict-origin referrers.

### Authorization model

The authenticated JWT subject must equal `owner_id` (or `profiles.id`) in RLS. Composite owner FKs and immutable-owner triggers prevent forged cross-owner relationships even when a client can write its own ordinary domain rows. Anonymous users have no domain access. Owner-readable operational/outcome tables require trusted code for writes; Telegram token/update tables are fully service-only.

There is no admin UI or admin role. Supabase project operators retain infrastructure-level access outside the application. `SUPABASE_SERVICE_ROLE_KEY` is reserved for future trusted services and is not used by Phase 1 runtime code; it must never enter a `NEXT_PUBLIC_*` variable, client bundle, log, URL, or Telegram payload. Future service-role handlers must establish ownership from an authenticated user or verified stored integration connection before querying/mutating, because service role bypasses RLS.

## 10. UI structure

### Routes and navigation

- `/` redirects to `/app`.
- `/login` and `/sign-up` are responsive public auth screens.
- `/auth/error` renders safe messages for invalid callbacks, confirmation failure, and sign-out failure.
- `/app` (My Week), `/app/inbox` (Mission Inbox), `/app/people` (People and Meetings), and `/app/settings` (Settings) are protected Phase 1 empty states.

Desktop (`md` and wider) uses a fixed 248 px sidebar with four labeled destinations and an account/sign-out area. Mobile uses a sticky header, icon sign-out control, and a four-item bottom navigation with safe-area padding. Navigation resolves the longest matching route and sets `aria-current="page"`.

There is no calendar/grid/day agenda, mission/work-schedule/meeting/contact/settings editor, Telegram linking panel, or export history UI yet. Those begin in Phase 2 and must use mobile day-list/agenda alternatives when a week grid is not usable.

### Components and forms

`AuthShell` supplies the responsive brand/auth layout. `LoginForm` and `SignUpForm` use React Hook Form plus shared Zod schemas, submit to Server Actions, disable while pending, show an accessible spinner, and render field/form errors. `AppShell`, `ShellHeader`, and desktop/mobile navigation compose protected pages. `FoundationView` explicitly states that later services are not connected. Local UI primitives follow shadcn aliases and use `class-variance-authority`/`cn` for variants.

### Design and accessibility rules

Design tokens live in `globals.css`: light neutral surfaces, restrained green primary, opaque high-contrast focus ring, destructive and success states, 12–16 px radii, and minimal shadows. Extend tokens/primitives instead of introducing one-off colors and controls. Icons are Lucide and decorative icons are `aria-hidden`.

Interactive controls have visible keyboard focus, disabled states, and at least 40–44 px targets; mobile navigation targets are 48 px. Forms use real labels, autocomplete/input modes, `aria-invalid`, `aria-describedby`, and alert/live regions. The shell includes a keyboard skip link and semantic `nav`, `header`, and `main`; the main target is programmatically focusable. Preserve these patterns, test keyboard and screen-reader behavior, keep contrast WCAG AA, and never encode status by color alone.

All visible Phase 1 copy is sourced from the centralized English/Hebrew dictionaries. The root layout derives `lang` and `dir` from `DEFAULT_LOCALE` (currently English/LTR), so switching the locale source can activate the translated copy and RTL direction without rewriting components. There is not yet a persisted locale selector/context, localized date formatter, or per-user runtime language load.

## 11. API and server actions

There are no domain API routes, repositories, Edge Functions, cron endpoints, Telegram webhooks, or export endpoints in Phase 1.

| Boundary | Purpose and request | Response | Auth/validation | Side effects, tables, errors |
| --- | --- | --- | --- | --- |
| `signInWithPassword(input)` Server Action | Sign in with `{email, password}`. | `{ok:true, requiresEmailConfirmation:false}` or `{ok:false,message}`. Client navigates to sanitized `next`/`/app`. | Public; `signInSchema` normalizes email and requires password. Supabase verifies credentials. | Creates/refreshes Supabase auth session cookies; no public table write. Invalid credentials receive a generic message; outages are retry-safe generic errors. |
| `signUpWithPassword(input)` Server Action | Create user with `{fullName,email,password,confirmPassword}`. | Success includes whether email confirmation is required; otherwise a generic failure. | Public; `signUpSchema`, 2–100 name, valid <=254 email, 8–128 password, match. Production requires canonical HTTPS `NEXT_PUBLIC_APP_URL`; only local development permits HTTP loopback fallback. | Creates `auth.users`; database trigger creates `profiles` and `user_preferences`. Required cookie-write failures fail safely. Does not reveal duplicate-account details. |
| `signOut()` Server Action | End current Supabase session; no body. | Redirect `/login`; on failure redirect `/auth/error?reason=signout_failed`. | Invoked from protected shell, but handles missing/error safely. | Revokes/clears auth session cookies; no domain table write. |
| `GET /auth/callback` | Query: required `code`, optional `next`. Exchanges PKCE code. | 302 to safe internal `next` (default `/app`) or auth error. | Public one-time auth callback; Supabase validates code; `next` rejects external/protocol-relative/control/backslash input. | Establishes auth session cookies. Missing code -> `invalid_callback`; exchange error -> `confirmation_failed`. |
| `GET /auth/confirm` | Query: `token_hash`, allowed OTP `type`, optional `next`. | 302 to safe `next` or confirmation error. | Public one-time email link; Supabase validates hash/type. | Establishes/updates auth session; sign-up can trigger profile/preferences via `auth.users`. Invalid/expired/unsupported data -> generic confirmation failure. |
| `/app/**` proxy | Refresh auth and protect route, preserving requested path/query as `next`. | Continue with private/no-store response or 302 to login. | Verified Supabase `getClaims`, never unverified cookie session. | May rotate cookies; no application table writes. Configuration errors fail closed at runtime. |

`forgotPasswordSchema` and `resetPasswordSchema` exist as validation foundations, but there are no forgot/reset pages or actions. `/auth/error` is a rendered page, not an API. Future boundaries must use typed requests, shared Zod/domain validation, the `AppErrorResponse` shape where appropriate, safe user messages, and secure server diagnostics.

## 12. Environment variables

Never commit real values. `.env.example` is the inventory.

| Variable | Visibility | Purpose and Phase 1 requirement | Configure where |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe public | Supabase API/Auth URL; required by browser, server, and proxy clients. Must be HTTPS except localhost/127.0.0.1. | `.env.local`; Vercel Preview/Production. Local default `http://127.0.0.1:54321`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe public | Supabase anonymous/publishable key; required now. Authorization still relies on JWT + RLS. | `.env.local`; Vercel. Obtain local value from `supabase status`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only secret** | Reserved for future trusted writes/workers and private Storage. Phase 1 app code does not read it. | Future Vercel server env and/or Supabase Edge Function secrets; local only when testing privileged services. Never browser-exposed. |
| `TELEGRAM_BOT_TOKEN` | **Server-only secret** | Telegram Bot API credential; inactive until Phase 6. | Future Supabase/Vercel trusted runtime and local webhook env. |
| `TELEGRAM_WEBHOOK_SECRET` | **Server-only secret** | Verifies Telegram webhook secret header; inactive until Phase 6. | Future trusted webhook runtime and Telegram webhook configuration. |
| `TELEGRAM_BOT_USERNAME` | Server-only configuration | Builds bot deep links; inactive until Phase 6. | Future trusted runtime/local webhook env. |
| `NEXT_PUBLIC_APP_URL` | Browser-safe public | Canonical application origin used for auth callback. Required as HTTPS in production; non-production may use/fall back only to `http://localhost` or `http://127.0.0.1`. Embedded credentials are rejected. | `.env.local`; Vercel, e.g. the exact HTTPS production origin. Also allow it in Supabase Auth redirect URLs. |
| `APP_TIMEZONE_DEFAULT` | Server-only configuration | Planned application default (`Asia/Jerusalem`). Phase 1 database bootstrap currently has the same explicit default and does not read this variable. | `.env.local`, future Vercel/Edge runtime. A future migration/service must define precedence before relying on it. |
| `CRON_SECRET` | **Server-only secret** | Planned authentication for scheduled endpoints if such an endpoint is used; inactive because no cron exists. | Future scheduler secret store and trusted handler runtime. Prefer direct authenticated Edge scheduling where possible. |

Supabase's own platform variables are managed by Supabase and are not application inputs. GitHub Actions currently supplies non-secret test Supabase public values only to the Playwright dev server; database CI starts an isolated local Supabase stack.

## 13. Local development

Prerequisites: Node.js 24.14.x (the CI baseline) or a newer supported Node.js 24 release, pnpm 11.7, Git, and Docker Desktop for local Supabase/database tests. Node 23 is excluded because the locked test toolchain does not support it. The Supabase CLI and Playwright are project dev dependencies.

```powershell
pnpm install
Copy-Item .env.example .env.local   # edit values; never commit it
pnpm exec supabase start            # requires Docker
pnpm exec supabase status           # copy local URL/anon key into .env.local
pnpm exec supabase db reset         # applies all migrations from zero
pnpm dev
```

The app is at `http://localhost:3000`, Supabase API at `http://127.0.0.1:54321`, Studio at `http://127.0.0.1:54323`, and local confirmation email/Inbucket at `http://127.0.0.1:54324`.

pnpm 11 blocks dependency lifecycle scripts by default. `pnpm-workspace.yaml` deliberately allows only reviewed `sharp` and `unrs-resolver` builds and limits child concurrency. Review and document any new lifecycle allowlist entry.

For a schema change, add a new timestamped SQL file under `supabase/migrations`; do not edit an already-deployed migration or rely on a dashboard-only change. Reset the local database, run pgTAP, inspect RLS/grants, update generated TypeScript database types once that workflow exists, and update this guide. Development seeds must be non-personal and safe; none currently exist.

Verification commands:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm test:db
pnpm test:e2e
pnpm build
```

`pnpm test:db` needs the running Docker-backed Supabase stack. Playwright starts Next.js on port 3100 and needs installed Chromium (`pnpm exec playwright install chromium`). The current E2E test does not need a live authenticated Supabase user.

Telegram webhook development is unavailable until Phase 6. That phase must document a secure HTTPS tunnel or deployed test Edge Function, separate test bot credentials, webhook-secret setup, update replay fixtures, and provider mocks; never point automated tests at the production bot.

## 14. Deployment and rollback

Phase 1 includes build/CI foundations but has not configured Edge Functions, cron, Telegram, or an export worker.

### Web and Supabase deployment

1. Create separate Supabase projects for preview/staging and production where practical. Review project region, Auth email settings/templates, allowed site/redirect URLs, backups, and Storage limits.
2. Link the Supabase CLI to the intended project, inspect pending migrations (`supabase db diff`/migration list as appropriate), take a backup for risky changes, then apply ordered migrations with `supabase db push`. Never use production as the first migration test.
3. Verify RLS/grants and the private bucket after migration. Configure the exact Vercel HTTPS origin in Supabase Auth.
4. Import the repository into Vercel, set the documented environment variables per Preview/Production, use pnpm and `pnpm build`, and deploy. `NEXT_PUBLIC_SUPABASE_*` and `NEXT_PUBLIC_APP_URL` are required now; keep all secret values server-only.
5. Run smoke checks for sign-up confirmation, callback, login, protected-route redirect, sign-out, and cross-owner isolation. CI must be green before promotion.

No Supabase Edge Function deployment, cron schedule, or Telegram webhook should be configured until its matching Phase 6 service exists. Future functions are deployed with the Supabase CLI, receive secrets through Supabase secret management, validate callers explicitly, and share versioned domain contracts. Scheduled reminder/outbox work must be configured through a migration or documented infrastructure-as-code step, then monitored.

### Rollback

- **Web:** redeploy the last known-good immutable Vercel deployment, then diagnose forward. Public env changes may require a rebuild.
- **Database:** prefer a reviewed forward corrective migration. PostgreSQL/Supabase migrations are not automatically reversible; never delete or rewrite applied history. Before a destructive migration, take/verify a backup or PITR capability and use an expand-migrate-contract rollout so the previous web version remains compatible.
- **Auth/Storage:** preserve auth users and private export objects. Reverting the web does not revert email-template, redirect, secret, bucket, or policy changes; track and restore those explicitly.
- **Future workers/webhooks:** disable the cron/webhook or roll the function back before schema rollback, stop new outbox claims, preserve idempotency logs, and resume only after compatibility is verified.

Rollback success includes restored auth, owner isolation, no duplicate notifications, and an audit/incident note. Never use destructive local Git/database commands against production as a rollback shortcut.

## 15. Testing strategy

| Layer | Implemented Phase 1 coverage | Required later |
| --- | --- | --- |
| Unit/Vitest | Auth normalization/bounds/errors; mission creation validation; work-hours validation; My Week read-model grouping; mission status transitions and split feasibility; error contract; safe redirects; locale/direction helpers; Sunday-to-Thursday/DST/date validation; planner interval normalization/subtraction, deterministic deadline/priority/stable ranking, allowed days, buffered blockers, fixed conflicts, caps, whole and split placement, and explicit failure reasons. | Schedule/override-to-UTC availability orchestration, transactional rescheduling, recurrence, reminder times, report-data preparation. |
| Database/pgTAP | 17 transactional checks: schema/enums/indexes/triggers/grants/RLS structure, bootstrap, two-owner isolation, security-invoker view isolation, feasible/impossible split policies, completion/provenance guards, completion snapshot/identity immutability, physical-delete denial, period-overlap rejection, service-only token denial, anonymous denial, and private bucket. | Service transaction integration, rescheduling, recurrence idempotency, completion/outbox/update idempotency, retry claims, export metadata/storage authorization. |
| Browser/Playwright | Desktop Chrome and Pixel 7 projects verify the public login form, semantics, validation, and recovery after errors without live credentials. | Real local auth/confirmation and protected shell; mission, plan, meeting, work-hours, completion, Telegram-with-mocks, and export journeys. |
| CI | Separate quality (`lint`, typecheck, unit, build), Chromium E2E, and Docker-backed Supabase reset/pgTAP jobs. Dependabot covers npm and Actions. | Provider contract tests, Edge Function tests, export visual/content regression, load/concurrency checks, accessibility audit. |

Tests must not require a live production project, production Telegram bot, or paid provider. Use synthetic transaction-scoped users, isolated local Supabase, provider mocks, frozen clocks/timezones, deterministic UUID/tie-breaking fixtures, and replayed webhook payloads. Presence of a test file is not evidence it passed: contributors must run the relevant commands and report environment blockers (especially Docker/browser installation).

High-risk scheduling tests must include DST boundaries, Sunday/Thursday/Friday transitions, adjacent `[start,end)` slots, locked/fixed conflicts, caps/buffers, impossible splits, stable ties, and transactional concurrent inserts. Telegram tests must cover invalid secrets, unknown/revoked users, duplicate update/callback replay, expired/consumed link tokens, ownership mismatch, 429 `retry_after`, retryable/permanent errors, and log redaction. Export tests must compare the shared report data and rendered English/Hebrew PDF/DOCX structure without screenshot-based PDF generation.

## 16. Important technical decisions

| ID / date | Decision | Reason and alternatives considered | Consequences |
| --- | --- | --- | --- |
| ADR-001 / 2026-07-11 | Use Next.js App Router + strict TypeScript + Tailwind/shadcn conventions and Supabase. | Provides SSR auth, accessible React composition, managed Auth/PostgreSQL/RLS/Storage. Separate custom API/database infrastructure was larger than Phase 1. | Next.js boundaries stay thin; Supabase/PostgreSQL is authoritative. |
| ADR-002 / 2026-07-11 | Store domain-specific calendar tables and expose a `security_invoker` union view instead of a writable `calendar_items` table. | A duplicate unified table could drift and complicate domain constraints. | Calendar reads are unified; writes always target mission sessions, meetings, or unavailable periods. |
| ADR-003 / 2026-07-11 | Put `owner_id` on every owned child, use composite owner FKs, immutable-owner triggers, and RLS. | RLS alone does not prevent an owned child from referencing another owner's parent. | Some keys are redundant by design; cross-owner graph construction is blocked in depth. |
| ADR-004 / 2026-07-11 | Store instants as UTC `timestamptz`, store IANA timezone separately, and use half-open `[start,end)` ranges. | Local timestamps and inclusive millisecond ends fail around DST and adjacency. | Civil-time conversion is explicit; ambiguous/nonexistent times require user resolution. |
| ADR-005 / 2026-07-11 | Permit direct owner writes for ordinary domain rows, but withhold mission-chain physical deletes and terminal completion/provenance writes; keep outcomes, integration state, delivery state, exports, and audit trusted-write. | Browser writes could forge or erase sent/completed/audit evidence. Fully service-only CRUD for every ordinary table was unnecessary before services exist. | Later shared services must use trusted credentials for protected transactions, implement retention-aware lifecycle behavior, and independently establish owner scope. |
| ADR-006 / 2026-07-11 | Model reminders and provider sends with a durable outbox/attempt pattern. | Direct Telegram calls from domain transactions are not retry-safe or provider-neutral. | Delivery is eventual and auditable; a worker/idempotency design is required in Phase 6. |
| ADR-007 / 2026-07-11 | Keep weekly exports in a private service-only bucket with owner-prefixed paths and signed access later. | Public object URLs would expose sensitive work reports. | Browser upload/read policies are intentionally absent; an Export service must broker files. |
| ADR-008 / 2026-07-11 | Use Supabase email/password confirmation with SSR cookies and verified claims at proxy and layout boundaries. | Trusting cookie session contents alone is insufficient; custom credential storage is unsafe. | Auth depends on correct redirect/email configuration; recovery/invite workflows remain to implement. |
| ADR-009 / 2026-07-11 | Do not configure cron, Edge Functions, webhook, or fake dashboard-only runtime before executable services exist. | Orphan schedules/endpoints create security and operational drift. | Schema is ready, but later phases must deliver code, migrations/config, tests, and documentation together. |
| ADR-010 / 2026-07-13 | Allow only reviewed `sharp` and `unrs-resolver` lifecycle builds under pnpm 11. | pnpm's default hardening blocks scripts; these native builds are required for Next image/ESLint tooling. | New install scripts fail until explicitly reviewed and documented. |
| ADR-011 / 2026-07-14 | Keep planning as a pure deterministic function over UTC-resolved half-open windows, with an explicit rank tuple and machine-readable unscheduled reasons. | Mixing database reads/writes, civil-time conversion, and placement logic would make previews hard to reproduce and failures hard to explain. Weighted or AI scoring would hide ordering changes. | Callers must resolve owner-local schedules before planning and persist only after preview/transactional conflict recheck; identical validated inputs produce identical output. |

## 17. Known limitations

- Phase 1 is implemented plus narrow Mission Inbox, Work Hours settings, and My Week read-model slices. People and Meetings still shows an honest empty state.
- Mission and Work Hours service/repository implementations exist only for selected-date unscheduled mission creation/listing and one normal work period per Sunday-to-Thursday day. Meeting, Scheduling, Recurrence, Completion, Reminder, Notification, Contact, Telegram, Export, and Audit service implementations do not exist yet.
- The database permits owner writes for ordinary domain tables, with additional lifecycle guards on missions/occurrences/sessions. The implemented mission workflow routes through shared server-side service/repository modules; future workflows should follow that pattern.
- No date override, calendar placement, recurrence, meeting, contact, completion, reminder, Telegram, or export end-user workflow exists. My Week is read-only and does not automatically schedule missions into time slots. Mission editing, deletion, completion, recurrence, flexible deadlines, weekday/date-set constraints, fixed-time mission creation, multiple periods per day, breaks, date-specific overrides, and splitting controls are not implemented.
- The pure deterministic planner, rank policy, interval subtraction, splitting, caps/buffers, and scheduled/unscheduled result contract are implemented. Supabase loading, owner-timezone availability resolution, preview UI, transactional session writes, moved-session diffs, conflict rechecks, and automatic rescheduling are not implemented.
- Recurrence rules and occurrence uniqueness exist, but there is no generator or editing-scope transaction.
- Telegram tables/contracts exist, but there is no bot/webhook/linking/callback/parser/provider worker. No notification provider is active.
- Reminder/outbox/attempt tables exist, but no cron, queue claimant, retry worker, or provider adapter exists.
- Export metadata/private bucket exist, but no shared report model, PDF/DOCX renderer, upload, signed URL, history UI, or cleanup worker exists.
- Supabase clients are not parameterized with generated `Database` types. TypeScript domain aggregates are hand-written and are not row types.
- Auth E2E is a public form smoke test; it does not prove live sign-up confirmation, session refresh, cross-owner application behavior, or sign-out. Forgot/reset password, invite, and recovery flows are absent.
- English remains the fixed `DEFAULT_LOCALE`. Complete Hebrew Phase 1 copy and direction helpers exist, and the document derives `lang`/`dir` from that locale, but runtime per-user locale choice, layout QA in RTL, and localized date/report formatting are absent.
- No Realtime subscription is used; later changes would require an explicit query invalidation/subscription strategy.
- There is no application admin role or admin UI. Service-role usage is reserved but not wrapped in an implemented server-only client/repository.
- Database tests require Docker/local Supabase; environments without Docker cannot execute them. Playwright requires installed Chromium.
- Persistence currently has one `maximum_daily_work_minutes` cap, not distinct mission, meeting, and total scheduled caps. The TypeScript schedule aggregate anticipates those distinctions; Phase 2 must reconcile the aggregate and add any required migration before the scheduler relies on them.
- Database constraints deliberately do not validate that break periods are contained inside work periods; the future WorkSchedule service must enforce aggregate containment.
- The calendar overlap trigger rejects a newly inserted fixed meeting if a flexible session still occupies the slot; the future scheduler must move the flexible session first inside one transaction.
- Security headers are a baseline, not a complete production review; CSP, rate limits, abuse monitoring, secret rotation, backup/PITR, observability, and incident procedures remain Phase 8 work.

## 18. Change history

- **2026-07-11 — Phase 1 foundation:** Created the Next.js/TypeScript/Tailwind/shadcn project, Supabase SSR email/password auth, protected responsive shell, centralized validation/i18n/date/domain contracts, normalized 25-table schema, RLS/grants, ownership and overlap triggers, calendar view, private export bucket, test infrastructure, CI, environment example, and repository instructions.
- **2026-07-13 — Phase 1 alignment and documentation:** Hardened same-origin redirects, canonical confirmation origins, cookie-write failures, and sign-out/confirmation behavior; aligned mission occurrence/session/completion domain contracts with persistence; standardized half-open work-week boundaries and rejected DST ambiguity, skipped midnights, and nonexistent civil dates; centralized all visible Phase 1 English/Hebrew copy and derived document direction from the default locale; enforced split feasibility, status/provenance/completion guards, history retention, and completion reschedule snapshots in PostgreSQL; expanded auth, redirect, browser, and database/RLS verification; documented the implemented foundation and planned Phase 2–8 architecture in this guide.
- **2026-07-13 — CI runtime alignment:** Updated GitHub Actions to Node.js 24.14.0 so pnpm 11.7 runs on the same supported runtime used for local validation.
- **2026-07-13 — Database test portability:** Rewrote pgTAP assertions to avoid nested data-modifying CTEs rejected by PostgreSQL.
- **2026-07-14 — Deterministic planner core:** Added the pure scheduling input/result contract, validated UTC half-open interval normalization and subtraction, explicit deadline/priority/stable ordering, date and weekday eligibility, buffered blockers, daily mission caps, fixed-time validation, whole and split placement, machine-readable unscheduled reasons, and focused unit coverage. Documented the reproducibility boundary and remaining orchestration/persistence work in ADR-011.
