begin;
select plan(12);

select is((select public from storage.buckets where id='asset-media'), false, 'mídia de ativos é privada');
select is((select public from storage.buckets where id='work-order-media'), false, 'mídia de OS é privada');
select is((select public from storage.buckets where id='branding'), false, 'branding é privado');
select is((select public from storage.buckets where id='report-exports'), false, 'relatórios são privados');
select is((select count(*) from public.theme_presets where system_preset), 5::bigint, 'cinco presets Mantiqueira');
select is((select count(*) from public.theme_presets tp cross join lateral jsonb_object_keys(tp.tokens) where tp.key='mantiqueira_industrial'), 104::bigint, 'tema industrial possui 104 tokens');
select is((select count(*) from public.work_order_status_definitions where system and active), 5::bigint, 'cinco estados operacionais padrão');
select is((select count(*) from public.priority_definitions where system and active), 4::bigint, 'quatro prioridades padrão');
select ok((select relrowsecurity from pg_class where oid='public.assets'::regclass), 'RLS em ativos');
select ok((select relrowsecurity from pg_class where oid='public.work_orders'::regclass), 'RLS em ordens de serviço');
select ok((select relrowsecurity from pg_class where oid='public.profiles'::regclass), 'RLS em perfis');
select has_function('public','fulfill_work_order_needed_item',array['uuid'], 'RPC de atendimento de necessidade existe');

select * from finish();
rollback;
