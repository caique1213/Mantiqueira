# Passo a passo final — Mantiqueira Maintenance Hub

Este guia é para publicar a versão atual do sistema com:

- mapa das 48 posturas;
- posições laterais e entre baterias para abrir OS;
- painéis de recebimento de OS: Geral, Elétrica, Mecânica e Civil;
- notificação sonora por OS recebida/designada;
- relatório individual com exportação CSV;
- galponista vendo as próprias solicitações;
- edição de nome dos usuários pelo administrador;
- tema pessoal claro/escuro e modo baixa visão por usuário;
- Supabase como banco/login/storage;
- GitHub como repositório;
- Cloudflare Pages como site online.

---

## 1. Arquivos que você precisa subir para o GitHub

Suba o conteúdo da pasta do projeto:

`C:\Users\caiqu\Downloads\mantiqueira-maintenance-hub-final`

Não suba estas pastas/arquivos:

- `node_modules`
- `dist`
- `.env.local`

Esses itens não precisam ir para o GitHub.

O arquivo `.env.local` tem configuração local. No site online, essas mesmas variáveis serão colocadas na Cloudflare.

---

## 2. Supabase — banco de dados

Você já aplicou as migrations até a `014`, mas se precisar refazer em outro projeto, o caminho é:

1. Abra o terminal dentro da pasta:

   `C:\Users\caiqu\Downloads\mantiqueira-maintenance-hub-final`

2. Instale as dependências:

   ```powershell
   pnpm.cmd install --frozen-lockfile
   ```

3. Faça login/link do Supabase se ainda não tiver feito.

4. Rode:

   ```powershell
   $env:SUPABASE_TELEMETRY_DISABLED="1"
   pnpm.cmd exec supabase db push --include-seed
   ```

5. Quando perguntar, responda:

   ```text
   y
   ```

O banco deve aplicar as migrations:

- `202607110001_foundation.sql`
- `202607110002_identity_access.sql`
- `202607110003_reference_catalogs.sql`
- `202607110004_settings_themes.sql`
- `202607110005_physical_structure.sql`
- `202607110006_asset_inventory.sql`
- `202607110007_work_orders.sql`
- `202607110008_notifications_audit.sql`
- `202607110009_critical_rpcs.sql`
- `202607110010_rls_storage.sql`
- `202607110011_views_search.sql`
- `202607110012_security_hardening.sql`
- `202607110013_inter_battery_positions.sql`
- `202607110014_os_panels_users_accessibility.sql`

---

## 3. Conferir se o banco está certo

No Supabase, abra:

`SQL Editor → New query`

Rode:

```sql
select
  (select count(*) from public.postures) as posturas,
  (select count(*) from public.batteries) as baterias,
  (select count(*) from public.asset_positions) as posicoes,
  (select count(*) from public.theme_presets) as temas,
  (select count(*) from public.asset_positions where code like 'area_%') as areas_entre_baterias;
```

O esperado é algo próximo de:

```text
posturas: 48
baterias: 199
posicoes: 2031
temas: 6
areas_entre_baterias: 247
```

Depois confira o setor Civil:

```sql
select code, name, active
from public.sectors
order by sort_order;
```

Tem que aparecer:

```text
civil | Civil | true
```

---

## 4. Criar o primeiro usuário administrador

No Supabase:

1. Vá em `Authentication`.
2. Vá em `Users`.
3. Clique em `Add user`.
4. Crie o usuário com e-mail e senha.

Depois rode no SQL Editor:

```sql
select
  u.email,
  p.display_name,
  p.active,
  jsonb_agg(r.code order by r.code) as roles
from public.profiles p
join auth.users u on u.id = p.id
left join public.profile_roles pr on pr.profile_id = p.id
left join public.roles r on r.id = pr.role_id
group by u.email, p.display_name, p.active;
```

O primeiro usuário precisa aparecer como:

```text
administrador
```

---

## 5. GitHub — subir o projeto

No GitHub:

1. Crie um repositório, por exemplo:

   `mantiqueira-maintenance-hub`

2. Suba todos os arquivos do projeto, exceto:

   - `node_modules`
   - `dist`
   - `.env.local`

Se for pelo site do GitHub, envie os arquivos e pastas principais.

Se for pelo terminal, pode usar Git normalmente.

---

## 6. Cloudflare Pages — publicar o site

Na Cloudflare:

1. Entre em `Workers & Pages`.
2. Clique em `Create`.
3. Escolha `Pages`.
4. Escolha `Connect to Git`.
5. Selecione o repositório do GitHub.
6. Configure assim:

```text
Framework preset: Vite
Build command: pnpm build
Build output directory: dist
Root directory: /
Node version: 22 ou 24, se aparecer opção
```

Se a Cloudflare reclamar de `pnpm`, configure:

```text
Install command: npm install -g pnpm && pnpm install --frozen-lockfile
```

---

## 7. Cloudflare Pages — variáveis de ambiente

Na Cloudflare, entre no projeto Pages:

`Settings → Environment variables`

Adicione:

```text
VITE_SUPABASE_URL=https://ohhlcuosnqczagkdpfwj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_FutpqBKtE6Bbuxfput33tw_jP8XeQoH
VITE_ENABLE_ADMIN_INVITES=false
```

Depois clique em:

`Save`

E faça um novo deploy.

---

## 8. Teste inicial no site online

Abra o link da Cloudflare.

Faça login com o usuário administrador.

Teste:

1. A tela inicial abre.
2. O nome mostrado é o nome do perfil, não o e-mail.
3. Vá em `Administração → Usuários`.
4. Edite o nome de um usuário.
5. Salve e confirme digitando `CONFIRMAR`.
6. Saia e entre de novo para ver o nome correto.

---

## 9. Testar painéis de OS

Vá em:

`Ordens de Serviço`

Você deve ver painéis:

- Geral
- Elétrica
- Mecânica
- Civil

Clique em cada um para filtrar o painel de recebimento.

Depois abra uma OS nova e escolha setor:

- Elétrica;
- Mecânica;
- Civil.

Usuários do setor correto devem conseguir ver/assumir a OS conforme permissão.

---

## 10. Testar fluxo de assumir OS

Na tela da OS:

1. Antes de assumir, aparece `Assumir OS`.
2. Depois de assumir, aparecem ações operacionais.
3. O fluxo esperado é:

```text
Aguardando atendimento
→ Assumir OS
→ Iniciar
→ Aguardar peça ou Resolver
```

Para resolver, o sistema exige:

- diagnóstico;
- serviço realizado.

Para cancelar, exige:

- motivo;
- confirmação.

---

## 11. Testar notificação sonora

No usuário que recebe OS:

1. Vá em `Notificações`.
2. Ative notificações/som se estiver desligado.
3. Abra uma OS para o setor dele.
4. O usuário deve receber alerta.

Observação: navegador de celular pode bloquear som até a pessoa interagir com a página uma vez. Isso é regra do navegador, não erro do sistema.

---

## 12. Testar relatório individual

Vá em:

`Ordens de Serviço`

Use:

- `Meu relatório` para ver OS atribuídas/feitas pelo usuário.
- `Minhas solicitações` para ver OS abertas pelo usuário.
- `Exportar CSV` para baixar relatório com:
  - número da OS;
  - status;
  - setor;
  - prioridade;
  - postura;
  - bateria;
  - posição;
  - quem abriu;
  - responsável;
  - aberta em;
  - assumida em;
  - iniciada em;
  - resolvida em;
  - cancelada em;
  - descrição.

---

## 13. Testar modo baixa visão e tema pessoal

No login de qualquer usuário:

1. Clique no usuário no topo.
2. Vá em `Meu perfil`.
3. Na área `Minha visualização`, escolha:

```text
Padrão do sistema
Escuro
Claro
```

4. Ative `Modo baixa visão`.

Isso muda:

- tamanho das letras;
- altura dos campos;
- conforto de leitura;
- tema pessoal daquele usuário naquele aparelho.

Não altera o tema global da empresa.

---

## 14. O que foi implementado nesta última rodada

- Setor `Civil`.
- Perfil `Civil`.
- Permissão `work_orders.view.civil`.
- Galponista pode cancelar OS própria.
- Painéis de recebimento de OS por setor.
- Filtro `Minhas solicitações`.
- Relatório individual com exportação CSV.
- Administrador edita nome exibido do usuário.
- Administrador edita perfil e setor na mesma tela.
- Preferência pessoal de tema claro/escuro.
- Modo baixa visão.
- Mensagem explicando que é preciso assumir OS para liberar ações.
- Build e testes validados.

---

## 15. Próximas melhorias recomendadas

Eu recomendo para a próxima rodada:

1. Editor completo de OS aberta pelo galponista antes de alguém assumir.
2. Relatório individual em PDF além do CSV.
3. Painel de escala/equipe por turno.
4. Campo de tempo gasto real na OS.
5. Fotos obrigatórias antes/depois para OS crítica.
6. SLA por prioridade e setor.
7. Dashboard de reincidência por ativo.
8. Tela de TV para supervisão mostrando OS críticas em tempo real.
9. Modo offline parcial para abrir rascunho de OS no galpão sem sinal.

