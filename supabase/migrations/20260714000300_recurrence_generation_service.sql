-- A recurrence rule owns one cursor and therefore belongs to exactly one
-- mission or meeting series. Enforce that graph invariant across both parent
-- tables before exposing incremental mission-occurrence generation.

create unique index missions_recurrence_rule_unique_idx
  on public.missions(recurrence_rule_id)
  where recurrence_rule_id is not null;

create unique index meetings_recurrence_rule_unique_idx
  on public.meetings(recurrence_rule_id)
  where recurrence_rule_id is not null;

create or replace function public.ensure_recurrence_rule_single_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.recurrence_rule_id is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('recurrence-rule:' || new.recurrence_rule_id::text, 0)
  );

  if tg_table_name = 'missions' then
    if exists (
      select 1
      from public.meetings as meeting
      where meeting.recurrence_rule_id = new.recurrence_rule_id
    ) then
      raise exception 'recurrence rule already belongs to a meeting series'
        using errcode = '23505';
    end if;
  elsif tg_table_name = 'meetings' then
    if exists (
      select 1
      from public.missions as mission
      where mission.recurrence_rule_id = new.recurrence_rule_id
    ) then
      raise exception 'recurrence rule already belongs to a mission series'
        using errcode = '23505';
    end if;
  else
    raise exception 'unsupported recurrence parent table'
      using errcode = '0A000';
  end if;

  return new;
end;
$$;

revoke all on function public.ensure_recurrence_rule_single_parent()
  from public, anon, authenticated;

drop trigger if exists ensure_mission_recurrence_single_parent_trigger
  on public.missions;
create trigger ensure_mission_recurrence_single_parent_trigger
before insert or update of recurrence_rule_id on public.missions
for each row execute function public.ensure_recurrence_rule_single_parent();

drop trigger if exists ensure_meeting_recurrence_single_parent_trigger
  on public.meetings;
create trigger ensure_meeting_recurrence_single_parent_trigger
before insert or update of recurrence_rule_id on public.meetings
for each row execute function public.ensure_recurrence_rule_single_parent();

create or replace function public.generate_mission_recurrence_occurrences(
  p_mission_id uuid,
  p_through_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_mission record;
  v_rule record;
  v_scan_starts_on date;
  v_scan_ends_on date;
  v_existing_count integer;
  v_remaining integer;
  v_created_count integer := 0;
  v_occurrences jsonb := '[]'::jsonb;
  v_exhausted boolean := false;
  v_correlation_id uuid := extensions.gen_random_uuid();
begin
  if v_owner_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if p_mission_id is null or p_through_date is null then
    raise exception 'mission and through date are required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('recurrence-owner:' || v_owner_id::text, 0)
  );

  select mission.id, mission.recurrence_rule_id
    into v_mission
  from public.missions as mission
  where mission.id = p_mission_id
    and mission.owner_id = v_owner_id
  for update;

  if not found then
    raise exception 'mission is missing or not owned by the caller'
      using errcode = 'P0002';
  end if;

  if v_mission.recurrence_rule_id is null then
    raise exception 'mission is not attached to a recurrence rule'
      using errcode = '22023';
  end if;

  select rule.id,
         rule.frequency,
         rule.interval_count,
         rule.interval_unit,
         rule.by_weekdays,
         rule.day_of_month,
         rule.starts_on,
         rule.ends_on,
         rule.maximum_occurrences,
         rule.generation_cursor_date,
         rule.is_active
    into v_rule
  from public.recurrence_rules as rule
  where rule.id = v_mission.recurrence_rule_id
    and rule.owner_id = v_owner_id
  for update;

  if not found then
    raise exception 'recurrence rule is missing or not owned by the caller'
      using errcode = 'P0002';
  end if;

  select pg_catalog.count(*)::integer
    into v_existing_count
  from public.mission_occurrences as occurrence
  where occurrence.owner_id = v_owner_id
    and occurrence.mission_id = p_mission_id;

  if not v_rule.is_active
    or (
      v_rule.maximum_occurrences is not null
      and v_existing_count >= v_rule.maximum_occurrences
    ) then
    return pg_catalog.jsonb_build_object(
      'correlationId', v_correlation_id,
      'createdCount', 0,
      'exhausted', true,
      'generatedThrough', v_rule.generation_cursor_date,
      'missionId', p_mission_id,
      'occurrences', v_occurrences,
      'recurrenceRuleId', v_rule.id
    );
  end if;

  v_scan_starts_on := greatest(
    v_rule.starts_on,
    coalesce(v_rule.generation_cursor_date + 1, v_rule.starts_on)
  );
  v_scan_ends_on := least(
    p_through_date,
    coalesce(v_rule.ends_on, p_through_date)
  );

  if p_through_date < v_scan_starts_on then
    return pg_catalog.jsonb_build_object(
      'correlationId', v_correlation_id,
      'createdCount', 0,
      'exhausted', false,
      'generatedThrough', v_rule.generation_cursor_date,
      'missionId', p_mission_id,
      'occurrences', v_occurrences,
      'recurrenceRuleId', v_rule.id
    );
  end if;

  if v_scan_ends_on < v_scan_starts_on then
    update public.recurrence_rules
    set is_active = false
    where id = v_rule.id
      and owner_id = v_owner_id;

    return pg_catalog.jsonb_build_object(
      'correlationId', v_correlation_id,
      'createdCount', 0,
      'exhausted', true,
      'generatedThrough', v_rule.generation_cursor_date,
      'missionId', p_mission_id,
      'occurrences', v_occurrences,
      'recurrenceRuleId', v_rule.id
    );
  end if;

  if v_scan_ends_on - v_scan_starts_on > 3660 then
    raise exception 'one recurrence generation call may cover at most 3661 days'
      using errcode = '22023';
  end if;

  if v_scan_ends_on >= v_scan_starts_on then
    v_remaining := coalesce(
      v_rule.maximum_occurrences - v_existing_count,
      2147483647
    );

    with candidate_dates as (
      select v_scan_starts_on + series.day_offset as occurrence_date
      from pg_catalog.generate_series(
        0,
        v_scan_ends_on - v_scan_starts_on
      ) as series(day_offset)
      where case v_rule.frequency
        when 'daily' then
          pg_catalog.mod(
            (v_scan_starts_on + series.day_offset) - v_rule.starts_on,
            v_rule.interval_count
          ) = 0
        when 'workdays' then
          extract(dow from (v_scan_starts_on + series.day_offset))::smallint
            between 0 and 4
        when 'weekly' then
          pg_catalog.mod(
            (
              (v_scan_starts_on + series.day_offset)
              - (
                v_rule.starts_on
                - extract(dow from v_rule.starts_on)::integer
              )
            ) / 7,
            v_rule.interval_count
          ) = 0
          and extract(
            dow from (v_scan_starts_on + series.day_offset)
          )::smallint = any(v_rule.by_weekdays)
        when 'monthly' then
          pg_catalog.mod(
            (
              extract(year from (v_scan_starts_on + series.day_offset))::integer
              - extract(year from v_rule.starts_on)::integer
            ) * 12
            + extract(month from (v_scan_starts_on + series.day_offset))::integer
            - extract(month from v_rule.starts_on)::integer,
            v_rule.interval_count
          ) = 0
          and extract(
            day from (v_scan_starts_on + series.day_offset)
          )::smallint = v_rule.day_of_month
        when 'custom' then
          case v_rule.interval_unit
            when 'days' then
              pg_catalog.mod(
                (v_scan_starts_on + series.day_offset) - v_rule.starts_on,
                v_rule.interval_count
              ) = 0
              and (
                v_rule.by_weekdays is null
                or extract(
                  dow from (v_scan_starts_on + series.day_offset)
                )::smallint = any(v_rule.by_weekdays)
              )
            when 'weeks' then
              pg_catalog.mod(
                (
                  (v_scan_starts_on + series.day_offset)
                  - (
                    v_rule.starts_on
                    - extract(dow from v_rule.starts_on)::integer
                  )
                ) / 7,
                v_rule.interval_count
              ) = 0
              and extract(
                dow from (v_scan_starts_on + series.day_offset)
              )::smallint = any(
                coalesce(
                  v_rule.by_weekdays,
                  array[extract(dow from v_rule.starts_on)::smallint]
                )
              )
            when 'months' then
              pg_catalog.mod(
                (
                  extract(
                    year from (v_scan_starts_on + series.day_offset)
                  )::integer
                  - extract(year from v_rule.starts_on)::integer
                ) * 12
                + extract(
                  month from (v_scan_starts_on + series.day_offset)
                )::integer
                - extract(month from v_rule.starts_on)::integer,
                v_rule.interval_count
              ) = 0
              and (
                (
                  v_rule.by_weekdays is null
                  and extract(
                    day from (v_scan_starts_on + series.day_offset)
                  )::integer = extract(day from v_rule.starts_on)::integer
                )
                or (
                  v_rule.by_weekdays is not null
                  and extract(
                    dow from (v_scan_starts_on + series.day_offset)
                  )::smallint = any(v_rule.by_weekdays)
                )
              )
            else false
          end
        else false
      end
      and not exists (
        select 1
        from public.mission_occurrences as existing
        where existing.owner_id = v_owner_id
          and existing.mission_id = p_mission_id
          and existing.occurrence_date = v_scan_starts_on + series.day_offset
      )
      order by occurrence_date
      limit v_remaining
    ), numbered_dates as (
      select candidate.occurrence_date,
             v_existing_count
             + pg_catalog.row_number() over (
               order by candidate.occurrence_date
             )::integer as sequence_number
      from candidate_dates as candidate
    ), inserted as (
      insert into public.mission_occurrences (
        owner_id,
        mission_id,
        recurrence_key,
        occurrence_date,
        sequence_number,
        status,
        is_locked
      )
      select v_owner_id,
             p_mission_id,
             'date:' || numbered.occurrence_date::text,
             numbered.occurrence_date,
             numbered.sequence_number,
             'unscheduled',
             false
      from numbered_dates as numbered
      order by numbered.occurrence_date
      returning id, occurrence_date, recurrence_key, sequence_number
    )
    select pg_catalog.count(*)::integer,
           coalesce(
             pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'id', inserted.id,
                 'occurrenceDate', inserted.occurrence_date,
                 'recurrenceKey', inserted.recurrence_key,
                 'sequenceNumber', inserted.sequence_number
               ) order by inserted.occurrence_date
             ),
             '[]'::jsonb
           )
      into v_created_count, v_occurrences
    from inserted;
  end if;

  v_existing_count := v_existing_count + v_created_count;
  v_exhausted := (
    v_rule.ends_on is not null and v_scan_ends_on >= v_rule.ends_on
  ) or (
    v_rule.maximum_occurrences is not null
    and v_existing_count >= v_rule.maximum_occurrences
  );

  update public.recurrence_rules
  set generation_cursor_date = v_scan_ends_on,
      is_active = not v_exhausted
  where id = v_rule.id
    and owner_id = v_owner_id;

  if v_created_count > 0 then
    insert into public.audit_log (
      owner_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      source_channel,
      after_summary,
      correlation_id
    ) values (
      v_owner_id,
      v_owner_id,
      'recurrence.occurrences.generated',
      'mission',
      p_mission_id,
      'system',
      pg_catalog.jsonb_build_object(
        'createdCount', v_created_count,
        'exhausted', v_exhausted,
        'generatedThrough', v_scan_ends_on,
        'occurrences', v_occurrences,
        'recurrenceRuleId', v_rule.id
      ),
      v_correlation_id
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'correlationId', v_correlation_id,
    'createdCount', v_created_count,
    'exhausted', v_exhausted,
    'generatedThrough', v_scan_ends_on,
    'missionId', p_mission_id,
    'occurrences', v_occurrences,
    'recurrenceRuleId', v_rule.id
  );
end;
$$;

revoke all on function public.generate_mission_recurrence_occurrences(uuid, date)
  from public, anon;

grant execute on function public.generate_mission_recurrence_occurrences(uuid, date)
  to authenticated;
