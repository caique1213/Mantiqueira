-- People selector and completed work order report by person/period.

create or replace function public.list_work_order_people()
returns table (
  profile_id uuid,
  display_name text,
  sector_name text,
  role_names text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
begin
  caller := private.require_active_user();

  return query
  select
    p.id as profile_id,
    p.display_name,
    coalesce(s.name, 'Geral') as sector_name,
    coalesce(array_remove(array_agg(distinct r.name), null), array[]::text[]) as role_names
  from public.profiles p
  join public.site_memberships sm on sm.profile_id = p.id and sm.active
  left join public.sectors s on s.id = p.primary_sector_id
  left join public.profile_roles pr on pr.profile_id = p.id
  left join public.roles r on r.id = pr.role_id and r.active
  where p.active
    and private.can_access_site(sm.site_id, caller)
  group by p.id, p.display_name, s.name
  order by p.display_name;
end;
$$;

create or replace function public.export_work_order_person_report(
  p_profile_id uuid,
  p_started_from date,
  p_started_to date
)
returns table (
  work_order_id uuid,
  number bigint,
  sector_name text,
  posture_number integer,
  battery_code text,
  position_name text,
  status_name text,
  description text,
  diagnosis text,
  work_performed text,
  opened_by_name text,
  assigned_to_name text,
  executor_name text,
  support_names text,
  started_at timestamptz,
  finished_at timestamptz,
  total_minutes numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target_profile uuid := coalesce(p_profile_id, auth.uid());
  period_start date := coalesce(p_started_from, current_date - 30);
  period_end date := coalesce(p_started_to, current_date);
begin
  caller := private.require_active_user();

  if target_profile is null then
    raise exception using errcode = '22023', message = 'Selecione uma pessoa para exportar.';
  end if;
  if period_end < period_start then
    raise exception using errcode = '22023', message = 'Periodo final nao pode ser menor que o inicial.';
  end if;

  return query
  select
    wos.work_order_id,
    wos.number,
    wos.sector_name,
    wos.posture_number::integer,
    wos.battery_code,
    wos.position_name,
    wos.status_name,
    wos.description,
    wos.diagnosis,
    wos.work_performed,
    wos.opened_by_name,
    wos.assigned_to_name,
    selected.display_name as executor_name,
    coalesce((
      select string_agg(distinct support_profile.display_name, ', ' order by support_profile.display_name)
      from public.work_order_participants wop
      join public.profiles support_profile on support_profile.id = wop.profile_id
      where wop.work_order_id = wos.work_order_id
        and wop.removed_at is null
    ), '') as support_names,
    wos.started_at,
    coalesce(wos.resolved_at, wos.cancelled_at) as finished_at,
    round(extract(epoch from (coalesce(wos.resolved_at, wos.cancelled_at) - wos.started_at)) / 60, 2) as total_minutes
  from public.work_order_summary wos
  join public.profiles selected on selected.id = target_profile
  where wos.started_at is not null
    and coalesce(wos.resolved_at, wos.cancelled_at) is not null
    and wos.started_at >= period_start::timestamptz
    and wos.started_at < (period_end + 1)::timestamptz
    and private.can_user_view_work_order(caller, wos.work_order_id)
    and (
      wos.assigned_to = target_profile
      or exists (
        select 1
        from public.work_order_participants wop
        where wop.work_order_id = wos.work_order_id
          and wop.profile_id = target_profile
          and wop.removed_at is null
      )
    )
  order by wos.started_at, wos.number;
end;
$$;

revoke all on function public.list_work_order_people() from public, anon;
revoke all on function public.export_work_order_person_report(uuid, date, date) from public, anon;
grant execute on function public.list_work_order_people() to authenticated;
grant execute on function public.export_work_order_person_report(uuid, date, date) to authenticated;
