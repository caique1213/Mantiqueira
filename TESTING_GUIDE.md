# Guia de testes e validação

Este documento separa quatro níveis de validação:

1. análise estática e build do frontend;
2. testes unitários e de interface;
3. testes locais do Supabase;
4. homologação integrada contra um projeto Supabase real.

Os testes automatizados do frontend não substituem a validação das migrations, do RLS e dos e-mails num projeto Supabase remoto.

## 1. Preparação

Requisitos:

- Node.js 20 ou superior;
- `pnpm` disponível;
- dependências instaladas;
- Docker Desktop somente para a pilha Supabase local;
- navegadores do Playwright para os testes E2E.

Na raiz do repositório:

```powershell
pnpm install --frozen-lockfile
```

Para instalar o Chromium usado pelo Playwright:

```powershell
pnpm exec playwright install chromium
```

## 2. Verificação rápida antes de cada commit

Execute:

```powershell
pnpm verify
```

O script atual roda, nesta ordem:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

O commit só deve ser feito quando os quatro terminarem com código de saída zero.

## 3. Comandos individuais

### Lint

```powershell
pnpm lint
```

Falha com qualquer warning, pois o projeto usa `--max-warnings=0`.

### TypeScript

```powershell
pnpm typecheck
```

Valida frontend, testes e configuração Vite sem gerar arquivos de produção.

### Testes unitários

```powershell
pnpm test
```

Para trabalhar de modo interativo:

```powershell
pnpm test:watch
```

Para cobertura:

```powershell
pnpm test:coverage
```

Os testes atuais cobrem principalmente:

- matriz física oficial de 15 × 4;
- 48 posturas e 12 espaços vazios;
- 199 baterias;
- posição especial de 46, 47 e 48;
- diagrama lateral da bateria;
- oito posições técnicas clicáveis;
- seis esteiras de nylon e seis esteiras brancas por bateria;
- schema, presets, persistência e aplicação segura dos temas;
- pré-visualização, desfazer e salvar tema.

### Build de produção

```powershell
pnpm build
```

O resultado é escrito em `dist`. Abra o build localmente com:

```powershell
pnpm preview
```

E acesse [http://localhost:4173](http://localhost:4173).

## 4. Testes E2E do frontend

Execute:

```powershell
pnpm test:e2e
```

O Playwright:

- compila o projeto;
- inicia `vite preview` em `127.0.0.1:4173`;
- testa Chromium desktop;
- testa um viewport Pixel 7;
- salva trace na primeira repetição em CI;
- salva screenshot apenas em falha;
- gera relatório HTML em `playwright-report`.

Para abrir o relatório:

```powershell
pnpm exec playwright show-report
```

Os E2E atuais usam URL e Publishable Key de placeholder fornecidas pelo próprio `playwright.config.ts`. Eles validam o shell e a experiência de login sem depender de um projeto Supabase real. Portanto, não comprovam login real, RLS, Storage, convite ou e-mail.

## 5. Testes locais do Supabase

Esta etapa exige Docker Desktop em execução.

### 5.1 Iniciar a pilha

```powershell
pnpm supabase:start
```

### 5.2 Recriar o banco pelas migrations

```powershell
pnpm supabase:reset
```

Esse comando recria o banco local e aplica todas as migrations e o `supabase/seed.sql`. Nunca execute um reset contra produção.

### 5.3 Executar os testes pgTAP

```powershell
pnpm supabase:test
```

Os arquivos em `supabase/tests/database` validam contratos centrais da estrutura física e da segurança. Se o Docker ou a pilha local não estiver disponível, essa validação não ocorre; uma simples análise de sintaxe SQL não substitui os testes num PostgreSQL/Supabase real.

### 5.4 Gerar tipos do banco local

```powershell
pnpm supabase:types
```

O comando substitui `src/types/database.generated.ts` com base no schema local. Revise o diff antes de commitar.

### 5.5 Encerrar

```powershell
pnpm supabase:stop
```

## 6. Pré-validação de migrations remotas

Use primeiro um projeto de homologação. Depois de vincular o CLI:

```powershell
pnpm exec supabase db push --dry-run
```

Confirme que o plano contém somente migrations novas. Então:

```powershell
pnpm exec supabase db push --include-seed
```

Não altere migrations já aplicadas. Correções devem entrar em uma nova migration.

## 7. Validações SQL após as migrations

No SQL Editor do projeto de homologação:

### 7.1 Contagens físicas

```sql
select
  (select count(*) from public.postures) as posturas,
  (select count(*) from public.posture_layout_slots) as slots,
  (select count(*) from public.posture_layout_slots where posture_id is null) as vazios,
  (select count(*) from public.batteries) as baterias,
  (select count(*) from public.asset_positions) as posicoes;
```

Esperado:

```text
posturas = 48
slots = 60
vazios = 12
baterias = 199
posicoes = 1784
```

### 7.2 Baterias por faixa

```sql
select p.number, count(b.id) as quantidade
from public.postures p
left join public.batteries b on b.posture_id = p.id
group by p.number
order by p.number;
```

Esperado:

- posturas 1–44: quatro;
- postura 45: cinco;
- posturas 46–48: seis.

### 7.3 Storage privado

```sql
select id, public
from storage.buckets
where id in ('asset-media', 'work-order-media', 'branding', 'report-exports')
order by id;
```

Todos devem retornar `false`.

### 7.4 RLS habilitado

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

As tabelas sensíveis de domínio devem estar com `rowsecurity = true`.

### 7.5 Presets de tema

```sql
select key, name, system_preset, active
from public.theme_presets
order by key;
```

Confirme os cinco presets Mantiqueira com `system_preset = true` e a opção `custom` com `system_preset = false`.

## 8. Matriz de homologação por perfil

Crie quatro usuários de teste, um para cada perfil. Não use o administrador principal para todos os testes.

| Ação                            | Galponista |        Eletricista |           Mecânico | Administrador |
| ------------------------------- | ---------: | -----------------: | -----------------: | ------------: |
| Entrar e ver mapa               |        Sim |                Sim |                Sim |           Sim |
| Abrir OS                        |        Sim |                Sim |                Sim |           Sim |
| Atender OS elétrica             |        Não |                Sim | Conforme permissão |           Sim |
| Atender OS mecânica             |        Não | Conforme permissão |                Sim |           Sim |
| Gerenciar usuários              |        Não |                Não |                Não |           Sim |
| Gerenciar temas e configurações |        Não |                Não |                Não |           Sim |
| Consultar auditoria             |        Não |                Não |                Não |           Sim |

Além de testar o que deve funcionar, teste explicitamente as negativas. A interface esconder um botão não é suficiente: a chamada ao Supabase também deve retornar erro de autorização.

## 9. Cenários integrados obrigatórios

### 9.1 Usuários

1. entre como administrador;
2. convide um galponista;
3. abra o e-mail e defina a senha;
4. confirme que o galponista não gerencia usuários;
5. tente desativar o próprio administrador;
6. tente remover o último administrador;
7. confirme que ambos os fluxos perigosos são bloqueados;
8. confirme auditoria das alterações permitidas.

### 9.2 Inventário e histórico

1. crie fabricante e modelo técnico;
2. crie um ativo físico com número de série diferente dos dados do modelo;
3. instale numa posição livre;
4. anexe foto geral e foto de placa;
5. abra uma OS ligada ao ativo;
6. remova o ativo com data e motivo;
7. instale o substituto;
8. confira que a OS antiga continua ligada ao ativo antigo;
9. confira as duas instalações na linha do tempo;
10. confirme auditoria.

### 9.3 Ordem de Serviço

1. abra OS sem ativo, por postura;
2. abra OS diretamente por ativo;
3. assuma;
4. inicie;
5. registre diagnóstico e comentário;
6. anexe evidência;
7. marque aguardando peça e informe o item;
8. atenda o item e retome;
9. resolva;
10. confirme que comentários e ações operacionais são bloqueados no estado final;
11. reabra como administrador usando o fluxo explícito;
12. cancele outra OS com motivo e confirmação `CANCELAR`.

### 9.4 Temas

1. aplique Mantiqueira Clássico;
2. aplique Industrial, Premium, Light e Contrast;
3. confirme mudança global, não apenas de botões;
4. entre no Personalizado;
5. altere cores, tipografia, espaço, raio e sombra;
6. visualize sem salvar;
7. desfaça;
8. salve uma versão;
9. restaure o padrão;
10. recarregue o navegador e confirme persistência do tema aplicado.

### 9.5 Storage

1. envie JPEG ou PNG e confirme conversão/otimização para WebP no frontend;
2. confirme o limite de 25 MiB depois da preparação;
3. copie a URL assinada da prévia;
4. verifique que ela expira;
5. tente acessar sem sessão um objeto privado;
6. tente enviar para um prefixo pertencente a outro ativo/site;
7. confirme bloqueio pelo RLS de Storage.

## 10. Responsividade e acessibilidade

Teste no mínimo:

- desktop 1440 × 900;
- notebook 1366 × 768;
- tablet 768 × 1024;
- Android próximo de 412 × 915;
- iPhone próximo de 390 × 844;
- zoom do navegador em 200%;
- navegação por teclado;
- foco visível;
- mensagens de erro associadas aos campos;
- contraste em todas as cinco paletas;
- mapa com vazios físicos preservados sem rolagem horizontal destrutiva;
- diagrama de bateria com alvos tocáveis no celular.

## 11. Observabilidade durante os testes

No navegador, abra DevTools:

- **Console:** não deve haver erro não tratado;
- **Network:** chamadas negadas devem indicar 401/403, não parecer lista vazia;
- **Application → Storage:** não deve existir `service_role` ou senha;
- **Accessibility:** verifique nomes de botões, diálogos e controles.

No Supabase:

- examine logs de Postgres, Auth, Storage e Edge Functions;
- confirme que erros esperados de autorização não geram mudanças parciais;
- procure registros em `audit_logs` para ações críticas;
- confirme que objetos órfãos de upload com falha são removidos pelo frontend quando o registro RPC falha.

## 12. Critério de liberação

Uma versão só está pronta para produção quando:

- `pnpm verify` passa;
- `pnpm test:e2e` passa em desktop e mobile;
- migrations passam num projeto Supabase de homologação;
- contagens físicas são exatas;
- todos os buckets continuam privados;
- testes negativos de RLS passam;
- cada perfil foi testado com usuário separado;
- convite e recuperação funcionam por e-mail;
- troca de ativo preserva histórico;
- estados finais de OS bloqueiam ações indevidas;
- cinco presets e tema personalizado funcionam;
- não há segredos no Git ou no bundle do navegador;
- existe plano de backup e rollback.
