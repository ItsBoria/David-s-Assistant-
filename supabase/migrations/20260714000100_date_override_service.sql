-- Transactional date-specific work-hours override write boundary.
-- Runs as the authenticated caller, so the existing RLS policies remain the
-- final owner-isolation boundary.

create or replace function public.save_date_schedule_override(
  p_override_date date,
  p_override_kind public.date_override_kind,
  p_reason text,
  p_starts_at time,
  p_ends_at time
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_override_id uuid;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if v_owner_id is null then
    raise exception 'authentication is required'
      using errcode = '42501';
  end if;

  if p_override_date is null then
    raise exception 'override date is required'
      using errcode = '22023';
  end if;

  if p_override_kind is null then
    raise exception 'override kind is required'
      using errcode = '22023';
  end if;

  if v_reason is not null and pg_catalog.char_length(v_reason) > 500 then
    raise exception 'override reason is too long'
      using errcode = '22023';
  end if;

  if p_override_kind = 'custom_hours' then
    if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
      raise exception 'custom hours require a valid start and end time'
        using errcode = '22023';
    end if;
  elsif p_starts_at is not null or p_ends_at is not null then
    raise exception 'day off overrides cannot include work hours'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.concat_ws(
      ':',
      'date-schedule-override',
      v_owner_id::text,
      p_override_date::text
    ),
    0
  ));

  select override_row.id
    into v_override_id
  from public.date_schedule_overrides as override_row
  where override_row.owner_id = v_owner_id
    and override_row.override_date = p_override_date
  for update;

  if v_override_id is null then
    insert into public.date_schedule_overrides (
      owner_id,
      override_date,
      override_kind,
      reason
    ) values (
      v_owner_id,
      p_override_date,
      p_override_kind,
      v_reason
    )
    returning id into v_override_id;
  else
    -- The existing trigger correctly prevents a day-off header while periods
    -- still exist, so remove them before converting custom hours to a day off.
    if p_override_kind = 'day_off' then
      delete from public.date_schedule_override_periods
      where owner_id = v_owner_id
        and override_id = v_override_id;
    end if;

    update public.date_schedule_overrides
    set override_kind = p_override_kind,
        reason = v_reason
    where id = v_override_id
      and owner_id = v_owner_id;
  end if;

  if p_override_kind = 'custom_hours' then
    delete from public.date_schedule_override_periods
    where owner_id = v_owner_id
      and override_id = v_override_id;

    insert into public.date_schedule_override_periods (
      owner_id,
      override_id,
      period_kind,
      starts_at,
      ends_at
    ) values (
      v_owner_id,
      v_override_id,
      'work',
      p_starts_at,
      p_ends_at
    );
  end if;

  return v_override_id;
end;
$$;

revoke all on function public.save_date_schedule_override(
  date,
  public.date_override_kind,
  text,
  time,
  time
) from public, anon;

grant execute on function public.save_date_schedule_override(
  date,
  public.date_override_kind,
  text,
  time,
  time
) to authenticated, service_role;
