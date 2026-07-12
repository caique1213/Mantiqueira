# Migrations Supabase

As migrations 001–012 formam um contrato cumulativo e devem ser aplicadas em ordem pelo Supabase CLI.

```powershell
pnpm exec supabase login
pnpm exec supabase link --project-ref SEU_PROJECT_REF
pnpm supabase:push:dry
pnpm supabase:push
```

## Organização

1. Fundação, extensões e auditoria.
2. Identidade, perfis, papéis e permissões.
3. Catálogos funcionais.
4. Configurações, temas e 104 tokens visuais.
5. Mapa físico, 48 posturas, 199 baterias e posições padrão.
6. Modelos, ativos, especificações, instalações e substituições.
7. Ordens de serviço e histórico operacional.
8. Notificações e auditoria complementar.
9. RPCs críticas e transações de negócio.
10. RLS, grants e Storage privado.
11. Views, indicadores e pesquisa global.
12. Endurecimento final de integridade, segurança e Realtime.

Não execute arquivos fora de ordem, não edite uma migration já aplicada em produção e não copie `service_role` para SQL, frontend ou GitHub. Mudanças futuras devem ganhar uma nova migration numerada.
