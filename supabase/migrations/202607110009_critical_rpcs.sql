-- Stable public RPC contracts. All critical state transitions are transactional,
-- permission checked and audited; the frontend never writes those tables directly.

create or replace function private.require_active_user()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null or not private.is_active_user(caller) then
    raise exception using errcode = '42501', message = 'Usuário autenticado e ativo é obrigatório.';
  end if;
  return caller;
end;
$$;

create or replace function private.can_edit_asset_type(
  user_id uuid,
  target_asset_type_id uuid,
  replacement boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case at.domain
    when 'electrical' then
      private.user_has_permission(user_id, case when replacement then 'assets.replace.electrical' else 'assets.edit.electrical' end)
      or private.user_has_permission(user_id, case when replacement then 'assets.replace.all' else 'assets.edit.all' end)
    when 'mechanical' then
      private.user_has_permission(user_id, case when replacement then 'assets.replace.mechanical' else 'assets.edit.mechanical' end)
      or private.user_has_permission(user_id, case when replacement then 'assets.replace.all' else 'assets.edit.all' end)
    else private.user_has_permission(user_id, case when replacement then 'assets.replace.all' else 'assets.edit.all' end)
  end
  from public.asset_types at
  where at.id = target_asset_type_id and at.active;
$$;

create or replace function public.get_my_access()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'profile', case when p.id is null then null else jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'active', p.active,
      'primary_sector_code', s.code,
      'timezone', p.timezone,
      'locale', p.locale
    ) end,
    'roles', coalesce((
      select jsonb_agg(r.code order by r.sort_order, r.code)
      from public.profile_roles pr join public.roles r on r.id = pr.role_id and r.active
      where pr.profile_id = auth.uid()
    ), '[]'::jsonb),
    'departments', coalesce((
      select jsonb_agg(distinct department)
      from (
        select s2.code as department from public.profiles p2
        join public.sectors s2 on s2.id = p2.primary_sector_id where p2.id = auth.uid()
      ) departments where department is not null
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(distinct permission_code order by permission_code)
      from (
        select perm.code as permission_code
        from public.profile_roles pr
        join public.roles r on r.id = pr.role_id and r.active
        join public.role_permissions rp on rp.role_id = r.id
        join public.permissions perm on perm.id = rp.permission_id
        where pr.profile_id = auth.uid()
      ) permission_rows
    ), '[]'::jsonb),
    'site_ids', coalesce((
      select jsonb_agg(sm.site_id order by sm.site_id)
      from public.site_memberships sm
      where sm.profile_id = auth.uid() and sm.active
    ), '[]'::jsonb)
  )
  from (select auth.uid() as id) current_user_id
  left join public.profiles p on p.id = current_user_id.id
  left join public.sectors s on s.id = p.primary_sector_id;
$$;

create or replace function public.app_bootstrap(p_site_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  selected_site uuid;
  result jsonb;
begin
  caller := private.require_active_user();
  selected_site := p_site_id;
  if selected_site is null then
    select sm.site_id into selected_site
    from public.site_memberships sm
    where sm.profile_id = caller and sm.active
    order by sm.created_at limit 1;
  end if;
  if selected_site is null or not private.can_access_site(selected_site, caller) then
    raise exception using errcode = '42501', message = 'Unidade não autorizada.';
  end if;

  select jsonb_build_object(
    'access', public.get_my_access(),
    'site', (select to_jsonb(s) - 'organization_id' from public.sites s where s.id = selected_site),
    'settings', coalesce((
      select jsonb_object_agg(a.key, a.value) from public.app_settings a
      where a.public_read or private.user_has_permission(caller, 'settings.manage')
    ), '{}'::jsonb),
    'active_theme', (
      select jsonb_build_object(
        'id', tp.id, 'key', tp.key, 'name', tp.name, 'tokens', coalesce(tv.tokens, tp.tokens),
        'schema_version', tp.schema_version, 'appearance', tp.appearance,
        'density', tp.density, 'preset_id', tp.preset_key,
        'kind', case when tp.system_preset then 'preset' else 'custom' end,
        'revision', coalesce(tv.version_number, 1), 'updated_at', tp.updated_at
      )
      from public.active_themes at join public.theme_presets tp on tp.id = at.theme_id
      left join public.theme_versions tv on tv.id = at.applied_version_id
      where at.site_id = selected_site
    ),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', m.slug, 'label', m.label, 'description', m.description,
        'icon', m.icon, 'route', m.route, 'sort_order', m.sort_order
      ) order by m.sort_order)
      from public.ui_modules m
      where m.visible and (m.required_permission is null or private.user_has_permission(caller, m.required_permission))
    ), '[]'::jsonb),
    'catalogs', jsonb_build_object(
      'sectors', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'color',color) order by sort_order), '[]') from public.sectors where active),
      'work_order_statuses', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'semantic_state',semantic_state,'is_terminal',is_terminal,'color',color,'icon',icon) order by sort_order), '[]') from public.work_order_status_definitions where active),
      'priorities', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'weight',weight,'sla_minutes',sla_minutes,'color',color,'icon',icon) order by sort_order), '[]') from public.priority_definitions where active),
      'asset_types', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'domain',domain,'icon',icon) order by sort_order), '[]') from public.asset_types where active),
      'problem_types', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'sector_id',sector_id,'code',code,'name',name) order by sort_order), '[]') from public.problem_types where active)
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.update_my_profile(
  p_display_name text,
  p_timezone text default 'America/Cuiaba',
  p_avatar_path text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  result public.profiles;
begin
  caller := private.require_active_user();
  if length(btrim(p_display_name)) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Nome inválido.';
  end if;
  update public.profiles
  set display_name = btrim(p_display_name), timezone = p_timezone, avatar_path = p_avatar_path
  where id = caller returning * into result;
  return result;
end;
$$;

create or replace function public.admin_manage_user(
  p_target_user_id uuid,
  p_active boolean,
  p_role_codes text[],
  p_primary_sector_id uuid default null,
  p_confirmation text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target public.profiles;
  role_count integer;
begin
  caller := private.require_active_user();
  if not private.user_has_permission(caller, 'users.manage') or
     not private.user_has_permission(caller, 'roles.manage') then
    raise exception using errcode = '42501', message = 'Permissão administrativa insuficiente.';
  end if;
  if p_confirmation is distinct from 'CONFIRMAR' then
    raise exception using errcode = '22023', message = 'Confirmação explícita obrigatória.';
  end if;
  if coalesce(cardinality(p_role_codes), 0) = 0 then
    raise exception using errcode = '22023', message = 'Informe pelo menos um perfil.';
  end if;
  if caller = p_target_user_id and not p_active then
    raise exception using errcode = '42501', message = 'Você não pode desativar a própria conta.';
  end if;
  select count(*) into role_count from public.roles where active and code = any(p_role_codes);
  if role_count <> cardinality(p_role_codes) then
    raise exception using errcode = '22023', message = 'Um ou mais perfis são inválidos.';
  end if;

  update public.profiles
  set active = p_active, primary_sector_id = p_primary_sector_id
  where id = p_target_user_id returning * into target;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'Usuário não encontrado.';
  end if;

  delete from public.profile_roles pr
  where pr.profile_id = p_target_user_id
    and not exists (select 1 from public.roles r where r.id = pr.role_id and r.code = any(p_role_codes));
  insert into public.profile_roles (profile_id, role_id, granted_by)
  select p_target_user_id, r.id, caller from public.roles r where r.code = any(p_role_codes)
  on conflict do nothing;
  return target;
end;
$$;

create or replace function public.create_physical_asset(
  p_site_id uuid,
  p_asset_type_id uuid,
  p_manufacturer_id uuid default null,
  p_technical_model_id uuid default null,
  p_internal_code text default null,
  p_serial_number text default null,
  p_criticality text default 'medium',
  p_nameplate_specs jsonb default '{}'::jsonb,
  p_notes text default '',
  p_data_source text default 'unknown'
)
returns public.assets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  result public.assets;
begin
  caller := private.require_active_user();
  if not private.can_access_site(p_site_id, caller) or
     not private.can_edit_asset_type(caller, p_asset_type_id, false) then
    raise exception using errcode = '42501', message = 'Sem permissão para cadastrar este tipo de ativo.';
  end if;
  insert into public.assets (
    site_id, asset_type_id, manufacturer_id, technical_model_id, internal_code,
    serial_number, criticality, nameplate_specs, notes, data_source, created_by
  ) values (
    p_site_id, p_asset_type_id, p_manufacturer_id, p_technical_model_id,
    nullif(btrim(p_internal_code), ''), nullif(btrim(p_serial_number), ''),
    p_criticality, coalesce(p_nameplate_specs, '{}'::jsonb), coalesce(p_notes, ''), p_data_source, caller
  ) returning * into result;
  insert into public.asset_events (asset_id, event_type, actor_id, details)
  values (result.id, 'created', caller, jsonb_build_object('source', p_data_source));
  return result;
end;
$$;

create or replace function public.update_physical_asset(
  p_asset_id uuid,
  p_patch jsonb,
  p_expected_updated_at timestamptz
)
returns public.assets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  current_asset public.assets;
  result public.assets;
  invalid_key text;
  requested_status_state text;
begin
  caller := private.require_active_user();
  select * into current_asset from public.assets where id = p_asset_id for update;
  if current_asset.id is null then raise exception using errcode = 'P0002', message = 'Ativo não encontrado.'; end if;
  if not private.can_access_site(current_asset.site_id, caller) or
     not private.can_edit_asset_type(caller, current_asset.asset_type_id, false) then
    raise exception using errcode = '42501', message = 'Sem permissão para editar este ativo.';
  end if;
  select key into invalid_key from jsonb_object_keys(p_patch) key
  where key <> all(array[
    'manufacturer_id','technical_model_id','status_id','internal_code','serial_number',
    'manufactured_on','criticality','nameplate_specs','notes','data_source','data_reviewed_at'
  ]) limit 1;
  if invalid_key is not null then
    raise exception using errcode = '22023', message = format('Campo não editável: %s', invalid_key);
  end if;
  if p_patch ? 'status_id' then
    select semantic_state into requested_status_state
    from public.asset_status_definitions where id=(p_patch->>'status_id')::uuid and active;
    if requested_status_state is null then
      raise exception using errcode = '22023', message = 'Estado de ativo inválido.';
    end if;
    if requested_status_state in ('active','removed') and (p_patch->>'status_id')::uuid is distinct from current_asset.status_id then
      raise exception using errcode = '23514', message = 'Estados Ativo e Removido são controlados pelos fluxos de instalação e remoção.';
    end if;
  end if;

  update public.assets set
    manufacturer_id = case when p_patch ? 'manufacturer_id' then nullif(p_patch->>'manufacturer_id','')::uuid else manufacturer_id end,
    technical_model_id = case when p_patch ? 'technical_model_id' then nullif(p_patch->>'technical_model_id','')::uuid else technical_model_id end,
    status_id = case when p_patch ? 'status_id' then (p_patch->>'status_id')::uuid else status_id end,
    internal_code = case when p_patch ? 'internal_code' then nullif(btrim(p_patch->>'internal_code'),'') else internal_code end,
    serial_number = case when p_patch ? 'serial_number' then nullif(btrim(p_patch->>'serial_number'),'') else serial_number end,
    manufactured_on = case when p_patch ? 'manufactured_on' then nullif(p_patch->>'manufactured_on','')::date else manufactured_on end,
    criticality = case when p_patch ? 'criticality' then p_patch->>'criticality' else criticality end,
    nameplate_specs = case when p_patch ? 'nameplate_specs' then p_patch->'nameplate_specs' else nameplate_specs end,
    notes = case when p_patch ? 'notes' then coalesce(p_patch->>'notes','') else notes end,
    data_source = case when p_patch ? 'data_source' then p_patch->>'data_source' else data_source end,
    data_reviewed_at = case when p_patch ? 'data_reviewed_at' then nullif(p_patch->>'data_reviewed_at','')::timestamptz else data_reviewed_at end,
    data_reviewed_by = case when p_patch ? 'data_reviewed_at' then caller else data_reviewed_by end
  where id = p_asset_id and updated_at = p_expected_updated_at
  returning * into result;
  if result.id is null then
    raise exception using errcode = '40001', message = 'O ativo foi alterado por outra pessoa. Recarregue antes de salvar.';
  end if;
  insert into public.asset_events (asset_id, event_type, actor_id, details)
  values (result.id, 'updated', caller, jsonb_build_object('fields', (select jsonb_agg(key) from jsonb_object_keys(p_patch) key)));
  return result;
end;
$$;

create or replace function public.save_asset_technical_specs(p_asset_id uuid, p_specs jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target_asset public.assets;
  type_code text;
begin
  caller := private.require_active_user();
  select a.* into target_asset
  from public.assets a
  where a.id = p_asset_id;
  select t.code into type_code
  from public.asset_types t
  where t.id = target_asset.asset_type_id;
  if target_asset.id is null or not private.can_access_site(target_asset.site_id, caller) or
     not private.can_edit_asset_type(caller, target_asset.asset_type_id, false) then
    raise exception using errcode = '42501', message = 'Sem permissão para editar especificações.';
  end if;
  if type_code = 'motor' then
    insert into public.asset_motor_specs (
      asset_id, rated_power_kw, rated_power_cv, voltage_v, current_a, frequency_hz,
      rpm, poles, connection, frame, ip_rating, insulation_class, efficiency_percent,
      power_factor, duty, bearing_de, bearing_nde
    ) values (
      p_asset_id, nullif(p_specs->>'rated_power_kw','')::numeric, nullif(p_specs->>'rated_power_cv','')::numeric,
      case when jsonb_typeof(p_specs->'voltage_v')='array' then array(select jsonb_array_elements_text(p_specs->'voltage_v')::integer) end,
      case when jsonb_typeof(p_specs->'current_a')='array' then array(select jsonb_array_elements_text(p_specs->'current_a')::numeric) end,
      nullif(p_specs->>'frequency_hz','')::numeric, nullif(p_specs->>'rpm','')::integer,
      nullif(p_specs->>'poles','')::smallint, p_specs->>'connection', p_specs->>'frame', p_specs->>'ip_rating',
      p_specs->>'insulation_class', nullif(p_specs->>'efficiency_percent','')::numeric,
      nullif(p_specs->>'power_factor','')::numeric, p_specs->>'duty', p_specs->>'bearing_de', p_specs->>'bearing_nde'
    ) on conflict (asset_id) do update set
      rated_power_kw=excluded.rated_power_kw, rated_power_cv=excluded.rated_power_cv,
      voltage_v=excluded.voltage_v, current_a=excluded.current_a, frequency_hz=excluded.frequency_hz,
      rpm=excluded.rpm, poles=excluded.poles, connection=excluded.connection, frame=excluded.frame,
      ip_rating=excluded.ip_rating, insulation_class=excluded.insulation_class,
      efficiency_percent=excluded.efficiency_percent, power_factor=excluded.power_factor,
      duty=excluded.duty, bearing_de=excluded.bearing_de, bearing_nde=excluded.bearing_nde;
  elsif type_code = 'reducer' then
    insert into public.asset_reducer_specs (
      asset_id, reducer_type, ratio, input_rpm, output_rpm, torque_nm,
      mounting_position, oil_type, oil_quantity_l, output_shaft
    ) values (
      p_asset_id, p_specs->>'reducer_type', nullif(p_specs->>'ratio','')::numeric,
      nullif(p_specs->>'input_rpm','')::numeric, nullif(p_specs->>'output_rpm','')::numeric,
      nullif(p_specs->>'torque_nm','')::numeric, p_specs->>'mounting_position', p_specs->>'oil_type',
      nullif(p_specs->>'oil_quantity_l','')::numeric, p_specs->>'output_shaft'
    ) on conflict (asset_id) do update set
      reducer_type=excluded.reducer_type, ratio=excluded.ratio, input_rpm=excluded.input_rpm,
      output_rpm=excluded.output_rpm, torque_nm=excluded.torque_nm,
      mounting_position=excluded.mounting_position, oil_type=excluded.oil_type,
      oil_quantity_l=excluded.oil_quantity_l, output_shaft=excluded.output_shaft;
  else
    raise exception using errcode = '22023', message = 'Este tipo de ativo não possui ficha técnica especializada.';
  end if;
  insert into public.asset_events (asset_id, event_type, actor_id, details)
  values (p_asset_id, 'updated', caller, jsonb_build_object('technical_specs', type_code));
  return p_specs;
end;
$$;

create or replace function public.install_asset(
  p_asset_id uuid,
  p_asset_position_id uuid,
  p_installed_at timestamptz default clock_timestamp(),
  p_reason text default '',
  p_work_order_id uuid default null
)
returns public.asset_installations
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target_asset public.assets;
  target_position public.asset_positions;
  result public.asset_installations;
begin
  caller := private.require_active_user();
  select * into target_asset from public.assets where id = p_asset_id and archived_at is null for update;
  select * into target_position from public.asset_positions where id = p_asset_position_id and active for update;
  if target_asset.id is null or target_position.id is null then
    raise exception using errcode = 'P0002', message = 'Ativo ou posição não encontrado.';
  end if;
  if p_installed_at > clock_timestamp() + interval '5 minutes' then
    raise exception using errcode = '22007', message = 'A data de instalação não pode estar no futuro.';
  end if;
  if not private.can_access_site(target_asset.site_id, caller) or
     not private.can_edit_asset_type(caller, target_asset.asset_type_id, false) then
    raise exception using errcode = '42501', message = 'Sem permissão para instalar este ativo.';
  end if;
  if p_work_order_id is not null and not exists (
    select 1 from public.work_orders wo
    where wo.id=p_work_order_id and wo.site_id=target_asset.site_id
      and (wo.asset_id is null or wo.asset_id=target_asset.id)
      and (wo.asset_position_id is null or wo.asset_position_id=target_position.id)
      and private.can_user_view_work_order(caller, wo.id)
  ) then
    raise exception using errcode = '42501', message = 'OS relacionada incompatível com o ativo ou a posição.';
  end if;
  insert into public.asset_installations (
    asset_id, asset_position_id, installed_at, installation_reason, work_order_id, installed_by
  ) values (p_asset_id, p_asset_position_id, p_installed_at, coalesce(p_reason,''), p_work_order_id, caller)
  returning * into result;
  update public.assets set status_id = '62000000-0000-4000-8000-000000000001' where id = p_asset_id;
  insert into public.asset_events (asset_id, installation_id, event_type, occurred_at, work_order_id, actor_id, details)
  values (p_asset_id, result.id, 'installed', p_installed_at, p_work_order_id, caller,
    jsonb_build_object('asset_position_id', p_asset_position_id, 'reason', coalesce(p_reason,'')));
  return result;
end;
$$;

create or replace function public.remove_asset(
  p_installation_id uuid,
  p_removed_at timestamptz,
  p_reason text,
  p_work_order_id uuid default null,
  p_notes text default '',
  p_confirmation text default null
)
returns public.asset_installations
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  current_installation public.asset_installations;
  target_asset public.assets;
  result public.asset_installations;
begin
  caller := private.require_active_user();
  if p_confirmation is distinct from 'REMOVER' then
    raise exception using errcode = '22023', message = 'Digite REMOVER para confirmar a remoção.';
  end if;
  select * into current_installation from public.asset_installations
  where id = p_installation_id for update;
  if current_installation.id is null or current_installation.removed_at is not null then
    raise exception using errcode = 'P0002', message = 'Instalação ativa não encontrada.';
  end if;
  select * into target_asset from public.assets where id = current_installation.asset_id for update;
  if not private.can_access_site(target_asset.site_id, caller) or
     not private.can_edit_asset_type(caller, target_asset.asset_type_id, true) then
    raise exception using errcode = '42501', message = 'Sem permissão para remover este ativo.';
  end if;
  if length(btrim(p_reason)) < 3 then
    raise exception using errcode = '22023', message = 'Informe o motivo da remoção.';
  end if;
  if p_removed_at > clock_timestamp() + interval '5 minutes' then
    raise exception using errcode = '22007', message = 'A data de remoção não pode estar no futuro.';
  end if;
  if p_work_order_id is not null and not exists (
    select 1 from public.work_orders wo
    where wo.id=p_work_order_id and wo.site_id=target_asset.site_id
      and (wo.asset_id is null or wo.asset_id=target_asset.id)
      and (wo.asset_position_id is null or wo.asset_position_id=current_installation.asset_position_id)
      and private.can_user_view_work_order(caller, wo.id)
  ) then
    raise exception using errcode = '42501', message = 'OS relacionada incompatível com a remoção.';
  end if;
  update public.asset_installations set
    removed_at = p_removed_at, removal_reason = btrim(p_reason), removed_by = caller,
    work_order_id = coalesce(p_work_order_id, work_order_id)
  where id = p_installation_id returning * into result;
  update public.assets set status_id = '62000000-0000-4000-8000-000000000003'
  where id = current_installation.asset_id;
  insert into public.asset_events (asset_id, installation_id, event_type, occurred_at, work_order_id, actor_id, details)
  values (current_installation.asset_id, current_installation.id, 'removed', p_removed_at,
    p_work_order_id, caller, jsonb_build_object('reason', btrim(p_reason), 'notes', coalesce(p_notes,'')));
  return result;
end;
$$;

create or replace function public.replace_asset(
  p_current_installation_id uuid,
  p_new_asset_id uuid,
  p_replaced_at timestamptz,
  p_reason text,
  p_work_order_id uuid default null,
  p_notes text default ''
)
returns public.asset_replacements
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  old_installation public.asset_installations;
  old_asset public.assets;
  new_asset public.assets;
  new_installation public.asset_installations;
  result public.asset_replacements;
begin
  caller := private.require_active_user();
  select * into old_installation from public.asset_installations
  where id = p_current_installation_id for update;
  if old_installation.id is null or old_installation.removed_at is not null then
    raise exception using errcode = 'P0002', message = 'Instalação atual não encontrada.';
  end if;
  select * into old_asset from public.assets where id = old_installation.asset_id for update;
  select * into new_asset from public.assets where id = p_new_asset_id and archived_at is null for update;
  if new_asset.id is null then raise exception using errcode = 'P0002', message = 'Novo ativo não encontrado.'; end if;
  if old_asset.asset_type_id <> new_asset.asset_type_id or old_asset.site_id <> new_asset.site_id then
    raise exception using errcode = '23514', message = 'A substituição exige ativos do mesmo tipo e unidade.';
  end if;
  if not private.can_access_site(old_asset.site_id, caller) or
     not private.can_edit_asset_type(caller, old_asset.asset_type_id, true) then
    raise exception using errcode = '42501', message = 'Sem permissão para substituir este ativo.';
  end if;
  if length(btrim(p_reason)) < 3 then
    raise exception using errcode = '22023', message = 'Informe o motivo da substituição.';
  end if;
  if p_replaced_at <= old_installation.installed_at then
    raise exception using errcode = '22007', message = 'Data de substituição inválida.';
  end if;
  if p_replaced_at > clock_timestamp() + interval '5 minutes' then
    raise exception using errcode = '22007', message = 'A data de substituição não pode estar no futuro.';
  end if;
  if exists (select 1 from public.asset_installations where asset_id = p_new_asset_id and removed_at is null) then
    raise exception using errcode = '23505', message = 'O novo ativo já está instalado em outra posição.';
  end if;
  if p_work_order_id is not null and not exists (
    select 1 from public.work_orders wo
    where wo.id=p_work_order_id and wo.site_id=old_asset.site_id
      and (wo.asset_id is null or wo.asset_id=old_asset.id)
      and (wo.asset_position_id is null or wo.asset_position_id=old_installation.asset_position_id)
      and private.can_user_view_work_order(caller, wo.id)
  ) then
    raise exception using errcode = '42501', message = 'OS relacionada incompatível com a substituição.';
  end if;

  update public.asset_installations set
    removed_at = p_replaced_at, removal_reason = btrim(p_reason), removed_by = caller,
    work_order_id = coalesce(p_work_order_id, work_order_id)
  where id = old_installation.id;
  update public.assets set status_id = '62000000-0000-4000-8000-000000000003'
  where id = old_asset.id;

  insert into public.asset_installations (
    asset_id, asset_position_id, installed_at, installation_reason, work_order_id, installed_by
  ) values (
    p_new_asset_id, old_installation.asset_position_id, p_replaced_at,
    'Substituição: ' || btrim(p_reason), p_work_order_id, caller
  ) returning * into new_installation;
  update public.assets set status_id = '62000000-0000-4000-8000-000000000001'
  where id = new_asset.id;

  insert into public.asset_replacements (
    asset_position_id, removed_installation_id, installed_installation_id,
    replaced_at, reason, notes, work_order_id, performed_by
  ) values (
    old_installation.asset_position_id, old_installation.id, new_installation.id,
    p_replaced_at, btrim(p_reason), coalesce(p_notes,''), p_work_order_id, caller
  ) returning * into result;

  insert into public.asset_events (asset_id, installation_id, event_type, occurred_at, work_order_id, actor_id, details) values
    (old_asset.id, old_installation.id, 'replaced', p_replaced_at, p_work_order_id, caller,
      jsonb_build_object('replacement_id', result.id, 'replaced_by_asset_id', new_asset.id, 'reason', btrim(p_reason))),
    (new_asset.id, new_installation.id, 'installed', p_replaced_at, p_work_order_id, caller,
      jsonb_build_object('replacement_id', result.id, 'replaced_asset_id', old_asset.id, 'reason', btrim(p_reason)));
  return result;
end;
$$;

create or replace function public.archive_asset(p_asset_id uuid, p_confirmation text)
returns public.assets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target public.assets;
begin
  caller := private.require_active_user();
  select * into target from public.assets where id = p_asset_id for update;
  if target.id is null then raise exception using errcode = 'P0002', message = 'Ativo não encontrado.'; end if;
  if not private.can_access_site(target.site_id, caller) or
     not private.can_edit_asset_type(caller, target.asset_type_id, false) then
    raise exception using errcode = '42501', message = 'Sem permissão para arquivar este ativo.';
  end if;
  if p_confirmation is distinct from 'ARQUIVAR' then
    raise exception using errcode = '22023', message = 'Digite ARQUIVAR para confirmar.';
  end if;
  if exists (select 1 from public.asset_installations where asset_id = p_asset_id and removed_at is null) then
    raise exception using errcode = '23514', message = 'Remova o ativo da posição antes de arquivá-lo.';
  end if;
  update public.assets set archived_at = clock_timestamp(), status_id = '62000000-0000-4000-8000-000000000002'
  where id = p_asset_id returning * into target;
  insert into public.asset_events (asset_id, event_type, actor_id)
  values (target.id, 'archived', caller);
  return target;
end;
$$;

create or replace function public.open_work_order(
  p_posture_id uuid,
  p_sector_id uuid,
  p_priority_id uuid,
  p_description text,
  p_battery_id uuid default null,
  p_asset_position_id uuid default null,
  p_asset_id uuid default null,
  p_problem_type_id uuid default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  selected_site uuid;
  selected_battery uuid := p_battery_id;
  selected_position uuid := p_asset_position_id;
  selected_asset uuid := p_asset_id;
  selected_installation uuid;
  selected_priority uuid := p_priority_id;
  sla integer;
  result public.work_orders;
begin
  caller := private.require_active_user();
  if not private.user_has_permission(caller, 'work_orders.create') then
    raise exception using errcode = '42501', message = 'Sem permissão para abrir OS.';
  end if;
  select site_id into selected_site from public.postures where id = p_posture_id and active;
  if selected_site is null or not private.can_access_site(selected_site, caller) then
    raise exception using errcode = '42501', message = 'Postura não autorizada.';
  end if;
  if selected_asset is not null and selected_position is null then
    select ai.id, ai.asset_position_id, ap.battery_id
      into selected_installation, selected_position, selected_battery
    from public.asset_installations ai
    join public.asset_positions ap on ap.id = ai.asset_position_id
    where ai.asset_id = selected_asset and ai.removed_at is null;
  elsif selected_asset is not null and selected_position is not null then
    select id into selected_installation from public.asset_installations
    where asset_id = selected_asset and asset_position_id = selected_position and removed_at is null;
  end if;
  if selected_position is not null then
    if not exists (
      select 1 from public.asset_positions ap
      where ap.id=selected_position and ap.posture_id=p_posture_id and ap.site_id=selected_site and ap.active
    ) then
      raise exception using errcode = '23514', message = 'A posição não pertence à postura informada.';
    end if;
    select battery_id into selected_battery from public.asset_positions where id = selected_position;
    if selected_asset is null then
      select ai.id, ai.asset_id into selected_installation, selected_asset
      from public.asset_installations ai
      where ai.asset_position_id=selected_position and ai.removed_at is null;
    elsif selected_installation is null then
      raise exception using errcode = '23514', message = 'O ativo não está instalado na posição informada.';
    end if;
  elsif selected_asset is not null then
    raise exception using errcode = '23514', message = 'A OS de um ativo exige uma instalação ativa.';
  end if;
  if selected_asset is not null and exists (
    select 1 from public.assets where id = selected_asset and criticality = 'critical'
  ) then
    selected_priority := '64000000-0000-4000-8000-000000000004';
  end if;
  select sla_minutes into sla from public.priority_definitions where id = selected_priority and active;
  if not exists (select 1 from public.sectors where id = p_sector_id and active) then
    raise exception using errcode = '22023', message = 'Setor inválido.';
  end if;
  if p_problem_type_id is not null and not exists (
    select 1 from public.problem_types pt
    where pt.id = p_problem_type_id and pt.active and (pt.sector_id is null or pt.sector_id = p_sector_id)
  ) then
    raise exception using errcode = '22023', message = 'Tipo de problema incompatível com o setor.';
  end if;

  insert into public.work_orders (
    site_id, posture_id, battery_id, asset_position_id, asset_id, asset_installation_id,
    sector_id, problem_type_id, priority_id, status_id, description, opened_by, due_at
  ) values (
    selected_site, p_posture_id, selected_battery, selected_position, selected_asset, selected_installation,
    p_sector_id, p_problem_type_id, selected_priority,
    '63000000-0000-4000-8000-000000000001', btrim(p_description), caller,
    case when sla is null then null else clock_timestamp() + make_interval(mins => sla) end
  ) returning * into result;
  insert into public.work_order_events (work_order_id, event_type, actor_id, to_status_id, details)
  values (result.id, 'opened', caller, result.status_id,
    jsonb_build_object('priority_id', result.priority_id, 'posture_id', result.posture_id));
  if result.asset_id is not null then
    insert into public.asset_events (asset_id, installation_id, event_type, work_order_id, actor_id, details)
    values (result.asset_id, result.asset_installation_id, 'work_order', result.id, caller,
      jsonb_build_object('work_order_number', result.number, 'action', 'opened'));
  end if;
  return result;
end;
$$;

create or replace function public.assign_work_order(
  p_work_order_id uuid,
  p_assignee_id uuid default auth.uid()
)
returns public.work_orders
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target public.work_orders;
  result public.work_orders;
begin
  caller := private.require_active_user();
  select * into target from public.work_orders where id = p_work_order_id for update;
  if target.id is null then raise exception using errcode = 'P0002', message = 'OS não encontrada.'; end if;
  if not private.can_user_view_work_order(caller, target.id) or
     not private.user_has_permission(caller, 'work_orders.assign') then
    raise exception using errcode = '42501', message = 'Sem permissão para assumir esta OS.';
  end if;
  if p_assignee_id <> caller and not private.user_has_permission(caller, 'work_orders.assign.any') then
    raise exception using errcode = '42501', message = 'Você só pode atribuir a OS a si mesmo.';
  end if;
  if not private.can_user_view_work_order(p_assignee_id, target.id) then
    raise exception using errcode = '42501', message = 'O responsável escolhido não pode atender esta OS.';
  end if;
  if exists (
    select 1 from public.work_order_status_definitions where id = target.status_id and is_terminal
  ) then
    raise exception using errcode = '23514', message = 'OS finalizada não aceita atribuição.';
  end if;

  update public.work_order_assignees set unassigned_at = clock_timestamp()
  where work_order_id = target.id and unassigned_at is null and profile_id <> p_assignee_id;
  insert into public.work_order_assignees (work_order_id, profile_id, assigned_by)
  select target.id, p_assignee_id, caller
  where not exists (
    select 1 from public.work_order_assignees
    where work_order_id = target.id and profile_id = p_assignee_id and unassigned_at is null
  );
  update public.work_orders set assigned_to = p_assignee_id, assigned_at = clock_timestamp()
  where id = target.id returning * into result;
  insert into public.work_order_events (work_order_id, event_type, actor_id, details)
  values (result.id, 'assigned', caller, jsonb_build_object('assignee_id', p_assignee_id));
  return result;
end;
$$;

create or replace function public.transition_work_order(
  p_work_order_id uuid,
  p_target_status_code text,
  p_note text default '',
  p_diagnosis text default null,
  p_root_cause text default null,
  p_work_performed text default null,
  p_confirmation text default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target public.work_orders;
  current_state text;
  target_status uuid;
  next_state text;
  event_name text := 'status_changed';
  result public.work_orders;
begin
  caller := private.require_active_user();
  select * into target from public.work_orders where id = p_work_order_id for update;
  if target.id is null then raise exception using errcode = 'P0002', message = 'OS não encontrada.'; end if;
  if not private.can_user_view_work_order(caller, target.id) then
    raise exception using errcode = '42501', message = 'OS não autorizada.';
  end if;
  select semantic_state into current_state from public.work_order_status_definitions where id = target.status_id;
  select id, semantic_state into target_status, next_state
  from public.work_order_status_definitions
  where code = p_target_status_code and active;
  if target_status is null then raise exception using errcode = '22023', message = 'Status de destino inválido.'; end if;
  if current_state = next_state then return target; end if;

  if current_state in ('resolved','cancelled') then
    if next_state <> 'awaiting' or not private.user_has_permission(caller, 'work_orders.reopen') or
       p_confirmation is distinct from 'REABRIR' then
      raise exception using errcode = '42501', message = 'Reabertura administrativa exige confirmação REABRIR.';
    end if;
    event_name := 'reopened';
  elsif not (
    (current_state = 'awaiting' and next_state in ('in_progress','cancelled')) or
    (current_state = 'in_progress' and next_state in ('waiting_part','resolved','cancelled')) or
    (current_state = 'waiting_part' and next_state in ('in_progress','resolved','cancelled'))
  ) then
    raise exception using errcode = '23514', message = format('Transição inválida: %s → %s.', current_state, next_state);
  end if;

  if next_state in ('in_progress','waiting_part') and
     not private.user_has_permission(caller, 'work_orders.execute') then
    raise exception using errcode = '42501', message = 'Sem permissão para executar esta OS.';
  end if;
  if next_state = 'resolved' and not private.user_has_permission(caller, 'work_orders.resolve') then
    raise exception using errcode = '42501', message = 'Sem permissão para resolver esta OS.';
  end if;
  if next_state = 'cancelled' and not private.user_has_permission(caller, 'work_orders.cancel') then
    raise exception using errcode = '42501', message = 'Sem permissão para cancelar esta OS.';
  end if;
  if next_state = 'cancelled' and (
    p_confirmation is distinct from 'CANCELAR' or length(btrim(coalesce(p_note,''))) < 3
  ) then
    raise exception using errcode = '22023', message = 'Cancelamento exige motivo e confirmação CANCELAR.';
  end if;
  if next_state <> 'cancelled' and next_state <> 'awaiting' and target.assigned_to is distinct from caller and
     not private.user_has_permission(caller, 'work_orders.assign.any') then
    raise exception using errcode = '42501', message = 'Assuma a OS antes de executar ações operacionais.';
  end if;
  if next_state = 'resolved' and (
    length(btrim(coalesce(p_diagnosis, target.diagnosis))) < 3 or
    length(btrim(coalesce(p_work_performed, target.work_performed))) < 3
  ) then
    raise exception using errcode = '22023', message = 'Diagnóstico e serviço realizado são obrigatórios para resolver.';
  end if;
  if next_state = 'in_progress' and current_state = 'awaiting' then event_name := 'started'; end if;
  if next_state = 'resolved' then event_name := 'resolved'; end if;
  if next_state = 'cancelled' then event_name := 'cancelled'; end if;

  update public.work_orders set
    status_id = target_status,
    diagnosis = coalesce(p_diagnosis, diagnosis),
    root_cause = coalesce(p_root_cause, root_cause),
    work_performed = coalesce(p_work_performed, work_performed),
    started_at = case when next_state = 'in_progress' then coalesce(started_at, clock_timestamp()) else started_at end,
    resolved_at = case when next_state = 'resolved' then clock_timestamp() when event_name = 'reopened' then null else resolved_at end,
    cancelled_at = case when next_state = 'cancelled' then clock_timestamp() when event_name = 'reopened' then null else cancelled_at end,
    closed_by = case when next_state in ('resolved','cancelled') then caller when event_name = 'reopened' then null else closed_by end,
    reopened_count = reopened_count + case when event_name = 'reopened' then 1 else 0 end
  where id = target.id returning * into result;

  insert into public.work_order_events (work_order_id, event_type, actor_id, from_status_id, to_status_id, details)
  values (result.id, event_name, caller, target.status_id, target_status,
    jsonb_build_object('note', coalesce(p_note,'')));
  if length(btrim(coalesce(p_note,''))) > 0 then
    insert into public.work_order_comments (work_order_id, author_id, body)
    values (result.id, caller, btrim(p_note));
  end if;
  return result;
end;
$$;

create or replace function public.add_work_order_comment(
  p_work_order_id uuid,
  p_body text,
  p_internal_only boolean default false
)
returns public.work_order_comments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  result public.work_order_comments;
begin
  caller := private.require_active_user();
  if not private.can_user_view_work_order(caller, p_work_order_id) then
    raise exception using errcode = '42501', message = 'OS não autorizada.';
  end if;
  if exists (
    select 1 from public.work_orders wo join public.work_order_status_definitions st on st.id = wo.status_id
    where wo.id = p_work_order_id and st.is_terminal
  ) then
    raise exception using errcode = '23514', message = 'OS finalizada é somente leitura.';
  end if;
  if p_internal_only and not (
    private.user_has_permission(caller, 'work_orders.execute') or
    private.user_has_permission(caller, 'work_orders.view.all')
  ) then
    raise exception using errcode = '42501', message = 'Comentário interno é restrito à equipe técnica.';
  end if;
  insert into public.work_order_comments (work_order_id, author_id, body, internal_only)
  values (p_work_order_id, caller, btrim(p_body), p_internal_only) returning * into result;
  insert into public.work_order_events (work_order_id, event_type, actor_id, details)
  values (p_work_order_id, 'commented', caller, jsonb_build_object('comment_id', result.id));
  return result;
end;
$$;

create or replace function public.add_work_order_needed_item(
  p_work_order_id uuid,
  p_description text,
  p_code text default null,
  p_manufacturer text default null,
  p_estimated_quantity numeric default 1,
  p_unit text default 'un',
  p_notes text default ''
)
returns public.work_order_needed_items
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  result public.work_order_needed_items;
begin
  caller := private.require_active_user();
  if not private.can_user_view_work_order(caller, p_work_order_id) or
     not private.user_has_permission(caller, 'work_orders.execute') then
    raise exception using errcode = '42501', message = 'Sem permissão para registrar peça necessária.';
  end if;
  if exists (
    select 1 from public.work_orders wo join public.work_order_status_definitions st on st.id=wo.status_id
    where wo.id=p_work_order_id and st.is_terminal
  ) then
    raise exception using errcode = '23514', message = 'OS finalizada é somente leitura.';
  end if;
  insert into public.work_order_needed_items (
    work_order_id, description, code, manufacturer, estimated_quantity, unit, notes, requested_by
  ) values (
    p_work_order_id, btrim(p_description), nullif(btrim(p_code),''), nullif(btrim(p_manufacturer),''),
    p_estimated_quantity, p_unit, coalesce(p_notes,''), caller
  ) returning * into result;
  insert into public.work_order_events (work_order_id, event_type, actor_id, details)
  values (p_work_order_id, 'needed_item', caller, jsonb_build_object('needed_item_id', result.id));
  return result;
end;
$$;

-- Keep the database contract byte-for-byte aligned with the V1 frontend token
-- registry. The first theme migration intentionally predates that registry;
-- this reconciliation upgrades all six baseline rows before adding strict checks.
alter table public.theme_presets disable trigger themes_protect_system;
alter table public.theme_versions disable trigger theme_versions_immutable;
do $$
declare
  industrial jsonb := '{"colorBg":"#0B0D10","colorBgSecondary":"#101319","colorSurface":"#15191F","colorSurfaceRaised":"#1C222A","colorCard":"#171C23","colorMenu":"#0E1116","colorHeader":"#101319","colorFooter":"#0B0D10","colorText":"#F5F7FA","colorTextMuted":"#9AA2AD","colorBorder":"#2B323C","colorInput":"#10151B","colorInputText":"#F5F7FA","colorInputBorder":"#39424E","colorIcon":"#D3D8DF","colorBadge":"#2B2411","colorBadgeText":"#FFE18A","colorMarker":"#F6B900","colorPrimary":"#F6B900","colorPrimaryContrast":"#171104","colorSecondary":"#D28B00","colorSecondaryContrast":"#1C1200","colorAccent":"#FFCB3D","colorDanger":"#E5484D","colorDangerContrast":"#FFFFFF","colorSuccess":"#35B979","colorWarning":"#F39C12","colorInfo":"#4C9AFF","colorButtonPrimary":"#F6B900","colorButtonPrimaryText":"#171104","colorButtonPrimaryHover":"#FFD248","colorButtonSecondary":"#252C35","colorButtonSecondaryText":"#F5F7FA","colorButtonSecondaryHover":"#343D49","colorButtonDanger":"#C93D42","colorButtonDangerText":"#FFFFFF","colorButtonDangerHover":"#E5484D","statusAwaiting":"#F6B900","statusInProgress":"#4C9AFF","statusWaitingPart":"#EF8B2C","statusResolved":"#35B979","statusCancelled":"#7E8794","priorityLow":"#7E8794","priorityNormal":"#4C9AFF","priorityHigh":"#F39C12","priorityCritical":"#E5484D","mapEmpty":"#11151A","mapPosture":"#252C35","mapActive":"#F6B900","mapHighlight":"#FFD248","mapSelected":"#FFFFFF","mapHeatLow":"#265B49","mapHeatMedium":"#A36B12","mapHeatHigh":"#C93D42","assetMotor":"#F6B900","assetReducer":"#AEB5BF","batteryCage":"#20252C","batteryNylon":"#3E8FEA","batteryWhiteConveyor":"#E98224","batteryFeedCart":"#8B939E","batteryElevator":"#D73F44","fontFamilyBody":"Inter, ui-sans-serif, system-ui, sans-serif","fontFamilyHeading":"Inter, ui-sans-serif, system-ui, sans-serif","fontFamilyMono":"ui-monospace, SFMono-Regular, Consolas, monospace","fontScale":"1","fontSizeTitle":"2.25rem","fontSizeText":"1rem","fontSizeXs":"0.75rem","fontSizeSm":"0.875rem","fontSizeMd":"1rem","fontSizeLg":"1.125rem","fontSizeXl":"1.375rem","fontSize2xl":"1.75rem","fontSize3xl":"2.25rem","fontWeightRegular":"400","fontWeightMedium":"500","fontWeightSemibold":"650","fontWeightBold":"780","lineHeightTight":"1.18","lineHeightNormal":"1.5","lineHeightRelaxed":"1.7","spaceXs":"0.25rem","spaceSm":"0.5rem","spaceMd":"1rem","spaceLg":"1.5rem","spaceXl":"2rem","space2xl":"3rem","controlHeight":"2.75rem","touchTarget":"2.75rem","layoutMaxWidth":"90rem","radiusSm":"0.375rem","radiusMd":"0.625rem","radiusLg":"0.875rem","radiusXl":"1.25rem","radiusPill":"999rem","borderWidth":"1px","shadowSm":"0 1px 2px rgb(0 0 0 / 0.28)","shadowMd":"0 12px 30px rgb(0 0 0 / 0.3)","shadowLg":"0 24px 70px rgb(0 0 0 / 0.42)","backdropBlur":"14px","surfaceOpacity":"0.96","motionFast":"120ms","motionNormal":"200ms","motionSlow":"360ms"}'::jsonb;
begin
  update public.theme_presets set tokens = industrial || '{"colorBg":"#FFF8E8","colorBgSecondary":"#F8EAC8","colorSurface":"#FFFDF7","colorSurfaceRaised":"#FFFFFF","colorCard":"#FFF4D6","colorMenu":"#3A2A1A","colorHeader":"#FFF9EA","colorFooter":"#3A2A1A","colorText":"#2A211A","colorTextMuted":"#806653","colorBorder":"#DCC89B","colorInput":"#FFFFFF","colorInputText":"#2A211A","colorInputBorder":"#C9B37E","colorIcon":"#59422F","colorBadge":"#F3DFAC","colorBadgeText":"#4B351D","colorMarker":"#D99600","colorPrimaryContrast":"#2A1E00","colorSecondary":"#6A4A2B","colorSecondaryContrast":"#FFFFFF","colorAccent":"#D99600","colorButtonPrimaryText":"#2A1E00","colorButtonPrimaryHover":"#DFA700","colorButtonSecondary":"#6A4A2B","colorButtonSecondaryText":"#FFFFFF","colorButtonSecondaryHover":"#533820","colorButtonDanger":"#B9383E","colorButtonDangerHover":"#982E33","mapEmpty":"#F3E7CA","mapPosture":"#E2C980","mapHighlight":"#D99600","mapSelected":"#5A3D20","assetMotor":"#D99600","assetReducer":"#6A5848","batteryCage":"#3C342C","radiusMd":"0.75rem","radiusLg":"1rem","radiusXl":"1.5rem","shadowSm":"0 1px 3px rgb(73 48 16 / 0.12)","shadowMd":"0 12px 30px rgb(73 48 16 / 0.14)","shadowLg":"0 24px 64px rgb(73 48 16 / 0.18)","backdropBlur":"10px","surfaceOpacity":"0.98"}'::jsonb,
    appearance='light', density='comfortable', preset_key='classic' where key='mantiqueira_classic';
  update public.theme_presets set tokens=industrial, appearance='dark', density='comfortable', preset_key='industrial' where key='mantiqueira_industrial';
  update public.theme_presets set tokens = industrial || '{"colorBg":"#0D0907","colorBgSecondary":"#17100C","colorSurface":"#211711","colorSurfaceRaised":"#2B1E16","colorCard":"#1B130E","colorMenu":"#100B08","colorHeader":"#130D09","colorFooter":"#090604","colorText":"#FFF4DC","colorTextMuted":"#BDA98F","colorBorder":"#4E3928","colorInput":"#17100C","colorInputText":"#FFF4DC","colorInputBorder":"#60472F","colorIcon":"#E7D3AE","colorBadge":"#3E2B18","colorBadgeText":"#F9D88A","colorMarker":"#D9A441","colorPrimary":"#D9A441","colorPrimaryContrast":"#1C1205","colorSecondary":"#A66B35","colorSecondaryContrast":"#FFF8EA","colorAccent":"#F0C66D","colorButtonPrimary":"#D9A441","colorButtonPrimaryText":"#1C1205","colorButtonPrimaryHover":"#F0C66D","colorButtonSecondary":"#4A3222","colorButtonSecondaryText":"#FFF4DC","colorButtonSecondaryHover":"#62432C","colorButtonDanger":"#A93639","colorButtonDangerHover":"#C6494C","statusAwaiting":"#D9A441","priorityNormal":"#6C9FD8","mapEmpty":"#130D09","mapPosture":"#3A281D","mapActive":"#D9A441","mapHighlight":"#F0C66D","mapSelected":"#FFF4DC","assetMotor":"#D9A441","assetReducer":"#B78D68","batteryCage":"#241A14","fontFamilyHeading":"Georgia, Cambria, Times New Roman, serif","fontWeightSemibold":"600","fontWeightBold":"700","radiusSm":"0.25rem","radiusMd":"0.5rem","radiusLg":"0.75rem","radiusXl":"1rem","shadowSm":"0 2px 5px rgb(0 0 0 / 0.36)","shadowMd":"0 16px 40px rgb(0 0 0 / 0.42)","shadowLg":"0 28px 80px rgb(0 0 0 / 0.56)","backdropBlur":"18px","surfaceOpacity":"0.94"}'::jsonb,
    appearance='dark', density='comfortable', preset_key='premium' where key='mantiqueira_premium';
  update public.theme_presets set tokens = industrial || '{"colorBg":"#F7F5EF","colorBgSecondary":"#ECE9E0","colorSurface":"#FFFFFF","colorSurfaceRaised":"#FFFFFF","colorCard":"#FFFEFA","colorMenu":"#FFFFFF","colorHeader":"#FFFFFF","colorFooter":"#F0EDE5","colorText":"#201E1A","colorTextMuted":"#68645C","colorBorder":"#D8D3C8","colorInput":"#FFFFFF","colorInputText":"#201E1A","colorInputBorder":"#BDB7AA","colorIcon":"#4A4741","colorBadge":"#FFF0B7","colorBadgeText":"#493600","colorMarker":"#C48F00","colorPrimary":"#E5AA00","colorPrimaryContrast":"#221900","colorSecondary":"#5B5142","colorSecondaryContrast":"#FFFFFF","colorAccent":"#C48F00","colorDanger":"#C4323A","colorSuccess":"#218A58","colorWarning":"#C87500","colorInfo":"#236FC2","colorButtonPrimary":"#E5AA00","colorButtonPrimaryText":"#221900","colorButtonPrimaryHover":"#C99500","colorButtonSecondary":"#E6E1D7","colorButtonSecondaryText":"#29261F","colorButtonSecondaryHover":"#D5CFC3","colorButtonDanger":"#C4323A","colorButtonDangerHover":"#A3272E","statusAwaiting":"#C99000","statusInProgress":"#236FC2","statusWaitingPart":"#C87500","statusResolved":"#218A58","statusCancelled":"#706D66","priorityLow":"#706D66","priorityNormal":"#236FC2","priorityHigh":"#C87500","priorityCritical":"#C4323A","mapEmpty":"#EAE6DD","mapPosture":"#D8D3C8","mapActive":"#E5AA00","mapHighlight":"#C48F00","mapSelected":"#29261F","mapHeatLow":"#9ACDB3","mapHeatMedium":"#E4B55C","mapHeatHigh":"#D96569","assetMotor":"#C48F00","assetReducer":"#68645C","batteryCage":"#292C30","shadowSm":"0 1px 3px rgb(45 40 30 / 0.1)","shadowMd":"0 12px 30px rgb(45 40 30 / 0.12)","shadowLg":"0 24px 60px rgb(45 40 30 / 0.16)","backdropBlur":"10px","surfaceOpacity":"0.98"}'::jsonb,
    appearance='light', density='comfortable', preset_key='light' where key='mantiqueira_light';
  update public.theme_presets set tokens = industrial || '{"colorBg":"#000000","colorBgSecondary":"#080808","colorSurface":"#101010","colorSurfaceRaised":"#1B1B1B","colorCard":"#101010","colorMenu":"#000000","colorHeader":"#000000","colorFooter":"#000000","colorText":"#FFFFFF","colorTextMuted":"#D6D6D6","colorBorder":"#737373","colorInput":"#000000","colorInputText":"#FFFFFF","colorInputBorder":"#FFFFFF","colorIcon":"#FFFFFF","colorBadge":"#332900","colorBadgeText":"#FFF36B","colorMarker":"#FFF200","colorPrimary":"#FFF200","colorPrimaryContrast":"#000000","colorSecondary":"#FFFFFF","colorSecondaryContrast":"#000000","colorAccent":"#FFF200","colorDanger":"#FF3B3B","colorDangerContrast":"#000000","colorSuccess":"#40E57A","colorWarning":"#FFB020","colorInfo":"#48A7FF","colorButtonPrimary":"#FFF200","colorButtonPrimaryText":"#000000","colorButtonPrimaryHover":"#FFF875","colorButtonSecondary":"#FFFFFF","colorButtonSecondaryText":"#000000","colorButtonSecondaryHover":"#DADADA","colorButtonDanger":"#FF3B3B","colorButtonDangerText":"#000000","colorButtonDangerHover":"#FF7676","statusAwaiting":"#FFF200","statusInProgress":"#48A7FF","statusWaitingPart":"#FF8A1F","statusResolved":"#40E57A","statusCancelled":"#C7C7C7","priorityLow":"#C7C7C7","priorityNormal":"#48A7FF","priorityHigh":"#FFB020","priorityCritical":"#FF3B3B","mapEmpty":"#080808","mapPosture":"#292929","mapActive":"#FFF200","mapHighlight":"#FFFFFF","mapSelected":"#48A7FF","mapHeatLow":"#40E57A","mapHeatMedium":"#FFB020","mapHeatHigh":"#FF3B3B","assetMotor":"#FFF200","assetReducer":"#FFFFFF","batteryCage":"#050505","batteryNylon":"#48A7FF","batteryWhiteConveyor":"#FF8A1F","batteryFeedCart":"#D6D6D6","batteryElevator":"#FF3B3B","fontScale":"1.08","fontWeightRegular":"500","fontWeightMedium":"650","fontWeightSemibold":"750","fontWeightBold":"850","borderWidth":"2px","shadowSm":"0 0 0 2px rgb(255 255 255 / 0.16)","shadowMd":"0 0 0 2px rgb(255 242 0 / 0.22)","shadowLg":"0 0 0 3px rgb(255 242 0 / 0.3)","backdropBlur":"0px","surfaceOpacity":"1","motionFast":"0ms","motionNormal":"0ms","motionSlow":"0ms"}'::jsonb,
    appearance='high-contrast', density='comfortable', preset_key='contrast' where key='mantiqueira_contrast';
  update public.theme_presets set tokens=industrial, appearance='dark', density='custom', preset_key=null where key='custom';
  update public.theme_versions tv set tokens=tp.tokens from public.theme_presets tp
  where tv.theme_id=tp.id and tv.version_number=1;
end;
$$;
alter table public.theme_presets enable trigger themes_protect_system;
alter table public.theme_versions enable trigger theme_versions_immutable;

create or replace function private.validate_theme_tokens(tokens jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(tokens) = 'object'
    and tokens ?& array[
      'colorBg','colorBgSecondary','colorSurface','colorSurfaceRaised','colorCard','colorMenu',
      'colorHeader','colorFooter','colorText','colorTextMuted','colorBorder','colorInput',
      'colorInputText','colorInputBorder','colorIcon','colorBadge','colorBadgeText','colorMarker',
      'colorPrimary','colorPrimaryContrast','colorSecondary','colorSecondaryContrast','colorAccent',
      'colorDanger','colorDangerContrast','colorSuccess','colorWarning','colorInfo',
      'colorButtonPrimary','colorButtonPrimaryText','colorButtonPrimaryHover','colorButtonSecondary',
      'colorButtonSecondaryText','colorButtonSecondaryHover','colorButtonDanger',
      'colorButtonDangerText','colorButtonDangerHover','statusAwaiting','statusInProgress',
      'statusWaitingPart','statusResolved','statusCancelled','priorityLow','priorityNormal',
      'priorityHigh','priorityCritical','mapEmpty','mapPosture','mapActive','mapHighlight',
      'mapSelected','mapHeatLow','mapHeatMedium','mapHeatHigh','assetMotor','assetReducer',
      'batteryCage','batteryNylon','batteryWhiteConveyor','batteryFeedCart','batteryElevator',
      'fontFamilyBody','fontFamilyHeading','fontFamilyMono','fontScale','fontSizeTitle',
      'fontSizeText','fontSizeXs','fontSizeSm','fontSizeMd','fontSizeLg','fontSizeXl',
      'fontSize2xl','fontSize3xl','fontWeightRegular','fontWeightMedium','fontWeightSemibold',
      'fontWeightBold','lineHeightTight','lineHeightNormal','lineHeightRelaxed','spaceXs',
      'spaceSm','spaceMd','spaceLg','spaceXl','space2xl','controlHeight','touchTarget',
      'layoutMaxWidth','radiusSm','radiusMd','radiusLg','radiusXl','radiusPill','borderWidth',
      'shadowSm','shadowMd','shadowLg','backdropBlur','surfaceOpacity','motionFast',
      'motionNormal','motionSlow'
    ]
    and (select count(*) = 104 from jsonb_object_keys(tokens))
    and not exists (
      select 1
      from jsonb_each_text(tokens) token
      where length(btrim(token.value)) not between 1 and 240
        or token.value ~ '[;{}<>]'
        or token.value ~* '(url|expression|@import)[[:space:]]*\('
    );
$$;

alter table public.theme_presets
  add constraint theme_tokens_complete check (private.validate_theme_tokens(tokens));
alter table public.theme_versions
  add constraint theme_version_tokens_complete check (private.validate_theme_tokens(tokens));

create or replace function public.save_custom_theme(
  p_name text,
  p_tokens jsonb,
  p_theme_id uuid default null,
  p_note text default ''
)
returns public.theme_presets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target public.theme_presets;
  next_version integer;
begin
  caller := private.require_active_user();
  if not private.user_has_permission(caller, 'themes.manage') then
    raise exception using errcode = '42501', message = 'Sem permissão para gerenciar temas.';
  end if;
  if not private.validate_theme_tokens(p_tokens) then
    raise exception using errcode = '22023', message = 'O tema não contém todos os tokens obrigatórios.';
  end if;
  if p_theme_id is null then
    insert into public.theme_presets (key, name, description, tokens, system_preset, created_by)
    values (
      'custom_' || replace(gen_random_uuid()::text, '-', ''), btrim(p_name),
      'Paleta personalizada', p_tokens, false, caller
    ) returning * into target;
  else
    select * into target from public.theme_presets where id = p_theme_id for update;
    if target.id is null then raise exception using errcode = 'P0002', message = 'Tema não encontrado.'; end if;
    if target.system_preset then
      raise exception using errcode = '23514', message = 'Duplique um preset Mantiqueira para personalizá-lo.';
    end if;
    update public.theme_presets set name = btrim(p_name), tokens = p_tokens
    where id = target.id returning * into target;
  end if;
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.theme_versions where theme_id = target.id;
  insert into public.theme_versions (theme_id, version_number, tokens, note, created_by)
  values (target.id, next_version, p_tokens, coalesce(p_note,''), caller);
  return target;
end;
$$;

create or replace function public.apply_theme(p_site_id uuid, p_theme_id uuid)
returns public.active_themes
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  selected_version uuid;
  result public.active_themes;
begin
  caller := private.require_active_user();
  if not private.can_access_site(p_site_id, caller) or
     not private.user_has_permission(caller, 'themes.manage') then
    raise exception using errcode = '42501', message = 'Sem permissão para aplicar tema.';
  end if;
  if not exists (select 1 from public.theme_presets where id = p_theme_id and active and archived_at is null) then
    raise exception using errcode = 'P0002', message = 'Tema ativo não encontrado.';
  end if;
  select id into selected_version from public.theme_versions
  where theme_id = p_theme_id order by version_number desc limit 1;
  insert into public.active_themes (site_id, theme_id, applied_version_id, applied_by, applied_at)
  values (p_site_id, p_theme_id, selected_version, caller, clock_timestamp())
  on conflict (site_id) do update set
    theme_id=excluded.theme_id, applied_version_id=excluded.applied_version_id,
    applied_by=excluded.applied_by, applied_at=excluded.applied_at
  returning * into result;
  return result;
end;
$$;

create or replace function public.admin_set_setting(
  p_key text,
  p_value jsonb,
  p_confirmation text default 'CONFIRMAR'
)
returns public.app_settings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  result public.app_settings;
begin
  caller := private.require_active_user();
  if not private.user_has_permission(caller, 'settings.manage') then
    raise exception using errcode = '42501', message = 'Sem permissão para alterar configurações.';
  end if;
  if p_confirmation is distinct from 'CONFIRMAR' then
    raise exception using errcode = '22023', message = 'Confirmação explícita obrigatória.';
  end if;
  if not exists (select 1 from public.app_settings where key = p_key) then
    raise exception using errcode = 'P0002', message = 'Chave de configuração não reconhecida.';
  end if;
  update public.app_settings set value = p_value, updated_by = caller
  where key = p_key returning * into result;
  return result;
end;
$$;

create or replace function public.register_asset_media(
  p_asset_id uuid,
  p_media_type text,
  p_storage_path text,
  p_mime_type text,
  p_byte_size bigint,
  p_width integer default null,
  p_height integer default null,
  p_checksum_sha256 text default null,
  p_caption text default '',
  p_taken_at timestamptz default null,
  p_thumbnail_path text default null
)
returns public.asset_media
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target public.assets;
  result public.asset_media;
begin
  caller := private.require_active_user();
  select * into target from public.assets where id = p_asset_id and archived_at is null;
  if target.id is null or not private.can_access_site(target.site_id, caller) or
     not private.can_edit_asset_type(caller, target.asset_type_id, false) then
    raise exception using errcode = '42501', message = 'Sem permissão para anexar mídia ao ativo.';
  end if;
  if p_storage_path not like target.site_id::text || '/' || target.id::text || '/%' then
    raise exception using errcode = '22023', message = 'Caminho de Storage inválido para o ativo.';
  end if;
  if p_thumbnail_path is not null and p_thumbnail_path not like target.site_id::text || '/' || target.id::text || '/%' then
    raise exception using errcode = '22023', message = 'Caminho de thumbnail inválido para o ativo.';
  end if;
  insert into public.asset_media (
    asset_id, media_type, storage_path, thumbnail_path, mime_type, byte_size,
    width, height, checksum_sha256, caption, taken_at, uploaded_by
  ) values (
    target.id, p_media_type, p_storage_path, p_thumbnail_path, p_mime_type, p_byte_size,
    p_width, p_height, p_checksum_sha256, coalesce(p_caption,''), p_taken_at, caller
  ) returning * into result;
  return result;
end;
$$;

create or replace function public.archive_asset_media(p_media_id uuid, p_confirmation text)
returns public.asset_media
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target public.asset_media;
  asset_type uuid;
  asset_site uuid;
begin
  caller := private.require_active_user();
  if p_confirmation is distinct from 'ARQUIVAR' then
    raise exception using errcode = '22023', message = 'Digite ARQUIVAR para confirmar.';
  end if;
  select am.* into target
  from public.asset_media am
  where am.id = p_media_id for update;
  select a.asset_type_id, a.site_id into asset_type, asset_site
  from public.assets a
  where a.id = target.asset_id;
  if target.id is null or not private.can_access_site(asset_site, caller) or
     not private.can_edit_asset_type(caller, asset_type, false) then
    raise exception using errcode = '42501', message = 'Sem permissão para arquivar esta mídia.';
  end if;
  update public.asset_media set archived_at = clock_timestamp()
  where id = p_media_id returning * into target;
  return target;
end;
$$;

create or replace function public.register_work_order_media(
  p_work_order_id uuid,
  p_storage_path text,
  p_media_type text,
  p_mime_type text,
  p_byte_size bigint,
  p_width integer default null,
  p_height integer default null,
  p_checksum_sha256 text default null,
  p_caption text default '',
  p_thumbnail_path text default null
)
returns public.work_order_media
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target public.work_orders;
  result public.work_order_media;
begin
  caller := private.require_active_user();
  select * into target from public.work_orders where id = p_work_order_id;
  if target.id is null or not private.can_user_view_work_order(caller, target.id) then
    raise exception using errcode = '42501', message = 'Sem permissão para anexar mídia à OS.';
  end if;
  if exists (
    select 1 from public.work_order_status_definitions st where st.id=target.status_id and st.is_terminal
  ) then
    raise exception using errcode = '23514', message = 'OS finalizada é somente leitura.';
  end if;
  if p_storage_path not like target.site_id::text || '/' || target.id::text || '/%' then
    raise exception using errcode = '22023', message = 'Caminho de Storage inválido para a OS.';
  end if;
  if p_thumbnail_path is not null and p_thumbnail_path not like target.site_id::text || '/' || target.id::text || '/%' then
    raise exception using errcode = '22023', message = 'Caminho de thumbnail inválido para a OS.';
  end if;
  insert into public.work_order_media (
    work_order_id, media_type, storage_path, thumbnail_path, mime_type, byte_size,
    width, height, checksum_sha256, caption, uploaded_by
  ) values (
    target.id, p_media_type, p_storage_path, p_thumbnail_path, p_mime_type, p_byte_size,
    p_width, p_height, p_checksum_sha256, coalesce(p_caption,''), caller
  ) returning * into result;
  insert into public.work_order_events (work_order_id, event_type, actor_id, details)
  values (target.id, 'media_added', caller, jsonb_build_object('media_id', result.id));
  return result;
end;
$$;

create or replace function public.acknowledge_notification(p_notification_event_id uuid)
returns public.notification_receipts
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  result public.notification_receipts;
begin
  caller := private.require_active_user();
  update public.notification_receipts set
    read_at = coalesce(read_at, clock_timestamp()),
    acknowledged_at = coalesce(acknowledged_at, clock_timestamp())
  where notification_event_id = p_notification_event_id and profile_id = caller
  returning * into result;
  if result.profile_id is null then
    raise exception using errcode = 'P0002', message = 'Notificação não encontrada.';
  end if;
  return result;
end;
$$;

-- Public RPCs are opt-in. Never expose internal helpers as PostgREST endpoints.
revoke all on all functions in schema public from public, anon;
grant execute on function public.get_my_access() to authenticated;
grant execute on function public.app_bootstrap(uuid) to authenticated;
grant execute on function public.update_my_profile(text,text,text) to authenticated;
grant execute on function public.admin_manage_user(uuid,boolean,text[],uuid,text) to authenticated;
grant execute on function public.create_physical_asset(uuid,uuid,uuid,uuid,text,text,text,jsonb,text,text) to authenticated;
grant execute on function public.update_physical_asset(uuid,jsonb,timestamptz) to authenticated;
grant execute on function public.save_asset_technical_specs(uuid,jsonb) to authenticated;
grant execute on function public.install_asset(uuid,uuid,timestamptz,text,uuid) to authenticated;
grant execute on function public.remove_asset(uuid,timestamptz,text,uuid,text,text) to authenticated;
grant execute on function public.replace_asset(uuid,uuid,timestamptz,text,uuid,text) to authenticated;
grant execute on function public.archive_asset(uuid,text) to authenticated;
grant execute on function public.open_work_order(uuid,uuid,uuid,text,uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.assign_work_order(uuid,uuid) to authenticated;
grant execute on function public.transition_work_order(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.add_work_order_comment(uuid,text,boolean) to authenticated;
grant execute on function public.add_work_order_needed_item(uuid,text,text,text,numeric,text,text) to authenticated;
grant execute on function public.save_custom_theme(text,jsonb,uuid,text) to authenticated;
grant execute on function public.apply_theme(uuid,uuid) to authenticated;
grant execute on function public.admin_set_setting(text,jsonb,text) to authenticated;
grant execute on function public.register_asset_media(uuid,text,text,text,bigint,integer,integer,text,text,timestamptz,text) to authenticated;
grant execute on function public.archive_asset_media(uuid,text) to authenticated;
grant execute on function public.register_work_order_media(uuid,text,text,text,bigint,integer,integer,text,text,text) to authenticated;
grant execute on function public.acknowledge_notification(uuid) to authenticated;
