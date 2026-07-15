import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import {
  fetchWorkOrderCatalogs,
  fetchWorkOrderPeople,
  fetchWorkOrderPersonReport,
  fetchWorkOrders,
  type WorkOrderPersonReportRow,
} from './work-orders.api';
import styles from './work-orders-page.module.css';

const PAGE_SIZE = 18;

function defaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toDateInputValue(start), to: toDateInputValue(now) };
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
const RECEIVING_PANELS: Array<{
  code: string;
  label: string;
  description: string;
  permission: string | null;
}> = [
  {
    code: '',
    label: 'Geral',
    description: 'Todas as OS da operação',
    permission: 'work_orders.view.all',
  },
  {
    code: 'eletrica',
    label: 'Elétrica',
    description: 'Painel exclusivo dos eletricistas',
    permission: 'work_orders.view.electrical',
  },
  {
    code: 'mecanica',
    label: 'Mecânica',
    description: 'Painel exclusivo da mecânica',
    permission: 'work_orders.view.mechanical',
  },
  {
    code: 'civil',
    label: 'Civil',
    description: 'Painel exclusivo da manutenção civil',
    permission: 'work_orders.view.civil',
  },
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
  const person = searchParams.get('person') ?? '';
  const mine = searchParams.get('mine') === '1';
  const openedByMe = searchParams.get('openedByMe') === '1';
  const onlyOpen = searchParams.get('open') !== '0';
  const [exportOpen, setExportOpen] = useState(false);
  const defaultRange = useMemo(() => defaultDateRange(), []);
  const [exportPerson, setExportPerson] = useState(person);
  const [exportFrom, setExportFrom] = useState(defaultRange.from);
  const [exportTo, setExportTo] = useState(defaultRange.to);
  const [exporting, setExporting] = useState(false);
  const visiblePanels = useMemo(
    () =>
      RECEIVING_PANELS.filter((panel) => !panel.permission || auth.hasPermission(panel.permission)),
    [auth],
  );

  const catalogs = useQuery({ queryKey: ['work-order-catalogs'], queryFn: fetchWorkOrderCatalogs });
  const people = useQuery({ queryKey: ['work-order-people'], queryFn: fetchWorkOrderPeople });
  const list = useQuery({
    queryKey: [
      'work-orders',
      page,
      debouncedSearch,
      status,
      sector,
      priority,
      posture,
      person,
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
        ...(person ? { personId: person } : {}),
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

  useEffect(() => {
    if (!exportPerson && people.data?.length) {
      const preferred = person || auth.user?.id || people.data[0]?.profile_id || '';
      if (preferred) setExportPerson(preferred);
    }
  }, [auth.user?.id, exportPerson, people.data, person]);

  useEffect(() => {
    if (!visiblePanels.length) return;
    const canSeeSelected = visiblePanels.some((panel) => panel.code === sector);
    if (canSeeSelected) return;
    setSearchParams((params) => {
      params.set('sector', visiblePanels[0]!.code);
      params.set('open', '1');
      params.delete('mine');
      params.delete('openedByMe');
      params.delete('page');
      return params;
    });
  }, [sector, setSearchParams, visiblePanels]);

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

  async function exportPersonReport() {
    if (!exportPerson || !exportFrom || !exportTo) return;
    if (exportTo < exportFrom) {
      toast.error('A data final não pode ser menor que a inicial.');
      return;
    }
    setExporting(true);
    try {
      const rows = await fetchWorkOrderPersonReport({
        personId: exportPerson,
        startedFrom: exportFrom,
        startedTo: exportTo,
      });
      if (!rows.length) {
        toast.info('Nenhuma OS finalizada encontrada para essa pessoa no período.');
        return;
      }
      const personName =
        people.data?.find((item) => item.profile_id === exportPerson)?.display_name ??
        rows[0]?.executor_name ??
        'Pessoa selecionada';
      downloadPersonReportWorkbook(rows, personName, exportFrom, exportTo);
      toast.success('Planilha gerada.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível exportar o relatório.',
      );
    } finally {
      setExporting(false);
    }
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
        {visiblePanels.map((panel) => (
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
        {!visiblePanels.length && (
          <div className={styles.panelNotice}>
            Seu perfil não recebe painel técnico. Use “Minhas solicitações” para acompanhar as OS
            que você abriu.
          </div>
        )}
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
          label="Pessoa"
          value={person}
          onChange={(event) => setFilter('person', event.target.value)}
        >
          <option value="">Todas</option>
          {people.data?.map((item) => (
            <option key={item.profile_id} value={item.profile_id}>
              {item.display_name} / {item.sector_name ?? 'Geral'}
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
        <button
          type="button"
          data-active={exportOpen}
          onClick={() => setExportOpen((value) => !value)}
        >
          <Download /> Relatório por pessoa
        </button>
        {person && (
          <button type="button" data-active="true" onClick={() => setFilter('person', '')}>
            Pessoa:{' '}
            {people.data?.find((item) => item.profile_id === person)?.display_name ?? 'selecionada'}{' '}
            ×
          </button>
        )}
        {posture && (
          <button type="button" data-active="true" onClick={() => setFilter('posture', '')}>
            Postura {posture} ×
          </button>
        )}
      </div>

      {exportOpen && (
        <section className={styles.exportPanel}>
          <div>
            <strong>Exportar OS feitas por pessoa</strong>
            <small>Gera uma planilha com início, finalização, horas por OS e total diário.</small>
          </div>
          <SelectField
            label="Pessoa"
            value={exportPerson}
            onChange={(event) => setExportPerson(event.target.value)}
          >
            <option value="">Selecione</option>
            {people.data?.map((item) => (
              <option key={item.profile_id} value={item.profile_id}>
                {item.display_name} / {item.sector_name ?? 'Geral'}
              </option>
            ))}
          </SelectField>
          <TextField
            label="De"
            type="date"
            value={exportFrom}
            onChange={(event) => setExportFrom(event.target.value)}
          />
          <TextField
            label="Até"
            type="date"
            value={exportTo}
            onChange={(event) => setExportTo(event.target.value)}
          />
          <Button
            size="sm"
            leadingIcon={<Download />}
            loading={exporting}
            disabled={!exportPerson || !exportFrom || !exportTo}
            onClick={() => void exportPersonReport()}
          >
            Baixar planilha
          </Button>
        </section>
      )}

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

function downloadPersonReportWorkbook(
  rows: WorkOrderPersonReportRow[],
  personName: string,
  startedFrom: string,
  startedTo: string,
) {
  const byDay = new Map<string, WorkOrderPersonReportRow[]>();
  for (const row of rows) {
    const day = row.started_at.slice(0, 10);
    const current = byDay.get(day) ?? [];
    current.push(row);
    byDay.set(day, current);
  }

  const dayEntries = [...byDay.entries()].sort(([left], [right]) => left.localeCompare(right));
  const totalMinutes = rows.reduce((sum, row) => sum + row.total_minutes, 0);
  const generatedAt = formatDateTime(new Date().toISOString());
  const period = `${formatDateOnly(startedFrom)} até ${formatDateOnly(startedTo)}`;
  const safePerson = escapeHtml(personName);

  const summaryRows = dayEntries
    .map(([day, dayRows], index) => {
      const dayMinutes = dayRows.reduce((sum, row) => sum + row.total_minutes, 0);
      const orders = dayRows.map((row) => `#${String(row.number).padStart(6, '0')}`).join(', ');
      return `<tr class="${index % 2 ? 'alt' : ''}">
        <td>${escapeHtml(formatDateOnly(day))}</td>
        <td class="number">${escapeHtml(formatHours(dayMinutes))}</td>
        <td>${escapeHtml(String(dayRows.length))}</td>
        <td>${escapeHtml(orders)}</td>
      </tr>`;
    })
    .join('');

  const detailRows = rows
    .map(
      (row, index) => `<tr class="${index % 2 ? 'alt' : ''}">
        <td>${escapeHtml(formatDateOnly(row.started_at))}</td>
        <td class="order">#${escapeHtml(String(row.number).padStart(6, '0'))}</td>
        <td>${escapeHtml(formatTimeOnly(row.started_at))}</td>
        <td>${escapeHtml(formatTimeOnly(row.finished_at))}</td>
        <td class="number">${escapeHtml(formatHours(row.total_minutes))}</td>
        <td>${escapeHtml(row.executor_name)}</td>
        <td>${escapeHtml(row.opened_by_name)}</td>
        <td>${escapeHtml(row.assigned_to_name ?? '')}</td>
        <td>${escapeHtml(row.support_names)}</td>
        <td>${escapeHtml(row.sector_name)}</td>
        <td class="number">${escapeHtml(String(row.posture_number))}</td>
        <td>${escapeHtml(row.battery_code ?? '')}</td>
        <td>${escapeHtml(shortSummary(row))}</td>
      </tr>`,
    )
    .join('');

  const workbook = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #2d2417; background: #ffffff; }
    table { border-collapse: collapse; width: 100%; }
    .hero td { border: 0; }
    .brand { background: #f2b705; color: #2b2110; font-size: 22px; font-weight: 800; letter-spacing: .04em; padding: 18px; }
    .subtitle { background: #2b2110; color: #fff4c2; font-size: 12px; font-weight: 700; padding: 8px 18px; }
    .info td { border: 1px solid #d9c58b; padding: 7px 10px; }
    .info .label { width: 170px; background: #fff3c4; color: #6b4b00; font-weight: 800; }
    .metric td { border: 1px solid #d7c99b; padding: 9px 12px; font-weight: 800; }
    .metric .label { background: #3b2f1d; color: #ffffff; }
    .metric .value { background: #fff8df; color: #2b2110; font-size: 16px; }
    .section td { border: 0; padding: 18px 0 7px; color: #2b2110; font-size: 15px; font-weight: 900; }
    th { background: #f2b705; color: #2b2110; border: 1px solid #9a7414; padding: 8px; font-weight: 900; text-align: left; }
    td { border: 1px solid #d8d0b8; padding: 7px; vertical-align: top; }
    tr.alt td { background: #fff9e8; }
    .number { text-align: right; mso-number-format:'0.00'; }
    .order { color: #6b4b00; font-weight: 800; mso-number-format:'\\@'; }
    .footer td { border: 0; color: #7c735f; font-size: 11px; padding-top: 14px; }
  </style>
</head>
<body>
  <table class="hero">
    <tr><td class="brand" colspan="13">MANTIQUEIRA BRASIL · RELATÓRIO DE ORDENS DE SERVIÇO</td></tr>
    <tr><td class="subtitle" colspan="13">Relatório individual por colaborador, período e horas executadas</td></tr>
  </table>
  <br />
  <table class="info">
    <tr><td class="label">Pessoa</td><td colspan="12">${safePerson}</td></tr>
    <tr><td class="label">Período</td><td colspan="12">${escapeHtml(period)}</td></tr>
    <tr><td class="label">Gerado em</td><td colspan="12">${escapeHtml(generatedAt)}</td></tr>
  </table>
  <br />
  <table class="metric">
    <tr>
      <td class="label">Total de OS</td><td class="value">${escapeHtml(String(rows.length))}</td>
      <td class="label">Horas totais</td><td class="value">${escapeHtml(formatHours(totalMinutes))}</td>
      <td class="label">Dias com OS</td><td class="value">${escapeHtml(String(dayEntries.length))}</td>
      <td colspan="7"></td>
    </tr>
  </table>
  <table class="section"><tr><td>Resumo diário</td></tr></table>
  <table>
    <thead><tr><th>Data</th><th>Horas totais</th><th>Quantidade de OS</th><th>OS do dia</th></tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>
  <table class="section"><tr><td>OS detalhadas</td></tr></table>
  <table>
    <thead>
      <tr>
        <th>Dia</th><th>OS</th><th>Hora de início</th><th>Hora que finalizou</th><th>Horas</th>
        <th>Nome de quem fez</th><th>Solicitante</th><th>Responsável principal</th><th>Apoios</th>
        <th>Setor</th><th>Postura</th><th>Bateria</th><th>Resumo</th>
      </tr>
    </thead>
    <tbody>${detailRows}</tbody>
  </table>
  <table class="footer"><tr><td colspan="13">Arquivo gerado pelo Mantiqueira Maintenance Hub.</td></tr></table>
</body>
</html>`;

  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-os-${slugifyFileName(personName)}-${startedFrom}-${startedTo}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function shortSummary(row: WorkOrderPersonReportRow) {
  const source = row.work_performed.trim() || row.diagnosis.trim() || row.description.trim();
  const words = source.replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (words.length <= 6) return words.join(' ');
  return `${words.slice(0, 6).join(' ')}...`;
}

function formatDateOnly(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split('-').map(Number);
    const year = parts[0] ?? 1970;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(
      new Date(year, month - 1, day),
    );
  }
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
}

function formatTimeOnly(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(value));
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2).replace('.', ',');
}

function slugifyFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
