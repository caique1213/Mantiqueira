# 08 — Histórico de Ativos e Substituições

## Problema a evitar

Editar o motor instalado de "NORD" para "WEG" apagaria a história.

Isso é proibido.

## Conceito de instalação

Uma posição física pode ter várias instalações ao longo do tempo.

Exemplo:

```text
Posição: Postura 27 / B2 / Motor Esteira Nylon Superior

Instalação A
- Motor NORD
- início: 01/01/2026
- fim: 15/06/2026
- motivo de remoção: queimado

Instalação B
- Motor WEG
- início: 15/06/2026
- atual
```

## Evento de substituição

Registrar:

- posição;
- ativo removido;
- ativo instalado;
- data/hora;
- usuário;
- motivo;
- OS relacionada;
- observação;
- fotos.

## Timeline do ativo

Eventos:

- cadastrado;
- instalado;
- editado;
- OS;
- manutenção;
- removido;
- substituído.

## Timeline da posição

Mostra todos os ativos que já ocuparam a posição.

## Relação com OS

A OS deve apontar para o ativo físico que estava instalado na data.

## Métricas derivadas

- vida média;
- tempo entre falhas;
- marcas mais substituídas;
- modelos com mais reincidência;
- quantidade de trocas por postura.
