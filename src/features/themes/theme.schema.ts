import { z } from 'zod';

export const CURRENT_THEME_SCHEMA_VERSION = 1 as const;

export const THEME_PRESET_IDS = ['classic', 'industrial', 'premium', 'light', 'contrast'] as const;

export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];
export type ThemeAppearance = 'light' | 'dark' | 'high-contrast';
export type ThemeDensity = 'compact' | 'comfortable' | 'spacious' | 'custom';
export type ThemeKind = 'preset' | 'custom';
export type ThemeTokenKind = 'color' | 'font' | 'length' | 'number' | 'shadow' | 'duration';

export type ThemeTokenGroup =
  | 'global'
  | 'actions'
  | 'status'
  | 'priority'
  | 'map'
  | 'assets'
  | 'typography'
  | 'spacing'
  | 'shape'
  | 'effects';

export interface ThemeTokenDefinition {
  readonly key: string;
  readonly cssVariable: `--${string}`;
  readonly label: string;
  readonly group: ThemeTokenGroup;
  readonly kind: ThemeTokenKind;
}

/**
 * This registry is the single allow-list for values that can reach the DOM.
 * Adding a token requires a key, its stable CSS custom-property name and an
 * editor group. The runtime never interpolates token names supplied by users.
 */
export const THEME_TOKEN_DEFINITIONS = [
  {
    key: 'colorBg',
    cssVariable: '--color-bg',
    label: 'Fundo principal',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorBgSecondary',
    cssVariable: '--color-bg-secondary',
    label: 'Fundo secundário',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorSurface',
    cssVariable: '--color-surface',
    label: 'Superfície',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorSurfaceRaised',
    cssVariable: '--color-surface-raised',
    label: 'Superfície elevada',
    group: 'global',
    kind: 'color',
  },
  { key: 'colorCard', cssVariable: '--color-card', label: 'Cards', group: 'global', kind: 'color' },
  { key: 'colorMenu', cssVariable: '--color-menu', label: 'Menu', group: 'global', kind: 'color' },
  {
    key: 'colorHeader',
    cssVariable: '--color-header',
    label: 'Cabeçalho',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorFooter',
    cssVariable: '--color-footer',
    label: 'Rodapé',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorText',
    cssVariable: '--color-text',
    label: 'Texto principal',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorTextMuted',
    cssVariable: '--color-text-muted',
    label: 'Texto secundário',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorBorder',
    cssVariable: '--color-border',
    label: 'Bordas',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorInput',
    cssVariable: '--color-input',
    label: 'Fundo dos campos',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorInputText',
    cssVariable: '--color-input-text',
    label: 'Texto dos campos',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorInputBorder',
    cssVariable: '--color-input-border',
    label: 'Borda dos campos',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorIcon',
    cssVariable: '--color-icon',
    label: 'Ícones',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorBadge',
    cssVariable: '--color-badge',
    label: 'Badges',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorBadgeText',
    cssVariable: '--color-badge-text',
    label: 'Texto dos badges',
    group: 'global',
    kind: 'color',
  },
  {
    key: 'colorMarker',
    cssVariable: '--color-marker',
    label: 'Marcadores',
    group: 'global',
    kind: 'color',
  },

  {
    key: 'colorPrimary',
    cssVariable: '--color-primary',
    label: 'Cor principal',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorPrimaryContrast',
    cssVariable: '--color-primary-contrast',
    label: 'Contraste da principal',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorSecondary',
    cssVariable: '--color-secondary',
    label: 'Cor secundária',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorSecondaryContrast',
    cssVariable: '--color-secondary-contrast',
    label: 'Contraste da secundária',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorAccent',
    cssVariable: '--color-accent',
    label: 'Destaque',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorDanger',
    cssVariable: '--color-danger',
    label: 'Perigo',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorDangerContrast',
    cssVariable: '--color-danger-contrast',
    label: 'Contraste de perigo',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorSuccess',
    cssVariable: '--color-success',
    label: 'Sucesso',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorWarning',
    cssVariable: '--color-warning',
    label: 'Alerta',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorInfo',
    cssVariable: '--color-info',
    label: 'Informação',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorButtonPrimary',
    cssVariable: '--color-button-primary',
    label: 'Botão principal',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorButtonPrimaryText',
    cssVariable: '--color-button-primary-text',
    label: 'Texto do botão principal',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorButtonPrimaryHover',
    cssVariable: '--color-button-primary-hover',
    label: 'Botão principal ao apontar',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorButtonSecondary',
    cssVariable: '--color-button-secondary',
    label: 'Botão secundário',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorButtonSecondaryText',
    cssVariable: '--color-button-secondary-text',
    label: 'Texto do botão secundário',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorButtonSecondaryHover',
    cssVariable: '--color-button-secondary-hover',
    label: 'Botão secundário ao apontar',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorButtonDanger',
    cssVariable: '--color-button-danger',
    label: 'Botão de perigo',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorButtonDangerText',
    cssVariable: '--color-button-danger-text',
    label: 'Texto do botão de perigo',
    group: 'actions',
    kind: 'color',
  },
  {
    key: 'colorButtonDangerHover',
    cssVariable: '--color-button-danger-hover',
    label: 'Botão de perigo ao apontar',
    group: 'actions',
    kind: 'color',
  },

  {
    key: 'statusAwaiting',
    cssVariable: '--status-awaiting',
    label: 'Aguardando atendimento',
    group: 'status',
    kind: 'color',
  },
  {
    key: 'statusInProgress',
    cssVariable: '--status-in-progress',
    label: 'Em execução',
    group: 'status',
    kind: 'color',
  },
  {
    key: 'statusWaitingPart',
    cssVariable: '--status-waiting-part',
    label: 'Aguardando peça',
    group: 'status',
    kind: 'color',
  },
  {
    key: 'statusResolved',
    cssVariable: '--status-resolved',
    label: 'Resolvida',
    group: 'status',
    kind: 'color',
  },
  {
    key: 'statusCancelled',
    cssVariable: '--status-cancelled',
    label: 'Cancelada',
    group: 'status',
    kind: 'color',
  },

  {
    key: 'priorityLow',
    cssVariable: '--priority-low',
    label: 'Baixa',
    group: 'priority',
    kind: 'color',
  },
  {
    key: 'priorityNormal',
    cssVariable: '--priority-normal',
    label: 'Normal',
    group: 'priority',
    kind: 'color',
  },
  {
    key: 'priorityHigh',
    cssVariable: '--priority-high',
    label: 'Alta',
    group: 'priority',
    kind: 'color',
  },
  {
    key: 'priorityCritical',
    cssVariable: '--priority-critical',
    label: 'Crítica',
    group: 'priority',
    kind: 'color',
  },

  {
    key: 'mapEmpty',
    cssVariable: '--map-empty',
    label: 'Vazio físico',
    group: 'map',
    kind: 'color',
  },
  {
    key: 'mapPosture',
    cssVariable: '--map-posture',
    label: 'Postura',
    group: 'map',
    kind: 'color',
  },
  {
    key: 'mapActive',
    cssVariable: '--map-active',
    label: 'Postura ativa',
    group: 'map',
    kind: 'color',
  },
  {
    key: 'mapHighlight',
    cssVariable: '--map-highlight',
    label: 'Destaque',
    group: 'map',
    kind: 'color',
  },
  {
    key: 'mapSelected',
    cssVariable: '--map-selected',
    label: 'Seleção',
    group: 'map',
    kind: 'color',
  },
  {
    key: 'mapHeatLow',
    cssVariable: '--map-heat-low',
    label: 'Heatmap baixo',
    group: 'map',
    kind: 'color',
  },
  {
    key: 'mapHeatMedium',
    cssVariable: '--map-heat-medium',
    label: 'Heatmap médio',
    group: 'map',
    kind: 'color',
  },
  {
    key: 'mapHeatHigh',
    cssVariable: '--map-heat-high',
    label: 'Heatmap alto',
    group: 'map',
    kind: 'color',
  },

  {
    key: 'assetMotor',
    cssVariable: '--asset-motor',
    label: 'Motores',
    group: 'assets',
    kind: 'color',
  },
  {
    key: 'assetReducer',
    cssVariable: '--asset-reducer',
    label: 'Redutores',
    group: 'assets',
    kind: 'color',
  },
  {
    key: 'batteryCage',
    cssVariable: '--battery-cage',
    label: 'Bateria e gaiolas',
    group: 'assets',
    kind: 'color',
  },
  {
    key: 'batteryNylon',
    cssVariable: '--battery-nylon',
    label: 'Esteiras de nylon',
    group: 'assets',
    kind: 'color',
  },
  {
    key: 'batteryWhiteConveyor',
    cssVariable: '--battery-white-conveyor',
    label: 'Esteiras brancas',
    group: 'assets',
    kind: 'color',
  },
  {
    key: 'batteryFeedCart',
    cssVariable: '--battery-feed-cart',
    label: 'Carrinho de ração',
    group: 'assets',
    kind: 'color',
  },
  {
    key: 'batteryElevator',
    cssVariable: '--battery-elevator',
    label: 'Elevador',
    group: 'assets',
    kind: 'color',
  },

  {
    key: 'fontFamilyBody',
    cssVariable: '--font-family-body',
    label: 'Família do texto',
    group: 'typography',
    kind: 'font',
  },
  {
    key: 'fontFamilyHeading',
    cssVariable: '--font-family-heading',
    label: 'Família dos títulos',
    group: 'typography',
    kind: 'font',
  },
  {
    key: 'fontFamilyMono',
    cssVariable: '--font-family-mono',
    label: 'Família técnica',
    group: 'typography',
    kind: 'font',
  },
  {
    key: 'fontScale',
    cssVariable: '--font-scale',
    label: 'Escala tipográfica',
    group: 'typography',
    kind: 'number',
  },
  {
    key: 'fontSizeTitle',
    cssVariable: '--font-size-title',
    label: 'Tamanho dos títulos',
    group: 'typography',
    kind: 'length',
  },
  {
    key: 'fontSizeText',
    cssVariable: '--font-size-text',
    label: 'Tamanho do texto',
    group: 'typography',
    kind: 'length',
  },
  {
    key: 'fontSizeXs',
    cssVariable: '--font-size-xs',
    label: 'Texto mínimo',
    group: 'typography',
    kind: 'length',
  },
  {
    key: 'fontSizeSm',
    cssVariable: '--font-size-sm',
    label: 'Texto pequeno',
    group: 'typography',
    kind: 'length',
  },
  {
    key: 'fontSizeMd',
    cssVariable: '--font-size-md',
    label: 'Texto médio',
    group: 'typography',
    kind: 'length',
  },
  {
    key: 'fontSizeLg',
    cssVariable: '--font-size-lg',
    label: 'Texto grande',
    group: 'typography',
    kind: 'length',
  },
  {
    key: 'fontSizeXl',
    cssVariable: '--font-size-xl',
    label: 'Título pequeno',
    group: 'typography',
    kind: 'length',
  },
  {
    key: 'fontSize2xl',
    cssVariable: '--font-size-2xl',
    label: 'Título médio',
    group: 'typography',
    kind: 'length',
  },
  {
    key: 'fontSize3xl',
    cssVariable: '--font-size-3xl',
    label: 'Título grande',
    group: 'typography',
    kind: 'length',
  },
  {
    key: 'fontWeightRegular',
    cssVariable: '--font-weight-regular',
    label: 'Peso regular',
    group: 'typography',
    kind: 'number',
  },
  {
    key: 'fontWeightMedium',
    cssVariable: '--font-weight-medium',
    label: 'Peso médio',
    group: 'typography',
    kind: 'number',
  },
  {
    key: 'fontWeightSemibold',
    cssVariable: '--font-weight-semibold',
    label: 'Peso seminegrito',
    group: 'typography',
    kind: 'number',
  },
  {
    key: 'fontWeightBold',
    cssVariable: '--font-weight-bold',
    label: 'Peso negrito',
    group: 'typography',
    kind: 'number',
  },
  {
    key: 'lineHeightTight',
    cssVariable: '--line-height-tight',
    label: 'Entrelinha compacta',
    group: 'typography',
    kind: 'number',
  },
  {
    key: 'lineHeightNormal',
    cssVariable: '--line-height-normal',
    label: 'Entrelinha normal',
    group: 'typography',
    kind: 'number',
  },
  {
    key: 'lineHeightRelaxed',
    cssVariable: '--line-height-relaxed',
    label: 'Entrelinha ampla',
    group: 'typography',
    kind: 'number',
  },

  {
    key: 'spaceXs',
    cssVariable: '--space-xs',
    label: 'Espaço mínimo',
    group: 'spacing',
    kind: 'length',
  },
  {
    key: 'spaceSm',
    cssVariable: '--space-sm',
    label: 'Espaço pequeno',
    group: 'spacing',
    kind: 'length',
  },
  {
    key: 'spaceMd',
    cssVariable: '--space-md',
    label: 'Espaço médio',
    group: 'spacing',
    kind: 'length',
  },
  {
    key: 'spaceLg',
    cssVariable: '--space-lg',
    label: 'Espaço grande',
    group: 'spacing',
    kind: 'length',
  },
  {
    key: 'spaceXl',
    cssVariable: '--space-xl',
    label: 'Espaço extragrande',
    group: 'spacing',
    kind: 'length',
  },
  {
    key: 'space2xl',
    cssVariable: '--space-2xl',
    label: 'Espaço de seção',
    group: 'spacing',
    kind: 'length',
  },
  {
    key: 'controlHeight',
    cssVariable: '--control-height',
    label: 'Altura dos controles',
    group: 'spacing',
    kind: 'length',
  },
  {
    key: 'touchTarget',
    cssVariable: '--touch-target',
    label: 'Alvo mínimo de toque',
    group: 'spacing',
    kind: 'length',
  },
  {
    key: 'layoutMaxWidth',
    cssVariable: '--layout-max-width',
    label: 'Largura do conteúdo',
    group: 'spacing',
    kind: 'length',
  },

  {
    key: 'radiusSm',
    cssVariable: '--radius-sm',
    label: 'Raio pequeno',
    group: 'shape',
    kind: 'length',
  },
  {
    key: 'radiusMd',
    cssVariable: '--radius-md',
    label: 'Raio médio',
    group: 'shape',
    kind: 'length',
  },
  {
    key: 'radiusLg',
    cssVariable: '--radius-lg',
    label: 'Raio grande',
    group: 'shape',
    kind: 'length',
  },
  {
    key: 'radiusXl',
    cssVariable: '--radius-xl',
    label: 'Raio extragrande',
    group: 'shape',
    kind: 'length',
  },
  {
    key: 'radiusPill',
    cssVariable: '--radius-pill',
    label: 'Raio de pílula',
    group: 'shape',
    kind: 'length',
  },
  {
    key: 'borderWidth',
    cssVariable: '--border-width',
    label: 'Espessura da borda',
    group: 'shape',
    kind: 'length',
  },

  {
    key: 'shadowSm',
    cssVariable: '--shadow-sm',
    label: 'Sombra pequena',
    group: 'effects',
    kind: 'shadow',
  },
  {
    key: 'shadowMd',
    cssVariable: '--shadow-md',
    label: 'Sombra média',
    group: 'effects',
    kind: 'shadow',
  },
  {
    key: 'shadowLg',
    cssVariable: '--shadow-lg',
    label: 'Sombra grande',
    group: 'effects',
    kind: 'shadow',
  },
  {
    key: 'backdropBlur',
    cssVariable: '--backdrop-blur',
    label: 'Desfoque',
    group: 'effects',
    kind: 'length',
  },
  {
    key: 'surfaceOpacity',
    cssVariable: '--surface-opacity',
    label: 'Transparência',
    group: 'effects',
    kind: 'number',
  },
  {
    key: 'motionFast',
    cssVariable: '--motion-fast',
    label: 'Animação rápida',
    group: 'effects',
    kind: 'duration',
  },
  {
    key: 'motionNormal',
    cssVariable: '--motion-normal',
    label: 'Animação normal',
    group: 'effects',
    kind: 'duration',
  },
  {
    key: 'motionSlow',
    cssVariable: '--motion-slow',
    label: 'Animação suave',
    group: 'effects',
    kind: 'duration',
  },
] as const satisfies readonly ThemeTokenDefinition[];

export type ThemeTokenKey = (typeof THEME_TOKEN_DEFINITIONS)[number]['key'];
export type ThemeTokens = Record<ThemeTokenKey, string>;

export interface ThemeDocumentV1 {
  schemaVersion: typeof CURRENT_THEME_SCHEMA_VERSION;
  id: string;
  name: string;
  kind: ThemeKind;
  appearance: ThemeAppearance;
  density: ThemeDensity;
  tokens: ThemeTokens;
  revision: number;
  createdAt: string;
  updatedAt: string;
  presetId?: ThemePresetId;
  basePresetId?: ThemePresetId;
  archived: boolean;
  isDefault: boolean;
}

export type ThemeDocument = ThemeDocumentV1;

const safeCssTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine(
    (value) => !/[;{}<>]/u.test(value) && !/(?:url|expression|@import)\s*\(/iu.test(value),
    'Valor de token CSS não permitido.',
  );

const tokenShape = Object.fromEntries(
  THEME_TOKEN_DEFINITIONS.map(({ key }) => [key, safeCssTokenSchema]),
) as Record<ThemeTokenKey, typeof safeCssTokenSchema>;

export const themeTokensSchema = z.object(tokenShape).strict();

export const themeDocumentV1Schema = z
  .object({
    schemaVersion: z.literal(CURRENT_THEME_SCHEMA_VERSION),
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(80),
    kind: z.enum(['preset', 'custom']),
    appearance: z.enum(['light', 'dark', 'high-contrast']),
    density: z.enum(['compact', 'comfortable', 'spacious', 'custom']),
    tokens: themeTokensSchema,
    revision: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    presetId: z.enum(THEME_PRESET_IDS).optional(),
    basePresetId: z.enum(THEME_PRESET_IDS).optional(),
    archived: z.boolean(),
    isDefault: z.boolean(),
  })
  .strict()
  .superRefine((theme, context) => {
    if (theme.kind === 'preset' && theme.presetId === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['presetId'],
        message: 'Um preset deve informar presetId.',
      });
    }
    if (theme.kind === 'custom' && theme.basePresetId === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['basePresetId'],
        message: 'Um tema personalizado deve informar o preset de origem.',
      });
    }
  });

export function parseThemeDocument(input: unknown): ThemeDocument {
  return themeDocumentV1Schema.parse(input) as ThemeDocument;
}

/** Version gate for persisted data. Future schema migrations are added here. */
export function migrateThemeDocument(input: unknown): ThemeDocument {
  if (typeof input !== 'object' || input === null || !('schemaVersion' in input)) {
    throw new Error('Documento de tema sem versão de schema.');
  }

  const version = (input as { schemaVersion: unknown }).schemaVersion;
  if (version !== CURRENT_THEME_SCHEMA_VERSION) {
    throw new Error(`Versão de tema não suportada: ${String(version)}.`);
  }

  return parseThemeDocument(input);
}

export function isSafeThemeTokenValue(value: string): boolean {
  return safeCssTokenSchema.safeParse(value).success;
}
