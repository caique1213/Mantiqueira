import { afterEach, describe, expect, it } from 'vitest';
import { getPresetTheme } from './theme.presets';
import { applyThemeToElement, removeThemeFromElement, TOKEN_CSS_VARIABLES } from './theme.runtime';

describe('theme DOM runtime', () => {
  const element = document.createElement('div');

  afterEach(() => {
    removeThemeFromElement(element);
  });

  it('applies only allow-listed custom properties and theme metadata', () => {
    const light = getPresetTheme('light');
    applyThemeToElement(element, light);

    expect(element.dataset.themeId).toBe('preset:light');
    expect(element.dataset.themeMode).toBe('light');
    expect(element.style.getPropertyValue(TOKEN_CSS_VARIABLES.colorPrimary)).toBe(
      light.tokens.colorPrimary,
    );
    expect(element.style.getPropertyValue(TOKEN_CSS_VARIABLES.statusResolved)).toBe(
      light.tokens.statusResolved,
    );
    expect(element.style.colorScheme).toBe('light');
  });

  it('removes all theme metadata and inline token values', () => {
    applyThemeToElement(element, getPresetTheme('contrast'));
    removeThemeFromElement(element);

    expect(element.dataset.themeId).toBeUndefined();
    expect(element.style.getPropertyValue('--color-primary')).toBe('');
    expect(element.style.colorScheme).toBe('');
  });
});
