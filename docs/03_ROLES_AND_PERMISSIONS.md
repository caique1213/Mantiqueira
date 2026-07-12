# 03 — Perfis e Permissões

## Perfis padrão

### Galponista

Pode:

- entrar no sistema;
- ver Home;
- ver mapa;
- abrir OS;
- acompanhar OS permitidas;
- ver status;
- adicionar contexto/fotos conforme política;
- ver ativos em modo consulta.

Não pode:

- administrar usuários;
- editar tema;
- alterar estrutura;
- excluir ativos;
- alterar dados técnicos críticos sem permissão.

### Eletricista

Pode:

- tudo do Galponista;
- ver painel Elétrica;
- assumir OS elétrica;
- iniciar atendimento;
- adicionar diagnóstico;
- adicionar observações;
- colocar aguardando peça;
- resolver OS;
- consultar inventário;
- editar ativos elétricos conforme política;
- registrar substituição de motor;
- anexar foto de placa.

### Mecânico

Pode:

- tudo do Galponista;
- ver painel Mecânica;
- atender OS mecânica;
- editar ativos mecânicos conforme política;
- registrar substituição de redutor;
- anexar fotos e dados.

### Administrador

Pode:

- tudo;
- usuários;
- roles;
- permissões;
- configurações;
- aparência;
- temas;
- módulos;
- textos;
- status;
- prioridades;
- tipos;
- sons;
- estruturas;
- relatórios;
- auditoria;
- edição avançada.

## Proteções

- Usuário não pode se auto-desativar por clique acidental.
- Último administrador ativo não pode ser desativado/rebaixado.
- Mudança de role exige confirmação clara.
- Exclusões destrutivas exigem confirmação.
- Reabertura de OS finalizada deve ser auditada.
- Edição de estrutura física deve ter modo avançado.

## Permissões granulares futuras

O banco deve permitir evoluir para permissões como:

- `work_orders.create`
- `work_orders.assign`
- `work_orders.resolve`
- `assets.view`
- `assets.edit`
- `assets.replace`
- `models.manage`
- `themes.manage`
- `users.manage`
- `audit.view`

Não é obrigatório expor toda granularidade na primeira tela, mas a arquitetura não deve impedir evolução.
