import {
  THEME_TOKEN_DEFINITIONS,
  isSafeThemeTokenValue,
  parseThemeDocument,
  type ThemeDensity,
  type ThemeDocument,
  type ThemeTokenKey,
  type ThemeTokens,
} from './theme.schema';

export const TOKEN_CSS_VARIABLES = Object.freeze(
  Object.fromEntries(
    THEME_TOKEN_DEFINITIONS.map(({ key, cssVariable }) => [key, cssVariable]),
  ) as unknown as Record<ThemeTokenKey, `--${string}`>,
);

export const DENSITY_TOKEN_PATCHES = {
  compact: {
    spaceXs: '0.1875rem',
    spaceSm: '0.375rem',
    spaceMd: '0.75rem',
    spaceLg: '1rem',
    spaceXl: '1.5rem',
    space2xl: '2.25rem',
    controlHeight: '2.5rem',
    touchTarget: '2.75rem',
  },
  comfortable: {
    spaceXs: '0.25rem',
    spaceSm: '0.5rem',
    spaceMd: '1rem',
    spaceLg: '1.5rem',
    spaceXl: '2rem',
    space2xl: '3rem',
    controlHeight: '2.75rem',
    touchTarget: '2.75rem',
  },
  spacious: {
    spaceXs: '0.375rem',
    spaceSm: '0.75rem',
    spaceMd: '1.25rem',
    spaceLg: '2rem',
    spaceXl: '3rem',
    space2xl: '4.5rem',
    controlHeight: '3.125rem',
    touchTarget: '3rem',
  },
} as const satisfies Record<Exclude<ThemeDensity, 'custom'>, Partial<ThemeTokens>>;

export function patchThemeTokens(tokens: ThemeTokens, patch: Partial<ThemeTokens>): ThemeTokens {
  for (const [key, value] of Object.entries(patch)) {
    if (
      !(key in TOKEN_CSS_VARIABLES) ||
      typeof value !== 'string' ||
      !isSafeThemeTokenValue(value)
    ) {
      throw new Error(`Token de tema inválido: ${key}.`);
    }
  }

  return { ...tokens, ...patch };
}

export function applyThemeToElement(element: HTMLElement, input: ThemeDocument): void {
  const theme = parseThemeDocument(input);

  for (const definition of THEME_TOKEN_DEFINITIONS) {
    element.style.setProperty(definition.cssVariable, theme.tokens[definition.key]);
  }

  element.dataset.themeId = theme.id;
  element.dataset.themeKind = theme.kind;
  element.dataset.themeMode = theme.appearance;
  element.dataset.themeDensity = theme.density;
  element.style.colorScheme = theme.appearance === 'light' ? 'light' : 'dark';
}

export function removeThemeFromElement(element: HTMLElement): void {
  for (const definition of THEME_TOKEN_DEFINITIONS) {
    element.style.removeProperty(definition.cssVariable);
  }

  delete element.dataset.themeId;
  delete element.dataset.themeKind;
  delete element.dataset.themeMode;
  delete element.dataset.themeDensity;
  element.style.removeProperty('color-scheme');
}
