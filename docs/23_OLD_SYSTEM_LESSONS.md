# 23 — Lições do Sistema Antigo

## Problemas que não devem voltar

### 1. Tela carregando infinitamente

Toda inicialização precisa de:

- timeout;
- erro explícito;
- retry;
- estado carregado.

### 2. Dados sumindo

O banco deve ser fonte de verdade.

Não depender de localStorage para dados críticos.

### 3. OS desaparecendo após segundos

Evitar mistura inconsistente entre cache e banco.

### 4. Erros de permissão externos

Configurar Auth/RLS de forma explícita.

### 5. Mobile improvisado

Não usar escala 4x.

### 6. Interface poluída

Reduzir densidade.

### 7. Ações em OS finalizadas

Bloquear.

### 8. Falta de detalhes

OS precisa de histórico e dados.

### 9. Relatório por dia

Preservar a necessidade.

### 10. Alarmes

Preservar 5 sons e fala, com controle melhor.

## Funções antigas que devem ser preservadas conceitualmente

- Dashboard.
- Abrir OS.
- Painel Elétrica.
- Painel Mecânica.
- Mapa.
- Todos chamados.
- Equipamentos/Ativos.
- Histórico.
- Relatórios diários.
- Usuários.
- Configurações.
