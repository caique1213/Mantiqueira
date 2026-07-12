-- Notification events, acknowledgement, sounds, favorites and report exports.

create table public.sound_presets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_-]{2,49}$'),
  name text not null,
  audio_key text not null unique,
  system boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  sound_enabled boolean not null default true,
  sound_preset_id uuid references public.sound_presets(id) on delete set null,
  volume numeric(4,3) not null default 0.7 check (volume between 0 and 1),
  speech_enabled boolean not null default false,
  repeat_count smallint not null default 1 check (repeat_count between 0 and 5),
  quiet_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(quiet_hours) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  event_type text not null check (event_type in (
    'new_work_order','critical_work_order','assigned_work_order','waiting_part',
    'reopened_work_order','recurring_failure','system'
  )),
  work_order_id uuid references public.work_orders(id) on delete restrict,
  source_work_order_event_id uuid unique references public.work_order_events(id) on delete restrict,
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default clock_timestamp()
);

create table public.notification_receipts (
  notification_event_id uuid not null references public.notification_events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz,
  acknowledged_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (notification_event_id, profile_id),
  check (acknowledged_at is null or read_at is not null)
);

create index notification_receipts_unread_idx
  on public.notification_receipts (profile_id, created_at desc) where read_at is null;

create table public.favorites (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('posture','battery','asset','work_order','technical_model')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, entity_type, entity_id)
);

create table public.report_exports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  report_type text not null,
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  status text not null default 'queued' check (status in ('queued','processing','ready','failed','expired')),
  bucket_id text check (bucket_id is null or bucket_id = 'report-exports'),
  storage_path text unique,
  error_message text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function private.set_updated_at();
create trigger report_exports_set_updated_at before update on public.report_exports
for each row execute function private.set_updated_at();

create or replace function private.seed_notification_reference()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.sound_presets (id, key, name, audio_key, system, sort_order) values
    ('90000000-0000-4000-8000-000000000001', 'industrial_bell', 'Campainha industrial', 'industrial-bell', true, 10),
    ('90000000-0000-4000-8000-000000000002', 'short_siren', 'Sirene curta', 'short-siren', true, 20),
    ('90000000-0000-4000-8000-000000000003', 'metal_chime', 'Sinal metálico', 'metal-chime', true, 30),
    ('90000000-0000-4000-8000-000000000004', 'soft_alert', 'Alerta suave', 'soft-alert', true, 40),
    ('90000000-0000-4000-8000-000000000005', 'critical_alarm', 'Alarme crítico', 'critical-alarm', true, 50)
  on conflict (id) do nothing;

  insert into public.notification_preferences (profile_id, sound_preset_id)
  select p.id, '90000000-0000-4000-8000-000000000001'::uuid
  from public.profiles p
  on conflict (profile_id) do nothing;
end;
$$;

select private.seed_notification_reference();

create or replace function private.create_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.notification_preferences (profile_id, sound_preset_id)
  values (new.id, '90000000-0000-4000-8000-000000000001')
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

create trigger profiles_create_notification_preferences
after insert on public.profiles
for each row execute function private.create_notification_preferences();

create or replace function private.can_user_view_work_order(user_id uuid, order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.is_active_user(user_id) and exists (
    select 1
    from public.work_orders wo
    join public.sectors s on s.id = wo.sector_id
    where wo.id = order_id
      and private.can_access_site(wo.site_id, user_id)
      and (
        private.user_has_permission(user_id, 'work_orders.view.all')
        or (s.code = 'eletrica' and private.user_has_permission(user_id, 'work_orders.view.electrical'))
        or (s.code = 'mecanica' and private.user_has_permission(user_id, 'work_orders.view.mechanical'))
        or (
          private.user_has_permission(user_id, 'work_orders.view.own')
          and (wo.opened_by = user_id or wo.assigned_to = user_id)
        )
      )
  );
$$;

create or replace function private.capture_work_order_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  wo public.work_orders%rowtype;
  priority_code text;
  target_state text;
  notification_type text;
  notification_title text;
  notification_message text;
  notification_id uuid;
begin
  if new.event_type not in ('opened','assigned','status_changed','reopened') then
    return new;
  end if;

  select * into wo from public.work_orders where id = new.work_order_id;
  select code into priority_code from public.priority_definitions where id = wo.priority_id;
  if new.to_status_id is not null then
    select semantic_state into target_state
    from public.work_order_status_definitions where id = new.to_status_id;
  end if;

  if new.event_type = 'opened' then
    notification_type := case when priority_code = 'critical' then 'critical_work_order' else 'new_work_order' end;
    notification_title := case when priority_code = 'critical' then 'Nova OS crítica' else 'Nova ordem de serviço' end;
    notification_message := format('OS #%s aberta na Postura %s.', wo.number,
      (select number from public.postures where id = wo.posture_id));
  elsif new.event_type = 'assigned' then
    notification_type := 'assigned_work_order';
    notification_title := 'OS atribuída';
    notification_message := format('A OS #%s foi atribuída.', wo.number);
  elsif new.event_type = 'reopened' then
    notification_type := 'reopened_work_order';
    notification_title := 'OS reaberta';
    notification_message := format('A OS #%s foi reaberta.', wo.number);
  elsif new.event_type = 'status_changed' and target_state = 'waiting_part' then
    notification_type := 'waiting_part';
    notification_title := 'OS aguardando peça';
    notification_message := format('A OS #%s está aguardando peça.', wo.number);
  else
    return new;
  end if;

  insert into public.notification_events (
    site_id, event_type, work_order_id, source_work_order_event_id, title, message, payload
  ) values (
    wo.site_id, notification_type, wo.id, new.id, notification_title, notification_message,
    jsonb_build_object('work_order_number', wo.number, 'priority', priority_code)
  ) returning id into notification_id;

  insert into public.notification_receipts (notification_event_id, profile_id)
  select notification_id, p.id
  from public.profiles p
  join public.site_memberships sm on sm.profile_id = p.id and sm.site_id = wo.site_id and sm.active
  join public.notification_preferences np on np.profile_id = p.id and np.enabled
  where p.active
    and private.user_has_permission(p.id, 'notifications.receive')
    and private.can_user_view_work_order(p.id, wo.id)
    and (notification_type <> 'assigned_work_order' or p.id = wo.assigned_to
      or private.user_has_permission(p.id, 'work_orders.view.all'))
  on conflict do nothing;
  return new;
end;
$$;

create trigger work_order_events_notify
after insert on public.work_order_events
for each row execute function private.capture_work_order_notification();

create trigger notification_events_immutable before update or delete on public.notification_events
for each row execute function private.prevent_mutation();

create trigger notification_preferences_audit after update on public.notification_preferences
for each row execute function private.write_audit();
create trigger report_exports_audit after insert or update or delete on public.report_exports
for each row execute function private.write_audit();

