import { describe, expect, it } from 'vitest';
import { createLocalStorageThemeAdapter, ThemePersistenceError } from './theme.adapters';
import { getPresetTheme } from './theme.presets';

function createTestStorage(): Storage {
  const state = new Map<string, string>();
  return {
    get length() {
      return state.size;
    },
    clear() {
      state.clear();
    },
    getItem(key) {
      return state.get(key) ?? null;
    },
    key(index) {
      return [...state.keys()][index] ?? null;
    },
    removeItem(key) {
      state.delete(key);
    },
    setItem(key, value) {
      state.set(key, value);
    },
  };
}

describe('theme persistence adapters', () => {
  it('round-trips a versioned theme through local storage', async () => {
    const key = 'theme-adapter-test';
    const storage = createTestStorage();
    const adapter = createLocalStorageThemeAdapter({ key, storage });
    const source = getPresetTheme('premium');

    await adapter.saveActiveTheme(source);
    const restored = await adapter.loadActiveTheme();

    expect(restored).toEqual(source);
  });

  it('surfaces corrupted persisted data as a persistence error', async () => {
    const key = 'theme-adapter-corrupt-test';
    const storage = createTestStorage();
    storage.setItem(key, '{not-json');
    const adapter = createLocalStorageThemeAdapter({ key, storage });

    await expect(adapter.loadActiveTheme()).rejects.toBeInstanceOf(ThemePersistenceError);
  });
});
