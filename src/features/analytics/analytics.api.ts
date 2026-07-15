import { z } from 'zod';
import { requireSupabaseClient } from '../../lib/supabase';
import type {
  AnalyticsCatalogItem,
  AnalyticsCatalogs,
  AnalyticsData,
  AnalyticsFilters,
  AnalyticsPeriod,
  ChartDatum,
  PostureAnalyticsRow,
  TrendDatum,
} from './analytics.types';

const catalogSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  color: z.string().default('#939aa5'),
});

const postureSummarySchema = z.object({
  posture_id: z.string().uuid().nullable(),
  posture_number: z.coerce.number().nullable(),
  posture_name: z.string().nullable(),
  installed_assets: z.coerce.number(),
  inventory_completeness: z.coerce.number(),
  open_work_orders: z.coerce.number(),
  critical_open_work_orders: z.coerce.number(),
  failure_count: z.coerce.number(),
  recurrent_assets: z.coerce.number(),
});

const periodDays: Record<Exclude<AnalyticsPeriod, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
};

export const periodLabels: Record<AnalyticsPeriod, string> = {
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  '180d': 'Últimos 180 dias',
  '365d': 'Últimos 12 meses',
  all: 'Todo o histórico',
};

export async function fetchAnalyticsCatalogs(): Promise<AnalyticsCatalogs> {
  const client = requireSupabaseClient();
  const [sectors, statuses, priorities, assetTypes, manufacturers, postures, recurrence] =
    await Promise.all([
      client.from('sectors').select('id,code,name,color').eq('active', true).order('sort_order'),
      client
        .from('work_order_status_definitions')
        .select('id,code,name,color,semantic_state,is_terminal')
        .eq('active', true)
        .order('sort_order'),
      client
        .from('priority_definitions')
        .select('id,code,name,color,weight')
        .eq('active', true)
        .order('weight'),
      client.from('asset_types').select('id,code,name,domain').eq('active', true).order('name'),
      client.from('manufacturers').select('id,name').eq('active', true).order('name'),
      client.from('postures').select('id,number,name').eq('active', true).order('number'),
      client.from('app_settings').select('value').eq('key', 'analytics.recurrence').maybeSingle(),
    ]);

  const firstError = [
    sectors.error,
    statuses.error,
    priorities.error,
    assetTypes.error,
    manufacturers.error,
    postures.error,
    recurrence.error,
  ].find(Boolean);
  if (firstError) throw firstError;

  const recurrenceValue = z
    .object({
      count: z.coerce.number().int().positive(),
      window_days: z.coerce.number().int().positive(),
    })
    .catch({ count: 3, window_days: 30 })
    .parse(recurrence.data?.value);

  return {
    sectors: z
      .array(catalogSchema)
      .parse(sectors.data ?? [])
      .map(toCatalogItem),
    statuses: z
      .array(catalogSchema.extend({ semantic_state: z.string(), is_terminal: z.boolean() }))
      .parse(statuses.data ?? [])
      .map((item) => ({
        ...toCatalogItem(item),
        semanticState: item.semantic_state,
        terminal: item.is_terminal,
      })),
    priorities: z
      .array(catalogSchema.extend({ weight: z.coerce.number() }))
      .parse(priorities.data ?? [])
      .map((item) => ({ ...toCatalogItem(item), weight: item.weight })),
    assetTypes: z
      .array(
        z.object({ id: z.string().uuid(), code: z.string(), name: z.string(), domain: z.string() }),
      )
      .parse(assetTypes.data ?? [])
      .map((item) => ({
        id: item.id,
        code: item.code,
        label: item.name,
        color: domainColor(item.domain),
        domain: item.domain,
      })),
    manufacturers: z
      .array(z.object({ id: z.string().uuid(), name: z.string() }))
      .parse(manufacturers.data ?? [])
      .map((item) => ({ id: item.id, label: item.name })),
    postures: z
      .array(z.object({ id: z.string().uuid(), number: z.coerce.number(), name: z.string() }))
      .parse(postures.data ?? [])
      .map((item) => ({ id: item.id, number: item.number, label: item.name })),
    recurrence: { count: recurrenceValue.count, windowDays: recurrenceValue.window_days },
  };
}

function toCatalogItem(item: z.infer<typeof catalogSchema>): AnalyticsCatalogItem {
  return { id: item.id, code: item.code, label: item.name, color: item.color };
}

function domainColor(domain: string) {
  if (domain === 'electrical') return 'var(--color-info)';
  if (domain === 'mechanical') return 'var(--color-warning)';
  return 'var(--color-icon)';
}

export async function fetchAnalyticsData(
  filters: AnalyticsFilters,
  catalogs: AnalyticsCatalogs,
): Promise<AnalyticsData> {
  const start = getPeriodStart(filters.period);
  const trendBuckets = buildTrendBuckets(filters.period);

  const [
    workOrders,
    openWorkOrders,
    criticalOpenWorkOrders,
    overdueWorkOrders,
    resolvedWorkOrders,
    waitingPartWorkOrders,
    replacements,
    assets,
    installedAssets,
    uninstalledAssets,
    incompleteAssets,
    missingNameplate,
    postureRowsRaw,
  ] = await Promise.all([
    countWorkOrders(filters, start),
    countWorkOrders(filters, start, { isTerminal: false }),
    countWorkOrders(filters, start, { isTerminal: false, priorityCode: 'critical' }),
    countWorkOrders(filters, start, { isOverdue: true }),
    countWorkOrders(filters, start, { semanticState: 'resolved' }),
    countWorkOrders(filters, start, { semanticState: 'waiting_part' }),
    countReplacements(start),
    countAssets(filters),
    countAssets(filters, { installation: 'installed' }),
    countAssets(filters, { installation: 'uninstalled' }),
    countAssets(filters, { incomplete: true }),
    countAssets(filters, { missingNameplate: true }),
    fetchPostureRows(filters.postureNumber),
  ]);

  const [
    workOrdersByStatus,
    workOrdersByPriority,
    workOrdersBySector,
    workOrderTrend,
    inventoryByType,
  ] = await Promise.all([
    mapWithConcurrency(catalogs.statuses, 6, async (item): Promise<ChartDatum> => ({
      key: item.code,
      label: item.label,
      value: await countWorkOrders(filters, start, { statusCode: item.code }),
      color: item.color,
    })),
    mapWithConcurrency(catalogs.priorities, 6, async (item): Promise<ChartDatum> => ({
      key: item.code,
      label: item.label,
      value: await countWorkOrders(filters, start, { priorityCode: item.code }),
      color: item.color,
    })),
    mapWithConcurrency(
      catalogs.sectors.filter((item) => !filters.sectorCode || item.code === filters.sectorCode),
      6,
      async (item): Promise<ChartDatum> => ({
        key: item.code,
        label: item.label,
        value: await countWorkOrders({ ...filters, sectorCode: '' }, start, {
          sectorCode: item.code,
        }),
        color: item.color,
      }),
    ),
    mapWithConcurrency(trendBuckets, 4, async (bucket): Promise<TrendDatum> => ({
      ...bucket,
      value: await countWorkOrders(filters, bucket.start, { before: bucket.end }),
    })),
    mapWithConcurrency(catalogs.assetTypes, 6, async (item): Promise<ChartDatum> => ({
      key: item.code,
      label: item.label,
      value: await countAssets(filters, { assetTypeId: item.id }),
      color: item.color,
    })),
  ]);

  const manufacturerAssetCounts = await mapWithConcurrency(
    catalogs.manufacturers,
    6,
    async (item) => ({
      ...item,
      installedAssets: await countAssets(filters, {
        manufacturerId: item.id,
        installation: 'installed',
      }),
    }),
  );
  const manufacturersWithAssets = manufacturerAssetCounts.filter(
    (item) => item.installedAssets > 0,
  );
  const manufacturerRows = await mapWithConcurrency(manufacturersWithAssets, 6, async (item) => {
    const manufacturerWorkOrders = await countWorkOrders(filters, start, {
      manufacturerName: item.label,
    });
    return {
      id: item.id,
      label: item.label,
      installedAssets: item.installedAssets,
      workOrders: manufacturerWorkOrders,
      failuresPerAsset:
        item.installedAssets > 0 ? manufacturerWorkOrders / item.installedAssets : 0,
    };
  });

  const installedForAverage = postureRowsRaw.reduce((total, row) => total + row.installedAssets, 0);
  const weightedCompleteness = postureRowsRaw.reduce(
    (total, row) => total + row.inventoryCompleteness * row.installedAssets,
    0,
  );

  return {
    generatedAt: new Date().toISOString(),
    reportWindowLabel: periodLabels[filters.period],
    trendWindowLabel: filters.period === 'all' ? 'Últimos 12 meses' : periodLabels[filters.period],
    maintenance: {
      workOrders,
      openWorkOrders,
      criticalOpenWorkOrders,
      overdueWorkOrders,
      resolvedWorkOrders,
      waitingPartWorkOrders,
      replacements,
    },
    inventory: {
      assets,
      installedAssets,
      uninstalledAssets,
      incompleteAssets,
      missingNameplate,
      averageCompleteness:
        installedForAverage > 0
          ? Math.round((weightedCompleteness / installedForAverage) * 10) / 10
          : 0,
    },
    workOrdersByStatus: workOrdersByStatus.filter((item) => item.value > 0),
    workOrdersByPriority: workOrdersByPriority.filter((item) => item.value > 0),
    workOrdersBySector: workOrdersBySector.filter((item) => item.value > 0),
    workOrderTrend,
    inventoryByType: inventoryByType
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value),
    postureRows: postureRowsRaw.sort(
      (a, b) =>
        b.openWorkOrders - a.openWorkOrders || b.failures - a.failures || a.number - b.number,
    ),
    manufacturerRows: manufacturerRows.sort(
      (a, b) => b.failuresPerAsset - a.failuresPerAsset || b.workOrders - a.workOrders,
    ),
    recurrence: catalogs.recurrence,
  };
}

interface WorkOrderCountOptions {
  statusCode?: string;
  semanticState?: string;
  priorityCode?: string;
  sectorCode?: string;
  manufacturerName?: string;
  isTerminal?: boolean;
  isOverdue?: boolean;
  before?: string;
}

async function countWorkOrders(
  filters: AnalyticsFilters,
  start: string | null,
  options: WorkOrderCountOptions = {},
) {
  let query = requireSupabaseClient()
    .from('work_order_summary')
    .select('work_order_id', { head: true, count: 'exact' });

  if (start) query = query.gte('opened_at', start);
  if (options.before) query = query.lt('opened_at', options.before);
  const sectorCode = options.sectorCode ?? filters.sectorCode;
  if (sectorCode) query = query.eq('sector_code', sectorCode);
  if (filters.postureNumber !== null) query = query.eq('posture_number', filters.postureNumber);
  if (options.statusCode) query = query.eq('status_code', options.statusCode);
  if (options.semanticState) query = query.eq('semantic_state', options.semanticState);
  if (options.priorityCode) query = query.eq('priority_code', options.priorityCode);
  if (options.manufacturerName) query = query.eq('manufacturer_name', options.manufacturerName);
  if (options.isTerminal !== undefined) query = query.eq('is_terminal', options.isTerminal);
  if (options.isOverdue !== undefined) query = query.eq('is_overdue', options.isOverdue);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

interface AssetCountOptions {
  installation?: 'installed' | 'uninstalled';
  incomplete?: boolean;
  missingNameplate?: boolean;
  assetTypeId?: string;
  manufacturerId?: string;
}

async function countAssets(filters: AnalyticsFilters, options: AssetCountOptions = {}) {
  if (options.installation === 'uninstalled') return 0;

  const { data, error } = await requireSupabaseClient().rpc('list_inventory_assets', {
    p_page: 1,
    p_page_size: 1,
    p_asset_type_id: options.assetTypeId ?? null,
    p_manufacturer_id: options.manufacturerId ?? null,
    p_posture_number: filters.postureNumber,
    p_completeness: options.incomplete
      ? 'incomplete'
      : options.missingNameplate
        ? 'missing_nameplate'
        : 'all',
    p_search: '',
  });
  if (error) throw error;
  const first = Array.isArray(data) ? data[0] : null;
  const value =
    first && typeof first === 'object' && 'total_count' in first
      ? Number((first as { total_count: unknown }).total_count)
      : 0;
  return Number.isFinite(value) ? value : 0;
}

async function countReplacements(start: string | null) {
  let query = requireSupabaseClient()
    .from('asset_replacements')
    .select('id', { head: true, count: 'exact' });
  if (start) query = query.gte('replaced_at', start);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function fetchPostureRows(postureNumber: number | null): Promise<PostureAnalyticsRow[]> {
  const { data, error } = await requireSupabaseClient().rpc('list_analytics_posture_rows', {
    p_posture_number: postureNumber,
  });
  if (error) throw error;
  return z
    .array(postureSummarySchema)
    .parse(data ?? [])
    .flatMap((row) =>
      row.posture_id && row.posture_number !== null
        ? [
            {
              id: row.posture_id,
              number: row.posture_number,
              label: row.posture_name ?? `Postura ${row.posture_number}`,
              openWorkOrders: row.open_work_orders,
              criticalWorkOrders: row.critical_open_work_orders,
              failures: row.failure_count,
              recurrentAssets: row.recurrent_assets,
              inventoryCompleteness: row.inventory_completeness,
              installedAssets: row.installed_assets,
            },
          ]
        : [],
    );
}

function getPeriodStart(period: AnalyticsPeriod): string | null {
  if (period === 'all') return null;
  return new Date(Date.now() - periodDays[period] * 86_400_000).toISOString();
}

function buildTrendBuckets(period: AnalyticsPeriod): Omit<TrendDatum, 'value'>[] {
  const effectiveDays = period === 'all' ? 365 : periodDays[period];
  const bucketCount = effectiveDays <= 7 ? 7 : effectiveDays <= 180 ? 6 : 12;
  const bucketMs = (effectiveDays * 86_400_000) / bucketCount;
  const end = Date.now();
  const formatter = new Intl.DateTimeFormat(
    'pt-BR',
    bucketCount === 12 ? { month: 'short' } : { day: '2-digit', month: '2-digit' },
  );
  return Array.from({ length: bucketCount }, (_, index) => {
    const startDate = new Date(end - bucketMs * (bucketCount - index));
    const endDate = new Date(end - bucketMs * (bucketCount - index - 1));
    return {
      key: `${startDate.toISOString()}-${endDate.toISOString()}`,
      label: formatter.format(startDate).replace('.', ''),
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };
  });
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      const item = items[index];
      if (item !== undefined) results[index] = await worker(item, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}
