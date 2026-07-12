-- Work orders tied to the real posture, position, installation and physical asset.

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  site_id uuid not null references public.sites(id) on delete restrict,
  posture_id uuid not null references public.postures(id) on delete restrict,
  battery_id uuid references public.batteries(id) on delete restrict,
  asset_position_id uuid references public.asset_positions(id) on delete restrict,
  asset_id uuid references public.assets(id) on delete restrict,
  asset_installation_id uuid references public.asset_installations(id) on delete restrict,
  sector_id uuid not null references public.sectors(id) on delete restrict,
  problem_type_id uuid references public.problem_types(id) on delete restrict,
  priority_id uuid not null references public.priority_definitions(id) on delete restrict,
  status_id uuid not null references public.work_order_status_definitions(id) on delete restrict,
  description text not null check (length(btrim(description)) between 5 and 5000),
  diagnosis text not null default '',
  root_cause text not null default '',
  work_performed text not null default '',
  opened_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default clock_timestamp(),
  assigned_at timestamptz,
  started_at timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  due_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  reopened_count smallint not null default 0 check (reopened_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((assigned_to is null and assigned_at is null) or assigned_to is not null),
  check (started_at is null or started_at >= opened_at),
  check (resolved_at is null or resolved_at >= opened_at),
  check (cancelled_at is null or cancelled_at >= opened_at),
  check (not (resolved_at is not null and cancelled_at is not null))
);

create index work_orders_status_idx on public.work_orders (site_id, status_id, opened_at desc);
create index work_orders_sector_idx on public.work_orders (site_id, sector_id, opened_at desc);
create index work_orders_posture_idx on public.work_orders (posture_id, opened_at desc);
create index work_orders_asset_idx on public.work_orders (asset_id, opened_at desc) where asset_id is not null;
create index work_orders_assigned_idx on public.work_orders (assigned_to, opened_at desc) where assigned_to is not null;
create index work_orders_description_trgm_idx on public.work_orders using gin (description extensions.gin_trgm_ops);

create table public.work_order_assignees (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default clock_timestamp(),
  unassigned_at timestamptz,
  check (unassigned_at is null or unassigned_at > assigned_at)
);

create unique index work_order_current_assignee_unique
  on public.work_order_assignees (work_order_id) where unassigned_at is null;

create table public.work_order_events (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  event_type text not null check (event_type in (
    'opened','assigned','unassigned','started','status_changed','priority_changed',
    'commented','diagnosed','needed_item','resolved','cancelled','reopened','media_added'
  )),
  actor_id uuid references public.profiles(id) on delete set null,
  from_status_id uuid references public.work_order_status_definitions(id) on delete restrict,
  to_status_id uuid references public.work_order_status_definitions(id) on delete restrict,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now()
);

create index work_order_events_timeline_idx
  on public.work_order_events (work_order_id, occurred_at desc);

create table public.work_order_comments (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 5000),
  internal_only boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  edited_at timestamptz
);

create index work_order_comments_timeline_idx
  on public.work_order_comments (work_order_id, created_at);

create table public.work_order_needed_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  description text not null check (length(btrim(description)) between 2 and 300),
  code text,
  manufacturer text,
  estimated_quantity numeric(12,3) not null default 1 check (estimated_quantity > 0),
  unit text not null default 'un',
  notes text not null default '',
  requested_by uuid references public.profiles(id) on delete set null,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.work_order_needed_items is
  'Textual needs for an OS. This table deliberately does not represent warehouse stock.';

create table public.work_order_media (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  media_type text not null check (media_type in ('problem','during','after','document')),
  bucket_id text not null default 'work-order-media' check (bucket_id = 'work-order-media'),
  storage_path text not null unique,
  thumbnail_path text,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 26214400),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  caption text not null default '',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index work_order_media_order_idx on public.work_order_media (work_order_id) where archived_at is null;

create trigger work_orders_set_updated_at before update on public.work_orders
for each row execute function private.set_updated_at();

create or replace function private.validate_work_order_context()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  posture_site uuid;
  battery_posture uuid;
  position_site uuid;
  position_posture uuid;
  position_battery uuid;
  asset_site uuid;
  installation_asset uuid;
  installation_position uuid;
begin
  select site_id into posture_site from public.postures where id = new.posture_id;
  if posture_site is distinct from new.site_id then
    raise exception using errcode = '23514', message = 'Postura e OS devem pertencer à mesma unidade.';
  end if;

  if new.battery_id is not null then
    select posture_id into battery_posture from public.batteries where id = new.battery_id;
    if battery_posture is distinct from new.posture_id then
      raise exception using errcode = '23514', message = 'Bateria não pertence à postura da OS.';
    end if;
  end if;

  if new.asset_position_id is not null then
    select site_id, posture_id, battery_id into position_site, position_posture, position_battery
    from public.asset_positions where id = new.asset_position_id;
    if position_site is distinct from new.site_id or position_posture is distinct from new.posture_id then
      raise exception using errcode = '23514', message = 'Posição não pertence ao local da OS.';
    end if;
    if new.battery_id is distinct from position_battery then
      raise exception using errcode = '23514', message = 'Bateria da OS diverge da posição técnica.';
    end if;
  end if;

  if new.asset_id is not null then
    select site_id into asset_site from public.assets where id = new.asset_id;
    if asset_site is distinct from new.site_id then
      raise exception using errcode = '23514', message = 'Ativo não pertence à unidade da OS.';
    end if;
  end if;

  if new.asset_installation_id is not null then
    select asset_id, asset_position_id into installation_asset, installation_position
    from public.asset_installations where id = new.asset_installation_id;
    if installation_asset is distinct from new.asset_id or installation_position is distinct from new.asset_position_id then
      raise exception using errcode = '23514', message = 'Instalação, ativo e posição da OS são inconsistentes.';
    end if;
  end if;
  return new;
end;
$$;

create trigger work_orders_validate_context
before insert or update of site_id, posture_id, battery_id, asset_position_id, asset_id, asset_installation_id
on public.work_orders
for each row execute function private.validate_work_order_context();

alter table public.asset_installations
  add constraint asset_installations_work_order_fk
  foreign key (work_order_id) references public.work_orders(id) on delete restrict;
alter table public.asset_replacements
  add constraint asset_replacements_work_order_fk
  foreign key (work_order_id) references public.work_orders(id) on delete restrict;
alter table public.asset_events
  add constraint asset_events_work_order_fk
  foreign key (work_order_id) references public.work_orders(id) on delete restrict;

create trigger work_order_events_immutable before update or delete on public.work_order_events
for each row execute function private.prevent_mutation();
create trigger work_order_assignees_history_immutable before delete on public.work_order_assignees
for each row execute function private.prevent_mutation();

create trigger work_orders_audit after insert or update or delete on public.work_orders
for each row execute function private.write_audit();
create trigger work_order_comments_audit after insert or update or delete on public.work_order_comments
for each row execute function private.write_audit();
create trigger work_order_needed_items_audit after insert or update or delete on public.work_order_needed_items
for each row execute function private.write_audit();
create trigger work_order_media_audit after insert or update or delete on public.work_order_media
for each row execute function private.write_audit();

