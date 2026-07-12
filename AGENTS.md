# AGENTS.md — Mantiqueira Maintenance Hub

## 1. Missão deste repositório

Este repositório contém a especificação de um sistema novo, reconstruído do zero, para gestão de manutenção e inventário técnico de ativos da Mantiqueira Brasil.

O projeto NÃO é um simples sistema de chamados.
O projeto NÃO é um almoxarifado tradicional.
O projeto NÃO deve ser tratado como uma planilha transformada em site.

O produto final deve unir:

1. Ordens de Serviço.
2. Mapa físico real das 48 posturas.
3. Visualização gráfica das baterias.
4. Inventário técnico dos ativos instalados.
5. Motores e redutores como ativos físicos reais e históricos.
6. Histórico de instalação, remoção, troca, falhas e manutenção.
7. Análises técnicas e gerenciais.
8. Administração e personalização visual profunda.
9. Interface visual de padrão profissional, moderna, responsiva e altamente trabalhada.

A infraestrutura definida pelo usuário é:

- Supabase: autenticação, PostgreSQL, Storage, RLS e funções de banco.
- GitHub: repositório de código e histórico.
- Cloudflare: hospedagem/deploy do frontend.

Não substituir essa arquitetura por Google Sheets ou Google Apps Script.

## 2. Regra de trabalho para o Codex

Antes de escrever código de produção:

1. Leia TODO este `AGENTS.md`.
2. Leia TODO o conteúdo da pasta `docs/`.
3. Leia `START_HERE_CODEX.md`.
4. Examine as referências visuais em `references/`.
5. Faça uma auditoria de arquitetura.
6. Liste inconsistências, lacunas e decisões técnicas necessárias.
7. Proponha uma implementação por fases.
8. Não comece a implementação completa antes de apresentar o plano.

Ao implementar:

- Trabalhe em fases pequenas, testáveis e integradas.
- Não crie telas desconectadas do banco.
- Não faça dados de demonstração parecerem dados reais.
- Não hard-code regras que devem ser configuráveis.
- Não torne configurável uma regra física marcada como "não negociável" sem um modo administrativo avançado e validações fortes.
- Não exponha `service_role`, senhas, tokens privados ou segredos no frontend.
- Use RLS corretamente.
- Use Storage privado para fotos internas.
- Toda ação crítica deve ter confirmação.
- Toda alteração importante deve gerar auditoria.
- Não apagar histórico técnico ao substituir um ativo.
- Não misturar "modelo técnico" com "ativo físico instalado".
- A placa física do equipamento instalado sempre prevalece sobre dados de biblioteca/modelo.
- A interface deve priorizar clareza visual e exploração gráfica, não tabelas densas.

## 3. Regras físicas que não podem ser alteradas por inferência

### 3.1 Quantidade de posturas

Existem 48 posturas.

### 3.2 Quantidade de baterias por postura

- Posturas 1 a 44: B1, B2, B3 e B4.
- Postura 45: B1 a B5.
- Posturas 46, 47 e 48: B1 a B6.

### 3.3 Mapa físico das posturas

O mapa deve usar EXATAMENTE esta matriz visual, de cima para baixo:

```js
[
  [null, 36, 24, 12],
  [null, 35, 23, 11],
  [null, 34, 22, 10],
  [45,   33, 21,  9],
  [44,   32, 20,  8],
  [43,   31, 19,  7],
  [42,   30, 18,  6],
  [41,   29, 17,  5],
  [40,   28, 16,  4],
  [39,   27, 15,  3],
  [38,   26, 14,  2],
  [37,   25, 13,  1],
  [48, null, null, null],
  [47, null, null, null],
  [46, null, null, null]
]
```

A contagem principal é de baixo para cima em cada coluna e continua na próxima coluna à esquerda.
As posições `null` são vazios físicos e devem continuar visíveis como espaços vazios no mapa.
Não reorganizar 46, 47 e 48 para "ficar mais bonito".

### 3.4 Estrutura-base por bateria

Cada bateria deve suportar, como posições técnicas padrão:

- Motor Elevador.
- Redutor Elevador.
- Motor Ração.
- Redutor Ração.
- Motor Esteira Branca Superior.
- Motor Esteira Branca Inferior.
- Motor Esteira Nylon Superior.
- Motor Esteira Nylon Inferior.

Além disso, cada postura pode possuir ativos gerais, incluindo:

- Motor da Esteira Preta / transversal.
- Iluminação.
- Ventilação.
- Exaustores.
- Outros ativos cadastráveis.

### 3.5 Regras visuais da bateria

A visão principal da bateria é uma representação lateral.

Convenções definidas pelo usuário:

- Círculos representam motores.
- Cinza representa o carrinho de ração.
- Azul representa esteiras de nylon que transportam ovos.
- Preto representa a bateria/linhas de gaiolas.
- Laranja representa a chamada "esteira branca", localizada sob as gaiolas e usada para retirada de dejetos.
- Vermelho representa o elevador de ovos.
- A esteira preta/transversal não precisa aparecer fisicamente na vista lateral; apenas seu motor precisa aparecer quando aplicável.
- O elevador fica na frente do galpão.
- A esteira preta/transversal fica no fundo do galpão.
- O carrinho de ração se desloca para frente e para trás distribuindo ração.
- Visualmente, o carrinho de ração deve poder ser representado como uma estrutura/retângulo vertical que cobre a altura útil da bateria, de cima até a parte inferior.
- Há 2 motores de esteira de nylon por bateria: superior e inferior.
- Cada motor de esteira de nylon alimenta 3 esteiras de nylon.
- Há 2 motores de esteira branca por bateria: superior e inferior.
- Cada motor de esteira branca movimenta 3 esteiras brancas.

Não simplificar essa estrutura para uma lista comum.

## 4. Conceito correto de "estoque"

Neste projeto, "estoque" NÃO significa saldo de peças em almoxarifado.

O conceito correto é:

> Inventário técnico dos ativos instalados.

O sistema deve responder perguntas como:

- Qual motor está instalado na Postura 27, B2, Esteira de Nylon Superior?
- Qual redutor está instalado no elevador da B4?
- Onde existem motores NORD?
- Quais posturas usam redutores SEW?
- Quais ativos estão sem foto de placa?
- Qual motor foi removido e qual substituiu esse motor?
- Qual ativo teve mais ordens de serviço?

Não implementar controle de quantidade de rolamentos, peças em prateleira ou almoxarifado como módulo principal.

Uma OS pode registrar "aguardando peça" e descrever a peça necessária, mas isso não transforma o sistema em um WMS/ERP de estoque.

## 5. Separação obrigatória entre modelo técnico e ativo físico

### Modelo técnico

Exemplo:

- WEG W22.
- SEW R77.
- NORD UNICASE.
- Pujol.
- K.H. Witte.

O modelo armazena dados de referência reutilizáveis.

### Ativo físico

Exemplo:

- Motor instalado na Postura 27 / B2 / Esteira Nylon Superior.
- Número de série específico.
- Foto da placa específica.
- Data de instalação.
- Estado atual.
- Histórico próprio.

O ativo pode herdar/sugerir dados do modelo, mas pode sobrescrevê-los.

A placa física sempre prevalece.

## 6. Histórico nunca pode ser destruído por troca de ativo

Quando um motor ou redutor é substituído:

- Não atualizar o registro antigo para fingir que sempre foi o novo.
- Encerrar a instalação antiga.
- Registrar a remoção.
- Criar/ativar a nova instalação.
- Preservar as OS ligadas ao ativo antigo.
- Preservar fotos e dados de placa do ativo antigo.
- Registrar motivo da troca.
- Registrar usuário, data e observação.

## 7. Ordens de Serviço

Status padrão:

- Aguardando atendimento.
- Em execução.
- Aguardando peça.
- Resolvida.
- Cancelada.

Prioridades padrão:

- Baixa.
- Normal.
- Alta.
- Crítica.

Essas listas devem ser administráveis, mas o sistema precisa de estados finais equivalentes a resolvida/cancelada para bloquear ações indevidas.

Uma OS deve poder ser aberta:

- Pelo módulo "Abrir OS".
- Pela postura.
- Pela bateria.
- Diretamente clicando em um ativo.

Quando aberta a partir de um ativo, postura, bateria, tipo e ativo devem ser preenchidos automaticamente.

OS resolvida/cancelada não deve continuar exibindo botões operacionais comuns.

Reabertura, se implementada, deve ser administrativa, explícita e auditada.

## 8. Perfis padrão

Perfis mínimos:

- Galponista.
- Eletricista.
- Mecânico.
- Administrador.

O sistema pode suportar perfis adicionais depois, mas não pode remover esses fluxos.

### Galponista

- Abrir OS.
- Ver mapa.
- Consultar status.
- Ver histórico permitido.
- Acompanhar chamados.

### Eletricista

- Tudo que o Galponista pode fazer.
- Ver e atender OS da Elétrica.
- Assumir OS.
- Iniciar atendimento.
- Registrar diagnóstico, observações e conclusão.
- Consultar e editar inventário conforme permissão.

### Mecânico

- Equivalente ao Eletricista para o setor Mecânica.

### Administrador

- Controle total funcional.
- Usuários.
- Permissões.
- Estruturas.
- Configurações.
- Temas.
- Status.
- Prioridades.
- Tipos.
- Sons.
- Textos.
- Auditoria.
- Inventário.
- Relatórios.

O administrador não pode desativar a própria conta sem um fluxo de segurança específico.
O sistema deve impedir a remoção/desativação do último administrador ativo.

## 9. Aparência e personalização

A área administrativa deve possuir 6 opções:

1. Mantiqueira Clássico.
2. Mantiqueira Industrial.
3. Mantiqueira Premium.
4. Mantiqueira Light.
5. Mantiqueira Contrast.
6. Personalizado.

As 5 primeiras são presets completos.
A sexta permite edição profunda.

Trocar o preset deve alterar o visual inteiro do site por meio de tokens de design, não apenas a cor de um botão.

O modo Personalizado deve controlar, no mínimo:

- Fundo principal.
- Fundo secundário.
- Superfícies.
- Cards.
- Menu.
- Header.
- Rodapé.
- Texto principal.
- Texto secundário.
- Bordas.
- Cor principal.
- Cor secundária.
- Destaque.
- Botão principal.
- Botão secundário.
- Botão de perigo.
- Inputs.
- Ícones.
- Badges.
- Marcadores.
- Mapa.
- Motores.
- Redutores.
- Cores de status.
- Cores de prioridade.
- Tipografia.
- Tamanho dos títulos.
- Tamanho dos textos.
- Pesos.
- Espaçamento.
- Arredondamento.
- Sombras.
- Blur.
- Transparência.
- Densidade da interface.

Deve haver pré-visualização em tempo real, salvar, desfazer e restaurar padrão.

## 10. Foco visual

A interface deve ser:

- Profissional.
- Industrial.
- Moderna.
- Escura por padrão, mas com tema claro disponível.
- Visualmente hierárquica.
- Com uso de grandes áreas gráficas.
- Com pouco ruído.
- Com detalhes aparecendo sob demanda.
- Com mapas e diagramas como elementos centrais.
- Responsiva de verdade.
- Excelente no celular e no desktop.

Evitar:

- "card dentro de card dentro de card".
- Excesso de chips e badges.
- Repetição da mesma navegação.
- Tabelas gigantes como interface principal.
- Mobile simplesmente "4x maior".
- Cores de destaque usadas em todo lugar.
- Interfaces que parecem planilhas.

## 11. Segurança

Obrigatório:

- Supabase Auth.
- RLS em todas as tabelas sensíveis.
- Storage privado.
- URLs assinadas ou acesso autenticado para fotos.
- Nunca colocar `service_role` no frontend.
- Nunca colocar senha de banco no repositório.
- Logs para ações críticas.
- Confirmação para exclusão.
- Confirmação reforçada para exclusões destrutivas.
- Tratamento distinto entre "sem dados" e "erro ao carregar".

## 12. Leitura obrigatória

Antes de implementar, leia em ordem:

1. `README.md`
2. `START_HERE_CODEX.md`
3. `docs/00_PROJECT_VISION.md`
4. `docs/01_NON_NEGOTIABLE_RULES.md`
5. `docs/04_POSTURE_MAP_LAYOUT.md`
6. `docs/05_BATTERY_PHYSICAL_MODEL.md`
7. `docs/06_TECHNICAL_ASSET_INVENTORY.md`
8. `docs/07_WORK_ORDERS.md`
9. `docs/12_ADMIN_SETTINGS.md`
10. `docs/13_THEME_SYSTEM_AND_PALETTES.md`
11. `docs/14_DESIGN_SYSTEM_AND_UX.md`
12. Demais documentos.

## 13. Primeira resposta esperada do Codex

Não comece dizendo apenas "vou implementar".

A primeira resposta deve conter:

- Resumo do entendimento.
- Arquitetura proposta.
- Riscos e ambiguidades.
- Modelo de dados inicial.
- Estratégia de RLS.
- Estratégia de Storage.
- Estratégia visual.
- Plano de implementação por fases.
- Critérios de aceitação da Fase 1.

Só então iniciar o código após aprovação.
