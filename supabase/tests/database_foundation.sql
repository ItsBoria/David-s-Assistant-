\set ON_ERROR_STOP on

-- Structural verification that can run against an empty local database with:
--   supabase test db supabase/tests/database_foundation.sql
-- It does not require, create, or inspect production user data.
begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

do $$
declare
  expected_tables constant text[] := array[
    'profiles', 'user_preferences', 'weekly_work_schedules', 'work_schedule_periods',
    'date_schedule_overrides', 'date_schedule_override_periods', 'recurrence_rules',
    'unavailable_periods', 'missions', 'mission_occurrences', 'mission_sessions',
    'meetings', 'contacts', 'meeting_participants', 'notification_provider_connections',
    'telegram_connections', 'telegram_link_tokens', 'reminders', 'notification_outbox',
    'notification_attempts', 'mission_status_history', 'mission_completion_records',
    'exports', 'audit_log', 'telegram_update_log'
  ];
  owner_tables constant text[] := array[
    'user_preferences', 'weekly_work_schedules', 'work_schedule_periods',
    'date_schedule_overrides', 'date_schedule_override_periods', 'recurrence_rules',
    'unavailable_periods', 'missions', 'mission_occurrences', 'mission_sessions',
    'meetings', 'contacts', 'meeting_participants', 'notification_provider_connections',
    'telegram_connections', 'telegram_link_tokens', 'reminders', 'notification_outbox',
    'notification_attempts', 'mission_status_history', 'mission_completion_records',
    'exports', 'audit_log', 'telegram_update_log'
  ];
  owner_required_tables constant text[] := array[
    'user_preferences', 'weekly_work_schedules', 'work_schedule_periods',
    'date_schedule_overrides', 'date_schedule_override_periods', 'recurrence_rules',
    'unavailable_periods', 'missions', 'mission_occurrences', 'mission_sessions',
    'meetings', 'contacts', 'meeting_participants', 'notification_provider_connections',
    'telegram_connections', 'telegram_link_tokens', 'reminders', 'notification_outbox',
    'notification_attempts', 'mission_status_history', 'mission_completion_records',
    'exports', 'audit_log'
  ];
  owner_readable_tables constant text[] := array[
    'user_preferences', 'weekly_work_schedules', 'work_schedule_periods',
    'date_schedule_overrides', 'date_schedule_override_periods', 'recurrence_rules',
    'unavailable_periods', 'missions', 'mission_occurrences', 'mission_sessions',
    'meetings', 'contacts', 'meeting_participants', 'notification_provider_connections',
    'telegram_connections', 'reminders', 'notification_outbox', 'notification_attempts',
    'mission_status_history', 'mission_completion_records', 'exports', 'audit_log'
  ];
  private_tables constant text[] := array['telegram_link_tokens', 'telegram_update_log'];
  mutable_tables constant text[] := array[
    'profiles', 'user_preferences', 'weekly_work_schedules', 'work_schedule_periods',
    'date_schedule_overrides', 'date_schedule_override_periods', 'recurrence_rules',
    'unavailable_periods', 'missions', 'mission_occurrences', 'mission_sessions',
    'meetings', 'contacts', 'meeting_participants', 'notification_provider_connections',
    'telegram_connections', 'reminders', 'notification_outbox',
    'mission_completion_records', 'exports'
  ];
  ownership_constraints constant text[] := array[
    'work_schedule_periods_schedule_owner_fk',
    'date_schedule_override_periods_override_owner_fk',
    'missions_recurrence_owner_fk',
    'mission_occurrences_mission_owner_fk',
    'mission_sessions_occurrence_owner_fk',
    'meetings_recurrence_owner_fk',
    'meetings_organizer_contact_owner_fk',
    'meeting_participants_meeting_owner_fk',
    'meeting_participants_contact_owner_fk',
    'telegram_connections_provider_owner_fk',
    'telegram_connections_contact_owner_fk',
    'telegram_link_tokens_contact_owner_fk',
    'reminders_provider_owner_fk',
    'notification_outbox_reminder_owner_fk',
    'notification_outbox_provider_owner_fk',
    'notification_attempts_outbox_owner_fk',
    'mission_status_history_mission_owner_fk',
    'mission_status_history_occurrence_identity_fk',
    'mission_completion_records_occurrence_identity_fk',
    'telegram_update_log_connection_owner_fk'
  ];
  required_indexes constant text[] := array[
    'missions_owner_status_idx',
    'missions_owner_deadline_idx',
    'mission_occurrences_owner_date_idx',
    'meetings_owner_start_idx',
    'reminders_due_idx',
    'notification_outbox_pending_idx',
    'recurrence_rules_generation_idx',
    'telegram_update_log_telegram_update_id_key',
    'telegram_connections_active_owner_user_global_idx',
    'telegram_connections_active_owner_chat_global_idx',
    'exports_owner_week_idx',
    'audit_log_owner_created_idx'
  ];
  missing_items text[];
  enum_values text[];
begin
  select array_agg(table_name order by table_name)
    into missing_items
  from unnest(expected_tables) as expected(table_name)
  where to_regclass(format('public.%I', expected.table_name)) is null;

  if missing_items is not null then
    raise exception 'missing foundation tables: %', missing_items;
  end if;

  select array_agg(class.relname order by class.relname)
    into missing_items
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any(expected_tables)
    and not class.relrowsecurity;

  if missing_items is not null then
    raise exception 'RLS is disabled on: %', missing_items;
  end if;

  select array_agg(table_name order by table_name)
    into missing_items
  from unnest(owner_tables) as expected(table_name)
  where not exists (
    select 1
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = expected.table_name
      and column_info.column_name = 'owner_id'
  );

  if missing_items is not null then
    raise exception 'owner_id is missing from: %', missing_items;
  end if;

  select array_agg(table_name order by table_name)
    into missing_items
  from unnest(owner_required_tables) as expected(table_name)
  where not exists (
    select 1
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = expected.table_name
      and column_info.column_name = 'owner_id'
      and column_info.is_nullable = 'NO'
  );

  if missing_items is not null then
    raise exception 'owner_id must be NOT NULL on: %', missing_items;
  end if;

  select array_agg(table_name order by table_name)
    into missing_items
  from unnest(owner_tables) as expected(table_name)
  where not exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_class as class on class.oid = trigger.tgrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = expected.table_name
      and trigger.tgname = 'protect_' || expected.table_name || '_owner'
      and not trigger.tgisinternal
  );

  if missing_items is not null then
    raise exception 'owner immutability triggers are missing from: %', missing_items;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any(expected_tables)
      and roles::text[] && array['anon', 'public']::text[]
  ) then
    raise exception 'a foundation policy grants access to anon or public';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any(expected_tables)
      and roles::text[] && array['authenticated']::text[]
      and position('auth.uid' in coalesce(qual, '') || coalesce(with_check, '')) = 0
  ) then
    raise exception 'an authenticated policy is not scoped through auth.uid()';
  end if;

  select array_agg(table_name order by table_name)
    into missing_items
  from unnest(owner_readable_tables) as expected(table_name)
  where not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and pg_catalog.pg_policies.tablename = expected.table_name
      and cmd in ('SELECT', 'ALL')
      and roles::text[] && array['authenticated']::text[]
  );

  if missing_items is not null then
    raise exception 'owner-readable tables lack authenticated SELECT policies: %', missing_items;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and cmd = 'SELECT' and position('auth.uid' in coalesce(qual, '')) > 0
  ) then
    raise exception 'profiles lacks an owner-scoped SELECT policy';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = any(private_tables)
  ) then
    raise exception 'service-only Telegram tables must be deny-by-default with no policies';
  end if;

  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = any(private_tables)
      and grantee in ('anon', 'authenticated', 'PUBLIC')
  ) then
    raise exception 'service-only Telegram tables expose browser grants';
  end if;

  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = any(expected_tables)
      and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'a foundation table exposes anon/public grants';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = 'calendar_items'
      and class.relkind = 'v'
      and class.reloptions @> array['security_invoker=true']::text[]
  ) then
    raise exception 'calendar_items must be a security-invoker view';
  end if;

  if has_table_privilege('anon', 'public.calendar_items', 'SELECT') then
    raise exception 'anon must not be able to SELECT calendar_items';
  end if;

  if not has_table_privilege('authenticated', 'public.calendar_items', 'SELECT') then
    raise exception 'authenticated users need SELECT on calendar_items';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_class as class on class.oid = trigger.tgrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'auth'
      and class.relname = 'users'
      and trigger.tgname = 'on_auth_user_created'
      and not trigger.tgisinternal
  ) then
    raise exception 'auth.users profile bootstrap trigger is missing';
  end if;

  select array_agg(table_name order by table_name)
    into missing_items
  from unnest(mutable_tables) as expected(table_name)
  where not exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_class as class on class.oid = trigger.tgrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = expected.table_name
      and trigger.tgname = 'set_' || expected.table_name || '_updated_at'
      and not trigger.tgisinternal
  );

  if missing_items is not null then
    raise exception 'updated_at triggers are missing from: %', missing_items;
  end if;

  select array_agg(constraint_name order by constraint_name)
    into missing_items
  from unnest(ownership_constraints) as expected(constraint_name)
  where not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_info
    join pg_catalog.pg_class as relation on relation.oid = constraint_info.conrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where constraint_info.conname = expected.constraint_name
      and constraint_info.contype = 'f'
      and namespace.nspname = 'public'
  );

  if missing_items is not null then
    raise exception 'ownership-preserving foreign keys are missing: %', missing_items;
  end if;

  select array_agg(index_name order by index_name)
    into missing_items
  from unnest(required_indexes) as expected(index_name)
  where to_regclass(format('public.%I', expected.index_name)) is null;

  if missing_items is not null then
    raise exception 'required query indexes are missing: %', missing_items;
  end if;

  select array_agg(enum_value.enumlabel order by enum_value.enumsortorder)
    into enum_values
  from pg_catalog.pg_enum as enum_value
  join pg_catalog.pg_type as enum_type on enum_type.oid = enum_value.enumtypid
  join pg_catalog.pg_namespace as namespace on namespace.oid = enum_type.typnamespace
  where namespace.nspname = 'public' and enum_type.typname = 'mission_status';

  if enum_values is distinct from array[
    'unscheduled', 'planned', 'in_progress', 'completed', 'partially_completed',
    'postponed', 'not_completed', 'cancelled'
  ]::text[] then
    raise exception 'mission_status enum differs from the domain contract: %', enum_values;
  end if;

  select array_agg(enum_value.enumlabel order by enum_value.enumsortorder)
    into enum_values
  from pg_catalog.pg_enum as enum_value
  join pg_catalog.pg_type as enum_type on enum_type.oid = enum_value.enumtypid
  join pg_catalog.pg_namespace as namespace on namespace.oid = enum_type.typnamespace
  where namespace.nspname = 'public' and enum_type.typname = 'scheduling_mode';

  if enum_values is distinct from array[
    'fixed_time', 'selected_date', 'selected_weekdays', 'selected_dates',
    'flexible_before_deadline', 'flexible_date_range'
  ]::text[] then
    raise exception 'scheduling_mode enum differs from the domain contract: %', enum_values;
  end if;

  select array_agg(enum_value.enumlabel order by enum_value.enumsortorder)
    into enum_values
  from pg_catalog.pg_enum as enum_value
  join pg_catalog.pg_type as enum_type on enum_type.oid = enum_value.enumtypid
  join pg_catalog.pg_namespace as namespace on namespace.oid = enum_type.typnamespace
  where namespace.nspname = 'public' and enum_type.typname = 'recurrence_frequency';

  if enum_values is distinct from array[
    'daily', 'workdays', 'weekly', 'monthly', 'custom'
  ]::text[] then
    raise exception 'recurrence_frequency enum differs from the domain contract: %', enum_values;
  end if;

  select array_agg(enum_value.enumlabel order by enum_value.enumsortorder)
    into enum_values
  from pg_catalog.pg_enum as enum_value
  join pg_catalog.pg_type as enum_type on enum_type.oid = enum_value.enumtypid
  join pg_catalog.pg_namespace as namespace on namespace.oid = enum_type.typnamespace
  where namespace.nspname = 'public' and enum_type.typname = 'notification_provider';

  if enum_values is distinct from array['telegram', 'email', 'sms', 'whatsapp']::text[] then
    raise exception 'notification_provider enum differs from the domain contract: %', enum_values;
  end if;

  select array_agg(enum_value.enumlabel order by enum_value.enumsortorder)
    into enum_values
  from pg_catalog.pg_enum as enum_value
  join pg_catalog.pg_type as enum_type on enum_type.oid = enum_value.enumtypid
  join pg_catalog.pg_namespace as namespace on namespace.oid = enum_type.typnamespace
  where namespace.nspname = 'public' and enum_type.typname = 'notification_outbox_status';

  if enum_values is distinct from array[
    'pending', 'processing', 'sent', 'failed', 'cancelled'
  ]::text[] then
    raise exception 'notification_outbox_status enum differs from the domain contract: %', enum_values;
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'work-week-exports' and not public
  ) then
    raise exception 'private work-week-exports bucket is missing or public';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and roles::text[] && array['anon', 'authenticated', 'public']::text[]
  ) then
    raise exception 'storage.objects has a browser policy; export storage must remain service-only in Phase 1';
  end if;

  raise notice 'database foundation verification passed';
end $$;

select pass('foundation schema, ownership invariants, grants, and RLS structure are valid');

-- Synthetic, transaction-scoped users exercise actual RLS behavior. The auth
-- rows trigger the same profile/preferences bootstrap used in production.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000101',
    'authenticated',
    'authenticated',
    'foundation-rls-one@example.test',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000102',
    'authenticated',
    'authenticated',
    'foundation-rls-two@example.test',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

insert into public.missions (
  id, owner_id, title, status, scheduling_mode,
  estimated_duration_minutes, selected_date
) values
  (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000101',
    'Owner one mission',
    'planned',
    'selected_date',
    60,
    '2099-01-06'
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000102',
    'Owner two mission',
    'planned',
    'selected_date',
    60,
    '2099-01-06'
  );

insert into public.mission_occurrences (
  id, owner_id, mission_id, recurrence_key, occurrence_date, status
) values
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000201',
    'single',
    '2099-01-06',
    'planned'
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000202',
    'single',
    '2099-01-06',
    'planned'
  );

insert into public.mission_sessions (
  id, owner_id, occurrence_id, starts_at, ends_at, status
) values
  (
    '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000301',
    '2099-01-06 08:00:00+00',
    '2099-01-06 09:00:00+00',
    'planned'
  ),
  (
    '00000000-0000-4000-8000-000000000402',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000302',
    '2099-01-06 08:00:00+00',
    '2099-01-06 09:00:00+00',
    'planned'
  );

insert into public.weekly_work_schedules (id, owner_id, name, effective_from)
values (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000101',
  'RLS test schedule',
  '2099-01-01'
);

insert into public.work_schedule_periods (
  id, owner_id, schedule_id, weekday, period_kind, starts_at, ends_at
) values (
  '00000000-0000-4000-8000-000000000502',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000501',
  0,
  'work',
  '08:00',
  '12:00'
);

update public.mission_occurrences
set reschedule_count = 2
where id = '00000000-0000-4000-8000-000000000301';

insert into public.mission_completion_records (
  id, owner_id, mission_id, occurrence_id, completion_status,
  completion_percentage, source_channel
) values (
  '00000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000301',
  'completed',
  100,
  'system'
);

select is(
  (
    select reschedule_count_at_completion
    from public.mission_completion_records
    where id = '00000000-0000-4000-8000-000000000601'
  ),
  2,
  'completion records snapshot the occurrence reschedule count'
);

update public.mission_completion_records
set reschedule_count_at_completion = 99
where id = '00000000-0000-4000-8000-000000000601';

select is(
  (
    select reschedule_count_at_completion
    from public.mission_completion_records
    where id = '00000000-0000-4000-8000-000000000601'
  ),
  2,
  'completion reschedule snapshots remain immutable'
);

select throws_ok(
  $$
    update public.mission_completion_records
    set mission_id = '00000000-0000-4000-8000-000000000202',
        occurrence_id = '00000000-0000-4000-8000-000000000302'
    where id = '00000000-0000-4000-8000-000000000601'
  $$,
  '23514',
  null,
  'completion mission and occurrence identity remain immutable'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

select is(
  (select count(*) from public.missions),
  1::bigint,
  'an authenticated user sees only their own missions'
);

select is(
  (select count(*) from public.calendar_items),
  1::bigint,
  'the security-invoker calendar view preserves cross-owner isolation'
);

select lives_ok(
  $$
    insert into public.missions (
      owner_id, title, scheduling_mode, estimated_duration_minutes, selected_date
    ) values (
      '00000000-0000-4000-8000-000000000101',
      'Allowed owner insert',
      'selected_date',
      30,
      '2099-01-07'
    )
  $$,
  'an authenticated user can insert their own mission'
);

select lives_ok(
  $$
    insert into public.missions (
      owner_id, title, scheduling_mode, estimated_duration_minutes, selected_date,
      is_splittable, minimum_session_minutes, maximum_session_minutes, maximum_sessions
    ) values (
      '00000000-0000-4000-8000-000000000101',
      'Valid split policy',
      'selected_date',
      240,
      '2099-01-08',
      true,
      60,
      90,
      4
    )
  $$,
  'a feasible mission split policy is accepted'
);

select throws_ok(
  $$
    insert into public.missions (
      owner_id, title, scheduling_mode, estimated_duration_minutes, selected_date,
      is_splittable, minimum_session_minutes, maximum_session_minutes, maximum_sessions
    ) values (
      '00000000-0000-4000-8000-000000000101',
      'Impossible split policy',
      'selected_date',
      240,
      '2099-01-09',
      true,
      60,
      90,
      2
    )
  $$,
  '23514',
  null,
  'an impossible mission split policy is rejected'
);

select throws_ok(
  $$
    update public.missions
    set status = 'completed'
    where id = '00000000-0000-4000-8000-000000000201'
  $$,
  '42501',
  null,
  'browser roles cannot bypass the trusted completion service'
);

select throws_ok(
  $$
    insert into public.missions (
      owner_id, title, scheduling_mode, estimated_duration_minutes,
      selected_date, source_channel
    ) values (
      '00000000-0000-4000-8000-000000000101',
      'Spoofed provenance',
      'selected_date',
      30,
      '2099-01-10',
      'system'
    )
  $$,
  '42501',
  null,
  'browser roles cannot forge trusted mission provenance'
);

select throws_ok(
  $$
    insert into public.missions (
      owner_id, title, scheduling_mode, estimated_duration_minutes, selected_date
    ) values (
      '00000000-0000-4000-8000-000000000102',
      'Rejected cross-owner insert',
      'selected_date',
      30,
      '2099-01-07'
    )
  $$,
  '42501',
  null,
  'an authenticated user cannot insert a mission for another owner'
);

select throws_ok(
  $$
    insert into public.work_schedule_periods (
      owner_id, schedule_id, weekday, period_kind, starts_at, ends_at
    ) values (
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000501',
      0,
      'work',
      '09:00',
      '11:00'
    )
  $$,
  '23P01',
  null,
  'overlapping same-kind schedule periods are rejected'
);

select is(
  (
    with changed as (
      update public.missions
      set title = 'Attempted cross-owner update'
      where id = '00000000-0000-4000-8000-000000000202'
      returning id
    )
    select count(*) from changed
  ),
  0::bigint,
  'cross-owner updates affect no rows'
);

select throws_ok(
  $$
    delete from public.missions
    where id = '00000000-0000-4000-8000-000000000201'
  $$,
  '42501',
  null,
  'browser roles cannot physically delete mission history roots'
);

select throws_ok(
  'select count(*) from public.telegram_link_tokens',
  '42501',
  null,
  'authenticated browser roles cannot read service-only token hashes'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claims;
set local role anon;

select throws_ok(
  'select count(*) from public.missions',
  '42501',
  null,
  'anonymous users cannot read mission data'
);

reset role;
select * from finish();

rollback;
