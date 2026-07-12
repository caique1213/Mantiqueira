import { z } from 'zod';
import { requireSupabaseClient } from '../../lib/supabase';
import type { PostureMapDatum } from './types';

const mapRowSchema = z.object({
  site_id: z.string().uuid(),
  slot_id: z.string().uuid(),
  row_number: z.coerce.number(),
  column_number: z.coerce.number(),
  posture_id: z.string().uuid().nullable(),
  posture_number: z.coerce.number().nullable(),
  posture_name: z.string().nullable(),
  battery_count: z.coerce.number().nullable(),
  posture_active: z.boolean().nullable(),
  total_positions: z.coerce.number(),
  installed_assets: z.coerce.number(),
  inventory_completeness: z.coerce.number(),
  open_work_orders: z.coerce.number(),
  critical_open_work_orders: z.coerce.number(),
  highest_priority_weight: z.coerce.number().nullable(),
  latest_work_order_at: z.string().nullable(),
  has_missing_nameplate: z.boolean(),
  brands: z.array(z.string()).optional(),
  domains: z.array(z.enum(['electrical', 'mechanical', 'general'])).optional(),
  failure_count: z.coerce.number().optional(),
  recurrent_assets: z.coerce.number().optional(),
});

export interface PostureMapPayload {
  postures: PostureMapDatum[];
  availableBrands: string[];
}

export async function fetchPostureMap(): Promise<PostureMapPayload> {
  const { data, error } = await requireSupabaseClient()
    .from('posture_map_summary')
    .select('*')
    .order('row_number')
    .order('column_number');
  if (error) throw error;
  const rows = z.array(mapRowSchema).parse(data ?? []);
  const brandSet = new Set<string>();
  const postures: PostureMapDatum[] = [];

  for (const row of rows) {
    if (!row.posture_id || row.posture_number === null) continue;
    for (const brand of row.brands ?? []) brandSet.add(brand);
    postures.push({
      id: row.posture_id,
      number: row.posture_number,
      label: row.posture_name ?? `Postura ${row.posture_number}`,
      active: row.posture_active ?? false,
      ...(row.battery_count === null ? {} : { batteryCount: row.battery_count }),
      workOrders: {
        total: row.open_work_orders,
        critical: row.critical_open_work_orders,
        ...(row.highest_priority_weight === null
          ? {}
          : { priorityLabel: `Peso ${row.highest_priority_weight}` }),
      },
      inventory: {
        completeness: row.inventory_completeness,
        missingNameplatePhotos: row.has_missing_nameplate ? 1 : 0,
        missingRequiredFields: Math.max(0, row.total_positions - row.installed_assets),
      },
      failures: {
        count: row.failure_count ?? 0,
        recurrentAssets: row.recurrent_assets ?? 0,
      },
      brands: row.brands ?? [],
      domains: row.domains ?? [],
    });
  }
  return { postures, availableBrands: [...brandSet].sort((a, b) => a.localeCompare(b, 'pt-BR')) };
}

const posturePositionSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  domain: z.enum(['electrical', 'mechanical', 'general']),
  asset_type_id: z.string().uuid().nullable(),
  current_asset_id: z.string().uuid().nullable(),
  current_installation_id: z.string().uuid().nullable(),
});

const postureBatterySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  ordinal: z.coerce.number(),
  active: z.boolean(),
  positions: z.array(posturePositionSchema),
});

export const postureDetailSchema = z.object({
  site_id: z.string().uuid(),
  posture_id: z.string().uuid(),
  posture_number: z.coerce.number(),
  posture_name: z.string(),
  battery_count: z.coerce.number(),
  posture_active: z.boolean(),
  batteries: z.array(postureBatterySchema),
  general_positions: z.array(posturePositionSchema),
  total_positions: z.coerce.number(),
  installed_assets: z.coerce.number(),
  inventory_completeness: z.coerce.number(),
  open_work_orders: z.coerce.number(),
  critical_open_work_orders: z.coerce.number(),
  latest_activity_at: z.string().nullable(),
});

export type PostureDetailPayload = z.infer<typeof postureDetailSchema>;

export async function fetchPostureDetail(postureNumber: number): Promise<PostureDetailPayload> {
  const { data, error } = await requireSupabaseClient()
    .from('posture_detail')
    .select('*')
    .eq('posture_number', postureNumber)
    .single();
  if (error) throw error;
  return postureDetailSchema.parse(data);
}

export const currentAssetSchema = z.object({
  asset_id: z.string().uuid(),
  site_id: z.string().uuid(),
  asset_type_id: z.string().uuid(),
  asset_type_code: z.string(),
  asset_type_name: z.string(),
  domain: z.enum(['electrical', 'mechanical', 'general']),
  manufacturer_id: z.string().uuid().nullable(),
  manufacturer_name: z.string().nullable(),
  technical_model_id: z.string().uuid().nullable(),
  model_name: z.string().nullable(),
  internal_code: z.string().nullable(),
  serial_number: z.string().nullable(),
  status_id: z.string().uuid(),
  status_code: z.string(),
  status_name: z.string(),
  criticality: z.enum(['low', 'medium', 'high', 'critical']),
  installation_id: z.string().uuid().nullable(),
  asset_position_id: z.string().uuid().nullable(),
  position_code: z.string().nullable(),
  position_name: z.string().nullable(),
  posture_id: z.string().uuid().nullable(),
  posture_number: z.coerce.number().nullable(),
  battery_id: z.string().uuid().nullable(),
  battery_code: z.string().nullable(),
  installed_at: z.string().nullable(),
  updated_at: z.string(),
  completeness_percent: z.coerce.number().default(0),
  has_nameplate_photo: z.boolean().default(false),
  open_work_orders: z.coerce.number().default(0),
  critical_open_work_orders: z.coerce.number().default(0),
});

export type CurrentAssetPayload = z.infer<typeof currentAssetSchema>;

export async function fetchPostureAssets(postureId: string): Promise<CurrentAssetPayload[]> {
  const { data, error } = await requireSupabaseClient()
    .from('asset_current_location')
    .select('*')
    .eq('posture_id', postureId)
    .order('battery_code')
    .order('position_name');
  if (error) throw error;
  return z.array(currentAssetSchema).parse(data ?? []);
}
