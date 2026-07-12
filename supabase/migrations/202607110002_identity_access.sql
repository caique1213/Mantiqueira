-- Identity, sites, roles and granular permissions.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug = private.slugify(slug)),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 120),
  code text not null check (code ~ '^[A-Z0-9_-]{2,30}$'),
  timezone text not null default 'America/Cuiaba',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.-]{1,49}$'),
  name text not null check (length(btrim(name)) between 2 and 80),
  color text not null default '#939AA5' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  system boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.-]{1,49}$'),
  name text not null check (length(btrim(name)) between 2 and 80),
  description text not null default '',
  system boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.-]{2,99}$'),
  description text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 2 and 120),
  active boolean not null default false,
  primary_sector_id uuid references public.sectors(id) on delete set null,
  avatar_path text,
  timezone text not null default 'America/Cuiaba',
  locale text not null default 'pt-BR',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (profile_id, role_id)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.site_memberships (
  site_id uuid not null references public.sites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (site_id, profile_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_schema text not null,
  entity_table text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  occurred_at timestamptz not null default clock_timestamp()
);

create index audit_logs_entity_idx
  on public.audit_logs (entity_table, entity_id, occurred_at desc);
create index audit_logs_actor_idx
  on public.audit_logs (actor_id, occurred_at desc);
create index profiles_active_idx on public.profiles (active) where active;
create index profile_roles_role_idx on public.profile_roles (role_id, profile_id);
create index site_memberships_profile_idx on public.site_memberships (profile_id, site_id) where active;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();
create trigger sites_set_updated_at
before update on public.sites
for each row execute function private.set_updated_at();
create trigger sectors_set_updated_at
before update on public.sectors
for each row execute function private.set_updated_at();
create trigger roles_set_updated_at
before update on public.roles
for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function private.prevent_mutation();

create or replace function private.seed_identity_reference()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.organizations (id, name, slug)
  values ('11111111-1111-4111-8111-111111111111', 'Mantiqueira Brasil', 'mantiqueira-brasil')
  on conflict (id) do nothing;

  insert into public.sites (id, organization_id, name, code, timezone)
  values (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Unidade principal',
    'PRINCIPAL',
    'America/Cuiaba'
  ) on conflict (id) do nothing;

  insert into public.sectors (id, code, name, color, system, sort_order) values
    ('30000000-0000-4000-8000-000000000001', 'operacao', 'Operação', '#939AA5', true, 10),
    ('30000000-0000-4000-8000-000000000002', 'eletrica', 'Elétrica', '#3B82F6', true, 20),
    ('30000000-0000-4000-8000-000000000003', 'mecanica', 'Mecânica', '#F59E0B', true, 30),
    ('30000000-0000-4000-8000-000000000004', 'administracao', 'Administração', '#F6B900', true, 40)
  on conflict (id) do nothing;

  insert into public.roles (id, code, name, description, system, sort_order) values
    ('40000000-0000-4000-8000-000000000001', 'galponista', 'Galponista', 'Abre e acompanha ordens de serviço.', true, 10),
    ('40000000-0000-4000-8000-000000000002', 'eletricista', 'Eletricista', 'Atende manutenção elétrica e inventário elétrico.', true, 20),
    ('40000000-0000-4000-8000-000000000003', 'mecanico', 'Mecânico', 'Atende manutenção mecânica e inventário mecânico.', true, 30),
    ('40000000-0000-4000-8000-000000000004', 'administrador', 'Administrador', 'Controle funcional e administrativo completo.', true, 40)
  on conflict (id) do nothing;

  insert into public.permissions (id, code, description) values
    ('41000000-0000-4000-8000-000000000001', 'app.access', 'Acessar o sistema'),
    ('41000000-0000-4000-8000-000000000002', 'map.view', 'Consultar mapa físico'),
    ('41000000-0000-4000-8000-000000000003', 'assets.view', 'Consultar inventário técnico'),
    ('41000000-0000-4000-8000-000000000004', 'assets.edit.electrical', 'Editar ativos elétricos'),
    ('41000000-0000-4000-8000-000000000005', 'assets.edit.mechanical', 'Editar ativos mecânicos'),
    ('41000000-0000-4000-8000-000000000006', 'assets.edit.all', 'Editar qualquer ativo'),
    ('41000000-0000-4000-8000-000000000007', 'assets.replace.electrical', 'Substituir ativos elétricos'),
    ('41000000-0000-4000-8000-000000000008', 'assets.replace.mechanical', 'Substituir ativos mecânicos'),
    ('41000000-0000-4000-8000-000000000009', 'assets.replace.all', 'Substituir qualquer ativo'),
    ('41000000-0000-4000-8000-000000000010', 'models.manage', 'Gerenciar biblioteca de modelos'),
    ('41000000-0000-4000-8000-000000000011', 'work_orders.create', 'Abrir ordens de serviço'),
    ('41000000-0000-4000-8000-000000000012', 'work_orders.view.own', 'Consultar OS próprias'),
    ('41000000-0000-4000-8000-000000000013', 'work_orders.view.electrical', 'Consultar OS elétricas'),
    ('41000000-0000-4000-8000-000000000014', 'work_orders.view.mechanical', 'Consultar OS mecânicas'),
    ('41000000-0000-4000-8000-000000000015', 'work_orders.view.all', 'Consultar todas as OS'),
    ('41000000-0000-4000-8000-000000000016', 'work_orders.assign', 'Assumir OS permitida'),
    ('41000000-0000-4000-8000-000000000017', 'work_orders.assign.any', 'Atribuir OS a outro usuário'),
    ('41000000-0000-4000-8000-000000000018', 'work_orders.execute', 'Executar OS permitida'),
    ('41000000-0000-4000-8000-000000000019', 'work_orders.resolve', 'Resolver OS permitida'),
    ('41000000-0000-4000-8000-000000000020', 'work_orders.cancel', 'Cancelar OS'),
    ('41000000-0000-4000-8000-000000000021', 'work_orders.reopen', 'Reabrir OS terminal'),
    ('41000000-0000-4000-8000-000000000022', 'users.manage', 'Gerenciar usuários e perfis'),
    ('41000000-0000-4000-8000-000000000023', 'roles.manage', 'Gerenciar perfis e permissões'),
    ('41000000-0000-4000-8000-000000000024', 'settings.manage', 'Gerenciar configurações'),
    ('41000000-0000-4000-8000-000000000025', 'themes.manage', 'Gerenciar temas'),
    ('41000000-0000-4000-8000-000000000026', 'structure.manage', 'Gerenciar estrutura não protegida'),
    ('41000000-0000-4000-8000-000000000027', 'audit.view', 'Consultar auditoria'),
    ('41000000-0000-4000-8000-000000000028', 'reports.view', 'Consultar e exportar relatórios'),
    ('41000000-0000-4000-8000-000000000029', 'notifications.receive', 'Receber notificações')
  on conflict (id) do nothing;

  -- Galponista.
  insert into public.role_permissions (role_id, permission_id)
  select '40000000-0000-4000-8000-000000000001'::uuid, p.id
  from public.permissions p
  where p.code = any (array[
    'app.access','map.view','assets.view','work_orders.create',
    'work_orders.view.own','notifications.receive'
  ]) on conflict do nothing;

  -- Eletricista.
  insert into public.role_permissions (role_id, permission_id)
  select '40000000-0000-4000-8000-000000000002'::uuid, p.id
  from public.permissions p
  where p.code = any (array[
    'app.access','map.view','assets.view','assets.edit.electrical',
    'assets.replace.electrical','work_orders.create','work_orders.view.own',
    'work_orders.view.electrical','work_orders.assign','work_orders.execute',
    'work_orders.resolve','notifications.receive'
  ]) on conflict do nothing;

  -- Mecânico.
  insert into public.role_permissions (role_id, permission_id)
  select '40000000-0000-4000-8000-000000000003'::uuid, p.id
  from public.permissions p
  where p.code = any (array[
    'app.access','map.view','assets.view','assets.edit.mechanical',
    'assets.replace.mechanical','work_orders.create','work_orders.view.own',
    'work_orders.view.mechanical','work_orders.assign','work_orders.execute',
    'work_orders.resolve','notifications.receive'
  ]) on conflict do nothing;

  -- Administrador receives every permission.
  insert into public.role_permissions (role_id, permission_id)
  select '40000000-0000-4000-8000-000000000004'::uuid, p.id
  from public.permissions p
  on conflict do nothing;
end;
$$;

select private.seed_identity_reference();

create or replace function private.is_active_user(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select user_id is not null and exists (
    select 1 from public.profiles p where p.id = user_id and p.active
  );
$$;

create or replace function private.user_has_permission(user_id uuid, permission_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.is_active_user(user_id) and exists (
    select 1
    from public.profile_roles pr
    join public.roles r on r.id = pr.role_id and r.active
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where pr.profile_id = user_id and p.code = permission_code
  );
$$;

create or replace function private.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.user_has_permission(auth.uid(), permission_code);
$$;

create or replace function private.can_access_site(target_site_id uuid, user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.is_active_user(user_id) and exists (
    select 1 from public.site_memberships sm
    where sm.site_id = target_site_id and sm.profile_id = user_id and sm.active
  );
$$;

create or replace function private.write_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_json jsonb;
  new_json jsonb;
  row_id text;
begin
  old_json := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  new_json := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  row_id := coalesce(
    new_json ->> 'id', old_json ->> 'id',
    new_json ->> 'key', old_json ->> 'key',
    new_json ->> 'code', old_json ->> 'code'
  );
  insert into public.audit_logs (
    actor_id, action, entity_schema, entity_table, entity_id,
    before_data, after_data, request_id
  ) values (
    auth.uid(), lower(tg_op), tg_table_schema, tg_table_name, row_id,
    old_json, new_json, nullif(current_setting('request.id', true), '')
  );
  return coalesce(new, old);
end;
$$;

create or replace function private.protect_profile_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  was_admin boolean;
  active_admins integer;
begin
  if tg_op = 'UPDATE' and old.id = auth.uid() and old.active and not new.active then
    raise exception using errcode = '42501', message = 'Você não pode desativar a própria conta.';
  end if;

  select exists (
    select 1 from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = old.id and r.code = 'administrador'
  ) into was_admin;

  if was_admin and old.active and (tg_op = 'DELETE' or not new.active) then
    select count(*) into active_admins
    from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id
    join public.roles r on r.id = pr.role_id
    where p.active and r.code = 'administrador';
    if active_admins <= 1 then
      raise exception using errcode = '23514', message = 'O último administrador ativo não pode ser removido ou desativado.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_protect_admin
before update of active or delete on public.profiles
for each row execute function private.protect_profile_admin();

create or replace function private.protect_admin_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  role_code text;
  target_active boolean;
  active_admins integer;
begin
  select code into role_code from public.roles where id = old.role_id;
  select active into target_active from public.profiles where id = old.profile_id;
  if role_code = 'administrador' and target_active then
    if old.profile_id = auth.uid() then
      raise exception using errcode = '42501', message = 'Você não pode remover sua própria função de administrador.';
    end if;
    select count(*) into active_admins
    from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id
    join public.roles r on r.id = pr.role_id
    where p.active and r.code = 'administrador';
    if active_admins <= 1 then
      raise exception using errcode = '23514', message = 'O último administrador ativo não pode ser rebaixado.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profile_roles_protect_admin
before update or delete on public.profile_roles
for each row execute function private.protect_admin_role();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  selected_role uuid;
  selected_sector uuid;
  is_first_admin boolean;
begin
  perform pg_advisory_xact_lock(847231009);
  select not exists (
    select 1 from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id
    join public.roles r on r.id = pr.role_id
    where p.active and r.code = 'administrador'
  ) into is_first_admin;

  if is_first_admin then
    selected_role := '40000000-0000-4000-8000-000000000004';
    selected_sector := '30000000-0000-4000-8000-000000000004';
  else
    selected_role := '40000000-0000-4000-8000-000000000001';
    selected_sector := '30000000-0000-4000-8000-000000000001';
  end if;

  insert into public.profiles (id, display_name, active, primary_sector_id)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'Usuário'),
    is_first_admin,
    selected_sector
  ) on conflict (id) do nothing;

  insert into public.profile_roles (profile_id, role_id)
  values (new.id, selected_role)
  on conflict do nothing;

  insert into public.site_memberships (site_id, profile_id, active)
  values ('22222222-2222-4222-8222-222222222222', new.id, true)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

-- Safe backfill for Auth users that existed before this migration.
do $$
declare
  auth_user auth.users%rowtype;
  selected_role uuid;
  selected_sector uuid;
  is_first_admin boolean;
begin
  perform pg_advisory_xact_lock(847231009);
  for auth_user in select * from auth.users order by created_at, id loop
    if not exists (select 1 from public.profiles where id = auth_user.id) then
      select not exists (
        select 1 from public.profiles p
        join public.profile_roles pr on pr.profile_id = p.id
        join public.roles r on r.id = pr.role_id
        where p.active and r.code = 'administrador'
      ) into is_first_admin;
      selected_role := case when is_first_admin
        then '40000000-0000-4000-8000-000000000004'::uuid
        else '40000000-0000-4000-8000-000000000001'::uuid end;
      selected_sector := case when is_first_admin
        then '30000000-0000-4000-8000-000000000004'::uuid
        else '30000000-0000-4000-8000-000000000001'::uuid end;
      insert into public.profiles (id, display_name, active, primary_sector_id)
      values (
        auth_user.id,
        coalesce(nullif(btrim(auth_user.raw_user_meta_data ->> 'name'), ''), split_part(auth_user.email, '@', 1), 'Usuário'),
        is_first_admin,
        selected_sector
      );
      insert into public.profile_roles (profile_id, role_id) values (auth_user.id, selected_role);
      insert into public.site_memberships (site_id, profile_id, active)
      values ('22222222-2222-4222-8222-222222222222', auth_user.id, true);
    end if;
  end loop;
end;
$$;

-- Audit high-value identity changes (not login telemetry).
create trigger profiles_audit after insert or update or delete on public.profiles
for each row execute function private.write_audit();
create trigger profile_roles_audit after insert or update or delete on public.profile_roles
for each row execute function private.write_audit();
create trigger site_memberships_audit after insert or update or delete on public.site_memberships
for each row execute function private.write_audit();

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active_user(uuid) to authenticated;
grant execute on function private.user_has_permission(uuid, text) to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.can_access_site(uuid, uuid) to authenticated;
