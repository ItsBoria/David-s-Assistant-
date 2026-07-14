\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select has_function(
  'public',
  'save_date_schedule_override',
  array['date', 'date_override_kind', 'text', 'time without time zone', 'time without time zone'],
  'the transactional date-override function exists'
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
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000701',
  'authenticated',
  'authenticated',
  'date-override-service@example.test',
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
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000701';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000701","role":"authenticated"}';

select lives_ok(
  $$
    select public.save_date_schedule_override(
      '2099-02-01',
      'custom_hours',
      'Short day',
      '10:00',
      '14:00'
    )
  $$,
  'an authenticated owner can save custom hours'
);

select is(
  (
    select override_kind::text
    from public.date_schedule_overrides
    where override_date = '2099-02-01'
  ),
  'custom_hours',
  'the custom-hours header is stored'
);

select is(
  (
    select starts_at::text || '-' || ends_at::text
    from public.date_schedule_override_periods
  ),
  '10:00:00-14:00:00',
  'the custom work period is stored'
);

select lives_ok(
  $$
    select public.save_date_schedule_override(
      '2099-02-01',
      'day_off',
      'Holiday',
      null,
      null
    )
  $$,
  'custom hours can be atomically replaced with a day off'
);

select is(
  (
    select override_kind::text || ':' || reason
    from public.date_schedule_overrides
    where override_date = '2099-02-01'
  ),
  'day_off:Holiday',
  'the day-off header replaces the custom-hours header'
);

select is(
  (select count(*) from public.date_schedule_override_periods),
  0::bigint,
  'a day off retains no work periods'
);

select throws_ok(
  $$
    select public.save_date_schedule_override(
      '2099-02-02',
      'custom_hours',
      null,
      '14:00',
      '10:00'
    )
  $$,
  '22023',
  null,
  'invalid custom hours fail without a partial override'
);

select is(
  (
    select count(*)
    from public.date_schedule_overrides
    where override_date = '2099-02-02'
  ),
  0::bigint,
  'invalid custom hours leave no partial override header'
);

delete from public.date_schedule_overrides
where override_date = '2099-02-01';

select is(
  (select count(*) from public.date_schedule_overrides),
  0::bigint,
  'an owner can remove their date override'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claims;

select * from finish();

rollback;
