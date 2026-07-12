import { z } from 'zod';
import { requireSupabaseClient } from '../../lib/supabase';

const receiptSchema = z.object({
  notification_event_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  read_at: z.string().nullable(),
  acknowledged_at: z.string().nullable(),
  created_at: z.string(),
});

const eventSchema = z.object({
  id: z.string().uuid(),
  event_type: z.string(),
  work_order_id: z.string().uuid().nullable(),
  title: z.string(),
  message: z.string(),
  payload: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});

export interface NotificationItem {
  id: string;
  eventType: string;
  workOrderId: string | null;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
}

export async function fetchNotifications(
  profileId: string,
  onlyUnread = false,
): Promise<NotificationItem[]> {
  const client = requireSupabaseClient();
  let receiptsQuery = client
    .from('notification_receipts')
    .select('notification_event_id,profile_id,read_at,acknowledged_at,created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (onlyUnread) receiptsQuery = receiptsQuery.is('read_at', null);
  const { data: receiptRows, error: receiptError } = await receiptsQuery;
  if (receiptError) throw receiptError;
  const receipts = z.array(receiptSchema).parse(receiptRows ?? []);
  if (!receipts.length) return [];

  const { data: eventRows, error: eventError } = await client
    .from('notification_events')
    .select('id,event_type,work_order_id,title,message,payload,created_at')
    .in(
      'id',
      receipts.map((receipt) => receipt.notification_event_id),
    );
  if (eventError) throw eventError;
  const events = new Map(
    z
      .array(eventSchema)
      .parse(eventRows ?? [])
      .map((event) => [event.id, event]),
  );

  return receipts.flatMap((receipt) => {
    const event = events.get(receipt.notification_event_id);
    if (!event) return [];
    return [
      {
        id: event.id,
        eventType: event.event_type,
        workOrderId: event.work_order_id,
        title: event.title,
        message: event.message,
        payload: event.payload,
        createdAt: event.created_at,
        readAt: receipt.read_at,
        acknowledgedAt: receipt.acknowledged_at,
      },
    ];
  });
}

export async function fetchUnreadNotificationCount(profileId: string): Promise<number> {
  const { count, error } = await requireSupabaseClient()
    .from('notification_receipts')
    .select('notification_event_id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function acknowledgeNotification(notificationId: string) {
  const { data, error } = await requireSupabaseClient().rpc('acknowledge_notification', {
    p_notification_event_id: notificationId,
  });
  if (error) throw error;
  return data;
}

export async function acknowledgeMany(notificationIds: string[]) {
  for (const id of notificationIds) await acknowledgeNotification(id);
}

const preferencesSchema = z.object({
  profile_id: z.string().uuid(),
  enabled: z.boolean(),
  sound_enabled: z.boolean(),
  sound_preset_id: z.string().uuid().nullable(),
  volume: z.coerce.number(),
  speech_enabled: z.boolean(),
  repeat_count: z.coerce.number(),
  quiet_hours: z.record(z.string(), z.unknown()),
});

const soundSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  audio_key: z.string(),
});

export type NotificationPreferences = z.infer<typeof preferencesSchema>;
export type SoundPreset = z.infer<typeof soundSchema>;

export async function fetchNotificationSettings(profileId: string) {
  const client = requireSupabaseClient();
  const [preferences, sounds] = await Promise.all([
    client.from('notification_preferences').select('*').eq('profile_id', profileId).single(),
    client
      .from('sound_presets')
      .select('id,key,name,audio_key')
      .eq('active', true)
      .order('sort_order'),
  ]);
  if (preferences.error) throw preferences.error;
  if (sounds.error) throw sounds.error;
  return {
    preferences: preferencesSchema.parse(preferences.data),
    sounds: z.array(soundSchema).parse(sounds.data ?? []),
  };
}

export async function updateNotificationSettings(
  profileId: string,
  preferences: Omit<NotificationPreferences, 'profile_id'>,
) {
  const { data, error } = await requireSupabaseClient()
    .from('notification_preferences')
    .update(preferences)
    .eq('profile_id', profileId)
    .select('*')
    .single();
  if (error) throw error;
  return preferencesSchema.parse(data);
}

export function previewNotificationSound(audioKey: string, volume: number) {
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Prévia sonora não suportada neste navegador.');
  const context = new AudioContextClass();
  const patterns: Record<string, Array<[number, number, number]>> = {
    'industrial-bell': [
      [740, 0, 0.16],
      [980, 0.17, 0.18],
    ],
    'short-siren': [
      [520, 0, 0.15],
      [760, 0.15, 0.15],
      [520, 0.3, 0.16],
    ],
    'metal-chime': [
      [880, 0, 0.12],
      [1320, 0.13, 0.22],
    ],
    'soft-alert': [
      [440, 0, 0.18],
      [554, 0.2, 0.18],
    ],
    'critical-alarm': [
      [880, 0, 0.12],
      [660, 0.14, 0.12],
      [880, 0.28, 0.12],
      [660, 0.42, 0.18],
    ],
  };
  const start = context.currentTime + 0.03;
  for (const [frequency, offset, duration] of patterns[audioKey] ?? patterns['soft-alert']!) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = audioKey === 'soft-alert' ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start + offset);
    gain.gain.linearRampToValueAtTime(Math.max(0.01, volume) * 0.18, start + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + offset + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + duration);
  }
  window.setTimeout(() => void context.close(), 1200);
}
