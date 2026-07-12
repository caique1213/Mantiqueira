import type { AssetDomain, InstalledAssetSummary, UUID } from '../../types/domain';

export type PhysicalLayer = 'all' | 'electrical' | 'mechanical' | 'work-orders' | 'inventory';

export type PostureMapMode = 'work-orders' | 'inventory' | 'brand' | 'failures' | 'layer';

export interface PostureWorkOrderMetrics {
  total: number;
  critical: number;
  statusLabel?: string;
  priorityLabel?: string;
}

export interface PostureInventoryMetrics {
  completeness: number;
  missingNameplatePhotos: number;
  missingRequiredFields: number;
}

export interface PostureFailureMetrics {
  count: number;
  recurrentAssets?: number;
  intensity?: number;
}

export interface PostureMapDatum {
  id?: UUID;
  number: number;
  label?: string;
  active?: boolean;
  batteryCount?: number;
  workOrders?: PostureWorkOrderMetrics;
  inventory?: PostureInventoryMetrics;
  failures?: PostureFailureMetrics;
  brands?: readonly string[];
  domains?: readonly AssetDomain[];
}

export type PhysicalDataState = 'ready' | 'loading' | 'error';

export type StandardBatteryPositionCode =
  | 'motor_elevador'
  | 'redutor_elevador'
  | 'motor_racao'
  | 'redutor_racao'
  | 'motor_esteira_branca_superior'
  | 'motor_esteira_branca_inferior'
  | 'motor_esteira_nylon_superior'
  | 'motor_esteira_nylon_inferior';

export type BatteryPositionKind = 'motor' | 'reducer' | 'general';

export interface BatteryAssetView extends InstalledAssetSummary {
  statusLabel?: string;
  criticalWorkOrders?: number;
}

export interface BatteryPositionDatum {
  positionId?: UUID;
  code: StandardBatteryPositionCode | string;
  label?: string;
  kind?: BatteryPositionKind;
  domain?: AssetDomain;
  asset: BatteryAssetView | null;
}

export interface BatteryPositionSelection {
  positionId: UUID | null;
  code: string;
  label: string;
  kind: BatteryPositionKind;
  domain: AssetDomain;
  asset: BatteryAssetView | null;
  loaded: boolean;
}

export interface BatterySummaryDatum {
  id?: UUID;
  number: number;
  code?: string;
  active?: boolean;
  installedAssets?: number | null;
  expectedPositions?: number | null;
  completeness?: number | null;
  openWorkOrders?: number | null;
  criticalWorkOrders?: number | null;
}

export interface PostureSummaryDatum {
  id?: UUID;
  number: number;
  name?: string;
  active?: boolean;
  installedAssets?: number | null;
  expectedPositions?: number | null;
  inventoryCompleteness?: number | null;
  activeWorkOrders?: number | null;
  criticalWorkOrders?: number | null;
  lastMaintenanceAt?: string | null;
  dataQualityIssues?: readonly string[];
}
