import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ExternalLink,
  Factory,
  FileSearch,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { useAuth } from '../auth/AuthProvider';
import { fetchTechnicalModelDetail } from './inventory.api';
import styles from './inventory.module.css';

const confidenceLabels: Record<string, string> = {
  verified: 'Verificado',
  high: 'Alta confiança',
  medium: 'Média confiança',
  low: 'Baixa confiança',
  unverified: 'Não verificado',
};

const specLabels: Record<string, string> = {
  rated_power_kw: 'Potência (kW)',
  rated_power_cv: 'Potência (cv)',
  voltage_v: 'Tensão (V)',
  current_a: 'Corrente (A)',
  frequency_hz: 'Frequência (Hz)',
  rpm: 'Rotação (RPM)',
  poles: 'Polos',
  connection: 'Ligação',
  frame: 'Carcaça',
  ip_rating: 'Grau de proteção',
  insulation_class: 'Classe de isolamento',
  efficiency_percent: 'Rendimento (%)',
  power_factor: 'Fator de potência',
  duty: 'Regime',
  bearing_de: 'Rolamento DE',
  bearing_nde: 'Rolamento NDE',
  reducer_type: 'Tipo de redutor',
  ratio: 'Relação (i)',
  input_rpm: 'RPM de entrada',
  output_rpm: 'RPM de saída',
  torque_nm: 'Torque (N.m)',
  mounting_position: 'Posição de montagem',
  oil_type: 'Óleo',
  oil_quantity_l: 'Óleo (L)',
  output_shaft: 'Eixo de saída',
};

function formatSpecValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatSpecValue).join(' / ');
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return 'Não informado';
}

function specEntries(specs: Record<string, unknown>) {
  return Object.entries(specs).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}

export function TechnicalModelDetailPage() {
  const { modelId = '' } = useParams();
  const auth = useAuth();
  const canView = auth.hasPermission('assets.view');
  const query = useQuery({
    queryKey: ['technical-model-detail', modelId],
    queryFn: () => fetchTechnicalModelDetail(modelId),
    enabled: canView && Boolean(modelId),
  });

  if (!canView) {
    return (
      <StatePanel
        kind="permission"
        title="Biblioteca técnica não autorizada"
        description="Seu perfil não possui permissão para consultar modelos técnicos."
      />
    );
  }
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) {
    return (
      <StatePanel
        kind="error"
        title="Não foi possível carregar o modelo"
        description={query.error.message}
        actionLabel="Tentar novamente"
        onAction={() => void query.refetch()}
      />
    );
  }
  const model = query.data;
  if (!model) return null;
  const specs = specEntries(model.referenceSpecs);

  return (
    <div>
      <PageHeader
        eyebrow="Inventário Técnico · Biblioteca"
        title={`${model.manufacturerName} ${model.label}`}
        description="Dados de referência do modelo. A placa física do ativo instalado continua prevalecendo sobre esta biblioteca."
        actions={
          <Link className={styles.backLink} to="/inventario">
            <ArrowLeft aria-hidden="true" />
            Inventário
          </Link>
        }
      />

      <section className={styles.assetHeroStrip}>
        <span className={styles.assetIdentityMark} data-domain={model.domain}>
          <FileSearch aria-hidden="true" />
        </span>
        <div>
          <span>{model.assetTypeName}</span>
          <strong>{model.label}</strong>
          <small>{model.description || 'Modelo técnico cadastrado para preenchimento rápido.'}</small>
        </div>
        <div className={styles.heroStripLocation}>
          <Factory aria-hidden="true" />
          <span>
            <strong>{model.manufacturerName}</strong>
            <small>{confidenceLabels[model.confidence] ?? model.confidence}</small>
          </span>
        </div>
      </section>

      <div className={styles.detailMeta}>
        <span>
          <i style={{ background: model.verified ? 'var(--color-success)' : 'var(--color-warning)' }} />
          {model.verified ? 'Fonte verificada' : 'Conferir com a placa'}
        </span>
        <span>{model.active ? 'Modelo ativo' : 'Modelo inativo'}</span>
        <span>Tipo: {model.assetTypeCode}</span>
      </div>

      <div className={styles.detailColumns}>
        <section className={styles.dataPanel} data-source="library">
          <header>
            <span className={styles.panelIcon}>
              <FileSearch aria-hidden="true" />
            </span>
            <div>
              <span className={styles.sourceBadge}>Referência</span>
              <h2>Especificações do modelo</h2>
            </div>
            {model.verified ? <CheckCircle2 aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
          </header>

          {specs.length > 0 ? (
            <dl className={styles.specGrid}>
              {specs.map(([key, value]) => (
                <div key={key}>
                  <dt>{specLabels[key] ?? key.replaceAll('_', ' ')}</dt>
                  <dd>{formatSpecValue(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className={styles.modelSummary}>
              <strong>Sem especificações estruturadas</strong>
              <p>Este modelo ainda não possui dados técnicos de referência cadastrados.</p>
            </div>
          )}

          <p className={styles.modelSource}>
            {model.sourceUrl ? (
              <a href={model.sourceUrl} target="_blank" rel="noreferrer">
                {model.sourceName || 'Fonte técnica'} <ExternalLink aria-hidden="true" />
              </a>
            ) : (
              model.sourceName || 'Fonte não informada'
            )}
          </p>
        </section>

        <section className={styles.sectionBlock}>
          <header className={styles.sectionHeading}>
            <Boxes aria-hidden="true" />
            <div>
              <span>Ativos físicos</span>
              <h2>Instalados com este modelo</h2>
            </div>
          </header>

          {model.installedAssets.length > 0 ? (
            <div className={styles.modelAssetList}>
              {model.installedAssets.map((asset) => (
                <Link key={asset.assetId} to={`/ativos/${asset.assetId}`}>
                  <span>
                    <strong>
                      {asset.manufacturerName ?? model.manufacturerName} {asset.modelName ?? model.label}
                    </strong>
                    <small>
                      {asset.internalCode || asset.serialNumber || 'Sem código interno informado'}
                    </small>
                  </span>
                  <span>
                    <MapPin aria-hidden="true" />
                    P{asset.postureNumber} {asset.batteryCode ? `· ${asset.batteryCode}` : ''} ·{' '}
                    {asset.positionName}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <StatePanel
              kind="empty"
              title="Nenhum ativo instalado encontrado"
              description="O modelo existe na biblioteca, mas ainda não há ativo físico instalado usando esta referência."
            />
          )}
        </section>
      </div>
    </div>
  );
}
