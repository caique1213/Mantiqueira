# 12 — Administração e Configurações

## Princípio

O administrador deve ter controle amplo sem editar código.

## Abas sugeridas

- Geral.
- Aparência.
- Layout.
- Home.
- Menu.
- Usuários.
- Permissões.
- Posturas.
- Estruturas.
- Tipos de ativos.
- Modelos.
- Status.
- Prioridades.
- Tipos de problema.
- Sons.
- Textos.
- Relatórios.
- Histórico.
- Segurança.

## Geral

- nome do sistema;
- empresa;
- unidade;
- logo;
- favicon;
- frase institucional;
- timezone;
- formato de data.

## Home

- título;
- subtítulo;
- imagem;
- módulos;
- ordem;
- visibilidade;
- indicadores.

## Menu

- nome;
- ícone;
- ordem;
- visibilidade;
- perfil permitido.

## Status

CRUD administrativo.

Cada status:

- nome;
- cor;
- ícone;
- final?
- permite edição?
- ordem.

## Prioridades

CRUD.

Cada prioridade:

- nome;
- cor;
- peso;
- SLA opcional.

## Tipos de problema

CRUD e associação a setor.

## Estrutura

Permitir editar dados operacionais, mas proteger regras críticas.

## Histórico de configuração

Cada mudança de configuração deve poder ser auditada.

Temas personalizados devem suportar versão.

## Importante

"Total controle" não significa permitir editar SQL ou segredos pela interface.

Controle administrativo deve ser profundo, mas seguro.
