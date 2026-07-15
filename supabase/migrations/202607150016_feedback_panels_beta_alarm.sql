-- ============================================================
-- 016 — Feedback, painéis operacionais, beta e alarmes padrão
-- ============================================================

insert into public.permissions (id, code, description) values
  ('41000000-0000-4000-8000-000000000031', 'feedback.create', 'Enviar feedback, erros e sugestões'),
  ('41000000-0000-4000-8000-000000000032', 'feedback.manage', 'Gerenciar feedbacks do período de teste')
on conflict (id) do update set
  code = excluded.code,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'feedback.create'
where r.code in ('galponista','eletricista','mecanico','civil','administrador')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'feedback.manage'
where r.code = 'administrador'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'administrador'
on conflict do nothing;

create table if not exists public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  type text not null check (type in ('bug','suggestion','question','visual','mobile','wrong_data','other')),
  page text not null default '',
  title text not null check (length(btrim(title)) between 3 and 140),
  description text not null check (length(btrim(description)) between 5 and 4000),
  priority text not null default 'medium' check (priority in ('low','medium','high','blocked')),
  status text not null default 'open' check (status in ('open','reviewing','planned','fixed','rejected','answered')),
  app_context jsonb not null default '{}'::jsonb check (jsonb_typeof(app_context) = 'object'),
  admin_response text not null default '',
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback_media (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback_items(id) on delete cascade,
  bucket_id text not null default 'feedback-media' check (bucket_id = 'feedback-media'),
  file_path text not null unique,
  file_name text not null default '',
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  caption text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists feedback_items_site_status_idx
  on public.feedback_items (site_id, status, created_at desc);
create index if not exists feedback_items_creator_idx
  on public.feedback_items (created_by, created_at desc);
create index if not exists feedback_media_feedback_idx
  on public.feedback_media (feedback_id);

alter table public.feedback_items enable row level security;
alter table public.feedback_media enable row level security;

grant select, insert, update, delete on public.feedback_items to authenticated;
grant select, insert, update, delete on public.feedback_media to authenticated;

drop policy if exists feedback_items_read on public.feedback_items;
create policy feedback_items_read on public.feedback_items
for select to authenticated
using (
  private.has_permission('feedback.manage')
  or (created_by = auth.uid() and private.has_permission('feedback.create'))
);

drop policy if exists feedback_items_insert on public.feedback_items;
create policy feedback_items_insert on public.feedback_items
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.has_permission('feedback.create')
  and private.can_access_site(site_id)
);

drop policy if exists feedback_items_manage_update on public.feedback_items;
create policy feedback_items_manage_update on public.feedback_items
for update to authenticated
using (private.has_permission('feedback.manage') and private.can_access_site(site_id))
with check (private.has_permission('feedback.manage') and private.can_access_site(site_id));

drop policy if exists feedback_media_read on public.feedback_media;
create policy feedback_media_read on public.feedback_media
for select to authenticated
using (
  exists (
    select 1 from public.feedback_items fi
    where fi.id = feedback_id
      and (
        private.has_permission('feedback.manage')
        or (fi.created_by = auth.uid() and private.has_permission('feedback.create'))
      )
  )
);

drop policy if exists feedback_media_insert on public.feedback_media;
create policy feedback_media_insert on public.feedback_media
for insert to authenticated
with check (
  exists (
    select 1 from public.feedback_items fi
    where fi.id = feedback_id
      and fi.created_by = auth.uid()
      and private.has_permission('feedback.create')
  )
);

drop trigger if exists feedback_items_set_updated_at on public.feedback_items;
create trigger feedback_items_set_updated_at before update on public.feedback_items
for each row execute function private.set_updated_at();

drop trigger if exists feedback_items_audit on public.feedback_items;
create trigger feedback_items_audit after insert or update or delete on public.feedback_items
for each row execute function private.write_audit();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
  ('feedback-media','feedback-media',false,26214400,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists feedback_media_storage_read on storage.objects;
create policy feedback_media_storage_read on storage.objects
for select to authenticated
using (
  bucket_id = 'feedback-media'
  and private.is_active_user()
  and exists (
    select 1
    from public.feedback_media fm
    join public.feedback_items fi on fi.id = fm.feedback_id
    where fm.file_path = storage.objects.name
      and (
        private.has_permission('feedback.manage')
        or fi.created_by = auth.uid()
      )
  )
);

drop policy if exists feedback_media_storage_insert on storage.objects;
create policy feedback_media_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'feedback-media'
  and private.has_permission('feedback.create')
  and (storage.foldername(name))[1] = auth.uid()::text
);

insert into public.sound_presets (id, key, name, audio_key, system, active, sort_order) values
  ('90000000-0000-4000-8000-000000000001', 'industrial_bell', 'Campainha industrial', 'industrial-bell', true, true, 10),
  ('90000000-0000-4000-8000-000000000002', 'short_siren', 'Sirene curta', 'short-siren', true, true, 20),
  ('90000000-0000-4000-8000-000000000003', 'metal_chime', 'Sinal metálico', 'metal-chime', true, true, 30),
  ('90000000-0000-4000-8000-000000000004', 'soft_alert', 'Alerta suave', 'soft-alert', true, true, 40),
  ('90000000-0000-4000-8000-000000000005', 'critical_alarm', 'Alarme crítico', 'critical-alarm', true, true, 50),
  ('90000000-0000-4000-8000-000000000006', 'factory_pulse', 'Pulso de fábrica', 'factory-pulse', true, true, 60),
  ('90000000-0000-4000-8000-000000000007', 'maintenance_call', 'Chamada manutenção', 'maintenance-call', true, true, 70),
  ('90000000-0000-4000-8000-000000000008', 'urgent_beep', 'Bipe urgente', 'urgent-beep', true, true, 80),
  ('90000000-0000-4000-8000-000000000009', 'control_room', 'Sala de controle', 'control-room', true, true, 90),
  ('90000000-0000-4000-8000-000000000010', 'long_siren', 'Sirene longa', 'long-siren', true, true, 100)
on conflict (id) do update set
  key = excluded.key,
  name = excluded.name,
  audio_key = excluded.audio_key,
  active = true,
  sort_order = excluded.sort_order;

insert into public.app_settings (key, value, description, public_read) values
  ('system.beta_banner_enabled', 'true'::jsonb, 'Exibe aviso de fase de teste no topo do sistema', true),
  ('system.version_label', '"Beta 1.0"'::jsonb, 'Rótulo de versão exibido no sistema', true),
  ('notification.default_sound_preset_key', '"industrial_bell"'::jsonb, 'Som padrão global dos alarmes de OS', false)
on conflict (key) do nothing;

-- Garantia de contraste: texto branco no hover do botão de perigo precisa manter leitura AA.
alter table public.theme_presets disable trigger themes_protect_system;

update public.theme_presets
set tokens = jsonb_set(tokens, '{colorButtonDangerHover}', '"#B91C1C"', true)
where preset_key = 'industrial';

alter table public.theme_presets enable trigger themes_protect_system;

insert into public.ui_modules
  (id, slug, label, description, icon, route, required_permission, visible, system, sort_order)
values
  ('70000000-0000-4000-8000-000000000008', 'panel-galponista', 'Painel Galponista', 'Abrir e acompanhar minhas solicitações', 'clipboard-plus', '/paineis/galponista', 'work_orders.create', true, true, 19),
  ('70000000-0000-4000-8000-000000000009', 'panel-eletrica', 'Painel Elétrica', 'Central operacional da elétrica', 'zap', '/paineis/eletrica', 'work_orders.view.electrical', true, true, 21),
  ('70000000-0000-4000-8000-000000000010', 'panel-mecanica', 'Painel Mecânica', 'Central operacional da mecânica', 'wrench', '/paineis/mecanica', 'work_orders.view.mechanical', true, true, 22),
  ('70000000-0000-4000-8000-000000000011', 'panel-civil', 'Painel Civil', 'Central operacional da manutenção civil', 'hard-hat', '/paineis/civil', 'work_orders.view.civil', true, true, 23),
  ('70000000-0000-4000-8000-000000000012', 'feedback', 'Feedback', 'Reportar erros e sugestões da fase de teste', 'message-square-warning', '/feedback', 'feedback.create', true, true, 55),
  ('70000000-0000-4000-8000-000000000013', 'help', 'Ajuda', 'Guia rápido de uso do sistema', 'circle-help', '/ajuda', 'app.access', true, true, 56),
  ('70000000-0000-4000-8000-000000000014', 'release-notes', 'Novidades', 'Mudanças e melhorias da versão', 'sparkles', '/novidades', 'app.access', true, true, 57),
  ('70000000-0000-4000-8000-000000000015', 'system-status', 'Status do Sistema', 'Conexão, usuário, permissões e versão', 'activity', '/status', 'app.access', true, true, 58)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  icon = excluded.icon,
  route = excluded.route,
  required_permission = excluded.required_permission,
  visible = true,
  sort_order = excluded.sort_order;
