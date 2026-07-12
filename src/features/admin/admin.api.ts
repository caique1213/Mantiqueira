import { z } from 'zod';
import { requireSupabaseClient } from '../../lib/supabase';

const profileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  active: z.boolean(),
  primary_sector_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const roleSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
});

export interface ManagedUser extends z.infer<typeof profileSchema> {
  roleCodes: string[];
}

export async function fetchUsersAdmin() {
  const client = requireSupabaseClient();
  const [profilesResult, rolesResult, assignmentsResult, sectorsResult] = await Promise.all([
    client
      .from('profiles')
      .select('id,display_name,active,primary_sector_id,created_at,updated_at')
      .order('display_name'),
    client.from('roles').select('id,code,name,active').eq('active', true).order('sort_order'),
    client.from('profile_roles').select('profile_id,role_id'),
    client.from('sectors').select('id,code,name').eq('active', true).order('name'),
  ]);
  const error = [
    profilesResult.error,
    rolesResult.error,
    assignmentsResult.error,
    sectorsResult.error,
  ].find(Boolean);
  if (error) throw error;

  const profiles = z.array(profileSchema).parse(profilesResult.data ?? []);
  const roles = z.array(roleSchema).parse(rolesResult.data ?? []);
  const assignments = z
    .array(z.object({ profile_id: z.string().uuid(), role_id: z.string().uuid() }))
    .parse(assignmentsResult.data ?? []);
  const sectors = z
    .array(z.object({ id: z.string().uuid(), code: z.string(), name: z.string() }))
    .parse(sectorsResult.data ?? []);

  const roleById = new Map(roles.map((role) => [role.id, role.code]));
  const users: ManagedUser[] = profiles.map((profile) => ({
    ...profile,
    roleCodes: assignments
      .filter((assignment) => assignment.profile_id === profile.id)
      .map((assignment) => roleById.get(assignment.role_id))
      .filter((value): value is string => Boolean(value)),
  }));
  return { users, roles, sectors };
}

export async function manageUser(input: {
  userId: string;
  displayName: string;
  active: boolean;
  roleCodes: string[];
  primarySectorId: string | null;
}) {
  const client = requireSupabaseClient();
  const { data, error } = await client.rpc('admin_manage_user', {
    p_target_user_id: input.userId,
    p_active: input.active,
    p_role_codes: input.roleCodes,
    p_primary_sector_id: input.primarySectorId,
    p_confirmation: 'CONFIRMAR',
  });
  if (error) throw error;
  const managedProfile = profileSchema.parse(data);
  if (input.displayName.trim() === managedProfile.display_name) return managedProfile;

  const { data: renamedData, error: renameError } = await client.rpc(
    'admin_set_user_display_name',
    {
      p_target_user_id: input.userId,
      p_display_name: input.displayName.trim(),
      p_confirmation: 'CONFIRMAR',
    },
  );
  if (renameError) throw renameError;
  return profileSchema.parse(renamedData);
}

export async function inviteUser(input: {
  email: string;
  displayName: string;
  password: string;
  roleCode: string;
  primarySectorId: string | null;
}) {
  const { data, error } = await requireSupabaseClient().functions.invoke('admin-invite-user', {
    body: input,
  });
  if (error) throw error;
  return z
    .object({
      userId: z.string().uuid(),
      email: z.string().email(),
      created: z.boolean().optional(),
      invited: z.boolean().optional(),
    })
    .parse(data);
}

export async function fetchAppSettings() {
  const { data, error } = await requireSupabaseClient()
    .from('app_settings')
    .select('key,value,description,public_read,updated_at')
    .order('key');
  if (error) throw error;
  return z
    .array(
      z.object({
        key: z.string(),
        value: z.unknown(),
        description: z.string(),
        public_read: z.boolean(),
        updated_at: z.string(),
      }),
    )
    .parse(data ?? []);
}

export async function setAppSetting(key: string, value: unknown) {
  const { data, error } = await requireSupabaseClient().rpc('admin_set_setting', {
    p_key: key,
    p_value: value,
    p_confirmation: 'CONFIRMAR',
  });
  if (error) throw error;
  return data;
}

export async function fetchAuditLog(limit = 80) {
  const { data, error } = await requireSupabaseClient()
    .from('audit_logs')
    .select('id,actor_id,action,entity_schema,entity_table,entity_id,occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return z
    .array(
      z.object({
        id: z.coerce.string(),
        actor_id: z.string().uuid().nullable(),
        action: z.string(),
        entity_schema: z.string(),
        entity_table: z.string(),
        entity_id: z.string().nullable(),
        occurred_at: z.string(),
      }),
    )
    .parse(data ?? []);
}

export type AdminCatalogKind =
  | 'work-order-statuses'
  | 'priorities'
  | 'problem-types'
  | 'manufacturers'
  | 'technical-models'
  | 'asset-types'
  | 'ui-modules';

export interface AdminCatalogItem {
  id: string;
  code: string;
  name: string;
  description: string;
  system: boolean;
  active: boolean;
  sort_order: number;
  semantic_state: string | null;
  is_terminal: boolean | null;
  allows_operational_actions: boolean | null;
  color: string | null;
  icon: string | null;
  weight: number | null;
  sla_minutes: number | null;
  sector_id: string | null;
  domain: string | null;
  normalized_name: string | null;
  website: string | null;
  asset_type_id: string | null;
  manufacturer_id: string | null;
  model: string | null;
  reference_specs: Record<string, unknown>;
  source_name: string | null;
  source_url: string | null;
  verified: boolean | null;
  confidence: string | null;
  route: string | null;
  required_permission: string | null;
  visible: boolean | null;
}

export interface AdminCatalogOption {
  id: string;
  code: string;
  name: string;
}

export interface AdminCatalogData {
  catalogs: Record<AdminCatalogKind, AdminCatalogItem[]>;
  sectors: AdminCatalogOption[];
  permissions: AdminCatalogOption[];
}

interface CatalogSaveInput {
  kind: AdminCatalogKind;
  id: string | null;
  values: Record<string, unknown>;
}

const codePattern = /^[a-z][a-z0-9_.-]{1,79}$/;
const colorPattern = /^#[0-9A-Fa-f]{6}$/;
const commonName = z.string().trim().min(2).max(160);
const commonIcon = z.string().trim().min(1).max(80);
const commonSortOrder = z.coerce.number().int().min(0).max(32767);

const statusEditableSchema = z.object({
  name: commonName,
  color: z.string().regex(colorPattern),
  icon: commonIcon,
  sort_order: commonSortOrder,
});

const priorityEditableSchema = z.object({
  name: commonName,
  weight: z.coerce.number().int().min(0).max(1000),
  sla_minutes: z.coerce.number().int().positive().nullable(),
  color: z.string().regex(colorPattern),
  icon: commonIcon,
  active: z.boolean(),
  sort_order: commonSortOrder,
});

const problemEditableSchema = z.object({
  name: commonName,
  description: z.string().trim().max(1000),
  sector_id: z.string().uuid().nullable(),
  active: z.boolean(),
  sort_order: commonSortOrder,
});

const manufacturerEditableSchema = z.object({
  name: commonName.max(120),
  website: z.union([z.url(), z.literal('')]).transform((value) => value || null),
  active: z.boolean(),
});

const modelEditableSchema = z.object({
  asset_type_id: z.string().uuid(),
  manufacturer_id: z.string().uuid(),
  model: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000),
  reference_specs: z.record(z.string(), z.unknown()),
  source_name: z.string().trim().max(160).nullable(),
  source_url: z.union([z.url(), z.literal(''), z.null()]).transform((value) => value || null),
  verified: z.boolean(),
  confidence: z.enum(['verified', 'high', 'medium', 'low', 'unverified']),
  active: z.boolean(),
});

const assetTypeEditableSchema = z.object({
  name: commonName.max(100),
  icon: commonIcon,
  active: z.boolean(),
  sort_order: commonSortOrder,
});

const moduleEditableSchema = z.object({
  label: commonName,
  description: z.string().trim().max(500),
  icon: commonIcon,
  required_permission: z.string().trim().nullable(),
  visible: z.boolean(),
  sort_order: commonSortOrder,
});

const catalogTables: Record<AdminCatalogKind, string> = {
  'work-order-statuses': 'work_order_status_definitions',
  priorities: 'priority_definitions',
  'problem-types': 'problem_types',
  manufacturers: 'manufacturers',
  'technical-models': 'technical_models',
  'asset-types': 'asset_types',
  'ui-modules': 'ui_modules',
};

function normalizeCode(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeManufacturer(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCatalogRows(kind: AdminCatalogKind, rows: unknown[]): AdminCatalogItem[] {
  return rows.map((raw) => {
    const row = z.record(z.string(), z.unknown()).parse(raw);
    const stringValue = (key: string) => (typeof row[key] === 'string' ? row[key] : null);
    const numberValue = (key: string) => (typeof row[key] === 'number' ? row[key] : null);
    const booleanValue = (key: string) => (typeof row[key] === 'boolean' ? row[key] : null);
    const objectValue = (key: string) => {
      const value = row[key];
      return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    };
    const module = kind === 'ui-modules';
    const model = kind === 'technical-models';
    return {
      id: z.string().uuid().parse(row.id),
      code: stringValue(module ? 'slug' : 'code') ?? (model ? stringValue('model') : null) ?? '',
      name: stringValue(module ? 'label' : model ? 'model' : 'name') ?? '',
      description: stringValue('description') ?? '',
      system: booleanValue('system') ?? false,
      active: module ? (booleanValue('visible') ?? false) : (booleanValue('active') ?? true),
      sort_order: numberValue('sort_order') ?? 0,
      semantic_state: stringValue('semantic_state'),
      is_terminal: booleanValue('is_terminal'),
      allows_operational_actions: booleanValue('allows_operational_actions'),
      color: stringValue('color'),
      icon: stringValue('icon'),
      weight: numberValue('weight'),
      sla_minutes: numberValue('sla_minutes'),
      sector_id: stringValue('sector_id'),
      domain: stringValue('domain'),
      normalized_name: stringValue('normalized_name'),
      website: stringValue('website'),
      asset_type_id: stringValue('asset_type_id'),
      manufacturer_id: stringValue('manufacturer_id'),
      model: stringValue('model'),
      reference_specs: objectValue('reference_specs'),
      source_name: stringValue('source_name'),
      source_url: stringValue('source_url'),
      verified: booleanValue('verified'),
      confidence: stringValue('confidence'),
      route: stringValue('route'),
      required_permission: stringValue('required_permission'),
      visible: booleanValue('visible'),
    };
  });
}

export async function fetchAdminCatalogs(): Promise<AdminCatalogData> {
  const client = requireSupabaseClient();
  const requests = {
    'work-order-statuses': client
      .from('work_order_status_definitions')
      .select(
        'id,code,name,semantic_state,is_terminal,allows_operational_actions,color,icon,system,active,sort_order',
      )
      .order('sort_order'),
    priorities: client
      .from('priority_definitions')
      .select('id,code,name,weight,sla_minutes,color,icon,system,active,sort_order')
      .order('sort_order'),
    'problem-types': client
      .from('problem_types')
      .select('id,sector_id,code,name,description,active,system,sort_order')
      .order('sort_order'),
    manufacturers: client
      .from('manufacturers')
      .select('id,name,normalized_name,website,active')
      .order('name'),
    'technical-models': client
      .from('technical_models')
      .select(
        'id,asset_type_id,manufacturer_id,model,description,reference_specs,source_name,source_url,verified,confidence,active',
      )
      .order('model'),
    'asset-types': client
      .from('asset_types')
      .select('id,code,name,domain,icon,system,active,sort_order')
      .order('sort_order'),
    'ui-modules': client
      .from('ui_modules')
      .select('id,slug,label,description,icon,route,required_permission,visible,system,sort_order')
      .order('sort_order'),
  } as const;
  const [
    statuses,
    priorities,
    problems,
    manufacturers,
    models,
    assetTypes,
    modules,
    sectors,
    permissions,
  ] = await Promise.all([
    requests['work-order-statuses'],
    requests.priorities,
    requests['problem-types'],
    requests.manufacturers,
    requests['technical-models'],
    requests['asset-types'],
    requests['ui-modules'],
    client.from('sectors').select('id,code,name').eq('active', true).order('name'),
    client.from('permissions').select('id,code,name:description').order('code'),
  ]);

  const results = [
    statuses,
    priorities,
    problems,
    manufacturers,
    models,
    assetTypes,
    modules,
    sectors,
    permissions,
  ];
  const firstError = results.map((result) => result.error).find((error) => error !== null);
  if (firstError) throw firstError;

  const optionSchema = z.array(
    z.object({ id: z.string().uuid(), code: z.string(), name: z.string() }),
  );
  return {
    catalogs: {
      'work-order-statuses': parseCatalogRows('work-order-statuses', statuses.data ?? []),
      priorities: parseCatalogRows('priorities', priorities.data ?? []),
      'problem-types': parseCatalogRows('problem-types', problems.data ?? []),
      manufacturers: parseCatalogRows('manufacturers', manufacturers.data ?? []),
      'technical-models': parseCatalogRows('technical-models', models.data ?? []),
      'asset-types': parseCatalogRows('asset-types', assetTypes.data ?? []),
      'ui-modules': parseCatalogRows('ui-modules', modules.data ?? []),
    },
    sectors: optionSchema.parse(sectors.data ?? []),
    permissions: optionSchema.parse(permissions.data ?? []),
  };
}

function buildCatalogPayload(input: CatalogSaveInput) {
  const creating = input.id === null;
  switch (input.kind) {
    case 'work-order-statuses': {
      const editable = statusEditableSchema.parse(input.values);
      if (!creating) return editable;
      const creation = z
        .object({
          code: z.string().regex(codePattern),
          semantic_state: z.enum([
            'awaiting',
            'in_progress',
            'waiting_part',
            'resolved',
            'cancelled',
          ]),
        })
        .parse(input.values);
      return {
        ...editable,
        ...creation,
        system: false,
        active: true,
        allows_operational_actions: !['resolved', 'cancelled'].includes(creation.semantic_state),
      };
    }
    case 'priorities': {
      const editable = priorityEditableSchema.parse(input.values);
      if (!creating) return editable;
      const code = z.string().regex(codePattern).parse(input.values.code);
      return { ...editable, code, system: false };
    }
    case 'problem-types': {
      const editable = problemEditableSchema.parse(input.values);
      if (!creating) return editable;
      const code = z.string().regex(codePattern).parse(input.values.code);
      return { ...editable, code, system: false };
    }
    case 'manufacturers': {
      const editable = manufacturerEditableSchema.parse(input.values);
      return { ...editable, normalized_name: normalizeManufacturer(editable.name) };
    }
    case 'technical-models':
      return modelEditableSchema.parse(input.values);
    case 'asset-types': {
      const editable = assetTypeEditableSchema.parse(input.values);
      if (!creating) return editable;
      const creation = z
        .object({
          code: z.string().regex(codePattern),
          domain: z.enum(['electrical', 'mechanical', 'general']),
        })
        .parse(input.values);
      return { ...editable, ...creation, system: false };
    }
    case 'ui-modules': {
      const editable = moduleEditableSchema.parse(input.values);
      if (!creating) return editable;
      const creation = z
        .object({
          slug: z.string().regex(/^[a-z][a-z0-9-]{1,49}$/),
          route: z.string().startsWith('/').max(200),
        })
        .parse(input.values);
      return { ...editable, ...creation, system: false };
    }
  }
}

export async function saveAdminCatalog(input: CatalogSaveInput) {
  const client = requireSupabaseClient();
  const table = catalogTables[input.kind];
  const payload = buildCatalogPayload(input);
  // The table and payload are both selected from the same discriminated kind and
  // validated by the Zod schemas above. Supabase cannot preserve that correlation
  // after a dynamic table lookup, so the validated value is narrowed at this edge.
  const validatedPayload = payload as never;
  const request = input.id
    ? client.from(table).update(validatedPayload).eq('id', input.id)
    : client.from(table).insert(validatedPayload);
  const { data, error } = await request.select().single();
  if (error) throw error;
  return data;
}

const protectedCatalogKinds = new Set<AdminCatalogKind>([
  'work-order-statuses',
  'priorities',
  'problem-types',
  'asset-types',
  'ui-modules',
]);

export async function deleteAdminCatalog(kind: AdminCatalogKind, item: AdminCatalogItem) {
  if (protectedCatalogKinds.has(kind) && item.system) {
    throw new Error('Itens estruturais do sistema não podem ser excluídos.');
  }
  const { error } = await requireSupabaseClient()
    .from(catalogTables[kind])
    .delete()
    .eq('id', item.id);
  if (error) throw error;
}

export function suggestedCatalogCode(name: string, kind: AdminCatalogKind) {
  const normalized = normalizeCode(name);
  return kind === 'ui-modules' ? normalized.replace(/_/g, '-') : normalized;
}
