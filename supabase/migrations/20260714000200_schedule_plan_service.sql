-- Transactional persistence boundary for the first selected-date scheduling
-- workflow. The web service recomputes the preview immediately before calling
-- this function; the database independently rechecks every safety invariant.

create or replace function public.apply_selected_date_plan(p_assignments jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_time_zone text;
  v_buffer_before integer;
  v_buffer_after integer;
  v_mission_gap integer;
  v_daily_limit integer;
  v_assignment_count integer;
  v_assignment record;
  v_mission record;
  v_override_kind public.date_override_kind;
  v_local_start timestamp without time zone;
  v_local_end timestamp without time zone;
  v_local_date date;
  v_payload_minutes numeric;
  v_existing_minutes numeric;
  v_occurrence_id uuid;
  v_session_id uuid;
  v_correlation_id uuid := extensions.gen_random_uuid();
  v_scheduled jsonb := '[]'::jsonb;
begin
  if v_owner_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if p_assignments is null or pg_catalog.jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'assignments must be a JSON array' using errcode = '22023';
  end if;

  v_assignment_count := pg_catalog.jsonb_array_length(p_assignments);
  if v_assignment_count < 1 or v_assignment_count > 100 then
    raise exception 'assignments must contain between 1 and 100 items'
      using errcode = '22023';
  end if;

  -- The calendar overlap trigger uses this same owner-scoped lock. No meeting,
  -- unavailable period, or mission session can race the checks and inserts.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner_id::text, 0)
  );

  select profile.timezone,
         preferences.default_buffer_before_minutes,
         preferences.default_buffer_after_minutes,
         preferences.maximum_daily_work_minutes
    into v_time_zone, v_buffer_before, v_buffer_after, v_daily_limit
  from public.profiles as profile
  join public.user_preferences as preferences
    on preferences.owner_id = profile.id
  where profile.id = v_owner_id;

  if not found then
    raise exception 'planning preferences are unavailable' using errcode = 'P0002';
  end if;

  v_mission_gap := greatest(v_buffer_before, v_buffer_after);

  begin
    if exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_assignments)
        as assignment(mission_id uuid, starts_at timestamptz, ends_at timestamptz)
      where assignment.mission_id is null
         or assignment.starts_at is null
         or assignment.ends_at is null
    ) then
      raise exception 'every assignment requires missionId, startsAt, and endsAt'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_assignments)
        as assignment(mission_id uuid, starts_at timestamptz, ends_at timestamptz)
      group by assignment.mission_id
      having pg_catalog.count(*) > 1
    ) then
      raise exception 'a mission may appear only once in a plan'
        using errcode = '22023';
    end if;
  exception
    when data_exception then
      raise exception 'assignment values are invalid' using errcode = '22023';
  end;

  -- Validate and lock all mission roots before making any write.
  for v_assignment in
    select assignment.mission_id, assignment.starts_at, assignment.ends_at
    from pg_catalog.jsonb_to_recordset(p_assignments)
      as assignment(mission_id uuid, starts_at timestamptz, ends_at timestamptz)
    order by assignment.starts_at, assignment.mission_id
  loop
    select mission.id,
           mission.selected_date,
           mission.estimated_duration_minutes,
           mission.status,
           mission.scheduling_mode,
           mission.is_locked,
           mission.recurrence_rule_id
      into v_mission
    from public.missions as mission
    where mission.id = v_assignment.mission_id
      and mission.owner_id = v_owner_id
    for update;

    if not found then
      raise exception 'mission is missing or not owned by the caller'
        using errcode = 'P0002';
    end if;

    if v_mission.status <> 'unscheduled'
      or v_mission.scheduling_mode <> 'selected_date'
      or v_mission.recurrence_rule_id is not null then
      raise exception 'the plan is stale; reload before accepting it'
        using errcode = '40001';
    end if;

    if v_mission.is_locked then
      raise exception 'a locked mission cannot receive a new automatic position'
        using errcode = '55000';
    end if;

    if v_assignment.ends_at <= v_assignment.starts_at
      or extract(epoch from (v_assignment.ends_at - v_assignment.starts_at))
        <> v_mission.estimated_duration_minutes * 60 then
      raise exception 'assignment duration does not match the mission estimate'
        using errcode = '22023';
    end if;

    v_local_start := v_assignment.starts_at at time zone v_time_zone;
    v_local_end := v_assignment.ends_at at time zone v_time_zone;
    v_local_date := v_local_start::date;

    if v_local_date <> v_mission.selected_date
      or v_local_end::date <> v_mission.selected_date then
      raise exception 'assignment is outside the selected mission date'
        using errcode = '22023';
    end if;

    select override_row.override_kind
      into v_override_kind
    from public.date_schedule_overrides as override_row
    where override_row.owner_id = v_owner_id
      and override_row.override_date = v_local_date;

    if found then
      if v_override_kind = 'day_off' then
        raise exception 'assignment falls on a configured day off'
          using errcode = '22023';
      end if;

      if not exists (
        select 1
        from public.date_schedule_overrides as override_row
        join public.date_schedule_override_periods as period
          on period.override_id = override_row.id
         and period.owner_id = override_row.owner_id
        where override_row.owner_id = v_owner_id
          and override_row.override_date = v_local_date
          and period.period_kind = 'work'
          and period.starts_at <= v_local_start::time
          and period.ends_at >= v_local_end::time
      ) then
        raise exception 'assignment is outside custom work hours'
          using errcode = '22023';
      end if;

      if exists (
        select 1
        from public.date_schedule_overrides as override_row
        join public.date_schedule_override_periods as period
          on period.override_id = override_row.id
         and period.owner_id = override_row.owner_id
        where override_row.owner_id = v_owner_id
          and override_row.override_date = v_local_date
          and period.period_kind = 'break'
          and period.starts_at < v_local_end::time
          and period.ends_at > v_local_start::time
      ) then
        raise exception 'assignment overlaps a date-specific break'
          using errcode = '23P01';
      end if;
    else
      if not exists (
        select 1
        from public.weekly_work_schedules as schedule
        join public.work_schedule_periods as period
          on period.schedule_id = schedule.id
         and period.owner_id = schedule.owner_id
        where schedule.owner_id = v_owner_id
          and schedule.is_active
          and schedule.effective_from <= v_local_date
          and (schedule.effective_until is null or schedule.effective_until >= v_local_date)
          and period.weekday = extract(dow from v_local_date)::smallint
          and period.period_kind = 'work'
          and period.starts_at <= v_local_start::time
          and period.ends_at >= v_local_end::time
      ) then
        raise exception 'assignment is outside weekly work hours'
          using errcode = '22023';
      end if;

      if exists (
        select 1
        from public.weekly_work_schedules as schedule
        join public.work_schedule_periods as period
          on period.schedule_id = schedule.id
         and period.owner_id = schedule.owner_id
        where schedule.owner_id = v_owner_id
          and schedule.is_active
          and schedule.effective_from <= v_local_date
          and (schedule.effective_until is null or schedule.effective_until >= v_local_date)
          and period.weekday = extract(dow from v_local_date)::smallint
          and period.period_kind = 'break'
          and period.starts_at < v_local_end::time
          and period.ends_at > v_local_start::time
      ) then
        raise exception 'assignment overlaps a weekly break'
          using errcode = '23P01';
      end if;
    end if;

    if exists (
      select 1
      from public.meetings as meeting
      where meeting.owner_id = v_owner_id
        and not meeting.is_cancelled
        and tstzrange(
          meeting.starts_at - pg_catalog.make_interval(mins => v_buffer_before),
          meeting.ends_at + pg_catalog.make_interval(mins => v_buffer_after),
          '[)'
        ) && tstzrange(v_assignment.starts_at, v_assignment.ends_at, '[)')
    ) or exists (
      select 1
      from public.unavailable_periods as unavailable
      where unavailable.owner_id = v_owner_id
        and unavailable.is_active
        and tstzrange(
          unavailable.starts_at - pg_catalog.make_interval(mins => v_buffer_before),
          unavailable.ends_at + pg_catalog.make_interval(mins => v_buffer_after),
          '[)'
        ) && tstzrange(v_assignment.starts_at, v_assignment.ends_at, '[)')
    ) or exists (
      select 1
      from public.mission_sessions as session
      where session.owner_id = v_owner_id
        and session.status not in ('cancelled', 'postponed')
        and tstzrange(
          session.starts_at - pg_catalog.make_interval(mins => v_buffer_before),
          session.ends_at + pg_catalog.make_interval(mins => v_buffer_after),
          '[)'
        ) && tstzrange(v_assignment.starts_at, v_assignment.ends_at, '[)')
    ) then
      raise exception 'assignment conflicts with buffered calendar time'
        using errcode = '23P01';
    end if;
  end loop;

  -- The pure planner uses the greater configured buffer as the minimum gap
  -- between newly proposed sessions. Recheck that pairwise rule in SQL.
  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_assignments)
      as earlier(mission_id uuid, starts_at timestamptz, ends_at timestamptz)
    cross join pg_catalog.jsonb_to_recordset(p_assignments)
      as later(mission_id uuid, starts_at timestamptz, ends_at timestamptz)
    where earlier.mission_id <> later.mission_id
      and (
        earlier.starts_at < later.starts_at
        or (
          earlier.starts_at = later.starts_at
          and earlier.mission_id::text < later.mission_id::text
        )
      )
      and earlier.ends_at + pg_catalog.make_interval(mins => v_mission_gap)
        > later.starts_at
  ) then
    raise exception 'planned missions overlap or violate the configured buffer'
      using errcode = '23P01';
  end if;

  -- Count existing meetings and mission sessions the same way as the preview:
  -- their full duration belongs to the civil date on which they start.
  for v_local_date in
    select distinct (assignment.starts_at at time zone v_time_zone)::date
    from pg_catalog.jsonb_to_recordset(p_assignments)
      as assignment(mission_id uuid, starts_at timestamptz, ends_at timestamptz)
  loop
    select coalesce(
      pg_catalog.sum(
        extract(epoch from (assignment.ends_at - assignment.starts_at)) / 60
      ),
      0
    )
      into v_payload_minutes
    from pg_catalog.jsonb_to_recordset(p_assignments)
      as assignment(mission_id uuid, starts_at timestamptz, ends_at timestamptz)
    where (assignment.starts_at at time zone v_time_zone)::date = v_local_date;

    select coalesce(pg_catalog.sum(item.minutes), 0)
      into v_existing_minutes
    from (
      select pg_catalog.ceil(
        extract(epoch from (meeting.ends_at - meeting.starts_at)) / 60
      ) as minutes
      from public.meetings as meeting
      where meeting.owner_id = v_owner_id
        and not meeting.is_cancelled
        and (meeting.starts_at at time zone v_time_zone)::date = v_local_date
      union all
      select pg_catalog.ceil(
        extract(epoch from (session.ends_at - session.starts_at)) / 60
      ) as minutes
      from public.mission_sessions as session
      where session.owner_id = v_owner_id
        and session.status not in ('cancelled', 'postponed')
        and (session.starts_at at time zone v_time_zone)::date = v_local_date
    ) as item;

    if v_payload_minutes + v_existing_minutes > v_daily_limit then
      raise exception 'the plan exceeds the maximum daily work minutes'
        using errcode = '22023';
    end if;
  end loop;

  for v_assignment in
    select assignment.mission_id, assignment.starts_at, assignment.ends_at
    from pg_catalog.jsonb_to_recordset(p_assignments)
      as assignment(mission_id uuid, starts_at timestamptz, ends_at timestamptz)
    order by assignment.starts_at, assignment.mission_id
  loop
    select mission.selected_date into v_local_date
    from public.missions as mission
    where mission.id = v_assignment.mission_id
      and mission.owner_id = v_owner_id;

    insert into public.mission_occurrences (
      owner_id,
      mission_id,
      recurrence_key,
      occurrence_date,
      status,
      is_locked
    ) values (
      v_owner_id,
      v_assignment.mission_id,
      'one-off',
      v_local_date,
      'planned',
      false
    )
    returning id into v_occurrence_id;

    insert into public.mission_sessions (
      owner_id,
      occurrence_id,
      session_index,
      starts_at,
      ends_at,
      status,
      is_locked
    ) values (
      v_owner_id,
      v_occurrence_id,
      1,
      v_assignment.starts_at,
      v_assignment.ends_at,
      'planned',
      false
    )
    returning id into v_session_id;

    update public.missions
    set status = 'planned'
    where id = v_assignment.mission_id
      and owner_id = v_owner_id;

    v_scheduled := v_scheduled || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'missionId', v_assignment.mission_id,
        'occurrenceId', v_occurrence_id,
        'sessionId', v_session_id,
        'startsAt', v_assignment.starts_at,
        'endsAt', v_assignment.ends_at
      )
    );
  end loop;

  insert into public.audit_log (
    owner_id,
    actor_user_id,
    action,
    entity_type,
    source_channel,
    after_summary,
    correlation_id
  ) values (
    v_owner_id,
    v_owner_id,
    'schedule.plan.accepted',
    'schedule_plan',
    'web',
    pg_catalog.jsonb_build_object(
      'assignmentCount', v_assignment_count,
      'scheduled', v_scheduled
    ),
    v_correlation_id
  );

  return pg_catalog.jsonb_build_object(
    'correlationId', v_correlation_id,
    'scheduled', v_scheduled
  );
end;
$$;

revoke all on function public.apply_selected_date_plan(jsonb)
  from public, anon;

grant execute on function public.apply_selected_date_plan(jsonb)
  to authenticated;
