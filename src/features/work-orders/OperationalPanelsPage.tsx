import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellRing,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Maximize2,
  Minimize2,
  PackageSearch,
  Play,
  Plus,
  RefreshCw,
  Tv,
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { normalizeError } from '../../lib/errors';
import { useAuth } from '../auth/AuthProvider';
import { silenceAlarm } from '../notifications/alarm-silence';
import {
  acknowledgeWorkOrderNotifications,
  fetchNotifications,
  fetchNotificationSettings,
  startLoopingNotificationSound,
} from '../notifications/notifications.api';
import {
  assignWorkOrder,
  fetchWorkOrders,
  transitionWorkOrder,
  type WorkOrderSummaryRow,
} from './work-orders.api';
import styles from './operational-panels.module.css';

const panels = {
  galponista: {
    title: 'Painel Galponista',
    sectorCode: '',
    permission: 'work_orders.create',
    description: 'Abrir e acompanhar as solicitações que você registrou.',
    tv: false,
  },
  eletrica: {
    title: 'Painel Elétrica',
    sectorCode: 'eletrica',
    permission: 'work_orders.view.electrical',
    description: 'Central de recebimento e atendimento das OS elétricas.',
    tv: true,
  },
  mecanica: {
    title: 'Painel Mecânica',
    sectorCode: 'mecanica',
    permission: 'work_orders.view.mechanical',
    description: 'Central de recebimento e atendimento das OS mecânicas.',
    tv: true,
  },
  civil: {
    title: 'Painel Civil',
    sectorCode: 'civil',
    permission: 'work_orders.view.civil',
    description: 'Central de recebimento e atendimento das OS civis.',
    tv: true,
  },
} as const;

type PanelKey = keyof typeof panels;

const columnConfig = [
  { key: 'awaiting', title: 'Novas OS', icon: BellRing },
  { key: 'in_progress', title: 'Em execução', icon: Play },
  { key: 'waiting_part', title: 'Aguardando peça', icon: PackageSearch },
  { key: 'resolved', title: 'Concluídas recentes', icon: CheckCircle2 },
] as const;

export function OperationalPanelsPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { panel = 'galponista' } = useParams();
  const panelKey: PanelKey = panel in panels ? (panel as PanelKey) : 'galponista';
  const config = panels[panelKey];
  const [tvMode, setTvMode] = useState(false);
  const [silencedUntil, setSilencedUntil] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const alarmStopRef = useRef<(() => void) | null>(null);
  const canAccess =
    auth.hasPermission(config.permission) || auth.hasPermission('work_orders.view.all');

  const list = useQuery({
    queryKey: ['operational-panel', panelKey, auth.user?.id],
    queryFn: () =>
      fetchWorkOrders({
        page: 1,
        pageSize: 120,
        ...(config.sectorCode ? { sectorCode: config.sectorCode } : {}),
        ...(panelKey === 'galponista' && auth.user ? { openedBy: auth.user.id } : {}),
        onlyOpen: panelKey !== 'galponista',
      }),
    enabled: canAccess && Boolean(auth.user?.id),
    refetchInterval: 15_000,
  });
  const notificationFeed = useQuery({
    queryKey: ['operational-panel-notifications', panelKey, auth.user?.id],
    queryFn: () => fetchNotifications(auth.user!.id, true),
    enabled: canAccess && config.tv && Boolean(auth.user?.id),
    refetchInterval: 5_000,
  });
  const notificationSettings = useQuery({
    queryKey: ['notification-settings', auth.user?.id],
    queryFn: () => fetchNotificationSettings(auth.user!.id),
    enabled: canAccess && config.tv && Boolean(auth.user?.id),
  });

  const startMutation = useMutation({
    mutationFn: async (workOrderId: string) => {
      await assignWorkOrder(workOrderId);
      await transitionWorkOrder({
        workOrderId,
        targetStatusCode: 'in_progress',
        note: 'Atendimento iniciado pelo painel operacional.',
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['operational-panel'] });
      await queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      toast.success('OS iniciada e assumida.');
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const rows = useMemo(() => list.data?.rows ?? [], [list.data]);
  const grouped = useMemo(() => groupRows(rows, panelKey === 'galponista'), [rows, panelKey]);
  const awaitingIds = useMemo(
    () =>
      new Set(
        rows.filter((row) => row.semantic_state === 'awaiting').map((row) => row.work_order_id),
      ),
    [rows],
  );
  const panelAlarmNotifications = useMemo(() => {
    if (!config.tv) return [];
    return (notificationFeed.data ?? []).filter(
      (notification) =>
        notification.workOrderId &&
        awaitingIds.has(notification.workOrderId) &&
        ['new_work_order', 'critical_work_order', 'reopened_work_order'].includes(
          notification.eventType,
        ),
    );
  }, [awaitingIds, config.tv, notificationFeed.data]);
  const lastUpdated = new Date();

  useEffect(() => {
    if (alarmStopRef.current) {
      alarmStopRef.current();
      alarmStopRef.current = null;
    }

    const settings = notificationSettings.data;
    const preferences = settings?.preferences;
    const sound = settings?.globalSound;
    if (
      !panelAlarmNotifications.length ||
      !preferences?.enabled ||
      !preferences.sound_enabled ||
      !sound ||
      silencedUntil > Date.now() ||
      isQuietTime(preferences.quiet_hours)
    ) {
      return;
    }

    alarmStopRef.current = startLoopingNotificationSound(sound.audio_key, preferences.volume);

    return () => {
      if (alarmStopRef.current) {
        alarmStopRef.current();
        alarmStopRef.current = null;
      }
    };
  }, [notificationSettings.data, panelAlarmNotifications.length, silencedUntil]);

  function toggleTvMode() {
    const next = !tvMode;
    setTvMode(next);
    if (next) {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    } else if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }

  function silenceForFiveMinutes() {
    const until = silenceAlarm(auth.user?.id ?? '', 5 * 60_000);
    setSilencedUntil(until);
    toast.success('Alarme silenciado por 5 minutos neste computador.');
  }

  async function markWorkOrderSeen(workOrderId: string) {
    try {
      await acknowledgeWorkOrderNotifications(workOrderId);
      await queryClient.invalidateQueries({
        queryKey: ['operational-panel-notifications', panelKey, auth.user?.id],
      });
      await queryClient.invalidateQueries({ queryKey: ['notifications-unread', auth.user?.id] });
      await queryClient.invalidateQueries({ queryKey: ['notifications', auth.user?.id] });
    } catch {
      // Se a notificação já tiver sido lida ou não existir para este usuário, abrir a OS não deve travar.
    }
  }

  if (!canAccess) {
    return (
      <StatePanel
        kind="permission"
        title="Painel não disponível para seu perfil"
        description="A barra lateral mostra somente os painéis liberados para sua função."
      />
    );
  }

  if (list.isLoading) return <PageSkeleton />;

  return (
    <main className={clsx(styles.page, tvMode && styles.tvMode)}>
      {!tvMode && (
        <PageHeader
          eyebrow="CENTRAL OPERACIONAL"
          title={config.title}
          description={config.description}
          actions={
            <div className={styles.headerActions}>
              {panelKey === 'galponista' && (
                <Link className={styles.openButton} to="/ordens/nova">
                  <Plus /> Abrir nova OS
                </Link>
              )}
              {config.tv && (
                <Button leadingIcon={<Tv />} onClick={toggleTvMode}>
                  Modo TV
                </Button>
              )}
            </div>
          }
        />
      )}

      {tvMode && (
        <header className={styles.tvHeader}>
          <div>
            <span>PAINEL AO VIVO</span>
            <h1>{config.title}</h1>
          </div>
          <div className={styles.tvTools}>
            <strong>{formatTime(new Date())}</strong>
            <span>Atualizado {formatTime(lastUpdated)}</span>
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<BellRing />}
              onClick={silenceForFiveMinutes}
            >
              Silenciar 5 min
            </Button>
            <Button size="sm" variant="ghost" leadingIcon={<Minimize2 />} onClick={toggleTvMode}>
              Sair
            </Button>
          </div>
        </header>
      )}

      {list.isError ? (
        <StatePanel
          kind="error"
          title="Não foi possível carregar o painel"
          description={list.error.message}
          actionLabel="Tentar novamente"
          onAction={() => void list.refetch()}
        />
      ) : panelKey === 'galponista' ? (
        <GalponistaPanel rows={rows} />
      ) : (
        <>
          <div className={styles.liveBar}>
            <span>
              <RefreshCw /> Atualiza automaticamente a cada 15 segundos
            </span>
            <span>
              {silencedUntil > currentTime
                ? 'Som silenciado temporariamente'
                : 'Alarme ativo para novas OS'}
            </span>
            {!tvMode && (
              <Button variant="secondary" leadingIcon={<Maximize2 />} onClick={toggleTvMode}>
                Abrir em tela cheia
              </Button>
            )}
          </div>
          <section className={styles.columns}>
            {columnConfig.map((column) => {
              const Icon = column.icon;
              const columnRows = grouped[column.key] ?? [];
              return (
                <article key={column.key} className={styles.column}>
                  <header>
                    <span>
                      <Icon /> {column.title}
                    </span>
                    <strong>{columnRows.length}</strong>
                  </header>
                  <div className={styles.cards}>
                    {columnRows.length ? (
                      columnRows.map((row) => (
                        <WorkOrderPanelCard
                          key={row.work_order_id}
                          row={row}
                          tvMode={tvMode}
                          busy={startMutation.isPending}
                          onOpen={() => void markWorkOrderSeen(row.work_order_id)}
                          onStart={() => {
                            void markWorkOrderSeen(row.work_order_id);
                            startMutation.mutate(row.work_order_id);
                          }}
                        />
                      ))
                    ) : (
                      <p className={styles.emptyColumn}>Sem OS nesta coluna.</p>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}

function GalponistaPanel({ rows }: { rows: WorkOrderSummaryRow[] }) {
  const open = rows.filter((row) => !row.is_terminal);
  const closed = rows.filter((row) => row.is_terminal).slice(0, 8);
  return (
    <section className={styles.galponistaGrid}>
      <div className={styles.galponistaHero}>
        <span>SUAS SOLICITAÇÕES</span>
        <h2>{open.length} OS em acompanhamento</h2>
        <p>Abra chamados, acompanhe status e veja o que já foi concluído.</p>
        <Link to="/ordens/nova">
          <Plus /> Abrir OS agora
        </Link>
      </div>
      <div className={styles.galponistaList}>
        <h2>Em andamento</h2>
        {open.length ? (
          open.map((row) => <SimpleRow key={row.work_order_id} row={row} />)
        ) : (
          <p>Nenhuma OS aberta por você.</p>
        )}
      </div>
      <div className={styles.galponistaList}>
        <h2>Concluídas recentemente</h2>
        {closed.length ? (
          closed.map((row) => <SimpleRow key={row.work_order_id} row={row} />)
        ) : (
          <p>Nenhuma OS concluída recentemente.</p>
        )}
      </div>
    </section>
  );
}

function WorkOrderPanelCard({
  row,
  tvMode,
  busy,
  onOpen,
  onStart,
}: {
  row: WorkOrderSummaryRow;
  tvMode: boolean;
  busy: boolean;
  onOpen: () => void;
  onStart: () => void;
}) {
  return (
    <div className={styles.osCard} data-priority={row.priority_code}>
      <header>
        <strong>OS #{String(row.number).padStart(6, '0')}</strong>
        <span>{row.priority_name}</span>
      </header>
      <h3>{row.problem_type_name ?? row.position_name ?? 'Manutenção geral'}</h3>
      <p>{row.description}</p>
      <dl>
        <div>
          <dt>Local</dt>
          <dd>
            P{row.posture_number}
            {row.battery_code ? ` · ${row.battery_code}` : ''}
          </dd>
        </div>
        <div>
          <dt>Aberta por</dt>
          <dd>{row.opened_by_name}</dd>
        </div>
        <div>
          <dt>Tempo</dt>
          <dd>{formatAge(row.opened_at)}</dd>
        </div>
        <div>
          <dt>Responsável</dt>
          <dd>{row.assigned_to_name ?? 'Livre'}</dd>
        </div>
      </dl>
      <div className={styles.cardActions}>
        {row.semantic_state === 'awaiting' && (
          <Button
            size={tvMode ? 'md' : 'sm'}
            leadingIcon={<Play />}
            loading={busy}
            onClick={onStart}
          >
            Iniciar
          </Button>
        )}
        <Link to={`/ordens/${row.work_order_id}`} onClick={onOpen}>
          Detalhes <ExternalLink />
        </Link>
      </div>
    </div>
  );
}

function SimpleRow({ row }: { row: WorkOrderSummaryRow }) {
  return (
    <Link className={styles.simpleRow} to={`/ordens/${row.work_order_id}`}>
      <strong>#{String(row.number).padStart(6, '0')}</strong>
      <span>
        P{row.posture_number}
        {row.battery_code ? ` · ${row.battery_code}` : ''} — {row.status_name}
      </span>
      <Clock3 />
    </Link>
  );
}

function groupRows(rows: WorkOrderSummaryRow[], galponista: boolean) {
  const groups: Record<string, WorkOrderSummaryRow[]> = {
    awaiting: [],
    in_progress: [],
    waiting_part: [],
    resolved: [],
  };
  for (const row of rows) {
    if (row.semantic_state === 'cancelled') continue;
    if (row.semantic_state === 'resolved') {
      groups.resolved?.push(row);
    } else {
      groups[row.semantic_state]?.push(row);
    }
  }
  for (const key of Object.keys(groups)) {
    groups[key] = groups[key]!.sort((left, right) => {
      const priority = right.priority_weight - left.priority_weight;
      if (priority) return priority;
      return new Date(left.opened_at).getTime() - new Date(right.opened_at).getTime();
    }).slice(0, galponista ? 12 : key === 'resolved' ? 8 : 20);
  }
  return groups;
}

function formatAge(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function isQuietTime(quietHours?: { start?: string; end?: string } | null) {
  if (!quietHours?.start || !quietHours.end) return false;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const [startHour = 0, startMinute = 0] = quietHours.start.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = quietHours.end.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (start === end) return false;
  if (start < end) return current >= start && current <= end;
  return current >= start || current <= end;
}
