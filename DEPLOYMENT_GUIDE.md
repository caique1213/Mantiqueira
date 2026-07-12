# Guia completo de implantação

Este documento descreve a implantação do Mantiqueira Maintenance Hub usando exatamente a arquitetura deste repositório:

- Supabase para autenticação, PostgreSQL, funções RPC, Storage privado e Edge Function;
- GitHub para versionamento do código;
- Cloudflare Pages para compilar e publicar o frontend React/Vite.

O procedimento recomendado usa um projeto Supabase novo e o Supabase CLI. Não use a senha do banco, uma chave `service_role` ou qualquer outro segredo no frontend, no GitHub ou nas variáveis `VITE_*`.

## 1. O que será criado

Ao final, haverá:

1. um projeto Supabase com as 12 migrations aplicadas;
2. 48 posturas, 199 baterias e toda a estrutura física inicial;
3. quatro buckets privados: `asset-media`, `work-order-media`, `branding` e `report-exports`;
4. um primeiro usuário administrador;
5. a Edge Function `admin-invite-user` publicada;
6. um repositório GitHub privado;
7. um site publicado pelo Cloudflare Pages;
8. recuperação de senha e convites redirecionando para o endereço correto do site.

## 2. Sites e ferramentas necessários

Crie ou confirme o acesso a:

- [Supabase Dashboard](https://supabase.com/dashboard);
- [GitHub](https://github.com/);
- [Cloudflare Dashboard](https://dash.cloudflare.com/);
- [Node.js](https://nodejs.org/) versão 20 ou mais recente;
- Git instalado no computador;
- PowerShell.

O projeto usa `pnpm`. Caso o comando ainda não exista, abra o PowerShell e execute:

```powershell
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version
node --version
git --version
```

O repositório exige Node.js `>=20`.

## 3. Preparar a pasta no computador

Abra o PowerShell dentro da pasta raiz do projeto, a mesma que contém `package.json`, `src` e `supabase`.

Exemplo:

```powershell
Set-Location "C:\Users\SEU_USUARIO\Downloads\mantiqueira-maintenance-hub"
```

Instale as dependências exatamente conforme o arquivo de lock:

```powershell
pnpm install --frozen-lockfile
```

Antes de conectar qualquer serviço, valide o código:

```powershell
pnpm verify
```

Esse comando executa lint, verificação TypeScript, testes unitários e build de produção. Se falhar, não avance para produção antes de resolver o erro.

## 4. Criar o projeto no Supabase

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard).
2. Entre na organização correta.
3. Clique em **New project**.
4. Use um nome como `mantiqueira-maintenance-hub`.
5. Crie uma senha forte para o banco e guarde-a em um gerenciador de senhas.
6. Selecione a região apropriada para a empresa.
7. Aguarde a conclusão da criação.

Use preferencialmente um projeto novo. A migration de identidade transforma o primeiro usuário da base em administrador. Reaproveitar um projeto com usuários ou tabelas antigas torna esse resultado menos previsível.

### 4.1 Identificar o Project Ref

O `Project Ref` aparece em **Project Settings → General** e também na URL do painel:

```text
https://supabase.com/dashboard/project/SEU_PROJECT_REF
```

Ele não é uma senha. Mesmo assim, mantenha os dados operacionais organizados e não publique capturas do painel contendo outras credenciais.

## 5. Aplicar as migrations do banco

As migrations ficam em `supabase/migrations` e devem ser aplicadas na ordem numérica. O CLI registra essa ordem e evita repetições acidentais.

### 5.1 Entrar pelo Supabase CLI

No PowerShell, dentro da pasta do projeto:

```powershell
pnpm exec supabase login
```

O navegador abrirá para autorizar o CLI. Não salve o token gerado em arquivo do repositório.

### 5.2 Vincular a pasta ao projeto remoto

Substitua o valor de exemplo:

```powershell
pnpm exec supabase link --project-ref SEU_PROJECT_REF
```

Se o CLI solicitar a senha do banco, digite-a somente no prompt. Não cole a senha em `package.json`, `.env.local`, GitHub ou Cloudflare.

### 5.3 Fazer a prévia

```powershell
pnpm exec supabase db push --dry-run
```

Confira se aparecem as migrations de `202607110001_foundation.sql` até `202607110012_security_hardening.sql`.

### 5.4 Aplicar definitivamente

```powershell
pnpm exec supabase db push --include-seed
```

O arquivo `supabase/seed.sql` não cria ativos ou OS fictícias. Os dados estruturais mínimos são criados pelas migrations, e o seed apenas confirma que a sequência foi concluída.

### 5.5 Validar a estrutura no SQL Editor

No Supabase, abra **SQL Editor → New query** e execute:

```sql
select
  (select count(*) from public.postures) as posturas,
  (select count(*) from public.posture_layout_slots) as slots_do_mapa,
  (select count(*) from public.batteries) as baterias,
  (select count(*) from public.asset_positions) as posicoes_tecnicas;
```

O resultado esperado é:

```text
posturas = 48
slots_do_mapa = 60
baterias = 199
posicoes_tecnicas = 1784
```

Confira também os buckets:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('asset-media', 'work-order-media', 'branding', 'report-exports')
order by id;
```

Todos devem mostrar `public = false`.

### 5.6 Se o SQL Editor for a única opção

O método suportado e mais seguro é o CLI. Se for absolutamente impossível usá-lo, cada arquivo `.sql` pode ser executado manualmente no SQL Editor, começando em `202607110001_foundation.sql` e terminando em `202607110012_security_hardening.sql`, sem pular nenhum. Porém, o histórico do CLI não será atualizado automaticamente. Não misture esse método com um `db push` posterior sem primeiro reconciliar o histórico de migrations. Para evitar duplicações e um estado difícil de auditar, prefira o procedimento das seções 5.1 a 5.4.

## 6. Criar o primeiro administrador

Faça esta etapa somente depois de aplicar as migrations.

1. No Supabase, abra **Authentication → Users**.
2. Clique em **Add user** ou **Create user**.
3. Informe o e-mail do primeiro administrador.
4. Defina uma senha provisória forte.
5. Marque o e-mail como confirmado, se o painel apresentar essa opção.
6. Crie o usuário.

O trigger `private.handle_new_auth_user()` verifica se existe administrador ativo. O primeiro usuário recebe automaticamente:

- perfil `administrador`;
- setor primário `administração`;
- associação ao site Mantiqueira;
- perfil ativo.

Valide no SQL Editor, substituindo o e-mail:

```sql
select
  u.email,
  p.display_name,
  p.active,
  r.code as perfil
from auth.users u
join public.profiles p on p.id = u.id
join public.profile_roles pr on pr.profile_id = p.id
join public.roles r on r.id = pr.role_id
where lower(u.email) = lower('ADMIN@EMPRESA.COM');
```

O resultado deve conter `active = true` e `perfil = administrador`.

Não crie vários usuários antes dessa conferência. Usuários seguintes entram inicialmente como `galponista` e inativos, para que um administrador aprove e atribua o perfil correto.

## 7. Configurar autenticação e URLs

No Supabase, abra **Authentication → URL Configuration**.

Durante o desenvolvimento local, use:

- **Site URL:** `http://localhost:5173`
- **Redirect URL permitida:** `http://localhost:5173/auth/update-password`

Depois que o Cloudflare gerar o domínio, altere a **Site URL** para a URL de produção e mantenha todas as rotas realmente usadas. Exemplo:

```text
Site URL
https://mantiqueira-maintenance-hub.pages.dev

Redirect URLs
http://localhost:5173/auth/update-password
https://mantiqueira-maintenance-hub.pages.dev/auth/update-password
```

Se houver domínio próprio, acrescente também:

```text
https://manutencao.suaempresa.com/auth/update-password
```

Não use curingas amplos sem necessidade. O frontend gera o redirecionamento de recuperação de senha com `window.location.origin + /auth/update-password`.

### 7.1 Cadastro público

O produto não possui fluxo de cadastro público. Em **Authentication → Providers → Email**, mantenha o provedor de e-mail ativo, mas desabilite o cadastro aberto de usuários. Usuários devem ser criados pelo administrador ou pelo painel do Supabase.

### 7.2 E-mails de produção

Para convites e recuperação de senha confiáveis em produção, configure o provedor SMTP e os modelos de e-mail da organização no Supabase. Teste o envio para um endereço não administrativo antes de liberar o sistema para a equipe.

## 8. Obter somente as chaves públicas do frontend

No Supabase, abra **Project Settings → API** ou o painel **Connect**. Copie somente:

- **Project URL**;
- **Publishable key**. Em projetos que ainda mostram o modelo legado, use a chave pública `anon`, nunca `service_role`.

Não copie para o frontend:

- senha do banco;
- `service_role`;
- secret key;
- token pessoal do Supabase CLI;
- credenciais SMTP.

## 9. Configurar e testar localmente

Copie o modelo de ambiente:

```powershell
Copy-Item .env.example .env.local
```

Edite `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA_AQUI
VITE_ENABLE_ADMIN_INVITES=false
```

O arquivo `.env.local` já é ignorado pelo Git. Nunca force sua inclusão no repositório.

Inicie o site:

```powershell
pnpm dev
```

Abra [http://localhost:5173](http://localhost:5173) e entre com o primeiro administrador.

Antes de publicar, execute novamente:

```powershell
pnpm verify
```

## 10. Publicar a Edge Function de convites

A função está em `supabase/functions/admin-invite-user/index.ts`. Ela:

- exige um JWT válido;
- confere `users.manage` e `roles.manage` pelo banco;
- usa `service_role` somente dentro do ambiente protegido da função;
- convida o usuário por e-mail;
- atribui perfil e setor por uma RPC administrativa auditada.

### 10.1 Publicar a função

Com o projeto já vinculado:

```powershell
pnpm exec supabase functions deploy admin-invite-user
```

O arquivo `supabase/config.toml` define `verify_jwt = true` para essa função.

### 10.2 Configurar os valores próprios da aplicação

Depois que a URL final do Cloudflare existir, defina:

```powershell
pnpm exec supabase secrets set SITE_URL="https://mantiqueira-maintenance-hub.pages.dev" ALLOWED_ORIGIN="https://mantiqueira-maintenance-hub.pages.dev"
```

Regras:

- `SITE_URL` deve conter a origem principal do site; a função acrescenta `/auth/update-password` ao convite;
- `ALLOWED_ORIGIN` deve ser a origem exata, sem barra no fim;
- se usar domínio próprio, substitua ambos pelos endereços do domínio próprio;
- não coloque mais de uma origem numa string separada por vírgulas, porque a função atual trabalha com uma origem configurada;
- o Supabase fornece `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` ao ambiente hospedado da função; não exponha esses valores no frontend.

Liste somente os nomes dos secrets para confirmar a configuração:

```powershell
pnpm exec supabase secrets list
```

Não imprima valores secretos em logs ou capturas de tela.

### 10.3 Ativar os convites no frontend

Somente após a função estar publicada e testada, altere o ambiente local ou do Cloudflare para:

```dotenv
VITE_ENABLE_ADMIN_INVITES=true
```

Se a função ainda não estiver pronta, mantenha `false`. A administração continuará orientando a criação pelo painel **Authentication → Users**.

## 11. Enviar o projeto ao GitHub

### 11.1 Criar o repositório

1. Acesse [github.com/new](https://github.com/new).
2. Use um nome como `mantiqueira-maintenance-hub`.
3. Marque o repositório como **Private**.
4. Não adicione README, `.gitignore` ou licença nessa tela, pois a pasta já contém esses arquivos.
5. Clique em **Create repository**.

### 11.2 Conferir o que será enviado

No PowerShell:

```powershell
git status
git check-ignore .env.local
```

O segundo comando deve mostrar `.env.local` como ignorado. Verifique visualmente que não há senha, `service_role`, token ou arquivo de credenciais entre os arquivos preparados.

### 11.3 Fazer o primeiro push

Se a pasta já possui `.git`:

```powershell
git add .
git commit -m "feat: entrega inicial do Mantiqueira Maintenance Hub"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/mantiqueira-maintenance-hub.git
git push -u origin main
```

Se `origin` já existir, confira antes:

```powershell
git remote -v
```

E, somente se precisar apontar para o repositório correto:

```powershell
git remote set-url origin https://github.com/SEU_USUARIO/mantiqueira-maintenance-hub.git
git push -u origin main
```

Não envie a pasta `node_modules`, `dist`, relatórios de teste ou `.env.local`; todos estão cobertos pelo `.gitignore` atual.

## 12. Publicar no Cloudflare Pages

1. Acesse o [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Abra **Workers & Pages**.
3. Clique em **Create application** e escolha **Pages**.
4. Escolha **Connect to Git**.
5. Autorize o GitHub e selecione o repositório privado criado na etapa anterior.
6. Use a branch de produção `main`.

Configure o build:

| Campo                  | Valor                                |
| ---------------------- | ------------------------------------ |
| Framework preset       | React (Vite), ou configuração manual |
| Build command          | `pnpm build`                         |
| Build output directory | `dist`                               |
| Root directory         | `/` ou vazio                         |

Em **Environment variables**, para **Production** e também **Preview** se os previews devem usar o mesmo backend, adicione:

```text
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA_AQUI
VITE_ENABLE_ADMIN_INVITES=true
NODE_VERSION=22
```

`VITE_SUPABASE_URL` e a Publishable Key chegam ao navegador por definição; a segurança dos dados vem do JWT, das permissões, das RPCs e do RLS. Não crie uma variável `VITE_SUPABASE_SERVICE_ROLE_KEY`.

Salve e inicie o deploy. Ao concluir, o Cloudflare exibirá um endereço parecido com:

```text
https://mantiqueira-maintenance-hub.pages.dev
```

Cada novo push na branch `main` gera um novo deploy automaticamente.

### 12.1 Atualizar as URLs depois do primeiro deploy

Agora volte às etapas 7 e 10.2 e substitua os exemplos pela URL exata do Cloudflare:

1. Supabase **Authentication → URL Configuration**;
2. `SITE_URL` e `ALLOWED_ORIGIN` da Edge Function;
3. `VITE_ENABLE_ADMIN_INVITES=true` no Cloudflare, se ainda estava desabilitado;
4. execute **Retry deployment** ou faça um novo commit para recompilar o frontend.

### 12.2 Domínio próprio

Se conectar um domínio próprio no Cloudflare:

1. adicione o domínio em **Workers & Pages → projeto → Custom domains**;
2. acrescente a rota `/auth/update-password` à lista de Redirect URLs do Supabase;
3. altere a Site URL do Supabase se o domínio próprio for o principal;
4. atualize `SITE_URL` e `ALLOWED_ORIGIN` da Edge Function;
5. teste login, recuperação e convite novamente.

## 13. Validação obrigatória de produção

Faça a validação com dados de teste claramente identificados, removendo-os ou arquivando-os ao final.

### 13.1 Login e segurança

- entrar como administrador;
- sair e entrar novamente;
- solicitar recuperação de senha e chegar em `/auth/update-password`;
- confirmar que uma URL de imagem privada não funciona como arquivo público permanente;
- confirmar que um usuário inativo não acessa o sistema;
- confirmar que o último administrador não pode ser desativado ou rebaixado.

### 13.2 Estrutura física

- abrir o mapa e contar as 48 posturas;
- confirmar os 12 vazios físicos do mapa;
- confirmar 46, 47 e 48 nas três linhas inferiores da primeira coluna;
- abrir uma postura de 1 a 44 e conferir B1–B4;
- abrir a 45 e conferir B1–B5;
- abrir 46, 47 ou 48 e conferir B1–B6;
- abrir o diagrama de bateria e conferir as oito posições técnicas padrão.

### 13.3 Inventário

- criar um modelo técnico;
- criar um ativo físico com número de série próprio;
- instalar o ativo numa posição vazia;
- enviar foto geral e foto de placa;
- confirmar que a foto é exibida por URL assinada;
- remover e substituir o ativo;
- confirmar que a instalação anterior e o histórico continuam preservados.

### 13.4 Ordens de Serviço

- abrir OS pelo módulo;
- abrir OS diretamente por um ativo e conferir preenchimento automático;
- assumir, iniciar, comentar, anexar evidência, aguardar peça, retomar e resolver;
- confirmar que resolvida/cancelada bloqueia ações operacionais comuns;
- testar reabertura administrativa e auditoria;
- testar cancelamento com motivo e confirmação `CANCELAR`.

### 13.5 Administração

- convidar um usuário de teste;
- atribuir cada perfil padrão;
- alterar um catálogo e conferir o efeito na interface;
- aplicar cada uma das cinco paletas;
- criar uma versão personalizada, visualizar, salvar, desfazer e restaurar;
- verificar registros em **Administração → Auditoria**.

## 14. Fluxo de atualização após a implantação

### 14.1 Mudança somente no frontend

```powershell
pnpm verify
git add .
git commit -m "fix: descreva a alteração"
git push origin main
```

O Cloudflare fará o novo deploy.

### 14.2 Nova migration e frontend

Aplicar primeiro o banco, depois publicar o código que depende dele:

```powershell
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
pnpm verify
git add .
git commit -m "feat: descreva a migração e a interface"
git push origin main
```

Nunca edite uma migration que já foi aplicada em produção. Crie um novo arquivo de migration com timestamp posterior.

### 14.3 Alteração da Edge Function

```powershell
pnpm exec supabase functions deploy admin-invite-user
```

Teste o convite com um usuário que não tenha privilégios administrativos e com um administrador. O primeiro deve ser recusado; o segundo, aceito.

## 15. Operação, backup e recuperação

- mantenha o repositório GitHub privado;
- proteja as contas Supabase, GitHub e Cloudflare com MFA;
- use usuários individuais, nunca uma conta administrativa compartilhada;
- faça backup periódico do PostgreSQL e defina retenção compatível com o plano contratado;
- exporte e guarde com segurança as fotos e documentos cuja retenção seja obrigatória;
- monitore uso de banco, Storage, tráfego e falhas de função;
- examine a auditoria após alterações de usuário, tema, estrutura física, ativo e OS;
- teste restauração em ambiente separado, não apenas a criação do backup;
- use um projeto Supabase de homologação para migrations críticas antes de produção.

## 16. Solução de problemas

### O site mostra que o Supabase não está configurado

Confira os nomes exatos:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

No Cloudflare, qualquer alteração nessas variáveis exige novo deploy.

### O login funciona, mas o usuário não acessa os módulos

Confirme `profiles.active`, a associação em `site_memberships`, o perfil em `profile_roles` e as permissões do perfil. Use a interface administrativa; não altere essas tabelas diretamente em operação normal.

### O convite é bloqueado pelo navegador

Confira se `ALLOWED_ORIGIN` é exatamente a origem exibida no navegador, sem caminho e sem barra final. Confirme também que `VITE_ENABLE_ADMIN_INVITES=true` só foi ativado após publicar a função.

### O convite abre o site, mas não a troca de senha

Confirme:

```text
SITE_URL=https://SEU_DOMINIO
```

E adicione a mesma rota às Redirect URLs do Supabase.

### A foto foi enviada, mas não aparece

Confirme que:

- o registro foi criado em `asset_media` ou `work_order_media`;
- o caminho começa com `site_id/asset_id/` ou `site_id/work_order_id/`;
- o usuário tem acesso ao site e ao registro;
- o bucket continua privado;
- o relógio do dispositivo está correto, pois as URLs de prévia expiram.

### `db push` informa conflito de histórico

Não execute migrations novamente às cegas. Compare o histórico local com o remoto usando o Supabase CLI. Esse problema costuma ocorrer quando arquivos foram colados manualmente no SQL Editor e depois o CLI foi usado sem reconciliar a tabela de migrations.

## 17. Documentação oficial de apoio

- [Supabase CLI: db push](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Supabase: migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase: secrets em Edge Functions](https://supabase.com/docs/guides/functions/secrets)
- [GitHub: adicionar código local](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
- [Cloudflare Pages: integração com Git](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Pages: configuração de build](https://developers.cloudflare.com/pages/configuration/build-configuration/)
