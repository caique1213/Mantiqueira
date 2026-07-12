-- Versioned application settings, modules and complete design-token themes.

create table public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{2,99}$'),
  value jsonb not null,
  description text not null default '',
  public_read boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_setting_versions (
  id bigint generated always as identity primary key,
  setting_key text not null,
  value jsonb not null,
  changed_by uuid,
  replaced_at timestamptz not null default clock_timestamp()
);

create table public.ui_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,49}$'),
  label text not null,
  description text not null default '',
  icon text not null,
  route text not null check (route like '/%'),
  required_permission text references public.permissions(code) on update cascade on delete restrict,
  visible boolean not null default true,
  system boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.theme_presets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_-]{2,49}$'),
  name text not null,
  description text not null default '',
  tokens jsonb not null check (jsonb_typeof(tokens) = 'object'),
  schema_version integer not null default 1 check (schema_version = 1),
  appearance text not null default 'dark' check (appearance in ('light','dark','high-contrast')),
  density text not null default 'comfortable' check (density in ('compact','comfortable','spacious','custom')),
  preset_key text check (preset_key is null or preset_key in ('classic','industrial','premium','light','contrast')),
  system_preset boolean not null default false,
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((active and archived_at is null) or (not active))
);

create table public.theme_versions (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.theme_presets(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  tokens jsonb not null check (jsonb_typeof(tokens) = 'object'),
  note text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (theme_id, version_number)
);

create table public.active_themes (
  site_id uuid primary key references public.sites(id) on delete cascade,
  theme_id uuid not null references public.theme_presets(id) on delete restrict,
  applied_version_id uuid references public.theme_versions(id) on delete set null,
  applied_by uuid references public.profiles(id) on delete set null,
  applied_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at before update on public.app_settings
for each row execute function private.set_updated_at();
create trigger ui_modules_set_updated_at before update on public.ui_modules
for each row execute function private.set_updated_at();
create trigger themes_set_updated_at before update on public.theme_presets
for each row execute function private.set_updated_at();

create or replace function private.capture_setting_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.value is distinct from old.value then
    insert into public.app_setting_versions (setting_key, value, changed_by)
    values (old.key, old.value, auth.uid());
  end if;
  return new;
end;
$$;

create trigger app_settings_capture_version
before update on public.app_settings
for each row execute function private.capture_setting_version();

create or replace function private.protect_system_theme()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' and old.system_preset then
    raise exception using errcode = '23514', message = 'Presets Mantiqueira não podem ser excluídos.';
  end if;
  if tg_op = 'UPDATE' and old.system_preset and (
    new.key is distinct from old.key or
    new.tokens is distinct from old.tokens or
    new.system_preset is distinct from old.system_preset or
    not new.active
  ) then
    raise exception using errcode = '23514', message = 'Presets Mantiqueira são imutáveis; duplique para personalizar.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger themes_protect_system
before update or delete on public.theme_presets
for each row execute function private.protect_system_theme();

create or replace function private.seed_settings_themes()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  common_tokens jsonb := jsonb_build_object(
    'fontFamily', 'Inter, ui-sans-serif, system-ui, sans-serif',
    'fontScale', 1, 'fontWeightRegular', 400, 'fontWeightStrong', 650,
    'lineHeight', 1.5, 'titleSize', 'clamp(1.75rem, 4vw, 3.5rem)',
    'bodySize', '1rem', 'radiusSm', '8px', 'radiusMd', '14px',
    'radiusLg', '22px', 'borderWidth', '1px', 'spacingScale', 1,
    'density', 'comfortable', 'shadow', '0 18px 50px rgba(0,0,0,.22)',
    'blur', '18px', 'surfaceOpacity', 0.96,
    'danger', '#EF4444', 'success', '#22C55E', 'warning', '#F59E0B', 'info', '#3B82F6',
    'statusAwaiting', '#F6B900', 'statusInProgress', '#3B82F6',
    'statusWaitingPart', '#F97316', 'statusResolved', '#22C55E', 'statusCancelled', '#64748B',
    'priorityLow', '#64748B', 'priorityNormal', '#3B82F6',
    'priorityHigh', '#F59E0B', 'priorityCritical', '#EF4444',
    'mapEmpty', '#252A31', 'mapActive', '#F6B900', 'mapSelected', '#FFFFFF',
    'assetMotor', '#F6B900', 'assetReducer', '#A78BFA',
    'batteryCage', '#111318', 'batteryNylon', '#2F80ED',
    'batteryWhiteConveyor', '#F97316', 'batteryFeedCart', '#8B929C',
    'batteryElevator', '#DC2626'
  );
begin
  insert into public.app_settings (key, value, description, public_read) values
    ('system.name', '"Mantiqueira Maintenance Hub"'::jsonb, 'Nome exibido do sistema', true),
    ('company.name', '"Mantiqueira Brasil"'::jsonb, 'Nome da empresa', true),
    ('system.timezone', '"America/Cuiaba"'::jsonb, 'Timezone operacional', true),
    ('system.date_format', '"dd/MM/yyyy HH:mm"'::jsonb, 'Formato de data da interface', true),
    ('home.title', '"Manutenção conectada à operação"'::jsonb, 'Título da Home', true),
    ('home.subtitle', '"Mapa físico, ativos e ordens de serviço em uma única visão."'::jsonb, 'Subtítulo da Home', true),
    ('analytics.recurrence', '{"count":3,"window_days":30}'::jsonb, 'Regra inicial de reincidência', false),
    ('inventory.stale_after_days', '365'::jsonb, 'Prazo para marcar cadastro sem revisão', false)
  on conflict (key) do nothing;

  insert into public.ui_modules
    (id, slug, label, description, icon, route, required_permission, visible, system, sort_order) values
    ('70000000-0000-4000-8000-000000000001', 'home', 'Início', 'Visão geral operacional', 'house', '/', 'app.access', true, true, 10),
    ('70000000-0000-4000-8000-000000000002', 'work-orders', 'Ordens de Serviço', 'Abrir e acompanhar manutenção', 'clipboard-list', '/ordens', 'work_orders.view.own', true, true, 20),
    ('70000000-0000-4000-8000-000000000003', 'posture-map', 'Mapa das Posturas', 'Mapa físico das 48 posturas', 'map', '/mapa', 'map.view', true, true, 30),
    ('70000000-0000-4000-8000-000000000004', 'inventory', 'Inventário Técnico', 'Ativos físicos instalados', 'factory', '/inventario', 'assets.view', true, true, 40),
    ('70000000-0000-4000-8000-000000000005', 'analytics', 'Análises', 'Indicadores técnicos e relatórios', 'chart-no-axes-combined', '/analises', 'reports.view', true, true, 50),
    ('70000000-0000-4000-8000-000000000006', 'administration', 'Administração', 'Configurações e auditoria', 'settings', '/administracao', 'settings.manage', true, true, 60)
  on conflict (id) do nothing;

  insert into public.theme_presets (id, key, name, description, tokens, system_preset) values
    (
      '71000000-0000-4000-8000-000000000001', 'mantiqueira_classic', 'Mantiqueira Clássico',
      'Institucional, acolhedor e alinhado ao amarelo e marrom tradicionais.',
      common_tokens || '{
        "bg":"#FFF8E8","bgSecondary":"#F8E9C8","surface":"#FFFDF7","surfaceRaised":"#FFF4D6",
        "card":"#FFFFFF","menu":"#3A2A1A","header":"#FFF8E8","footer":"#3A2A1A",
        "text":"#2A211A","textMuted":"#806653","border":"#E8D4AB","primary":"#F6B900",
        "primaryContrast":"#261B00","secondary":"#6B4423","accent":"#D98E04",
        "buttonPrimary":"#F6B900","buttonSecondary":"#6B4423","buttonDanger":"#C53030",
        "input":"#FFFDF7","icon":"#6B4423","badge":"#F8E9C8","marker":"#F6B900"
      }'::jsonb, true
    ),
    (
      '71000000-0000-4000-8000-000000000002', 'mantiqueira_industrial', 'Mantiqueira Industrial',
      'Tema padrão escuro, profissional e orientado à manutenção.',
      common_tokens || '{
        "bg":"#0B0D10","bgSecondary":"#101419","surface":"#15191F","surfaceRaised":"#1B2028",
        "card":"#171C23","menu":"#0D1014","header":"#0B0D10","footer":"#090B0E",
        "text":"#F5F7FA","textMuted":"#939AA5","border":"#2A3039","primary":"#F6B900",
        "primaryContrast":"#1D1600","secondary":"#D28B00","accent":"#FFCA28",
        "buttonPrimary":"#F6B900","buttonSecondary":"#252C35","buttonDanger":"#DC2626",
        "input":"#11161C","icon":"#CED3DA","badge":"#242B34","marker":"#F6B900"
      }'::jsonb, true
    ),
    (
      '71000000-0000-4000-8000-000000000003', 'mantiqueira_premium', 'Mantiqueira Premium',
      'Preto, marrom profundo, bronze e dourado com apresentação executiva.',
      common_tokens || '{
        "bg":"#090807","bgSecondary":"#130F0C","surface":"#1B1511","surfaceRaised":"#241B15",
        "card":"#1D1713","menu":"#0B0908","header":"#0E0B09","footer":"#080706",
        "text":"#FFF6E5","textMuted":"#BBAA91","border":"#443426","primary":"#D6A83B",
        "primaryContrast":"#1D1404","secondary":"#8F5F32","accent":"#F2C86D",
        "buttonPrimary":"#D6A83B","buttonSecondary":"#392A20","buttonDanger":"#B83A32",
        "input":"#17120F","icon":"#E1C99E","badge":"#32251C","marker":"#D6A83B"
      }'::jsonb, true
    ),
    (
      '71000000-0000-4000-8000-000000000004', 'mantiqueira_light', 'Mantiqueira Light',
      'Tema claro de alto contraste para ambientes muito iluminados.',
      common_tokens || '{
        "bg":"#F8F7F3","bgSecondary":"#EEECE4","surface":"#FFFFFF","surfaceRaised":"#FAF6E9",
        "card":"#FFFFFF","menu":"#FFFFFF","header":"#FFFFFF","footer":"#ECE8DD",
        "text":"#1C2025","textMuted":"#65707C","border":"#D8D5CB","primary":"#E4A900",
        "primaryContrast":"#211700","secondary":"#5E4A2E","accent":"#F6B900",
        "buttonPrimary":"#E4A900","buttonSecondary":"#E7E9EC","buttonDanger":"#D42C2C",
        "input":"#FFFFFF","icon":"#3C4652","badge":"#F0E5C5","marker":"#E4A900"
      }'::jsonb, true
    ),
    (
      '71000000-0000-4000-8000-000000000005', 'mantiqueira_contrast', 'Mantiqueira Contrast',
      'Contraste máximo e estados operacionais de leitura imediata.',
      common_tokens || '{
        "bg":"#000000","bgSecondary":"#080808","surface":"#101010","surfaceRaised":"#181818",
        "card":"#111111","menu":"#050505","header":"#000000","footer":"#000000",
        "text":"#FFFFFF","textMuted":"#C5C5C5","border":"#565656","primary":"#FFD400",
        "primaryContrast":"#000000","secondary":"#FFFFFF","accent":"#FFD400",
        "buttonPrimary":"#FFD400","buttonSecondary":"#242424","buttonDanger":"#FF2B2B",
        "input":"#090909","icon":"#FFFFFF","badge":"#292929","marker":"#FFD400",
        "statusAwaiting":"#FFD400","statusInProgress":"#00A3FF","statusWaitingPart":"#FF7A00",
        "statusResolved":"#00D65A","statusCancelled":"#A3A3A3","priorityCritical":"#FF2B2B"
      }'::jsonb, true
    ),
    (
      '71000000-0000-4000-8000-000000000006', 'custom', 'Personalizado',
      'Ponto de partida editável pelo administrador.',
      common_tokens || '{
        "bg":"#0B0D10","bgSecondary":"#101419","surface":"#15191F","surfaceRaised":"#1B2028",
        "card":"#171C23","menu":"#0D1014","header":"#0B0D10","footer":"#090B0E",
        "text":"#F5F7FA","textMuted":"#939AA5","border":"#2A3039","primary":"#F6B900",
        "primaryContrast":"#1D1600","secondary":"#D28B00","accent":"#FFCA28",
        "buttonPrimary":"#F6B900","buttonSecondary":"#252C35","buttonDanger":"#DC2626",
        "input":"#11161C","icon":"#CED3DA","badge":"#242B34","marker":"#F6B900"
      }'::jsonb, false
    )
  on conflict (id) do nothing;

  insert into public.theme_versions (id, theme_id, version_number, tokens, note)
  select
    ('72000000-0000-4000-8000-00000000000' || right(tp.id::text, 1))::uuid,
    tp.id, 1, tp.tokens, 'Versão inicial'
  from public.theme_presets tp
  where tp.id in (
    '71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000004',
    '71000000-0000-4000-8000-000000000005','71000000-0000-4000-8000-000000000006'
  ) on conflict (theme_id, version_number) do nothing;

  insert into public.active_themes (site_id, theme_id, applied_version_id)
  values (
    '22222222-2222-4222-8222-222222222222',
    '71000000-0000-4000-8000-000000000002',
    '72000000-0000-4000-8000-000000000002'
  ) on conflict (site_id) do nothing;
end;
$$;

select private.seed_settings_themes();

create trigger app_settings_audit after insert or update or delete on public.app_settings
for each row execute function private.write_audit();
create trigger ui_modules_audit after insert or update or delete on public.ui_modules
for each row execute function private.write_audit();
create trigger themes_audit after insert or update or delete on public.theme_presets
for each row execute function private.write_audit();
create trigger active_themes_audit after insert or update or delete on public.active_themes
for each row execute function private.write_audit();

create trigger app_setting_versions_immutable
before update or delete on public.app_setting_versions
for each row execute function private.prevent_mutation();
create trigger theme_versions_immutable
before update or delete on public.theme_versions
for each row execute function private.prevent_mutation();
