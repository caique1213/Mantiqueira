begin;
select plan(10);

select is((select count(*) from public.postures), 48::bigint, 'existem exatamente 48 posturas');
select is((select count(*) from public.posture_layout_slots), 60::bigint, 'a matriz possui 60 slots');
select is((select count(*) from public.posture_layout_slots where posture_id is null), 12::bigint, 'a matriz preserva 12 vazios');
select is((select count(*) from public.batteries), 199::bigint, 'existem exatamente 199 baterias');
select is((select count(*) from public.asset_positions), 1784::bigint, 'posições técnicas padrão foram criadas');
select is((select battery_count from public.postures where number=45), 5::smallint, 'postura 45 possui cinco baterias');
select is((select battery_count from public.postures where number=46), 6::smallint, 'postura 46 possui seis baterias');
select is((select battery_count from public.postures where number=47), 6::smallint, 'postura 47 possui seis baterias');
select is((select battery_count from public.postures where number=48), 6::smallint, 'postura 48 possui seis baterias');
select ok(not exists (
  select 1 from public.posture_layout_slots ls
  left join public.postures p on p.id=ls.posture_id
  where p.number is distinct from private.expected_posture_for_slot(ls.row_number,ls.column_number)
), 'todos os slots correspondem à matriz oficial');

select * from finish();
rollback;
