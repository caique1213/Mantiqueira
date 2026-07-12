import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Box,
  Camera,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  ImagePlus,
  MapPin,
  MessageSquarePlus,
  PackageSearch,
  Play,
  RotateCcw,
  Send,
  UserRound,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FieldFrame, SelectField, TextField } from '../../components/ui/Field';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { normalizeError } from '../../lib/errors';
import { useAuth } from '../auth/AuthProvider';
import { acknowledgeMany, fetchNotifications } from '../notifications/notifications.api';
import {
  addNeededItem,
  addWorkOrderComment,
  assignWorkOrder,
  fetchWorkOrderDetail,
  fulfillNeededItem,
  transitionWorkOrder,
  uploadWorkOrderMedia,
  type TransitionWorkOrderInput,
} from './work-orders.api';
import styles from './work-order-detail.module.css';

type ActionKind = 'start' | 'waiting_part' | 'resolve' | 'cancel' | 'reopen' | null;

const eventLabels: Record<string, string> = {
  opened: 'Ordem de serviço aberta',
  assigned: 'Responsável atribuído',
  started: 'Atendimento iniciado',
  status_changed: 'Status alterado',
  resolved: 'Ordem de serviço resolvida',
  cancelled: 'Ordem de serviço cancelada',
  reopened: 'Ordem de serviço reaberta',
  commented: 'Comentário registrado',
  needed_item: 'Peça necessária registrada',
};

export function WorkOrderDetailPage() {
  const { workOrderId = '' } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<ActionKind>(null);
  const [note, setNote] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [comment, setComment] = useState('');
  const [internalOnly, setInternalOnly] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'problem' | 'during' | 'after'>('during');
  const [mediaCaption, setMediaCaption] = useState('');
  const [item, setItem] = useState({
    description: '',
    code: '',
    manufacturer: '',
    quantity: '1',
    unit: 'un',
    notes: '',
  });

  const detail = useQuery({
    queryKey: ['work-order-detail', workOrderId],
    queryFn: () => fetchWorkOrderDetail(workOrderId),
    enabled: Boolean(workOrderId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['work-order-detail', workOrderId] }),
      queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['posture-map'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications-unread', auth.user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['notification-alert-feed', auth.user?.id] }),
    ]);
  };

  const transitionMutation = useMutation({
    mutationFn: (input: TransitionWorkOrderInput) => transitionWorkOrder(input),
    onSuccess: async () => {
      toast.success('Status atualizado e registrado no histórico.');
      setAction(null);
      setNote('');
      await refresh();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  const commentMutation = useMutation({
    mutationFn: () => addWorkOrderComment(workOrderId, comment, internalOnly),
    onSuccess: async () => {
      setComment('');
      setInternalOnly(false);
      toast.success('Comentário adicionado.');
      await refresh();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  const itemMutation = useMutation({
    mutationFn: () =>
      addNeededItem({
        workOrderId,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        ...(item.code.trim() ? { code: item.code.trim() } : {}),
        ...(item.manufacturer.trim() ? { manufacturer: item.manufacturer.trim() } : {}),
        ...(item.notes.trim() ? { notes: item.notes.trim() } : {}),
      }),
    onSuccess: async () => {
      setItem({
        description: '',
        code: '',
        manufacturer: '',
        quantity: '1',
        unit: 'un',
        notes: '',
      });
      setItemOpen(false);
      toast.success('Necessidade registrada na OS.');
      await refresh();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  const mediaMutation = useMutation({
    mutationFn: () =>
      uploadWorkOrderMedia({
        workOrderId,
        siteId: detail.data!.summary.site_id,
        file: mediaFile!,
        mediaType,
        caption: mediaCaption,
      }),
    onSuccess: async () => {
      setMediaFile(null);
      setMediaCaption('');
      setMediaOpen(false);
      toast.success('Imagem otimizada e anexada com segurança.');
      await refresh();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });
  const fulfillMutation = useMutation({
    mutationFn: fulfillNeededItem,
    onSuccess: async () => {
      toast.success('Necessidade marcada como atendida.');
      await refresh();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  const summary = detail.data?.summary;
  const canAssign = auth.hasPermission('work_orders.assign') && !summary?.is_terminal;
  const canExecute = auth.hasPermission('work_orders.execute') && !summary?.is_terminal;
  const canResolve = auth.hasPermission('work_orders.resolve') && !summary?.is_terminal;
  const canCancel = auth.hasPermission('work_orders.cancel') && !summary?.is_terminal;
  const canReopen = auth.hasPermission('work_orders.reopen') && Boolean(summary?.is_terminal);
  const assignedToMe = summary?.assigned_to === auth.user?.id;
  const operationallyAssigned = assignedToMe || auth.hasPermission('work_orders.assign.any');

  useEffect(() => {
    const profileId = auth.user?.id;
    if (!profileId || !workOrderId) return;
    let cancelled = false;
    void fetchNotifications(profileId, true)
      .then(async (items) => {
        if (cancelled) return;
        const matching = items
          .filter((item) => item.workOrderId === workOrderId)
          .map((item) => item.id);
        if (!matching.length) return;
        await acknowledgeMany(matching);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['notifications-unread', profileId] }),
          queryClient.invalidateQueries({ queryKey: ['notification-alert-feed', profileId] }),
          queryClient.invalidateQueries({ queryKey: ['notifications', profileId] }),
        ]);
      })
      .catch(() => {
        // Se marcar como lida falhar, a tela da OS continua funcionando normalmente.
      });
    return () => {
      cancelled = true;
    };
  }, [auth.user?.id, queryClient, workOrderId]);

  const timeline = useMemo(() => {
    if (!detail.data) return [];
    return [...detail.data.events].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }, [detail.data]);

  if (!workOrderId)
    return (
      <StatePanel
        kind="empty"
        title="OS inválida"
        description="O identificador da ordem de serviço não foi informado."
      />
    );
  if (detail.isLoading) return <PageSkeleton />;
  if (detail.isError) {
    return (
      <StatePanel
        kind="error"
        title="Não foi possível abrir a OS"
        description={detail.error.message}
        actionLabel="Tentar novamente"
        onAction={() => void detail.refetch()}
      />
    );
  }
  if (!detail.data || !summary)
    return (
      <StatePanel
        kind="empty"
        title="OS não encontrada"
        description="O chamado pode estar fora das unidades permitidas para o seu perfil."
      />
    );

  const openAction = (next: Exclude<ActionKind, null>) => {
    setDiagnosis(summary.diagnosis ?? '');
    setRootCause(summary.root_cause ?? '');
    setWorkPerformed(summary.work_performed ?? '');
    setNote('');
    setAction(next);
  };

  const submitTransition = async () => {
    if (!action) return;
    if (
      action === 'start' &&
      summary?.semantic_state === 'awaiting' &&
      !operationallyAssigned &&
      canAssign
    ) {
      await assignWorkOrder(workOrderId);
    }
    const targetStatusCode =
      action === 'start'
        ? 'in_progress'
        : action === 'waiting_part'
          ? 'waiting_part'
          : action === 'resolve'
            ? 'resolved'
            : action === 'cancel'
              ? 'cancelled'
              : 'awaiting';
    await transitionMutation.mutateAsync({
      workOrderId,
      targetStatusCode,
      note,
      ...(action === 'resolve' ? { diagnosis, rootCause, workPerformed } : {}),
      ...(action === 'reopen'
        ? { confirmation: 'REABRIR' }
        : action === 'cancel'
          ? { confirmation: 'CANCELAR' }
          : {}),
    });
  };

  const actionTitle =
    action === 'start'
      ? 'Iniciar atendimento'
      : action === 'waiting_part'
        ? 'Colocar em aguardando peça'
        : action === 'resolve'
          ? 'Resolver ordem de serviço'
          : action === 'cancel'
            ? 'Cancelar ordem de serviço'
            : 'Reabrir ordem de serviço';

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to="/ordens">
        <ArrowLeft /> Voltar para Ordens de Serviço
      </Link>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>OS #{String(summary.number).padStart(6, '0')}</span>
          <h1>{summary.problem_type_name ?? summary.position_name ?? 'Manutenção geral'}</h1>
          <p>{summary.description}</p>
          <div className={styles.heroMeta}>
            <span>
              <MapPin /> Postura {summary.posture_number}
              {summary.battery_code ? ` · ${summary.battery_code}` : ''}
            </span>
            <span>
              <Wrench /> {summary.sector_name}
            </span>
            <span>
              <UserRound /> {summary.opened_by_name}
            </span>
            <span>
              <Clock3 /> {formatDateTime(summary.opened_at)}
            </span>
          </div>
        </div>
        <div className={styles.heroStatus}>
          <span className={styles.status} data-state={summary.semantic_state}>
            {summary.status_name}
          </span>
          <span className={styles.priority} data-priority={summary.priority_code}>
            {summary.priority_name}
          </span>
          {summary.is_overdue && !summary.is_terminal && (
            <span className={styles.overdue}>
              <AlertTriangle /> SLA vencido
            </span>
          )}
        </div>
      </section>

      {!summary.is_terminal ? (
        <section className={styles.actionBar} aria-label="Ações operacionais">
          <div>
            <small>RESPONSÁVEL ATUAL</small>
            <strong>{summary.assigned_to_name ?? 'Ainda não atribuída'}</strong>
          </div>
          <div className={styles.actionButtons}>
            {canExecute &&
              (operationallyAssigned || canAssign) &&
              summary.semantic_state === 'awaiting' && (
              <Button leadingIcon={<Play />} onClick={() => openAction('start')}>
                Iniciar atendimento
              </Button>
              )}
            {canExecute && operationallyAssigned && summary.semantic_state === 'waiting_part' && (
              <Button leadingIcon={<Play />} onClick={() => openAction('start')}>
                Retomar
              </Button>
            )}
            {canExecute && operationallyAssigned && summary.semantic_state === 'in_progress' && (
              <Button
                variant="secondary"
                leadingIcon={<PackageSearch />}
                onClick={() => openAction('waiting_part')}
              >
                Aguardar peça
              </Button>
            )}
            {canResolve &&
              operationallyAssigned &&
              ['in_progress', 'waiting_part'].includes(summary.semantic_state) && (
                <Button leadingIcon={<CheckCircle2 />} onClick={() => openAction('resolve')}>
                  Resolver
                </Button>
              )}
            {canCancel && (
              <Button variant="danger" leadingIcon={<Ban />} onClick={() => openAction('cancel')}>
                Cancelar
              </Button>
            )}
          </div>
          {canExecute && canAssign && !operationallyAssigned && (
            <p className={styles.assignmentHint}>
              Ao iniciar, a OS será assumida automaticamente no seu nome e o alarme será encerrado
              para esta ordem.
            </p>
          )}
        </section>
      ) : (
        <section className={styles.readOnlyBanner}>
          <CheckCircle2 />
          <div>
            <strong>OS finalizada — modo somente leitura</strong>
            <span>Ações operacionais foram bloqueadas para proteger o histórico.</span>
          </div>
          {canReopen && (
            <Button
              variant="secondary"
              leadingIcon={<RotateCcw />}
              onClick={() => openAction('reopen')}
            >
              Reabrir
            </Button>
          )}
        </section>
      )}

      <div className={styles.mainGrid}>
        <div className={styles.primaryColumn}>
          <section className={styles.panel}>
            <header>
              <div>
                <small>ATENDIMENTO TÉCNICO</small>
                <h2>Diagnóstico e solução</h2>
              </div>
              <Wrench />
            </header>
            <dl className={styles.serviceGrid}>
              <Detail label="Diagnóstico" value={summary.diagnosis} />
              <Detail label="Causa raiz" value={summary.root_cause} />
              <Detail label="Serviço realizado" value={summary.work_performed} wide />
            </dl>
          </section>

          <section className={styles.panel}>
            <header>
              <div>
                <small>EVIDÊNCIAS</small>
                <h2>Fotos da manutenção</h2>
              </div>
              <Camera />
            </header>
            {!summary.is_terminal && (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<ImagePlus />}
                onClick={() => setMediaOpen((value) => !value)}
              >
                Adicionar foto
              </Button>
            )}
            {mediaOpen && (
              <form
                className={styles.mediaForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (mediaFile) void mediaMutation.mutateAsync();
                }}
              >
                <SelectField
                  label="Momento"
                  value={mediaType}
                  onChange={(event) => setMediaType(event.target.value as typeof mediaType)}
                >
                  <option value="problem">Problema</option>
                  <option value="during">Durante o serviço</option>
                  <option value="after">Após conclusão</option>
                </SelectField>
                <TextField
                  label="Legenda"
                  value={mediaCaption}
                  maxLength={300}
                  onChange={(event) => setMediaCaption(event.target.value)}
                  placeholder="Explique o que aparece na foto."
                />
                <FieldFrame
                  id="work-order-photo"
                  label="Imagem"
                  required
                  hint="A foto será comprimida para WebP antes do envio."
                >
                  <input
                    id="work-order-photo"
                    className={styles.fileInput}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    required
                    onChange={(event) => setMediaFile(event.target.files?.[0] ?? null)}
                  />
                </FieldFrame>
                <Button
                  type="submit"
                  size="sm"
                  loading={mediaMutation.isPending}
                  disabled={!mediaFile}
                >
                  Enviar foto
                </Button>
              </form>
            )}
            {detail.data.media.length ? (
              <div className={styles.mediaGrid}>
                {detail.data.media.map((media) => (
                  <figure key={media.id}>
                    {media.signedUrl ? (
                      <img
                        src={media.signedUrl}
                        alt={media.caption || 'Evidência da ordem de serviço'}
                      />
                    ) : (
                      <span className={styles.mediaFallback}>
                        <Camera /> Prévia indisponível
                      </span>
                    )}
                    <figcaption>
                      <strong>{mediaTypeLabel(media.media_type)}</strong>
                      <span>{media.caption || formatDateTime(media.created_at)}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className={styles.emptyInline}>Nenhuma evidência fotográfica registrada.</p>
            )}
          </section>

          <section className={styles.panel}>
            <header>
              <div>
                <small>COMUNICAÇÃO</small>
                <h2>Comentários</h2>
              </div>
              <MessageSquarePlus />
            </header>
            {!summary.is_terminal ? (
              <form
                className={styles.commentForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (comment.trim().length >= 2) void commentMutation.mutateAsync();
                }}
              >
                <FieldFrame id="work-order-comment" label="Adicionar observação">
                  <textarea
                    id="work-order-comment"
                    rows={3}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    minLength={2}
                    maxLength={3000}
                    placeholder="Registre medições, inspeções ou informações úteis para a equipe."
                  />
                </FieldFrame>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={internalOnly}
                    onChange={(event) => setInternalOnly(event.target.checked)}
                  />{' '}
                  Somente equipe técnica
                </label>
                <Button
                  type="submit"
                  size="sm"
                  loading={commentMutation.isPending}
                  disabled={comment.trim().length < 2}
                  leadingIcon={<Send />}
                >
                  Enviar comentário
                </Button>
              </form>
            ) : null}
            {detail.data.comments.length ? (
              <div className={styles.commentList}>
                {detail.data.comments.map((entry) => (
                  <article key={entry.id}>
                    <span className={styles.avatar}>
                      {entry.profiles?.display_name?.slice(0, 1).toUpperCase() ?? '?'}
                    </span>
                    <div>
                      <header>
                        <strong>{entry.profiles?.display_name ?? 'Usuário'}</strong>
                        <time>{formatDateTime(entry.created_at)}</time>
                        {entry.internal_only && <small>Interno</small>}
                      </header>
                      <p>{entry.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyInline}>Nenhum comentário registrado.</p>
            )}
          </section>

          <section className={styles.panel}>
            <header>
              <div>
                <small>RASTREABILIDADE</small>
                <h2>Linha do tempo</h2>
              </div>
              <History />
            </header>
            <ol className={styles.timeline}>
              {timeline.map((event) => (
                <li key={event.id}>
                  <span />
                  <div>
                    <time>{formatDateTime(event.occurred_at)}</time>
                    <h3>{eventLabels[event.event_type] ?? event.event_type}</h3>
                    {typeof event.details.note === 'string' && event.details.note && (
                      <p>{event.details.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel}>
            <header>
              <div>
                <small>LOCAL E ATIVO</small>
                <h2>Vínculo físico</h2>
              </div>
              <MapPin />
            </header>
            <dl className={styles.infoList}>
              <Detail label="Postura" value={String(summary.posture_number).padStart(2, '0')} />
              <Detail label="Bateria" value={summary.battery_code} />
              <Detail label="Posição" value={summary.position_name} />
              <Detail label="Fabricante" value={summary.manufacturer_name} />
              <Detail label="Modelo" value={summary.model_name} />
              <Detail label="Código interno" value={summary.asset_internal_code} />
            </dl>
            <div className={styles.linkRow}>
              <Link to={`/posturas/${summary.posture_number}`}>
                Abrir postura <ExternalLink />
              </Link>
              {summary.asset_id && (
                <Link to={`/ativos/${summary.asset_id}`}>
                  Abrir ativo <ExternalLink />
                </Link>
              )}
            </div>
          </section>

          <section className={styles.panel}>
            <header>
              <div>
                <small>NECESSIDADES</small>
                <h2>Peças / materiais</h2>
              </div>
              <Box />
            </header>
            {canExecute && !summary.is_terminal && (
              <Button
                fullWidth
                variant="secondary"
                leadingIcon={<PackageSearch />}
                onClick={() => setItemOpen((value) => !value)}
              >
                Registrar necessidade
              </Button>
            )}
            {itemOpen && (
              <form
                className={styles.itemForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  void itemMutation.mutateAsync();
                }}
              >
                <TextField
                  label="Descrição"
                  value={item.description}
                  required
                  minLength={2}
                  onChange={(event) =>
                    setItem((current) => ({ ...current, description: event.target.value }))
                  }
                />
                <div className={styles.twoFields}>
                  <TextField
                    label="Código"
                    value={item.code}
                    onChange={(event) =>
                      setItem((current) => ({ ...current, code: event.target.value }))
                    }
                  />
                  <TextField
                    label="Fabricante"
                    value={item.manufacturer}
                    onChange={(event) =>
                      setItem((current) => ({ ...current, manufacturer: event.target.value }))
                    }
                  />
                </div>
                <div className={styles.twoFields}>
                  <TextField
                    label="Quantidade"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    required
                    onChange={(event) =>
                      setItem((current) => ({ ...current, quantity: event.target.value }))
                    }
                  />
                  <SelectField
                    label="Unidade"
                    value={item.unit}
                    onChange={(event) =>
                      setItem((current) => ({ ...current, unit: event.target.value }))
                    }
                  >
                    <option value="un">un</option>
                    <option value="m">m</option>
                    <option value="kg">kg</option>
                    <option value="l">l</option>
                    <option value="jogo">jogo</option>
                  </SelectField>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  loading={itemMutation.isPending}
                  disabled={item.description.trim().length < 2}
                >
                  Salvar necessidade
                </Button>
              </form>
            )}
            {detail.data.neededItems.length ? (
              <div className={styles.itemList}>
                {detail.data.neededItems.map((needed) => (
                  <article key={needed.id} data-fulfilled={Boolean(needed.fulfilled_at)}>
                    <strong>{needed.description}</strong>
                    <span>
                      {needed.estimated_quantity} {needed.unit}
                      {needed.code ? ` · ${needed.code}` : ''}
                      {needed.fulfilled_at ? ' · Atendida' : ''}
                    </span>
                    {needed.manufacturer && <small>{needed.manufacturer}</small>}
                    {needed.notes && <p>{needed.notes}</p>}
                    {canExecute && !summary.is_terminal && !needed.fulfilled_at && (
                      <button type="button" onClick={() => fulfillMutation.mutate(needed.id)}>
                        Marcar como atendida
                      </button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyInline}>Nenhuma peça necessária registrada.</p>
            )}
          </section>

          <section className={styles.panel}>
            <header>
              <div>
                <small>CONTROLE</small>
                <h2>Datas e responsável</h2>
              </div>
              <Clock3 />
            </header>
            <dl className={styles.infoList}>
              <Detail label="Solicitante" value={summary.opened_by_name} />
              <Detail label="Responsável" value={summary.assigned_to_name} />
              <Detail label="Aberta em" value={formatDateTime(summary.opened_at)} />
              <Detail
                label="Iniciada em"
                value={summary.started_at ? formatDateTime(summary.started_at) : null}
              />
              <Detail
                label="Prazo"
                value={summary.due_at ? formatDateTime(summary.due_at) : null}
              />
              <Detail
                label="Encerrada em"
                value={
                  summary.resolved_at
                    ? formatDateTime(summary.resolved_at)
                    : summary.cancelled_at
                      ? formatDateTime(summary.cancelled_at)
                      : null
                }
              />
            </dl>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={actionTitle}
        description={
          <div className={styles.transitionForm}>
            {action === 'resolve' && (
              <>
                <FieldFrame id="transition-diagnosis" label="Diagnóstico" required>
                  <textarea
                    id="transition-diagnosis"
                    rows={3}
                    value={diagnosis}
                    onChange={(event) => setDiagnosis(event.target.value)}
                  />
                </FieldFrame>
                <FieldFrame id="transition-root" label="Causa raiz">
                  <textarea
                    id="transition-root"
                    rows={2}
                    value={rootCause}
                    onChange={(event) => setRootCause(event.target.value)}
                  />
                </FieldFrame>
                <FieldFrame id="transition-work" label="Serviço realizado" required>
                  <textarea
                    id="transition-work"
                    rows={3}
                    value={workPerformed}
                    onChange={(event) => setWorkPerformed(event.target.value)}
                  />
                </FieldFrame>
              </>
            )}
            <FieldFrame
              id="transition-note"
              label={action === 'waiting_part' ? 'Peça necessária / motivo' : 'Observação'}
              required={action === 'waiting_part' || action === 'cancel'}
            >
              <textarea
                id="transition-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Esta informação ficará registrada na OS."
              />
            </FieldFrame>
          </div>
        }
        confirmLabel={
          action === 'resolve'
            ? 'Confirmar resolução'
            : action === 'cancel'
              ? 'Cancelar OS'
              : action === 'reopen'
                ? 'Reabrir OS'
                : 'Confirmar alteração'
        }
        tone={action === 'cancel' || action === 'reopen' ? 'danger' : 'default'}
        {...(action === 'cancel'
          ? { typedConfirmation: 'CANCELAR' }
          : action === 'reopen'
            ? { typedConfirmation: 'REABRIR' }
            : {})}
        busy={transitionMutation.isPending}
        onConfirm={submitTransition}
      />
    </main>
  );
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string | null | undefined;
  wide?: boolean;
}) {
  return (
    <div data-wide={wide || undefined}>
      <dt>{label}</dt>
      <dd>{value?.trim() || 'Não informado'}</dd>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function mediaTypeLabel(value: 'problem' | 'during' | 'after' | 'document') {
  if (value === 'problem') return 'Problema';
  if (value === 'during') return 'Durante';
  if (value === 'after') return 'Depois';
  return 'Documento';
}
