import { useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Layers3, Search } from 'lucide-react';

import { POSTURE_LAYOUT } from '../../lib/physical-rules';
import type { PhysicalDataState, PhysicalLayer, PostureMapDatum, PostureMapMode } from './types';
import './physical.css';

const MODE_OPTIONS: readonly { value: PostureMapMode; label: string }[] = [
  { value: 'work-orders', label: 'Ordens de serviço' },
  { value: 'inventory', label: 'Inventário' },
  { value: 'brand', label: 'Marca' },
  { value: 'failures', label: 'Falhas' },
  { value: 'layer', label: 'Camada' },
];

const LAYER_OPTIONS: readonly { value: PhysicalLayer; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'electrical', label: 'Elétrica' },
  { value: 'mechanical', label: 'Mecânica' },
];

type MapTone =
  'neutral' | 'unknown' | 'muted' | 'positive' | 'warning' | 'danger' | 'matched' | 'inactive';

export interface PostureMapProps {
  postures: readonly PostureMapDatum[];
  state?: PhysicalDataState;
  errorMessage?: string;
  heading?: string;
  description?: string;
  selectedPostureNumber?: number | null;
  mode?: PostureMapMode;
  defaultMode?: PostureMapMode;
  onModeChange?: (mode: PostureMapMode) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  selectedBrand?: string;
  onSelectedBrandChange?: (brand: string) => void;
  selectedLayer?: PhysicalLayer;
  onSelectedLayerChange?: (layer: PhysicalLayer) => void;
  availableBrands?: readonly string[];
  onPostureSelect?: (postureNumber: number, posture: PostureMapDatum | null) => void;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalise(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function layerDomain(layer: PhysicalLayer) {
  if (layer === 'electrical') return 'electrical';
  if (layer === 'mechanical') return 'mechanical';
  return null;
}

function resolveTone(
  posture: PostureMapDatum | undefined,
  mode: PostureMapMode,
  brand: string,
  layer: PhysicalLayer,
  filteredOut: boolean,
  maximumFailures: number,
): { tone: MapTone; intensity: number } {
  if (filteredOut) return { tone: 'muted', intensity: 0 };
  if (!posture) return { tone: 'unknown', intensity: 0 };
  if (posture.active === false) return { tone: 'inactive', intensity: 0 };

  if (mode === 'work-orders') {
    if (!posture.workOrders) return { tone: 'unknown', intensity: 0 };
    if (posture.workOrders.critical > 0) return { tone: 'danger', intensity: 1 };
    if (posture.workOrders.total > 0) return { tone: 'warning', intensity: 0.65 };
    return { tone: 'neutral', intensity: 0 };
  }

  if (mode === 'inventory') {
    if (!posture.inventory) return { tone: 'unknown', intensity: 0 };
    const completeness = clampPercent(posture.inventory.completeness);
    if (completeness === 100) return { tone: 'positive', intensity: 1 };
    if (completeness < 50) return { tone: 'danger', intensity: 1 - completeness / 100 };
    return { tone: 'warning', intensity: 1 - completeness / 100 };
  }

  if (mode === 'brand') {
    if (!brand) return { tone: 'neutral', intensity: 0 };
    const hasBrand = posture.brands?.some((item) => normalise(item) === normalise(brand)) ?? false;
    return hasBrand ? { tone: 'matched', intensity: 1 } : { tone: 'muted', intensity: 0 };
  }

  if (mode === 'failures') {
    if (!posture.failures) return { tone: 'unknown', intensity: 0 };
    const providedIntensity = posture.failures.intensity;
    const intensity =
      providedIntensity === undefined
        ? maximumFailures === 0
          ? 0
          : posture.failures.count / maximumFailures
        : Math.max(0, Math.min(1, providedIntensity));
    if (intensity >= 0.67) return { tone: 'danger', intensity };
    if (intensity >= 0.34) return { tone: 'warning', intensity };
    return { tone: 'neutral', intensity };
  }

  const domain = layerDomain(layer);
  if (!domain) return { tone: 'neutral', intensity: 0 };
  return posture.domains?.includes(domain)
    ? { tone: 'matched', intensity: 1 }
    : { tone: 'muted', intensity: 0 };
}

function metricLabel(
  posture: PostureMapDatum | undefined,
  mode: PostureMapMode,
  brand: string,
  layer: PhysicalLayer,
) {
  if (!posture) return 'Dados não carregados';
  if (posture.active === false) return 'Inativa';

  if (mode === 'work-orders') {
    if (!posture.workOrders) return 'OS não carregadas';
    return `${posture.workOrders.total} ${posture.workOrders.total === 1 ? 'OS ativa' : 'OS ativas'}`;
  }
  if (mode === 'inventory') {
    if (!posture.inventory) return 'Inventário não carregado';
    return `${clampPercent(posture.inventory.completeness)}% completo`;
  }
  if (mode === 'brand') {
    if (!brand) return posture.brands?.[0] ?? 'Marcas não carregadas';
    const matchedBrand = posture.brands?.find((item) => normalise(item) === normalise(brand));
    return matchedBrand ?? 'Marca não localizada';
  }
  if (mode === 'failures') {
    if (!posture.failures) return 'Falhas não carregadas';
    return `${posture.failures.count} ${posture.failures.count === 1 ? 'falha' : 'falhas'}`;
  }
  if (layer === 'all') return 'Estrutura física';
  const domain = layerDomain(layer);
  return domain && posture.domains?.includes(domain) ? 'Possui ativos' : 'Sem leitura na camada';
}

function describePosture(
  number: number,
  posture: PostureMapDatum | undefined,
  mode: PostureMapMode,
  brand: string,
  layer: PhysicalLayer,
) {
  const base = posture?.label ? `Postura ${number}, ${posture.label}` : `Postura ${number}`;
  const metric = metricLabel(posture, mode, brand, layer);
  const critical = posture?.workOrders?.critical;
  const criticalText =
    critical !== undefined && critical > 0
      ? `. ${critical} ${critical === 1 ? 'ordem crítica' : 'ordens críticas'}`
      : '';
  return `${base}. ${metric}${criticalText}.`;
}

function legendForMode(mode: PostureMapMode, hasBrand: boolean, layer: PhysicalLayer) {
  if (mode === 'inventory') {
    return [
      ['positive', 'Cadastro completo'],
      ['warning', 'Cadastro incompleto'],
      ['danger', 'Completude crítica'],
      ['unknown', 'Sem leitura'],
    ] as const;
  }
  if (mode === 'work-orders') {
    return [
      ['neutral', 'Sem OS ativa'],
      ['warning', 'Com OS ativa'],
      ['danger', 'Com OS crítica'],
      ['unknown', 'Sem leitura'],
    ] as const;
  }
  if (mode === 'failures') {
    return [
      ['neutral', 'Baixa intensidade'],
      ['warning', 'Média intensidade'],
      ['danger', 'Alta intensidade'],
      ['unknown', 'Sem leitura'],
    ] as const;
  }
  if (mode === 'brand') {
    return hasBrand
      ? ([
          ['matched', 'Marca localizada'],
          ['muted', 'Fora do filtro'],
          ['unknown', 'Sem leitura'],
        ] as const)
      : ([
          ['neutral', 'Selecione uma marca'],
          ['unknown', 'Sem leitura'],
        ] as const);
  }
  return layer === 'all'
    ? ([['neutral', 'Estrutura física']] as const)
    : ([
        ['matched', 'Possui ativos na camada'],
        ['muted', 'Fora da camada'],
        ['unknown', 'Sem leitura'],
      ] as const);
}

export function PostureMap({
  postures,
  state = 'ready',
  errorMessage,
  heading = 'Mapa físico das posturas',
  description = 'A disposição preserva a matriz física oficial, inclusive os espaços vazios.',
  selectedPostureNumber = null,
  mode: controlledMode,
  defaultMode = 'work-orders',
  onModeChange,
  searchQuery: controlledQuery,
  onSearchQueryChange,
  selectedBrand: controlledBrand,
  onSelectedBrandChange,
  selectedLayer: controlledLayer,
  onSelectedLayerChange,
  availableBrands,
  onPostureSelect,
}: PostureMapProps) {
  const headingId = useId();
  const [localMode, setLocalMode] = useState<PostureMapMode>(defaultMode);
  const [localQuery, setLocalQuery] = useState('');
  const [localBrand, setLocalBrand] = useState('');
  const [localLayer, setLocalLayer] = useState<PhysicalLayer>('all');
  const buttonRefs = useRef(new Map<number, HTMLButtonElement>());

  const mode = controlledMode ?? localMode;
  const query = controlledQuery ?? localQuery;
  const selectedBrand = controlledBrand ?? localBrand;
  const selectedLayer = controlledLayer ?? localLayer;

  const postureByNumber = useMemo(
    () => new Map(postures.map((posture) => [posture.number, posture])),
    [postures],
  );
  const brands = useMemo(() => {
    if (availableBrands) return [...availableBrands].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const values = new Set<string>();
    postures.forEach((posture) => posture.brands?.forEach((brand) => values.add(brand)));
    return [...values].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [availableBrands, postures]);
  const maximumFailures = Math.max(0, ...postures.map((posture) => posture.failures?.count ?? 0));
  const legend = legendForMode(mode, selectedBrand.length > 0, selectedLayer);
  const normalisedQuery = normalise(query);

  function changeMode(nextMode: PostureMapMode) {
    if (controlledMode === undefined) setLocalMode(nextMode);
    onModeChange?.(nextMode);
  }

  function changeQuery(nextQuery: string) {
    if (controlledQuery === undefined) setLocalQuery(nextQuery);
    onSearchQueryChange?.(nextQuery);
  }

  function changeBrand(nextBrand: string) {
    if (controlledBrand === undefined) setLocalBrand(nextBrand);
    onSelectedBrandChange?.(nextBrand);
  }

  function changeLayer(nextLayer: PhysicalLayer) {
    if (controlledLayer === undefined) setLocalLayer(nextLayer);
    onSelectedLayerChange?.(nextLayer);
  }

  function focusFromGrid(
    event: KeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    columnIndex: number,
  ) {
    const directionByKey: Partial<Record<string, readonly [number, number]>> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const direction = directionByKey[event.key];
    if (!direction) return;
    event.preventDefault();

    let nextRow = rowIndex + direction[0];
    let nextColumn = columnIndex + direction[1];
    while (
      nextRow >= 0 &&
      nextRow < POSTURE_LAYOUT.length &&
      nextColumn >= 0 &&
      nextColumn < POSTURE_LAYOUT[0].length
    ) {
      const postureNumber = POSTURE_LAYOUT[nextRow]?.[nextColumn];
      if (postureNumber !== null && postureNumber !== undefined) {
        buttonRefs.current.get(postureNumber)?.focus();
        return;
      }
      nextRow += direction[0];
      nextColumn += direction[1];
    }
  }

  return (
    <section className="physical-panel physical-map" aria-labelledby={headingId}>
      <header className="physical-panel__header">
        <div>
          <p className="physical-eyebrow">48 posturas · matriz oficial 15 × 4</p>
          <h2 id={headingId}>{heading}</h2>
          <p>{description}</p>
        </div>
      </header>

      <div className="physical-map__toolbar" aria-label="Filtros do mapa">
        <label className="physical-field physical-field--search">
          <span className="physical-sr-only">Pesquisar postura</span>
          <Search aria-hidden="true" size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Buscar postura"
            inputMode="numeric"
          />
        </label>

        <div className="physical-segmented" role="group" aria-label="Modo de visualização">
          {MODE_OPTIONS.map((option) => (
            <button
              className="physical-segmented__button"
              data-active={mode === option.value}
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              onClick={() => changeMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {mode === 'brand' ? (
          <label className="physical-field physical-field--select">
            <span>Marca</span>
            <select value={selectedBrand} onChange={(event) => changeBrand(event.target.value)}>
              <option value="">Todas as marcas</option>
              {brands.map((brand) => (
                <option value={brand} key={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode === 'layer' ? (
          <label className="physical-field physical-field--select">
            <span>
              <Layers3 aria-hidden="true" size={16} /> Camada
            </span>
            <select
              value={selectedLayer}
              onChange={(event) => changeLayer(event.target.value as PhysicalLayer)}
            >
              {LAYER_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {state === 'error' ? (
        <div className="physical-state physical-state--error" role="alert">
          <strong>Não foi possível carregar os dados do mapa.</strong>
          <span>{errorMessage ?? 'Tente novamente ou verifique sua conexão.'}</span>
        </div>
      ) : null}

      {state === 'ready' && postures.length === 0 ? (
        <div className="physical-state" role="status">
          A estrutura física está disponível, mas os dados das posturas ainda não foram carregados.
        </div>
      ) : null}

      <div className="physical-map__canvas">
        <div className="physical-map__scroll">
          <div
            className="physical-map__grid"
            role="grid"
            aria-label="Matriz física das 48 posturas"
            aria-rowcount={15}
            aria-colcount={4}
            aria-busy={state === 'loading'}
          >
            {POSTURE_LAYOUT.map((row, rowIndex) => (
              <div className="physical-map__row" role="row" key={`row-${rowIndex + 1}`}>
                {row.map((number, columnIndex) => {
                  if (number === null) {
                    return (
                      <div
                        className="physical-map__slot physical-map__slot--empty"
                        role="gridcell"
                        aria-label="Espaço físico vazio"
                        key={`empty-${rowIndex}-${columnIndex}`}
                      >
                        <span aria-hidden="true" />
                      </div>
                    );
                  }

                  if (state === 'loading') {
                    return (
                      <div className="physical-map__slot" role="gridcell" key={number}>
                        <div className="physical-map__posture physical-map__posture--loading">
                          <span className="physical-map__number">
                            {String(number).padStart(2, '0')}
                          </span>
                          <span>Carregando</span>
                        </div>
                      </div>
                    );
                  }

                  const posture = postureByNumber.get(number);
                  const queryMatches =
                    normalisedQuery.length === 0 ||
                    normalise(String(number)).includes(normalisedQuery) ||
                    (posture?.label ? normalise(posture.label).includes(normalisedQuery) : false);
                  const { tone, intensity } = resolveTone(
                    posture,
                    mode,
                    selectedBrand,
                    selectedLayer,
                    !queryMatches,
                    maximumFailures,
                  );
                  const selected = selectedPostureNumber === number;
                  const style = {
                    '--physical-tone-strength': `${10 + intensity * 18}%`,
                  } as CSSProperties;

                  return (
                    <div className="physical-map__slot" role="gridcell" key={number}>
                      <button
                        ref={(node) => {
                          if (node) buttonRefs.current.set(number, node);
                          else buttonRefs.current.delete(number);
                        }}
                        className="physical-map__posture"
                        data-tone={tone}
                        data-mode={mode}
                        data-selected={selected}
                        data-filtered={!queryMatches}
                        style={style}
                        type="button"
                        aria-label={describePosture(
                          number,
                          posture,
                          mode,
                          selectedBrand,
                          selectedLayer,
                        )}
                        aria-pressed={selected}
                        onClick={() => onPostureSelect?.(number, posture ?? null)}
                        onKeyDown={(event) => focusFromGrid(event, rowIndex, columnIndex)}
                      >
                        <span className="physical-map__posture-label">Postura</span>
                        <span className="physical-map__number">
                          {String(number).padStart(2, '0')}
                        </span>
                        <span className="physical-map__metric">
                          {metricLabel(posture, mode, selectedBrand, selectedLayer)}
                        </span>
                        {posture?.workOrders && posture.workOrders.critical > 0 ? (
                          <span className="physical-map__alert" aria-hidden="true">
                            {posture.workOrders.critical}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <aside className="physical-map__legend" data-mode={mode} aria-label="Legenda do mapa">
          <p>Legenda</p>
          <ul>
            {legend.map(([tone, label]) => (
              <li key={`${tone}-${label}`}>
                <span className="physical-legend-dot" data-tone={tone} aria-hidden="true" />
                {label}
              </li>
            ))}
            <li>
              <span className="physical-legend-empty" aria-hidden="true" />
              Espaço físico vazio
            </li>
          </ul>
          <p className="physical-map__keyboard-help">
            Use as setas do teclado para percorrer a matriz sem alterar sua disposição.
          </p>
        </aside>
      </div>
    </section>
  );
}
