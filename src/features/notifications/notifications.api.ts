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

export async function acknowledgeWorkOrderNotifications(workOrderId: string) {
  const { data, error } = await requireSupabaseClient().rpc(
    'acknowledge_work_order_notifications',
    {
      p_work_order_id: workOrderId,
    },
  );
  if (error) throw error;
  return Number(data ?? 0);
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
  const [preferences, sounds, defaultSound] = await Promise.all([
    client.from('notification_preferences').select('*').eq('profile_id', profileId).single(),
    client
      .from('sound_presets')
      .select('id,key,name,audio_key')
      .eq('active', true)
      .order('sort_order'),
    client
      .from('app_settings')
      .select('value')
      .eq('key', 'notification.default_sound_preset_key')
      .maybeSingle(),
  ]);
  if (preferences.error) throw preferences.error;
  if (sounds.error) throw sounds.error;
  if (defaultSound.error) throw defaultSound.error;
  const parsedSounds = z.array(soundSchema).parse(sounds.data ?? []);
  const defaultKey =
    typeof defaultSound.data?.value === 'string' ? defaultSound.data.value : 'long_siren';
  const globalSound =
    parsedSounds.find((sound) => sound.key === defaultKey) ?? parsedSounds[0] ?? null;
  const parsedPreferences = preferencesSchema.parse(preferences.data);
  return {
    preferences: {
      ...parsedPreferences,
      sound_preset_id: globalSound?.id ?? parsedPreferences.sound_preset_id,
    },
    sounds: parsedSounds,
    globalSound,
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
  const external = playAudioFileOnce(audioKey, volume);
  if (external) return;

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
      [520, 0, 0.18],
      [740, 0.18, 0.2],
      [960, 0.38, 0.22],
      [620, 0.62, 0.22],
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
    'factory-pulse': [
      [620, 0, 0.1],
      [620, 0.16, 0.1],
      [780, 0.34, 0.2],
    ],
    'maintenance-call': [
      [500, 0, 0.16],
      [700, 0.22, 0.16],
      [900, 0.44, 0.18],
    ],
    'urgent-beep': [
      [1050, 0, 0.08],
      [1050, 0.12, 0.08],
      [1050, 0.24, 0.08],
      [760, 0.38, 0.16],
    ],
    'control-room': [
      [392, 0, 0.18],
      [523, 0.2, 0.18],
      [659, 0.4, 0.24],
    ],
    'long-siren': [
      [440, 0, 0.22],
      [560, 0.18, 0.22],
      [720, 0.36, 0.24],
      [900, 0.58, 0.28],
      [720, 0.86, 0.24],
      [560, 1.06, 0.22],
      [440, 1.24, 0.26],
    ],
  };
  const start = context.currentTime + 0.03;
  for (const [frequency, offset, duration] of patterns[audioKey] ?? patterns['soft-alert']!) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = audioKey.includes('siren')
      ? 'sawtooth'
      : audioKey === 'soft-alert'
        ? 'sine'
        : 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start + offset);
    const intensity = audioKey.includes('siren') ? 0.34 : 0.24;
    gain.gain.linearRampToValueAtTime(Math.max(0.05, volume) * intensity, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + offset + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + duration);
  }
  window.setTimeout(() => void context.close(), 2300);
}

export function startLoopingNotificationSound(audioKey: string, volume: number) {
  const fileLoop = startAudioFileLoop(audioKey, volume);
  if (fileLoop) return fileLoop;

  let stopped = false;
  let interval: number | null = null;

  const play = () => {
    if (!stopped) previewNotificationSound(audioKey, volume);
  };
  play();
  interval = window.setInterval(play, 2_600);

  return () => {
    stopped = true;
    if (interval !== null) window.clearInterval(interval);
  };
}

function isAudioFileKey(audioKey: string) {
  return audioKey.startsWith('data:audio/') || audioKey.startsWith('/alarms/');
}

function playAudioFileOnce(audioKey: string, volume: number) {
  if (!isAudioFileKey(audioKey)) return false;
  const audio = new Audio(audioKey);
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.play().catch(() => undefined);
  return true;
}

function startAudioFileLoop(audioKey: string, volume: number) {
  if (!isAudioFileKey(audioKey)) return null;
  const audio = new Audio(audioKey);
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.loop = true;
  audio.play().catch(() => undefined);
  return () => {
    audio.pause();
    audio.currentTime = 0;
  };
}
