import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, MessageSquareWarning, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { normalizeError } from '../../lib/errors';
import { useAuth } from '../auth/AuthProvider';
import { fetchAppBootstrap } from '../dashboard/dashboard.api';
import {
  createFeedback,
  fetchFeedbackItems,
  updateFeedbackStatus,
  type FeedbackItem,
} from './feedback.api';
import styles from './feedback.module.css';

const typeOptions = [
  ['bug', 'Erro no sistema'],
  ['suggestion', 'Sugestão de melhoria'],
  ['question', 'Dúvida'],
  ['visual', 'Problema visual'],
  ['mobile', 'Problema no celular'],
  ['wrong_data', 'Dados errados'],
  ['other', 'Outro'],
];

const pageOptions = [
  'Início',
  'Abrir OS',
  'Painel Elétrica',
  'Painel Mecânica',
  'Painel Civil',
  'Painel Galponista',
  'Mapa das Posturas',
  'Inventário Técnico',
  'Administração',
  'Outro',
];

const priorityOptions = [
  ['low', 'Baixa'],
  ['medium', 'Média'],
  ['high', 'Alta'],
  ['blocked', 'Travou meu uso'],
];

const statusOptions = [
  ['open', 'Aberto'],
  ['reviewing', 'Em análise'],
  ['planned', 'Planejado'],
  ['fixed', 'Corrigido'],
  ['rejected', 'Recusado'],
  ['answered', 'Respondido'],
];

export function FeedbackPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canManage = auth.hasPermission('feedback.manage');
  const bootstrap = useQuery({ queryKey: ['app-bootstrap'], queryFn: fetchAppBootstrap });
  const feedback = useQuery({
    queryKey: ['feedback-items', canManage],
    queryFn: () => fetchFeedbackItems(canManage),
  });
  const [form, setForm] = useState({
    type: 'bug',
    page: pageOptions[0]!,
    title: '',
    description: '',
    priority: 'medium',
    file: null as File | null,
  });

  const canSubmit = form.title.trim().length >= 3 && form.description.trim().length >= 5;
  const siteId = bootstrap.data?.site?.id ?? '';

  const createMutation = useMutation({
    mutationFn: () =>
      createFeedback({
        siteId,
        type: form.type,
        page: form.page,
        title: form.title,
        description: form.description,
        priority: form.priority,
        file: form.file,
      }),
    onSuccess: async () => {
      setForm({
        type: 'bug',
        page: pageOptions[0]!,
        title: '',
        description: '',
        priority: 'medium',
        file: null,
      });
      await queryClient.invalidateQueries({ queryKey: ['feedback-items'] });
      toast.success('Feedback enviado. Isso ajuda muito na fase de teste.');
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  const updateMutation = useMutation({
    mutationFn: updateFeedbackStatus,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feedback-items'] });
      toast.success('Feedback atualizado.');
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  const grouped = useMemo(() => feedback.data ?? [], [feedback.data]);

  if (bootstrap.isLoading || feedback.isLoading) return <PageSkeleton />;
  if (!siteId) {
    return (
      <StatePanel
        kind="configuration"
        title="Unidade não encontrada"
        description="Não foi possível identificar a unidade padrão para gravar o feedback."
      />
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.betaBanner}>
        <AlertTriangle />
        <span>
          <strong>Fase de teste</strong> — encontrou erro, tela estranha ou ideia de melhoria?
          Registre aqui para não se perder no WhatsApp.
        </span>
      </div>
      <PageHeader
        eyebrow="BETA / MELHORIA CONTÍNUA"
        title="Feedback do sistema"
        description="Canal oficial para erros, sugestões, problema visual, celular e dados incorretos."
      />

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Enviar novo feedback</h2>
          <p>Descreva o que aconteceu. Se puder, anexe um print da tela.</p>
          <div className={styles.form}>
            <label className={styles.field}>
              <span>Tipo</span>
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                {typeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Página</span>
              <select value={form.page} onChange={(event) => setForm({ ...form, page: event.target.value })}>
                {pageOptions.map((page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Prioridade</span>
              <select
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
              >
                {priorityOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Título curto</span>
              <input
                value={form.title}
                maxLength={140}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Ex: botão invisível no tema escuro"
              />
            </label>
            <label className={styles.field}>
              <span>Descrição</span>
              <textarea
                value={form.description}
                maxLength={4000}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Conte o que você tentou fazer, o que apareceu e o que esperava."
              />
            </label>
            <label className={styles.field}>
              <span>Print ou foto</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) => setForm({ ...form, file: event.target.files?.[0] ?? null })}
              />
            </label>
            <div className={styles.actions}>
              <Button
                leadingIcon={<Send />}
                disabled={!canSubmit || createMutation.isPending}
                loading={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Enviar feedback
              </Button>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <h2>{canManage ? 'Feedbacks recebidos' : 'Meus feedbacks'}</h2>
          <p>
            {canManage
              ? 'Admin pode mudar status, responder e acompanhar correções.'
              : 'Aqui ficam os registros que você enviou.'}
          </p>
          {!grouped.length ? (
            <StatePanel
              compact
              kind="empty"
              title="Nenhum feedback ainda"
              description="Quando alguém enviar, ele aparecerá aqui."
            />
          ) : (
            <div className={styles.list}>
              {grouped.map((item) => (
                <FeedbackCard
                  key={item.id}
                  item={item}
                  canManage={canManage}
                  onUpdate={(status, adminResponse) =>
                    updateMutation.mutate({ id: item.id, status, adminResponse })
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FeedbackCard({
  item,
  canManage,
  onUpdate,
}: {
  item: FeedbackItem;
  canManage: boolean;
  onUpdate: (status: string, adminResponse: string) => void;
}) {
  const [status, setStatus] = useState(item.status);
  const [response, setResponse] = useState(item.admin_response);
  return (
    <article className={styles.feedbackCard}>
      <header>
        <div>
          <div className={styles.badges}>
            <span className={styles.badge}>{labelOf(typeOptions, item.type)}</span>
            <span className={styles.badge} data-priority={item.priority}>
              {labelOf(priorityOptions, item.priority)}
            </span>
            <span className={styles.badge}>{labelOf(statusOptions, item.status)}</span>
          </div>
          <h3>{item.title}</h3>
        </div>
        {canManage && <ShieldCheck aria-label="Visão administrativa" />}
      </header>
      <div className={styles.meta}>
        <span className={styles.badge}>{item.page || 'Página não informada'}</span>
        <span className={styles.badge}>{formatDateTime(item.created_at)}</span>
        {item.profiles?.display_name && (
          <span className={styles.badge}>Enviado por {item.profiles.display_name}</span>
        )}
      </div>
      <p>{item.description}</p>
      {item.media.map((media) =>
        media.signedUrl ? (
          <a key={media.id} className={styles.attachment} href={media.signedUrl} target="_blank">
            <MessageSquareWarning /> Abrir anexo <ExternalLink />
          </a>
        ) : null,
      )}
      {item.admin_response && <p>Resposta: {item.admin_response}</p>}
      {canManage && (
        <div className={styles.adminTools}>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            placeholder="Resposta ou observação administrativa"
          />
          <Button size="sm" onClick={() => onUpdate(status, response)}>
            Salvar
          </Button>
        </div>
      )}
    </article>
  );
}

function labelOf(options: string[][], value: string) {
  return options.find((option) => option[0] === value)?.[1] ?? value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}
