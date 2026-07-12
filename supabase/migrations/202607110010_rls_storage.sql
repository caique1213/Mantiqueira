-- Deny-by-default RLS and private Storage buckets.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations','sites','sectors','roles','permissions','profiles','profile_roles',
    'role_permissions','site_memberships','audit_logs','asset_types','manufacturers',
    'asset_status_definitions','work_order_status_definitions','priority_definitions','problem_types',
    'app_settings','app_setting_versions','ui_modules','theme_presets','theme_versions','active_themes',
    'postures','posture_layout_slots','batteries','position_templates','asset_positions',
    'technical_models','assets','asset_motor_specs','asset_reducer_specs','asset_type_required_fields',
    'asset_installations','asset_relationships','asset_replacements','asset_events','asset_media',
    'work_orders','work_order_assignees','work_order_events','work_order_comments',
    'work_order_needed_items','work_order_media','sound_presets','notification_preferences',
    'notification_events','notification_receipts','favorites','report_exports'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Identity and access -------------------------------------------------------
create policy organizations_read on public.organizations for select to authenticated
using (private.is_active_user());
create policy sites_read on public.sites for select to authenticated
using (private.can_access_site(id));
create policy sectors_read on public.sectors for select to authenticated
using (private.is_active_user());
create policy roles_read on public.roles for select to authenticated
using (private.is_active_user());
create policy permissions_read on public.permissions for select to authenticated
using (private.is_active_user());
create policy profiles_read on public.profiles for select to authenticated
using (id = auth.uid() or private.has_permission('users.manage'));
create policy profile_roles_read on public.profile_roles for select to authenticated
using (profile_id = auth.uid() or private.has_permission('users.manage'));
create policy role_permissions_read on public.role_permissions for select to authenticated
using (private.is_active_user());
create policy site_memberships_read on public.site_memberships for select to authenticated
using (profile_id = auth.uid() or private.has_permission('users.manage'));
create policy audit_logs_read on public.audit_logs for select to authenticated
using (private.has_permission('audit.view'));

create policy roles_admin_write on public.roles for all to authenticated
using (private.has_permission('roles.manage')) with check (private.has_permission('roles.manage'));
create policy permissions_admin_write on public.permissions for all to authenticated
using (private.has_permission('roles.manage')) with check (private.has_permission('roles.manage'));
create policy role_permissions_admin_write on public.role_permissions for all to authenticated
using (private.has_permission('roles.manage')) with check (private.has_permission('roles.manage'));

-- Configurable catalogs ----------------------------------------------------
create policy asset_types_read on public.asset_types for select to authenticated using (private.is_active_user());
create policy manufacturers_read on public.manufacturers for select to authenticated using (private.is_active_user());
create policy asset_status_read on public.asset_status_definitions for select to authenticated using (private.is_active_user());
create policy work_order_status_read on public.work_order_status_definitions for select to authenticated using (private.is_active_user());
create policy priorities_read on public.priority_definitions for select to authenticated using (private.is_active_user());
create policy problem_types_read on public.problem_types for select to authenticated using (private.is_active_user());

create policy asset_types_admin_write on public.asset_types for all to authenticated
using (private.has_permission('models.manage')) with check (private.has_permission('models.manage'));
create policy manufacturers_admin_write on public.manufacturers for all to authenticated
using (private.has_permission('models.manage')) with check (private.has_permission('models.manage'));
create policy asset_status_admin_write on public.asset_status_definitions for all to authenticated
using (private.has_permission('settings.manage')) with check (private.has_permission('settings.manage'));
create policy work_order_status_admin_write on public.work_order_status_definitions for all to authenticated
using (private.has_permission('settings.manage')) with check (private.has_permission('settings.manage'));
create policy priorities_admin_write on public.priority_definitions for all to authenticated
using (private.has_permission('settings.manage')) with check (private.has_permission('settings.manage'));
create policy problem_types_admin_write on public.problem_types for all to authenticated
using (private.has_permission('settings.manage')) with check (private.has_permission('settings.manage'));

-- Settings and themes ------------------------------------------------------
create policy app_settings_read on public.app_settings for select to authenticated
using (private.is_active_user() and (public_read or private.has_permission('settings.manage')));
create policy app_setting_versions_read on public.app_setting_versions for select to authenticated
using (private.has_permission('settings.manage'));
create policy ui_modules_read on public.ui_modules for select to authenticated
using (private.is_active_user() and (required_permission is null or private.has_permission(required_permission)));
create policy theme_presets_read on public.theme_presets for select to authenticated
using (private.is_active_user() and active and archived_at is null);
create policy theme_versions_read on public.theme_versions for select to authenticated
using (private.is_active_user());
create policy active_themes_read on public.active_themes for select to authenticated
using (private.can_access_site(site_id));

-- Physical structure -------------------------------------------------------
create policy postures_read on public.postures for select to authenticated
using (private.has_permission('map.view') and private.can_access_site(site_id));
create policy layout_slots_read on public.posture_layout_slots for select to authenticated
using (private.has_permission('map.view') and private.can_access_site(site_id));
create policy batteries_read on public.batteries for select to authenticated
using (exists (select 1 from public.postures p where p.id=posture_id and private.can_access_site(p.site_id)));
create policy position_templates_read on public.position_templates for select to authenticated
using (private.has_permission('assets.view'));
create policy asset_positions_read on public.asset_positions for select to authenticated
using (private.has_permission('assets.view') and private.can_access_site(site_id));
create policy custom_position_templates_admin on public.position_templates for all to authenticated
using (private.has_permission('structure.manage') and not system)
with check (private.has_permission('structure.manage') and not system);
create policy custom_asset_positions_admin on public.asset_positions for insert to authenticated
with check (private.has_permission('structure.manage') and private.can_access_site(site_id));
create policy asset_positions_admin_update on public.asset_positions for update to authenticated
using (private.has_permission('structure.manage') and private.can_access_site(site_id))
with check (private.has_permission('structure.manage') and private.can_access_site(site_id));

-- Technical inventory ------------------------------------------------------
create policy technical_models_read on public.technical_models for select to authenticated
using (private.has_permission('assets.view'));
create policy technical_models_admin_write on public.technical_models for all to authenticated
using (private.has_permission('models.manage')) with check (private.has_permission('models.manage'));
create policy assets_read on public.assets for select to authenticated
using (private.has_permission('assets.view') and private.can_access_site(site_id));
create policy assets_insert on public.assets for insert to authenticated
with check (private.can_access_site(site_id) and private.can_edit_asset_type(auth.uid(),asset_type_id,false));
create policy assets_update on public.assets for update to authenticated
using (private.can_access_site(site_id) and private.can_edit_asset_type(auth.uid(),asset_type_id,false))
with check (private.can_access_site(site_id) and private.can_edit_asset_type(auth.uid(),asset_type_id,false));

create policy motor_specs_read on public.asset_motor_specs for select to authenticated
using (exists (select 1 from public.assets a where a.id=asset_id and private.has_permission('assets.view') and private.can_access_site(a.site_id)));
create policy motor_specs_write on public.asset_motor_specs for all to authenticated
using (exists (select 1 from public.assets a where a.id=asset_id and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)))
with check (exists (select 1 from public.assets a where a.id=asset_id and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)));
create policy reducer_specs_read on public.asset_reducer_specs for select to authenticated
using (exists (select 1 from public.assets a where a.id=asset_id and private.has_permission('assets.view') and private.can_access_site(a.site_id)));
create policy reducer_specs_write on public.asset_reducer_specs for all to authenticated
using (exists (select 1 from public.assets a where a.id=asset_id and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)))
with check (exists (select 1 from public.assets a where a.id=asset_id and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)));
create policy required_fields_read on public.asset_type_required_fields for select to authenticated using (private.is_active_user());
create policy required_fields_admin on public.asset_type_required_fields for all to authenticated
using (private.has_permission('models.manage')) with check (private.has_permission('models.manage'));

create policy installations_read on public.asset_installations for select to authenticated
using (exists (select 1 from public.assets a where a.id=asset_id and private.has_permission('assets.view') and private.can_access_site(a.site_id)));
create policy relationships_read on public.asset_relationships for select to authenticated
using (exists (select 1 from public.assets a where a.id=parent_asset_id and private.has_permission('assets.view') and private.can_access_site(a.site_id)));
create policy relationships_insert on public.asset_relationships for insert to authenticated
with check (exists (select 1 from public.assets a where a.id=parent_asset_id and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)));
create policy relationships_update on public.asset_relationships for update to authenticated
using (exists (select 1 from public.assets a where a.id=parent_asset_id and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)))
with check (exists (select 1 from public.assets a where a.id=parent_asset_id and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)));
create policy replacements_read on public.asset_replacements for select to authenticated
using (exists (select 1 from public.asset_positions ap where ap.id=asset_position_id and private.has_permission('assets.view') and private.can_access_site(ap.site_id)));
create policy asset_events_read on public.asset_events for select to authenticated
using (exists (select 1 from public.assets a where a.id=asset_id and private.has_permission('assets.view') and private.can_access_site(a.site_id)));
create policy asset_media_read on public.asset_media for select to authenticated
using (exists (select 1 from public.assets a where a.id=asset_id and private.has_permission('assets.view') and private.can_access_site(a.site_id)));

-- Work orders --------------------------------------------------------------
create policy work_orders_read on public.work_orders for select to authenticated
using (private.can_user_view_work_order(auth.uid(),id));
create policy work_order_assignees_read on public.work_order_assignees for select to authenticated
using (private.can_user_view_work_order(auth.uid(),work_order_id));
create policy work_order_events_read on public.work_order_events for select to authenticated
using (private.can_user_view_work_order(auth.uid(),work_order_id));
create policy work_order_comments_read on public.work_order_comments for select to authenticated
using (private.can_user_view_work_order(auth.uid(),work_order_id)
  and (not internal_only or private.user_has_permission(auth.uid(),'work_orders.execute')
    or private.user_has_permission(auth.uid(),'work_orders.view.all')));
create policy work_order_needed_items_read on public.work_order_needed_items for select to authenticated
using (private.can_user_view_work_order(auth.uid(),work_order_id));
create policy work_order_media_read on public.work_order_media for select to authenticated
using (private.can_user_view_work_order(auth.uid(),work_order_id));

-- Notifications, favorites and reports ------------------------------------
create policy sound_presets_read on public.sound_presets for select to authenticated using (private.is_active_user());
create policy notification_preferences_read on public.notification_preferences for select to authenticated
using (profile_id=auth.uid());
create policy notification_preferences_update on public.notification_preferences for update to authenticated
using (profile_id=auth.uid() and private.is_active_user()) with check (profile_id=auth.uid());
create policy notification_events_read on public.notification_events for select to authenticated
using (exists (select 1 from public.notification_receipts nr where nr.notification_event_id=id and nr.profile_id=auth.uid()));
create policy notification_receipts_read on public.notification_receipts for select to authenticated
using (profile_id=auth.uid());
create policy favorites_own on public.favorites for all to authenticated
using (profile_id=auth.uid() and private.is_active_user())
with check (profile_id=auth.uid() and private.is_active_user());
create policy report_exports_read on public.report_exports for select to authenticated
using (requested_by=auth.uid() or (private.has_permission('reports.view') and private.can_access_site(site_id)));
create policy report_exports_insert on public.report_exports for insert to authenticated
with check (requested_by=auth.uid() and private.has_permission('reports.view') and private.can_access_site(site_id));

-- Private Storage ----------------------------------------------------------
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
  ('asset-media','asset-media',false,26214400,array['image/jpeg','image/png','image/webp','application/pdf']),
  ('work-order-media','work-order-media',false,26214400,array['image/jpeg','image/png','image/webp','application/pdf']),
  ('branding','branding',false,10485760,array['image/jpeg','image/png','image/webp','image/svg+xml','image/x-icon']),
  ('report-exports','report-exports',false,52428800,array['application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set
  public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy asset_media_storage_read on storage.objects for select to authenticated
using (
  bucket_id='asset-media' and private.is_active_user()
  and exists (
    select 1 from public.assets a
    where a.site_id::text=(storage.foldername(name))[1]
      and a.id::text=(storage.foldername(name))[2]
      and private.has_permission('assets.view') and private.can_access_site(a.site_id)
  )
);
create policy asset_media_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id='asset-media' and exists (
    select 1 from public.assets a
    where a.site_id::text=(storage.foldername(name))[1]
      and a.id::text=(storage.foldername(name))[2]
      and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)
  )
);
create policy asset_media_storage_update on storage.objects for update to authenticated
using (bucket_id='asset-media' and exists (
  select 1 from public.assets a where a.site_id::text=(storage.foldername(name))[1]
    and a.id::text=(storage.foldername(name))[2]
    and private.can_edit_asset_type(auth.uid(),a.asset_type_id,false)
)) with check (bucket_id='asset-media');

create policy work_order_media_storage_read on storage.objects for select to authenticated
using (bucket_id='work-order-media' and exists (
  select 1 from public.work_orders wo
  where wo.site_id::text=(storage.foldername(name))[1]
    and wo.id::text=(storage.foldername(name))[2]
    and private.can_user_view_work_order(auth.uid(),wo.id)
));
create policy work_order_media_storage_insert on storage.objects for insert to authenticated
with check (bucket_id='work-order-media' and exists (
  select 1 from public.work_orders wo
  where wo.site_id::text=(storage.foldername(name))[1]
    and wo.id::text=(storage.foldername(name))[2]
    and private.can_user_view_work_order(auth.uid(),wo.id)
));
create policy work_order_media_storage_update on storage.objects for update to authenticated
using (bucket_id='work-order-media' and exists (
  select 1 from public.work_orders wo where wo.site_id::text=(storage.foldername(name))[1]
    and wo.id::text=(storage.foldername(name))[2]
    and private.can_user_view_work_order(auth.uid(),wo.id)
)) with check (bucket_id='work-order-media');

create policy branding_storage_read on storage.objects for select to authenticated
using (bucket_id='branding' and private.is_active_user()
  and exists (select 1 from public.sites s where s.id::text=(storage.foldername(name))[1] and private.can_access_site(s.id)));
create policy branding_storage_admin_insert on storage.objects for insert to authenticated
with check (bucket_id='branding' and private.has_permission('settings.manage')
  and exists (select 1 from public.sites s where s.id::text=(storage.foldername(name))[1] and private.can_access_site(s.id)));
create policy branding_storage_admin_update on storage.objects for update to authenticated
using (bucket_id='branding' and private.has_permission('settings.manage'))
with check (bucket_id='branding' and private.has_permission('settings.manage'));
create policy branding_storage_admin_delete on storage.objects for delete to authenticated
using (bucket_id='branding' and private.has_permission('settings.manage'));

create policy report_exports_storage_read on storage.objects for select to authenticated
using (bucket_id='report-exports' and exists (
  select 1 from public.report_exports re
  where re.site_id::text=(storage.foldername(name))[1]
    and re.id::text=(storage.foldername(name))[2]
    and (re.requested_by=auth.uid() or private.has_permission('reports.view'))
));

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active_user(uuid) to authenticated;
grant execute on function private.user_has_permission(uuid,text) to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.can_access_site(uuid,uuid) to authenticated;
grant execute on function private.can_user_view_work_order(uuid,uuid) to authenticated;
grant execute on function private.can_edit_asset_type(uuid,uuid,boolean) to authenticated;

