export type AssetDomain = 'electrical' | 'mechanical' | 'general';
export type AssetCriticality = 'low' | 'medium' | 'high' | 'critical';
export type AssetDataSource =
  'physical_nameplate' | 'field_measurement' | 'manual' | 'library' | 'unknown';
export type AssetMediaType = 'general' | 'nameplate' | 'before' | 'after' | 'document';

export interface InventoryAsset {
  assetId: string;
  siteId: string;
  assetTypeId: string;
  assetTypeCode: string;
  assetTypeName: string;
  domain: AssetDomain;
  manufacturerId: string | null;
  manufacturerName: string | null;
  technicalModelId: string | null;
  modelName: string | null;
  internalCode: string | null;
  serialNumber: string | null;
  statusId: string;
  statusCode: string;
  statusName: string;
  criticality: AssetCriticality;
  installationId: string;
  assetPositionId: string;
  positionCode: string;
  positionName: string;
  postureId: string;
  postureNumber: number;
  batteryId: string | null;
  batteryCode: string | null;
  installedAt: string;
  updatedAt: string;
  completenessPercent: number | null;
  missingFields: string[];
}

export interface InventoryFilters {
  search: string;
  assetTypeId: string;
  manufacturerId: string;
  postureNumber: string;
  completeness: 'all' | 'complete' | 'incomplete' | 'missing_nameplate';
}

export interface InventoryPageResult {
  rows: InventoryAsset[];
  total: number;
}

export interface CatalogOption {
  id: string;
  label: string;
  code?: string;
}

export interface AssetTypeOption extends CatalogOption {
  domain: AssetDomain;
}

export interface TechnicalModelOption extends CatalogOption {
  assetTypeId: string;
  manufacturerId: string;
  description: string;
  referenceSpecs: Record<string, unknown>;
  sourceName: string | null;
  sourceUrl: string | null;
  verified: boolean;
  confidence: string;
}

export interface TechnicalModelDetail extends TechnicalModelOption {
  assetTypeName: string;
  assetTypeCode: string;
  domain: AssetDomain;
  manufacturerName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  installedAssets: InventoryAsset[];
}

export interface AssetCatalogs {
  sites: CatalogOption[];
  assetTypes: AssetTypeOption[];
  manufacturers: CatalogOption[];
  statuses: (CatalogOption & { color: string; semanticState: string })[];
  technicalModels: TechnicalModelOption[];
}

export interface AssetSpecificSpecs {
  kind: 'motor' | 'reducer' | 'none';
  values: Record<string, unknown>;
}

export interface AssetMedia {
  id: string;
  mediaType: AssetMediaType;
  storagePath: string;
  caption: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  signedUrl: string | null;
  previewError: string | null;
}

export interface AssetInstallation {
  id: string;
  assetPositionId: string;
  positionName: string;
  postureNumber: number | null;
  batteryCode: string | null;
  installedAt: string;
  removedAt: string | null;
  installationReason: string;
  removalReason: string | null;
  workOrderId: string | null;
}

export interface AssetTimelineItem {
  id: string;
  kind: 'asset_event' | 'work_order';
  eventType: string;
  occurredAt: string;
  title: string;
  description: string;
  workOrderId: string | null;
  workOrderNumber: number | null;
}

export interface AssetDetail {
  id: string;
  siteId: string;
  assetTypeId: string;
  assetTypeCode: string;
  assetTypeName: string;
  domain: AssetDomain;
  manufacturerId: string | null;
  manufacturerName: string | null;
  technicalModelId: string | null;
  technicalModel: TechnicalModelOption | null;
  statusId: string;
  statusName: string;
  statusCode: string;
  statusColor: string;
  internalCode: string | null;
  serialNumber: string | null;
  manufacturedOn: string | null;
  criticality: AssetCriticality;
  nameplateSpecs: Record<string, unknown>;
  notes: string;
  dataSource: AssetDataSource;
  dataReviewedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completenessPercent: number | null;
  missingFields: string[];
  currentLocation: InventoryAsset | null;
  specificSpecs: AssetSpecificSpecs;
  media: AssetMedia[];
  installations: AssetInstallation[];
  timeline: AssetTimelineItem[];
}

export interface AssetFormValues {
  siteId: string;
  assetTypeId: string;
  manufacturerId: string;
  technicalModelId: string;
  statusId: string;
  internalCode: string;
  serialNumber: string;
  manufacturedOn: string;
  criticality: AssetCriticality;
  dataSource: AssetDataSource;
  notes: string;
  nameplateText: string;
  specs: Record<string, string>;
}

export interface AssetPositionOption {
  id: string;
  siteId: string;
  postureNumber: number;
  batteryCode: string | null;
  code: string;
  name: string;
  assetTypeId: string | null;
  domain: AssetDomain;
}

export interface ReplacementAssetOption {
  id: string;
  label: string;
}
