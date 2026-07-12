# 05 — Modelo Físico e Visual da Bateria

## Objetivo

Representar a bateria como diagrama técnico interativo, não como tabela.

## Perspectiva

Vista lateral.

## Orientação física

- Frente do galpão: lado do elevador de ovos.
- Fundo do galpão: lado da esteira preta/transversal.

## Convenções do desenho

### Preto

Bateria/linhas de gaiolas.

### Azul

Esteiras de nylon.

Função:

- transportar ovos;
- levar ovos em direção ao elevador.

Quantidade visual:

- 6 linhas de esteira de nylon por bateria, agrupadas conceitualmente em dois conjuntos de três;
- 2 motores:
  - Motor Esteira Nylon Superior;
  - Motor Esteira Nylon Inferior;
- cada motor aciona 3 esteiras.

### Laranja

"Esteira branca".

Apesar do nome operacional "esteira branca", na referência visual ela é representada em laranja.

Função:

- localizada sob as gaiolas;
- transportar dejetos.

Quantidade visual:

- 6 linhas, agrupadas em dois conjuntos de três;
- 2 motores:
  - Motor Esteira Branca Superior;
  - Motor Esteira Branca Inferior;
- cada motor aciona 3 esteiras.

### Cinza

Carrinho de ração.

Função:

- desloca-se ao longo da bateria;
- vai para frente e para trás;
- distribui ração nos cochos.

Representação visual desejada:

- elemento retangular/vertical que percorre a altura útil da bateria;
- deve transmitir visualmente que é um sistema móvel de alimentação.

Ativos associados:

- Motor Ração.
- Redutor Ração.

### Vermelho

Elevador de ovos.

Função:

- receber ovos das esteiras de nylon;
- elevar os ovos até a esteira superior/principal.

Ativos associados:

- Motor Elevador.
- Redutor Elevador.

### Esteira preta/transversal

- fica no fundo;
- recebe material das esteiras brancas;
- não precisa ser desenhada como uma esteira longitudinal na vista lateral;
- mostrar o motor correspondente quando aplicável.

## Círculos

Círculos representam motores.

Cada círculo deve ser interativo.

Ao clicar:

- abrir ficha do ativo;
- mostrar marca;
- modelo;
- potência;
- tensão;
- corrente;
- RPM;
- placa;
- fotos;
- histórico;
- OS;
- ações permitidas.

## Redutores

Redutores também devem ser clicáveis.

Podem ser representados por:

- forma própria;
- ícone;
- elemento acoplado ao motor.

Motor e redutor devem continuar registros distintos.

## Posições padrão por bateria

- `motor_elevador`
- `redutor_elevador`
- `motor_racao`
- `redutor_racao`
- `motor_esteira_branca_superior`
- `motor_esteira_branca_inferior`
- `motor_esteira_nylon_superior`
- `motor_esteira_nylon_inferior`

## Estado visual

Cada posição pode mostrar:

- sem cadastro;
- ativo cadastrado;
- cadastro incompleto;
- OS aberta;
- OS crítica;
- inativo;
- substituído.

## Tooltip

No hover/press:

- tipo;
- marca;
- modelo;
- status;
- OS ativa;
- completude.

## Painel lateral

Ao clicar em um ativo, abrir painel lateral em desktop.

No mobile:

- bottom sheet ou tela dedicada.

## Zoom

O diagrama deve aceitar:

- zoom;
- pan;
- pinch no celular;
- reset.

## Camadas

O desenho pode ter camadas:

- estrutura;
- elétrica;
- mecânica;
- OS;
- inventário.

## Não fazer

- Não substituir o desenho por lista.
- Não desenhar 20 cards sobrepostos.
- Não esconder a orientação frente/fundo.
- Não esquecer que "esteira branca" é laranja na referência.
- Não desenhar a esteira preta longitudinal se a vista lateral não permite vê-la.
