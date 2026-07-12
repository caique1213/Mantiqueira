# Mantiqueira Maintenance Hub

Sistema web de gestão de manutenção e inventário técnico dos ativos instalados da Mantiqueira Brasil.

O produto conecta o mapa físico das 48 posturas, a visão gráfica das baterias, motores e redutores reais, histórico de instalação e substituição, ordens de serviço, notificações, análises e administração profunda da identidade visual.

## Estado do projeto

Esta pasta já contém a implementação completa pronta para implantação. Ela não é mais apenas o pacote de especificação inicial.

Consulte primeiro:

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md): implantação completa no Supabase, GitHub e Cloudflare.
- [TESTING_GUIDE.md](TESTING_GUIDE.md): validações locais, banco e checklist funcional.
- [SECURITY.md](SECURITY.md): modelo de segurança e cuidados operacionais.
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md): módulos entregues e limites intencionais.
- [AGENTS.md](AGENTS.md): regras permanentes do domínio para futuras alterações.

## Módulos entregues

- Autenticação, recuperação de senha, perfis e permissões.
- Dashboard industrial responsivo e configurável.
- Ordens de Serviço: abertura, atribuição, execução, espera por peça, resolução, cancelamento, reabertura administrativa, comentários, fotos e linha do tempo.
- Mapa físico exato das 48 posturas, incluindo os vazios físicos e a posição especial das posturas 46–48.
- 199 baterias e 1.784 posições técnicas padrão geradas pelo banco.
- Diagrama lateral interativo das baterias, com motores, redutores, esteiras, elevador e carrinho de ração.
- Inventário técnico de ativos físicos, separado da biblioteca de fabricantes e modelos.
- Instalação, remoção e substituição sem destruir o histórico.
- Fotos privadas de ativo, placa e OS, com compressão antes do upload.
- Pesquisa global por OS, postura, ativo, fabricante, modelo e número de série.
- Análises, reincidência, criticidade, completude e exportação CSV/PDF.
- Notificações e preferências de cinco alertas sonoros.
- Administração de usuários, catálogos, módulos, configurações e auditoria.
- Cinco paletas Mantiqueira completas e editor Personalizado com prévia, histórico, desfazer e restaurar.

## Arquitetura

```text
React + TypeScript + Vite
          │
          ├── Supabase Auth
          ├── PostgreSQL + RLS + RPCs
          ├── Storage privado
          └── Edge Function de convite

GitHub ── versionamento e origem do deploy
Cloudflare Pages ── frontend público protegido por login
```

Nenhuma senha, chave `service_role` ou segredo privado pertence ao frontend. O navegador recebe apenas a URL do projeto e a chave publicável do Supabase; as políticas RLS continuam responsáveis pela autorização de cada operação.

## Início local rápido

Requisitos: Node.js 20 ou superior e PNPM.

```powershell
Copy-Item .env.example .env.local
pnpm install
pnpm dev
```

Preencha antes o `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA_AQUI
VITE_ENABLE_ADMIN_INVITES=true
```

Nunca coloque a chave secreta, `service_role` ou senha do banco nesse arquivo.

## Comandos principais

```powershell
pnpm dev                    # desenvolvimento local
pnpm verify                 # lint + tipos + testes + build
pnpm verify:full            # validação anterior + Playwright desktop/mobile
pnpm supabase:push:dry      # prévia das migrations remotas
pnpm supabase:push          # aplica migrations e seed no projeto vinculado
pnpm supabase:functions:deploy
pnpm supabase:types:linked  # atualiza tipos após vincular o projeto
```

## Estrutura relevante

```text
src/
  app/                 shell, rotas e providers
  components/ui/       componentes reutilizáveis
  features/            módulos funcionais
  lib/                 Supabase, ambiente, mídia e regras físicas
  styles/              tokens e estilos globais
supabase/
  migrations/          migrations versionadas 001–012
  functions/           Edge Function de convite de usuário
  tests/database/      contratos pgTAP do banco
public/
  images/              imagens otimizadas da interface
  _headers             cabeçalhos de segurança do Cloudflare
  _redirects           fallback SPA
docs/                   especificação funcional detalhada
tests/e2e/              testes Playwright desktop e celular
```

## Regras de domínio que não podem ser quebradas

- Existem exatamente 48 posturas no mapa físico definido em `AGENTS.md`.
- Posturas 1–44 têm quatro baterias; 45 tem cinco; 46–48 têm seis.
- “Estoque” neste produto significa inventário técnico de ativos instalados, não almoxarifado.
- Modelo técnico e ativo físico são entidades diferentes.
- Substituir um motor ou redutor encerra a instalação antiga e cria outra; nunca reescreve o passado.
- A placa física prevalece sobre dados sugeridos pela biblioteca.
- OS terminal fica somente leitura; reabertura é explícita e auditada.
- Toda foto interna fica em bucket privado.

## Dados de demonstração

As migrations criam apenas estrutura física, catálogos essenciais, permissões e temas. Não são inseridos motores, números de série ou ordens de serviço fictícias como se fossem dados reais.

## Próximo passo

Siga o [guia de implantação](DEPLOYMENT_GUIDE.md) na ordem indicada. O procedimento recomendado usa a CLI do Supabase para aplicar as migrations sem cortar o SQL no celular e o GitHub conectado ao Cloudflare Pages para publicar automaticamente cada atualização.
