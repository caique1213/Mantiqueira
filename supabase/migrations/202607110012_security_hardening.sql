-- Security and integrity hardening discovered during the pre-deployment audit.

-- Search helpers are intentionally private but must be callable by the
-- SECURITY INVOKER global-search function.
revoke all on function private.normalized_search(text) from public, anon;
grant execute on function private.normalized_search(text) to authenticated;

-- The recurrence rule affects every operational user and must not vary by role.
update public.app_settings set public_read=true where key='analytics.recurrence';

create unique index work_order_status_one_active_semantic
on public.work_order_status_definitions(semantic_state) where active;

-- Administrators may rename/reorder/hide modules, but the identity and route of
-- built-in modules remain protected so a typo cannot lock the application.
create policy ui_modules_admin_write on public.ui_modules for all to authenticated
using (private.has_permission('settings.manage'))
with check (private.has_permission('settings.manage'));

create or replace function private.protect_system_module()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.system and tg_op='DELETE' then
    raise exception using errcode='23514', message='Módulos padrão não podem ser excluídos.';
  end if;
  if old.system and (
    new.slug is distinct from old.slug or new.route is distinct from old.route or
    new.required_permission is distinct from old.required_permission or
    new.system is distinct from old.system
  ) then
    raise exception using errcode='23514', message='Identidade, rota e permissão de módulos padrão são protegidas.';
  end if;
  return coalesce(new,old);
end;
$$;
create trigger ui_modules_protect_system before update or delete on public.ui_modules
for each row execute function private.protect_system_module();

-- Preserve the role and permission invariants used by last-admin protection.
create or replace function private.protect_system_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.system and tg_op='DELETE' then
    raise exception using errcode='23514', message='Perfis padrão não podem ser excluídos.';
  end if;
  if old.system and (
    new.code is distinct from old.code or new.system is distinct from old.system or not new.active
  ) then
    raise exception using errcode='23514', message='Código e ativação de perfis padrão são protegidos.';
  end if;
  return coalesce(new,old);
end;
$$;
create trigger roles_protect_system before update or delete on public.roles
for each row execute function private.protect_system_role();

create or replace function private.protect_essential_admin_permission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  role_code text;
  permission_code text;
begin
  select code into role_code from public.roles where id=old.role_id;
  select code into permission_code from public.permissions where id=old.permission_id;
  if role_code='administrador' and permission_code in (
    'app.access','users.manage','roles.manage','settings.manage','themes.manage','audit.view'
  ) and tg_op in ('DELETE','UPDATE') then
    raise exception using errcode='23514', message='A permissão é essencial para impedir bloqueio administrativo.';
  end if;
  return coalesce(new,old);
end;
$$;
create trigger role_permissions_protect_admin before update or delete on public.role_permissions
for each row execute function private.protect_essential_admin_permission();

-- All physical-asset mutations go through audited RPCs. Direct table writes
-- would bypass optimistic locking, lifecycle events and confirmation flows.
drop policy if exists assets_insert on public.assets;
drop policy if exists assets_update on public.assets;
drop policy if exists motor_specs_write on public.asset_motor_specs;
drop policy if exists reducer_specs_write on public.asset_reducer_specs;
revoke insert, update, delete on public.assets from authenticated;
revoke insert, update, delete on public.asset_motor_specs from authenticated;
revoke insert, update, delete on public.asset_reducer_specs from authenticated;

create or replace function public.fulfill_work_order_needed_item(p_needed_item_id uuid)
returns public.work_order_needed_items
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target public.work_order_needed_items;
  result public.work_order_needed_items;
begin
  caller := private.require_active_user();
  select * into target from public.work_order_needed_items where id=p_needed_item_id for update;
  if target.id is null or not private.can_user_view_work_order(caller,target.work_order_id)
     or not private.user_has_permission(caller,'work_orders.execute') then
    raise exception using errcode='42501', message='Sem permissão para atender esta necessidade.';
  end if;
  if exists (
    select 1 from public.work_orders wo join public.work_order_status_definitions st on st.id=wo.status_id
    where wo.id=target.work_order_id and st.is_terminal
  ) then
    raise exception using errcode='23514', message='OS finalizada é somente leitura.';
  end if;
  update public.work_order_needed_items set fulfilled_at=coalesce(fulfilled_at,clock_timestamp())
  where id=target.id returning * into result;
  insert into public.work_order_events(work_order_id,event_type,actor_id,details)
  values(result.work_order_id,'needed_item',caller,jsonb_build_object('needed_item_id',result.id,'fulfilled',true));
  return result;
end;
$$;
revoke all on function public.fulfill_work_order_needed_item(uuid) from public, anon;
grant execute on function public.fulfill_work_order_needed_item(uuid) to authenticated;

-- A custom position becomes historical as soon as an installation or an OS
-- references it. Its identity can no longer be rewritten retroactively.
create or replace function private.freeze_referenced_asset_position()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists (select 1 from public.asset_installations where asset_position_id=old.id)
     or exists (select 1 from public.work_orders where asset_position_id=old.id) then
    if new.site_id is distinct from old.site_id or new.posture_id is distinct from old.posture_id or
       new.battery_id is distinct from old.battery_id or new.template_id is distinct from old.template_id or
       new.code is distinct from old.code or new.domain is distinct from old.domain or
       new.asset_type_id is distinct from old.asset_type_id then
      raise exception using errcode='23514', message='A identidade de uma posição com histórico não pode ser alterada.';
    end if;
  end if;
  return new;
end;
$$;
create trigger asset_positions_freeze_history before update on public.asset_positions
for each row execute function private.freeze_referenced_asset_position();

-- Relationships must stay inside one site; only their ending and notes may be
-- adjusted after creation.
create or replace function private.validate_asset_relationship()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  parent_site uuid;
  child_site uuid;
begin
  select site_id into parent_site from public.assets where id=new.parent_asset_id;
  select site_id into child_site from public.assets where id=new.child_asset_id;
  if parent_site is null or child_site is null or parent_site is distinct from child_site then
    raise exception using errcode='23514', message='Ativos relacionados devem pertencer à mesma unidade.';
  end if;
  if tg_op='UPDATE' and (
    new.parent_asset_id is distinct from old.parent_asset_id or
    new.child_asset_id is distinct from old.child_asset_id or
    new.relationship_type is distinct from old.relationship_type or
    new.started_at is distinct from old.started_at or
    new.created_by is distinct from old.created_by
  ) then
    raise exception using errcode='23514', message='Somente encerramento e observações do relacionamento podem ser alterados.';
  end if;
  return new;
end;
$$;
create trigger asset_relationships_validate_site before insert or update on public.asset_relationships
for each row execute function private.validate_asset_relationship();

drop policy if exists relationships_insert on public.asset_relationships;
drop policy if exists relationships_update on public.asset_relationships;
create policy relationships_insert on public.asset_relationships for insert to authenticated
with check (
  exists (
    select 1 from public.assets parent join public.assets child on child.id=child_asset_id
    where parent.id=parent_asset_id and parent.site_id=child.site_id
      and private.can_access_site(parent.site_id)
      and private.can_edit_asset_type(auth.uid(),parent.asset_type_id,false)
      and private.can_edit_asset_type(auth.uid(),child.asset_type_id,false)
  )
);
create policy relationships_update on public.asset_relationships for update to authenticated
using (
  exists (select 1 from public.assets a where a.id=parent_asset_id
    and private.can_access_site(a.site_id) and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false))
)
with check (
  exists (select 1 from public.assets a where a.id=parent_asset_id
    and private.can_access_site(a.site_id) and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false))
);

-- Client-created report jobs always start queued and cannot forge a ready file.
create or replace function private.force_report_export_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.requested_by := auth.uid();
  new.status := 'queued';
  new.bucket_id := null;
  new.storage_path := null;
  new.error_message := null;
  new.expires_at := null;
  return new;
end;
$$;
create trigger report_exports_force_request before insert on public.report_exports
for each row execute function private.force_report_export_request();

-- Storage UPDATE must preserve the same authorized prefix. DELETE is allowed
-- only for an orphan upload that failed before database registration.
drop policy if exists asset_media_storage_update on storage.objects;
create policy asset_media_storage_update on storage.objects for update to authenticated
using (
  bucket_id='asset-media' and exists (
    select 1 from public.assets a where a.site_id::text=(storage.foldername(name))[1]
      and a.id::text=(storage.foldername(name))[2]
      and private.can_access_site(a.site_id) and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)
  )
)
with check (
  bucket_id='asset-media' and exists (
    select 1 from public.assets a where a.site_id::text=(storage.foldername(name))[1]
      and a.id::text=(storage.foldername(name))[2]
      and private.can_access_site(a.site_id) and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)
  )
);
create policy asset_media_storage_delete_orphan on storage.objects for delete to authenticated
using (
  bucket_id='asset-media'
  and not exists (select 1 from public.asset_media am where am.storage_path=name)
  and exists (
    select 1 from public.assets a where a.site_id::text=(storage.foldername(name))[1]
      and a.id::text=(storage.foldername(name))[2]
      and private.can_access_site(a.site_id) and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)
  )
);

drop policy if exists work_order_media_storage_update on storage.objects;
create policy work_order_media_storage_update on storage.objects for update to authenticated
using (
  bucket_id='work-order-media' and exists (
    select 1 from public.work_orders wo where wo.site_id::text=(storage.foldername(name))[1]
      and wo.id::text=(storage.foldername(name))[2]
      and private.can_user_view_work_order(auth.uid(),wo.id)
  )
)
with check (
  bucket_id='work-order-media' and exists (
    select 1 from public.work_orders wo where wo.site_id::text=(storage.foldername(name))[1]
      and wo.id::text=(storage.foldername(name))[2]
      and private.can_user_view_work_order(auth.uid(),wo.id)
  )
);
create policy work_order_media_storage_delete_orphan on storage.objects for delete to authenticated
using (
  bucket_id='work-order-media'
  and not exists (select 1 from public.work_order_media wom where wom.storage_path=name)
  and exists (
    select 1 from public.work_orders wo where wo.site_id::text=(storage.foldername(name))[1]
      and wo.id::text=(storage.foldername(name))[2]
      and private.can_user_view_work_order(auth.uid(),wo.id)
  )
);

create or replace function public.restore_theme_version(
  p_site_id uuid,
  p_theme_version_id uuid,
  p_confirmation text default 'RESTAURAR'
)
returns public.active_themes
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  selected_version public.theme_versions;
  target_theme public.theme_presets;
  result public.active_themes;
begin
  caller := private.require_active_user();
  if p_confirmation is distinct from 'RESTAURAR' then
    raise exception using errcode='22023', message='Confirmação explícita obrigatória.';
  end if;
  if not private.can_access_site(p_site_id, caller) or
     not private.user_has_permission(caller, 'themes.manage') then
    raise exception using errcode='42501', message='Sem permissão para restaurar tema.';
  end if;

  select * into selected_version from public.theme_versions
  where id = p_theme_version_id;
  if selected_version.id is null then
    raise exception using errcode='P0002', message='Versão de tema não encontrada.';
  end if;

  select * into target_theme from public.theme_presets
  where id = selected_version.theme_id and active and archived_at is null;
  if target_theme.id is null then
    raise exception using errcode='P0002', message='Tema ativo não encontrado.';
  end if;

  insert into public.active_themes (site_id, theme_id, applied_version_id, applied_by, applied_at)
  values (p_site_id, target_theme.id, selected_version.id, caller, clock_timestamp())
  on conflict (site_id) do update set
    theme_id=excluded.theme_id,
    applied_version_id=excluded.applied_version_id,
    applied_by=excluded.applied_by,
    applied_at=excluded.applied_at
  returning * into result;

  return result;
end;
$$;
revoke all on function public.restore_theme_version(uuid,uuid,text) from public, anon;
grant execute on function public.restore_theme_version(uuid,uuid,text) to authenticated;

-- Avoid serving active SVG documents as branding assets.
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','image/x-icon']
where id='branding';

-- Realtime is optional in local stacks; add the receipt table idempotently.
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='notification_receipts'
  ) then
    alter publication supabase_realtime add table public.notification_receipts;
  end if;
end;
$$;

-- Assert the immutable seed rather than silently deploying a partial map.
do $$
begin
  if (select count(*) from public.postures where site_id='22222222-2222-4222-8222-222222222222') <> 48 then
    raise exception 'Seed físico incompleto: esperado 48 posturas.';
  end if;
  if (select count(*) from public.posture_layout_slots where site_id='22222222-2222-4222-8222-222222222222') <> 60 then
    raise exception 'Seed físico incompleto: esperado 60 slots.';
  end if;
  if (select count(*) from public.batteries) <> 199 then
    raise exception 'Seed físico incompleto: esperado 199 baterias.';
  end if;
end;
$$;
