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
  UserPlus,
  UserRound,
  UsersRound,
  Wrench,
  X,
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
  addWorkOrderPartner,
  assignWorkOrder,
  fetchWorkOrderDetail,
  fetchWorkOrderPartnerCandidates,
  fulfillNeededItem,
  removeWorkOrderPartner,
  transitionWorkOrder,
  uploadWorkOrderMedia,
  type TransitionWorkOrderInput,
  type WorkOrderPartnerCandidate,
} from './work-orders.api';
import styles from './work-order-detail.module.css';

type ActionKind = 'start' | 'waiting_part' | 'resolve' | 'cancel' | 'reopen' | null;

const eventLabels: Record<string, string> = {
  opened: 'Ordem de serviÃ§o aberta',
  assigned: 'ResponsÃ¡vel atribuÃ­do',
  started: 'Atendimento iniciado',
  status_changed: 'Status alterado',
  resolved: 'Ordem de serviÃ§o resolvida',
  cancelled: 'Ordem de serviÃ§o cancelada',
  reopened: 'Ordem de serviÃ§o reaberta',
  commented: 'ComentÃ¡rio registrado',
  needed_item: 'PeÃ§a necessÃ¡ria registrada',
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
  const [partnerProfileId, setPartnerProfileId] = useState('');
  const [partnerNote, setPartnerNote] = useState('');
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
      queryClient.invalidateQueries({ queryKey: ['work-order-partner-candidates', workOrderId] }),
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
      toast.success('Status atualizado e registrado no histÃ³rico.');
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
      toast.success('ComentÃ¡rio adicionado.');
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
      toast.success('Imagem otimizada e anexada com seguranÃ§a.');
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

  const addPartnerMutation = useMutation({
    mutationFn: () => addWorkOrderPartner(workOrderId, partnerProfileId, partnerNote),
    onSuccess: async () => {
      setPartnerProfileId('');
      setPartnerNote('');
      toast.success('Parceiro adicionado ao atendimento.');
      await refresh();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  const removePartnerMutation = useMutation({
    mutationFn: removeWorkOrderPartner,
    onSuccess: async () => {
      toast.success('Parceiro removido da OS.');
      await refresh();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  const summary = detail.data?.summary;
  const summaryAssignedTo = summary?.assigned_to ?? null;
  const canAssign = auth.hasPermission('work_orders.assign') && !summary?.is_terminal;
  const canExecute = auth.hasPermission('work_orders.execute') && !summary?.is_terminal;
  const canResolve = auth.hasPermission('work_orders.resolve') && !summary?.is_terminal;
  const canCancel = auth.hasPermission('work_orders.cancel') && !summary?.is_terminal;
  const canReopen = auth.hasPermission('work_orders.reopen') && Boolean(summary?.is_terminal);
  const assignedToMe = summaryAssignedTo === auth.user?.id;
  const operationallyAssigned = assignedToMe || auth.hasPermission('work_orders.assign.any');
  const canManagePartners = Boolean(
    summaryAssignedTo &&
    canExecute &&
    !summary?.is_terminal &&
    (assignedToMe || auth.hasPermission('work_orders.assign.any')),
  );

  const partnerCandidates = useQuery({
    queryKey: ['work-order-partner-candidates', workOrderId],
    queryFn: () => fetchWorkOrderPartnerCandidates(workOrderId),
    enabled: Boolean(workOrderId && canManagePartners),
  });

  const candidateFirstNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const candidate of partnerCandidates.data ?? []) {
      const first = getFirstName(candidate.display_name).toLocaleLowerCase('pt-BR');
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
    return counts;
  }, [partnerCandidates.data]);

  const availablePartnerCandidates = useMemo(() => {
    const selected = new Set((detail.data?.participants ?? []).map((item) => item.profile_id));
    if (summaryAssignedTo) selected.add(summaryAssignedTo);
    return (partnerCandidates.data ?? []).filter(
      (candidate) => !selected.has(candidate.profile_id),
    );
  }, [detail.data?.participants, partnerCandidates.data, summaryAssignedTo]);

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
        title="OS invÃ¡lida"
        description="O identificador da ordem de serviÃ§o nÃ£o foi informado."
      />
    );
  if (detail.isLoading) return <PageSkeleton />;
  if (detail.isError) {
    return (
      <StatePanel
        kind="error"
        title="NÃ£o foi possÃ­vel abrir a OS"
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
        title="OS nÃ£o encontrada"
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
        ? 'Colocar em aguardando peÃ§a'
        : action === 'resolve'
          ? 'Resolver ordem de serviÃ§o'
          : action === 'cancel'
            ? 'Cancelar ordem de serviÃ§o'
            : 'Reabrir ordem de serviÃ§o';

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to="/ordens">
        <ArrowLeft /> Voltar para Ordens de ServiÃ§o
      </Link>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>OS #{String(summary.number).padStart(6, '0')}</span>
          <h1>{summary.problem_type_name ?? summary.position_name ?? 'ManutenÃ§Ã£o geral'}</h1>
          <p>{summary.description}</p>
          <div className={styles.heroMeta}>
            <span>
              <MapPin /> Postura {summary.posture_number}
              {summary.battery_code ? ` Â· ${summary.battery_code}` : ''}
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
          {summary.is_overdue && !summary?.is_terminal && (
            <span className={styles.overdue}>
              <AlertTriangle /> SLA vencido
            </span>
          )}
        </div>
      </section>

      {!summary?.is_terminal ? (
        <section className={styles.actionBar} aria-label="AÃ§Ãµes operacionais">
          <div>
            <small>RESPONSÃVEL ATUAL</small>
            <strong>{summary.assigned_to_name ?? 'Ainda nÃ£o atribuÃ­da'}</strong>
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
                Aguardar peÃ§a
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
              Ao iniciar, a OS serÃ¡ assumida automaticamente no seu nome e o alarme serÃ¡ encerrado
              para esta ordem.
            </p>
          )}
        </section>
      ) : (
        <section className={styles.readOnlyBanner}>
          <CheckCircle2 />
          <div>
            <strong>OS finalizada â€” modo somente leitura</strong>
            <span>AÃ§Ãµes operacionais foram bloqueadas para proteger o histÃ³rico.</span>
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
                <small>ATENDIMENTO TÃ‰CNICO</small>
                <h2>DiagnÃ³stico e soluÃ§Ã£o</h2>
              </div>
              <Wrench />
            </header>
            <dl className={styles.serviceGrid}>
              <Detail label="DiagnÃ³stico" value={summary.diagnosis} />
              <Detail label="Causa raiz" value={summary.root_cause} />
              <Detail label="ServiÃ§o realizado" value={summary.work_performed} wide />
            </dl>
          </section>

          <section className={styles.panel}>
            <header>
              <div>
                <small>EVIDÃŠNCIAS</small>
                <h2>Fotos da manutenÃ§Ã£o</h2>
              </div>
              <Camera />
            </header>
            {!summary?.is_terminal && (
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
                  <option value="during">Durante o serviÃ§o</option>
                  <option value="after">ApÃ³s conclusÃ£o</option>
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
                  hint="A foto serÃ¡ comprimida para WebP antes do envio."
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
                        alt={media.caption || 'EvidÃªncia da ordem de serviÃ§o'}
                      />
                    ) : (
                      <span className={styles.mediaFallback}>
                        <Camera /> PrÃ©via indisponÃ­vel
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
              <p className={styles.emptyInline}>Nenhuma evidÃªncia fotogrÃ¡fica registrada.</p>
            )}
          </section>

          <section className={styles.panel}>
            <header>
              <div>
                <small>COMUNICAÃ‡ÃƒO</small>
                <h2>ComentÃ¡rios</h2>
              </div>
              <MessageSquarePlus />
            </header>
            {!summary?.is_terminal ? (
              <form
                className={styles.commentForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (comment.trim().length >= 2) void commentMutation.mutateAsync();
                }}
              >
                <FieldFrame id="work-order-comment" label="Adicionar observaÃ§Ã£o">
                  <textarea
                    id="work-order-comment"
                    rows={3}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    minLength={2}
                    maxLength={3000}
                    placeholder="Registre mediÃ§Ãµes, inspeÃ§Ãµes ou informaÃ§Ãµes Ãºteis para a equipe."
                  />
                </FieldFrame>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={internalOnly}
                    onChange={(event) => setInternalOnly(event.target.checked)}
                  />{' '}
                  Somente equipe tÃ©cnica
                </label>
                <Button
                  type="submit"
                  size="sm"
                  loading={commentMutation.isPending}
                  disabled={comment.trim().length < 2}
                  leadingIcon={<Send />}
                >
                  Enviar comentÃ¡rio
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
                        <strong>{entry.profiles?.display_name ?? 'UsuÃ¡rio'}</strong>
                        <time>{formatDateTime(entry.created_at)}</time>
                        {entry.internal_only && <small>Interno</small>}
                      </header>
                      <p>{entry.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyInline}>Nenhum comentÃ¡rio registrado.</p>
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
                    {typeof event.details.display_name === 'string' &&
                      event.details.display_name && <p>{event.details.display_name}</p>}
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
                <h2>VÃ­nculo fÃ­sico</h2>
              </div>
              <MapPin />
            </header>
            <dl className={styles.infoList}>
              <Detail label="Postura" value={String(summary.posture_number).padStart(2, '0')} />
              <Detail label="Bateria" value={summary.battery_code} />
              <Detail label="PosiÃ§Ã£o" value={summary.position_name} />
              <Detail label="Fabricante" value={summary.manufacturer_name} />
              <Detail label="Modelo" value={summary.model_name} />
              <Detail label="CÃ³digo interno" value={summary.asset_internal_code} />
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
                <small>APOIO OPERACIONAL</small>
                <h2>Parceiros da OS</h2>
              </div>
              <UsersRound />
            </header>
            <p className={styles.partnerLead}>
              Registre quem ajudou na opera??o sem trocar o respons?vel principal da OS.
            </p>
            {detail.data.participants.length ? (
              <div className={styles.partnerList}>
                {detail.data.participants.map((partner) => (
                  <article key={partner.id}>
                    <span className={styles.avatar}>
                      {partner.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{partner.display_name}</strong>
                      <small>
                        {partner.sector_name ?? 'Geral'} ? adicionado por{' '}
                        {partner.added_by_name ?? 'sistema'} em {formatDateTime(partner.added_at)}
                      </small>
                      {partner.note && <p>{partner.note}</p>}
                    </div>
                    {canManagePartners && (
                      <button
                        type="button"
                        className={styles.partnerRemove}
                        onClick={() => removePartnerMutation.mutate(partner.id)}
                        aria-label={`Remover ${partner.display_name} do apoio`}
                      >
                        <X />
                      </button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyInline}>Nenhum parceiro de apoio registrado.</p>
            )}

            {canManagePartners ? (
              <form
                className={styles.partnerForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (partnerProfileId) void addPartnerMutation.mutateAsync();
                }}
              >
                <SelectField
                  label="Selecionar parceiro"
                  value={partnerProfileId}
                  onChange={(event) => setPartnerProfileId(event.target.value)}
                >
                  <option value="">Escolha uma pessoa ativa</option>
                  {availablePartnerCandidates.map((candidate) => (
                    <option key={candidate.profile_id} value={candidate.profile_id}>
                      {formatPartnerCandidateLabel(candidate, candidateFirstNameCounts)}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Observa??o opcional"
                  value={partnerNote}
                  maxLength={500}
                  onChange={(event) => setPartnerNote(event.target.value)}
                  placeholder="Ex.: ajudou na troca do motor, medi??o ou teste final."
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  leadingIcon={<UserPlus />}
                  loading={addPartnerMutation.isPending}
                  disabled={!partnerProfileId || partnerCandidates.isLoading}
                >
                  Adicionar parceiro
                </Button>
                {partnerCandidates.isError && (
                  <p className={styles.emptyInline}>{partnerCandidates.error.message}</p>
                )}
              </form>
            ) : !summary?.is_terminal && !summary.assigned_to ? (
              <p className={styles.emptyInline}>Inicie a OS para liberar o registro de apoio.</p>
            ) : null}
          </section>

          <section className={styles.panel}>
            <header>
              <div>
                <small>NECESSIDADES</small>
                <h2>PeÃ§as / materiais</h2>
              </div>
              <Box />
            </header>
            {canExecute && !summary?.is_terminal && (
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
                  label="DescriÃ§Ã£o"
                  value={item.description}
                  required
                  minLength={2}
                  onChange={(event) =>
                    setItem((current) => ({ ...current, description: event.target.value }))
                  }
                />
                <div className={styles.twoFields}>
                  <TextField
                    label="CÃ³digo"
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
                      {needed.code ? ` Â· ${needed.code}` : ''}
                      {needed.fulfilled_at ? ' Â· Atendida' : ''}
                    </span>
                    {needed.manufacturer && <small>{needed.manufacturer}</small>}
                    {needed.notes && <p>{needed.notes}</p>}
                    {canExecute && !summary?.is_terminal && !needed.fulfilled_at && (
                      <button type="button" onClick={() => fulfillMutation.mutate(needed.id)}>
                        Marcar como atendida
                      </button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyInline}>Nenhuma peÃ§a necessÃ¡ria registrada.</p>
            )}
          </section>

          <section className={styles.panel}>
            <header>
              <div>
                <small>CONTROLE</small>
                <h2>Datas e responsÃ¡vel</h2>
              </div>
              <Clock3 />
            </header>
            <dl className={styles.infoList}>
              <Detail label="Solicitante" value={summary.opened_by_name} />
              <Detail label="ResponsÃ¡vel" value={summary.assigned_to_name} />
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
                <FieldFrame id="transition-diagnosis" label="DiagnÃ³stico" required>
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
                <FieldFrame id="transition-work" label="ServiÃ§o realizado" required>
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
              label={action === 'waiting_part' ? 'PeÃ§a necessÃ¡ria / motivo' : 'ObservaÃ§Ã£o'}
              required={action === 'waiting_part' || action === 'cancel'}
            >
              <textarea
                id="transition-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Esta informaÃ§Ã£o ficarÃ¡ registrada na OS."
              />
            </FieldFrame>
          </div>
        }
        confirmLabel={
          action === 'resolve'
            ? 'Confirmar resoluÃ§Ã£o'
            : action === 'cancel'
              ? 'Cancelar OS'
              : action === 'reopen'
                ? 'Reabrir OS'
                : 'Confirmar alteraÃ§Ã£o'
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
      <dd>{value?.trim() || 'NÃ£o informado'}</dd>
    </div>
  );
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || name.trim();
}

function getLastName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function formatPartnerCandidateLabel(
  candidate: WorkOrderPartnerCandidate,
  firstNameCounts: Map<string, number>,
) {
  const first = getFirstName(candidate.display_name);
  const duplicate = (firstNameCounts.get(first.toLocaleLowerCase('pt-BR')) ?? 0) > 1;
  const last = getLastName(candidate.display_name);
  const visibleName = duplicate && last && last !== first ? `${first} ${last}` : first;
  return `${visibleName} / ${candidate.sector_name ?? 'Geral'}`;
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
