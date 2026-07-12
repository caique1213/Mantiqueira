import { useId } from 'react';
import { AlertTriangle, ClipboardList, Gauge, Wrench } from 'lucide-react';

import type { PhysicalDataState, PostureSummaryDatum } from './types';
import './physical.css';

export interface PostureSummaryProps {
  posture: PostureSummaryDatum;
  state?: PhysicalDataState;
  errorMessage?: string;
  onOpenWorkOrders?: () => void;
  onOpenInventory?: () => void;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function boundedPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function PostureSummary({
  posture,
  state = 'ready',
  errorMessage,
  onOpenWorkOrders,
  onOpenInventory,
}: PostureSummaryProps) {
  const headingId = useId();
  const issuesHeadingId = useId();
  const title = posture.name?.trim() || `Postura ${String(posture.number).padStart(2, '0')}`;
  const installedAssets = posture.installedAssets;
  const expectedPositions = posture.expectedPositions;
  const completeness = posture.inventoryCompleteness;
  const activeWorkOrders = posture.activeWorkOrders;
  const criticalWorkOrders = posture.criticalWorkOrders;
  const hasMetrics = [
    installedAssets,
    completeness,
    activeWorkOrders,
    posture.lastMaintenanceAt,
  ].some((value) => value !== null && value !== undefined);
  const structureStateLabel =
    state === 'loading'
      ? 'Carregando situação'
      : posture.active === true
        ? 'Estrutura ativa'
        : posture.active === false
          ? 'Estrutura inativa'
          : 'Situação não carregada';

  return (
    <section className="physical-panel physical-posture-summary" aria-labelledby={headingId}>
      <header className="physical-posture-summary__header">
        <div className="physical-posture-summary__identity">
          <span className="physical-posture-summary__number" aria-hidden="true">
            {String(posture.number).padStart(2, '0')}
          </span>
          <div>
            <p className="physical-eyebrow">Prontuário técnico</p>
            <h2 id={headingId}>{title}</h2>
            <span className="physical-posture-summary__state" data-active={posture.active === true}>
              {structureStateLabel}
            </span>
          </div>
        </div>

        {onOpenWorkOrders || onOpenInventory ? (
          <div className="physical-posture-summary__actions">
            {onOpenWorkOrders ? (
              <button type="button" onClick={onOpenWorkOrders}>
                <ClipboardList aria-hidden="true" size={18} />
                Ver ordens de serviço
              </button>
            ) : null}
            {onOpenInventory ? (
              <button type="button" onClick={onOpenInventory}>
                <Wrench aria-hidden="true" size={18} />
                Ver inventário
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {state === 'error' ? (
        <div className="physical-state physical-state--error" role="alert">
          <strong>Não foi possível carregar o resumo da postura.</strong>
          <span>{errorMessage ?? 'Acesse novamente após verificar a conexão.'}</span>
        </div>
      ) : null}

      {state === 'loading' ? (
        <div
          className="physical-posture-summary__metrics"
          aria-busy="true"
          aria-label="Carregando resumo"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div className="physical-metric physical-metric--loading" key={index} />
          ))}
        </div>
      ) : state === 'ready' && hasMetrics ? (
        <dl className="physical-posture-summary__metrics">
          {activeWorkOrders !== null && activeWorkOrders !== undefined ? (
            <div
              className="physical-metric"
              data-tone={(criticalWorkOrders ?? 0) > 0 ? 'danger' : 'neutral'}
            >
              <dt>
                <ClipboardList aria-hidden="true" size={18} /> OS ativas
              </dt>
              <dd>{activeWorkOrders}</dd>
              {criticalWorkOrders !== null && criticalWorkOrders !== undefined ? (
                criticalWorkOrders > 0 ? (
                  <span>
                    <AlertTriangle aria-hidden="true" size={14} /> {criticalWorkOrders} crítica
                    {criticalWorkOrders === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span>Nenhuma OS crítica</span>
                )
              ) : (
                <span>Criticidade não carregada</span>
              )}
            </div>
          ) : null}

          {installedAssets !== null && installedAssets !== undefined ? (
            <div className="physical-metric">
              <dt>
                <Wrench aria-hidden="true" size={18} /> Ativos instalados
              </dt>
              <dd>{installedAssets}</dd>
              <span>
                {expectedPositions !== null && expectedPositions !== undefined
                  ? `${expectedPositions} posições previstas`
                  : 'Total previsto não carregado'}
              </span>
            </div>
          ) : null}

          {completeness !== null && completeness !== undefined ? (
            <div className="physical-metric">
              <dt>
                <Gauge aria-hidden="true" size={18} /> Completude
              </dt>
              <dd>{boundedPercent(completeness)}%</dd>
              <span className="physical-progress" aria-hidden="true">
                <i style={{ width: `${boundedPercent(completeness)}%` }} />
              </span>
            </div>
          ) : null}

          {posture.lastMaintenanceAt ? (
            <div className="physical-metric">
              <dt>Última manutenção</dt>
              <dd className="physical-metric__date">{formatDateTime(posture.lastMaintenanceAt)}</dd>
              <span>Registro mais recente informado</span>
            </div>
          ) : null}
        </dl>
      ) : state === 'ready' ? (
        <div className="physical-state" role="status">
          O resumo desta postura ainda não possui métricas carregadas.
        </div>
      ) : null}

      {state === 'ready' && posture.dataQualityIssues && posture.dataQualityIssues.length > 0 ? (
        <aside className="physical-posture-summary__issues" aria-labelledby={issuesHeadingId}>
          <div>
            <AlertTriangle aria-hidden="true" size={19} />
            <h3 id={issuesHeadingId}>Pendências de cadastro</h3>
          </div>
          <ul>
            {posture.dataQualityIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </aside>
      ) : null}
    </section>
  );
}
