import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  Boxes,
  CalendarRange,
  CheckCircle2,
  CircleGauge,
  Download,
  FileText,
  FilterX,
  History,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '../../components/ui/Button';
import { FilterBar } from '../../components/ui/FilterBar';
import { SelectField } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { useAuth } from '../auth/AuthProvider';
import { fetchAnalyticsCatalogs, fetchAnalyticsData, periodLabels } from './analytics.api';
import { downloadAnalyticsCsv, downloadAnalyticsPdf } from './analytics.export';
import type {
  AnalyticsData,
  AnalyticsFilters,
  AnalyticsPeriod,
  ChartDatum,
} from './analytics.types';
import styles from './analytics.module.css';

const initialFilters: AnalyticsFilters = { period: '30d', sectorCode: '', postureNumber: null };
const numberFormatter = new Intl.NumberFormat('pt-BR');
const compactFormatter = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function AnalyticsPage() {
  const auth = useAuth();
  const [filters, setFilters] = useState<AnalyticsFilters>(initialFilters);
  const [exportingPdf, setExportingPdf] = useState(false);
  const canView = auth.hasPermission('reports.view');
  const catalogs = useQuery({
    queryKey: ['analytics-catalogs'],
    queryFn: fetchAnalyticsCatalogs,
    enabled: canView,
  });
  const report = useQuery({
    queryKey: ['analytics-report', filters],
    queryFn: () => fetchAnalyticsData(filters, catalogs.data!),
    enabled: canView && Boolean(catalogs.data),
    placeholderData: (previous) => previous,
  });

  const selectedSector = useMemo(
    () =>
      catalogs.data?.sectors.find((sector) => sector.code === filters.sectorCode)?.label ??
      'Todos os setores',
    [catalogs.data?.sectors, filters.sectorCode],
  );
  const selectedPosture =
    filters.postureNumber === null ? 'Todas as posturas' : `Postura ${filters.postureNumber}`;
  const hasFilters =
    filters.period !== initialFilters.period ||
    Boolean(filters.sectorCode) ||
    filters.postureNumber !== null;

  if (!canView) {
    return (
      <StatePanel
        kind="permission"
        title="Relatórios não autorizados"
        description="Seu perfil não possui a permissão reports.view. Os indicadores gerenciais ficam disponíveis apenas para perfis autorizados."
      />
    );
  }
  if ((catalogs.isLoading || report.isLoading) && !report.data) return <PageSkeleton />;
  if (catalogs.isError || report.isError) {
    const failure = catalogs.error ?? report.error;
    return (
      <StatePanel
        kind={
          /permission|row-level|forbidden/i.test(failure?.message ?? '') ? 'permission' : 'error'
        }
        title="Não foi possível gerar as análises"
        description={failure?.message ?? 'O banco não respondeu à consulta gerencial.'}
        actionLabel="Tentar novamente"
        onAction={() => {
          void catalogs.refetch();
          void report.refetch();
        }}
      />
    );
  }

  const data = report.data;

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="INTELIGÊNCIA DE MANUTENÇÃO"
        title="Análises e relatórios"
        description="Indicadores calculados no banco respeitando seu acesso. Compare manutenção, inventário instalado, reincidência e desempenho por marca."
        meta={
          data ? (
            <span className={styles.generatedAt}>
              <RefreshCw className={report.isFetching ? styles.spinning : undefined} />
              {report.isFetching
                ? 'Atualizando…'
                : `Atualizado ${formatDateTime(data.generatedAt)}`}
            </span>
          ) : undefined
        }
        actions={
          <div className={styles.exportActions}>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Download />}
              disabled={!data}
              onClick={() => {
                if (!data) return;
                downloadAnalyticsCsv(data, filters);
                toast.success('Relatório CSV gerado.');
              }}
            >
              CSV
            </Button>
            <Button
              size="sm"
              leadingIcon={<FileText />}
              disabled={!data}
              loading={exportingPdf}
              onClick={() => {
                if (!data) return;
                setExportingPdf(true);
                void downloadAnalyticsPdf(data, filters)
                  .then(() => toast.success('Relatório PDF gerado.'))
                  .catch((error: unknown) => {
                    toast.error(
                      error instanceof Error ? error.message : 'Não foi possível gerar o PDF.',
                    );
                  })
                  .finally(() => setExportingPdf(false));
              }}
            >
              PDF
            </Button>
          </div>
        }
      />

      <FilterBar
        className={styles.filters ?? ''}
        {...(hasFilters
          ? {
              actions: (
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<FilterX />}
                  onClick={() => setFilters(initialFilters)}
                >
                  Restaurar
                </Button>
              ),
            }
          : {})}
      >
        <SelectField
          label="Período das OS"
          value={filters.period}
          onChange={(event) =>
            setFilters((current) => ({ ...current, period: event.target.value as AnalyticsPeriod }))
          }
        >
          {Object.entries(periodLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Setor"
          value={filters.sectorCode}
          onChange={(event) =>
            setFilters((current) => ({ ...current, sectorCode: event.target.value }))
          }
        >
          <option value="">Todos</option>
          {catalogs.data?.sectors.map((sector) => (
            <option key={sector.id} value={sector.code}>
              {sector.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Postura"
          value={filters.postureNumber ?? ''}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              postureNumber: event.target.value ? Number(event.target.value) : null,
            }))
          }
        >
          <option value="">Todas</option>
          {catalogs.data?.postures.map((posture) => (
            <option key={posture.id} value={posture.number}>
              {posture.label}
            </option>
          ))}
        </SelectField>
      </FilterBar>

      <div className={styles.scope}>
        <CalendarRange />
        <span>
          <strong>{periodLabels[filters.period]}</strong> · {selectedSector} · {selectedPosture}
        </span>
        <small>
          Período e setor afetam os gráficos de OS; inventário e mapa de postura são o cenário
          operacional atual.
        </small>
      </div>

      {data && <AnalyticsContent data={data} />}
    </main>
  );
}

function AnalyticsContent({ data }: { data: AnalyticsData }) {
  const topPostures = data.postureRows
    .filter((row) => row.openWorkOrders > 0 || row.failures > 0)
    .slice(0, 10);
  const topTypes = data.inventoryByType.slice(0, 9);
  const hasMaintenanceData = data.maintenance.workOrders > 0 || data.maintenance.openWorkOrders > 0;

  return (
    <>
      <section className={styles.kpiGrid} aria-label="Indicadores principais">
        <MetricCard
          icon={<Wrench />}
          label="OS no período"
          value={data.maintenance.workOrders}
          hint={data.reportWindowLabel}
        />
        <MetricCard
          icon={<Activity />}
          label="Ainda em aberto"
          value={data.maintenance.openWorkOrders}
          hint="Dentro do recorte selecionado"
          tone="info"
        />
        <MetricCard
          icon={<ShieldAlert />}
          label="Críticas abertas"
          value={data.maintenance.criticalOpenWorkOrders}
          hint={`${data.maintenance.overdueWorkOrders} com SLA vencido`}
          tone="danger"
        />
        <MetricCard
          icon={<Boxes />}
          label="Ativos instalados"
          value={data.inventory.installedAssets}
          hint={`${data.inventory.assets} ativos físicos cadastrados`}
        />
        <MetricCard
          icon={<CircleGauge />}
          label="Completude média"
          value={`${formatDecimal(data.inventory.averageCompleteness)}%`}
          hint={`${data.inventory.incompleteAssets} cadastros incompletos`}
          tone="success"
        />
        <MetricCard
          icon={<History />}
          label="Substituições"
          value={data.maintenance.replacements}
          hint={data.reportWindowLabel}
          tone="warning"
        />
      </section>

      {!hasMaintenanceData && (
        <div className={styles.noMaintenance} role="status">
          <CheckCircle2 />
          <span>
            Não há OS no período selecionado. O inventário atual continua disponível abaixo.
          </span>
        </div>
      )}

      <section className={styles.primaryGrid} aria-label="Visão da manutenção">
        <article className={styles.chartPanel}>
          <PanelHeading
            eyebrow="FLUXO"
            title="Abertura de OS ao longo do tempo"
            description={`Contagem completa no banco · ${data.trendWindowLabel}`}
          />
          <div
            className={styles.chartLarge}
            aria-label="Gráfico de ordens de serviço ao longo do tempo"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.workOrderTrend}
                margin={{ top: 14, right: 10, bottom: 0, left: -20 }}
              >
                <defs>
                  <linearGradient id="analyticsTrend" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="var(--color-border)"
                  strokeDasharray="3 5"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="var(--color-text-muted)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--color-text-muted)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: 'var(--color-primary)', strokeOpacity: 0.35 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="OS abertas"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  fill="url(#analyticsTrend)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={styles.chartPanel}>
          <PanelHeading
            eyebrow="SITUAÇÃO"
            title="OS por status"
            description="Distribuição no período selecionado"
          />
          {data.workOrdersByStatus.length ? (
            <div className={styles.donutLayout}>
              <div
                className={styles.chartDonut}
                aria-label="Gráfico de ordens de serviço por status"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.workOrdersByStatus}
                      dataKey="value"
                      nameKey="label"
                      innerRadius="59%"
                      outerRadius="86%"
                      paddingAngle={2}
                    >
                      {data.workOrdersByStatus.map((item) => (
                        <Cell key={item.key} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutTotal}>
                  <strong>{numberFormatter.format(data.maintenance.workOrders)}</strong>
                  <span>OS</span>
                </div>
              </div>
              <ChartLegend data={data.workOrdersByStatus} />
            </div>
          ) : (
            <ChartEmpty label="Sem OS para distribuir neste período." />
          )}
        </article>
      </section>

      <section className={styles.secondaryGrid} aria-label="Distribuições da manutenção">
        <article className={styles.chartPanel}>
          <PanelHeading
            eyebrow="PRIORIDADE"
            title="Severidade dos chamados"
            description="Quantidade por prioridade configurada"
          />
          <HorizontalBars
            data={data.workOrdersByPriority}
            emptyLabel="Sem prioridades no recorte."
          />
        </article>
        <article className={styles.chartPanel}>
          <PanelHeading
            eyebrow="EQUIPE"
            title="Demanda por setor"
            description="Elétrica, mecânica e setores adicionais"
          />
          <HorizontalBars data={data.workOrdersBySector} emptyLabel="Sem setores no recorte." />
        </article>
        <article className={styles.riskPanel}>
          <span className={styles.riskIcon}>
            <AlertTriangle />
          </span>
          <div>
            <span className={styles.panelEyebrow}>PONTOS DE ATENÇÃO</span>
            <h2>Fila operacional</h2>
          </div>
          <dl className={styles.riskList}>
            <div>
              <dt>Aguardando peça</dt>
              <dd>{numberFormatter.format(data.maintenance.waitingPartWorkOrders)}</dd>
            </div>
            <div>
              <dt>SLA vencido</dt>
              <dd>{numberFormatter.format(data.maintenance.overdueWorkOrders)}</dd>
            </div>
            <div>
              <dt>Sem foto de placa</dt>
              <dd>{numberFormatter.format(data.inventory.missingNameplate)}</dd>
            </div>
            <div>
              <dt>Ativos fora de posição</dt>
              <dd>{numberFormatter.format(data.inventory.uninstalledAssets)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="inventory-analytics-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.panelEyebrow}>INVENTÁRIO TÉCNICO</span>
            <h2 id="inventory-analytics-title">Fotografia dos ativos instalados</h2>
          </div>
          <p>Os números desta área são atuais e não mudam com o período das OS.</p>
        </div>
        <div className={styles.inventoryGrid}>
          <article className={styles.chartPanel}>
            <PanelHeading
              eyebrow="COMPOSIÇÃO"
              title="Ativos por tipo"
              description="Motores, redutores e demais categorias"
            />
            <div className={styles.chartInventory} aria-label="Gráfico de ativos por tipo">
              {topTypes.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topTypes} margin={{ top: 8, right: 5, bottom: 34, left: -18 }}>
                    <CartesianGrid
                      stroke="var(--color-border)"
                      strokeDasharray="3 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="var(--color-text-muted)"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      angle={-24}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="var(--color-text-muted)"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="Ativos" radius={[5, 5, 0, 0]}>
                      {topTypes.map((item) => (
                        <Cell key={item.key} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty label="Nenhum ativo cadastrado." />
              )}
            </div>
          </article>

          <article className={styles.brandPanel}>
            <PanelHeading
              eyebrow="CONFIABILIDADE"
              title="Comparação entre marcas"
              description="OS por ativo instalado no período"
            />
            {data.manufacturerRows.length ? (
              <div className={styles.tableScroll}>
                <table>
                  <thead>
                    <tr>
                      <th>Marca</th>
                      <th>Ativos</th>
                      <th>OS</th>
                      <th>Falhas/ativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.manufacturerRows.slice(0, 12).map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{row.label}</th>
                        <td>{numberFormatter.format(row.installedAssets)}</td>
                        <td>{numberFormatter.format(row.workOrders)}</td>
                        <td>
                          <strong data-risk={row.failuresPerAsset >= 1}>
                            {formatDecimal(row.failuresPerAsset)}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ChartEmpty label="Cadastre fabricante e instalação para comparar marcas." />
            )}
          </article>
        </div>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="posture-report-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.panelEyebrow}>MAPA DE RISCO</span>
            <h2 id="posture-report-title">Posturas que exigem atenção</h2>
          </div>
          <p>
            Reincidência: {data.recurrence.count}+ OS no mesmo ativo em {data.recurrence.windowDays}{' '}
            dias.
          </p>
        </div>
        {topPostures.length ? (
          <div className={styles.postureLayout}>
            <article className={styles.chartPanel}>
              <div
                className={styles.chartPostures}
                aria-label="Gráfico das posturas com mais ordens de serviço abertas"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topPostures}
                    layout="vertical"
                    margin={{ top: 4, right: 28, bottom: 0, left: 4 }}
                  >
                    <CartesianGrid
                      stroke="var(--color-border)"
                      strokeDasharray="3 5"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      stroke="var(--color-text-muted)"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={82}
                      stroke="var(--color-text-muted)"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar
                      dataKey="openWorkOrders"
                      name="OS abertas"
                      stackId="os"
                      fill="var(--color-info)"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="criticalWorkOrders"
                      name="Críticas"
                      stackId="critical"
                      fill="var(--priority-critical)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className={styles.postureTablePanel}>
              <div className={styles.tableScroll}>
                <table>
                  <thead>
                    <tr>
                      <th>Postura</th>
                      <th>Abertas</th>
                      <th>Falhas</th>
                      <th>Reincid.</th>
                      <th>Cadastro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPostures.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{String(row.number).padStart(2, '0')}</th>
                        <td>{row.openWorkOrders}</td>
                        <td>{row.failures}</td>
                        <td>{row.recurrentAssets}</td>
                        <td>{formatDecimal(row.inventoryCompleteness)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        ) : (
          <StatePanel
            compact
            kind="empty"
            title="Nenhuma postura em atenção"
            description="Não há OS ou falhas recentes no recorte disponível."
          />
        )}
      </section>
    </>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint: string;
  tone?: 'default' | 'info' | 'danger' | 'success' | 'warning';
}) {
  return (
    <article className={styles.metricCard} data-tone={tone}>
      <span className={styles.metricIcon}>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{typeof value === 'number' ? compactFormatter.format(value) : value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

function PanelHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className={styles.panelHeading}>
      <span className={styles.panelEyebrow}>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function HorizontalBars({ data, emptyLabel }: { data: ChartDatum[]; emptyLabel: string }) {
  if (!data.length) return <ChartEmpty label={emptyLabel} />;
  return (
    <div className={styles.chartBars} aria-label="Gráfico de distribuição">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 24, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            stroke="var(--color-text-muted)"
            tickLine={false}
            axisLine={false}
            fontSize={10}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={88}
            stroke="var(--color-text-muted)"
            tickLine={false}
            axisLine={false}
            fontSize={10}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" name="OS" radius={[0, 5, 5, 0]}>
            {data.map((item) => (
              <Cell key={item.key} fill={item.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartLegend({ data }: { data: ChartDatum[] }) {
  return (
    <ul className={styles.chartLegend}>
      {data.map((item) => (
        <li key={item.key}>
          <i style={{ background: item.color }} />
          <span>{item.label}</span>
          <strong>{numberFormatter.format(item.value)}</strong>
        </li>
      ))}
    </ul>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className={styles.chartEmpty}>
      <TrendingUp />
      <span>{label}</span>
    </div>
  );
}

const tooltipStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: '10px',
  background: 'var(--color-surface-raised)',
  color: 'var(--color-text)',
  boxShadow: 'var(--shadow-md)',
  fontSize: '12px',
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function formatDecimal(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
