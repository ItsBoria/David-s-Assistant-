\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

select has_function(
  'public',
  'apply_selected_date_plan',
  array['jsonb'],
  'the transactional selected-date plan function exists'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
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
  '00000000-0000-4000-8000-000000000801',
  'authenticated',
  'authenticated',
  'plan-owner@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000802',
  'authenticated',
  'authenticated',
  'other-plan-owner@example.test',
  '',
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

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated"}';

insert into public.weekly_work_schedules (
  id,
  owner_id,
  name,
  effective_from,
  is_active
) values (
  '00000000-0000-4000-8000-000000000810',
  '00000000-0000-4000-8000-000000000801',
  'Plan test schedule',
  '2099-01-01',
  true
);

insert into public.work_schedule_periods (
  owner_id,
  schedule_id,
  weekday,
  period_kind,
  starts_at,
  ends_at
) values
(
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000810',
  0,
  'work',
  '09:00',
  '17:00'
),
(
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000810',
  1,
  'work',
  '09:00',
  '17:00'
);

insert into public.missions (
  id,
  owner_id,
  title,
  priority,
  status,
  scheduling_mode,
  estimated_duration_minutes,
  selected_date,
  source_channel
) values
(
  '00000000-0000-4000-8000-000000000821',
  '00000000-0000-4000-8000-000000000801',
  'Accepted mission',
  'high',
  'unscheduled',
  'selected_date',
  60,
  '2099-02-01',
  'web'
),
(
  '00000000-0000-4000-8000-000000000822',
  '00000000-0000-4000-8000-000000000801',
  'Conflict mission',
  'medium',
  'unscheduled',
  'selected_date',
  60,
  '2099-02-01',
  'web'
),
(
  '00000000-0000-4000-8000-000000000823',
  '00000000-0000-4000-8000-000000000801',
  'Outside hours mission',
  'medium',
  'unscheduled',
  'selected_date',
  60,
  '2099-02-01',
  'web'
),
(
  '00000000-0000-4000-8000-000000000824',
  '00000000-0000-4000-8000-000000000801',
  'Day off mission',
  'medium',
  'unscheduled',
  'selected_date',
  60,
  '2099-02-02',
  'web'
),
(
  '00000000-0000-4000-8000-000000000825',
  '00000000-0000-4000-8000-000000000801',
  'Daily cap mission',
  'medium',
  'unscheduled',
  'selected_date',
  60,
  '2099-02-01',
  'web'
),
(
  '00000000-0000-4000-8000-000000000826',
  '00000000-0000-4000-8000-000000000801',
  'Buffered mission one',
  'medium',
  'unscheduled',
  'selected_date',
  60,
  '2099-02-01',
  'web'
),
(
  '00000000-0000-4000-8000-000000000827',
  '00000000-0000-4000-8000-000000000801',
  'Buffered mission two',
  'medium',
  'unscheduled',
  'selected_date',
  60,
  '2099-02-01',
  'web'
);

select lives_ok(
  $$
    select public.apply_selected_date_plan(
      '[{"mission_id":"00000000-0000-4000-8000-000000000821","starts_at":"2099-02-01T07:00:00Z","ends_at":"2099-02-01T08:00:00Z"}]'::jsonb
    )
  $$,
  'an authenticated owner can atomically accept a valid plan'
);

select is(
  (
    select status::text
    from public.missions
    where id = '00000000-0000-4000-8000-000000000821'
  ),
  'planned',
  'accepting a plan moves the mission to planned'
);

select is(
  (
    select occurrence_date::text || ':' || status::text || ':' || recurrence_key
    from public.mission_occurrences
    where mission_id = '00000000-0000-4000-8000-000000000821'
  ),
  '2099-02-01:planned:one-off',
  'a concrete one-off occurrence is created'
);

select is(
  (
    select starts_at::text || '/' || ends_at::text || '/' || status::text
    from public.mission_sessions
    where occurrence_id = (
      select id from public.mission_occurrences
      where mission_id = '00000000-0000-4000-8000-000000000821'
    )
  ),
  '2099-02-01 07:00:00+00/2099-02-01 08:00:00+00/planned',
  'the accepted assignment becomes a planned session'
);

select is(
  (
    select count(*)
    from public.mission_status_history
    where mission_id = '00000000-0000-4000-8000-000000000821'
      and from_status = 'unscheduled'
      and to_status = 'planned'
  ),
  1::bigint,
  'the existing status trigger records the planning transition'
);

select is(
  (
    select action || ':' || entity_type || ':' || (after_summary ->> 'assignmentCount')
    from public.audit_log
    where action = 'schedule.plan.accepted'
  ),
  'schedule.plan.accepted:schedule_plan:1',
  'the transaction appends a correlated audit summary'
);

insert into public.meetings (
  owner_id,
  title,
  starts_at,
  ends_at,
  source_channel
) values (
  '00000000-0000-4000-8000-000000000801',
  'Blocking meeting',
  '2099-02-01T08:00:00Z',
  '2099-02-01T09:00:00Z',
  'web'
);

select throws_ok(
  $$
    select public.apply_selected_date_plan(
      '[{"mission_id":"00000000-0000-4000-8000-000000000822","starts_at":"2099-02-01T08:00:00Z","ends_at":"2099-02-01T09:00:00Z"}]'::jsonb
    )
  $$,
  '23P01',
  null,
  'a concurrent or stale calendar conflict rejects the whole plan'
);

select is(
  (
    select status::text
    from public.missions
    where id = '00000000-0000-4000-8000-000000000822'
  ),
  'unscheduled',
  'a rejected conflict leaves the mission unchanged'
);

select throws_ok(
  $$
    select public.apply_selected_date_plan(
      '[{"mission_id":"00000000-0000-4000-8000-000000000823","starts_at":"2099-02-01T06:00:00Z","ends_at":"2099-02-01T07:00:00Z"}]'::jsonb
    )
  $$,
  '22023',
  null,
  'an assignment outside effective work hours is rejected'
);

insert into public.date_schedule_overrides (
  owner_id,
  override_date,
  override_kind,
  reason
) values (
  '00000000-0000-4000-8000-000000000801',
  '2099-02-02',
  'day_off',
  'Plan test day off'
);

select throws_ok(
  $$
    select public.apply_selected_date_plan(
      '[{"mission_id":"00000000-0000-4000-8000-000000000824","starts_at":"2099-02-02T07:00:00Z","ends_at":"2099-02-02T08:00:00Z"}]'::jsonb
    )
  $$,
  '22023',
  null,
  'a day-off override is independently enforced when saving'
);

update public.user_preferences
set maximum_daily_work_minutes = 60
where owner_id = '00000000-0000-4000-8000-000000000801';

select throws_ok(
  $$
    select public.apply_selected_date_plan(
      '[{"mission_id":"00000000-0000-4000-8000-000000000825","starts_at":"2099-02-01T09:00:00Z","ends_at":"2099-02-01T10:00:00Z"}]'::jsonb
    )
  $$,
  '22023',
  null,
  'existing scheduled work counts toward the daily limit'
);

update public.user_preferences
set maximum_daily_work_minutes = 540,
    default_buffer_before_minutes = 15,
    default_buffer_after_minutes = 15
where owner_id = '00000000-0000-4000-8000-000000000801';

select throws_ok(
  $$
    select public.apply_selected_date_plan(
      '[
        {"mission_id":"00000000-0000-4000-8000-000000000826","starts_at":"2099-02-01T10:00:00Z","ends_at":"2099-02-01T11:00:00Z"},
        {"mission_id":"00000000-0000-4000-8000-000000000827","starts_at":"2099-02-01T11:00:00Z","ends_at":"2099-02-01T12:00:00Z"}
      ]'::jsonb
    )
  $$,
  '23P01',
  null,
  'new assignments must preserve the configured mission gap'
);

select throws_ok(
  $$
    select public.apply_selected_date_plan(
      '[
        {"mission_id":"00000000-0000-4000-8000-000000000826","starts_at":"2099-02-01T10:00:00Z","ends_at":"2099-02-01T11:00:00Z"},
        {"mission_id":"00000000-0000-4000-8000-000000000826","starts_at":"2099-02-01T11:15:00Z","ends_at":"2099-02-01T12:15:00Z"}
      ]'::jsonb
    )
  $$,
  '22023',
  null,
  'duplicate mission assignments are rejected'
);

select throws_ok(
  $$
    select public.apply_selected_date_plan(
      '[{"mission_id":"00000000-0000-4000-8000-000000000826","starts_at":"2099-02-01T10:00:00Z","ends_at":"2099-02-01T10:30:00Z"}]'::jsonb
    )
  $$,
  '22023',
  null,
  'assignment duration must equal the mission estimate'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claims;

insert into public.missions (
  id,
  owner_id,
  title,
  priority,
  status,
  scheduling_mode,
  estimated_duration_minutes,
  selected_date,
  source_channel
) values (
  '00000000-0000-4000-8000-000000000828',
  '00000000-0000-4000-8000-000000000802',
  'Other owner mission',
  'medium',
  'unscheduled',
  'selected_date',
  60,
  '2099-02-01',
  'web'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated"}';

select throws_ok(
  $$
    select public.apply_selected_date_plan(
      '[{"mission_id":"00000000-0000-4000-8000-000000000828","starts_at":"2099-02-01T07:00:00Z","ends_at":"2099-02-01T08:00:00Z"}]'::jsonb
    )
  $$,
  'P0002',
  null,
  'the security-definer boundary still rejects another owner mission'
);

select is(
  (
    select count(*)
    from public.mission_occurrences
    where owner_id = '00000000-0000-4000-8000-000000000801'
  ),
  1::bigint,
  'all rejected plans leave no partial occurrences'
);

select is(
  (
    select count(*)
    from public.mission_sessions
    where owner_id = '00000000-0000-4000-8000-000000000801'
  ),
  1::bigint,
  'all rejected plans leave no partial sessions'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claims;

set local role anon;
select throws_ok(
  $$
    select public.apply_selected_date_plan('[]'::jsonb)
  $$,
  '42501',
  null,
  'anonymous callers cannot execute the plan function'
);
reset role;

select * from finish();

rollback;
