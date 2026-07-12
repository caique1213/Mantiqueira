-- Technical model library, physical assets and immutable installation history.

create table public.technical_models (
  id uuid primary key default gen_random_uuid(),
  asset_type_id uuid not null references public.asset_types(id) on delete restrict,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  model text not null check (length(btrim(model)) between 1 and 160),
  description text not null default '',
  reference_specs jsonb not null default '{}'::jsonb check (jsonb_typeof(reference_specs) = 'object'),
  source_name text,
  source_url text,
  verified boolean not null default false,
  confidence text not null default 'unverified' check (confidence in ('verified','high','medium','low','unverified')),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index technical_models_identity_unique
  on public.technical_models (asset_type_id, manufacturer_id, lower(model));

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  asset_type_id uuid not null references public.asset_types(id) on delete restrict,
  manufacturer_id uuid references public.manufacturers(id) on delete restrict,
  technical_model_id uuid references public.technical_models(id) on delete set null,
  status_id uuid not null default '62000000-0000-4000-8000-000000000006'
    references public.asset_status_definitions(id) on delete restrict,
  internal_code text,
  serial_number text,
  manufactured_on date,
  criticality text not null default 'medium' check (criticality in ('low','medium','high','critical')),
  nameplate_specs jsonb not null default '{}'::jsonb check (jsonb_typeof(nameplate_specs) = 'object'),
  notes text not null default '',
  data_source text not null default 'unknown'
    check (data_source in ('physical_nameplate','field_measurement','manual','library','unknown')),
  data_reviewed_at timestamptz,
  data_reviewed_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (internal_code is null or length(btrim(internal_code)) between 1 and 80),
  check (serial_number is null or length(btrim(serial_number)) between 1 and 160)
);

create unique index assets_site_internal_code_unique
  on public.assets (site_id, lower(internal_code)) where internal_code is not null and archived_at is null;
create index assets_type_idx on public.assets (site_id, asset_type_id) where archived_at is null;
create index assets_manufacturer_idx on public.assets (manufacturer_id) where archived_at is null;
create index assets_serial_trgm_idx on public.assets using gin (serial_number extensions.gin_trgm_ops);

create table public.asset_motor_specs (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  rated_power_kw numeric(12,4) check (rated_power_kw is null or rated_power_kw > 0),
  rated_power_cv numeric(12,4) check (rated_power_cv is null or rated_power_cv > 0),
  voltage_v integer[] check (voltage_v is null or cardinality(voltage_v) between 1 and 8),
  current_a numeric(12,4)[] check (current_a is null or cardinality(current_a) between 1 and 8),
  frequency_hz numeric(8,2) check (frequency_hz is null or frequency_hz > 0),
  rpm integer check (rpm is null or rpm > 0),
  poles smallint check (poles is null or poles between 2 and 48),
  connection text,
  frame text,
  ip_rating text,
  insulation_class text,
  efficiency_percent numeric(6,3) check (efficiency_percent is null or efficiency_percent between 0 and 100),
  power_factor numeric(5,4) check (power_factor is null or power_factor between 0 and 1),
  duty text,
  bearing_de text,
  bearing_nde text,
  updated_at timestamptz not null default now()
);

create table public.asset_reducer_specs (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  reducer_type text,
  ratio numeric(14,6) check (ratio is null or ratio > 0),
  input_rpm numeric(12,3) check (input_rpm is null or input_rpm > 0),
  output_rpm numeric(12,3) check (output_rpm is null or output_rpm > 0),
  torque_nm numeric(14,3) check (torque_nm is null or torque_nm >= 0),
  mounting_position text,
  oil_type text,
  oil_quantity_l numeric(10,3) check (oil_quantity_l is null or oil_quantity_l >= 0),
  output_shaft text,
  updated_at timestamptz not null default now()
);

create table public.asset_type_required_fields (
  id uuid primary key default gen_random_uuid(),
  asset_type_id uuid not null references public.asset_types(id) on delete cascade,
  field_key text not null,
  label text not null,
  weight numeric(7,4) not null check (weight > 0),
  active boolean not null default true,
  unique (asset_type_id, field_key)
);

create table public.asset_installations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  asset_position_id uuid not null references public.asset_positions(id) on delete restrict,
  installed_at timestamptz not null,
  removed_at timestamptz,
  installation_reason text not null default '',
  removal_reason text,
  work_order_id uuid,
  installed_by uuid references public.profiles(id) on delete set null,
  removed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (removed_at is null or removed_at > installed_at),
  check ((removed_at is null and removal_reason is null and removed_by is null) or removed_at is not null)
);

alter table public.asset_installations
  add constraint asset_installations_asset_no_overlap
  exclude using gist (
    asset_id with =,
    tstzrange(installed_at, coalesce(removed_at, 'infinity'::timestamptz), '[)') with &&
  );

alter table public.asset_installations
  add constraint asset_installations_position_no_overlap
  exclude using gist (
    asset_position_id with =,
    tstzrange(installed_at, coalesce(removed_at, 'infinity'::timestamptz), '[)') with &&
  );

create unique index asset_installations_active_asset
  on public.asset_installations (asset_id) where removed_at is null;
create unique index asset_installations_active_position
  on public.asset_installations (asset_position_id) where removed_at is null;
create index asset_installations_history_idx
  on public.asset_installations (asset_position_id, installed_at desc);

create table public.asset_relationships (
  id uuid primary key default gen_random_uuid(),
  parent_asset_id uuid not null references public.assets(id) on delete restrict,
  child_asset_id uuid not null references public.assets(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('motor_reducer','drives','paired_with','part_of')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (parent_asset_id <> child_asset_id),
  check (ended_at is null or ended_at > started_at)
);

create unique index asset_relationships_current_unique
  on public.asset_relationships (parent_asset_id, child_asset_id, relationship_type)
  where ended_at is null;

create table public.asset_replacements (
  id uuid primary key default gen_random_uuid(),
  asset_position_id uuid not null references public.asset_positions(id) on delete restrict,
  removed_installation_id uuid not null references public.asset_installations(id) on delete restrict,
  installed_installation_id uuid not null references public.asset_installations(id) on delete restrict,
  replaced_at timestamptz not null,
  reason text not null check (length(btrim(reason)) >= 3),
  notes text not null default '',
  work_order_id uuid,
  performed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (removed_installation_id <> installed_installation_id),
  unique (removed_installation_id),
  unique (installed_installation_id)
);

create table public.asset_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  installation_id uuid references public.asset_installations(id) on delete restrict,
  event_type text not null check (event_type in (
    'created','updated','installed','removed','replaced','maintenance','work_order','archived','reviewed'
  )),
  occurred_at timestamptz not null default clock_timestamp(),
  work_order_id uuid,
  actor_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index asset_events_timeline_idx on public.asset_events (asset_id, occurred_at desc);

create table public.asset_media (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  media_type text not null check (media_type in ('general','nameplate','before','after','document')),
  bucket_id text not null default 'asset-media' check (bucket_id = 'asset-media'),
  storage_path text not null unique,
  thumbnail_path text,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 26214400),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  caption text not null default '',
  taken_at timestamptz,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index asset_media_asset_idx on public.asset_media (asset_id, media_type) where archived_at is null;

create trigger technical_models_set_updated_at before update on public.technical_models
for each row execute function private.set_updated_at();
create trigger assets_set_updated_at before update on public.assets
for each row execute function private.set_updated_at();
create trigger asset_motor_specs_set_updated_at before update on public.asset_motor_specs
for each row execute function private.set_updated_at();
create trigger asset_reducer_specs_set_updated_at before update on public.asset_reducer_specs
for each row execute function private.set_updated_at();

create or replace function private.validate_asset_model()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  model_type uuid;
  model_manufacturer uuid;
begin
  if new.technical_model_id is not null then
    select asset_type_id, manufacturer_id into model_type, model_manufacturer
    from public.technical_models where id = new.technical_model_id;
    if model_type is distinct from new.asset_type_id then
      raise exception using errcode = '23514', message = 'Modelo técnico incompatível com o tipo do ativo.';
    end if;
    if new.manufacturer_id is not null and new.manufacturer_id is distinct from model_manufacturer then
      raise exception using errcode = '23514', message = 'O fabricante do ativo diverge do modelo técnico selecionado.';
    end if;
    if new.manufacturer_id is null then
      new.manufacturer_id := model_manufacturer;
    end if;
  end if;
  return new;
end;
$$;

create trigger assets_validate_model
before insert or update of technical_model_id, asset_type_id, manufacturer_id on public.assets
for each row execute function private.validate_asset_model();

create or replace function private.validate_installation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  asset_site uuid;
  asset_type uuid;
  position_site uuid;
  position_type uuid;
  single_slot boolean;
begin
  select site_id, asset_type_id into asset_site, asset_type from public.assets where id = new.asset_id;
  select site_id, asset_type_id, single_occupancy into position_site, position_type, single_slot
  from public.asset_positions where id = new.asset_position_id;
  if asset_site is distinct from position_site then
    raise exception using errcode = '23514', message = 'Ativo e posição devem pertencer à mesma unidade.';
  end if;
  if position_type is not null and position_type is distinct from asset_type then
    raise exception using errcode = '23514', message = 'Tipo do ativo incompatível com a posição técnica.';
  end if;
  if not single_slot then
    raise exception using errcode = '0A000', message = 'Posições multiocupação ainda não são suportadas por este fluxo.';
  end if;
  return new;
end;
$$;

create trigger asset_installations_validate
before insert or update on public.asset_installations
for each row execute function private.validate_installation();

create or replace function private.validate_asset_specific_specs()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  type_code text;
begin
  select t.code into type_code from public.assets a
  join public.asset_types t on t.id = a.asset_type_id where a.id = new.asset_id;
  if tg_table_name = 'asset_motor_specs' and type_code <> 'motor' then
    raise exception using errcode = '23514', message = 'Especificação de motor exige ativo do tipo motor.';
  end if;
  if tg_table_name = 'asset_reducer_specs' and type_code <> 'reducer' then
    raise exception using errcode = '23514', message = 'Especificação de redutor exige ativo do tipo redutor.';
  end if;
  return new;
end;
$$;

create trigger asset_motor_specs_validate before insert or update on public.asset_motor_specs
for each row execute function private.validate_asset_specific_specs();
create trigger asset_reducer_specs_validate before insert or update on public.asset_reducer_specs
for each row execute function private.validate_asset_specific_specs();

insert into public.asset_type_required_fields (asset_type_id, field_key, label, weight) values
  ('60000000-0000-4000-8000-000000000001', 'manufacturer_id', 'Fabricante', 1),
  ('60000000-0000-4000-8000-000000000001', 'technical_model_id', 'Modelo', 1),
  ('60000000-0000-4000-8000-000000000001', 'serial_number', 'Número de série', 1),
  ('60000000-0000-4000-8000-000000000001', 'nameplate_photo', 'Foto da placa', 2),
  ('60000000-0000-4000-8000-000000000001', 'motor.rated_power', 'Potência', 1),
  ('60000000-0000-4000-8000-000000000001', 'motor.voltage', 'Tensão', 1),
  ('60000000-0000-4000-8000-000000000001', 'motor.current', 'Corrente', 1),
  ('60000000-0000-4000-8000-000000000001', 'motor.rpm', 'RPM', 1),
  ('60000000-0000-4000-8000-000000000002', 'manufacturer_id', 'Fabricante', 1),
  ('60000000-0000-4000-8000-000000000002', 'technical_model_id', 'Modelo', 1),
  ('60000000-0000-4000-8000-000000000002', 'serial_number', 'Número de série', 1),
  ('60000000-0000-4000-8000-000000000002', 'nameplate_photo', 'Foto da placa', 2),
  ('60000000-0000-4000-8000-000000000002', 'reducer.ratio', 'Relação', 1),
  ('60000000-0000-4000-8000-000000000002', 'reducer.output_rpm', 'RPM de saída', 1)
on conflict (asset_type_id, field_key) do nothing;

create trigger asset_events_immutable
before update or delete on public.asset_events
for each row execute function private.prevent_mutation();
create trigger asset_replacements_immutable
before update or delete on public.asset_replacements
for each row execute function private.prevent_mutation();

create trigger technical_models_audit after insert or update or delete on public.technical_models
for each row execute function private.write_audit();
create trigger assets_audit after insert or update or delete on public.assets
for each row execute function private.write_audit();
create trigger installations_audit after insert or update or delete on public.asset_installations
for each row execute function private.write_audit();
create trigger relationships_audit after insert or update or delete on public.asset_relationships
for each row execute function private.write_audit();
create trigger asset_media_audit after insert or update or delete on public.asset_media
for each row execute function private.write_audit();
