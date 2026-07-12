# 04 — Mapa Físico das 48 Posturas

## Regra

O mapa físico não é uma grade simples de 4 x 12.

Ele possui a particularidade das posturas 46, 47 e 48.

## Matriz oficial de renderização

A matriz abaixo é lida por linhas, de cima para baixo, e por colunas, da esquerda para a direita:

```js
export const POSTURE_LAYOUT = [
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
];
```

## Interpretação

Coluna mais à direita:

- 1 embaixo.
- 12 em cima.

Segunda coluna da direita:

- 13 embaixo.
- 24 em cima.

Terceira coluna:

- 25 embaixo.
- 36 em cima.

Coluna mais à esquerda:

- 37 a 45 no bloco principal.
- Três espaços vazios acima de 45.
- 48, 47 e 46 aparecem abaixo do bloco principal, nas três linhas extras.

## Regras de UI

- `null` deve ocupar espaço.
- `null` não é uma postura.
- Não colapsar espaços vazios.
- Em desktop, manter leitura espacial.
- Em mobile, permitir scroll/zoom ou uma representação adaptada, sem alterar a ordem.
- O usuário deve conseguir tocar/clicar na postura.

## Modos do mapa

### Modo OS

Cor baseada na prioridade/status ativo.

### Modo Inventário

- completo;
- incompleto;
- faltando foto;
- faltando placa;
- faltando campos obrigatórios.

### Modo Marca

Destacar marcas.

Exemplos:

- WEG.
- NORD.
- SEW.
- PUJOL.
- K.H. WITTE.

### Modo Falhas

Heatmap por volume/reincidência.

### Modo Camada

- elétrica;
- mecânica;
- OS;
- inventário.

## Filtros

- postura;
- bateria;
- setor;
- tipo de ativo;
- marca;
- modelo;
- status;
- prioridade;
- completude;
- OS aberta;
- falha recorrente.

## Clique na postura

Abre a página da postura com:

- cabeçalho;
- indicadores;
- visão gráfica das baterias;
- ativos gerais;
- OS ativas;
- histórico recente;
- completude.
