import { describe, expect, it } from 'vitest';
import {
  migrateThemeDocument,
  parseThemeDocument,
  THEME_TOKEN_DEFINITIONS,
  themeTokensSchema,
} from './theme.schema';
import { getPresetTheme, THEME_PRESET_LIST } from './theme.presets';
import { TOKEN_CSS_VARIABLES } from './theme.runtime';

describe('theme schema and presets', () => {
  it('keeps every built-in preset complete and schema-valid', () => {
    const expectedKeys = THEME_TOKEN_DEFINITIONS.map(({ key }) => key).sort();

    for (const preset of THEME_PRESET_LIST) {
      const document = getPresetTheme(preset.id);
      expect(() => parseThemeDocument(document)).not.toThrow();
      expect(Object.keys(document.tokens).sort()).toEqual(expectedKeys);
    }
  });

  it('maps each token to one stable and unique CSS variable', () => {
    const variables = Object.values(TOKEN_CSS_VARIABLES);
    expect(Object.keys(TOKEN_CSS_VARIABLES)).toHaveLength(THEME_TOKEN_DEFINITIONS.length);
    expect(new Set(variables).size).toBe(variables.length);
    expect(TOKEN_CSS_VARIABLES.colorBg).toBe('--color-bg');
    expect(TOKEN_CSS_VARIABLES.batteryElevator).toBe('--battery-elevator');
  });

  it('rejects additional tokens and unsafe CSS fragments', () => {
    const valid = getPresetTheme('industrial').tokens;
    expect(themeTokensSchema.safeParse({ ...valid, unknownColor: '#fff' }).success).toBe(false);
    expect(
      themeTokensSchema.safeParse({ ...valid, colorPrimary: 'red; display:none' }).success,
    ).toBe(false);
    expect(
      themeTokensSchema.safeParse({ ...valid, colorPrimary: 'url(https://example.com)' }).success,
    ).toBe(false);
  });

  it('fails closed for future persisted schema versions', () => {
    const future = { ...getPresetTheme('industrial'), schemaVersion: 99 };
    expect(() => migrateThemeDocument(future)).toThrow('Versão de tema não suportada');
  });
});
