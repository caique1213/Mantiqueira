-- Faster paginated technical inventory listing.
-- The previous screen queried asset_current_location with exact count.
-- That view calculates completeness and work-order counters for the whole result set,
-- which can timeout once the technical map is populated.

create or replace function public.list_inventory_assets(
  p_page integer default 1,
  p_page_size integer default 18,
  p_asset_type_id uuid default null,
  p_manufacturer_id uuid default null,
  p_posture_number integer default null,
  p_completeness text default 'all',
  p_search text default ''
)
returns table (
  asset_id uuid,
  site_id uuid,
  asset_type_id uuid,
  asset_type_code text,
  asset_type_name text,
  domain text,
  manufacturer_id uuid,
  manufacturer_name text,
  technical_model_id uuid,
  model_name text,
  internal_code text,
  serial_number text,
  status_id uuid,
  status_code text,
  status_name text,
  criticality text,
  installation_id uuid,
  asset_position_id uuid,
  position_code text,
  position_name text,
  posture_id uuid,
  posture_number integer,
  battery_id uuid,
  battery_code text,
  installed_at timestamptz,
  updated_at timestamptz,
  completeness_percent numeric,
  missing_fields text[],
  has_nameplate_photo boolean,
  open_work_orders bigint,
  critical_open_work_orders bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(p_page_size, 18), 1), 60);
  safe_search text := nullif(btrim(regexp_replace(coalesce(p_search, ''), '[,%()]', ' ', 'g')), '');
  safe_completeness text := coalesce(nullif(p_completeness, ''), 'all');
begin
  caller := private.require_active_user();

  if not private.user_has_permission(caller, 'assets.view') then
    raise exception using errcode = '42501', message = 'Sem permissao para consultar o inventario tecnico.';
  end if;

  if safe_completeness not in ('all', 'complete', 'incomplete', 'missing_nameplate') then
    safe_completeness := 'all';
  end if;

  return query
  with base as (
    select
      a.id as asset_id,
      a.site_id,
      a.asset_type_id,
      at.code as asset_type_code,
      at.name as asset_type_name,
      at.domain::text as domain,
      a.manufacturer_id,
      m.name as manufacturer_name,
      a.technical_model_id,
      tm.model as model_name,
      a.internal_code,
      a.serial_number,
      a.status_id,
      ast.code as status_code,
      ast.name as status_name,
      a.criticality::text as criticality,
      ai.id as installation_id,
      ap.id as asset_position_id,
      ap.code as position_code,
      ap.name as position_name,
      ap.posture_id,
      p.number::integer as posture_number,
      ap.battery_id,
      b.code as battery_code,
      ai.installed_at,
      a.updated_at
    from public.assets a
    join public.asset_types at on at.id = a.asset_type_id
    join public.asset_status_definitions ast on ast.id = a.status_id
    join public.asset_installations ai on ai.asset_id = a.id and ai.removed_at is null
    join public.asset_positions ap on ap.id = ai.asset_position_id
    join public.postures p on p.id = ap.posture_id
    left join public.batteries b on b.id = ap.battery_id
    left join public.manufacturers m on m.id = a.manufacturer_id
    left join public.technical_models tm on tm.id = a.technical_model_id
    where a.archived_at is null
      and private.can_access_site(a.site_id, caller)
      and (p_asset_type_id is null or a.asset_type_id = p_asset_type_id)
      and (p_manufacturer_id is null or a.manufacturer_id = p_manufacturer_id)
      and (p_posture_number is null or p.number = p_posture_number)
      and (
        safe_search is null
        or a.internal_code ilike '%' || safe_search || '%'
        or a.serial_number ilike '%' || safe_search || '%'
        or at.name ilike '%' || safe_search || '%'
        or m.name ilike '%' || safe_search || '%'
        or tm.model ilike '%' || safe_search || '%'
        or ap.name ilike '%' || safe_search || '%'
      )
  ),
  scored as (
    select
      base.*,
      case
        when coalesce(sum(rf.weight), 0) = 0 then 100::numeric
        else round(
          100 * sum(case when private.asset_field_present(base.asset_id, rf.field_key) then rf.weight else 0 end)
          / sum(rf.weight),
          1
        )
      end as completeness_percent,
      coalesce(
        array_agg(rf.label order by rf.label)
          filter (where rf.id is not null and not private.asset_field_present(base.asset_id, rf.field_key)),
        array[]::text[]
      ) as missing_fields,
      exists (
        select 1
        from public.asset_media am
        where am.asset_id = base.asset_id
          and am.media_type = 'nameplate'
          and am.archived_at is null
      ) as has_nameplate_photo
    from base
    left join public.asset_type_required_fields rf on rf.asset_type_id = base.asset_type_id and rf.active
    group by
      base.asset_id,
      base.site_id,
      base.asset_type_id,
      base.asset_type_code,
      base.asset_type_name,
      base.domain,
      base.manufacturer_id,
      base.manufacturer_name,
      base.technical_model_id,
      base.model_name,
      base.internal_code,
      base.serial_number,
      base.status_id,
      base.status_code,
      base.status_name,
      base.criticality,
      base.installation_id,
      base.asset_position_id,
      base.position_code,
      base.position_name,
      base.posture_id,
      base.posture_number,
      base.battery_id,
      base.battery_code,
      base.installed_at,
      base.updated_at
  ),
  filtered as (
    select *
    from scored
    where
      safe_completeness = 'all'
      or (safe_completeness = 'complete' and completeness_percent >= 100)
      or (safe_completeness = 'incomplete' and completeness_percent < 100)
      or (safe_completeness = 'missing_nameplate' and has_nameplate_photo = false)
  ),
  counted as (
    select count(*)::bigint as total_count from filtered
  ),
  paged as (
    select *
    from filtered
    order by posture_number asc, battery_code asc nulls first, position_name asc
    offset (safe_page - 1) * safe_page_size
    limit safe_page_size
  )
  select
    paged.asset_id,
    paged.site_id,
    paged.asset_type_id,
    paged.asset_type_code,
    paged.asset_type_name,
    paged.domain,
    paged.manufacturer_id,
    paged.manufacturer_name,
    paged.technical_model_id,
    paged.model_name,
    paged.internal_code,
    paged.serial_number,
    paged.status_id,
    paged.status_code,
    paged.status_name,
    paged.criticality,
    paged.installation_id,
    paged.asset_position_id,
    paged.position_code,
    paged.position_name,
    paged.posture_id,
    paged.posture_number,
    paged.battery_id,
    paged.battery_code,
    paged.installed_at,
    paged.updated_at,
    paged.completeness_percent,
    paged.missing_fields,
    paged.has_nameplate_photo,
    coalesce(open_orders.count, 0)::bigint as open_work_orders,
    coalesce(critical_orders.count, 0)::bigint as critical_open_work_orders,
    counted.total_count
  from paged
  cross join counted
  left join lateral (
    select count(*)::bigint
    from public.work_orders wo
    join public.work_order_status_definitions ws on ws.id = wo.status_id
    where wo.asset_id = paged.asset_id
      and not ws.is_terminal
  ) open_orders on true
  left join lateral (
    select count(*)::bigint
    from public.work_orders wo
    join public.work_order_status_definitions ws on ws.id = wo.status_id
    join public.priority_definitions pd on pd.id = wo.priority_id
    where wo.asset_id = paged.asset_id
      and not ws.is_terminal
      and pd.code = 'critical'
  ) critical_orders on true;
end;
$$;

revoke all on function public.list_inventory_assets(integer, integer, uuid, uuid, integer, text, text) from public, anon;
grant execute on function public.list_inventory_assets(integer, integer, uuid, uuid, integer, text, text) to authenticated;
