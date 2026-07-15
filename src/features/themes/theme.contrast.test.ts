import { describe, expect, it } from 'vitest';
import { THEME_PRESET_LIST } from './theme.presets';
import type { ThemeTokens } from './theme.schema';

const readablePairs: Array<{
  label: string;
  foreground: keyof ThemeTokens;
  background: keyof ThemeTokens;
  minimum: number;
}> = [
  { label: 'texto no fundo', foreground: 'colorText', background: 'colorBg', minimum: 4.5 },
  { label: 'texto em superfície', foreground: 'colorText', background: 'colorSurface', minimum: 4.5 },
  { label: 'texto em card', foreground: 'colorText', background: 'colorCard', minimum: 4.5 },
  { label: 'texto de campo', foreground: 'colorInputText', background: 'colorInput', minimum: 4.5 },
  { label: 'badge', foreground: 'colorBadgeText', background: 'colorBadge', minimum: 4.5 },
  {
    label: 'botão principal',
    foreground: 'colorButtonPrimaryText',
    background: 'colorButtonPrimary',
    minimum: 4.5,
  },
  {
    label: 'botão principal hover',
    foreground: 'colorButtonPrimaryText',
    background: 'colorButtonPrimaryHover',
    minimum: 4.5,
  },
  {
    label: 'botão secundário',
    foreground: 'colorButtonSecondaryText',
    background: 'colorButtonSecondary',
    minimum: 4.5,
  },
  {
    label: 'botão secundário hover',
    foreground: 'colorButtonSecondaryText',
    background: 'colorButtonSecondaryHover',
    minimum: 4.5,
  },
  {
    label: 'botão de perigo',
    foreground: 'colorButtonDangerText',
    background: 'colorButtonDanger',
    minimum: 4.5,
  },
  {
    label: 'botão de perigo hover',
    foreground: 'colorButtonDangerText',
    background: 'colorButtonDangerHover',
    minimum: 4.5,
  },
  {
    label: 'texto secundário em superfície',
    foreground: 'colorTextMuted',
    background: 'colorSurface',
    minimum: 3,
  },
];

describe('theme preset contrast', () => {
  it('keeps all preset text, form and button colors readable', () => {
    const failures: string[] = [];
    for (const preset of THEME_PRESET_LIST) {
      for (const pair of readablePairs) {
        const foreground = preset.tokens[pair.foreground];
        const background = preset.tokens[pair.background];
        const ratio = contrastRatio(foreground, background);
        if (ratio < pair.minimum) {
          failures.push(
            `${preset.name}: ${pair.label} ${foreground} sobre ${background} = ${ratio.toFixed(2)}:1`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string) {
  const [red, green, blue] = parseHexColor(hex).map((component) => {
    const normalized = component / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function parseHexColor(hex: string): [number, number, number] {
  const match = hex.trim().match(/^#([\da-f]{6})$/i);
  if (!match) throw new Error(`Cor não suportada no teste de contraste: ${hex}`);
  const value = match[1]!;
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}
