import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellRing,
  CheckCheck,
  ExternalLink,
  Save,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { normalizeError } from '../../lib/errors';
import { useAuth } from '../auth/AuthProvider';
import {
  acknowledgeMany,
  acknowledgeNotification,
  fetchNotifications,
  fetchNotificationSettings,
  previewNotificationSound,
  updateNotificationSettings,
} from './notifications.api';
import styles from './notifications.module.css';

export function NotificationsPage() {
  const auth = useAuth();
  const profileId = auth.user?.id ?? '';
  const queryClient = useQueryClient();
  const [onlyUnread, setOnlyUnread] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const notifications = useQuery({
    queryKey: ['notifications', profileId, onlyUnread],
    queryFn: () => fetchNotifications(profileId, onlyUnread),
    enabled: Boolean(profileId),
    refetchInterval: 30_000,
  });
  const settings = useQuery({
    queryKey: ['notification-settings', profileId],
    queryFn: () => fetchNotificationSettings(profileId),
    enabled: Boolean(profileId),
  });
  const [draft, setDraft] = useState<null | {
    enabled: boolean;
    sound_enabled: boolean;
    sound_preset_id: string | null;
    volume: number;
    speech_enabled: boolean;
    repeat_count: number;
    quiet_hours: Record<string, unknown>;
  }>(null);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }),
    ]);
  };
  const acknowledge = useMutation({
    mutationFn: acknowledgeNotification,
    onSuccess: refresh,
    onError: (error) => toast.error(normalizeError(error).message),
  });
  const acknowledgeAll = useMutation({
    mutationFn: () =>
      acknowledgeMany(
        (notifications.data ?? []).filter((item) => !item.readAt).map((item) => item.id),
      ),
    onSuccess: async () => {
      toast.success('Notificações marcadas como lidas.');
      await refresh();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });
  const saveSettings = useMutation({
    mutationFn: () => updateNotificationSettings(profileId, draft ?? settings.data!.preferences),
    onSuccess: async () => {
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ['notification-settings', profileId] });
      toast.success('Preferências salvas.');
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  if (!profileId)
    return (
      <StatePanel
        kind="permission"
        title="Sessão indisponível"
        description="Entre novamente para consultar suas notificações."
      />
    );
  if (notifications.isLoading || settings.isLoading) return <PageSkeleton />;
  if (notifications.isError || settings.isError || !settings.data) {
    return (
      <StatePanel
        kind="error"
        title="Notificações indisponíveis"
        description={
          notifications.error?.message ?? settings.error?.message ?? 'Erro desconhecido.'
        }
        actionLabel="Tentar novamente"
        onAction={() => {
          void notifications.refetch();
          void settings.refetch();
        }}
      />
    );
  }

  const preferences = draft ?? settings.data.preferences;
  const unread = (notifications.data ?? []).filter((item) => !item.readAt).length;

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="CENTRAL DE ALERTAS"
        title="Notificações"
        description="Novas OS, criticidade, atribuições e chamados aguardando peça em um fluxo rastreável."
        actions={
          <Button
            variant="secondary"
            leadingIcon={<SlidersHorizontal />}
            onClick={() => setSettingsOpen((value) => !value)}
          >
            Preferências
          </Button>
        }
      />

      {settingsOpen && (
        <section className={styles.settingsPanel}>
          <header>
            <div>
              <small>CONFIGURAÇÃO PESSOAL</small>
              <h2>Sons e avisos</h2>
            </div>
            <BellRing />
          </header>
          <div className={styles.settingsGrid}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={preferences.enabled}
                onChange={(event) => setDraft({ ...preferences, enabled: event.target.checked })}
              />
              <span>
                <strong>Receber notificações</strong>
                <small>Eventos permitidos para seu setor e unidade.</small>
              </span>
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={preferences.sound_enabled}
                onChange={(event) =>
                  setDraft({ ...preferences, sound_enabled: event.target.checked })
                }
              />
              <span>
                <strong>Som habilitado</strong>
                <small>O navegador ainda pode exigir interação antes de tocar.</small>
              </span>
            </label>
            <label>
              <span>Som</span>
              <select
                value={preferences.sound_preset_id ?? ''}
                onChange={(event) =>
                  setDraft({ ...preferences, sound_preset_id: event.target.value || null })
                }
              >
                {settings.data.sounds.map((sound) => (
                  <option key={sound.id} value={sound.id}>
                    {sound.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Volume: {Math.round(preferences.volume * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={preferences.volume}
                onChange={(event) =>
                  setDraft({ ...preferences, volume: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <span>Repetições</span>
              <select
                value={preferences.repeat_count}
                onChange={(event) =>
                  setDraft({ ...preferences, repeat_count: Number(event.target.value) })
                }
              >
                {[0, 1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={preferences.speech_enabled}
                onChange={(event) =>
                  setDraft({ ...preferences, speech_enabled: event.target.checked })
                }
              />
              <span>
                <strong>Leitura por voz</strong>
                <small>Usa a voz do próprio dispositivo quando disponível.</small>
              </span>
            </label>
          </div>
          <div className={styles.settingsActions}>
            <Button
              variant="ghost"
              leadingIcon={<Volume2 />}
              onClick={() => {
                const sound = settings.data.sounds.find(
                  (entry) => entry.id === preferences.sound_preset_id,
                );
                if (sound) previewNotificationSound(sound.audio_key, preferences.volume);
              }}
            >
              Testar som
            </Button>
            <Button
              leadingIcon={<Save />}
              loading={saveSettings.isPending}
              onClick={() => void saveSettings.mutateAsync()}
            >
              Salvar preferências
            </Button>
          </div>
        </section>
      )}

      <div className={styles.toolbar}>
        <div className={styles.filterTabs}>
          <button type="button" data-active={onlyUnread} onClick={() => setOnlyUnread(true)}>
            Não lidas
          </button>
          <button type="button" data-active={!onlyUnread} onClick={() => setOnlyUnread(false)}>
            Todas
          </button>
        </div>
        {unread > 0 && (
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<CheckCheck />}
            loading={acknowledgeAll.isPending}
            onClick={() => void acknowledgeAll.mutateAsync()}
          >
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {!notifications.data?.length ? (
        <StatePanel
          kind="empty"
          title={onlyUnread ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}
          description="Os alertas aparecem aqui somente quando o evento pertence ao seu setor, unidade e permissões."
        />
      ) : (
        <section className={styles.notificationList}>
          {notifications.data.map((notification) => (
            <article
              key={notification.id}
              className={styles.notification}
              data-read={Boolean(notification.readAt)}
            >
              <span className={styles.notificationIcon}>
                <Bell />
              </span>
              <div>
                <header>
                  <strong>{notification.title}</strong>
                  <time>{formatDateTime(notification.createdAt)}</time>
                </header>
                <p>{notification.message}</p>
                <div className={styles.notificationActions}>
                  {notification.workOrderId && (
                    <Link to={`/ordens/${notification.workOrderId}`}>
                      Abrir OS <ExternalLink />
                    </Link>
                  )}
                  {!notification.readAt && (
                    <button type="button" onClick={() => acknowledge.mutate(notification.id)}>
                      Marcar como lida
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}
