# Segurança do Mantiqueira Maintenance Hub

Este documento descreve o modelo de segurança implementado e os cuidados operacionais necessários. A segurança não depende de esconder o JavaScript ou a Publishable Key. Ela depende de autenticação, RLS, permissões, RPCs controladas, Storage privado e operação segura das contas administrativas.

## 1. Classificação das credenciais

### Podem estar no navegador

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_PUBLISHABLE_KEY`;
- `VITE_ENABLE_ADMIN_INVITES`.

A URL e a Publishable Key são identificadores públicos destinados ao cliente. Ainda assim, devem ser usados somente com RLS ativo.

### Nunca podem estar no navegador ou no Git

- senha do banco;
- `service_role`;
- secret key do Supabase;
- token do Supabase CLI;
- token pessoal do GitHub;
- API token global da Cloudflare;
- credenciais SMTP;
- cookies ou JWTs copiados de sessões reais;
- backups contendo dados reais sem criptografia e controle de acesso.

Nunca crie variável com prefixo `VITE_` para um segredo. O Vite incorpora essas variáveis no bundle entregue ao navegador.

## 2. Supabase Auth

O frontend usa login por e-mail e senha com Supabase Auth. Não há tela de cadastro público.

Recomendações de produção:

- desabilitar cadastro público no provedor de e-mail;
- criar usuários pelo administrador ou painel Auth;
- exigir senha forte;
- configurar SMTP da organização;
- restringir Redirect URLs;
- revisar usuários inativos regularmente;
- usar contas individuais, sem credencial compartilhada;
- proteger contas administrativas e contas dos provedores com MFA.

O primeiro usuário criado depois das migrations torna-se administrador. Faça isso deliberadamente e valide o perfil antes de cadastrar os demais.

## 3. Perfis e permissões

Os perfis padrão são:

- `galponista`;
- `eletricista`;
- `mecanico`;
- `administrador`.

O sistema usa permissões de capacidade, como `users.manage`, `roles.manage`, `settings.manage`, `themes.manage` e `audit.view`, em vez de confiar somente no nome do perfil.

Proteções implementadas:

- usuário inativo não possui acesso normal;
- o administrador não remove sua própria função pelo fluxo comum;
- o último administrador ativo não pode ser rebaixado ou desativado;
- permissões essenciais do perfil administrativo são protegidas;
- ações administrativas relevantes passam por RPC e confirmação;
- alterações de perfil e associação ao site são auditadas.

Ocultar botões no frontend é apenas usabilidade. A autorização real é aplicada no banco e na Edge Function.

## 4. Row Level Security

As tabelas sensíveis do schema `public` têm RLS. As policies verificam, conforme o domínio:

- sessão autenticada;
- perfil ativo;
- associação ao site;
- permissão específica;
- setor da OS;
- propriedade do registro;
- estado do ciclo de vida.

O schema `private` contém funções auxiliares internas e não é exposto como API comum. Privilégios são revogados e apenas funções necessárias recebem `EXECUTE` para `authenticated`.

Ao criar uma tabela nova:

1. habilite RLS imediatamente;
2. revogue privilégios amplos;
3. crie policies específicas por operação;
4. teste acesso permitido e negado;
5. adicione auditoria se o dado for relevante;
6. não use policy genérica `using (true)` em dados internos.

## 5. RPCs críticas e integridade

Operações que precisam de histórico, confirmação ou múltiplas mudanças relacionadas passam por funções RPC, incluindo:

- gerenciar usuário;
- instalar, remover e substituir ativo;
- arquivar ativo e mídia;
- transicionar OS;
- registrar e atender item necessário;
- registrar mídia;
- salvar e aplicar tema.

O frontend não deve substituir essas RPCs por `insert`, `update` ou `delete` direto nas tabelas protegidas.

As RPCs validam regras como:

- datas não podem criar instalação futura inválida;
- posição e ativo precisam pertencer ao mesmo site;
- uma instalação atual não pode ser sobrescrita sem encerrar a anterior;
- OS ligada a um ativo/posição precisa ser coerente;
- estado final bloqueia comentários e ações operacionais comuns;
- cancelamento exige motivo e confirmação `CANCELAR`;
- reabertura exige confirmação `REABRIR`;
- arquivamento exige confirmação apropriada.

## 6. Histórico e auditoria

Trocar um motor ou redutor não altera o registro antigo para fazê-lo parecer o novo. O fluxo encerra a instalação anterior e cria uma instalação nova.

São preservados:

- ativo físico antigo;
- número de série;
- dados de placa;
- fotos;
- datas de instalação e remoção;
- motivo da remoção/troca;
- OS ligadas ao ativo da época;
- usuário responsável;
- eventos de auditoria.

`audit_logs` é append-only. Não ofereça uma função comum de editar ou apagar auditoria. Defina retenção conforme a política da empresa e a legislação aplicável.

## 7. Storage privado

Buckets existentes:

| Bucket             | Conteúdo                        | Público |
| ------------------ | ------------------------------- | ------: |
| `asset-media`      | fotos gerais e placas de ativos |     Não |
| `work-order-media` | evidências de OS                |     Não |
| `branding`         | identidade visual permitida     |     Não |
| `report-exports`   | relatórios gerados              |     Não |

Os caminhos usados pelo frontend seguem:

```text
asset-media/{site_id}/{asset_id}/{uuid}.webp
work-order-media/{site_id}/{work_order_id}/{uuid}.webp
```

As policies conferem o prefixo e o acesso do usuário ao site/registro. As prévias são obtidas por URLs assinadas de curta duração, atualmente solicitadas por 600 segundos no frontend.

Controles implementados:

- buckets privados;
- upload de mídia de ativo limitado a quem pode editar aquele tipo de ativo;
- mídia de OS limitada a quem pode acessar a OS;
- atualização deve preservar um prefixo autorizado;
- exclusão direta só é permitida para upload órfão que falhou antes do registro;
- arquivo registrado é arquivado pelo fluxo de domínio;
- limite de 25 MiB para `asset-media` e `work-order-media`;
- imagens do frontend são preparadas em WebP;
- branding não aceita SVG ativo após a migration de hardening.

Não torne esses buckets públicos para “resolver” uma imagem que não aparece. Corrija a associação, a policy ou o caminho.

## 8. Edge Function `admin-invite-user`

A Edge Function é a única parte deste projeto que usa `service_role`, e somente no ambiente servidor do Supabase.

O fluxo:

1. recebe JWT do usuário autenticado;
2. consulta `get_my_access` com o contexto desse usuário;
3. exige `users.manage` e `roles.manage`;
4. valida e-mail, nome, perfil e setor;
5. usa o cliente administrativo para enviar o convite;
6. usa RPC auditada para ativar e atribuir o usuário.

Configuração obrigatória:

- `verify_jwt = true` em `supabase/config.toml`;
- `ALLOWED_ORIGIN` igual à origem de produção;
- `SITE_URL` com a origem principal do site; a função constrói a rota `/auth/update-password`;
- `service_role` somente no secret padrão da função.

Não altere a função para aceitar perfil enviado pelo cliente sem a checagem de permissões. CORS não substitui autenticação; ele apenas controla o uso pelo navegador.

## 9. Proteção contra CSRF, XSS e arquivos ativos

O aplicativo usa JWT no cliente Supabase e não depende de uma sessão administrativa tradicional mantida por cookie próprio. Mesmo assim:

- não injete HTML recebido do usuário;
- não use `dangerouslySetInnerHTML` com conteúdo não confiável;
- mantenha React e dependências atualizados;
- valide URLs e textos no cliente e no banco;
- não permita SVG enviado por usuário como branding ativo;
- mantenha MIME type e extensão coerentes;
- considere antivírus/inspeção adicional se PDFs de terceiros forem liberados em novos fluxos.

O arquivo `public/_headers` já configura CSP, HSTS, proteção contra framing, política de referência e restrições de recursos para o Cloudflare Pages. Se um novo domínio externo for necessário para imagens, fontes ou APIs, atualize a CSP de modo restritivo e teste login, Storage e Edge Functions antes de publicar.

## 10. Confirmações destrutivas

O banco exige confirmações explícitas em operações críticas. A interface também apresenta diálogos reforçados.

Exemplos atuais:

- `CONFIRMAR` para alterações administrativas críticas;
- `CANCELAR` para cancelar OS, além de motivo;
- `REABRIR` para reabrir OS;
- `ARQUIVAR` para arquivar ativo ou mídia;
- `EXCLUIR` em exclusões administrativas previstas pela interface.

Não remova a validação do backend mesmo que o diálogo do frontend seja mantido.

## 11. Segredos e Git

Antes de cada push:

```powershell
git status
git diff --cached
git check-ignore .env.local
```

Procure por padrões indevidos:

```powershell
rg -n "service_role|SUPABASE_SERVICE_ROLE_KEY|postgresql://|BEGIN PRIVATE KEY|ghp_" . --glob "!node_modules/**" --glob "!SECURITY.md"
```

O comando é apenas uma ajuda; não substitui revisão ou secret scanning.

Se um segredo for commitado:

1. revogue/rotacione imediatamente no provedor;
2. não confie apenas em apagar o arquivo no commit seguinte;
3. remova-o do histórico quando necessário;
4. revise logs e uso;
5. atualize ambientes e serviços dependentes.

## 12. Cloudflare e variáveis de build

No Cloudflare Pages, somente estas variáveis do frontend são esperadas:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_ENABLE_ADMIN_INVITES
```

Separe os ambientes de Production e Preview. Se previews não devem acessar dados reais, use um projeto Supabase de homologação nas variáveis de Preview.

Não compartilhe produção e homologação quando testes destrutivos, de permissão ou de migration forem realizados.

## 13. Logs e privacidade

Não grave em log:

- senha;
- token de acesso ou atualização;
- link mágico completo;
- URL assinada completa sem necessidade;
- foto de placa;
- dados pessoais além do mínimo operacional;
- conteúdo interno de OS sem necessidade de diagnóstico.

Os logs de auditoria devem registrar ação, entidade, ator e contexto técnico suficiente, sem se tornar um depósito de credenciais ou dados sensíveis.

## 14. Dependências

Rotina recomendada:

```powershell
pnpm outdated
pnpm audit
```

Antes de atualizar dependências importantes:

1. crie branch;
2. leia as notas de versão;
3. rode `pnpm verify`;
4. rode `pnpm test:e2e`;
5. valide login e integrações em homologação;
6. revise o bundle e o lockfile.

Não aplique atualização automática de grande versão diretamente em produção.

## 15. Checklist de incidente

Em caso de acesso indevido ou vazamento:

1. preserve evidências e horários;
2. desative a conta suspeita;
3. revogue sessões quando aplicável;
4. rotacione credenciais afetadas;
5. revise Auth, Edge Functions, Postgres e Storage logs;
6. verifique alterações em perfis, permissões, temas, ativos e OS;
7. confirme integridade de `audit_logs`;
8. corrija a causa em homologação;
9. comunique responsáveis internos conforme o plano de resposta;
10. documente impacto, resolução e prevenção.

## 16. Checklist de segurança antes da produção

- [ ] GitHub privado e sem segredos;
- [ ] MFA ativado em Supabase, GitHub e Cloudflare;
- [ ] cadastro público desabilitado;
- [ ] Site URL e Redirect URLs restritas;
- [ ] SMTP de produção configurado e testado;
- [ ] primeiro administrador validado;
- [ ] último administrador protegido;
- [ ] RLS habilitado nas tabelas sensíveis;
- [ ] testes negativos de RLS executados;
- [ ] quatro buckets privados;
- [ ] `service_role` ausente do frontend e do Git;
- [ ] Edge Function com `verify_jwt = true`;
- [ ] `ALLOWED_ORIGIN` exato;
- [ ] convites e recuperação de senha testados;
- [ ] auditoria funcionando;
- [ ] backups configurados;
- [ ] restauração testada em ambiente separado;
- [ ] dependências auditadas;
- [ ] domínio e TLS funcionando;
- [ ] plano de resposta a incidente definido.

## 17. Comunicação responsável de vulnerabilidade

Este repositório não publica um endereço externo de segurança. Vulnerabilidades encontradas devem ser comunicadas diretamente ao responsável técnico/administrador designado pela Mantiqueira, sem abrir issue pública com dados, URLs internas, tokens, imagens ou detalhes exploráveis.
