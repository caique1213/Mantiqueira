export type AnalyticsPeriod = '7d' | '30d' | '90d' | '180d' | '365d' | 'all';

export interface AnalyticsFilters {
  period: AnalyticsPeriod;
  sectorCode: string;
  postureNumber: number | null;
}

export interface AnalyticsCatalogItem {
  id: string;
  code: string;
  label: string;
  color: string;
}

export interface AnalyticsCatalogs {
  sectors: AnalyticsCatalogItem[];
  statuses: (AnalyticsCatalogItem & { semanticState: string; terminal: boolean })[];
  priorities: (AnalyticsCatalogItem & { weight: number })[];
  assetTypes: (AnalyticsCatalogItem & { domain: string })[];
  manufacturers: { id: string; label: string }[];
  postures: { id: string; number: number; label: string }[];
  recurrence: { count: number; windowDays: number };
}

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface TrendDatum {
  key: string;
  label: string;
  value: number;
  start: string;
  end: string;
}

export interface PostureAnalyticsRow {
  id: string;
  number: number;
  label: string;
  openWorkOrders: number;
  criticalWorkOrders: number;
  failures: number;
  recurrentAssets: number;
  inventoryCompleteness: number;
  installedAssets: number;
}

export interface ManufacturerAnalyticsRow {
  id: string;
  label: string;
  installedAssets: number;
  workOrders: number;
  failuresPerAsset: number;
}

export interface AnalyticsData {
  generatedAt: string;
  reportWindowLabel: string;
  trendWindowLabel: string;
  maintenance: {
    workOrders: number;
    openWorkOrders: number;
    criticalOpenWorkOrders: number;
    overdueWorkOrders: number;
    resolvedWorkOrders: number;
    waitingPartWorkOrders: number;
    replacements: number;
  };
  inventory: {
    assets: number;
    installedAssets: number;
    uninstalledAssets: number;
    incompleteAssets: number;
    missingNameplate: number;
    averageCompleteness: number;
  };
  workOrdersByStatus: ChartDatum[];
  workOrdersByPriority: ChartDatum[];
  workOrdersBySector: ChartDatum[];
  workOrderTrend: TrendDatum[];
  inventoryByType: ChartDatum[];
  postureRows: PostureAnalyticsRow[];
  manufacturerRows: ManufacturerAnalyticsRow[];
  recurrence: { count: number; windowDays: number };
}
