import { createContext, useContext } from 'react';
import type {
  ThemeDensity,
  ThemeDocument,
  ThemePresetId,
  ThemeTokenKey,
  ThemeTokens,
} from './theme.schema';

export type ThemeOperationStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export interface ThemeContextValue {
  activeTheme: ThemeDocument;
  draftTheme: ThemeDocument;
  status: ThemeOperationStatus;
  errorMessage: string | null;
  isDirty: boolean;
  canUndo: boolean;
  selectPreset(presetId: ThemePresetId): void;
  startCustomizing(name?: string): void;
  updateToken(key: ThemeTokenKey, value: string): void;
  updateTokens(patch: Partial<ThemeTokens>): void;
  setDensity(density: ThemeDensity): void;
  renameDraft(name: string): void;
  undo(): void;
  discardChanges(): void;
  restoreDefault(): void;
  save(): Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider.');
  }
  return value;
}
