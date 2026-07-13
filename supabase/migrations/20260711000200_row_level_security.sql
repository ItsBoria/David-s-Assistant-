-- Owner-isolated Row Level Security and explicit Data API grants.
-- The service_role remains reserved for trusted server/Edge Function paths and
-- bypasses RLS by Supabase design; no service-role credential belongs in a client.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'user_preferences', 'weekly_work_schedules', 'work_schedule_periods',
    'date_schedule_overrides', 'date_schedule_override_periods', 'recurrence_rules',
    'unavailable_periods', 'missions', 'mission_occurrences', 'mission_sessions',
    'meetings', 'contacts', 'meeting_participants', 'notification_provider_connections',
    'telegram_connections', 'telegram_link_tokens', 'reminders', 'notification_outbox',
    'notification_attempts', 'mission_status_history', 'mission_completion_records',
    'exports', 'audit_log', 'telegram_update_log'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

grant select, update on table public.profiles to authenticated;

-- Preferences are bootstrapped with the profile. Insert/update are allowed for
-- repair and settings changes, but direct deletion is intentionally unavailable.
drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own
on public.user_preferences
for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own
on public.user_preferences
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own
on public.user_preferences
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

grant select, insert, update on table public.user_preferences to authenticated;

-- Ordinary domain records may be managed with an authenticated user JWT. Every
-- child carries owner_id and ownership-preserving composite foreign keys.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'weekly_work_schedules', 'work_schedule_periods',
    'date_schedule_overrides', 'date_schedule_override_periods', 'recurrence_rules',
    'unavailable_periods', 'missions', 'mission_occurrences', 'mission_sessions',
    'meetings', 'contacts', 'meeting_participants'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = owner_id)',
      table_name || '_select_own', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)',
      table_name || '_insert_own', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',
      table_name || '_update_own', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)',
      table_name || '_delete_own', table_name
    );

    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end $$;

-- Mission lifecycle roots are updated in place. Physical deletion is withheld
-- from browser roles so cascade paths cannot erase append-only history or
-- completion evidence; a future trusted service will implement retention-aware
-- archival/soft deletion.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'missions', 'mission_occurrences', 'mission_sessions'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format('revoke delete on table public.%I from authenticated', table_name);
  end loop;
end $$;

-- Reminder delivery state, completion records, provider state, delivery history,
-- exports, status history, and the audit trail are owner-readable but writable
-- only from trusted server code. This prevents a browser from forging completion
-- or delivery outcomes. User actions go through the shared server-side services.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'notification_provider_connections', 'telegram_connections',
    'reminders', 'notification_outbox', 'notification_attempts',
    'mission_status_history', 'mission_completion_records', 'exports', 'audit_log'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = owner_id)',
      table_name || '_select_own', table_name
    );
    execute format('grant select on table public.%I to authenticated', table_name);
  end loop;
end $$;

-- telegram_link_tokens contains token hashes and telegram_update_log can contain
-- integration diagnostics before ownership is resolved. Both are deny-by-default
-- for browser roles (RLS enabled, no policies, no grants); service_role only.

revoke all on table public.calendar_items from public, anon, authenticated;
grant select on table public.calendar_items to authenticated, service_role;

grant usage on schema public to authenticated, service_role;

-- Pure immutable validators are executable by authenticated users because CHECK
-- constraints call them during writes. Mutating trigger helpers are not an RPC surface.
revoke all on function public.is_valid_weekdays(smallint[]) from public, anon;
revoke all on function public.is_valid_dates(date[]) from public, anon;
revoke all on function public.has_valid_mission_split_policy(integer, boolean, integer, integer, integer) from public, anon;
revoke all on function public.is_valid_mission_status_transition(public.mission_status, public.mission_status) from public, anon;
grant execute on function public.is_valid_weekdays(smallint[]) to authenticated, service_role;
grant execute on function public.is_valid_dates(date[]) to authenticated, service_role;
grant execute on function public.has_valid_mission_split_policy(integer, boolean, integer, integer, integer) to authenticated, service_role;
grant execute on function public.is_valid_mission_status_transition(public.mission_status, public.mission_status) to authenticated, service_role;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.validate_date_override_period() from public, anon, authenticated;
revoke all on function public.validate_day_off_override() from public, anon, authenticated;
revoke all on function public.validate_iana_timezone() from public, anon, authenticated;
revoke all on function public.ensure_schedule_period_no_overlap() from public, anon, authenticated;
revoke all on function public.ensure_calendar_slot_available() from public, anon, authenticated;
revoke all on function public.record_mission_status_change() from public, anon, authenticated;
revoke all on function public.validate_mission_status_write() from public, anon, authenticated;
revoke all on function public.protect_completion_actor() from public, anon, authenticated;
revoke all on function public.protect_record_owner() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
