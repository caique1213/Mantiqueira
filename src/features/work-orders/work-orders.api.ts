import { z } from 'zod';
import { requireSupabaseClient } from '../../lib/supabase';
import { imageToWebp, sha256 } from '../../lib/media';

interface IdLabel {
  id: string;
  label: string;
}

const postureSchema = z.object({ id: z.string().uuid(), number: z.number(), name: z.string() });
const batterySchema = z.object({
  id: z.string().uuid(),
  posture_id: z.string().uuid(),
  code: z.string(),
  ordinal: z.number(),
});
const positionSchema = z.object({
  id: z.string().uuid(),
  posture_id: z.string().uuid(),
  battery_id: z.string().uuid().nullable(),
  code: z.string(),
  name: z.string(),
});

export interface WorkOrderCatalogs {
  postures: z.infer<typeof postureSchema>[];
  batteries: z.infer<typeof batterySchema>[];
  sectors: (IdLabel & { code: string })[];
  priorities: (IdLabel & { code: string; weight: number })[];
  problemTypes: (IdLabel & { sectorId: string | null })[];
  statuses: (IdLabel & { code: string; semanticState: string; isTerminal: boolean })[];
}

export interface OpenWorkOrderInput {
  postureId: string;
  batteryId: string | null;
  sectorId: string;
  assetPositionId: string | null;
  assetId: string | null;
  problemTypeId: string | null;
  priorityId: string;
  description: string;
}

export async function fetchWorkOrderCatalogs(): Promise<WorkOrderCatalogs> {
  const client = requireSupabaseClient();
  const [
    posturesResult,
    batteriesResult,
    sectorsResult,
    prioritiesResult,
    typesResult,
    statusesResult,
  ] = await Promise.all([
    client.from('postures').select('id,number,name').eq('active', true).order('number'),
    client
      .from('batteries')
      .select('id,posture_id,code,ordinal')
      .eq('active', true)
      .order('ordinal'),
    client.from('sectors').select('id,code,name').eq('active', true).order('name'),
    client
      .from('priority_definitions')
      .select('id,code,name,weight')
      .eq('active', true)
      .order('weight'),
    client.from('problem_types').select('id,name,sector_id').eq('active', true).order('name'),
    client
      .from('work_order_status_definitions')
      .select('id,code,name,semantic_state,is_terminal')
      .eq('active', true)
      .order('sort_order'),
  ]);

  const error = [
    posturesResult.error,
    batteriesResult.error,
    sectorsResult.error,
    prioritiesResult.error,
    typesResult.error,
    statusesResult.error,
  ].find(Boolean);
  if (error) throw error;

  return {
    postures: z.array(postureSchema).parse(posturesResult.data ?? []),
    batteries: z.array(batterySchema).parse(batteriesResult.data ?? []),
    sectors: z
      .array(z.object({ id: z.string().uuid(), code: z.string(), name: z.string() }))
      .parse(sectorsResult.data ?? [])
      .map((row) => ({ id: row.id, code: row.code, label: row.name })),
    priorities: z
      .array(
        z.object({ id: z.string().uuid(), code: z.string(), name: z.string(), weight: z.number() }),
      )
      .parse(prioritiesResult.data ?? [])
      .map((row) => ({ id: row.id, code: row.code, label: row.name, weight: row.weight })),
    problemTypes: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          sector_id: z.string().uuid().nullable(),
        }),
      )
      .parse(typesResult.data ?? [])
      .map((row) => ({ id: row.id, label: row.name, sectorId: row.sector_id })),
    statuses: z
      .array(
        z.object({
          id: z.string().uuid(),
          code: z.string(),
          name: z.string(),
          semantic_state: z.string(),
          is_terminal: z.boolean(),
        }),
      )
      .parse(statusesResult.data ?? [])
      .map((row) => ({
        id: row.id,
        code: row.code,
        label: row.name,
        semanticState: row.semantic_state,
        isTerminal: row.is_terminal,
      })),
  };
}

export async function fetchPositions(postureId: string, batteryId: string | null) {
  const client = requireSupabaseClient();
  let query = client
    .from('asset_positions')
    .select('id,posture_id,battery_id,code,name')
    .eq('posture_id', postureId)
    .eq('active', true)
    .order('name');

  query = batteryId ? query.eq('battery_id', batteryId) : query.is('battery_id', null);
  const { data, error } = await query;
  if (error) throw error;
  return z
    .array(positionSchema)
    .parse(data ?? [])
    .sort((left, right) => {
      const leftArea = left.code.startsWith('area_');
      const rightArea = right.code.startsWith('area_');
      if (leftArea && rightArea) return left.code.localeCompare(right.code, 'pt-BR');
      return left.name.localeCompare(right.name, 'pt-BR');
    });
}

export async function fetchInstalledAssetForPosition(positionId: string) {
  const { data, error } = await requireSupabaseClient()
    .from('asset_current_location')
    .select('*')
    .eq('asset_position_id', positionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return z
    .object({
      asset_id: z.string().uuid(),
      installation_id: z.string().uuid(),
      asset_label: z.string().optional(),
      manufacturer_name: z.string().nullable().optional(),
      model_name: z.string().nullable().optional(),
    })
    .passthrough()
    .parse(data);
}

export async function openWorkOrder(input: OpenWorkOrderInput) {
  const { data, error } = await requireSupabaseClient().rpc('open_work_order', {
    p_posture_id: input.postureId,
    p_sector_id: input.sectorId,
    p_priority_id: input.priorityId,
    p_description: input.description,
    p_battery_id: input.batteryId,
    p_asset_position_id: input.assetPositionId,
    p_asset_id: input.assetId,
    p_problem_type_id: input.problemTypeId,
  });
  if (error) throw error;
  return z.object({ id: z.string().uuid(), number: z.coerce.number() }).passthrough().parse(data);
}

export const workOrderSummarySchema = z.object({
  work_order_id: z.string().uuid(),
  number: z.coerce.number(),
  site_id: z.string().uuid(),
  posture_id: z.string().uuid(),
  posture_number: z.coerce.number(),
  battery_id: z.string().uuid().nullable(),
  battery_code: z.string().nullable(),
  asset_position_id: z.string().uuid().nullable(),
  position_code: z.string().nullable(),
  position_name: z.string().nullable(),
  asset_id: z.string().uuid().nullable(),
  asset_internal_code: z.string().nullable(),
  manufacturer_name: z.string().nullable(),
  model_name: z.string().nullable(),
  sector_id: z.string().uuid(),
  sector_code: z.string(),
  sector_name: z.string(),
  status_id: z.string().uuid(),
  status_code: z.string(),
  status_name: z.string(),
  semantic_state: z.enum(['awaiting', 'in_progress', 'waiting_part', 'resolved', 'cancelled']),
  is_terminal: z.boolean(),
  status_color: z.string(),
  priority_id: z.string().uuid(),
  priority_code: z.string(),
  priority_name: z.string(),
  priority_weight: z.coerce.number(),
  priority_color: z.string(),
  problem_type_id: z.string().uuid().nullable(),
  problem_type_name: z.string().nullable(),
  description: z.string(),
  diagnosis: z.string(),
  root_cause: z.string(),
  work_performed: z.string(),
  opened_by: z.string().uuid(),
  opened_by_name: z.string(),
  assigned_to: z.string().uuid().nullable(),
  assigned_to_name: z.string().nullable(),
  opened_at: z.string(),
  assigned_at: z.string().nullable(),
  started_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  due_at: z.string().nullable(),
  is_overdue: z.boolean(),
  updated_at: z.string(),
});

export type WorkOrderSummaryRow = z.infer<typeof workOrderSummarySchema>;

const workOrderPersonSchema = z.object({
  profile_id: z.string().uuid(),
  display_name: z.string(),
  sector_name: z.string().nullable(),
  role_names: z.array(z.string()).default([]),
});

const workOrderPersonReportRowSchema = z.object({
  work_order_id: z.string().uuid(),
  number: z.coerce.number(),
  sector_name: z.string(),
  posture_number: z.coerce.number(),
  battery_code: z.string().nullable(),
  position_name: z.string().nullable(),
  status_name: z.string(),
  description: z.string(),
  diagnosis: z.string(),
  work_performed: z.string(),
  opened_by_name: z.string(),
  assigned_to_name: z.string().nullable(),
  executor_name: z.string(),
  support_names: z.string(),
  started_at: z.string(),
  finished_at: z.string(),
  total_minutes: z.coerce.number(),
});

export type WorkOrderPerson = z.infer<typeof workOrderPersonSchema>;
export type WorkOrderPersonReportRow = z.infer<typeof workOrderPersonReportRowSchema>;

const workOrderParticipantSchema = z.object({
  id: z.string().uuid(),
  work_order_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  display_name: z.string(),
  sector_name: z.string().nullable(),
  role_names: z.array(z.string()).default([]),
  added_by: z.string().uuid().nullable(),
  added_by_name: z.string().nullable(),
  note: z.string(),
  added_at: z.string(),
});

const workOrderPartnerCandidateSchema = z.object({
  profile_id: z.string().uuid(),
  display_name: z.string(),
  sector_name: z.string().nullable(),
  role_names: z.array(z.string()).default([]),
});

export type WorkOrderParticipant = z.infer<typeof workOrderParticipantSchema>;
export type WorkOrderPartnerCandidate = z.infer<typeof workOrderPartnerCandidateSchema>;

export interface WorkOrderListFilters {
  page: number;
  pageSize: number;
  query?: string;
  statusCode?: string;
  sectorCode?: string;
  priorityCode?: string;
  postureNumber?: number;
  assignedTo?: string;
  openedBy?: string;
  personId?: string;
  onlyOpen?: boolean;
}

export async function fetchWorkOrders(filters: WorkOrderListFilters) {
  const client = requireSupabaseClient();
  let query = client
    .from('work_order_summary')
    .select('*', { count: 'exact' })
    .order('opened_at', { ascending: false })
    .range((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize - 1);

  if (filters.statusCode) query = query.eq('status_code', filters.statusCode);
  if (filters.sectorCode) query = query.eq('sector_code', filters.sectorCode);
  if (filters.priorityCode) query = query.eq('priority_code', filters.priorityCode);
  if (filters.postureNumber) query = query.eq('posture_number', filters.postureNumber);
  if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
  if (filters.openedBy) query = query.eq('opened_by', filters.openedBy);
  if (filters.personId) {
    query = query.or(`assigned_to.eq.${filters.personId},opened_by.eq.${filters.personId}`);
  }
  if (filters.onlyOpen) query = query.eq('is_terminal', false);
  if (filters.query?.trim()) {
    const safe = filters.query.trim().replace(/[,%()]/g, ' ');
    const numeric = Number(safe);
    query = Number.isInteger(numeric)
      ? query.or(`number.eq.${numeric},description.ilike.%${safe}%`)
      : query.or(
          `description.ilike.%${safe}%,manufacturer_name.ilike.%${safe}%,model_name.ilike.%${safe}%,opened_by_name.ilike.%${safe}%,assigned_to_name.ilike.%${safe}%`,
        );
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: z.array(workOrderSummarySchema).parse(data ?? []), total: count ?? 0 };
}

export async function fetchWorkOrderPeople() {
  const { data, error } = await requireSupabaseClient().rpc('list_work_order_people');
  if (error) throw error;
  return z.array(workOrderPersonSchema).parse(data ?? []);
}

export async function fetchWorkOrderPersonReport(input: {
  personId: string;
  startedFrom: string;
  startedTo: string;
}) {
  const { data, error } = await requireSupabaseClient().rpc('export_work_order_person_report', {
    p_profile_id: input.personId,
    p_started_from: input.startedFrom,
    p_started_to: input.startedTo,
  });
  if (error) throw error;
  return z.array(workOrderPersonReportRowSchema).parse(data ?? []);
}

export async function fetchWorkOrderDetail(workOrderId: string) {
  const client = requireSupabaseClient();
  const [
    summaryResult,
    eventsResult,
    commentsResult,
    neededResult,
    mediaResult,
    participantsResult,
  ] = await Promise.all([
    client.from('work_order_summary').select('*').eq('work_order_id', workOrderId).single(),
    client
      .from('work_order_events')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('occurred_at'),
    client
      .from('work_order_comments')
      .select(
        'id,work_order_id,author_id,body,internal_only,created_at,edited_at,profiles:author_id(display_name)',
      )
      .eq('work_order_id', workOrderId)
      .order('created_at'),
    client
      .from('work_order_needed_items')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at'),
    client
      .from('work_order_media')
      .select('*')
      .eq('work_order_id', workOrderId)
      .is('archived_at', null)
      .order('created_at'),
    client.rpc('list_work_order_participants', { p_work_order_id: workOrderId }),
  ]);
  const error = [
    summaryResult.error,
    eventsResult.error,
    commentsResult.error,
    neededResult.error,
    mediaResult.error,
    participantsResult.error,
  ].find(Boolean);
  if (error) throw error;

  const mediaRows = z
    .array(
      z
        .object({
          id: z.string().uuid(),
          media_type: z.enum(['problem', 'during', 'after', 'document']),
          storage_path: z.string(),
          mime_type: z.string(),
          caption: z.string(),
          width: z.coerce.number().nullable(),
          height: z.coerce.number().nullable(),
          created_at: z.string(),
        })
        .passthrough(),
    )
    .parse(mediaResult.data ?? []);
  const media = await Promise.all(
    mediaRows.map(async (row) => {
      const { data: signed, error: signedError } = await client.storage
        .from('work-order-media')
        .createSignedUrl(row.storage_path, 600);
      return { ...row, signedUrl: signedError ? null : signed.signedUrl };
    }),
  );

  return {
    summary: workOrderSummarySchema.parse(summaryResult.data),
    events: z
      .array(
        z.object({
          id: z.string().uuid(),
          event_type: z.string(),
          actor_id: z.string().uuid().nullable(),
          from_status_id: z.string().uuid().nullable(),
          to_status_id: z.string().uuid().nullable(),
          details: z.record(z.string(), z.unknown()),
          occurred_at: z.string(),
        }),
      )
      .parse(eventsResult.data ?? []),
    comments: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            author_id: z.string().uuid().nullable(),
            body: z.string(),
            internal_only: z.boolean(),
            created_at: z.string(),
            profiles: z.object({ display_name: z.string() }).nullable().optional(),
          })
          .passthrough(),
      )
      .parse(commentsResult.data ?? []),
    neededItems: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            description: z.string(),
            code: z.string().nullable(),
            manufacturer: z.string().nullable(),
            estimated_quantity: z.coerce.number(),
            unit: z.string(),
            notes: z.string(),
            fulfilled_at: z.string().nullable(),
            created_at: z.string(),
          })
          .passthrough(),
      )
      .parse(neededResult.data ?? []),
    media,
    participants: z.array(workOrderParticipantSchema).parse(participantsResult.data ?? []),
  };
}

export async function fetchWorkOrderPartnerCandidates(workOrderId: string) {
  const { data, error } = await requireSupabaseClient().rpc('list_work_order_partner_candidates', {
    p_work_order_id: workOrderId,
  });
  if (error) throw error;
  return z.array(workOrderPartnerCandidateSchema).parse(data ?? []);
}

export async function addWorkOrderPartner(workOrderId: string, profileId: string, note = '') {
  const { data, error } = await requireSupabaseClient().rpc('add_work_order_partner', {
    p_work_order_id: workOrderId,
    p_profile_id: profileId,
    p_note: note,
  });
  if (error) throw error;
  return data;
}

export async function removeWorkOrderPartner(participantId: string) {
  const { data, error } = await requireSupabaseClient().rpc('remove_work_order_partner', {
    p_participant_id: participantId,
  });
  if (error) throw error;
  return data;
}

export async function assignWorkOrder(workOrderId: string, assigneeId?: string) {
  const args = assigneeId
    ? { p_work_order_id: workOrderId, p_assignee_id: assigneeId }
    : { p_work_order_id: workOrderId };
  const { data, error } = await requireSupabaseClient().rpc('assign_work_order', args);
  if (error) throw error;
  return data;
}

export interface TransitionWorkOrderInput {
  workOrderId: string;
  targetStatusCode: string;
  note?: string;
  diagnosis?: string;
  rootCause?: string;
  workPerformed?: string;
  confirmation?: string;
}

export async function transitionWorkOrder(input: TransitionWorkOrderInput) {
  const { data, error } = await requireSupabaseClient().rpc('transition_work_order', {
    p_work_order_id: input.workOrderId,
    p_target_status_code: input.targetStatusCode,
    p_note: input.note ?? '',
    p_diagnosis: input.diagnosis ?? null,
    p_root_cause: input.rootCause ?? null,
    p_work_performed: input.workPerformed ?? null,
    p_confirmation: input.confirmation ?? null,
  });
  if (error) throw error;
  return data;
}

export async function addWorkOrderComment(workOrderId: string, body: string, internalOnly = false) {
  const { data, error } = await requireSupabaseClient().rpc('add_work_order_comment', {
    p_work_order_id: workOrderId,
    p_body: body,
    p_internal_only: internalOnly,
  });
  if (error) throw error;
  return data;
}

export async function addNeededItem(input: {
  workOrderId: string;
  description: string;
  code?: string;
  manufacturer?: string;
  quantity: number;
  unit: string;
  notes?: string;
}) {
  const { data, error } = await requireSupabaseClient().rpc('add_work_order_needed_item', {
    p_work_order_id: input.workOrderId,
    p_description: input.description,
    p_code: input.code ?? null,
    p_manufacturer: input.manufacturer ?? null,
    p_estimated_quantity: input.quantity,
    p_unit: input.unit,
    p_notes: input.notes ?? '',
  });
  if (error) throw error;
  return data;
}

export async function uploadWorkOrderMedia(input: {
  workOrderId: string;
  siteId: string;
  file: File;
  mediaType: 'problem' | 'during' | 'after';
  caption: string;
}) {
  const client = requireSupabaseClient();
  const prepared = await imageToWebp(input.file);
  if (prepared.blob.size > 25 * 1024 * 1024)
    throw new Error('A imagem otimizada excedeu o limite de 25 MB.');
  const path = `${input.siteId}/${input.workOrderId}/${crypto.randomUUID()}.webp`;
  const upload = await client.storage.from('work-order-media').upload(path, prepared.blob, {
    contentType: 'image/webp',
    cacheControl: '3600',
    upsert: false,
  });
  if (upload.error) throw upload.error;
  const registration = await client.rpc('register_work_order_media', {
    p_work_order_id: input.workOrderId,
    p_storage_path: path,
    p_media_type: input.mediaType,
    p_mime_type: 'image/webp',
    p_byte_size: prepared.blob.size,
    p_width: prepared.width,
    p_height: prepared.height,
    p_checksum_sha256: await sha256(prepared.blob),
    p_caption: input.caption,
    p_thumbnail_path: null,
  });
  if (registration.error) {
    await client.storage.from('work-order-media').remove([path]);
    throw registration.error;
  }
}

export async function fulfillNeededItem(neededItemId: string) {
  const { data, error } = await requireSupabaseClient().rpc('fulfill_work_order_needed_item', {
    p_needed_item_id: neededItemId,
  });
  if (error) throw error;
  return data;
}
