\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

select has_function(
  'public',
  'generate_mission_recurrence_occurrences',
  array['uuid', 'date'],
  'the authenticated mission recurrence generator exists'
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
  '00000000-0000-4000-8000-000000000901',
  'authenticated',
  'authenticated',
  'recurrence-owner@example.test',
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
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000902',
  'authenticated',
  'authenticated',
  'other-recurrence-owner@example.test',
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
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000901';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated"}';

insert into public.recurrence_rules (
  id,
  owner_id,
  frequency,
  interval_count,
  interval_unit,
  by_weekdays,
  day_of_month,
  starts_on,
  ends_on,
  maximum_occurrences,
  timezone
) values
(
  '00000000-0000-4000-8000-000000000910',
  '00000000-0000-4000-8000-000000000901',
  'daily', 1, null, null, null, '2099-01-01', null, null, 'Asia/Jerusalem'
),
(
  '00000000-0000-4000-8000-000000000911',
  '00000000-0000-4000-8000-000000000901',
  'daily', 1, null, null, null, '2099-01-01', null, 3, 'Asia/Jerusalem'
),
(
  '00000000-0000-4000-8000-000000000912',
  '00000000-0000-4000-8000-000000000901',
  'daily', 1, null, null, null, '2099-01-01', '2099-01-03', null, 'Asia/Jerusalem'
),
(
  '00000000-0000-4000-8000-000000000913',
  '00000000-0000-4000-8000-000000000901',
  'monthly', 1, null, null, 31, '2099-01-31', null, null, 'Asia/Jerusalem'
),
(
  '00000000-0000-4000-8000-000000000914',
  '00000000-0000-4000-8000-000000000901',
  'weekly', 2, null, array[0, 2]::smallint[], null, '2099-02-03', null, null,
  'Asia/Jerusalem'
);

insert into public.missions (
  id,
  owner_id,
  recurrence_rule_id,
  title,
  priority,
  status,
  scheduling_mode,
  estimated_duration_minutes,
  selected_date,
  source_channel
) values
(
  '00000000-0000-4000-8000-000000000920',
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000910',
  'Daily mission', 'medium', 'unscheduled', 'selected_date', 60, '2099-01-01', 'web'
),
(
  '00000000-0000-4000-8000-000000000921',
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000911',
  'Counted mission', 'medium', 'unscheduled', 'selected_date', 60, '2099-01-01', 'web'
),
(
  '00000000-0000-4000-8000-000000000922',
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000912',
  'Ending mission', 'medium', 'unscheduled', 'selected_date', 60, '2099-01-01', 'web'
),
(
  '00000000-0000-4000-8000-000000000923',
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000913',
  'Monthly mission', 'medium', 'unscheduled', 'selected_date', 60, '2099-01-31', 'web'
),
(
  '00000000-0000-4000-8000-000000000924',
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000914',
  'Weekly mission', 'medium', 'unscheduled', 'selected_date', 60, '2099-02-03', 'web'
),
(
  '00000000-0000-4000-8000-000000000925',
  '00000000-0000-4000-8000-000000000901',
  null,
  'One-off mission', 'medium', 'unscheduled', 'selected_date', 60, '2099-01-01', 'web'
);

select lives_ok(
  $$
    select public.generate_mission_recurrence_occurrences(
      '00000000-0000-4000-8000-000000000920',
      '2099-01-05'
    )
  $$,
  'an owner can generate a bounded recurrence range'
);

select is(
  (
    select pg_catalog.string_agg(
      occurrence_date::text || ':' || sequence_number || ':' || recurrence_key,
      ',' order by occurrence_date
    )
    from public.mission_occurrences
    where mission_id = '00000000-0000-4000-8000-000000000920'
  ),
  '2099-01-01:1:date:2099-01-01,2099-01-02:2:date:2099-01-02,2099-01-03:3:date:2099-01-03,2099-01-04:4:date:2099-01-04,2099-01-05:5:date:2099-01-05',
  'generated rows have stable dates, absolute sequences, and keys'
);

select is(
  (
    select generation_cursor_date::text
    from public.recurrence_rules
    where id = '00000000-0000-4000-8000-000000000910'
  ),
  '2099-01-05',
  'generation advances the rule cursor atomically'
);

select is(
  (
    select action || ':' || (after_summary ->> 'createdCount')
    from public.audit_log
    where entity_id = '00000000-0000-4000-8000-000000000920'
  ),
  'recurrence.occurrences.generated:5',
  'generation appends one correlated audit summary'
);

select is(
  public.generate_mission_recurrence_occurrences(
    '00000000-0000-4000-8000-000000000920',
    '2099-01-05'
  ) ->> 'createdCount',
  '0',
  'repeating an already processed range is idempotent'
);

select is(
  (
    select pg_catalog.count(*)
    from public.mission_occurrences
    where mission_id = '00000000-0000-4000-8000-000000000920'
  ),
  5::bigint,
  'an idempotent retry does not duplicate occurrences'
);

select lives_ok(
  $$
    select public.generate_mission_recurrence_occurrences(
      '00000000-0000-4000-8000-000000000921',
      '2099-01-10'
    )
  $$,
  'a count-limited rule generates through its final occurrence'
);

select is(
  (
    select pg_catalog.string_agg(occurrence_date::text, ',' order by occurrence_date)
    from public.mission_occurrences
    where mission_id = '00000000-0000-4000-8000-000000000921'
  ),
  '2099-01-01,2099-01-02,2099-01-03',
  'maximum occurrences truncate the candidate set'
);

select is(
  (
    select is_active::text
    from public.recurrence_rules
    where id = '00000000-0000-4000-8000-000000000911'
  ),
  'false',
  'a count-exhausted rule is deactivated'
);

select lives_ok(
  $$
    select public.generate_mission_recurrence_occurrences(
      '00000000-0000-4000-8000-000000000922',
      '2099-01-10'
    )
  $$,
  'an end-date rule includes its ending date'
);

select is(
  (
    select pg_catalog.string_agg(occurrence_date::text, ',' order by occurrence_date)
    from public.mission_occurrences
    where mission_id = '00000000-0000-4000-8000-000000000922'
  ),
  '2099-01-01,2099-01-02,2099-01-03',
  'the date ending is inclusive and excludes later candidates'
);

select lives_ok(
  $$
    select public.generate_mission_recurrence_occurrences(
      '00000000-0000-4000-8000-000000000923',
      '2099-05-31'
    )
  $$,
  'a monthly rule can span shorter months'
);

select is(
  (
    select pg_catalog.string_agg(occurrence_date::text, ',' order by occurrence_date)
    from public.mission_occurrences
    where mission_id = '00000000-0000-4000-8000-000000000923'
  ),
  '2099-01-31,2099-03-31,2099-05-31',
  'monthly day 31 skips months that do not contain it'
);

select lives_ok(
  $$
    select public.generate_mission_recurrence_occurrences(
      '00000000-0000-4000-8000-000000000924',
      '2099-03-03'
    )
  $$,
  'a multi-week selected-weekday rule is generated'
);

select is(
  (
    select pg_catalog.string_agg(occurrence_date::text, ',' order by occurrence_date)
    from public.mission_occurrences
    where mission_id = '00000000-0000-4000-8000-000000000924'
  ),
  '2099-02-03,2099-02-15,2099-02-17,2099-03-01,2099-03-03',
  'weekly cadence stays anchored to the start week'
);

select throws_ok(
  $$
    insert into public.missions (
      owner_id, recurrence_rule_id, title, scheduling_mode,
      estimated_duration_minutes, selected_date, source_channel
    ) values (
      '00000000-0000-4000-8000-000000000901',
      '00000000-0000-4000-8000-000000000910',
      'Duplicate rule mission', 'selected_date', 30, '2099-01-01', 'web'
    )
  $$,
  '23505',
  null,
  'one recurrence rule cannot belong to two missions'
);

select throws_ok(
  $$
    insert into public.meetings (
      owner_id, recurrence_rule_id, series_instance_key, title,
      starts_at, ends_at, source_channel
    ) values (
      '00000000-0000-4000-8000-000000000901',
      '00000000-0000-4000-8000-000000000910',
      'date:2099-01-01', 'Duplicate rule meeting',
      '2099-01-01T07:00:00Z', '2099-01-01T08:00:00Z', 'web'
    )
  $$,
  '23505',
  null,
  'one recurrence rule cannot be shared across mission and meeting series'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claims;

insert into public.recurrence_rules (
  id, owner_id, frequency, interval_count, starts_on, timezone
) values (
  '00000000-0000-4000-8000-000000000930',
  '00000000-0000-4000-8000-000000000902',
  'daily', 1, '2099-01-01', 'Asia/Jerusalem'
);

insert into public.missions (
  id, owner_id, recurrence_rule_id, title, scheduling_mode,
  estimated_duration_minutes, selected_date, source_channel
) values (
  '00000000-0000-4000-8000-000000000931',
  '00000000-0000-4000-8000-000000000902',
  '00000000-0000-4000-8000-000000000930',
  'Other owner recurrence', 'selected_date', 60, '2099-01-01', 'web'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000901';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated"}';

select throws_ok(
  $$
    select public.generate_mission_recurrence_occurrences(
      '00000000-0000-4000-8000-000000000931',
      '2099-01-10'
    )
  $$,
  'P0002',
  null,
  'an authenticated user cannot generate another owner series'
);

select throws_ok(
  $$
    select public.generate_mission_recurrence_occurrences(
      '00000000-0000-4000-8000-000000000925',
      '2099-01-10'
    )
  $$,
  '22023',
  null,
  'a one-off mission cannot enter recurrence generation'
);

select throws_ok(
  $$
    select public.generate_mission_recurrence_occurrences(
      '00000000-0000-4000-8000-000000000923',
      '2110-12-31'
    )
  $$,
  '22023',
  null,
  'one call cannot request an unbounded recurrence horizon'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claims;

set local role anon;
select throws_ok(
  $$
    select public.generate_mission_recurrence_occurrences(
      '00000000-0000-4000-8000-000000000920',
      '2099-01-10'
    )
  $$,
  '42501',
  null,
  'anonymous callers cannot execute recurrence generation'
);
reset role;

select * from finish();

rollback;
