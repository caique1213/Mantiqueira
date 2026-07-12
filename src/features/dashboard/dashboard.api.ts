import { z } from 'zod';
import { requireSupabaseClient } from '../../lib/supabase';

const dashboardBootstrapSchema = z.object({
  site: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      code: z.string().optional(),
      timezone: z.string().optional(),
    })
    .nullable(),
  settings: z.record(z.string(), z.unknown()).default({}),
  active_theme: z.unknown().nullable().optional(),
  modules: z
    .array(
      z.object({
        slug: z.string(),
        label: z.string(),
        description: z.string(),
        icon: z.string(),
        route: z.string(),
        sort_order: z.coerce.number(),
      }),
    )
    .default([]),
  catalogs: z.record(z.string(), z.unknown()).default({}),
});

export type AppBootstrap = z.infer<typeof dashboardBootstrapSchema>;

export interface DashboardMetrics {
  openWorkOrders: number;
  criticalWorkOrders: number;
  installedAssets: number;
  incompleteAssets: number;
}

export async function fetchAppBootstrap(): Promise<AppBootstrap> {
  const { data, error } = await requireSupabaseClient().rpc('app_bootstrap');
  if (error) throw error;
  return dashboardBootstrapSchema.parse(data);
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const client = requireSupabaseClient();
  const [open, critical, installed, incomplete] = await Promise.all([
    client
      .from('work_order_summary')
      .select('work_order_id', { head: true, count: 'exact' })
      .eq('is_terminal', false),
    client
      .from('work_order_summary')
      .select('work_order_id', { head: true, count: 'exact' })
      .eq('is_terminal', false)
      .eq('priority_code', 'critical'),
    client.from('asset_current_location').select('asset_id', { head: true, count: 'exact' }),
    client
      .from('asset_current_location')
      .select('asset_id', { head: true, count: 'exact' })
      .lt('completeness_percent', 100),
  ]);

  const firstError = [open.error, critical.error, installed.error, incomplete.error].find(Boolean);
  if (firstError) throw firstError;

  return {
    openWorkOrders: open.count ?? 0,
    criticalWorkOrders: critical.count ?? 0,
    installedAssets: installed.count ?? 0,
    incompleteAssets: incomplete.count ?? 0,
  };
}
