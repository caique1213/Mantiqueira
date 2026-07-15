-- Faster posture rows for the Analytics page.
-- Avoids posture_map_summary because that view performs expensive lateral calculations
-- for map rendering details that are not needed in the analytics dashboard.

create or replace function public.list_analytics_posture_rows(
  p_posture_number integer default null
)
returns table (
  posture_id uuid,
  posture_number integer,
  posture_name text,
  installed_assets bigint,
  inventory_completeness numeric,
  open_work_orders bigint,
  critical_open_work_orders bigint,
  failure_count bigint,
  recurrent_assets bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  recurrence_count integer := 3;
  recurrence_days integer := 30;
begin
  caller := private.require_active_user();

  if not private.user_has_permission(caller, 'reports.view') then
    raise exception using errcode = '42501', message = 'Sem permissao para consultar analises.';
  end if;

  select
    coalesce((value->>'count')::integer, 3),
    coalesce((value->>'window_days')::integer, 30)
  into recurrence_count, recurrence_days
  from public.app_settings
  where key = 'analytics.recurrence';

  recurrence_count := coalesce(recurrence_count, 3);
  recurrence_days := coalesce(recurrence_days, 30);

  return query
  with accessible_postures as (
    select p.id, p.number, p.name
    from public.postures p
    where p.active
      and private.can_access_site(p.site_id, caller)
      and (p_posture_number is null or p.number = p_posture_number)
  ),
  installed as (
    select
      ap.posture_id,
      count(distinct ai.asset_id)::bigint as installed_assets,
      round(avg(coalesce(ac.completeness_percent, 100)), 1)::numeric as inventory_completeness
    from public.asset_positions ap
    join accessible_postures p on p.id = ap.posture_id
    left join public.asset_installations ai on ai.asset_position_id = ap.id and ai.removed_at is null
    left join public.asset_completeness ac on ac.asset_id = ai.asset_id
    where ap.active
    group by ap.posture_id
  ),
  open_os as (
    select
      wo.posture_id,
      count(*)::bigint as open_work_orders,
      count(*) filter (where pd.code = 'critical')::bigint as critical_open_work_orders
    from public.work_orders wo
    join accessible_postures p on p.id = wo.posture_id
    join public.work_order_status_definitions ws on ws.id = wo.status_id
    join public.priority_definitions pd on pd.id = wo.priority_id
    where not ws.is_terminal
    group by wo.posture_id
  ),
  failures as (
    select
      wo.posture_id,
      count(*)::bigint as failure_count
    from public.work_orders wo
    join accessible_postures p on p.id = wo.posture_id
    join public.work_order_status_definitions ws on ws.id = wo.status_id
    where ws.semantic_state <> 'cancelled'
      and wo.opened_at >= clock_timestamp() - make_interval(days => recurrence_days)
    group by wo.posture_id
  ),
  recurrent as (
    select posture_id, count(*)::bigint as recurrent_assets
    from (
      select wo.posture_id, wo.asset_id
      from public.work_orders wo
      join accessible_postures p on p.id = wo.posture_id
      join public.work_order_status_definitions ws on ws.id = wo.status_id
      where wo.asset_id is not null
        and ws.semantic_state <> 'cancelled'
        and wo.opened_at >= clock_timestamp() - make_interval(days => recurrence_days)
      group by wo.posture_id, wo.asset_id
      having count(*) >= recurrence_count
    ) grouped
    group by posture_id
  )
  select
    p.id as posture_id,
    p.number::integer as posture_number,
    p.name as posture_name,
    coalesce(installed.installed_assets, 0)::bigint as installed_assets,
    coalesce(installed.inventory_completeness, 0)::numeric as inventory_completeness,
    coalesce(open_os.open_work_orders, 0)::bigint as open_work_orders,
    coalesce(open_os.critical_open_work_orders, 0)::bigint as critical_open_work_orders,
    coalesce(failures.failure_count, 0)::bigint as failure_count,
    coalesce(recurrent.recurrent_assets, 0)::bigint as recurrent_assets
  from accessible_postures p
  left join installed on installed.posture_id = p.id
  left join open_os on open_os.posture_id = p.id
  left join failures on failures.posture_id = p.id
  left join recurrent on recurrent.posture_id = p.id
  order by p.number;
end;
$$;

revoke all on function public.list_analytics_posture_rows(integer) from public, anon;
grant execute on function public.list_analytics_posture_rows(integer) to authenticated;
