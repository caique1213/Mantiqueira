import { useId } from 'react';

import { batteryCountForPosture } from '../../lib/physical-rules';
import type { BatterySummaryDatum, PhysicalDataState } from './types';
import './physical.css';

export interface BatterySummaryListProps {
  postureNumber: number;
  batteries: readonly BatterySummaryDatum[];
  state?: PhysicalDataState;
  selectedBatteryNumber?: number | null;
  onBatterySelect?: (batteryNumber: number, battery: BatterySummaryDatum | null) => void;
}

type BatteryTone = 'unknown' | 'neutral' | 'positive' | 'warning' | 'danger' | 'inactive';

function batteryTone(battery: BatterySummaryDatum | undefined): BatteryTone {
  if (!battery) return 'unknown';
  if (battery.active === false) return 'inactive';
  if ((battery.criticalWorkOrders ?? 0) > 0) return 'danger';
  if ((battery.openWorkOrders ?? 0) > 0) return 'warning';
  if (battery.completeness === 100) return 'positive';
  return 'neutral';
}

function batteryDescription(number: number, battery: BatterySummaryDatum | undefined) {
  if (!battery) return `Bateria B${number}. Dados ainda não carregados.`;
  if (battery.active === false) return `Bateria ${battery.code ?? `B${number}`}. Inativa.`;

  const details: string[] = [];
  if (battery.installedAssets !== null && battery.installedAssets !== undefined) {
    details.push(`${battery.installedAssets} ativos instalados`);
  }
  if (battery.completeness !== null && battery.completeness !== undefined) {
    details.push(`${Math.round(battery.completeness)}% de completude`);
  }
  if (battery.openWorkOrders !== null && battery.openWorkOrders !== undefined) {
    details.push(`${battery.openWorkOrders} ordens de serviço ativas`);
  }
  return `Bateria ${battery.code ?? `B${number}`}. ${details.length > 0 ? details.join('. ') : 'Resumo sem métricas carregadas'}.`;
}

export function BatterySummaryList({
  postureNumber,
  batteries,
  state = 'ready',
  selectedBatteryNumber = null,
  onBatterySelect,
}: BatterySummaryListProps) {
  const headingId = useId();
  const batteryCount = batteryCountForPosture(postureNumber);
  const batteryByNumber = new Map(batteries.map((battery) => [battery.number, battery]));

  return (
    <section className="physical-battery-summary" aria-labelledby={headingId}>
      <div className="physical-battery-summary__heading">
        <div>
          <p className="physical-eyebrow">Estrutura da postura</p>
          <h3 id={headingId}>Baterias</h3>
        </div>
        <span>{batteryCount} posições físicas</span>
      </div>

      <div className="physical-battery-summary__list" aria-busy={state === 'loading'}>
        {Array.from({ length: batteryCount }, (_, index) => index + 1).map((number) => {
          const battery = batteryByNumber.get(number);
          const tone = state === 'ready' ? batteryTone(battery) : 'unknown';
          const selected = selectedBatteryNumber === number;
          const completeness = battery?.completeness;
          const installed = battery?.installedAssets;
          const expected = battery?.expectedPositions;
          return (
            <button
              type="button"
              className="physical-battery-summary__item"
              data-tone={tone}
              data-selected={selected}
              aria-pressed={selected}
              aria-label={
                state === 'loading'
                  ? `Bateria B${number}. Carregando dados.`
                  : batteryDescription(number, battery)
              }
              onClick={() => onBatterySelect?.(number, battery ?? null)}
              key={number}
            >
              <span className="physical-battery-summary__code">
                {battery?.code ?? `B${number}`}
              </span>
              <span className="physical-battery-summary__status">
                {state === 'loading'
                  ? 'Carregando'
                  : battery
                    ? battery.active === false
                      ? 'Inativa'
                      : installed !== null && installed !== undefined
                        ? `${installed}${expected !== null && expected !== undefined ? `/${expected}` : ''} ativos`
                        : 'Resumo sem métricas'
                    : 'Dados não carregados'}
              </span>
              {completeness !== null && completeness !== undefined && state === 'ready' ? (
                <span className="physical-progress" aria-hidden="true">
                  <i style={{ width: `${Math.max(0, Math.min(100, completeness))}%` }} />
                </span>
              ) : null}
              {battery && (battery.criticalWorkOrders ?? 0) > 0 ? (
                <span className="physical-battery-summary__alert">
                  {battery.criticalWorkOrders} crítica
                  {battery.criticalWorkOrders === 1 ? '' : 's'}
                </span>
              ) : battery && (battery.openWorkOrders ?? 0) > 0 ? (
                <span className="physical-battery-summary__alert">
                  {battery.openWorkOrders} OS ativa
                  {battery.openWorkOrders === 1 ? '' : 's'}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
