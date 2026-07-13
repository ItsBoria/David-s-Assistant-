-- Phase 1 database foundation for the personal work-week assistant.
-- Timestamps are timestamptz (UTC on the wire); the user's IANA timezone lives
-- on profiles. Weekdays use PostgreSQL extract(dow) numbering: 0=Sunday.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

do $$
begin
  create type public.language_code as enum ('en', 'he');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.mission_priority as enum ('urgent', 'high', 'medium', 'low');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.mission_status as enum (
    'unscheduled', 'planned', 'in_progress', 'completed',
    'partially_completed', 'postponed', 'not_completed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.scheduling_mode as enum (
    'fixed_time', 'selected_date', 'selected_weekdays', 'selected_dates',
    'flexible_before_deadline', 'flexible_date_range'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.schedule_period_kind as enum ('work', 'break');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.date_override_kind as enum ('custom_hours', 'day_off');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.recurrence_frequency as enum ('daily', 'workdays', 'weekly', 'monthly', 'custom');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.recurrence_interval_unit as enum ('days', 'weeks', 'months');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.source_channel as enum ('web', 'telegram', 'system', 'api');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_provider as enum ('telegram', 'email', 'sms', 'whatsapp');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.provider_connection_status as enum ('disconnected', 'pending', 'active', 'error', 'revoked');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.reminder_status as enum ('pending', 'processing', 'sent', 'failed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_outbox_status as enum ('pending', 'processing', 'sent', 'failed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_attempt_result as enum ('sent', 'retryable_failure', 'permanent_failure');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.contact_consent_status as enum ('unknown', 'pending', 'opted_in', 'opted_out');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.participant_role as enum ('organizer', 'required', 'optional');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.participant_status as enum (
    'pending', 'accepted', 'declined', 'reschedule_requested', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.unavailable_kind as enum ('break', 'travel', 'personal', 'unavailable');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.export_format as enum ('pdf', 'docx');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.export_status as enum ('pending', 'processing', 'ready', 'failed', 'expired');
exception when duplicate_object then null;
end $$;

create or replace function public.is_valid_weekdays(candidate_days smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(candidate_days) between 1 and 7
    and candidate_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    and cardinality(candidate_days) = (
      select count(distinct day_value)
      from unnest(candidate_days) as day_value
    );
$$;

create or replace function public.is_valid_dates(candidate_dates date[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(candidate_dates) > 0
    and not exists (
      select 1 from unnest(candidate_dates) as date_value where date_value is null
    )
    and cardinality(candidate_dates) = (
      select count(distinct date_value)
      from unnest(candidate_dates) as date_value
    );
$$;

create or replace function public.has_valid_mission_split_policy(
  estimated_minutes integer,
  splittable boolean,
  minimum_minutes integer,
  maximum_minutes integer,
  maximum_session_count integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when estimated_minutes is null or estimated_minutes <= 0 or splittable is null then false
    when not splittable then
      minimum_minutes is null
      and maximum_minutes is null
      and maximum_session_count is null
    when minimum_minutes is null
      or minimum_minutes <= 0
      or minimum_minutes > estimated_minutes then false
    when maximum_minutes is not null
      and (
        maximum_minutes < minimum_minutes
        or maximum_minutes > estimated_minutes
      ) then false
    when maximum_session_count is not null and maximum_session_count < 2 then false
    else
      (
        estimated_minutes + coalesce(maximum_minutes, estimated_minutes) - 1
      ) / coalesce(maximum_minutes, estimated_minutes)
      <= least(
        estimated_minutes / minimum_minutes,
        coalesce(maximum_session_count, estimated_minutes / minimum_minutes)
      )
  end;
$$;

create or replace function public.is_valid_mission_status_transition(
  current_status public.mission_status,
  next_status public.mission_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select current_status = next_status
    or next_status = any(
      case current_status
        when 'unscheduled' then array[
          'planned', 'in_progress', 'completed', 'partially_completed',
          'postponed', 'not_completed', 'cancelled'
        ]::public.mission_status[]
        when 'planned' then array[
          'unscheduled', 'in_progress', 'completed', 'partially_completed',
          'postponed', 'not_completed', 'cancelled'
        ]::public.mission_status[]
        when 'in_progress' then array[
          'planned', 'completed', 'partially_completed', 'postponed',
          'not_completed', 'cancelled'
        ]::public.mission_status[]
        when 'partially_completed' then array[
          'planned', 'in_progress', 'completed', 'postponed',
          'not_completed', 'cancelled'
        ]::public.mission_status[]
        when 'postponed' then array[
          'unscheduled', 'planned', 'not_completed', 'cancelled'
        ]::public.mission_status[]
        when 'not_completed' then array[
          'unscheduled', 'planned', 'cancelled'
        ]::public.mission_status[]
        else array[]::public.mission_status[]
      end
    );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Jerusalem',
  language public.language_code not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    display_name is null or char_length(btrim(display_name)) between 1 and 120
  ),
  constraint profiles_timezone_length check (char_length(timezone) between 1 and 100)
);

comment on table public.profiles is
  'Public application profile keyed one-to-one to auth.users; id is the ownership identifier.';

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  week_start smallint not null default 0,
  work_week_days smallint[] not null default array[0, 1, 2, 3, 4]::smallint[],
  default_buffer_before_minutes integer not null default 0,
  default_buffer_after_minutes integer not null default 0,
  maximum_daily_work_minutes integer not null default 540,
  allow_mission_splitting boolean not null default true,
  minimum_session_minutes integer not null default 30,
  automatic_rescheduling boolean not null default true,
  preserve_manual_positions boolean not null default true,
  maximum_reschedules integer not null default 3,
  morning_summary_time time not null default '07:30',
  default_reminder_minutes_before integer not null default 15,
  export_language public.language_code not null default 'en',
  export_orientation text not null default 'landscape',
  export_include_meetings boolean not null default true,
  export_include_notes boolean not null default true,
  export_include_incomplete boolean not null default true,
  organization_name text,
  primary_signature_label text,
  secondary_signature_label text,
  logo_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_week_start check (week_start between 0 and 6),
  constraint user_preferences_work_week_days check (public.is_valid_weekdays(work_week_days)),
  constraint user_preferences_buffers check (
    default_buffer_before_minutes between 0 and 1440
    and default_buffer_after_minutes between 0 and 1440
  ),
  constraint user_preferences_daily_limit check (maximum_daily_work_minutes between 1 and 1440),
  constraint user_preferences_minimum_session check (minimum_session_minutes between 1 and 1440),
  constraint user_preferences_maximum_reschedules check (maximum_reschedules between 0 and 100),
  constraint user_preferences_default_reminder check (default_reminder_minutes_before between 0 and 10080),
  constraint user_preferences_export_orientation check (export_orientation in ('portrait', 'landscape'))
);

create table public.weekly_work_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Default schedule',
  effective_from date not null default current_date,
  effective_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_work_schedules_id_owner_unique unique (id, owner_id),
  constraint weekly_work_schedules_name check (char_length(btrim(name)) between 1 and 100),
  constraint weekly_work_schedules_date_order check (
    effective_until is null or effective_until >= effective_from
  )
);

create unique index weekly_work_schedules_one_active_per_owner_idx
  on public.weekly_work_schedules(owner_id)
  where is_active;

create index weekly_work_schedules_owner_effective_idx
  on public.weekly_work_schedules(owner_id, effective_from, effective_until);

create table public.work_schedule_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  schedule_id uuid not null,
  weekday smallint not null,
  period_kind public.schedule_period_kind not null default 'work',
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_schedule_periods_id_owner_unique unique (id, owner_id),
  constraint work_schedule_periods_schedule_owner_fk
    foreign key (schedule_id, owner_id)
    references public.weekly_work_schedules(id, owner_id) on delete cascade,
  constraint work_schedule_periods_weekday check (weekday between 0 and 6),
  constraint work_schedule_periods_time_order check (ends_at > starts_at),
  constraint work_schedule_periods_exact_unique
    unique (schedule_id, weekday, period_kind, starts_at, ends_at)
);

create index work_schedule_periods_owner_weekday_idx
  on public.work_schedule_periods(owner_id, weekday, starts_at);

create table public.date_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  override_date date not null,
  override_kind public.date_override_kind not null default 'custom_hours',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint date_schedule_overrides_id_owner_unique unique (id, owner_id),
  constraint date_schedule_overrides_owner_date_unique unique (owner_id, override_date),
  constraint date_schedule_overrides_reason_length check (reason is null or char_length(reason) <= 500)
);

create table public.date_schedule_override_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  override_id uuid not null,
  period_kind public.schedule_period_kind not null default 'work',
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint date_schedule_override_periods_id_owner_unique unique (id, owner_id),
  constraint date_schedule_override_periods_override_owner_fk
    foreign key (override_id, owner_id)
    references public.date_schedule_overrides(id, owner_id) on delete cascade,
  constraint date_schedule_override_periods_time_order check (ends_at > starts_at),
  constraint date_schedule_override_periods_exact_unique
    unique (override_id, period_kind, starts_at, ends_at)
);

create index date_schedule_override_periods_owner_idx
  on public.date_schedule_override_periods(owner_id, override_id, starts_at);

create table public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  frequency public.recurrence_frequency not null,
  interval_count integer not null default 1,
  interval_unit public.recurrence_interval_unit,
  by_weekdays smallint[],
  day_of_month smallint,
  starts_on date not null,
  ends_on date,
  maximum_occurrences integer,
  timezone text not null,
  generation_cursor_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurrence_rules_id_owner_unique unique (id, owner_id),
  constraint recurrence_rules_interval check (interval_count between 1 and 365),
  constraint recurrence_rules_weekdays check (
    by_weekdays is null or public.is_valid_weekdays(by_weekdays)
  ),
  constraint recurrence_rules_day_of_month check (day_of_month is null or day_of_month between 1 and 31),
  constraint recurrence_rules_date_order check (ends_on is null or ends_on >= starts_on),
  constraint recurrence_rules_maximum_occurrences check (
    maximum_occurrences is null or maximum_occurrences > 0
  ),
  constraint recurrence_rules_end_condition check (
    ends_on is null or maximum_occurrences is null
  ),
  constraint recurrence_rules_monthly_shape check (
    (frequency = 'monthly' and day_of_month is not null)
    or (frequency <> 'monthly' and day_of_month is null)
  ),
  constraint recurrence_rules_weekly_shape check (
    (frequency = 'weekly' and by_weekdays is not null)
    or (frequency = 'custom')
    or (frequency not in ('weekly', 'custom') and by_weekdays is null)
  ),
  constraint recurrence_rules_custom_shape check (
    (frequency = 'custom' and interval_unit is not null)
    or (frequency <> 'custom' and interval_unit is null)
  ),
  constraint recurrence_rules_workdays_interval check (
    frequency <> 'workdays' or interval_count = 1
  ),
  constraint recurrence_rules_timezone_length check (char_length(timezone) between 1 and 100)
);

create index recurrence_rules_generation_idx
  on public.recurrence_rules(owner_id, is_active, generation_cursor_date, starts_on)
  where is_active;

create table public.unavailable_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  kind public.unavailable_kind not null default 'unavailable',
  is_active boolean not null default true,
  source_channel public.source_channel not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unavailable_periods_id_owner_unique unique (id, owner_id),
  constraint unavailable_periods_time_order check (ends_at > starts_at),
  constraint unavailable_periods_reason_length check (reason is null or char_length(reason) <= 500)
);

create index unavailable_periods_owner_range_idx
  on public.unavailable_periods(owner_id, starts_at, ends_at)
  where is_active;

create index unavailable_periods_owner_range_gist_idx
  on public.unavailable_periods using gist (owner_id, tstzrange(starts_at, ends_at, '[)'))
  where is_active;

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  recurrence_rule_id uuid,
  title text not null,
  description text,
  priority public.mission_priority not null default 'medium',
  status public.mission_status not null default 'unscheduled',
  scheduling_mode public.scheduling_mode not null default 'flexible_before_deadline',
  estimated_duration_minutes integer not null,
  earliest_start_date date,
  latest_date date,
  deadline timestamptz,
  fixed_start_at timestamptz,
  fixed_end_at timestamptz,
  selected_date date,
  allowed_weekdays smallint[],
  allowed_dates date[],
  is_locked boolean not null default false,
  is_splittable boolean not null default false,
  minimum_session_minutes integer,
  maximum_session_minutes integer,
  maximum_sessions integer,
  category text,
  notes text,
  source_channel public.source_channel not null default 'web',
  postponed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missions_id_owner_unique unique (id, owner_id),
  constraint missions_recurrence_owner_fk
    foreign key (recurrence_rule_id, owner_id)
    references public.recurrence_rules(id, owner_id) on delete restrict,
  constraint missions_title_length check (char_length(btrim(title)) between 1 and 240),
  constraint missions_estimated_duration check (estimated_duration_minutes between 1 and 10080),
  constraint missions_date_order check (
    latest_date is null or earliest_start_date is null or latest_date >= earliest_start_date
  ),
  constraint missions_fixed_time_pair check (
    (fixed_start_at is null and fixed_end_at is null)
    or (fixed_start_at is not null and fixed_end_at is not null and fixed_end_at > fixed_start_at)
  ),
  constraint missions_allowed_weekdays check (
    allowed_weekdays is null or public.is_valid_weekdays(allowed_weekdays)
  ),
  constraint missions_allowed_dates check (
    allowed_dates is null or public.is_valid_dates(allowed_dates)
  ),
  constraint missions_minimum_session check (
    minimum_session_minutes is null
    or minimum_session_minutes between 1 and estimated_duration_minutes
  ),
  constraint missions_maximum_session check (
    maximum_session_minutes is null
    or (
      minimum_session_minutes is not null
      and maximum_session_minutes between minimum_session_minutes and estimated_duration_minutes
    )
  ),
  constraint missions_maximum_sessions check (maximum_sessions is null or maximum_sessions >= 2),
  constraint missions_split_shape check (
    public.has_valid_mission_split_policy(
      estimated_duration_minutes,
      is_splittable,
      minimum_session_minutes,
      maximum_session_minutes,
      maximum_sessions
    )
  ),
  constraint missions_postponed_count check (postponed_count >= 0),
  constraint missions_scheduling_mode_shape check (
    case scheduling_mode
      when 'fixed_time' then
        fixed_start_at is not null and fixed_end_at is not null
        and selected_date is null and allowed_weekdays is null and allowed_dates is null
        and earliest_start_date is null and latest_date is null and deadline is null
      when 'selected_date' then
        selected_date is not null
        and fixed_start_at is null and fixed_end_at is null
        and allowed_weekdays is null and allowed_dates is null
        and earliest_start_date is null and latest_date is null and deadline is null
      when 'selected_weekdays' then
        allowed_weekdays is not null
        and fixed_start_at is null and fixed_end_at is null
        and selected_date is null and allowed_dates is null
      when 'selected_dates' then
        allowed_dates is not null
        and fixed_start_at is null and fixed_end_at is null
        and selected_date is null and allowed_weekdays is null
        and earliest_start_date is null and latest_date is null
      when 'flexible_before_deadline' then
        deadline is not null
        and fixed_start_at is null and fixed_end_at is null
        and selected_date is null and allowed_weekdays is null and allowed_dates is null
        and latest_date is null
      when 'flexible_date_range' then
        earliest_start_date is not null and latest_date is not null
        and fixed_start_at is null and fixed_end_at is null
        and selected_date is null and allowed_weekdays is null and allowed_dates is null
      else false
    end
  )
);

create index missions_owner_status_idx on public.missions(owner_id, status, updated_at desc);
create index missions_owner_deadline_idx
  on public.missions(owner_id, deadline)
  where deadline is not null and status not in ('completed', 'cancelled');
create index missions_owner_mode_idx on public.missions(owner_id, scheduling_mode);
create index missions_recurrence_idx
  on public.missions(recurrence_rule_id)
  where recurrence_rule_id is not null;
create index missions_allowed_weekdays_gin_idx
  on public.missions using gin (allowed_weekdays)
  where allowed_weekdays is not null;
create index missions_allowed_dates_gin_idx
  on public.missions using gin (allowed_dates)
  where allowed_dates is not null;

create table public.mission_occurrences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  mission_id uuid not null,
  recurrence_key text not null,
  occurrence_date date not null,
  sequence_number integer,
  status public.mission_status not null default 'unscheduled',
  is_locked boolean not null default false,
  reschedule_count integer not null default 0,
  duration_override_minutes integer,
  notes text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_occurrences_id_owner_unique unique (id, owner_id),
  constraint mission_occurrences_identity_unique unique (id, mission_id, owner_id),
  constraint mission_occurrences_mission_owner_fk
    foreign key (mission_id, owner_id)
    references public.missions(id, owner_id) on delete cascade,
  constraint mission_occurrences_recurrence_key_length check (char_length(recurrence_key) between 1 and 200),
  constraint mission_occurrences_recurrence_key_unique unique (mission_id, recurrence_key),
  constraint mission_occurrences_date_unique unique (mission_id, occurrence_date),
  constraint mission_occurrences_sequence check (sequence_number is null or sequence_number > 0),
  constraint mission_occurrences_reschedule_count check (reschedule_count >= 0),
  constraint mission_occurrences_duration_override check (
    duration_override_minutes is null or duration_override_minutes between 1 and 10080
  )
);

create index mission_occurrences_owner_date_idx
  on public.mission_occurrences(owner_id, occurrence_date, status);
create index mission_occurrences_generation_idx
  on public.mission_occurrences(mission_id, recurrence_key);

create table public.mission_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  occurrence_id uuid not null,
  session_index integer not null default 1,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.mission_status not null default 'planned',
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_sessions_id_owner_unique unique (id, owner_id),
  constraint mission_sessions_occurrence_owner_fk
    foreign key (occurrence_id, owner_id)
    references public.mission_occurrences(id, owner_id) on delete cascade,
  constraint mission_sessions_index check (session_index > 0),
  constraint mission_sessions_occurrence_index_unique unique (occurrence_id, session_index),
  constraint mission_sessions_time_order check (ends_at > starts_at),
  constraint mission_sessions_requires_scheduled_status check (status <> 'unscheduled')
);

create index mission_sessions_owner_range_idx
  on public.mission_sessions(owner_id, starts_at, ends_at);
create index mission_sessions_owner_range_gist_idx
  on public.mission_sessions using gist (owner_id, tstzrange(starts_at, ends_at, '[)'))
  where status not in ('cancelled', 'postponed');

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  recurrence_rule_id uuid,
  series_instance_key text,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_all_day boolean not null default false,
  is_cancelled boolean not null default false,
  location text,
  meeting_url text,
  organizer_contact_id uuid,
  notes text,
  source_channel public.source_channel not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_id_owner_unique unique (id, owner_id),
  constraint meetings_recurrence_owner_fk
    foreign key (recurrence_rule_id, owner_id)
    references public.recurrence_rules(id, owner_id) on delete restrict,
  constraint meetings_title_length check (char_length(btrim(title)) between 1 and 240),
  constraint meetings_time_order check (ends_at > starts_at),
  constraint meetings_series_shape check (
    (recurrence_rule_id is null and series_instance_key is null)
    or (recurrence_rule_id is not null and series_instance_key is not null)
  )
);

create unique index meetings_series_instance_unique_idx
  on public.meetings(recurrence_rule_id, series_instance_key)
  where recurrence_rule_id is not null;
create index meetings_owner_start_idx
  on public.meetings(owner_id, starts_at, ends_at)
  where not is_cancelled;
create index meetings_owner_range_gist_idx
  on public.meetings using gist (owner_id, tstzrange(starts_at, ends_at, '[)'))
  where not is_cancelled;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  phone_number text,
  email text,
  preferred_provider public.notification_provider,
  consent_status public.contact_consent_status not null default 'unknown',
  consent_recorded_at timestamptz,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_id_owner_unique unique (id, owner_id),
  constraint contacts_name_length check (char_length(btrim(full_name)) between 1 and 200),
  constraint contacts_consent_timestamp check (
    consent_status in ('unknown', 'pending') or consent_recorded_at is not null
  )
);

create index contacts_owner_name_idx on public.contacts(owner_id, lower(full_name));
create unique index contacts_owner_email_unique_idx
  on public.contacts(owner_id, lower(email))
  where email is not null;

alter table public.meetings
  add constraint meetings_organizer_contact_owner_fk
  foreign key (organizer_contact_id, owner_id)
  references public.contacts(id, owner_id) on delete set null (organizer_contact_id);

create table public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  meeting_id uuid not null,
  contact_id uuid,
  display_name text,
  email text,
  role public.participant_role not null default 'required',
  status public.participant_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_participants_id_owner_unique unique (id, owner_id),
  constraint meeting_participants_meeting_owner_fk
    foreign key (meeting_id, owner_id)
    references public.meetings(id, owner_id) on delete cascade,
  constraint meeting_participants_contact_owner_fk
    foreign key (contact_id, owner_id)
    references public.contacts(id, owner_id) on delete restrict,
  constraint meeting_participants_identity check (
    contact_id is not null or display_name is not null or email is not null
  )
);

create unique index meeting_participants_contact_unique_idx
  on public.meeting_participants(meeting_id, contact_id)
  where contact_id is not null;
create index meeting_participants_owner_meeting_idx
  on public.meeting_participants(owner_id, meeting_id);

create table public.notification_provider_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider public.notification_provider not null,
  status public.provider_connection_status not null default 'disconnected',
  external_account_label text,
  capabilities jsonb not null default '{}'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_provider_connections_id_owner_unique unique (id, owner_id),
  constraint notification_provider_connections_identity_unique unique (id, owner_id, provider),
  constraint notification_provider_connections_owner_provider_unique unique (owner_id, provider),
  constraint notification_provider_connections_capabilities_object check (jsonb_typeof(capabilities) = 'object'),
  constraint notification_provider_connections_configuration_object check (jsonb_typeof(configuration) = 'object')
);

comment on column public.notification_provider_connections.configuration is
  'Non-secret provider configuration only. API tokens and webhook secrets belong in server-side secrets.';

create table public.telegram_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  provider_connection_id uuid not null,
  provider public.notification_provider not null default 'telegram',
  contact_id uuid,
  connection_kind text not null default 'owner',
  telegram_user_id bigint not null,
  telegram_chat_id bigint not null,
  telegram_username text,
  linked_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint telegram_connections_id_owner_unique unique (id, owner_id),
  constraint telegram_connections_provider_owner_fk
    foreign key (provider_connection_id, owner_id, provider)
    references public.notification_provider_connections(id, owner_id, provider) on delete cascade,
  constraint telegram_connections_contact_owner_fk
    foreign key (contact_id, owner_id)
    references public.contacts(id, owner_id) on delete cascade,
  constraint telegram_connections_kind check (connection_kind in ('owner', 'contact')),
  constraint telegram_connections_provider check (provider = 'telegram'),
  constraint telegram_connections_kind_shape check (
    (connection_kind = 'owner' and contact_id is null)
    or (connection_kind = 'contact' and contact_id is not null)
  ),
  constraint telegram_connections_user_id check (telegram_user_id > 0),
  constraint telegram_connections_owner_telegram_user_unique unique (owner_id, telegram_user_id)
);

create unique index telegram_connections_one_active_owner_idx
  on public.telegram_connections(owner_id)
  where connection_kind = 'owner' and revoked_at is null;
create unique index telegram_connections_one_active_contact_idx
  on public.telegram_connections(contact_id)
  where connection_kind = 'contact' and revoked_at is null;
create unique index telegram_connections_active_owner_user_global_idx
  on public.telegram_connections(telegram_user_id)
  where connection_kind = 'owner' and revoked_at is null;
create unique index telegram_connections_active_owner_chat_global_idx
  on public.telegram_connections(telegram_chat_id)
  where connection_kind = 'owner' and revoked_at is null;

create table public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid,
  token_hash text not null unique,
  scope text not null default 'link_owner_account',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint telegram_link_tokens_id_owner_unique unique (id, owner_id),
  constraint telegram_link_tokens_contact_owner_fk
    foreign key (contact_id, owner_id)
    references public.contacts(id, owner_id) on delete cascade,
  constraint telegram_link_tokens_hash_length check (char_length(token_hash) between 32 and 256),
  constraint telegram_link_tokens_scope check (scope in ('link_owner_account', 'link_contact')),
  constraint telegram_link_tokens_scope_shape check (
    (scope = 'link_owner_account' and contact_id is null)
    or (scope = 'link_contact' and contact_id is not null)
  ),
  constraint telegram_link_tokens_expiry check (expires_at > created_at),
  constraint telegram_link_tokens_short_lived check (expires_at <= created_at + interval '30 minutes'),
  constraint telegram_link_tokens_consumed_time check (
    consumed_at is null or consumed_at between created_at and expires_at
  )
);

create index telegram_link_tokens_active_idx
  on public.telegram_link_tokens(token_hash, expires_at)
  where consumed_at is null;

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider_connection_id uuid,
  entity_type text not null,
  entity_id uuid,
  remind_at timestamptz not null,
  provider public.notification_provider not null default 'telegram',
  status public.reminder_status not null default 'pending',
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_id_owner_unique unique (id, owner_id),
  constraint reminders_identity_unique unique (id, owner_id, provider),
  constraint reminders_provider_owner_fk
    foreign key (provider_connection_id, owner_id, provider)
    references public.notification_provider_connections(id, owner_id, provider)
    on delete set null (provider_connection_id),
  constraint reminders_entity_type check (
    entity_type in ('mission_occurrence', 'mission_session', 'meeting', 'daily_agenda')
  ),
  constraint reminders_entity_shape check (
    (entity_type = 'daily_agenda' and entity_id is null)
    or (entity_type <> 'daily_agenda' and entity_id is not null)
  ),
  constraint reminders_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint reminders_idempotency_key_length check (char_length(idempotency_key) between 1 and 240),
  constraint reminders_owner_idempotency_unique unique (owner_id, idempotency_key)
);

create index reminders_due_idx
  on public.reminders(status, remind_at, owner_id)
  where status = 'pending';
create index reminders_owner_entity_idx
  on public.reminders(owner_id, entity_type, entity_id);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  reminder_id uuid,
  provider_connection_id uuid,
  provider public.notification_provider not null,
  notification_type text not null,
  payload jsonb not null,
  status public.notification_outbox_status not null default 'pending',
  available_at timestamptz not null default now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  attempt_count integer not null default 0,
  maximum_attempts integer not null default 5,
  idempotency_key text not null,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_id_owner_unique unique (id, owner_id),
  constraint notification_outbox_reminder_owner_fk
    foreign key (reminder_id, owner_id, provider)
    references public.reminders(id, owner_id, provider) on delete set null (reminder_id),
  constraint notification_outbox_provider_owner_fk
    foreign key (provider_connection_id, owner_id, provider)
    references public.notification_provider_connections(id, owner_id, provider)
    on delete set null (provider_connection_id),
  constraint notification_outbox_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint notification_outbox_attempt_count check (
    attempt_count >= 0 and maximum_attempts between 1 and 100 and attempt_count <= maximum_attempts
  ),
  constraint notification_outbox_idempotency_length check (char_length(idempotency_key) between 1 and 240),
  constraint notification_outbox_owner_idempotency_unique unique (owner_id, idempotency_key)
);

create index notification_outbox_pending_idx
  on public.notification_outbox(status, available_at, created_at)
  where status = 'pending';
create index notification_outbox_owner_status_idx
  on public.notification_outbox(owner_id, status, created_at desc);

create table public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  outbox_id uuid not null,
  attempt_number integer not null,
  result public.notification_attempt_result not null,
  provider_message_id text,
  response_code text,
  retry_after timestamptz,
  error_code text,
  error_summary text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_attempts_id_owner_unique unique (id, owner_id),
  constraint notification_attempts_outbox_owner_fk
    foreign key (outbox_id, owner_id)
    references public.notification_outbox(id, owner_id) on delete cascade,
  constraint notification_attempts_number check (attempt_number > 0),
  constraint notification_attempts_outbox_number_unique unique (outbox_id, attempt_number),
  constraint notification_attempts_time_order check (finished_at is null or finished_at >= started_at),
  constraint notification_attempts_error_summary_length check (error_summary is null or char_length(error_summary) <= 1000)
);

create index notification_attempts_owner_created_idx
  on public.notification_attempts(owner_id, created_at desc);

create table public.mission_status_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  mission_id uuid not null,
  occurrence_id uuid,
  from_status public.mission_status,
  to_status public.mission_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  source_channel public.source_channel not null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint mission_status_history_id_owner_unique unique (id, owner_id),
  constraint mission_status_history_mission_owner_fk
    foreign key (mission_id, owner_id)
    references public.missions(id, owner_id) on delete restrict,
  constraint mission_status_history_occurrence_identity_fk
    foreign key (occurrence_id, mission_id, owner_id)
    references public.mission_occurrences(id, mission_id, owner_id) on delete restrict,
  constraint mission_status_history_status_change check (from_status is null or from_status <> to_status),
  constraint mission_status_history_details_object check (jsonb_typeof(details) = 'object')
);

create index mission_status_history_owner_mission_idx
  on public.mission_status_history(owner_id, mission_id, created_at desc);

create table public.mission_completion_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  mission_id uuid not null,
  occurrence_id uuid not null,
  completion_status public.mission_status not null,
  completed_at timestamptz not null default now(),
  completed_by uuid references auth.users(id) on delete set null,
  actual_duration_minutes integer,
  completion_percentage smallint,
  notes text,
  original_scheduled_start timestamptz,
  final_scheduled_start timestamptz,
  reschedule_count_at_completion integer not null,
  source_channel public.source_channel not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_completion_records_id_owner_unique unique (id, owner_id),
  constraint mission_completion_records_occurrence_identity_fk
    foreign key (occurrence_id, mission_id, owner_id)
    references public.mission_occurrences(id, mission_id, owner_id) on delete restrict,
  constraint mission_completion_records_occurrence_unique unique (occurrence_id),
  constraint mission_completion_records_status check (
    completion_status in ('completed', 'partially_completed', 'not_completed')
  ),
  constraint mission_completion_records_actual_duration check (
    actual_duration_minutes is null or actual_duration_minutes >= 0
  ),
  constraint mission_completion_records_percentage check (
    completion_percentage is null or completion_percentage between 0 and 100
  ),
  constraint mission_completion_records_reschedule_count check (
    reschedule_count_at_completion >= 0
  ),
  constraint mission_completion_records_completed_shape check (
    completion_status <> 'completed' or completion_percentage is null or completion_percentage = 100
  )
);

create index mission_completion_records_owner_completed_idx
  on public.mission_completion_records(owner_id, completed_at desc);

create or replace function public.protect_completion_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select occurrence.reschedule_count
      into new.reschedule_count_at_completion
    from public.mission_occurrences as occurrence
    where occurrence.id = new.occurrence_id
      and occurrence.mission_id = new.mission_id
      and occurrence.owner_id = new.owner_id;

    if not found then
      raise exception 'completion occurrence identity does not exist'
        using errcode = '23503';
    end if;

    if auth.uid() is not null then
      new.completed_by := auth.uid();
    end if;
  else
    if new.mission_id is distinct from old.mission_id
      or new.occurrence_id is distinct from old.occurrence_id then
      raise exception 'completion record identity is immutable'
        using errcode = '23514';
    end if;

    new.completed_by := old.completed_by;
    new.reschedule_count_at_completion := old.reschedule_count_at_completion;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_completion_actor_trigger on public.mission_completion_records;
create trigger protect_completion_actor_trigger
before insert or update on public.mission_completion_records
for each row execute function public.protect_completion_actor();

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  format public.export_format not null,
  language public.language_code not null,
  orientation text not null default 'landscape',
  status public.export_status not null default 'pending',
  filters jsonb not null default '{}'::jsonb,
  template_version text not null,
  storage_bucket text,
  storage_path text,
  error_code text,
  generated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exports_id_owner_unique unique (id, owner_id),
  constraint exports_orientation check (orientation in ('portrait', 'landscape')),
  constraint exports_filters_object check (jsonb_typeof(filters) = 'object'),
  constraint exports_template_version_length check (char_length(template_version) between 1 and 100),
  constraint exports_storage_pair check (
    (storage_bucket is null and storage_path is null)
    or (storage_bucket is not null and storage_path is not null)
  ),
  constraint exports_private_bucket check (
    storage_bucket is null or storage_bucket = 'work-week-exports'
  ),
  constraint exports_owner_storage_prefix check (
    storage_path is null or storage_path like owner_id::text || '/%'
  ),
  constraint exports_expiry_order check (expires_at is null or expires_at > created_at)
);

create index exports_owner_week_idx on public.exports(owner_id, week_start desc, created_at desc);
create unique index exports_storage_object_unique_idx
  on public.exports(storage_bucket, storage_path)
  where storage_path is not null;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  source_channel public.source_channel not null,
  before_summary jsonb,
  after_summary jsonb,
  correlation_id uuid,
  created_at timestamptz not null default now(),
  constraint audit_log_id_owner_unique unique (id, owner_id),
  constraint audit_log_action_length check (char_length(action) between 1 and 120),
  constraint audit_log_entity_type_length check (char_length(entity_type) between 1 and 120),
  constraint audit_log_before_object check (before_summary is null or jsonb_typeof(before_summary) = 'object'),
  constraint audit_log_after_object check (after_summary is null or jsonb_typeof(after_summary) = 'object')
);

create index audit_log_owner_created_idx on public.audit_log(owner_id, created_at desc);
create index audit_log_owner_entity_idx on public.audit_log(owner_id, entity_type, entity_id, created_at desc);

create table public.telegram_update_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  connection_id uuid,
  telegram_update_id bigint not null unique,
  update_type text not null,
  payload_sha256 text not null,
  processing_status text not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  constraint telegram_update_log_id_owner_unique unique (id, owner_id),
  constraint telegram_update_log_owner_fk foreign key (owner_id)
    references public.profiles(id) on delete cascade,
  constraint telegram_update_log_connection_owner_fk
    foreign key (connection_id, owner_id)
    references public.telegram_connections(id, owner_id) on delete set null (connection_id),
  constraint telegram_update_log_connection_shape check (
    connection_id is null or owner_id is not null
  ),
  constraint telegram_update_log_payload_hash check (char_length(payload_sha256) = 64),
  constraint telegram_update_log_status check (
    processing_status in ('received', 'processing', 'processed', 'ignored', 'failed')
  ),
  constraint telegram_update_log_time_order check (processed_at is null or processed_at >= received_at)
);

create index telegram_update_log_processing_idx
  on public.telegram_update_log(processing_status, received_at)
  where processing_status in ('received', 'processing');
create index telegram_update_log_owner_created_idx
  on public.telegram_update_log(owner_id, created_at desc)
  where owner_id is not null;

-- Ownership is immutable even for trusted jobs. The sole exception is the
-- one-way null -> owner resolution of a newly received Telegram update.
create or replace function public.protect_record_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.owner_id is distinct from new.owner_id then
    if tg_table_name = 'telegram_update_log' and old.owner_id is null and new.owner_id is not null then
      return new;
    end if;
    raise exception 'owner_id is immutable for %', tg_table_name using errcode = '23514';
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_preferences', 'weekly_work_schedules', 'work_schedule_periods',
    'date_schedule_overrides', 'date_schedule_override_periods', 'recurrence_rules',
    'unavailable_periods', 'missions', 'mission_occurrences', 'mission_sessions',
    'meetings', 'contacts', 'meeting_participants', 'notification_provider_connections',
    'telegram_connections', 'telegram_link_tokens', 'reminders', 'notification_outbox',
    'notification_attempts', 'mission_status_history', 'mission_completion_records',
    'exports', 'audit_log', 'telegram_update_log'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'protect_' || table_name || '_owner', table_name);
    execute format(
      'create trigger %I before update of owner_id on public.%I for each row execute function public.protect_record_owner()',
      'protect_' || table_name || '_owner', table_name
    );
  end loop;
end $$;

-- Same-kind work periods and breaks may not overlap. A break may overlap a work
-- interval (that is how it subtracts availability); containment is validated by
-- the scheduling service because work/break rows can be saved in either order.
create or replace function public.ensure_schedule_period_no_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'work_schedule_periods' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      concat_ws(':', 'weekly-period', new.owner_id::text, new.schedule_id::text,
        new.weekday::text, new.period_kind::text),
      0
    ));

    if exists (
      select 1
      from public.work_schedule_periods as period
      where period.owner_id = new.owner_id
        and period.schedule_id = new.schedule_id
        and period.weekday = new.weekday
        and period.period_kind = new.period_kind
        and period.id <> new.id
        and period.starts_at < new.ends_at
        and period.ends_at > new.starts_at
    ) then
      raise exception 'schedule periods of the same kind may not overlap'
        using errcode = '23P01';
    end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      concat_ws(':', 'override-period', new.owner_id::text, new.override_id::text,
        new.period_kind::text),
      0
    ));

    if exists (
      select 1
      from public.date_schedule_override_periods as period
      where period.owner_id = new.owner_id
        and period.override_id = new.override_id
        and period.period_kind = new.period_kind
        and period.id <> new.id
        and period.starts_at < new.ends_at
        and period.ends_at > new.starts_at
    ) then
      raise exception 'override periods of the same kind may not overlap'
        using errcode = '23P01';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_work_schedule_period_no_overlap_trigger on public.work_schedule_periods;
create trigger ensure_work_schedule_period_no_overlap_trigger
before insert or update of owner_id, schedule_id, weekday, period_kind, starts_at, ends_at
on public.work_schedule_periods
for each row execute function public.ensure_schedule_period_no_overlap();

drop trigger if exists ensure_override_period_no_overlap_trigger on public.date_schedule_override_periods;
create trigger ensure_override_period_no_overlap_trigger
before insert or update of owner_id, override_id, period_kind, starts_at, ends_at
on public.date_schedule_override_periods
for each row execute function public.ensure_schedule_period_no_overlap();

-- A day-off override must not carry work/break periods. These triggers protect
-- both insertion order and later conversion of an existing override.
create or replace function public.validate_date_override_period()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1
  from public.date_schedule_overrides as override_row
  where override_row.id = new.override_id
    and override_row.owner_id = new.owner_id
    and override_row.override_kind = 'custom_hours'
  for update;

  if not found then
    raise exception 'override periods require a custom_hours override'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_day_off_override()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.override_kind = 'day_off' and exists (
    select 1
    from public.date_schedule_override_periods as period
    where period.override_id = new.id and period.owner_id = new.owner_id
  ) then
    raise exception 'a day_off override cannot contain periods'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_date_override_period_trigger on public.date_schedule_override_periods;
create trigger validate_date_override_period_trigger
before insert or update on public.date_schedule_override_periods
for each row execute function public.validate_date_override_period();

drop trigger if exists validate_day_off_override_trigger on public.date_schedule_overrides;
create trigger validate_day_off_override_trigger
before insert or update of override_kind on public.date_schedule_overrides
for each row execute function public.validate_day_off_override();

-- Timezones are checked at the database boundary so reminder and recurrence
-- calculations never receive a typo or non-IANA identifier.
create or replace function public.validate_iana_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown IANA timezone: %', new.timezone using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_profiles_timezone_trigger on public.profiles;
create trigger validate_profiles_timezone_trigger
before insert or update of timezone on public.profiles
for each row execute function public.validate_iana_timezone();

drop trigger if exists validate_recurrence_timezone_trigger on public.recurrence_rules;
create trigger validate_recurrence_timezone_trigger
before insert or update of timezone on public.recurrence_rules
for each row execute function public.validate_iana_timezone();

-- Serialize slot writes per owner and reject overlaps across the three blocking
-- calendar domains. The scheduler can reschedule within one transaction before
-- inserting a conflicting meeting or unavailable interval.
create or replace function public.ensure_calendar_slot_available()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  candidate_start timestamptz;
  candidate_end timestamptz;
  candidate_blocks boolean;
begin
  candidate_start := new.starts_at;
  candidate_end := new.ends_at;

  if tg_table_name = 'mission_sessions' then
    candidate_blocks := new.status not in ('cancelled', 'postponed');
  elsif tg_table_name = 'meetings' then
    candidate_blocks := not new.is_cancelled;
  else
    candidate_blocks := new.is_active;
  end if;

  if not candidate_blocks then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text, 0));

  if exists (
    select 1 from public.mission_sessions as session
    where session.owner_id = new.owner_id
      and session.status not in ('cancelled', 'postponed')
      and (tg_table_name <> 'mission_sessions' or session.id <> new.id)
      and tstzrange(session.starts_at, session.ends_at, '[)')
        && tstzrange(candidate_start, candidate_end, '[)')
  ) or exists (
    select 1 from public.meetings as meeting
    where meeting.owner_id = new.owner_id
      and not meeting.is_cancelled
      and (tg_table_name <> 'meetings' or meeting.id <> new.id)
      and tstzrange(meeting.starts_at, meeting.ends_at, '[)')
        && tstzrange(candidate_start, candidate_end, '[)')
  ) or exists (
    select 1 from public.unavailable_periods as unavailable
    where unavailable.owner_id = new.owner_id
      and unavailable.is_active
      and (tg_table_name <> 'unavailable_periods' or unavailable.id <> new.id)
      and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
        && tstzrange(candidate_start, candidate_end, '[)')
  ) then
    raise exception 'calendar interval overlaps an existing blocking item'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_mission_session_available_trigger on public.mission_sessions;
create trigger ensure_mission_session_available_trigger
before insert or update of owner_id, starts_at, ends_at, status on public.mission_sessions
for each row execute function public.ensure_calendar_slot_available();

drop trigger if exists ensure_meeting_available_trigger on public.meetings;
create trigger ensure_meeting_available_trigger
before insert or update of owner_id, starts_at, ends_at, is_cancelled on public.meetings
for each row execute function public.ensure_calendar_slot_available();

drop trigger if exists ensure_unavailable_period_available_trigger on public.unavailable_periods;
create trigger ensure_unavailable_period_available_trigger
before insert or update of owner_id, starts_at, ends_at, is_active on public.unavailable_periods
for each row execute function public.ensure_calendar_slot_available();

-- Status transitions are a database invariant. Browser-authenticated writes
-- cannot forge trusted provenance or terminal completion outcomes; those must
-- go through the planned transactional completion service.
create or replace function public.validate_mission_status_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  status_changed boolean := true;
begin
  if tg_op = 'UPDATE' then
    status_changed := old.status is distinct from new.status;

    if status_changed
      and not public.is_valid_mission_status_transition(old.status, new.status) then
      raise exception 'invalid mission status transition from % to %', old.status, new.status
        using errcode = '23514';
    end if;
  end if;

  if auth.uid() is not null then
    if status_changed
      and new.status in ('completed', 'partially_completed', 'not_completed') then
      raise exception 'terminal completion status requires the trusted completion service'
        using errcode = '42501';
    end if;

    if tg_table_name = 'missions' then
      if tg_op = 'INSERT' and new.source_channel <> 'web' then
        raise exception 'browser mission writes must use web provenance'
          using errcode = '42501';
      elsif tg_op = 'UPDATE'
        and new.source_channel is distinct from old.source_channel then
        raise exception 'browser mission provenance is immutable'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_mission_status_write_trigger on public.missions;
create trigger validate_mission_status_write_trigger
before insert or update on public.missions
for each row execute function public.validate_mission_status_write();

drop trigger if exists validate_occurrence_status_write_trigger on public.mission_occurrences;
create trigger validate_occurrence_status_write_trigger
before insert or update on public.mission_occurrences
for each row execute function public.validate_mission_status_write();

drop trigger if exists validate_session_status_write_trigger on public.mission_sessions;
create trigger validate_session_status_write_trigger
before insert or update on public.mission_sessions
for each row execute function public.validate_mission_status_write();

-- Status history is append-only and generated by the database so clients cannot
-- rewrite their own history. Session transitions point to their parent occurrence.
create or replace function public.record_mission_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  history_mission_id uuid;
  history_occurrence_id uuid;
  history_source public.source_channel;
  history_details jsonb := '{}'::jsonb;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if tg_table_name = 'missions' then
    history_mission_id := new.id;
    history_occurrence_id := null;
    history_source := new.source_channel;
  elsif tg_table_name = 'mission_occurrences' then
    history_mission_id := new.mission_id;
    history_occurrence_id := new.id;
    select mission.source_channel into history_source
    from public.missions as mission where mission.id = new.mission_id;
  else
    select occurrence.mission_id, occurrence.id, mission.source_channel
      into history_mission_id, history_occurrence_id, history_source
    from public.mission_occurrences as occurrence
    join public.missions as mission on mission.id = occurrence.mission_id
    where occurrence.id = new.occurrence_id;
    history_details := jsonb_build_object('session_id', new.id);
  end if;

  insert into public.mission_status_history (
    owner_id, mission_id, occurrence_id, from_status, to_status,
    changed_by, source_channel, details
  ) values (
    new.owner_id, history_mission_id, history_occurrence_id, old.status, new.status,
    auth.uid(), coalesce(history_source, 'system'), history_details
  );

  return new;
end;
$$;

drop trigger if exists record_mission_status_trigger on public.missions;
create trigger record_mission_status_trigger
after update of status on public.missions
for each row execute function public.record_mission_status_change();

drop trigger if exists record_mission_occurrence_status_trigger on public.mission_occurrences;
create trigger record_mission_occurrence_status_trigger
after update of status on public.mission_occurrences
for each row execute function public.record_mission_status_change();

drop trigger if exists record_mission_session_status_trigger on public.mission_sessions;
create trigger record_mission_session_status_trigger
after update of status on public.mission_sessions
for each row execute function public.record_mission_status_change();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'user_preferences', 'weekly_work_schedules', 'work_schedule_periods',
    'date_schedule_overrides', 'date_schedule_override_periods', 'recurrence_rules',
    'unavailable_periods', 'missions', 'mission_occurrences', 'mission_sessions',
    'meetings', 'contacts', 'meeting_participants', 'notification_provider_connections',
    'telegram_connections', 'reminders', 'notification_outbox',
    'mission_completion_records', 'exports'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || table_name || '_updated_at', table_name
    );
  end loop;
end $$;

-- A view is used instead of a writable calendar_items table. Domain rows remain
-- authoritative and cannot drift from a duplicate calendar record.
create or replace view public.calendar_items
with (security_invoker = true)
as
select
  session.id as item_id,
  session.owner_id,
  'mission'::text as item_type,
  mission.id as domain_id,
  occurrence.id as occurrence_id,
  session.starts_at,
  session.ends_at,
  mission.title,
  mission.priority::text as priority,
  session.status::text as status,
  session.is_locked,
  jsonb_build_object(
    'session_index', session.session_index,
    'scheduling_mode', mission.scheduling_mode::text,
    'is_splittable', mission.is_splittable
  ) as metadata
from public.mission_sessions as session
join public.mission_occurrences as occurrence
  on occurrence.id = session.occurrence_id and occurrence.owner_id = session.owner_id
join public.missions as mission
  on mission.id = occurrence.mission_id and mission.owner_id = session.owner_id
union all
select
  meeting.id as item_id,
  meeting.owner_id,
  'meeting'::text as item_type,
  meeting.id as domain_id,
  null::uuid as occurrence_id,
  meeting.starts_at,
  meeting.ends_at,
  meeting.title,
  null::text as priority,
  case when meeting.is_cancelled then 'cancelled' else 'planned' end as status,
  true as is_locked,
  jsonb_build_object(
    'is_all_day', meeting.is_all_day,
    'location', meeting.location,
    'meeting_url', meeting.meeting_url
  ) as metadata
from public.meetings as meeting
union all
select
  unavailable.id as item_id,
  unavailable.owner_id,
  'unavailable'::text as item_type,
  unavailable.id as domain_id,
  null::uuid as occurrence_id,
  unavailable.starts_at,
  unavailable.ends_at,
  coalesce(nullif(unavailable.reason, ''), 'Unavailable') as title,
  null::text as priority,
  'unavailable'::text as status,
  true as is_locked,
  jsonb_build_object(
    'kind', unavailable.kind::text,
    'is_active', unavailable.is_active
  ) as metadata
from public.unavailable_periods as unavailable
where unavailable.is_active;

comment on view public.calendar_items is
  'RLS-preserving union of scheduled mission sessions, fixed meetings, and unavailable periods.';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_timezone text := coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'Asia/Jerusalem');
  requested_language public.language_code := case
    when new.raw_user_meta_data ->> 'language' = 'he' then 'he'::public.language_code
    else 'en'::public.language_code
  end;
  requested_name text := nullif(left(btrim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(new.email, ''), '@', 1)
  )), 120), '');
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = requested_timezone) then
    requested_timezone := 'Asia/Jerusalem';
  end if;

  insert into public.profiles (id, display_name, timezone, language)
  values (new.id, requested_name, requested_timezone, requested_language)
  on conflict (id) do nothing;

  insert into public.user_preferences (owner_id, export_language)
  values (new.id, requested_language)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Safe backfill for projects that already contain auth users when this migration
-- is first applied.
insert into public.profiles (id, display_name, timezone, language)
select
  auth_user.id,
  nullif(left(btrim(coalesce(
    auth_user.raw_user_meta_data ->> 'display_name',
    auth_user.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(auth_user.email, ''), '@', 1)
  )), 120), ''),
  case
    when exists (
      select 1 from pg_catalog.pg_timezone_names
      where name = auth_user.raw_user_meta_data ->> 'timezone'
    ) then auth_user.raw_user_meta_data ->> 'timezone'
    else 'Asia/Jerusalem'
  end,
  case when auth_user.raw_user_meta_data ->> 'language' = 'he'
    then 'he'::public.language_code else 'en'::public.language_code end
from auth.users as auth_user
on conflict (id) do nothing;

insert into public.user_preferences (owner_id, export_language)
select profile.id, profile.language
from public.profiles as profile
on conflict (owner_id) do nothing;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.record_mission_status_change() from public, anon, authenticated;
revoke all on function public.ensure_calendar_slot_available() from public, anon, authenticated;
revoke all on function public.protect_completion_actor() from public, anon, authenticated;
revoke all on function public.protect_record_owner() from public, anon, authenticated;
revoke all on function public.ensure_schedule_period_no_overlap() from public, anon, authenticated;
