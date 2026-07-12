-- Security-invoker read models. They aggregate on the server and still obey RLS.

create or replace function private.asset_field_present(target_asset_id uuid, field_key text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case field_key
    when 'manufacturer_id' then a.manufacturer_id is not null
    when 'technical_model_id' then a.technical_model_id is not null
    when 'serial_number' then nullif(btrim(a.serial_number), '') is not null
    when 'nameplate_photo' then exists (
      select 1 from public.asset_media am
      where am.asset_id=a.id and am.media_type='nameplate' and am.archived_at is null
    )
    when 'general_photo' then exists (
      select 1 from public.asset_media am
      where am.asset_id=a.id and am.media_type='general' and am.archived_at is null
    )
    when 'motor.rated_power' then exists (
      select 1 from public.asset_motor_specs ms where ms.asset_id=a.id
      and (ms.rated_power_kw is not null or ms.rated_power_cv is not null)
    )
    when 'motor.voltage' then exists (
      select 1 from public.asset_motor_specs ms where ms.asset_id=a.id and ms.voltage_v is not null
    )
    when 'motor.current' then exists (
      select 1 from public.asset_motor_specs ms where ms.asset_id=a.id and ms.current_a is not null
    )
    when 'motor.rpm' then exists (
      select 1 from public.asset_motor_specs ms where ms.asset_id=a.id and ms.rpm is not null
    )
    when 'reducer.ratio' then exists (
      select 1 from public.asset_reducer_specs rs where rs.asset_id=a.id and rs.ratio is not null
    )
    when 'reducer.output_rpm' then exists (
      select 1 from public.asset_reducer_specs rs where rs.asset_id=a.id and rs.output_rpm is not null
    )
    else coalesce(a.nameplate_specs -> field_key not in ('null'::jsonb, '""'::jsonb), false)
  end
  from public.assets a where a.id=target_asset_id;
$$;

create view public.asset_completeness
with (security_invoker = true)
as
select
  a.id as asset_id,
  case when coalesce(sum(rf.weight),0)=0 then 100::numeric
    else round(100 * sum(case when private.asset_field_present(a.id,rf.field_key) then rf.weight else 0 end)
      / sum(rf.weight), 1) end as completeness_percent,
  coalesce(array_agg(rf.label order by rf.label)
    filter (where rf.id is not null and not private.asset_field_present(a.id,rf.field_key)), array[]::text[]) as missing_fields
from public.assets a
left join public.asset_type_required_fields rf on rf.asset_type_id=a.asset_type_id and rf.active
where a.archived_at is null
group by a.id;

create view public.asset_current_location
with (security_invoker = true)
as
select
  a.id as asset_id,
  a.site_id,
  a.asset_type_id,
  at.code as asset_type_code,
  at.name as asset_type_name,
  at.domain,
  a.manufacturer_id,
  m.name as manufacturer_name,
  a.technical_model_id,
  tm.model as model_name,
  a.internal_code,
  a.serial_number,
  a.status_id,
  ast.code as status_code,
  ast.name as status_name,
  a.criticality,
  ai.id as installation_id,
  ap.id as asset_position_id,
  ap.code as position_code,
  ap.name as position_name,
  ap.posture_id,
  p.number as posture_number,
  ap.battery_id,
  b.code as battery_code,
  ai.installed_at,
  coalesce(ac.completeness_percent,100)::numeric as completeness_percent,
  exists (select 1 from public.asset_media am where am.asset_id=a.id and am.media_type='nameplate' and am.archived_at is null) as has_nameplate_photo,
  (select count(*) from public.work_orders wo join public.work_order_status_definitions ws on ws.id=wo.status_id
    where wo.asset_id=a.id and not ws.is_terminal) as open_work_orders,
  (select count(*) from public.work_orders wo
    join public.work_order_status_definitions ws on ws.id=wo.status_id
    join public.priority_definitions pd on pd.id=wo.priority_id
    where wo.asset_id=a.id and not ws.is_terminal and pd.code='critical') as critical_open_work_orders,
  a.updated_at
from public.assets a
join public.asset_types at on at.id=a.asset_type_id
join public.asset_status_definitions ast on ast.id=a.status_id
left join public.manufacturers m on m.id=a.manufacturer_id
left join public.technical_models tm on tm.id=a.technical_model_id
join public.asset_installations ai on ai.asset_id=a.id and ai.removed_at is null
join public.asset_positions ap on ap.id=ai.asset_position_id
join public.postures p on p.id=ap.posture_id
left join public.batteries b on b.id=ap.battery_id
left join public.asset_completeness ac on ac.asset_id=a.id
where a.archived_at is null;

create view public.work_order_summary
with (security_invoker = true)
as
select
  wo.id as work_order_id,
  wo.number,
  wo.site_id,
  wo.posture_id,
  p.number as posture_number,
  wo.battery_id,
  b.code as battery_code,
  wo.asset_position_id,
  ap.code as position_code,
  ap.name as position_name,
  wo.asset_id,
  a.internal_code as asset_internal_code,
  m.name as manufacturer_name,
  tm.model as model_name,
  wo.sector_id,
  s.code as sector_code,
  s.name as sector_name,
  wo.status_id,
  ws.code as status_code,
  ws.name as status_name,
  ws.semantic_state,
  ws.is_terminal,
  ws.color as status_color,
  wo.priority_id,
  pd.code as priority_code,
  pd.name as priority_name,
  pd.weight as priority_weight,
  pd.color as priority_color,
  wo.problem_type_id,
  pt.name as problem_type_name,
  wo.description,
  wo.diagnosis,
  wo.root_cause,
  wo.work_performed,
  wo.opened_by,
  coalesce(opener.display_name, 'Usuário') as opened_by_name,
  wo.assigned_to,
  assignee.display_name as assigned_to_name,
  wo.opened_at,
  wo.assigned_at,
  wo.started_at,
  wo.resolved_at,
  wo.cancelled_at,
  wo.due_at,
  (wo.due_at is not null and wo.due_at < clock_timestamp() and not ws.is_terminal) as is_overdue,
  wo.updated_at
from public.work_orders wo
join public.postures p on p.id=wo.posture_id
left join public.batteries b on b.id=wo.battery_id
left join public.asset_positions ap on ap.id=wo.asset_position_id
left join public.assets a on a.id=wo.asset_id
left join public.manufacturers m on m.id=a.manufacturer_id
left join public.technical_models tm on tm.id=a.technical_model_id
join public.sectors s on s.id=wo.sector_id
join public.work_order_status_definitions ws on ws.id=wo.status_id
join public.priority_definitions pd on pd.id=wo.priority_id
left join public.problem_types pt on pt.id=wo.problem_type_id
left join public.profiles opener on opener.id=wo.opened_by
left join public.profiles assignee on assignee.id=wo.assigned_to;

create view public.posture_map_summary
with (security_invoker = true)
as
select
  ls.site_id,
  ls.id as slot_id,
  ls.row_number,
  ls.column_number,
  p.id as posture_id,
  p.number as posture_number,
  p.name as posture_name,
  p.battery_count,
  p.active as posture_active,
  coalesce(inv.total_positions,0)::bigint as total_positions,
  coalesce(inv.installed_assets,0)::bigint as installed_assets,
  coalesce(inv.inventory_completeness,0)::numeric as inventory_completeness,
  coalesce(os.open_work_orders,0)::bigint as open_work_orders,
  coalesce(os.critical_open_work_orders,0)::bigint as critical_open_work_orders,
  os.highest_priority_weight,
  os.latest_work_order_at,
  coalesce(inv.has_missing_nameplate,false) as has_missing_nameplate,
  coalesce(inv.brands,array[]::text[]) as brands,
  coalesce(inv.domains,array[]::text[]) as domains,
  coalesce(fail.failure_count,0)::bigint as failure_count,
  coalesce(fail.recurrent_assets,0)::bigint as recurrent_assets
from public.posture_layout_slots ls
left join public.postures p on p.id=ls.posture_id
left join lateral (
  select
    count(distinct ap.id) as total_positions,
    count(distinct ai.asset_id) as installed_assets,
    round(coalesce(avg(ac.completeness_percent),0),1) as inventory_completeness,
    bool_or(ai.asset_id is not null and not exists (
      select 1 from public.asset_media am where am.asset_id=ai.asset_id
      and am.media_type='nameplate' and am.archived_at is null
    )) as has_missing_nameplate,
    array_agg(distinct mf.name order by mf.name) filter (where mf.name is not null) as brands,
    array_agg(distinct aty.domain order by aty.domain) filter (where aty.domain is not null) as domains
  from public.asset_positions ap
  left join public.asset_installations ai on ai.asset_position_id=ap.id and ai.removed_at is null
  left join public.assets a on a.id=ai.asset_id
  left join public.manufacturers mf on mf.id=a.manufacturer_id
  left join public.asset_types aty on aty.id=a.asset_type_id
  left join public.asset_completeness ac on ac.asset_id=a.id
  where ap.posture_id=p.id and ap.active
) inv on p.id is not null
left join lateral (
  select
    count(*) as open_work_orders,
    count(*) filter (where pd.code='critical') as critical_open_work_orders,
    max(pd.weight) as highest_priority_weight,
    max(wo.opened_at) as latest_work_order_at
  from public.work_orders wo
  join public.work_order_status_definitions ws on ws.id=wo.status_id
  join public.priority_definitions pd on pd.id=wo.priority_id
  where wo.posture_id=p.id and not ws.is_terminal
) os on p.id is not null
left join lateral (
  select
    count(*) as failure_count,
    (select count(*) from (
      select wo2.asset_id
      from public.work_orders wo2
      join public.work_order_status_definitions ws2 on ws2.id=wo2.status_id
      where wo2.posture_id=p.id and wo2.asset_id is not null
        and ws2.semantic_state <> 'cancelled'
        and wo2.opened_at >= clock_timestamp() - make_interval(days => coalesce(
          (select (value->>'window_days')::integer from public.app_settings where key='analytics.recurrence'),30))
      group by wo2.asset_id
      having count(*) >= coalesce(
        (select (value->>'count')::integer from public.app_settings where key='analytics.recurrence'),3)
    ) recurring) as recurrent_assets
  from public.work_orders wo
  join public.work_order_status_definitions wsf on wsf.id=wo.status_id
  where wo.posture_id=p.id
    and wsf.semantic_state <> 'cancelled'
    and wo.opened_at >= clock_timestamp() - make_interval(days => coalesce(
      (select (value->>'window_days')::integer from public.app_settings where key='analytics.recurrence'),30))
) fail on p.id is not null;

create view public.posture_detail
with (security_invoker = true)
as
select
  p.site_id,
  p.id as posture_id,
  p.number as posture_number,
  p.name as posture_name,
  p.battery_count,
  p.active as posture_active,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',b.id,'code',b.code,'ordinal',b.ordinal,'active',b.active,
      'positions',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',ap.id,'code',ap.code,'name',ap.name,'domain',ap.domain,
          'asset_type_id',ap.asset_type_id,'current_asset_id',ai.asset_id,
          'current_installation_id',ai.id
        ) order by pt.sort_order,ap.name)
        from public.asset_positions ap
        left join public.position_templates pt on pt.id=ap.template_id
        left join public.asset_installations ai on ai.asset_position_id=ap.id and ai.removed_at is null
        where ap.battery_id=b.id and ap.active
      ),'[]'::jsonb)
    ) order by b.ordinal)
    from public.batteries b where b.posture_id=p.id and b.active
  ),'[]'::jsonb) as batteries,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',ap.id,'code',ap.code,'name',ap.name,'domain',ap.domain,
      'asset_type_id',ap.asset_type_id,'current_asset_id',ai.asset_id,
      'current_installation_id',ai.id
    ) order by pt.sort_order,ap.name)
    from public.asset_positions ap
    left join public.position_templates pt on pt.id=ap.template_id
    left join public.asset_installations ai on ai.asset_position_id=ap.id and ai.removed_at is null
    where ap.posture_id=p.id and ap.battery_id is null and ap.active
  ),'[]'::jsonb) as general_positions,
  pms.total_positions,
  pms.installed_assets,
  pms.inventory_completeness,
  pms.open_work_orders,
  pms.critical_open_work_orders,
  pms.latest_work_order_at as latest_activity_at
from public.postures p
join public.posture_map_summary pms on pms.posture_id=p.id;

create or replace function public.search_global(
  p_query text,
  p_site_id uuid default null,
  p_limit integer default 30
)
returns table (
  entity_type text,
  entity_id uuid,
  title text,
  subtitle text,
  route text,
  rank real,
  metadata jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  with input as (
    select private.normalized_search(btrim(p_query)) q,
      greatest(1,least(coalesce(p_limit,30),100)) row_limit
  ), candidates (entity_type, entity_id, title, subtitle, route, rank, metadata) as (
    select 'posture'::text, p.id, p.name,
      format('%s baterias',p.battery_count), '/posturas/'||p.number,
      case when private.normalized_search(p.name)=(select q from input) then 1 else .75 end::real,
      jsonb_build_object('posture_number',p.number,'site_id',p.site_id)
    from public.postures p,input
    where (p_site_id is null or p.site_id=p_site_id)
      and private.normalized_search(p.name) like '%'||input.q||'%'
    union all
    select 'battery',b.id,format('Postura %s · %s',p.number,b.code),p.name,
      '/posturas/'||p.number||'?bateria='||b.code,.7::real,
      jsonb_build_object('posture_id',p.id,'posture_number',p.number,'battery_code',b.code)
    from public.batteries b join public.postures p on p.id=b.posture_id,input
    where (p_site_id is null or p.site_id=p_site_id)
      and private.normalized_search(format('postura %s %s',p.number,b.code)) like '%'||input.q||'%'
    union all
    select 'asset',acl.asset_id,
      coalesce(acl.manufacturer_name||' ','')||coalesce(acl.model_name,acl.asset_type_name),
      concat_ws(' · ',acl.internal_code,acl.serial_number,
        case when acl.posture_number is not null then 'Postura '||acl.posture_number end,acl.battery_code),
      '/ativos/'||acl.asset_id,.9::real,
      jsonb_build_object('asset_type',acl.asset_type_code,'manufacturer',acl.manufacturer_name,
        'posture_number',acl.posture_number,'battery_code',acl.battery_code)
    from public.asset_current_location acl,input
    where (p_site_id is null or acl.site_id=p_site_id)
      and private.normalized_search(concat_ws(' ',acl.manufacturer_name,acl.model_name,acl.internal_code,
        acl.serial_number,acl.asset_type_name,acl.position_name,acl.posture_number::text,acl.battery_code))
        like '%'||input.q||'%'
    union all
    select 'technical_model',tm.id,m.name||' '||tm.model,at.name,
      '/inventario/modelos/'||tm.id,.8::real,
      jsonb_build_object('manufacturer',m.name,'asset_type',at.code,'verified',tm.verified)
    from public.technical_models tm
    join public.manufacturers m on m.id=tm.manufacturer_id
    join public.asset_types at on at.id=tm.asset_type_id,input
    where private.normalized_search(m.name||' '||tm.model||' '||at.name) like '%'||input.q||'%'
    union all
    select 'work_order',wos.work_order_id,'OS #'||wos.number,
      concat_ws(' · ','Postura '||wos.posture_number,wos.battery_code,wos.status_name,wos.description),
      '/ordens/'||wos.work_order_id,.95::real,
      jsonb_build_object('number',wos.number,'status',wos.status_code,'priority',wos.priority_code)
    from public.work_order_summary wos,input
    where (p_site_id is null or wos.site_id=p_site_id)
      and private.normalized_search(concat_ws(' ',wos.number::text,wos.posture_number::text,wos.battery_code,
        wos.manufacturer_name,wos.model_name,wos.description,wos.assigned_to_name)) like '%'||input.q||'%'
  )
  select c.* from candidates c,input
  where input.q<>''
  order by c.rank desc,c.title
  limit (select row_limit from input);
$$;

grant select on public.asset_completeness to authenticated;
grant select on public.asset_current_location to authenticated;
grant select on public.work_order_summary to authenticated;
grant select on public.posture_map_summary to authenticated;
grant select on public.posture_detail to authenticated;
grant execute on function public.search_global(text,uuid,integer) to authenticated;
grant execute on function private.asset_field_present(uuid,text) to authenticated;
