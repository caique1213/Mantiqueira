import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { useAuth } from '../auth/AuthProvider';
import { fetchAppBootstrap, fetchDashboardMetrics } from './dashboard.api';
import styles from './dashboard.module.css';
import { resolveModuleIcon } from '../../lib/ui-modules';

export function DashboardPage() {
  const auth = useAuth();
  const bootstrap = useQuery({ queryKey: ['app-bootstrap'], queryFn: fetchAppBootstrap });
  const metrics = useQuery({ queryKey: ['dashboard-metrics'], queryFn: fetchDashboardMetrics });

  if (bootstrap.isLoading) return <PageSkeleton />;
  if (bootstrap.isError) {
    return (
      <StatePanel
        kind="error"
        title="Não foi possível carregar a visão geral"
        description={bootstrap.error.message}
        actionLabel="Tentar novamente"
        onAction={() => void bootstrap.refetch()}
      />
    );
  }

  const bootstrapData = bootstrap.data;
  if (!bootstrapData) return null;
  const siteName = bootstrapData.site?.name ?? 'Unidade Mantiqueira';
  const homeTitle = String(
    bootstrapData.settings['home.title'] ?? 'Manutenção conectada à operação',
  );
  const homeSubtitle = String(
    bootstrapData.settings['home.subtitle'] ??
      'Mapa físico, ativos e ordens de serviço em uma única visão.',
  );
  const modules = bootstrapData.modules.filter(
    (module) => !['home', 'administration'].includes(module.slug),
  );

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroImage} aria-hidden="true" />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>
            <ShieldCheck /> {siteName}
          </span>
          <h1>
            Bom trabalho,{' '}
            <span>{auth.access?.profile.display_name.split(' ')[0] ?? 'equipe'}.</span>
          </h1>
          <p>
            <strong>{homeTitle}</strong>
            <br />
            {homeSubtitle}
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} to="/ordens/nova">
              <Plus /> Abrir OS
            </Link>
            <Link className={styles.mapAction} to="/mapa">
              Explorar mapa <ArrowRight />
            </Link>
          </div>
        </div>
        <div className={styles.heroMetric}>
          <Sparkles aria-hidden="true" />
          <span>
            <strong>Mapa vivo</strong>
            <small>48 posturas · 199 baterias</small>
          </span>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Indicadores rápidos">
        <Metric
          label="OS abertas"
          value={metrics.data?.openWorkOrders}
          loading={metrics.isLoading}
        />
        <Metric
          label="OS críticas"
          value={metrics.data?.criticalWorkOrders}
          loading={metrics.isLoading}
          tone="critical"
        />
        <Metric
          label="Ativos instalados"
          value={metrics.data?.installedAssets}
          loading={metrics.isLoading}
        />
        <Metric
          label="Cadastros incompletos"
          value={metrics.data?.incompleteAssets}
          loading={metrics.isLoading}
        />
      </section>

      {metrics.isError && (
        <StatePanel
          compact
          kind="error"
          title="Indicadores indisponíveis"
          description="A estrutura principal carregou, mas os indicadores não puderam ser consultados."
          actionLabel="Tentar novamente"
          onAction={() => void metrics.refetch()}
        />
      )}

      <section className={styles.modulesSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>MÓDULOS PRINCIPAIS</span>
            <h2>Onde você precisa chegar?</h2>
          </div>
          <p>A complexidade aparece somente quando você entra em cada contexto.</p>
        </div>

        <div className={styles.moduleGrid}>
          {modules.map((module) => {
            const Icon = resolveModuleIcon(module.icon);
            return (
              <Link
                key={module.route}
                className={styles.moduleCard}
                data-accent={module.slug}
                to={module.route}
              >
                <span className={styles.moduleIcon}>
                  <Icon />
                </span>
                <span className={styles.moduleCopy}>
                  <strong>{module.label}</strong>
                  <small>{module.description}</small>
                </span>
                <ArrowRight className={styles.moduleArrow} />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  tone?: 'critical';
}) {
  return (
    <div className={styles.metric} data-tone={tone}>
      <strong>{loading ? '—' : (value ?? 0).toLocaleString('pt-BR')}</strong>
      <span>{label}</span>
    </div>
  );
}
