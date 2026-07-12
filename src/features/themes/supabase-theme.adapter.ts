import { z } from 'zod';
import { requireSupabaseClient } from '../../lib/supabase';
import { createCallbackThemeAdapter, type ThemePersistenceAdapter } from './theme.adapters';
import {
  CURRENT_THEME_SCHEMA_VERSION,
  parseThemeDocument,
  type ThemeDocument,
  type ThemePresetId,
} from './theme.schema';

const activeThemeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tokens: z.record(z.string(), z.string()),
  appearance: z.enum(['light', 'dark', 'high-contrast']),
  density: z.enum(['compact', 'comfortable', 'spacious', 'custom']),
  kind: z.enum(['preset', 'custom']),
  revision: z.coerce.number().int().nonnegative().default(1),
  updated_at: z.string().optional(),
  preset_id: z
    .enum(['classic', 'industrial', 'premium', 'light', 'contrast'])
    .nullable()
    .optional(),
});

const bootstrapSchema = z.object({ active_theme: activeThemeSchema.nullable() });

const themeVersionSchema = z.object({
  id: z.string().uuid(),
  theme_id: z.string().uuid(),
  version_number: z.coerce.number().int().positive(),
  note: z.string().default(''),
  created_at: z.string(),
  created_by: z.string().uuid().nullable().optional(),
  tokens: z.record(z.string(), z.string()),
});

export type ThemeVersionRecord = z.infer<typeof themeVersionSchema>;

function toIsoDatetime(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function toThemeDocument(input: unknown): ThemeDocument | null {
  const theme = activeThemeSchema.nullable().parse(input);
  if (!theme) return null;
  const timestamp = toIsoDatetime(theme.updated_at);
  return parseThemeDocument({
    schemaVersion: CURRENT_THEME_SCHEMA_VERSION,
    id: theme.id,
    name: theme.name,
    kind: theme.kind,
    appearance: theme.appearance,
    density: theme.density,
    tokens: theme.tokens,
    revision: theme.revision,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(theme.kind === 'preset'
      ? { presetId: (theme.preset_id ?? 'industrial') as ThemePresetId }
      : { basePresetId: 'industrial' as const }),
    archived: false,
    isDefault: true,
  });
}

async function loadSiteTheme(siteId: string): Promise<ThemeDocument | null> {
  const { data, error } = await requireSupabaseClient().rpc('app_bootstrap', { p_site_id: siteId });
  if (error) throw error;
  const bootstrap = bootstrapSchema.parse(data);
  return toThemeDocument(bootstrap.active_theme);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isThemeUuid(value: string) {
  return isUuid(value);
}

export async function fetchThemeVersionHistory(
  themeId: string,
  limit = 12,
): Promise<ThemeVersionRecord[]> {
  const { data, error } = await requireSupabaseClient()
    .from('theme_versions')
    .select('id, theme_id, version_number, note, created_at, created_by, tokens')
    .eq('theme_id', themeId)
    .order('version_number', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return z.array(themeVersionSchema).parse(data);
}

export async function restoreThemeVersion(siteId: string, versionId: string) {
  const { error } = await requireSupabaseClient().rpc('restore_theme_version', {
    p_site_id: siteId,
    p_theme_version_id: versionId,
    p_confirmation: 'RESTAURAR',
  });
  if (error) throw error;
}

export function createSupabaseThemeAdapter(siteId: string): ThemePersistenceAdapter {
  return createCallbackThemeAdapter({
    load: () => loadSiteTheme(siteId),
    save: async (theme) => {
      const client = requireSupabaseClient();
      let themeId: string;
      if (theme.kind === 'preset') {
        const { data, error } = await client
          .from('theme_presets')
          .select('id')
          .eq('preset_key', theme.presetId ?? 'industrial')
          .eq('system_preset', true)
          .eq('active', true)
          .single();
        if (error) throw error;
        themeId = z.object({ id: z.string().uuid() }).parse(data).id;
      } else {
        const { data, error } = await client.rpc('save_custom_theme', {
          p_name: theme.name,
          p_tokens: theme.tokens,
          p_theme_id: isUuid(theme.id) ? theme.id : null,
          p_note: 'Alteração aplicada pelo editor visual',
        });
        if (error) throw error;
        themeId = z.object({ id: z.string().uuid() }).passthrough().parse(data).id;
      }
      const { error: applyError } = await client.rpc('apply_theme', {
        p_site_id: siteId,
        p_theme_id: themeId,
      });
      if (applyError) throw applyError;
      const saved = await loadSiteTheme(siteId);
      if (!saved) throw new Error('O tema foi salvo, mas não pôde ser recarregado.');
      return saved;
    },
  });
}
