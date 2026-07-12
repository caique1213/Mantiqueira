# Frontend

Aplicação React 19 + TypeScript + Vite do Mantiqueira Maintenance Hub.

## Organização

- `app/`: providers, rotas protegidas e shell responsivo.
- `components/ui/`: componentes visuais reutilizáveis.
- `features/`: autenticação, dashboard, OS, mapa físico, inventário, análises, notificações, perfil, pesquisa, temas e administração.
- `lib/`: cliente Supabase, configuração, erros, mídia e regras físicas.
- `styles/`: tokens globais e estilos-base.
- `types/`: contratos do domínio e tipos gerados do Supabase.

As rotas funcionais são carregadas sob demanda para reduzir o JavaScript inicial. Consultas remotas usam TanStack Query; formulários críticos são validados no cliente e novamente pelo banco/RPC.

Não use `service_role` nem outro segredo neste diretório.
