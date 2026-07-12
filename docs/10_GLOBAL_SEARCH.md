# 10 — Pesquisa Global

## Objetivo

Uma caixa deve encontrar entidades de vários domínios.

## Exemplos

- `Postura 27`
- `B2`
- `NORD`
- `WEG W22`
- `OS 153`
- `Motor Elevador`
- `SEW`
- `123456` número de série

## Tipos de resultado

- Posturas.
- Baterias.
- Ativos.
- Modelos.
- OS.
- Usuários, se permitido.
- Histórico, se permitido.

## UX

Agrupar resultados.

Exemplo:

```text
ATIVOS (12)
POSTURAS (3)
OS (5)
MODELOS (2)
```

## Busca técnica

Deve aceitar:

- acentos;
- caixa alta/baixa;
- código parcial;
- marca;
- modelo;
- número de série;
- localização.

## Permissão

Resultado só aparece se o usuário puder acessar.
