import { requireSupabaseClient } from '../../lib/supabase';
import { imageToWebp, sha256 } from '../../lib/media';
import type {
  AssetCatalogs,
  AssetCriticality,
  AssetDataSource,
  AssetDetail,
  AssetDomain,
  AssetFormValues,
  AssetInstallation,
  AssetMedia,
  AssetMediaType,
  AssetPositionOption,
  AssetSpecificSpecs,
  AssetTimelineItem,
  InventoryAsset,
  InventoryFilters,
  InventoryPageResult,
  ReplacementAssetOption,
  TechnicalModelDetail,
  TechnicalModelOption,
} from './inventory.types';

type UnknownRow = Record<string, unknown>;

const domainValues = new Set<AssetDomain>(['electrical', 'mechanical', 'general']);
const criticalityValues = new Set<AssetCriticality>(['low', 'medium', 'high', 'critical']);
const sourceValues = new Set<AssetDataSource>([
  'physical_nameplate',
  'field_measurement',
  'manual',
  'library',
  'unknown',
]);

function row(value: unknown, context = 'registro'): UnknownRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`O servidor retornou ${context} em formato inesperado.`);
  }
  return value as UnknownRow;
}

function rows(value: unknown, context = 'registros'): UnknownRow[] {
  if (!Array.isArray(value))
    throw new Error(`O servidor retornou ${context} em formato inesperado.`);
  return value.map((item) => row(item, context));
}

const REMOTE_PAGE_SIZE = 800;

async function fetchAllRows(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
  context: string,
): Promise<UnknownRow[]> {
  const result: UnknownRow[] = [];
  for (let from = 0; ; from += REMOTE_PAGE_SIZE) {
    const response = await fetchPage(from, from + REMOTE_PAGE_SIZE - 1);
    if (response.error) throw response.error;
    const page = rows(response.data ?? [], context);
    result.push(...page);
    if (page.length < REMOTE_PAGE_SIZE) return result;
  }
}

function valueAt(source: UnknownRow, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) return source[key];
  }
  return undefined;
}

function requiredString(source: UnknownRow, context: string, ...keys: string[]): string {
  const value = valueAt(source, ...keys);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`O campo ${context} não foi retornado pelo servidor.`);
  }
  return value;
}

function optionalString(source: UnknownRow, ...keys: string[]): string | null {
  const value = valueAt(source, ...keys);
  return typeof value === 'string' && value.trim() ? value : null;
}

function stringOr(source: UnknownRow, fallback: string, ...keys: string[]): string {
  return optionalString(source, ...keys) ?? fallback;
}

function optionalNumber(source: UnknownRow, ...keys: string[]): number | null {
  const value = valueAt(source, ...keys);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value);
  return null;
}

function objectValue(source: UnknownRow, ...keys: string[]): Record<string, unknown> {
  const value = valueAt(source, ...keys);
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(source: UnknownRow, ...keys: string[]): string[] {
  const value = valueAt(source, ...keys);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function boolValue(source: UnknownRow, fallback: boolean, ...keys: string[]): boolean {
  const value = valueAt(source, ...keys);
  return typeof value === 'boolean' ? value : fallback;
}

function asDomain(value: unknown): AssetDomain {
  return typeof value === 'string' && domainValues.has(value as AssetDomain)
    ? (value as AssetDomain)
    : 'general';
}

function asCriticality(value: unknown): AssetCriticality {
  return typeof value === 'string' && criticalityValues.has(value as AssetCriticality)
    ? (value as AssetCriticality)
    : 'medium';
}

function asDataSource(value: unknown): AssetDataSource {
  return typeof value === 'string' && sourceValues.has(value as AssetDataSource)
    ? (value as AssetDataSource)
    : 'unknown';
}

function normalizeInventoryRow(sourceValue: unknown): InventoryAsset {
  const source = row(sourceValue, 'localização do ativo');
  return {
    assetId: requiredString(source, 'asset_id', 'asset_id', 'id'),
    siteId: requiredString(source, 'site_id', 'site_id'),
    assetTypeId: requiredString(source, 'asset_type_id', 'asset_type_id'),
    assetTypeCode: stringOr(source, 'other', 'asset_type_code', 'type_code'),
    assetTypeName: stringOr(source, 'Ativo', 'asset_type_name', 'type_name'),
    domain: asDomain(valueAt(source, 'domain', 'asset_domain')),
    manufacturerId: optionalString(source, 'manufacturer_id'),
    manufacturerName: optionalString(source, 'manufacturer_name', 'manufacturer'),
    technicalModelId: optionalString(source, 'technical_model_id'),
    modelName: optionalString(source, 'model_name', 'model'),
    internalCode: optionalString(source, 'internal_code'),
    serialNumber: optionalString(source, 'serial_number'),
    statusId: requiredString(source, 'status_id', 'status_id'),
    statusCode: stringOr(source, 'to_verify', 'status_code'),
    statusName: stringOr(source, 'A verificar', 'status_name'),
    criticality: asCriticality(valueAt(source, 'criticality')),
    installationId: requiredString(source, 'installation_id', 'installation_id'),
    assetPositionId: requiredString(
      source,
      'asset_position_id',
      'asset_position_id',
      'position_id',
    ),
    positionCode: stringOr(source, 'position', 'position_code'),
    positionName: stringOr(source, 'Posição técnica', 'position_name'),
    postureId: requiredString(source, 'posture_id', 'posture_id'),
    postureNumber: optionalNumber(source, 'posture_number') ?? 0,
    batteryId: optionalString(source, 'battery_id'),
    batteryCode: optionalString(source, 'battery_code'),
    installedAt: requiredString(source, 'installed_at', 'installed_at'),
    updatedAt: requiredString(source, 'updated_at', 'updated_at', 'installed_at'),
    completenessPercent: optionalNumber(source, 'completeness_percent'),
    missingFields: stringArray(source, 'missing_fields'),
  };
}

function cleanSearchTerm(value: string): string {
  return value
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

async function fetchCompletenessMap(assetIds: string[]) {
  const result = new Map<string, { percent: number; missing: string[] }>();
  if (!assetIds.length) return result;
  const { data, error } = await requireSupabaseClient()
    .from('asset_completeness')
    .select('asset_id,completeness_percent,missing_fields')
    .in('asset_id', assetIds);
  if (error) throw error;
  for (const item of rows(data ?? [], 'completude')) {
    const id = requiredString(item, 'asset_id', 'asset_id');
    result.set(id, {
      percent: optionalNumber(item, 'completeness_percent') ?? 0,
      missing: stringArray(item, 'missing_fields'),
    });
  }
  return result;
}

export async function fetchInventoryPage(input: {
  page: number;
  pageSize: number;
  filters: InventoryFilters;
}): Promise<InventoryPageResult> {
  const client = requireSupabaseClient();

  let query = client.from('asset_current_location').select('*', { count: 'exact' });
  if (input.filters.assetTypeId) query = query.eq('asset_type_id', input.filters.assetTypeId);
  if (input.filters.manufacturerId)
    query = query.eq('manufacturer_id', input.filters.manufacturerId);
  if (input.filters.postureNumber)
    query = query.eq('posture_number', Number(input.filters.postureNumber));
  if (input.filters.completeness === 'complete') {
    query = query.gte('completeness_percent', 100);
  } else if (input.filters.completeness === 'incomplete') {
    query = query.lt('completeness_percent', 100);
  } else if (input.filters.completeness === 'missing_nameplate') {
    query = query.eq('has_nameplate_photo', false);
  }

  const search = cleanSearchTerm(input.filters.search);
  if (search) {
    query = query.or(
      [
        `internal_code.ilike.%${search}%`,
        `serial_number.ilike.%${search}%`,
        `asset_type_name.ilike.%${search}%`,
        `manufacturer_name.ilike.%${search}%`,
        `model_name.ilike.%${search}%`,
        `position_name.ilike.%${search}%`,
      ].join(','),
    );
  }

  const from = (input.page - 1) * input.pageSize;
  const { data, error, count } = await query
    .order('posture_number', { ascending: true })
    .order('battery_code', { ascending: true, nullsFirst: true })
    .order('position_name', { ascending: true })
    .range(from, from + input.pageSize - 1);
  if (error) throw error;

  const normalized = (data ?? []).map(normalizeInventoryRow);
  const completeness = await fetchCompletenessMap(normalized.map((item) => item.assetId));
  return {
    rows: normalized.map((item) => {
      const score = completeness.get(item.assetId);
      return score
        ? { ...item, completenessPercent: score.percent, missingFields: score.missing }
        : item;
    }),
    total: count ?? normalized.length,
  };
}

export async function fetchAssetCatalogs(siteIds?: string[]): Promise<AssetCatalogs> {
  const client = requireSupabaseClient();
  let sitesQuery = client.from('sites').select('id,name,code').eq('active', true).order('name');
  if (siteIds?.length) sitesQuery = sitesQuery.in('id', siteIds);
  const [sites, types, manufacturers, statuses, models] = await Promise.all([
    sitesQuery,
    client.from('asset_types').select('id,code,name,domain').eq('active', true).order('sort_order'),
    client.from('manufacturers').select('id,name').eq('active', true).order('name'),
    client
      .from('asset_status_definitions')
      .select('id,code,name,color,semantic_state')
      .eq('active', true)
      .order('sort_order'),
    client
      .from('technical_models')
      .select(
        'id,asset_type_id,manufacturer_id,model,description,reference_specs,source_name,source_url,verified,confidence',
      )
      .eq('active', true)
      .order('model'),
  ]);
  const failure = [
    sites.error,
    types.error,
    manufacturers.error,
    statuses.error,
    models.error,
  ].find(Boolean);
  if (failure) throw failure;

  return {
    sites: rows(sites.data ?? [], 'unidades').map((item) => {
      const code = optionalString(item, 'code');
      return {
        id: requiredString(item, 'site.id', 'id'),
        label: requiredString(item, 'site.name', 'name'),
        ...(code ? { code } : {}),
      };
    }),
    assetTypes: rows(types.data ?? [], 'tipos de ativo').map((item) => ({
      id: requiredString(item, 'asset_type.id', 'id'),
      label: requiredString(item, 'asset_type.name', 'name'),
      code: requiredString(item, 'asset_type.code', 'code'),
      domain: asDomain(valueAt(item, 'domain')),
    })),
    manufacturers: rows(manufacturers.data ?? [], 'fabricantes').map((item) => ({
      id: requiredString(item, 'manufacturer.id', 'id'),
      label: requiredString(item, 'manufacturer.name', 'name'),
    })),
    statuses: rows(statuses.data ?? [], 'status de ativo').map((item) => ({
      id: requiredString(item, 'status.id', 'id'),
      label: requiredString(item, 'status.name', 'name'),
      code: requiredString(item, 'status.code', 'code'),
      color: stringOr(item, '#64748B', 'color'),
      semanticState: stringOr(item, 'to_verify', 'semantic_state'),
    })),
    technicalModels: rows(models.data ?? [], 'modelos técnicos').map(normalizeTechnicalModel),
  };
}

function normalizeTechnicalModel(item: UnknownRow): TechnicalModelOption {
  return {
    id: requiredString(item, 'technical_model.id', 'id'),
    label: requiredString(item, 'technical_model.model', 'model'),
    assetTypeId: requiredString(item, 'technical_model.asset_type_id', 'asset_type_id'),
    manufacturerId: requiredString(item, 'technical_model.manufacturer_id', 'manufacturer_id'),
    description: stringOr(item, '', 'description'),
    referenceSpecs: objectValue(item, 'reference_specs'),
    sourceName: optionalString(item, 'source_name'),
    sourceUrl: optionalString(item, 'source_url'),
    verified: boolValue(item, false, 'verified'),
    confidence: stringOr(item, 'unverified', 'confidence'),
  };
}

export async function fetchTechnicalModelDetail(modelId: string): Promise<TechnicalModelDetail> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('technical_models')
    .select(
      'id,asset_type_id,manufacturer_id,model,description,reference_specs,source_name,source_url,verified,confidence,active,created_at,updated_at',
    )
    .eq('id', modelId)
    .single();
  if (error) throw error;
  const modelRow = row(data, 'modelo técnico');
  const base = normalizeTechnicalModel(modelRow);
  const [assetType, manufacturer, installed] = await Promise.all([
    client
      .from('asset_types')
      .select('id,code,name,domain')
      .eq('id', base.assetTypeId)
      .single(),
    client.from('manufacturers').select('id,name').eq('id', base.manufacturerId).single(),
    client
      .from('asset_current_location')
      .select('*')
      .eq('technical_model_id', modelId)
      .order('posture_number', { ascending: true })
      .order('battery_code', { ascending: true, nullsFirst: true })
      .order('position_name', { ascending: true })
      .limit(100),
  ]);
  const failure = [assetType.error, manufacturer.error, installed.error].find(Boolean);
  if (failure) throw failure;

  const assetTypeRow = row(assetType.data, 'tipo de ativo do modelo');
  const manufacturerRow = row(manufacturer.data, 'fabricante do modelo');
  return {
    ...base,
    assetTypeName: requiredString(assetTypeRow, 'asset_type.name', 'name'),
    assetTypeCode: requiredString(assetTypeRow, 'asset_type.code', 'code'),
    domain: asDomain(valueAt(assetTypeRow, 'domain')),
    manufacturerName: requiredString(manufacturerRow, 'manufacturer.name', 'name'),
    active: boolValue(modelRow, true, 'active'),
    createdAt: requiredString(modelRow, 'technical_model.created_at', 'created_at'),
    updatedAt: requiredString(modelRow, 'technical_model.updated_at', 'updated_at'),
    installedAssets: rows(installed.data ?? [], 'ativos instalados do modelo').map(
      normalizeInventoryRow,
    ),
  };
}

async function fetchSignedMedia(assetId: string): Promise<AssetMedia[]> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('asset_media')
    .select('id,media_type,storage_path,thumbnail_path,mime_type,byte_size,caption,created_at')
    .eq('asset_id', assetId)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return Promise.all(
    rows(data ?? [], 'mídias').map(async (item) => {
      const storagePath = requiredString(item, 'asset_media.storage_path', 'storage_path');
      const previewPath = optionalString(item, 'thumbnail_path') ?? storagePath;
      const signed = await client.storage.from('asset-media').createSignedUrl(previewPath, 600);
      return {
        id: requiredString(item, 'asset_media.id', 'id'),
        mediaType: stringOr(item, 'general', 'media_type') as AssetMediaType,
        storagePath,
        caption: stringOr(item, '', 'caption'),
        mimeType: stringOr(item, 'application/octet-stream', 'mime_type'),
        byteSize: optionalNumber(item, 'byte_size') ?? 0,
        createdAt: requiredString(item, 'asset_media.created_at', 'created_at'),
        signedUrl: signed.error ? null : signed.data.signedUrl,
        previewError: signed.error?.message ?? null,
      };
    }),
  );
}

function eventTitle(eventType: string): string {
  const labels: Record<string, string> = {
    created: 'Ativo cadastrado',
    updated: 'Dados do ativo atualizados',
    installed: 'Ativo instalado',
    removed: 'Ativo removido',
    replaced: 'Ativo substituído',
    maintenance: 'Manutenção registrada',
    work_order: 'Ordem de Serviço vinculada',
    archived: 'Ativo arquivado',
    reviewed: 'Dados técnicos revisados',
  };
  return labels[eventType] ?? 'Evento técnico';
}

function eventDescription(eventType: string, details: Record<string, unknown>): string {
  const reason = typeof details.reason === 'string' ? details.reason : null;
  const notes = typeof details.notes === 'string' ? details.notes : null;
  const fields = Array.isArray(details.fields)
    ? details.fields.filter((item): item is string => typeof item === 'string').join(', ')
    : null;
  if (reason && notes) return `${reason} — ${notes}`;
  if (reason) return reason;
  if (notes) return notes;
  if (fields) return `Campos alterados: ${fields}.`;
  if (eventType === 'created') return 'O registro físico foi criado no inventário.';
  return 'Evento preservado no histórico técnico.';
}

async function fetchTimeline(assetId: string): Promise<AssetTimelineItem[]> {
  const client = requireSupabaseClient();
  const [events, workOrders] = await Promise.all([
    client
      .from('asset_events')
      .select('id,event_type,occurred_at,work_order_id,details')
      .eq('asset_id', assetId)
      .order('occurred_at', { ascending: false }),
    client
      .from('work_orders')
      .select('id,number,description,opened_at')
      .eq('asset_id', assetId)
      .order('opened_at', { ascending: false }),
  ]);
  if (events.error) throw events.error;
  if (workOrders.error) throw workOrders.error;

  const items: AssetTimelineItem[] = rows(events.data ?? [], 'eventos do ativo').map((item) => {
    const eventType = stringOr(item, 'updated', 'event_type');
    return {
      id: requiredString(item, 'asset_event.id', 'id'),
      kind: 'asset_event',
      eventType,
      occurredAt: requiredString(item, 'asset_event.occurred_at', 'occurred_at'),
      title: eventTitle(eventType),
      description: eventDescription(eventType, objectValue(item, 'details')),
      workOrderId: optionalString(item, 'work_order_id'),
      workOrderNumber: null,
    };
  });

  for (const item of rows(workOrders.data ?? [], 'ordens do ativo')) {
    const number = optionalNumber(item, 'number');
    items.push({
      id: `work-order-${requiredString(item, 'work_order.id', 'id')}`,
      kind: 'work_order',
      eventType: 'work_order',
      occurredAt: requiredString(item, 'work_order.opened_at', 'opened_at'),
      title: number === null ? 'Ordem de Serviço' : `OS #${number.toLocaleString('pt-BR')}`,
      description: stringOr(item, 'Intervenção vinculada ao ativo.', 'description'),
      workOrderId: requiredString(item, 'work_order.id', 'id'),
      workOrderNumber: number,
    });
  }
  return items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

async function fetchInstallations(assetId: string): Promise<AssetInstallation[]> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('asset_installations')
    .select(
      'id,asset_position_id,installed_at,removed_at,installation_reason,removal_reason,work_order_id',
    )
    .eq('asset_id', assetId)
    .order('installed_at', { ascending: false });
  if (error) throw error;
  const installationRows = rows(data ?? [], 'instalações');
  const positionIds = [
    ...new Set(
      installationRows.map((item) =>
        requiredString(item, 'asset_position_id', 'asset_position_id'),
      ),
    ),
  ];
  if (!positionIds.length) return [];
  const { data: positionsData, error: positionsError } = await client
    .from('asset_positions')
    .select('id,name,posture_id,battery_id')
    .in('id', positionIds);
  if (positionsError) throw positionsError;
  const positions = new Map(
    rows(positionsData ?? [], 'posições').map((item) => [
      requiredString(item, 'position.id', 'id'),
      item,
    ]),
  );
  const postureIds = [
    ...new Set(
      [...positions.values()].map((item) => requiredString(item, 'posture_id', 'posture_id')),
    ),
  ];
  const batteryIds = [
    ...new Set(
      [...positions.values()].map((item) => optionalString(item, 'battery_id')).filter(Boolean),
    ),
  ] as string[];
  const [posturesResult, batteriesResult] = await Promise.all([
    client.from('postures').select('id,number').in('id', postureIds),
    batteryIds.length
      ? client.from('batteries').select('id,code').in('id', batteryIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (posturesResult.error) throw posturesResult.error;
  if (batteriesResult.error) throw batteriesResult.error;
  const postureNumbers = new Map(
    rows(posturesResult.data ?? [], 'posturas').map((item) => [
      requiredString(item, 'posture.id', 'id'),
      optionalNumber(item, 'number'),
    ]),
  );
  const batteryCodes = new Map(
    rows(batteriesResult.data ?? [], 'baterias').map((item) => [
      requiredString(item, 'battery.id', 'id'),
      optionalString(item, 'code'),
    ]),
  );
  return installationRows.map((item) => {
    const positionId = requiredString(item, 'asset_position_id', 'asset_position_id');
    const position = positions.get(positionId);
    const postureId = position ? requiredString(position, 'posture_id', 'posture_id') : '';
    const batteryId = position ? optionalString(position, 'battery_id') : null;
    return {
      id: requiredString(item, 'installation.id', 'id'),
      assetPositionId: positionId,
      positionName: position ? stringOr(position, 'Posição técnica', 'name') : 'Posição técnica',
      postureNumber: postureNumbers.get(postureId) ?? null,
      batteryCode: batteryId ? (batteryCodes.get(batteryId) ?? null) : null,
      installedAt: requiredString(item, 'installation.installed_at', 'installed_at'),
      removedAt: optionalString(item, 'removed_at'),
      installationReason: stringOr(item, '', 'installation_reason'),
      removalReason: optionalString(item, 'removal_reason'),
      workOrderId: optionalString(item, 'work_order_id'),
    };
  });
}

async function fetchSpecificSpecs(assetId: string, typeCode: string): Promise<AssetSpecificSpecs> {
  if (typeCode !== 'motor' && typeCode !== 'reducer') return { kind: 'none', values: {} };
  const table = typeCode === 'motor' ? 'asset_motor_specs' : 'asset_reducer_specs';
  const { data, error } = await requireSupabaseClient()
    .from(table)
    .select('*')
    .eq('asset_id', assetId)
    .maybeSingle();
  if (error) throw error;
  return { kind: typeCode, values: data ? row(data, 'especificações técnicas') : {} };
}

export async function fetchAssetDetail(assetId: string): Promise<AssetDetail> {
  const client = requireSupabaseClient();
  const { data: assetData, error: assetError } = await client
    .from('assets')
    .select('*')
    .eq('id', assetId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!assetData) throw new Error('Ativo não encontrado ou não permitido para este usuário.');
  const asset = row(assetData, 'ativo');

  const assetTypeId = requiredString(asset, 'asset_type_id', 'asset_type_id');
  const manufacturerId = optionalString(asset, 'manufacturer_id');
  const technicalModelId = optionalString(asset, 'technical_model_id');
  const statusId = requiredString(asset, 'status_id', 'status_id');
  const [
    typeResult,
    manufacturerResult,
    modelResult,
    statusResult,
    completenessResult,
    locationResult,
  ] = await Promise.all([
    client.from('asset_types').select('id,code,name,domain').eq('id', assetTypeId).single(),
    manufacturerId
      ? client.from('manufacturers').select('id,name').eq('id', manufacturerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    technicalModelId
      ? client
          .from('technical_models')
          .select(
            'id,asset_type_id,manufacturer_id,model,description,reference_specs,source_name,source_url,verified,confidence',
          )
          .eq('id', technicalModelId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client
      .from('asset_status_definitions')
      .select('id,code,name,color')
      .eq('id', statusId)
      .single(),
    client
      .from('asset_completeness')
      .select('asset_id,completeness_percent,missing_fields')
      .eq('asset_id', assetId)
      .maybeSingle(),
    client.from('asset_current_location').select('*').eq('asset_id', assetId).maybeSingle(),
  ]);
  const failure = [
    typeResult.error,
    manufacturerResult.error,
    modelResult.error,
    statusResult.error,
    completenessResult.error,
    locationResult.error,
  ].find(Boolean);
  if (failure) throw failure;
  const type = row(typeResult.data, 'tipo do ativo');
  const status = row(statusResult.data, 'status do ativo');
  const typeCode = requiredString(type, 'asset_type.code', 'code');

  const [specificSpecs, media, installations, timeline] = await Promise.all([
    fetchSpecificSpecs(assetId, typeCode),
    fetchSignedMedia(assetId),
    fetchInstallations(assetId),
    fetchTimeline(assetId),
  ]);
  const completeness = completenessResult.data ? row(completenessResult.data, 'completude') : {};
  const model = modelResult.data
    ? normalizeTechnicalModel(row(modelResult.data, 'modelo técnico'))
    : null;
  const manufacturer = manufacturerResult.data ? row(manufacturerResult.data, 'fabricante') : null;

  return {
    id: requiredString(asset, 'asset.id', 'id'),
    siteId: requiredString(asset, 'site_id', 'site_id'),
    assetTypeId,
    assetTypeCode: typeCode,
    assetTypeName: requiredString(type, 'asset_type.name', 'name'),
    domain: asDomain(valueAt(type, 'domain')),
    manufacturerId,
    manufacturerName: manufacturer
      ? requiredString(manufacturer, 'manufacturer.name', 'name')
      : null,
    technicalModelId,
    technicalModel: model,
    statusId,
    statusName: requiredString(status, 'status.name', 'name'),
    statusCode: requiredString(status, 'status.code', 'code'),
    statusColor: stringOr(status, '#64748B', 'color'),
    internalCode: optionalString(asset, 'internal_code'),
    serialNumber: optionalString(asset, 'serial_number'),
    manufacturedOn: optionalString(asset, 'manufactured_on'),
    criticality: asCriticality(valueAt(asset, 'criticality')),
    nameplateSpecs: objectValue(asset, 'nameplate_specs'),
    notes: stringOr(asset, '', 'notes'),
    dataSource: asDataSource(valueAt(asset, 'data_source')),
    dataReviewedAt: optionalString(asset, 'data_reviewed_at'),
    archivedAt: optionalString(asset, 'archived_at'),
    createdAt: requiredString(asset, 'created_at', 'created_at'),
    updatedAt: requiredString(asset, 'updated_at', 'updated_at'),
    completenessPercent: optionalNumber(completeness, 'completeness_percent'),
    missingFields: stringArray(completeness, 'missing_fields'),
    currentLocation: locationResult.data ? normalizeInventoryRow(locationResult.data) : null,
    specificSpecs,
    media,
    installations,
    timeline,
  };
}

function parseNameplateText(value: string): Record<string, string> {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((result, line) => {
      const separator = line.includes(':') ? ':' : '=';
      const index = line.indexOf(separator);
      if (index <= 0) return result;
      const key = line.slice(0, index).trim();
      const itemValue = line.slice(index + 1).trim();
      if (key && itemValue) result[key] = itemValue;
      return result;
    }, {});
}

function compactSpecs(specs: Record<string, string>): Record<string, string | number | string[]> {
  const numericKeys = new Set([
    'rated_power_kw',
    'rated_power_cv',
    'frequency_hz',
    'rpm',
    'poles',
    'efficiency_percent',
    'power_factor',
    'ratio',
    'input_rpm',
    'output_rpm',
    'torque_nm',
    'oil_quantity_l',
  ]);
  return Object.fromEntries(
    Object.entries(specs)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => {
        if (key === 'voltage_v' || key === 'current_a') {
          return [
            key,
            value
              .split(/[,;/]/)
              .map((part) => part.trim())
              .filter(Boolean),
          ];
        }
        return [key, numericKeys.has(key) ? Number(value.replace(',', '.')) : value.trim()];
      }),
  );
}

export async function createAsset(values: AssetFormValues): Promise<{ id: string }> {
  const client = requireSupabaseClient();
  const { data, error } = await client.rpc('create_physical_asset', {
    p_site_id: values.siteId,
    p_asset_type_id: values.assetTypeId,
    p_manufacturer_id: values.manufacturerId || null,
    p_technical_model_id: values.technicalModelId || null,
    p_internal_code: values.internalCode || null,
    p_serial_number: values.serialNumber || null,
    p_criticality: values.criticality,
    p_nameplate_specs: parseNameplateText(values.nameplateText),
    p_notes: values.notes,
    p_data_source: values.dataSource,
  });
  if (error) throw error;
  const created = row(data, 'ativo criado');
  const id = requiredString(created, 'asset.id', 'id');
  if (Object.values(values.specs).some((value) => value.trim())) {
    const specsResult = await client.rpc('save_asset_technical_specs', {
      p_asset_id: id,
      p_specs: compactSpecs(values.specs),
    });
    if (specsResult.error) throw specsResult.error;
  }
  if (values.manufacturedOn) {
    const updatedAt = requiredString(created, 'asset.updated_at', 'updated_at');
    const manufactured = await client.rpc('update_physical_asset', {
      p_asset_id: id,
      p_patch: { manufactured_on: values.manufacturedOn },
      p_expected_updated_at: updatedAt,
    });
    if (manufactured.error) throw manufactured.error;
  }
  return { id };
}

export async function updateAsset(asset: AssetDetail, values: AssetFormValues): Promise<void> {
  const client = requireSupabaseClient();
  const patch = {
    manufacturer_id: values.manufacturerId || null,
    technical_model_id: values.technicalModelId || null,
    status_id: values.statusId,
    internal_code: values.internalCode || null,
    serial_number: values.serialNumber || null,
    manufactured_on: values.manufacturedOn || null,
    criticality: values.criticality,
    nameplate_specs: parseNameplateText(values.nameplateText),
    notes: values.notes,
    data_source: values.dataSource,
  };
  const { error } = await client.rpc('update_physical_asset', {
    p_asset_id: asset.id,
    p_patch: patch,
    p_expected_updated_at: asset.updatedAt,
  });
  if (error) throw error;
  if (asset.assetTypeCode === 'motor' || asset.assetTypeCode === 'reducer') {
    const specsResult = await client.rpc('save_asset_technical_specs', {
      p_asset_id: asset.id,
      p_specs: compactSpecs(values.specs),
    });
    if (specsResult.error) throw specsResult.error;
  }
}

export async function fetchAvailablePositions(
  siteId: string,
  assetTypeId: string,
): Promise<AssetPositionOption[]> {
  const client = requireSupabaseClient();
  const [positions, occupied, postures, batteries] = await Promise.all([
    fetchAllRows(
      (from, to) =>
        client
          .from('asset_positions')
          .select('id,site_id,posture_id,battery_id,code,name,asset_type_id,domain')
          .eq('site_id', siteId)
          .eq('active', true)
          .or(`asset_type_id.eq.${assetTypeId},asset_type_id.is.null`)
          .order('id')
          .range(from, to),
      'posições disponíveis',
    ),
    fetchAllRows(
      (from, to) =>
        client
          .from('asset_installations')
          .select('asset_position_id')
          .is('removed_at', null)
          .order('asset_position_id')
          .range(from, to),
      'posições ocupadas',
    ),
    client.from('postures').select('id,number').eq('site_id', siteId).eq('active', true),
    client.from('batteries').select('id,code').eq('active', true),
  ]);
  const failure = [postures.error, batteries.error].find(Boolean);
  if (failure) throw failure;
  const occupiedIds = new Set(
    occupied.map((item) =>
      requiredString(item, 'asset_position_id', 'asset_position_id'),
    ),
  );
  const postureNumbers = new Map(
    rows(postures.data ?? [], 'posturas').map((item) => [
      requiredString(item, 'posture.id', 'id'),
      optionalNumber(item, 'number') ?? 0,
    ]),
  );
  const batteryCodes = new Map(
    rows(batteries.data ?? [], 'baterias').map((item) => [
      requiredString(item, 'battery.id', 'id'),
      optionalString(item, 'code'),
    ]),
  );
  return positions
    .filter((item) => !occupiedIds.has(requiredString(item, 'position.id', 'id')))
    .map((item) => {
      const batteryId = optionalString(item, 'battery_id');
      return {
        id: requiredString(item, 'position.id', 'id'),
        siteId: requiredString(item, 'position.site_id', 'site_id'),
        postureNumber:
          postureNumbers.get(requiredString(item, 'position.posture_id', 'posture_id')) ?? 0,
        batteryCode: batteryId ? (batteryCodes.get(batteryId) ?? null) : null,
        code: requiredString(item, 'position.code', 'code'),
        name: requiredString(item, 'position.name', 'name'),
        assetTypeId: optionalString(item, 'asset_type_id'),
        domain: asDomain(valueAt(item, 'domain')),
      };
    })
    .sort(
      (a, b) =>
        a.postureNumber - b.postureNumber ||
        (a.batteryCode ?? '').localeCompare(b.batteryCode ?? '') ||
        a.name.localeCompare(b.name),
    );
}

export async function installAsset(input: {
  assetId: string;
  assetPositionId: string;
  installedAt: string;
  reason: string;
}): Promise<void> {
  const { error } = await requireSupabaseClient().rpc('install_asset', {
    p_asset_id: input.assetId,
    p_asset_position_id: input.assetPositionId,
    p_installed_at: new Date(input.installedAt).toISOString(),
    p_reason: input.reason,
    p_work_order_id: null,
  });
  if (error) throw error;
}

export async function removeAsset(input: {
  installationId: string;
  removedAt: string;
  reason: string;
  notes: string;
}): Promise<void> {
  const { error } = await requireSupabaseClient().rpc('remove_asset', {
    p_installation_id: input.installationId,
    p_removed_at: new Date(input.removedAt).toISOString(),
    p_reason: input.reason,
    p_work_order_id: null,
    p_notes: input.notes,
    p_confirmation: 'REMOVER',
  });
  if (error) throw error;
}

export async function fetchReplacementAssets(
  siteId: string,
  assetTypeId: string,
  currentAssetId: string,
): Promise<ReplacementAssetOption[]> {
  const client = requireSupabaseClient();
  const [assets, activeInstallations, catalogs] = await Promise.all([
    fetchAllRows(
      (from, to) =>
        client
          .from('assets')
          .select('id,manufacturer_id,technical_model_id,internal_code,serial_number')
          .eq('site_id', siteId)
          .eq('asset_type_id', assetTypeId)
          .is('archived_at', null)
          .neq('id', currentAssetId)
          .order('id')
          .range(from, to),
      'ativos de substituição',
    ),
    fetchAllRows(
      (from, to) =>
        client
          .from('asset_installations')
          .select('asset_id')
          .is('removed_at', null)
          .order('asset_id')
          .range(from, to),
      'ativos instalados',
    ),
    fetchAssetCatalogs([siteId]),
  ]);
  const installed = new Set(
    activeInstallations.map((item) => requiredString(item, 'asset_id', 'asset_id')),
  );
  const manufacturerNames = new Map(catalogs.manufacturers.map((item) => [item.id, item.label]));
  const modelNames = new Map(catalogs.technicalModels.map((item) => [item.id, item.label]));
  return assets
    .filter((item) => !installed.has(requiredString(item, 'asset.id', 'id')))
    .map((item) => {
      const id = requiredString(item, 'asset.id', 'id');
      const manufacturer = optionalString(item, 'manufacturer_id');
      const model = optionalString(item, 'technical_model_id');
      const identity =
        optionalString(item, 'internal_code') ??
        optionalString(item, 'serial_number') ??
        id.slice(0, 8);
      return {
        id,
        label: [
          manufacturer ? manufacturerNames.get(manufacturer) : null,
          model ? modelNames.get(model) : null,
          identity,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    });
}

export async function replaceAsset(input: {
  currentInstallationId: string;
  newAssetId: string;
  replacedAt: string;
  reason: string;
  notes: string;
}): Promise<void> {
  const { error } = await requireSupabaseClient().rpc('replace_asset', {
    p_current_installation_id: input.currentInstallationId,
    p_new_asset_id: input.newAssetId,
    p_replaced_at: new Date(input.replacedAt).toISOString(),
    p_reason: input.reason,
    p_work_order_id: null,
    p_notes: input.notes,
  });
  if (error) throw error;
}

export async function uploadAssetMedia(input: {
  assetId: string;
  siteId: string;
  file: File;
  mediaType: 'general' | 'nameplate';
  caption: string;
}): Promise<void> {
  const client = requireSupabaseClient();
  const prepared = await imageToWebp(input.file);
  if (prepared.blob.size > 25 * 1024 * 1024)
    throw new Error('A imagem otimizada excedeu o limite de 25 MB.');
  const path = `${input.siteId}/${input.assetId}/${crypto.randomUUID()}.webp`;
  const upload = await client.storage.from('asset-media').upload(path, prepared.blob, {
    contentType: 'image/webp',
    cacheControl: '3600',
    upsert: false,
  });
  if (upload.error) throw upload.error;
  const checksum = await sha256(prepared.blob);
  const registration = await client.rpc('register_asset_media', {
    p_asset_id: input.assetId,
    p_media_type: input.mediaType,
    p_storage_path: path,
    p_thumbnail_path: null,
    p_mime_type: 'image/webp',
    p_byte_size: prepared.blob.size,
    p_width: prepared.width,
    p_height: prepared.height,
    p_checksum_sha256: checksum,
    p_caption: input.caption,
    p_taken_at: null,
  });
  if (registration.error) {
    await client.storage.from('asset-media').remove([path]);
    throw registration.error;
  }
}

export async function archiveAssetMedia(mediaId: string): Promise<void> {
  const { error } = await requireSupabaseClient().rpc('archive_asset_media', {
    p_media_id: mediaId,
    p_confirmation: 'ARQUIVAR',
  });
  if (error) throw error;
}

export function assetDetailToFormValues(asset: AssetDetail): AssetFormValues {
  const specs = Object.fromEntries(
    Object.entries(asset.specificSpecs.values)
      .filter(([key]) => key !== 'asset_id' && key !== 'updated_at')
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value),
      ]),
  );
  return {
    siteId: asset.siteId,
    assetTypeId: asset.assetTypeId,
    manufacturerId: asset.manufacturerId ?? '',
    technicalModelId: asset.technicalModelId ?? '',
    statusId: asset.statusId,
    internalCode: asset.internalCode ?? '',
    serialNumber: asset.serialNumber ?? '',
    manufacturedOn: asset.manufacturedOn ?? '',
    criticality: asset.criticality,
    dataSource: asset.dataSource,
    notes: asset.notes,
    nameplateText: Object.entries(asset.nameplateSpecs)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
      .join('\n'),
    specs,
  };
}
