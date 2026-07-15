-- Parceiros / apoio operacional nas Ordens de Serviço.
-- Permite registrar mais de uma pessoa que ajudou em uma OS sem trocar o responsável principal.

alter table public.work_order_events
  drop constraint if exists work_order_events_event_type_check;

alter table public.work_order_events
  add constraint work_order_events_event_type_check
  check (event_type in (
    'opened','assigned','unassigned','started','status_changed','priority_changed',
    'commented','diagnosed','needed_item','resolved','cancelled','reopened','media_added',
    'participant_added','participant_removed'
  ));

create table if not exists public.work_order_participants (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  added_by uuid references public.profiles(id) on delete set null default auth.uid(),
  note text not null default '',
  added_at timestamptz not null default clock_timestamp(),
  removed_at timestamptz,
  removed_by uuid references public.profiles(id) on delete set null,
  check (length(note) <= 500),
  check (removed_at is null or removed_at > added_at)
);

create unique index if not exists work_order_participants_active_unique
  on public.work_order_participants (work_order_id, profile_id)
  where removed_at is null;

create index if not exists work_order_participants_order_idx
  on public.work_order_participants (work_order_id, added_at desc)
  where removed_at is null;

create index if not exists work_order_participants_profile_idx
  on public.work_order_participants (profile_id, added_at desc)
  where removed_at is null;

alter table public.work_order_participants enable row level security;

grant select, insert, update, delete on public.work_order_participants to authenticated;

drop policy if exists work_order_participants_read on public.work_order_participants;
create policy work_order_participants_read on public.work_order_participants
for select to authenticated
using (private.can_user_view_work_order(auth.uid(), work_order_id));

drop trigger if exists work_order_participants_audit on public.work_order_participants;
create trigger work_order_participants_audit
after insert or update or delete on public.work_order_participants
for each row execute function private.write_audit();

create or replace function public.list_work_order_participants(p_work_order_id uuid)
returns table (
  id uuid,
  work_order_id uuid,
  profile_id uuid,
  display_name text,
  sector_name text,
  role_names text[],
  added_by uuid,
  added_by_name text,
  note text,
  added_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
begin
  caller := private.require_active_user();
  if not private.can_user_view_work_order(caller, p_work_order_id) then
    raise exception using errcode = '42501', message = 'OS n?o autorizada.';
  end if;

  return query
  select
    wop.id,
    wop.work_order_id,
    p.id as profile_id,
    p.display_name,
    coalesce(s.name, 'Geral') as sector_name,
    coalesce(array_remove(array_agg(distinct r.name), null), array[]::text[]) as role_names,
    wop.added_by,
    adder.display_name as added_by_name,
    wop.note,
    wop.added_at
  from public.work_order_participants wop
  join public.profiles p on p.id = wop.profile_id
  left join public.sectors s on s.id = p.primary_sector_id
  left join public.profile_roles pr on pr.profile_id = p.id
  left join public.roles r on r.id = pr.role_id and r.active
  left join public.profiles adder on adder.id = wop.added_by
  where wop.work_order_id = p_work_order_id
    and wop.removed_at is null
  group by wop.id, p.id, p.display_name, s.name, wop.added_by, adder.display_name, wop.note, wop.added_at
  order by wop.added_at;
end;
$$;

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
    raise exception using errcode = '42501', message = 'OS n?o autorizada.';
  end if;

  if not (
    private.user_has_permission(caller, 'work_orders.execute') or
    private.user_has_permission(caller, 'work_orders.assign.any') or
    private.user_has_permission(caller, 'work_orders.view.all')
  ) then
    raise exception using errcode = '42501', message = 'Sem permiss?o para selecionar apoio nesta OS.';
  end if;

  return query
  select
    p.id as profile_id,
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
  order by p.display_name;
end;
$$;

create or replace function public.add_work_order_partner(
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
  target public.work_orders;
  selected_name text;
  result public.work_order_participants;
begin
  caller := private.require_active_user();
  select * into target from public.work_orders where id = p_work_order_id for update;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'OS n?o encontrada.';
  end if;

  if not private.can_user_view_work_order(caller, target.id) or
     not private.user_has_permission(caller, 'work_orders.execute') then
    raise exception using errcode = '42501', message = 'Sem permiss?o para adicionar apoio nesta OS.';
  end if;

  if exists (
    select 1 from public.work_order_status_definitions st
    where st.id = target.status_id and st.is_terminal
  ) then
    raise exception using errcode = '23514', message = 'OS finalizada n?o aceita altera??o de equipe.';
  end if;

  if target.assigned_to is null then
    raise exception using errcode = '23514', message = 'Inicie/assuma a OS antes de adicionar apoio.';
  end if;

  if target.assigned_to is distinct from caller and not private.user_has_permission(caller, 'work_orders.assign.any') then
    raise exception using errcode = '42501', message = 'Somente o responsável atual ou um administrador pode adicionar apoio.';
  end if;

  if p_profile_id = target.assigned_to then
    raise exception using errcode = '23514', message = 'O responsável principal j? est? registrado na OS.';
  end if;

  select p.display_name into selected_name
  from public.profiles p
  join public.site_memberships sm on sm.profile_id = p.id and sm.active and sm.site_id = target.site_id
  where p.id = p_profile_id and p.active;

  if selected_name is null then
    raise exception using errcode = 'P0002', message = 'Parceiro n?o encontrado ou inativo nesta unidade.';
  end if;

  insert into public.work_order_participants (work_order_id, profile_id, added_by, note)
  select target.id, p_profile_id, caller, left(coalesce(btrim(p_note), ''), 500)
  where not exists (
    select 1 from public.work_order_participants existing
    where existing.work_order_id = target.id
      and existing.profile_id = p_profile_id
      and existing.removed_at is null
  )
  returning * into result;

  if result.id is null then
    select * into result
    from public.work_order_participants existing
    where existing.work_order_id = target.id
      and existing.profile_id = p_profile_id
      and existing.removed_at is null;
    return result;
  end if;

  insert into public.work_order_events (work_order_id, event_type, actor_id, details)
  values (
    target.id,
    'participant_added',
    caller,
    jsonb_build_object('profile_id', p_profile_id, 'display_name', selected_name, 'note', coalesce(btrim(p_note), ''))
  );

  return result;
end;
$$;

create or replace function public.remove_work_order_partner(p_participant_id uuid)
returns public.work_order_participants
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid;
  target_participant public.work_order_participants;
  target_order public.work_orders;
  selected_name text;
  result public.work_order_participants;
begin
  caller := private.require_active_user();

  select * into target_participant
  from public.work_order_participants
  where id = p_participant_id and removed_at is null
  for update;

  if target_participant.id is null then
    raise exception using errcode = 'P0002', message = 'Participante n?o encontrado.';
  end if;

  select * into target_order
  from public.work_orders
  where id = target_participant.work_order_id
  for update;

  if not private.can_user_view_work_order(caller, target_order.id) or
     not private.user_has_permission(caller, 'work_orders.execute') then
    raise exception using errcode = '42501', message = 'Sem permiss?o para remover apoio nesta OS.';
  end if;

  if exists (
    select 1 from public.work_order_status_definitions st
    where st.id = target_order.status_id and st.is_terminal
  ) then
    raise exception using errcode = '23514', message = 'OS finalizada n?o aceita altera??o de equipe.';
  end if;

  if target_order.assigned_to is distinct from caller and not private.user_has_permission(caller, 'work_orders.assign.any') then
    raise exception using errcode = '42501', message = 'Somente o responsável atual ou um administrador pode remover apoio.';
  end if;

  select display_name into selected_name
  from public.profiles
  where id = target_participant.profile_id;

  update public.work_order_participants
  set removed_at = clock_timestamp(), removed_by = caller
  where id = target_participant.id
  returning * into result;

  insert into public.work_order_events (work_order_id, event_type, actor_id, details)
  values (
    target_order.id,
    'participant_removed',
    caller,
    jsonb_build_object('profile_id', target_participant.profile_id, 'display_name', selected_name)
  );

  return result;
end;
$$;

revoke all on function public.list_work_order_participants(uuid) from public, anon;
revoke all on function public.list_work_order_partner_candidates(uuid) from public, anon;
revoke all on function public.add_work_order_partner(uuid, uuid, text) from public, anon;
revoke all on function public.remove_work_order_partner(uuid) from public, anon;

grant execute on function public.list_work_order_participants(uuid) to authenticated;
grant execute on function public.list_work_order_partner_candidates(uuid) to authenticated;
grant execute on function public.add_work_order_partner(uuid, uuid, text) to authenticated;
grant execute on function public.remove_work_order_partner(uuid) to authenticated;
