# 02 — Arquitetura do Sistema

## Infraestrutura obrigatória

### Supabase

Responsabilidades:

- Auth.
- PostgreSQL.
- RLS.
- Storage.
- RPCs/funções de banco quando necessário.
- Realtime apenas onde fizer sentido.
- Auditoria.

### GitHub

Responsabilidades:

- Código.
- Branches.
- Pull requests.
- Histórico.
- CI opcional.

### Cloudflare

Responsabilidades:

- Deploy do frontend.
- Domínio.
- CDN.

## Frontend

O framework pode ser escolhido na auditoria inicial, com estas exigências:

- TypeScript recomendado.
- Arquitetura modular.
- Componentes reutilizáveis.
- Sistema de design por tokens.
- Deploy estático/edge compatível com Cloudflare.
- Integração limpa com Supabase.
- Separação entre domínio, UI e acesso a dados.
- Testes para regras críticas.

## Domínios principais

1. Identidade e acesso.
2. Estrutura física.
3. Inventário técnico.
4. Biblioteca de modelos.
5. Instalações e substituições.
6. Ordens de Serviço.
7. Histórico.
8. Configuração.
9. Tema.
10. Notificações.
11. Análises.
12. Auditoria.

## Regra de modelagem

Não criar uma tabela única gigante chamada `ativos` com todos os campos imagináveis.

Separar:

- local físico;
- posição lógica;
- modelo técnico;
- ativo físico;
- instalação;
- atributos técnicos;
- anexos;
- histórico;
- relações.

## Realtime

Pode ser usado para:

- novos chamados;
- mudanças de status;
- alertas setoriais.

Não usar Realtime em tudo sem necessidade.

## Cache

Dados estáveis:

- paletas.
- tipos.
- estrutura física.

Podem ser cacheados.

Dados dinâmicos:

- OS.
- notificações.
- status.

Devem ter atualização adequada.

## Erros

A UI deve distinguir:

- carregando;
- sem dados;
- erro de permissão;
- erro de rede;
- erro de validação;
- erro do servidor.

Nunca mostrar "nenhum dado" quando houve erro de consulta.
