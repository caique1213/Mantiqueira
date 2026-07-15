-- Panel-scoped alarms, custom sound presets and corrected Portuguese messages.

insert into public.sound_presets (id, key, name, audio_key, system, active, sort_order)
values
  ('90000000-0000-4000-8000-000000000006', 'factory_pulse', 'Pulso industrial', 'factory-pulse', true, true, 60),
  ('90000000-0000-4000-8000-000000000007', 'maintenance_call', 'Chamado de manutenção', 'maintenance-call', true, true, 70),
  ('90000000-0000-4000-8000-000000000008', 'urgent_beep', 'Alerta urgente', 'urgent-beep', true, true, 80),
  ('90000000-0000-4000-8000-000000000009', 'control_room', 'Sala de controle', 'control-room', true, true, 90),
  ('90000000-0000-4000-8000-000000000010', 'long_siren', 'Sirene contínua', 'long-siren', true, true, 100)
on conflict (id) do update
set
  key = excluded.key,
  name = excluded.name,
  audio_key = excluded.audio_key,
  system = excluded.system,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.app_settings (key, value, description, public_read)
values (
  'notification.default_sound_preset_key',
  '"long_siren"'::jsonb,
  'Som padrão global dos alarmes de OS',
  false
)
on conflict (key) do update
set value = excluded.value;

create or replace function public.acknowledge_work_order_notifications(
  p_work_order_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  affected integer := 0;
begin
  caller := private.require_active_user();

  if not private.can_user_view_work_order(caller, p_work_order_id) then
    raise exception using errcode = '42501', message = 'OS não autorizada.';
  end if;

  update public.notification_receipts nr
  set
    read_at = coalesce(nr.read_at, clock_timestamp()),
    acknowledged_at = coalesce(nr.acknowledged_at, clock_timestamp())
  from public.notification_events ne
  where ne.id = nr.notification_event_id
    and ne.work_order_id = p_work_order_id
    and nr.profile_id = caller
    and nr.read_at is null;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.admin_create_sound_preset(
  p_name text,
  p_audio_key text,
  p_confirmation text default 'CONFIRMAR'
)
returns public.sound_presets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  clean_name text := nullif(btrim(p_name), '');
  base_key text;
  final_key text;
  result public.sound_presets;
begin
  caller := private.require_active_user();

  if not private.user_has_permission(caller, 'settings.manage') then
    raise exception using errcode = '42501', message = 'Sem permissão para cadastrar alarmes.';
  end if;
  if p_confirmation is distinct from 'CONFIRMAR' then
    raise exception using errcode = '22023', message = 'Confirmação explícita obrigatória.';
  end if;
  if clean_name is null or length(clean_name) < 3 then
    raise exception using errcode = '22023', message = 'Informe um nome para o alarme.';
  end if;
  if p_audio_key is null or p_audio_key !~ '^data:audio/(mpeg|mp3|wav|ogg|webm);base64,' then
    raise exception using errcode = '22023', message = 'Envie um arquivo de áudio válido.';
  end if;
  if length(p_audio_key) > 1500000 then
    raise exception using errcode = '22023', message = 'O áudio deve ter no máximo cerca de 1 MB.';
  end if;

  base_key := lower(regexp_replace(clean_name, '[^a-z0-9]+', '_', 'g'));
  base_key := trim(both '_' from base_key);
  if length(base_key) < 3 then
    base_key := 'alarme';
  end if;
  base_key := left(base_key, 34);
  final_key := base_key;

  while exists (select 1 from public.sound_presets where key = final_key) loop
    final_key := left(base_key, 34) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end loop;

  insert into public.sound_presets (key, name, audio_key, system, active, sort_order)
  values (
    final_key,
    clean_name,
    p_audio_key,
    false,
    true,
    coalesce((select max(sort_order) + 10 from public.sound_presets), 100)
  )
  returning * into result;

  return result;
end;
$$;

-- Recreate participant RPCs only to fix user-facing mojibake from a previous migration.
-- Logic intentionally remains the same.

create or replace function public.list_work_order_partner_candidates(p_work_order_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  sector_name text,
  role_names text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target_site uuid;
begin
  caller := private.require_active_user();

  select wo.site_id into target_site
  from public.work_orders wo
  where wo.id = p_work_order_id;

  if target_site is null or not private.can_user_view_work_order(caller, p_work_order_id) then
    raise exception using errcode = '42501', message = 'OS não autorizada.';
  end if;

  if not (
    private.user_has_permission(caller, 'work_orders.execute') or
    private.user_has_permission(caller, 'work_orders.assign.any') or
    private.user_has_permission(caller, 'work_orders.view.all')
  ) then
    raise exception using errcode = '42501', message = 'Sem permissão para selecionar apoio nesta OS.';
  end if;

  return query
  select
    p.id,
    p.display_name,
    coalesce(s.name, 'Geral') as sector_name,
    coalesce(array_remove(array_agg(distinct r.name), null), array[]::text[]) as role_names
  from public.profiles p
  join public.site_memberships sm on sm.profile_id = p.id and sm.active and sm.site_id = target_site
  left join public.sectors s on s.id = p.primary_sector_id
  left join public.profile_roles pr on pr.profile_id = p.id
  left join public.roles r on r.id = pr.role_id and r.active
  where p.active
  group by p.id, p.display_name, s.name
  order by
    split_part(p.display_name, ' ', 1),
    p.display_name;
end;
$$;

create or replace function public.add_work_order_participant(
  p_work_order_id uuid,
  p_profile_id uuid,
  p_note text default ''
)
returns public.work_order_participants
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target public.work_orders%rowtype;
  target_state text;
  result public.work_order_participants;
begin
  caller := private.require_active_user();

  select * into target from public.work_orders where id = p_work_order_id;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'OS não encontrada.';
  end if;

  if not private.can_user_view_work_order(caller, target.id) or
     not private.user_has_permission(caller, 'work_orders.execute') then
    raise exception using errcode = '42501', message = 'Sem permissão para adicionar apoio nesta OS.';
  end if;

  select semantic_state into target_state
  from public.work_order_status_definitions
  where id = target.status_id;

  if target_state in ('resolved', 'cancelled') then
    raise exception using errcode = '23514', message = 'OS finalizada não aceita alteração de equipe.';
  end if;

  if target.assigned_to is distinct from caller and not private.user_has_permission(caller, 'work_orders.assign.any') then
    raise exception using errcode = '42501', message = 'Apenas o responsável principal ou administrador pode adicionar apoio.';
  end if;

  if p_profile_id = target.assigned_to then
    raise exception using errcode = '23514', message = 'O responsável principal já está registrado na OS.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.site_memberships sm on sm.profile_id = p.id and sm.active and sm.site_id = target.site_id
    where p.id = p_profile_id and p.active
  ) then
    raise exception using errcode = 'P0002', message = 'Parceiro não encontrado ou inativo nesta unidade.';
  end if;

  insert into public.work_order_participants (work_order_id, profile_id, added_by, note)
  values (target.id, p_profile_id, caller, coalesce(p_note, ''))
  on conflict (work_order_id, profile_id) where removed_at is null
  do update set note = excluded.note
  returning * into result;

  insert into public.work_order_events (work_order_id, event_type, actor_id, details)
  values (
    target.id,
    'participant_added',
    caller,
    jsonb_build_object('profile_id', p_profile_id, 'note', coalesce(p_note, ''))
  );

  return result;
end;
$$;

create or replace function public.remove_work_order_participant(
  p_participant_id uuid,
  p_note text default ''
)
returns public.work_order_participants
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target_participant public.work_order_participants%rowtype;
  target_order public.work_orders%rowtype;
  target_state text;
begin
  caller := private.require_active_user();

  select * into target_participant
  from public.work_order_participants
  where id = p_participant_id and removed_at is null;

  if target_participant.id is null then
    raise exception using errcode = 'P0002', message = 'Participante não encontrado.';
  end if;

  select * into target_order from public.work_orders where id = target_participant.work_order_id;

  if not private.can_user_view_work_order(caller, target_order.id) or
     not private.user_has_permission(caller, 'work_orders.execute') then
    raise exception using errcode = '42501', message = 'Sem permissão para remover apoio nesta OS.';
  end if;

  select semantic_state into target_state
  from public.work_order_status_definitions
  where id = target_order.status_id;

  if target_state in ('resolved', 'cancelled') then
    raise exception using errcode = '23514', message = 'OS finalizada não aceita alteração de equipe.';
  end if;

  if target_order.assigned_to is distinct from caller and not private.user_has_permission(caller, 'work_orders.assign.any') then
    raise exception using errcode = '42501', message = 'Apenas o responsável principal ou administrador pode remover apoio.';
  end if;

  update public.work_order_participants
  set removed_at = clock_timestamp(), removed_by = caller
  where id = target_participant.id
  returning * into target_participant;

  insert into public.work_order_events (work_order_id, event_type, actor_id, details)
  values (
    target_order.id,
    'participant_removed',
    caller,
    jsonb_build_object('profile_id', target_participant.profile_id, 'note', coalesce(p_note, ''))
  );

  return target_participant;
end;
$$;

grant execute on function public.acknowledge_work_order_notifications(uuid) to authenticated;
grant execute on function public.admin_create_sound_preset(text, text, text) to authenticated;
grant execute on function public.list_work_order_partner_candidates(uuid) to authenticated;
grant execute on function public.add_work_order_participant(uuid, uuid, text) to authenticated;
grant execute on function public.remove_work_order_participant(uuid, text) to authenticated;
