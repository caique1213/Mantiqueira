-- ============================================================
-- 014 — Painéis de OS, setor Civil, nomes de usuário e acesso
-- ============================================================

-- Novo setor: Civil.
insert into public.sectors (id, code, name, color, system, sort_order)
values (
  '30000000-0000-4000-8000-000000000005',
  'civil',
  'Civil',
  '#8B5CF6',
  true,
  35
)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  color = excluded.color,
  active = true,
  sort_order = excluded.sort_order;

-- Novo perfil: Civil.
insert into public.roles (id, code, name, description, system, sort_order)
values (
  '40000000-0000-4000-8000-000000000005',
  'civil',
  'Civil',
  'Recebe e atende ordens de serviço do setor Civil.',
  true,
  35
)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  description = excluded.description,
  active = true,
  sort_order = excluded.sort_order;

-- Permissão de visualização das OS civis.
insert into public.permissions (id, code, description)
values (
  '41000000-0000-4000-8000-000000000030',
  'work_orders.view.civil',
  'Consultar OS civis'
)
on conflict (id) do update set
  code = excluded.code,
  description = excluded.description;

-- Galponista pode cancelar OS que ele consegue ver. Pela RLS/função de visão,
-- isso fica limitado às OS próprias dele, não às OS dos outros setores.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'work_orders.cancel'
where r.code = 'galponista'
on conflict do nothing;

-- Permissões do perfil Civil.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = any (array[
  'app.access',
  'map.view',
  'assets.view',
  'work_orders.create',
  'work_orders.view.own',
  'work_orders.view.civil',
  'work_orders.assign',
  'work_orders.execute',
  'work_orders.resolve',
  'notifications.receive',
  'reports.view'
])
where r.code = 'civil'
on conflict do nothing;

-- Administrador recebe novas permissões adicionadas após o seed inicial.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'administrador'
on conflict do nothing;

-- Atualiza a regra central de visibilidade de OS para incluir setor Civil.
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
        or (s.code = 'civil' and private.user_has_permission(user_id, 'work_orders.view.civil'))
        or (
          private.user_has_permission(user_id, 'work_orders.view.own')
          and (wo.opened_by = user_id or wo.assigned_to = user_id)
        )
      )
  );
$$;

grant execute on function private.can_user_view_work_order(uuid,uuid) to authenticated;

-- Função administrativa pequena para corrigir/definir o nome de exibição.
-- Mantida separada de admin_manage_user para não quebrar convites/fluxos existentes.
create or replace function public.admin_set_user_display_name(
  p_target_user_id uuid,
  p_display_name text,
  p_confirmation text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  cleaned_name text;
  result public.profiles;
begin
  caller := private.require_active_user();

  if not private.user_has_permission(caller, 'users.manage') then
    raise exception using errcode = '42501', message = 'Permissão administrativa insuficiente.';
  end if;

  if p_confirmation is distinct from 'CONFIRMAR' then
    raise exception using errcode = '22023', message = 'Confirmação explícita obrigatória.';
  end if;

  cleaned_name := btrim(coalesce(p_display_name, ''));
  if length(cleaned_name) < 2 or length(cleaned_name) > 120 then
    raise exception using errcode = '22023', message = 'O nome deve ter entre 2 e 120 caracteres.';
  end if;

  update public.profiles
  set display_name = cleaned_name
  where id = p_target_user_id
  returning * into result;

  if result.id is null then
    raise exception using errcode = 'P0002', message = 'Usuário não encontrado.';
  end if;

  return result;
end;
$$;

grant execute on function public.admin_set_user_display_name(uuid,text,text) to authenticated;
