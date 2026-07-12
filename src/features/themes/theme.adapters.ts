import { cloneTheme } from './theme.presets';
import { migrateThemeDocument, parseThemeDocument, type ThemeDocument } from './theme.schema';

export interface ThemePersistenceAdapter {
  loadActiveTheme(signal?: AbortSignal): Promise<ThemeDocument | null>;
  saveActiveTheme(theme: ThemeDocument, signal?: AbortSignal): Promise<ThemeDocument>;
}

export class ThemePersistenceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ThemePersistenceError';
  }
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw new DOMException('Operação cancelada.', 'AbortError');
  }
}

export function createMemoryThemeAdapter(
  initialTheme: ThemeDocument | null = null,
): ThemePersistenceAdapter & { peek(): ThemeDocument | null } {
  let activeTheme = initialTheme === null ? null : cloneTheme(initialTheme);

  return {
    async loadActiveTheme(signal) {
      assertNotAborted(signal);
      return activeTheme === null ? null : cloneTheme(activeTheme);
    },
    async saveActiveTheme(theme, signal) {
      assertNotAborted(signal);
      activeTheme = cloneTheme(parseThemeDocument(theme));
      return cloneTheme(activeTheme);
    },
    peek() {
      return activeTheme === null ? null : cloneTheme(activeTheme);
    },
  };
}

export interface LocalStorageThemeAdapterOptions {
  key?: string;
  storage?: Storage;
}

export function createLocalStorageThemeAdapter(
  options: LocalStorageThemeAdapterOptions = {},
): ThemePersistenceAdapter {
  const key = options.key ?? 'mantiqueira:active-theme:v1';

  function getStorage(): Storage {
    if (options.storage !== undefined) return options.storage;
    if (typeof window === 'undefined') {
      throw new ThemePersistenceError('LocalStorage indisponível fora do navegador.');
    }
    return window.localStorage;
  }

  return {
    async loadActiveTheme(signal) {
      assertNotAborted(signal);
      try {
        const serialized = getStorage().getItem(key);
        return serialized === null ? null : migrateThemeDocument(JSON.parse(serialized) as unknown);
      } catch (error) {
        throw new ThemePersistenceError('Não foi possível carregar o tema salvo.', {
          cause: error,
        });
      }
    },
    async saveActiveTheme(theme, signal) {
      assertNotAborted(signal);
      const parsed = parseThemeDocument(theme);
      try {
        getStorage().setItem(key, JSON.stringify(parsed));
      } catch (error) {
        throw new ThemePersistenceError('Não foi possível salvar o tema neste dispositivo.', {
          cause: error,
        });
      }
      return cloneTheme(parsed);
    },
  };
}

export interface CallbackThemeAdapterOptions {
  load(signal?: AbortSignal): Promise<unknown>;
  save(theme: ThemeDocument, signal?: AbortSignal): Promise<unknown>;
}

/**
 * Adapter boundary intended for a Supabase repository/RPC. It validates both
 * directions so malformed remote JSON never reaches CSS custom properties.
 */
export function createCallbackThemeAdapter(
  callbacks: CallbackThemeAdapterOptions,
): ThemePersistenceAdapter {
  return {
    async loadActiveTheme(signal) {
      assertNotAborted(signal);
      const remoteTheme = await callbacks.load(signal);
      assertNotAborted(signal);
      return remoteTheme === null ? null : migrateThemeDocument(remoteTheme);
    },
    async saveActiveTheme(theme, signal) {
      assertNotAborted(signal);
      const safeTheme = parseThemeDocument(theme);
      const savedTheme = await callbacks.save(safeTheme, signal);
      assertNotAborted(signal);
      return migrateThemeDocument(savedTheme);
    },
  };
}
