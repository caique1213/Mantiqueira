import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSupabaseClient } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import {
  fetchNotifications,
  fetchNotificationSettings,
  previewNotificationSound,
} from './notifications.api';
import { isAlarmSilenced } from './alarm-silence';

function isQuietTime(value: Record<string, unknown>): boolean {
  const start = typeof value.start === 'string' ? value.start.match(/^(\d{2}):(\d{2})$/) : null;
  const end = typeof value.end === 'string' ? value.end.match(/^(\d{2}):(\d{2})$/) : null;
  if (!start || !end) return false;
  const startMinutes = Number(start[1]) * 60 + Number(start[2]);
  const endMinutes = Number(end[1]) * 60 + Number(end[2]);
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  return startMinutes <= endMinutes
    ? current >= startMinutes && current < endMinutes
    : current >= startMinutes || current < endMinutes;
}

export function NotificationAlertController() {
  const auth = useAuth();
  const profileId = auth.user?.id ?? '';
  const queryClient = useQueryClient();
  const seenIds = useRef<Set<string> | null>(null);
  const alarmTimer = useRef<number | null>(null);
  const [silenceRevision, setSilenceRevision] = useState(0);

  const feed = useQuery({
    queryKey: ['notification-alert-feed', profileId],
    queryFn: () => fetchNotifications(profileId, true),
    enabled: Boolean(profileId),
    refetchInterval: 10_000,
  });
  const settings = useQuery({
    queryKey: ['notification-settings', profileId],
    queryFn: () => fetchNotificationSettings(profileId),
    enabled: Boolean(profileId),
  });

  useEffect(() => {
    seenIds.current = null;
  }, [profileId]);

  useEffect(() => {
    const handleSilence = () => setSilenceRevision((value) => value + 1);
    window.addEventListener('alarm-silence-changed', handleSilence);
    window.addEventListener('storage', handleSilence);
    return () => {
      window.removeEventListener('alarm-silence-changed', handleSilence);
      window.removeEventListener('storage', handleSilence);
    };
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !profileId) return;
    const channel = client
      .channel(`notification-receipts:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_receipts',
          filter: `profile_id=eq.${profileId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['notification-alert-feed', profileId] });
          void queryClient.invalidateQueries({ queryKey: ['notifications-unread', profileId] });
          void queryClient.invalidateQueries({ queryKey: ['notifications', profileId] });
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [profileId, queryClient]);

  useEffect(() => {
    if (!feed.data) return;
    const currentIds = new Set(feed.data.map((item) => item.id));
    if (seenIds.current === null) {
      seenIds.current = currentIds;
      return;
    }
    const fresh = feed.data.filter((item) => !seenIds.current!.has(item.id));
    seenIds.current = currentIds;
    const configuration = settings.data;
    if (!fresh.length || !configuration?.preferences.enabled) return;

    const newest = fresh[0]!;
    toast(newest.title, {
      description: newest.message,
      action: newest.workOrderId
        ? {
            label: 'Abrir OS',
            onClick: () => {
              window.location.assign(`/ordens/${newest.workOrderId}`);
            },
          }
        : undefined,
    });

    const preferences = configuration.preferences;
    if (isAlarmSilenced(profileId)) return;
    if (isQuietTime(preferences.quiet_hours)) return;

    const timers: number[] = [];
    if (preferences.sound_enabled) {
      const sound = configuration.sounds.find((item) => item.id === preferences.sound_preset_id);
      if (sound) {
        const repetitions = Math.max(1, Math.min(2, preferences.repeat_count));
        for (let index = 0; index < repetitions; index += 1) {
          timers.push(
            window.setTimeout(() => {
              try {
                previewNotificationSound(sound.audio_key, preferences.volume);
              } catch {
                // Alguns navegadores mantêm áudio bloqueado até a primeira interação do usuário.
              }
            }, index * 1100),
          );
        }
      }
    }

    if (preferences.speech_enabled && 'speechSynthesis' in window) {
      timers.push(
        window.setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(`${newest.title}. ${newest.message}`);
          utterance.lang = 'pt-BR';
          utterance.volume = preferences.volume;
          window.speechSynthesis.speak(utterance);
        }, 250),
      );
    }

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [feed.data, profileId, settings.data, silenceRevision]);

  useEffect(() => {
    const configuration = settings.data;
    const preferences = configuration?.preferences;
    const unreadWorkOrderNotifications = feed.data?.filter((item) => item.workOrderId) ?? [];

    if (alarmTimer.current !== null) {
      window.clearInterval(alarmTimer.current);
      alarmTimer.current = null;
    }

    if (
      !unreadWorkOrderNotifications.length ||
      !configuration ||
      !preferences?.enabled ||
      !preferences.sound_enabled ||
      isAlarmSilenced(profileId) ||
      isQuietTime(preferences.quiet_hours)
    ) {
      return;
    }

    const sound = configuration.sounds.find((item) => item.id === preferences.sound_preset_id);
    if (!sound) return;

    const playAlarm = () => {
      try {
        previewNotificationSound(sound.audio_key, preferences.volume);
      } catch {
        // Navegadores podem bloquear áudio até a primeira interação do usuário.
      }
    };

    playAlarm();
    alarmTimer.current = window.setInterval(playAlarm, 2_600);

    return () => {
      if (alarmTimer.current !== null) {
        window.clearInterval(alarmTimer.current);
        alarmTimer.current = null;
      }
    };
  }, [feed.data, profileId, settings.data, silenceRevision]);

  return null;
}
