import { useCallback, useLayoutEffect, useMemo, useReducer, type ReactNode } from 'react';
import '../../styles/tokens.css';
import { ThemeContext, type ThemeContextValue, type ThemeOperationStatus } from './ThemeContext';
import { createMemoryThemeAdapter, type ThemePersistenceAdapter } from './theme.adapters';
import { cloneTheme, createCustomTheme, getPresetTheme } from './theme.presets';
import {
  applyThemeToElement,
  DENSITY_TOKEN_PATCHES,
  patchThemeTokens,
  removeThemeFromElement,
} from './theme.runtime';
import {
  parseThemeDocument,
  type ThemeDensity,
  type ThemeDocument,
  type ThemePresetId,
  type ThemeTokenKey,
  type ThemeTokens,
} from './theme.schema';

const DEFAULT_ADAPTER = createMemoryThemeAdapter();
const HISTORY_LIMIT = 60;
const DENSITY_TOKEN_KEYS = new Set<ThemeTokenKey>(
  Object.keys(DENSITY_TOKEN_PATCHES.comfortable) as ThemeTokenKey[],
);

interface InternalThemeState {
  activeTheme: ThemeDocument;
  draftTheme: ThemeDocument;
  undoStack: ThemeDocument[];
  status: ThemeOperationStatus;
  errorMessage: string | null;
}

type ThemeAction =
  | { type: 'load-start' }
  | { type: 'load-success'; theme: ThemeDocument | null }
  | { type: 'operation-error'; message: string }
  | { type: 'replace-draft'; theme: ThemeDocument }
  | { type: 'undo' }
  | { type: 'discard' }
  | { type: 'save-start' }
  | { type: 'save-success'; theme: ThemeDocument };

function initialState(theme: ThemeDocument): InternalThemeState {
  const safeTheme = cloneTheme(parseThemeDocument(theme));
  return {
    activeTheme: safeTheme,
    draftTheme: cloneTheme(safeTheme),
    undoStack: [],
    status: 'idle',
    errorMessage: null,
  };
}

function pushDraft(state: InternalThemeState, theme: ThemeDocument): InternalThemeState {
  const history = [...state.undoStack, cloneTheme(state.draftTheme)].slice(-HISTORY_LIMIT);
  return {
    ...state,
    draftTheme: cloneTheme(theme),
    undoStack: history,
    status: 'idle',
    errorMessage: null,
  };
}

function reducer(state: InternalThemeState, action: ThemeAction): InternalThemeState {
  switch (action.type) {
    case 'load-start':
      return { ...state, status: 'loading', errorMessage: null };
    case 'load-success': {
      if (action.theme === null) return { ...state, status: 'idle', errorMessage: null };
      const loaded = cloneTheme(action.theme);
      return {
        activeTheme: loaded,
        draftTheme: cloneTheme(loaded),
        undoStack: [],
        status: 'idle',
        errorMessage: null,
      };
    }
    case 'replace-draft':
      return pushDraft(state, action.theme);
    case 'undo': {
      const previous = state.undoStack.at(-1);
      if (previous === undefined) return state;
      return {
        ...state,
        draftTheme: cloneTheme(previous),
        undoStack: state.undoStack.slice(0, -1),
        status: 'idle',
        errorMessage: null,
      };
    }
    case 'discard':
      return {
        ...state,
        draftTheme: cloneTheme(state.activeTheme),
        undoStack: [],
        status: 'idle',
        errorMessage: null,
      };
    case 'save-start':
      return { ...state, status: 'saving', errorMessage: null };
    case 'save-success': {
      const saved = cloneTheme(action.theme);
      return {
        activeTheme: saved,
        draftTheme: cloneTheme(saved),
        undoStack: [],
        status: 'saved',
        errorMessage: null,
      };
    }
    case 'operation-error':
      return { ...state, status: 'error', errorMessage: action.message };
  }
}

function themeHasChanges(active: ThemeDocument, draft: ThemeDocument): boolean {
  if (
    active.id !== draft.id ||
    active.name !== draft.name ||
    active.kind !== draft.kind ||
    active.appearance !== draft.appearance ||
    active.density !== draft.density
  ) {
    return true;
  }
  return Object.keys(active.tokens).some(
    (key) => active.tokens[key as ThemeTokenKey] !== draft.tokens[key as ThemeTokenKey],
  );
}

function editableTheme(theme: ThemeDocument): ThemeDocument {
  return theme.kind === 'custom' ? cloneTheme(theme) : createCustomTheme(theme);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

export interface ThemeProviderProps {
  children: ReactNode;
  adapter?: ThemePersistenceAdapter;
  initialTheme?: ThemeDocument;
  target?: HTMLElement | null;
}

export function ThemeProvider({
  children,
  adapter = DEFAULT_ADAPTER,
  initialTheme = getPresetTheme('industrial'),
  target,
}: ThemeProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialTheme, initialState);

  useLayoutEffect(() => {
    const controller = new AbortController();
    dispatch({ type: 'load-start' });

    void adapter
      .loadActiveTheme(controller.signal)
      .then((theme) => {
        if (!controller.signal.aborted) dispatch({ type: 'load-success', theme });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          dispatch({
            type: 'operation-error',
            message: errorMessage(error, 'Não foi possível carregar o tema.'),
          });
        }
      });

    return () => controller.abort();
  }, [adapter]);

  useLayoutEffect(() => {
    const element = target ?? (typeof document === 'undefined' ? null : document.documentElement);
    if (element === null) return;

    applyThemeToElement(element, state.draftTheme);
    return () => {
      if (element.dataset.themeId === state.draftTheme.id) removeThemeFromElement(element);
    };
  }, [state.draftTheme, target]);

  const selectPreset = useCallback((presetId: ThemePresetId) => {
    dispatch({ type: 'replace-draft', theme: getPresetTheme(presetId) });
  }, []);

  const startCustomizing = useCallback(
    (name?: string) => {
      if (state.draftTheme.kind === 'custom') {
        if (name !== undefined && name.trim().length > 0 && name !== state.draftTheme.name) {
          dispatch({
            type: 'replace-draft',
            theme: parseThemeDocument({ ...state.draftTheme, name: name.trim() }),
          });
        }
        return;
      }
      dispatch({
        type: 'replace-draft',
        theme: createCustomTheme(state.draftTheme, name ?? 'Meu tema personalizado'),
      });
    },
    [state.draftTheme],
  );

  const updateTokens = useCallback(
    (patch: Partial<ThemeTokens>) => {
      const editable = editableTheme(state.draftTheme);
      const changesDensity = Object.keys(patch).some((key) =>
        DENSITY_TOKEN_KEYS.has(key as ThemeTokenKey),
      );
      dispatch({
        type: 'replace-draft',
        theme: parseThemeDocument({
          ...editable,
          tokens: patchThemeTokens(editable.tokens, patch),
          density: changesDensity ? 'custom' : editable.density,
        }),
      });
    },
    [state.draftTheme],
  );

  const updateToken = useCallback(
    (key: ThemeTokenKey, value: string) => updateTokens({ [key]: value }),
    [updateTokens],
  );

  const setDensity = useCallback(
    (density: ThemeDensity) => {
      const editable = editableTheme(state.draftTheme);
      const densityPatch = density === 'custom' ? {} : DENSITY_TOKEN_PATCHES[density];
      dispatch({
        type: 'replace-draft',
        theme: parseThemeDocument({
          ...editable,
          density,
          tokens: patchThemeTokens(editable.tokens, densityPatch),
        }),
      });
    },
    [state.draftTheme],
  );

  const renameDraft = useCallback(
    (name: string) => {
      const normalizedName = name.trim();
      if (normalizedName.length === 0 || normalizedName === state.draftTheme.name) return;
      const editable = editableTheme(state.draftTheme);
      dispatch({
        type: 'replace-draft',
        theme: parseThemeDocument({ ...editable, name: normalizedName }),
      });
    },
    [state.draftTheme],
  );

  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const discardChanges = useCallback(() => dispatch({ type: 'discard' }), []);

  const restoreDefault = useCallback(() => {
    if (state.draftTheme.kind === 'preset') {
      dispatch({
        type: 'replace-draft',
        theme: getPresetTheme(state.draftTheme.presetId ?? 'industrial'),
      });
      return;
    }

    const base = getPresetTheme(state.draftTheme.basePresetId ?? 'industrial');
    dispatch({
      type: 'replace-draft',
      theme: parseThemeDocument({
        ...state.draftTheme,
        appearance: base.appearance,
        density: base.density,
        tokens: { ...base.tokens },
      }),
    });
  }, [state.draftTheme]);

  const save = useCallback(async () => {
    const now = new Date().toISOString();
    const candidate = parseThemeDocument({
      ...state.draftTheme,
      revision: state.draftTheme.id === state.activeTheme.id ? state.activeTheme.revision + 1 : 1,
      updatedAt: now,
    });
    const controller = new AbortController();
    dispatch({ type: 'save-start' });

    try {
      const saved = await adapter.saveActiveTheme(candidate, controller.signal);
      dispatch({ type: 'save-success', theme: parseThemeDocument(saved) });
    } catch (error) {
      dispatch({
        type: 'operation-error',
        message: errorMessage(error, 'Não foi possível salvar o tema.'),
      });
    }
  }, [adapter, state.activeTheme.id, state.activeTheme.revision, state.draftTheme]);

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      activeTheme: state.activeTheme,
      draftTheme: state.draftTheme,
      status: state.status,
      errorMessage: state.errorMessage,
      isDirty: themeHasChanges(state.activeTheme, state.draftTheme),
      canUndo: state.undoStack.length > 0,
      selectPreset,
      startCustomizing,
      updateToken,
      updateTokens,
      setDensity,
      renameDraft,
      undo,
      discardChanges,
      restoreDefault,
      save,
    }),
    [
      discardChanges,
      renameDraft,
      restoreDefault,
      save,
      selectPreset,
      setDensity,
      startCustomizing,
      state.activeTheme,
      state.draftTheme,
      state.errorMessage,
      state.status,
      state.undoStack.length,
      undo,
      updateToken,
      updateTokens,
    ],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}
