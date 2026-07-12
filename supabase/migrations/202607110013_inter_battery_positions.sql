-- Adds posture-level OS locations for side and inter-battery areas.
-- These are not installed assets. They let operators open an OS on places such
-- as "Lateral da B1" or "Entre B2 e B3" without inventing a motor/redutor.

insert into public.position_templates
  (id, scope, code, name, domain, default_asset_type_id, system, sort_order, visual_config)
values
  (
    '80000000-0000-4000-8000-000000000013',
    'posture',
    'area_lateral_primeira_bateria',
    'Lateral da primeira bateria',
    'general',
    null,
    true,
    130,
    '{"kind":"area","zone":"side","side":"first"}'
  ),
  (
    '80000000-0000-4000-8000-000000000014',
    'posture',
    'area_entre_baterias',
    'Entre baterias',
    'general',
    null,
    true,
    140,
    '{"kind":"area","zone":"between_batteries"}'
  ),
  (
    '80000000-0000-4000-8000-000000000015',
    'posture',
    'area_lateral_ultima_bateria',
    'Lateral da última bateria',
    'general',
    null,
    true,
    150,
    '{"kind":"area","zone":"side","side":"last"}'
  )
on conflict (id) do nothing;

insert into public.asset_positions
  (site_id, posture_id, battery_id, template_id, code, name, domain, asset_type_id, single_occupancy, metadata)
select
  p.site_id,
  p.id,
  null,
  '80000000-0000-4000-8000-000000000013'::uuid,
  'area_00_lateral_b1',
  'Lateral da B1',
  'general',
  null,
  false,
  jsonb_build_object(
    'kind', 'area',
    'zone', 'side',
    'side', 'first',
    'battery_before', null,
    'battery_after', 'B1',
    'physical_order', 0
  )
from public.postures p
where p.active
  and not exists (
    select 1
    from public.asset_positions ap
    where ap.posture_id = p.id
      and ap.battery_id is null
      and ap.code = 'area_00_lateral_b1'
  );

insert into public.asset_positions
  (site_id, posture_id, battery_id, template_id, code, name, domain, asset_type_id, single_occupancy, metadata)
select
  p.site_id,
  p.id,
  null,
  '80000000-0000-4000-8000-000000000014'::uuid,
  'area_' || lpad(n::text, 2, '0') || '_entre_b' || n || '_b' || (n + 1),
  'Entre B' || n || ' e B' || (n + 1),
  'general',
  null,
  false,
  jsonb_build_object(
    'kind', 'area',
    'zone', 'between_batteries',
    'battery_before', 'B' || n,
    'battery_after', 'B' || (n + 1),
    'physical_order', n
  )
from public.postures p
cross join lateral generate_series(1, p.battery_count - 1) n
where p.active
  and not exists (
    select 1
    from public.asset_positions ap
    where ap.posture_id = p.id
      and ap.battery_id is null
      and ap.code = 'area_' || lpad(n::text, 2, '0') || '_entre_b' || n || '_b' || (n + 1)
  );

insert into public.asset_positions
  (site_id, posture_id, battery_id, template_id, code, name, domain, asset_type_id, single_occupancy, metadata)
select
  p.site_id,
  p.id,
  null,
  '80000000-0000-4000-8000-000000000015'::uuid,
  'area_' || lpad(p.battery_count::text, 2, '0') || '_lateral_b' || p.battery_count,
  'Lateral da B' || p.battery_count,
  'general',
  null,
  false,
  jsonb_build_object(
    'kind', 'area',
    'zone', 'side',
    'side', 'last',
    'battery_before', 'B' || p.battery_count,
    'battery_after', null,
    'physical_order', p.battery_count
  )
from public.postures p
where p.active
  and not exists (
    select 1
    from public.asset_positions ap
    where ap.posture_id = p.id
      and ap.battery_id is null
      and ap.code = 'area_' || lpad(p.battery_count::text, 2, '0') || '_lateral_b' || p.battery_count
  );
