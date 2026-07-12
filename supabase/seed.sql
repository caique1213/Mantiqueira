-- Os dados estruturais mínimos são criados de forma idempotente pelas migrations.
-- Este arquivo existe para que `supabase db reset` tenha um alvo de seed válido.
-- Dados reais de ativos e ordens de serviço nunca devem ser inseridos como demonstração.
select 'Mantiqueira Maintenance Hub: migrations e estrutura física carregadas.' as seed_status;
