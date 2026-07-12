# 22 — Estrutura de Seed

## Posturas

Gerar 48.

## Baterias

Regra:

```ts
function batteryCount(posture: number) {
  if (posture === 45) return 5;
  if (posture >= 46 && posture <= 48) return 6;
  return 4;
}
```

## Posições por bateria

Para cada bateria:

```text
Motor Elevador
Redutor Elevador
Motor Ração
Redutor Ração
Motor Esteira Branca Superior
Motor Esteira Branca Inferior
Motor Esteira Nylon Superior
Motor Esteira Nylon Inferior
```

## Ativos gerais padrão por postura

Criar posições, não necessariamente inventar ativos físicos:

```text
Motor Esteira Preta
Iluminação
Ventilação
Exaustor
```

O cadastro físico pode ser "A verificar".

## Marcas conhecidas

Seed de fabricante:

- WEG.
- NORD.
- SEW.
- PUJOL.
- K.H. WITTE.
- DESCONHECIDO.

Pode incluir outras marcas depois.

## Status padrão de OS

- Aguardando atendimento.
- Em execução.
- Aguardando peça.
- Resolvida.
- Cancelada.

## Prioridades

- Baixa.
- Normal.
- Alta.
- Crítica.

## Temas

Cinco presets + Personalizado.
