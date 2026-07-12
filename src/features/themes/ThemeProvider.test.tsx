import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTheme } from './ThemeContext';
import { createMemoryThemeAdapter } from './theme.adapters';
import { getPresetTheme } from './theme.presets';
import { ThemeProvider } from './ThemeProvider';

function ThemeHarness() {
  const theme = useTheme();
  return (
    <div>
      <output aria-label="theme-id">{theme.draftTheme.id}</output>
      <output aria-label="theme-color">{theme.draftTheme.tokens.colorPrimary}</output>
      <output aria-label="theme-status">{theme.status}</output>
      <button onClick={() => theme.selectPreset('light')} type="button">
        Light
      </button>
      <button onClick={() => theme.startCustomizing('Campo')} type="button">
        Personalizar
      </button>
      <button onClick={() => theme.updateToken('colorPrimary', '#123456')} type="button">
        Mudar cor
      </button>
      <button onClick={theme.undo} type="button">
        Desfazer
      </button>
      <button onClick={() => void theme.save()} type="button">
        Salvar
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  it('previews, undoes and persists a customized theme', async () => {
    const target = document.createElement('div');
    const adapter = createMemoryThemeAdapter();
    render(
      <ThemeProvider adapter={adapter} initialTheme={getPresetTheme('industrial')} target={target}>
        <ThemeHarness />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText('theme-status')).toHaveTextContent('idle'));
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(target.dataset.themeId).toBe('preset:light');

    fireEvent.click(screen.getByRole('button', { name: 'Personalizar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mudar cor' }));
    expect(screen.getByLabelText('theme-color')).toHaveTextContent('#123456');
    expect(target.style.getPropertyValue('--color-primary')).toBe('#123456');

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(screen.getByLabelText('theme-color')).toHaveTextContent(
      getPresetTheme('light').tokens.colorPrimary,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mudar cor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.getByLabelText('theme-status')).toHaveTextContent('saved'));
    expect(adapter.peek()?.tokens.colorPrimary).toBe('#123456');
  });
});
