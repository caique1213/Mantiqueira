export type PersonalThemeMode = 'system' | 'dark' | 'light';

export interface PersonalPreferences {
  themeMode: PersonalThemeMode;
  lowVision: boolean;
}

const DEFAULT_PREFERENCES: PersonalPreferences = {
  themeMode: 'system',
  lowVision: false,
};

const LIGHT_PATCH: Record<string, string> = {
  '--color-bg': '#F7F4EA',
  '--color-bg-secondary': '#EFE8D6',
  '--color-surface': '#FFFFFF',
  '--color-surface-raised': '#FFF7DF',
  '--color-card': '#FFFFFF',
  '--color-menu': '#2B2214',
  '--color-header': '#FFF7DF',
  '--color-footer': '#2B2214',
  '--color-text': '#1F1A12',
  '--color-text-muted': '#625642',
  '--color-text-subtle': '#7C7059',
  '--color-border': '#DECFAE',
  '--color-input': '#FFFDF7',
  '--color-input-text': '#1F1A12',
  '--color-input-border': '#C8B98F',
  '--color-button-secondary': '#EFE4C6',
  '--color-button-secondary-text': '#1F1A12',
  '--map-empty': '#E7D9B6',
  '--map-posture': '#FFF9EA',
};

const DARK_PATCH: Record<string, string> = {
  '--color-bg': '#0B0D10',
  '--color-bg-secondary': '#101319',
  '--color-surface': '#15191F',
  '--color-surface-raised': '#1C222A',
  '--color-card': '#171C23',
  '--color-menu': '#0E1116',
  '--color-header': '#101319',
  '--color-footer': '#0B0D10',
  '--color-text': '#F5F7FA',
  '--color-text-muted': '#9AA2AD',
  '--color-text-subtle': '#737B86',
  '--color-border': '#2B323C',
  '--color-input': '#10151B',
  '--color-input-text': '#F5F7FA',
  '--color-input-border': '#39424E',
  '--color-button-secondary': '#252C35',
  '--color-button-secondary-text': '#F5F7FA',
  '--map-empty': '#11151A',
  '--map-posture': '#252C35',
};

const THEME_PATCH_KEYS = Array.from(new Set([...Object.keys(LIGHT_PATCH), ...Object.keys(DARK_PATCH)]));

const LOW_VISION_PATCH: Record<string, string> = {
  '--font-scale': '1.14',
  '--font-size-title': '2.55rem',
  '--font-size-text': '1.08rem',
  '--font-size-xs': '0.86rem',
  '--font-size-sm': '0.98rem',
  '--font-size-md': '1.1rem',
  '--font-size-lg': '1.24rem',
  '--line-height-normal': '1.62',
  '--line-height-relaxed': '1.85',
  '--control-height': '3.2rem',
  '--touch-target': '3.25rem',
  '--border-width': '2px',
};

const LOW_VISION_KEYS = Object.keys(LOW_VISION_PATCH);

export function personalPreferencesKey(profileId: string) {
  return `mantiqueira:personal-preferences:${profileId}`;
}

export function loadPersonalPreferences(profileId: string): PersonalPreferences {
  if (typeof localStorage === 'undefined' || !profileId) return DEFAULT_PREFERENCES;
  const raw = localStorage.getItem(personalPreferencesKey(profileId));
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<PersonalPreferences>;
    return {
      themeMode:
        parsed.themeMode === 'light' || parsed.themeMode === 'dark' ? parsed.themeMode : 'system',
      lowVision: parsed.lowVision === true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePersonalPreferences(profileId: string, preferences: PersonalPreferences) {
  if (typeof localStorage === 'undefined' || !profileId) return;
  localStorage.setItem(personalPreferencesKey(profileId), JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent('personal-preferences-changed', { detail: { profileId } }));
}

export function applyPersonalPreferences(preferences: PersonalPreferences) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.dataset.personalTheme = preferences.themeMode;
  root.dataset.lowVision = String(preferences.lowVision);

  if (preferences.themeMode === 'light' || preferences.themeMode === 'dark') {
    const patch = preferences.themeMode === 'light' ? LIGHT_PATCH : DARK_PATCH;
    Object.entries(patch).forEach(([key, value]) => root.style.setProperty(key, value));
  } else {
    THEME_PATCH_KEYS.forEach((key) => root.style.removeProperty(key));
  }

  if (preferences.lowVision) {
    Object.entries(LOW_VISION_PATCH).forEach(([key, value]) => root.style.setProperty(key, value));
  } else {
    LOW_VISION_KEYS.forEach((key) => root.style.removeProperty(key));
  }

  root.classList.toggle('low-vision-mode', preferences.lowVision);
}
