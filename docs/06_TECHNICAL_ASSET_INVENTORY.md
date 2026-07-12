# 06 — Inventário Técnico de Ativos Instalados

## Conceito

Cada item físico instalado é um ativo.

## Hierarquia

```text
Unidade
└── Postura
    ├── Ativos gerais da postura
    └── Bateria
        ├── Motor Elevador
        ├── Redutor Elevador
        ├── Motor Ração
        ├── Redutor Ração
        ├── Motor Esteira Branca Superior
        ├── Motor Esteira Branca Inferior
        ├── Motor Esteira Nylon Superior
        └── Motor Esteira Nylon Inferior
```

## Campos base de um ativo

- ID.
- Código interno.
- Tipo.
- Categoria.
- Postura.
- Bateria.
- Posição.
- Estado.
- Criticidade.
- Marca.
- Modelo.
- Número de série.
- Data de fabricação, quando conhecida.
- Data de instalação.
- Data de remoção, quando removido.
- Foto geral.
- Foto da placa.
- Observações.
- Fonte dos dados.
- Completude.

## Campos de motor

- potência kW;
- potência cv;
- tensão;
- corrente;
- frequência;
- RPM;
- polos;
- ligação;
- carcaça;
- IP;
- classe de isolamento;
- rendimento;
- fator de potência;
- regime;
- fabricante;
- modelo;
- número de série;
- rolamento DE, se conhecido;
- rolamento NDE, se conhecido.

## Campos de redutor

- fabricante;
- modelo;
- tipo;
- relação;
- RPM de entrada;
- RPM de saída;
- torque;
- posição de montagem;
- óleo;
- quantidade de óleo;
- eixo;
- número de série;
- data de instalação.

## Conjuntos

Um conjunto pode ligar:

- motor;
- redutor;
- equipamento acionado.

Exemplo:

`Conjunto Elevador B2`

O motor e o redutor continuam separados.

## Biblioteca de modelos

Deve existir uma biblioteca de modelos.

Exemplos de marcas:

- WEG.
- SEW.
- NORD.
- PUJOL.
- K.H. WITTE.

A biblioteca pode sugerir dados.

O ativo físico pode sobrescrever.

## Cadastro rápido

No celular:

1. Abrir postura.
2. Abrir bateria.
3. Tocar no motor.
4. Editar.
5. Informar marca/modelo.
6. Fotografar placa.
7. Salvar.

## Duplicação inteligente

Permitir copiar dados comuns entre ativos semelhantes.

Nunca copiar automaticamente:

- número de série;
- fotos;
- data de instalação;
- histórico.

## Completude

Cada ativo recebe percentual calculado.

Exemplo:

- 100%: todos os campos obrigatórios.
- 85%: falta foto de placa.
- 60%: faltam modelo, série e corrente.

A fórmula deve ser configurável por tipo de ativo.

## Estados

Exemplos:

- Ativo.
- Inativo.
- Removido.
- Em manutenção.
- Reserva.
- A verificar.

Admin deve poder gerenciar a lista.
