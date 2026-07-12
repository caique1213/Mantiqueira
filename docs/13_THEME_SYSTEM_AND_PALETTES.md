# 13 — Sistema de Tema e Paletas

## Requisito

Existem 6 opções:

1. Mantiqueira Clássico.
2. Mantiqueira Industrial.
3. Mantiqueira Premium.
4. Mantiqueira Light.
5. Mantiqueira Contrast.
6. Personalizado.

## Implementação

Todos os componentes devem usar tokens.

Exemplo:

```css
--color-bg
--color-bg-secondary
--color-surface
--color-surface-raised
--color-text
--color-text-muted
--color-border
--color-primary
--color-primary-contrast
--color-secondary
--color-accent
--color-danger
--color-success
--color-warning
--color-info
--status-awaiting
--status-in-progress
--status-waiting-part
--status-resolved
--status-cancelled
--priority-low
--priority-normal
--priority-high
--priority-critical
--map-empty
--map-active
--asset-motor
--asset-reducer
--battery-cage
--battery-nylon
--battery-white-conveyor
--battery-feed-cart
--battery-elevator
```

## 1. Mantiqueira Clássico

Base conceitual:

- amarelo Mantiqueira;
- marrom;
- creme;
- branco quente.

Exemplo inicial:

```json
{
  "bg": "#FFF8E8",
  "surface": "#FFF4D6",
  "primary": "#F6B900",
  "secondary": "#3A2A1A",
  "text": "#2A211A",
  "muted": "#806653"
}
```

## 2. Mantiqueira Industrial

Base:

- grafite;
- preto;
- amarelo;
- cinza metálico;
- branco.

Exemplo:

```json
{
  "bg": "#0B0D10",
  "surface": "#15191F",
  "primary": "#F6B900",
  "secondary": "#D28B00",
  "text": "#F5F7FA",
  "muted": "#939AA5"
}
```

## 3. Mantiqueira Premium

Base:

- preto;
- marrom profundo;
- dourado;
- bronze;
- creme.

## 4. Mantiqueira Light

Base:

- branco;
- bege;
- amarelo;
- cinza claro;
- marrom.

## 5. Mantiqueira Contrast

Base:

- fundo muito escuro;
- amarelo forte;
- branco;
- vermelho crítico;
- verde resolvido;
- azul em execução.

## 6. Personalizado

Editor completo.

### Cores globais

- bg;
- bg secondary;
- surface;
- menu;
- header;
- footer;
- border;
- text;
- muted.

### Ações

- primary;
- secondary;
- danger;
- success.

### Status

Todos.

### Prioridades

Todas.

### Mapa

- vazios;
- postura;
- destaque;
- seleção;
- heatmap.

### Ativos

- motor;
- redutor;
- carrinho;
- esteiras;
- elevador.

### Tipografia

- família;
- escala;
- pesos;
- line-height.

### Formas

- radius;
- border width;
- shadows;
- blur.

### Densidade

- compacta;
- confortável;
- ampla;
- personalizada.

## Pré-visualização

Ao alterar:

- aplicar imediatamente no preview;
- não salvar automaticamente;
- permitir Desfazer;
- Aplicar;
- Salvar;
- Restaurar.

## Paletas customizadas

Administrador pode:

- salvar como nova paleta;
- duplicar;
- renomear;
- arquivar;
- definir padrão.

## Regra

Nenhum componente pode usar cor hard-coded fora da camada de tokens, salvo imagens e casos técnicos explícitos.
