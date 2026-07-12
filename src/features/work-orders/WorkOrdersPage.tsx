import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ClipboardPlus,
  Download,
  FilterX,
  MapPin,
  Plus,
  Search,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { FilterBar } from '../../components/ui/FilterBar';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { SelectField, TextField } from '../../components/ui/Field';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAuth } from '../auth/AuthProvider';
import { fetchWorkOrderCatalogs, fetchWorkOrders } from './work-orders.api';
import styles from './work-orders-page.module.css';

const PAGE_SIZE = 18;
const RECEIVING_PANELS = [
  { code: '', label: 'Geral', description: 'Todas as OS que você tem permissão para receber' },
  { code: 'eletrica', label: 'Elétrica', description: 'Painel dos eletricistas' },
  { code: 'mecanica', label: 'Mecânica', description: 'Painel da mecânica' },
  { code: 'civil', label: 'Civil', description: 'Painel da manutenção civil' },
] as const;

export function WorkOrdersPage() {
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(search, 300);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const status = searchParams.get('status') ?? '';
  const sector = searchParams.get('sector') ?? '';
  const priority = searchParams.get('priority') ?? '';
  const posture = Number(searchParams.get('posture') ?? 0) || undefined;
  const mine = searchParams.get('mine') === '1';
  const openedByMe = searchParams.get('openedByMe') === '1';
  const onlyOpen = searchParams.get('open') !== '0';

  const catalogs = useQuery({ queryKey: ['work-order-catalogs'], queryFn: fetchWorkOrderCatalogs });
  const list = useQuery({
    queryKey: [
      'work-orders',
      page,
      debouncedSearch,
      status,
      sector,
      priority,
      posture,
      mine,
      openedByMe,
      onlyOpen,
    ],
    queryFn: () =>
      fetchWorkOrders({
        page,
        pageSize: PAGE_SIZE,
        ...(debouncedSearch.trim() ? { query: debouncedSearch.trim() } : {}),
        ...(status ? { statusCode: status } : {}),
        ...(sector ? { sectorCode: sector } : {}),
        ...(priority ? { priorityCode: priority } : {}),
        ...(posture ? { postureNumber: posture } : {}),
        ...(mine && auth.user ? { assignedTo: auth.user.id } : {}),
        ...(openedByMe && auth.user ? { openedBy: auth.user.id } : {}),
        onlyOpen,
      }),
  });

  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (debouncedSearch === current) return;
    setSearchParams((params) => {
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
      else params.delete('q');
      params.delete('page');
      return params;
    });
  }, [debouncedSearch, searchParams, setSearchParams]);

  function setFilter(key: string, value: string) {
    setSearchParams((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete('page');
      return params;
    });
  }

  function clearFilters() {
    setSearch('');
    setSearchParams({ open: '1' });
  }

  function setReceivingPanel(panelSector: string) {
    setSearchParams((params) => {
      if (panelSector) params.set('sector', panelSector);
      else params.delete('sector');
      params.delete('mine');
      params.delete('openedByMe');
      params.set('open', '1');
      params.delete('page');
      return params;
    });
  }

  function showMyReport() {
    setSearchParams((params) => {
      params.set('mine', '1');
      params.set('open', '0');
      params.delete('openedByMe');
      params.delete('page');
      return params;
    });
  }

  function showMyRequests() {
    setSearchParams((params) => {
      params.set('openedByMe', '1');
      params.set('open', '0');
      params.delete('mine');
      params.delete('page');
      return params;
    });
  }

  function exportCurrentRows() {
    const rows = list.data?.rows ?? [];
    if (!rows.length) return;
    const headers = [
      'OS',
      'Status',
      'Setor',
      'Prioridade',
      'Postura',
      'Bateria',
      'Posicao',
      'Aberta por',
      'Responsavel',
      'Aberta em',
      'Assumida em',
      'Iniciada em',
      'Resolvida em',
      'Cancelada em',
      'Descricao',
    ];
    const csvRows = rows.map((row) =>
      [
        String(row.number).padStart(6, '0'),
        row.status_name,
        row.sector_name,
        row.priority_name,
        String(row.posture_number),
        row.battery_code ?? '',
        row.position_name ?? '',
        row.opened_by_name,
        row.assigned_to_name ?? '',
        formatDateTime(row.opened_at),
        formatDateTime(row.assigned_at),
        formatDateTime(row.started_at),
        formatDateTime(row.resolved_at),
        formatDateTime(row.cancelled_at),
        row.description,
      ].map(csvCell),
    );
    const csv = [headers.map(csvCell), ...csvRows].map((row) => row.join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-os-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (catalogs.isLoading && list.isLoading) return <PageSkeleton />;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="MANUTENÇÃO"
        title="Ordens de Serviço"
        description="Chamados ligados ao local físico, ao ativo instalado e ao histórico técnico correto."
        actions={
          <Link className={styles.newButton} to="/ordens/nova">
            <Plus /> Abrir OS
          </Link>
        }
      />

      <section className={styles.receivingPanels} aria-label="Painéis de recebimento de OS">
        {RECEIVING_PANELS.map((panel) => (
          <button
            key={panel.label}
            type="button"
            data-active={sector === panel.code && !mine && !openedByMe}
            onClick={() => setReceivingPanel(panel.code)}
          >
            <span>
              <BellRing />
              {panel.label}
            </span>
            <small>{panel.description}</small>
          </button>
        ))}
      </section>

      <FilterBar
        actions={
          <Button variant="ghost" size="sm" leadingIcon={<FilterX />} onClick={clearFilters}>
            Limpar
          </Button>
        }
      >
        <div className={styles.searchField}>
          <Search />
          <TextField
            label="Pesquisar"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Número, descrição, marca..."
          />
        </div>
        <SelectField
          label="Status"
          value={status}
          onChange={(event) => setFilter('status', event.target.value)}
        >
          <option value="">Todos</option>
          {catalogs.data?.statuses.map((item) => (
            <option key={item.id} value={item.code}>
              {item.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Setor"
          value={sector}
          onChange={(event) => setFilter('sector', event.target.value)}
        >
          <option value="">Todos</option>
          {catalogs.data?.sectors.map((item) => (
            <option key={item.id} value={item.code}>
              {item.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Prioridade"
          value={priority}
          onChange={(event) => setFilter('priority', event.target.value)}
        >
          <option value="">Todas</option>
          {catalogs.data?.priorities.map((item) => (
            <option key={item.id} value={item.code}>
              {item.label}
            </option>
          ))}
        </SelectField>
      </FilterBar>

      <div className={styles.quickFilters}>
        <button
          type="button"
          data-active={onlyOpen}
          onClick={() => setFilter('open', onlyOpen ? '0' : '1')}
        >
          Em aberto
        </button>
        <button type="button" data-active={mine} onClick={() => setFilter('mine', mine ? '' : '1')}>
          Minhas OS
        </button>
        <button type="button" data-active={mine && !onlyOpen} onClick={showMyReport}>
          <UserCheck /> Meu relatório
        </button>
        <button type="button" data-active={openedByMe} onClick={showMyRequests}>
          Minhas solicitações
        </button>
        <button
          type="button"
          disabled={!list.data?.rows.length}
          onClick={exportCurrentRows}
          title="Exporta as OS filtradas nesta página"
        >
          <Download /> Exportar CSV
        </button>
        {posture && (
          <button type="button" data-active="true" onClick={() => setFilter('posture', '')}>
            Postura {posture} ×
          </button>
        )}
      </div>

      {list.isError ? (
        <StatePanel
          kind="error"
          title="Não foi possível carregar as OS"
          description={list.error.message}
          actionLabel="Tentar novamente"
          onAction={() => void list.refetch()}
        />
      ) : list.isLoading ? (
        <PageSkeleton />
      ) : !list.data?.rows.length ? (
        <StatePanel
          kind="empty"
          title="Nenhuma OS encontrada"
          description="Não existem chamados com estes filtros. Isso é diferente de um erro de carregamento."
          secondaryAction={
            <Link className={styles.inlineAction} to="/ordens/nova">
              <ClipboardPlus /> Abrir primeira OS
            </Link>
          }
        />
      ) : (
        <>
          <div className={styles.list}>
            {list.data.rows.map((workOrder) => (
              <Link
                key={workOrder.work_order_id}
                className={styles.card}
                to={`/ordens/${workOrder.work_order_id}`}
              >
                <div className={styles.cardTop}>
                  <span className={styles.orderNumber}>
                    OS #{String(workOrder.number).padStart(6, '0')}
                  </span>
                  <span className={styles.status} data-state={workOrder.semantic_state}>
                    {workOrder.status_name}
                  </span>
                  <span className={styles.priority} data-priority={workOrder.priority_code}>
                    {workOrder.priority_name}
                  </span>
                </div>
                <h2>
                  {workOrder.problem_type_name ?? workOrder.position_name ?? 'Manutenção geral'}
                </h2>
                <p>{workOrder.description}</p>
                <div className={styles.cardMeta}>
                  <span>
                    <MapPin /> Postura {workOrder.posture_number}
                    {workOrder.battery_code ? ` · ${workOrder.battery_code}` : ''}
                  </span>
                  <span>
                    <UserRound /> {workOrder.assigned_to_name ?? 'Não atribuída'}
                  </span>
                  <span>
                    <CalendarClock /> {formatRelativeDate(workOrder.opened_at)}
                  </span>
                </div>
                {workOrder.is_overdue && <span className={styles.overdue}>SLA vencido</span>}
                <ArrowRight className={styles.cardArrow} />
              </Link>
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={list.data.total}
            onPageChange={(nextPage) => setFilter('page', String(nextPage))}
          />
        </>
      )}
    </div>
  );
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diffHours = Math.floor((Date.now() - date.getTime()) / 3_600_000);
  if (diffHours < 1) return 'Há poucos minutos';
  if (diffHours < 24) return `Há ${diffHours}h`;
  const days = Math.floor(diffHours / 24);
  if (days < 7) return `Há ${days} dia${days === 1 ? '' : 's'}`;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
