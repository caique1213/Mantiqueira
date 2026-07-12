export type UUID = string;

export type RoleKey = 'galponista' | 'eletricista' | 'mecanico' | 'administrador';
export type DepartmentKey = 'operacao' | 'eletrica' | 'mecanica' | 'administracao';

export interface Profile {
  id: UUID;
  displayName: string;
  roleKeys: RoleKey[];
  departmentKeys: DepartmentKey[];
  active: boolean;
}

export interface Posture {
  id: UUID;
  siteId: UUID;
  number: number;
  name: string;
  active: boolean;
  batteryCount: number;
}

export interface Battery {
  id: UUID;
  postureId: UUID;
  code: `B${number}`;
  number: number;
  active: boolean;
}

export type AssetDomain = 'electrical' | 'mechanical' | 'general';

export interface AssetPosition {
  id: UUID;
  postureId: UUID;
  batteryId: UUID | null;
  code: string;
  name: string;
  domain: AssetDomain;
  singleOccupancy: boolean;
}

export interface InstalledAssetSummary {
  assetId: UUID;
  installationId: UUID;
  positionId: UUID;
  internalCode: string | null;
  assetType: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  completeness: number;
  hasNameplatePhoto: boolean;
  openWorkOrders: number;
}

export interface WorkOrderSummary {
  id: UUID;
  number: number;
  publicCode: string;
  postureNumber: number;
  batteryCode: string | null;
  assetLabel: string | null;
  department: DepartmentKey;
  statusKey: string;
  statusLabel: string;
  priorityKey: string;
  priorityLabel: string;
  description: string;
  openedAt: string;
  assignedToName: string | null;
  isTerminal: boolean;
}
