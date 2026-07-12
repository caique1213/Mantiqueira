-- Configurable technical and work-order reference catalogs.

create table public.asset_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  name text not null check (length(btrim(name)) between 2 and 100),
  domain text not null check (domain in ('electrical','mechanical','general')),
  icon text not null default 'box',
  system boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  normalized_name text not null unique,
  website text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.asset_status_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.-]{1,49}$'),
  name text not null,
  semantic_state text not null check (semantic_state in (
    'active','inactive','removed','maintenance','reserve','to_verify'
  )),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'circle',
  system boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_order_status_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.-]{1,49}$'),
  name text not null,
  semantic_state text not null check (semantic_state in (
    'awaiting','in_progress','waiting_part','resolved','cancelled'
  )),
  is_terminal boolean generated always as (semantic_state in ('resolved','cancelled')) stored,
  allows_operational_actions boolean not null default true,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'circle',
  system boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_system_work_order_state
  on public.work_order_status_definitions (semantic_state)
  where system;

create table public.priority_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.-]{1,49}$'),
  name text not null,
  weight smallint not null check (weight between 0 and 1000),
  sla_minutes integer check (sla_minutes is null or sla_minutes > 0),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'flag',
  system boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.problem_types (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid references public.sectors(id) on delete restrict,
  code text not null unique check (code ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  name text not null,
  description text not null default '',
  active boolean not null default true,
  system boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger asset_types_set_updated_at before update on public.asset_types
for each row execute function private.set_updated_at();
create trigger manufacturers_set_updated_at before update on public.manufacturers
for each row execute function private.set_updated_at();
create trigger asset_status_set_updated_at before update on public.asset_status_definitions
for each row execute function private.set_updated_at();
create trigger work_order_status_set_updated_at before update on public.work_order_status_definitions
for each row execute function private.set_updated_at();
create trigger priorities_set_updated_at before update on public.priority_definitions
for each row execute function private.set_updated_at();
create trigger problem_types_set_updated_at before update on public.problem_types
for each row execute function private.set_updated_at();

create or replace function private.protect_semantic_catalogs()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' and old.system then
    raise exception using errcode = '23514', message = 'Definições de sistema não podem ser excluídas.';
  end if;
  if tg_op = 'UPDATE' and old.system and (
    new.code is distinct from old.code or
    new.semantic_state is distinct from old.semantic_state or
    new.system is distinct from old.system or
    not new.active
  ) then
    raise exception using errcode = '23514', message = 'A semântica de uma definição de sistema não pode ser alterada ou desativada.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger work_order_status_protect_semantics
before update or delete on public.work_order_status_definitions
for each row execute function private.protect_semantic_catalogs();
create trigger asset_status_protect_semantics
before update or delete on public.asset_status_definitions
for each row execute function private.protect_semantic_catalogs();

create or replace function private.seed_reference_catalogs()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.asset_types (id, code, name, domain, icon, system, sort_order) values
    ('60000000-0000-4000-8000-000000000001', 'motor', 'Motor', 'electrical', 'circle-dot', true, 10),
    ('60000000-0000-4000-8000-000000000002', 'reducer', 'Redutor', 'mechanical', 'settings-2', true, 20),
    ('60000000-0000-4000-8000-000000000003', 'lighting', 'Iluminação', 'electrical', 'lightbulb', true, 30),
    ('60000000-0000-4000-8000-000000000004', 'ventilation', 'Ventilação', 'electrical', 'fan', true, 40),
    ('60000000-0000-4000-8000-000000000005', 'exhaust_fan', 'Exaustor', 'electrical', 'wind', true, 50),
    ('60000000-0000-4000-8000-000000000006', 'sensor', 'Sensor', 'electrical', 'radio', true, 60),
    ('60000000-0000-4000-8000-000000000007', 'panel', 'Painel elétrico', 'electrical', 'panel-top', true, 70),
    ('60000000-0000-4000-8000-000000000008', 'conveyor', 'Esteira / sistema transportador', 'mechanical', 'move-horizontal', true, 80),
    ('60000000-0000-4000-8000-000000000009', 'other', 'Outro ativo', 'general', 'box', true, 999)
  on conflict (id) do nothing;

  insert into public.manufacturers (id, name, normalized_name) values
    ('61000000-0000-4000-8000-000000000001', 'WEG', 'weg'),
    ('61000000-0000-4000-8000-000000000002', 'NORD', 'nord'),
    ('61000000-0000-4000-8000-000000000003', 'SEW-EURODRIVE', 'sew-eurodrive'),
    ('61000000-0000-4000-8000-000000000004', 'PUJOL', 'pujol'),
    ('61000000-0000-4000-8000-000000000005', 'K.H. WITTE', 'k-h-witte'),
    ('61000000-0000-4000-8000-000000000006', 'DESCONHECIDO', 'desconhecido')
  on conflict (id) do nothing;

  insert into public.asset_status_definitions
    (id, code, name, semantic_state, color, icon, system, sort_order) values
    ('62000000-0000-4000-8000-000000000001', 'active', 'Ativo', 'active', '#22C55E', 'circle-check', true, 10),
    ('62000000-0000-4000-8000-000000000002', 'inactive', 'Inativo', 'inactive', '#64748B', 'circle-pause', true, 20),
    ('62000000-0000-4000-8000-000000000003', 'removed', 'Removido', 'removed', '#A16207', 'package-minus', true, 30),
    ('62000000-0000-4000-8000-000000000004', 'maintenance', 'Em manutenção', 'maintenance', '#3B82F6', 'wrench', true, 40),
    ('62000000-0000-4000-8000-000000000005', 'reserve', 'Reserva', 'reserve', '#8B5CF6', 'archive', true, 50),
    ('62000000-0000-4000-8000-000000000006', 'to_verify', 'A verificar', 'to_verify', '#F59E0B', 'circle-help', true, 60)
  on conflict (id) do nothing;

  insert into public.work_order_status_definitions
    (id, code, name, semantic_state, allows_operational_actions, color, icon, system, sort_order) values
    ('63000000-0000-4000-8000-000000000001', 'awaiting', 'Aguardando atendimento', 'awaiting', true, '#F6B900', 'clock-3', true, 10),
    ('63000000-0000-4000-8000-000000000002', 'in_progress', 'Em execução', 'in_progress', true, '#3B82F6', 'play-circle', true, 20),
    ('63000000-0000-4000-8000-000000000003', 'waiting_part', 'Aguardando peça', 'waiting_part', true, '#F97316', 'package-search', true, 30),
    ('63000000-0000-4000-8000-000000000004', 'resolved', 'Resolvida', 'resolved', false, '#22C55E', 'circle-check-big', true, 40),
    ('63000000-0000-4000-8000-000000000005', 'cancelled', 'Cancelada', 'cancelled', false, '#64748B', 'circle-x', true, 50)
  on conflict (id) do nothing;

  insert into public.priority_definitions
    (id, code, name, weight, sla_minutes, color, icon, system, sort_order) values
    ('64000000-0000-4000-8000-000000000001', 'low', 'Baixa', 10, null, '#64748B', 'flag', true, 10),
    ('64000000-0000-4000-8000-000000000002', 'normal', 'Normal', 30, null, '#3B82F6', 'flag', true, 20),
    ('64000000-0000-4000-8000-000000000003', 'high', 'Alta', 70, 240, '#F59E0B', 'flag', true, 30),
    ('64000000-0000-4000-8000-000000000004', 'critical', 'Crítica', 100, 60, '#EF4444', 'siren', true, 40)
  on conflict (id) do nothing;

  insert into public.problem_types (id, sector_id, code, name, system, sort_order) values
    ('65000000-0000-4000-8000-000000000001', null, 'nylon_conveyor', 'Esteira de nylon', true, 10),
    ('65000000-0000-4000-8000-000000000002', null, 'white_conveyor', 'Esteira branca', true, 20),
    ('65000000-0000-4000-8000-000000000003', null, 'elevator', 'Elevador', true, 30),
    ('65000000-0000-4000-8000-000000000004', null, 'feed', 'Ração', true, 40),
    ('65000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000002', 'lighting', 'Iluminação', true, 50),
    ('65000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000002', 'motor', 'Motor', true, 60),
    ('65000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000003', 'reducer', 'Redutor', true, 70),
    ('65000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000002', 'sensor', 'Sensor', true, 80),
    ('65000000-0000-4000-8000-000000000009', null, 'other', 'Outros', true, 999)
  on conflict (id) do nothing;
end;
$$;

select private.seed_reference_catalogs();

create trigger asset_types_audit after insert or update or delete on public.asset_types
for each row execute function private.write_audit();
create trigger manufacturers_audit after insert or update or delete on public.manufacturers
for each row execute function private.write_audit();
create trigger work_order_status_audit after insert or update or delete on public.work_order_status_definitions
for each row execute function private.write_audit();
create trigger priorities_audit after insert or update or delete on public.priority_definitions
for each row execute function private.write_audit();
create trigger problem_types_audit after insert or update or delete on public.problem_types
for each row execute function private.write_audit();

