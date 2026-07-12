-- Non-negotiable physical structure: 48 postures, exact 15x4 map and 199 batteries.

create table public.postures (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  number smallint not null check (number between 1 and 48),
  name text not null,
  battery_count smallint not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, number),
  check (
    (number between 1 and 44 and battery_count = 4) or
    (number = 45 and battery_count = 5) or
    (number between 46 and 48 and battery_count = 6)
  )
);

create table public.posture_layout_slots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  row_number smallint not null check (row_number between 1 and 15),
  column_number smallint not null check (column_number between 1 and 4),
  posture_id uuid references public.postures(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (site_id, row_number, column_number),
  unique (site_id, posture_id)
);

create table public.batteries (
  id uuid primary key default gen_random_uuid(),
  posture_id uuid not null references public.postures(id) on delete restrict,
  ordinal smallint not null check (ordinal between 1 and 6),
  code text not null check (code ~ '^B[1-6]$'),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (posture_id, ordinal),
  unique (posture_id, code)
);

create table public.position_templates (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('battery','posture')),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  name text not null,
  domain text not null check (domain in ('electrical','mechanical','general')),
  default_asset_type_id uuid references public.asset_types(id) on delete restrict,
  system boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0,
  visual_config jsonb not null default '{}'::jsonb check (jsonb_typeof(visual_config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.asset_positions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  posture_id uuid not null references public.postures(id) on delete restrict,
  battery_id uuid references public.batteries(id) on delete restrict,
  template_id uuid references public.position_templates(id) on delete restrict,
  code text not null check (code ~ '^[a-z][a-z0-9_]{2,99}$'),
  name text not null,
  domain text not null check (domain in ('electrical','mechanical','general')),
  asset_type_id uuid references public.asset_types(id) on delete restrict,
  single_occupancy boolean not null default true,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index asset_positions_battery_code_unique
  on public.asset_positions (battery_id, code) where battery_id is not null;
create unique index asset_positions_posture_code_unique
  on public.asset_positions (posture_id, code) where battery_id is null;
create index asset_positions_site_idx on public.asset_positions (site_id, posture_id, battery_id);

create trigger postures_set_updated_at before update on public.postures
for each row execute function private.set_updated_at();
create trigger batteries_set_updated_at before update on public.batteries
for each row execute function private.set_updated_at();
create trigger position_templates_set_updated_at before update on public.position_templates
for each row execute function private.set_updated_at();
create trigger asset_positions_set_updated_at before update on public.asset_positions
for each row execute function private.set_updated_at();

create or replace function private.expected_posture_for_slot(row_no smallint, column_no smallint)
returns smallint
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case
    when column_no = 4 and row_no between 1 and 12 then 13 - row_no
    when column_no = 3 and row_no between 1 and 12 then 25 - row_no
    when column_no = 2 and row_no between 1 and 12 then 37 - row_no
    when column_no = 1 and row_no between 4 and 12 then 49 - row_no
    when column_no = 1 and row_no between 13 and 15 then 61 - row_no
    else null
  end::smallint;
$$;

create or replace function private.validate_layout_slot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  expected smallint;
  actual smallint;
  posture_site uuid;
begin
  expected := private.expected_posture_for_slot(new.row_number, new.column_number);
  if new.posture_id is not null then
    select number, site_id into actual, posture_site
    from public.postures where id = new.posture_id;
    if posture_site is distinct from new.site_id then
      raise exception using errcode = '23514', message = 'A postura e o slot devem pertencer à mesma unidade.';
    end if;
  end if;
  if actual is distinct from expected then
    raise exception using
      errcode = '23514',
      message = format('Slot físico [%s,%s] exige postura %s, recebeu %s.',
        new.row_number, new.column_number, coalesce(expected::text, 'vazio'), coalesce(actual::text, 'vazio'));
  end if;
  return new;
end;
$$;

create trigger posture_layout_validate
before insert or update on public.posture_layout_slots
for each row execute function private.validate_layout_slot();

create or replace function private.validate_battery()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  allowed_count smallint;
begin
  select battery_count into allowed_count from public.postures where id = new.posture_id;
  if allowed_count is null or new.ordinal > allowed_count then
    raise exception using errcode = '23514', message = 'Quantidade de baterias inválida para esta postura.';
  end if;
  if new.code <> 'B' || new.ordinal::text then
    raise exception using errcode = '23514', message = 'Código da bateria deve corresponder à ordem física.';
  end if;
  return new;
end;
$$;

create trigger batteries_validate
before insert or update on public.batteries
for each row execute function private.validate_battery();

create or replace function private.validate_asset_position()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  posture_site uuid;
  battery_posture uuid;
  template_scope text;
begin
  select site_id into posture_site from public.postures where id = new.posture_id;
  if posture_site is distinct from new.site_id then
    raise exception using errcode = '23514', message = 'A posição e a postura devem pertencer à mesma unidade.';
  end if;
  if new.battery_id is not null then
    select posture_id into battery_posture from public.batteries where id = new.battery_id;
    if battery_posture is distinct from new.posture_id then
      raise exception using errcode = '23514', message = 'A bateria não pertence à postura informada.';
    end if;
  end if;
  if new.template_id is not null then
    select scope into template_scope from public.position_templates where id = new.template_id;
    if (template_scope = 'battery') <> (new.battery_id is not null) then
      raise exception using errcode = '23514', message = 'Escopo do template incompatível com a posição.';
    end if;
  end if;
  return new;
end;
$$;

create trigger asset_positions_validate
before insert or update on public.asset_positions
for each row execute function private.validate_asset_position();

create or replace function private.protect_posture()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '23514', message = 'As 48 posturas físicas não podem ser excluídas.';
  end if;
  if new.site_id is distinct from old.site_id or new.number is distinct from old.number or
     new.battery_count is distinct from old.battery_count then
    raise exception using errcode = '23514', message = 'Número, unidade e quantidade de baterias são regras físicas imutáveis.';
  end if;
  return new;
end;
$$;

create trigger postures_protect_physical
before update or delete on public.postures
for each row execute function private.protect_posture();

create or replace function private.protect_layout_slot()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '23514', message = 'Slots vazios e ocupados do mapa físico devem ser preservados.';
  end if;
  if new.site_id is distinct from old.site_id or new.row_number is distinct from old.row_number or
     new.column_number is distinct from old.column_number or new.posture_id is distinct from old.posture_id then
    raise exception using errcode = '23514', message = 'A matriz física oficial não pode ser reorganizada.';
  end if;
  return new;
end;
$$;

create trigger layout_slots_protect_physical
before update or delete on public.posture_layout_slots
for each row execute function private.protect_layout_slot();

create or replace function private.protect_battery()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '23514', message = 'Baterias físicas padrão não podem ser excluídas.';
  end if;
  if new.posture_id is distinct from old.posture_id or new.ordinal is distinct from old.ordinal or
     new.code is distinct from old.code then
    raise exception using errcode = '23514', message = 'A estrutura física da bateria é imutável.';
  end if;
  return new;
end;
$$;

create trigger batteries_protect_physical
before update or delete on public.batteries
for each row execute function private.protect_battery();

create or replace function private.protect_system_position()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  is_system boolean;
begin
  select system into is_system from public.position_templates where id = old.template_id;
  if coalesce(is_system, false) and tg_op = 'DELETE' then
    raise exception using errcode = '23514', message = 'Posições técnicas padrão não podem ser excluídas.';
  end if;
  if coalesce(is_system, false) and tg_op = 'UPDATE' and (
    new.site_id is distinct from old.site_id or new.posture_id is distinct from old.posture_id or
    new.battery_id is distinct from old.battery_id or new.template_id is distinct from old.template_id or
    new.code is distinct from old.code or new.asset_type_id is distinct from old.asset_type_id
  ) then
    raise exception using errcode = '23514', message = 'A identidade de uma posição técnica padrão é imutável.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger asset_positions_protect_system
before update or delete on public.asset_positions
for each row execute function private.protect_system_position();

create or replace function private.seed_physical_structure()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.postures (site_id, number, name, battery_count)
  select
    '22222222-2222-4222-8222-222222222222'::uuid,
    n,
    'Postura ' || lpad(n::text, 2, '0'),
    case when n = 45 then 5 when n between 46 and 48 then 6 else 4 end
  from generate_series(1, 48) n
  on conflict (site_id, number) do nothing;

  insert into public.posture_layout_slots (site_id, row_number, column_number, posture_id)
  select
    '22222222-2222-4222-8222-222222222222'::uuid,
    r::smallint,
    c::smallint,
    p.id
  from generate_series(1, 15) r
  cross join generate_series(1, 4) c
  left join public.postures p
    on p.site_id = '22222222-2222-4222-8222-222222222222'
   and p.number = private.expected_posture_for_slot(r::smallint, c::smallint)
  on conflict (site_id, row_number, column_number) do nothing;

  insert into public.batteries (posture_id, ordinal, code, name)
  select p.id, b::smallint, 'B' || b, 'Bateria B' || b
  from public.postures p
  cross join lateral generate_series(1, p.battery_count) b
  where p.site_id = '22222222-2222-4222-8222-222222222222'
  on conflict (posture_id, ordinal) do nothing;

  insert into public.position_templates
    (id, scope, code, name, domain, default_asset_type_id, system, sort_order, visual_config) values
    ('80000000-0000-4000-8000-000000000001', 'battery', 'motor_elevador', 'Motor Elevador', 'electrical', '60000000-0000-4000-8000-000000000001', true, 10, '{"kind":"motor","zone":"front"}'),
    ('80000000-0000-4000-8000-000000000002', 'battery', 'redutor_elevador', 'Redutor Elevador', 'mechanical', '60000000-0000-4000-8000-000000000002', true, 20, '{"kind":"reducer","zone":"front"}'),
    ('80000000-0000-4000-8000-000000000003', 'battery', 'motor_racao', 'Motor Ração', 'electrical', '60000000-0000-4000-8000-000000000001', true, 30, '{"kind":"motor","zone":"feed_cart"}'),
    ('80000000-0000-4000-8000-000000000004', 'battery', 'redutor_racao', 'Redutor Ração', 'mechanical', '60000000-0000-4000-8000-000000000002', true, 40, '{"kind":"reducer","zone":"feed_cart"}'),
    ('80000000-0000-4000-8000-000000000005', 'battery', 'motor_esteira_branca_superior', 'Motor Esteira Branca Superior', 'electrical', '60000000-0000-4000-8000-000000000001', true, 50, '{"kind":"motor","system":"white_conveyor","group":"upper","drives":3}'),
    ('80000000-0000-4000-8000-000000000006', 'battery', 'motor_esteira_branca_inferior', 'Motor Esteira Branca Inferior', 'electrical', '60000000-0000-4000-8000-000000000001', true, 60, '{"kind":"motor","system":"white_conveyor","group":"lower","drives":3}'),
    ('80000000-0000-4000-8000-000000000007', 'battery', 'motor_esteira_nylon_superior', 'Motor Esteira Nylon Superior', 'electrical', '60000000-0000-4000-8000-000000000001', true, 70, '{"kind":"motor","system":"nylon_conveyor","group":"upper","drives":3}'),
    ('80000000-0000-4000-8000-000000000008', 'battery', 'motor_esteira_nylon_inferior', 'Motor Esteira Nylon Inferior', 'electrical', '60000000-0000-4000-8000-000000000001', true, 80, '{"kind":"motor","system":"nylon_conveyor","group":"lower","drives":3}'),
    ('80000000-0000-4000-8000-000000000009', 'posture', 'motor_esteira_preta', 'Motor Esteira Preta / Transversal', 'electrical', '60000000-0000-4000-8000-000000000001', true, 90, '{"kind":"motor","zone":"back"}'),
    ('80000000-0000-4000-8000-000000000010', 'posture', 'iluminacao', 'Iluminação', 'electrical', '60000000-0000-4000-8000-000000000003', true, 100, '{"kind":"general"}'),
    ('80000000-0000-4000-8000-000000000011', 'posture', 'ventilacao', 'Ventilação', 'electrical', '60000000-0000-4000-8000-000000000004', true, 110, '{"kind":"general"}'),
    ('80000000-0000-4000-8000-000000000012', 'posture', 'exaustor', 'Exaustor', 'electrical', '60000000-0000-4000-8000-000000000005', true, 120, '{"kind":"general"}')
  on conflict (id) do nothing;

  insert into public.asset_positions
    (site_id, posture_id, battery_id, template_id, code, name, domain, asset_type_id)
  select p.site_id, p.id, b.id, t.id, t.code, t.name, t.domain, t.default_asset_type_id
  from public.postures p
  join public.batteries b on b.posture_id = p.id
  cross join public.position_templates t
  where p.site_id = '22222222-2222-4222-8222-222222222222'
    and t.scope = 'battery' and t.system
    and not exists (
      select 1 from public.asset_positions ap where ap.battery_id = b.id and ap.code = t.code
    );

  insert into public.asset_positions
    (site_id, posture_id, battery_id, template_id, code, name, domain, asset_type_id)
  select p.site_id, p.id, null, t.id, t.code, t.name, t.domain, t.default_asset_type_id
  from public.postures p
  cross join public.position_templates t
  where p.site_id = '22222222-2222-4222-8222-222222222222'
    and t.scope = 'posture' and t.system
    and not exists (
      select 1 from public.asset_positions ap
      where ap.posture_id = p.id and ap.battery_id is null and ap.code = t.code
    );
end;
$$;

select private.seed_physical_structure();

create trigger postures_audit after insert or update or delete on public.postures
for each row execute function private.write_audit();
create trigger batteries_audit after insert or update or delete on public.batteries
for each row execute function private.write_audit();
create trigger asset_positions_audit after insert or update or delete on public.asset_positions
for each row execute function private.write_audit();

