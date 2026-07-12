-- ==============================================================
-- ATLAS PARTS V4.1 — EXCLUSÕES SEGURAS
-- Rode UMA VEZ após a V4.
-- ==============================================================

create or replace function public.excluir_peca_completa(p_peca_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_descricao text;
  v_equipamento_id uuid;
begin
  if auth.uid() is null or not public.can_edit() then
    raise exception 'Sem permissão para excluir peças.';
  end if;

  select descricao, equipamento_id
  into v_descricao, v_equipamento_id
  from public.pecas
  where id = p_peca_id;

  if not found then
    raise exception 'Peça não encontrada.';
  end if;

  delete from public.lista_compras where peca_id = p_peca_id;
  delete from public.favoritos where peca_id = p_peca_id;
  delete from public.marcadores where peca_id = p_peca_id;
  delete from public.pecas_equivalentes where peca_id = p_peca_id;
  delete from public.pecas where id = p_peca_id;

  insert into public.logs(usuario_id, acao, entidade, entidade_id, detalhes)
  values (
    auth.uid(), 'excluiu peça', 'peca', p_peca_id::text,
    jsonb_build_object('descricao', coalesce(v_descricao,''), 'equipamento_id', v_equipamento_id)
  );
end;
$$;

revoke all on function public.excluir_peca_completa(uuid) from public;
grant execute on function public.excluir_peca_completa(uuid) to authenticated;


create or replace function public.excluir_imagem_equipamento(p_imagem_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_equipamento_id uuid;
  v_imagem_path text;
  v_imagem_url text;
  v_titulo text;
  v_principal boolean;
  v_proxima public.equipamento_imagens%rowtype;
begin
  if auth.uid() is null or not public.can_edit() then
    raise exception 'Sem permissão para excluir imagens.';
  end if;

  select equipamento_id, imagem_path, imagem_url, titulo, principal
  into v_equipamento_id, v_imagem_path, v_imagem_url, v_titulo, v_principal
  from public.equipamento_imagens
  where id = p_imagem_id;

  if not found then
    raise exception 'Imagem não encontrada.';
  end if;

  delete from public.marcadores where imagem_id = p_imagem_id;
  delete from public.equipamento_imagens where id = p_imagem_id;

  select *
  into v_proxima
  from public.equipamento_imagens
  where equipamento_id = v_equipamento_id
  order by principal desc, ordem asc, criado_em asc
  limit 1;

  if v_proxima.id is not null then
    update public.equipamento_imagens
    set principal = (id = v_proxima.id)
    where equipamento_id = v_equipamento_id;

    if v_principal
       or exists (
         select 1
         from public.equipamentos e
         where e.id = v_equipamento_id
           and (
             (v_imagem_path is not null and e.imagem_path = v_imagem_path)
             or (coalesce(v_imagem_url,'') <> '' and e.imagem_url = v_imagem_url)
           )
       )
    then
      update public.equipamentos
      set imagem_path = v_proxima.imagem_path,
          imagem_url = coalesce(v_proxima.imagem_url,''),
          atualizado_em = now()
      where id = v_equipamento_id;
    end if;
  else
    update public.equipamentos
    set imagem_path = null,
        imagem_url = '',
        atualizado_em = now()
    where id = v_equipamento_id;
  end if;

  insert into public.logs(usuario_id, acao, entidade, entidade_id, detalhes)
  values (
    auth.uid(), 'excluiu imagem', 'equipamento_imagem', p_imagem_id::text,
    jsonb_build_object(
      'equipamento_id', v_equipamento_id,
      'titulo', coalesce(v_titulo,''),
      'imagem_path', coalesce(v_imagem_path,'')
    )
  );

  return jsonb_build_object(
    'equipamento_id', v_equipamento_id,
    'imagem_path', coalesce(v_imagem_path,'')
  );
end;
$$;

revoke all on function public.excluir_imagem_equipamento(uuid) from public;
grant execute on function public.excluir_imagem_equipamento(uuid) to authenticated;


create or replace function public.excluir_equipamento_completo(p_equipamento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_paths text[];
begin
  if auth.uid() is null or not public.can_edit() then
    raise exception 'Sem permissão para excluir equipamentos.';
  end if;

  select nome into v_nome
  from public.equipamentos
  where id = p_equipamento_id;

  if not found then
    raise exception 'Equipamento não encontrado.';
  end if;

  select coalesce(
    array_agg(distinct p) filter (where p is not null and p <> ''),
    array[]::text[]
  )
  into v_paths
  from (
    select imagem_path as p
    from public.equipamento_imagens
    where equipamento_id = p_equipamento_id
    union all
    select imagem_path as p
    from public.equipamentos
    where id = p_equipamento_id
  ) caminhos;

  delete from public.lista_compras
  where equipamento_id = p_equipamento_id
     or peca_id in (
       select id from public.pecas where equipamento_id = p_equipamento_id
     );

  delete from public.favoritos
  where equipamento_id = p_equipamento_id
     or peca_id in (
       select id from public.pecas where equipamento_id = p_equipamento_id
     );

  delete from public.recentes where equipamento_id = p_equipamento_id;

  delete from public.marcadores
  where imagem_id in (
      select id from public.equipamento_imagens where equipamento_id = p_equipamento_id
    )
     or peca_id in (
      select id from public.pecas where equipamento_id = p_equipamento_id
    );

  delete from public.pecas_equivalentes
  where peca_id in (
    select id from public.pecas where equipamento_id = p_equipamento_id
  );

  delete from public.equipamento_imagens where equipamento_id = p_equipamento_id;
  delete from public.pecas where equipamento_id = p_equipamento_id;
  delete from public.equipamentos where id = p_equipamento_id;

  insert into public.logs(usuario_id, acao, entidade, entidade_id, detalhes)
  values (
    auth.uid(), 'excluiu equipamento', 'equipamento', p_equipamento_id::text,
    jsonb_build_object('nome', coalesce(v_nome,''), 'imagem_paths', to_jsonb(v_paths))
  );

  return jsonb_build_object(
    'equipamento_id', p_equipamento_id,
    'imagem_paths', to_jsonb(v_paths)
  );
end;
$$;

revoke all on function public.excluir_equipamento_completo(uuid) from public;
grant execute on function public.excluir_equipamento_completo(uuid) to authenticated;

select 'Atlas Parts V4.1 — exclusões seguras instaladas' as status;
