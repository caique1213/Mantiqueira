import { useId, useMemo, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { LocateFixed, Minus, Plus } from 'lucide-react';

import { STANDARD_BATTERY_POSITION_CODES } from '../../lib/physical-rules';
import type {
  BatteryPositionDatum,
  BatteryPositionKind,
  BatteryPositionSelection,
  PhysicalDataState,
  PhysicalLayer,
  StandardBatteryPositionCode,
} from './types';
import './physical.css';

const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 620;
const MIN_ZOOM = 0.85;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

interface PositionDefinition {
  label: string;
  kind: BatteryPositionKind;
  domain: 'electrical' | 'mechanical';
}

const POSITION_DEFINITIONS: Record<StandardBatteryPositionCode, PositionDefinition> = {
  motor_elevador: {
    label: 'Motor do elevador',
    kind: 'motor',
    domain: 'electrical',
  },
  redutor_elevador: {
    label: 'Redutor do elevador',
    kind: 'reducer',
    domain: 'mechanical',
  },
  motor_racao: {
    label: 'Motor da ração',
    kind: 'motor',
    domain: 'electrical',
  },
  redutor_racao: {
    label: 'Redutor da ração',
    kind: 'reducer',
    domain: 'mechanical',
  },
  motor_esteira_branca_superior: {
    label: 'Motor da esteira branca superior',
    kind: 'motor',
    domain: 'electrical',
  },
  motor_esteira_branca_inferior: {
    label: 'Motor da esteira branca inferior',
    kind: 'motor',
    domain: 'electrical',
  },
  motor_esteira_nylon_superior: {
    label: 'Motor da esteira de nylon superior',
    kind: 'motor',
    domain: 'electrical',
  },
  motor_esteira_nylon_inferior: {
    label: 'Motor da esteira de nylon inferior',
    kind: 'motor',
    domain: 'electrical',
  },
};

const DIAGRAM_LAYER_OPTIONS: readonly { value: PhysicalLayer; label: string }[] = [
  { value: 'all', label: 'Visão física' },
  { value: 'electrical', label: 'Elétrica' },
  { value: 'mechanical', label: 'Mecânica' },
  { value: 'work-orders', label: 'OS ativas' },
  { value: 'inventory', label: 'Inventário' },
];

export interface BatteryDiagramProps {
  postureNumber?: number;
  batteryCode?: string;
  positions: readonly BatteryPositionDatum[];
  transverseMotor?: BatteryPositionDatum;
  state?: PhysicalDataState;
  errorMessage?: string;
  selectedPositionCode?: string | null;
  onPositionSelect?: (position: BatteryPositionSelection) => void;
  layer?: PhysicalLayer;
  defaultLayer?: PhysicalLayer;
  onLayerChange?: (layer: PhysicalLayer) => void;
}

interface Point {
  x: number;
  y: number;
}

type SlotState = 'unknown' | 'empty' | 'installed' | 'incomplete' | 'work-order' | 'critical';

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function pointerDistance(points: readonly Point[]) {
  const first = points[0];
  const second = points[1];
  if (!first || !second) return 0;
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function slotState(position: BatteryPositionSelection, state: PhysicalDataState): SlotState {
  if (state !== 'ready' || !position.loaded) return 'unknown';
  if (!position.asset) return 'empty';
  if ((position.asset.criticalWorkOrders ?? 0) > 0) return 'critical';
  if (position.asset.openWorkOrders > 0) return 'work-order';
  if (position.asset.completeness < 100 || !position.asset.hasNameplatePhoto) return 'incomplete';
  return 'installed';
}

function positionDescription(position: BatteryPositionSelection, state: PhysicalDataState) {
  if (state === 'error') return `${position.label}. Erro ao carregar os dados.`;
  if (state === 'loading' || !position.loaded) {
    return `${position.label}. Dados ainda não carregados.`;
  }
  if (!position.asset) return `${position.label}. Sem ativo instalado cadastrado.`;

  const identity = [position.asset.manufacturer, position.asset.model].filter(Boolean).join(' ');
  const workOrders =
    position.asset.openWorkOrders > 0
      ? `${position.asset.openWorkOrders} ${position.asset.openWorkOrders === 1 ? 'OS ativa' : 'OS ativas'}`
      : 'sem OS ativa';
  return `${position.label}. ${identity || position.asset.assetType}. ${workOrders}. Cadastro com ${Math.round(position.asset.completeness)}% de completude.`;
}

function isLayerMatch(position: BatteryPositionSelection, layer: PhysicalLayer) {
  if (layer === 'all') return true;
  if (layer === 'electrical' || layer === 'mechanical') return position.domain === layer;
  if (layer === 'work-orders') return (position.asset?.openWorkOrders ?? 0) > 0;
  return !position.asset || position.asset.completeness < 100 || !position.asset.hasNameplatePhoto;
}

interface InteractiveAssetProps {
  position: BatteryPositionSelection;
  state: PhysicalDataState;
  x: number;
  y: number;
  accent: 'red' | 'gray' | 'blue' | 'orange' | 'black';
  shortLabel: string;
  selected: boolean;
  dimmed: boolean;
  onActivate: (position: BatteryPositionSelection) => void;
}

function handleAssetKey(
  event: ReactKeyboardEvent<SVGGElement>,
  position: BatteryPositionSelection,
  onActivate: (position: BatteryPositionSelection) => void,
) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.stopPropagation();
  onActivate(position);
}

function InteractiveMotor({
  position,
  state,
  x,
  y,
  accent,
  shortLabel,
  selected,
  dimmed,
  onActivate,
}: InteractiveAssetProps) {
  const currentState = slotState(position, state);
  return (
    <g
      className="physical-battery__asset"
      data-kind="motor"
      data-accent={accent}
      data-state={currentState}
      data-selected={selected}
      data-dimmed={dimmed}
      role="button"
      tabIndex={0}
      aria-label={positionDescription(position, state)}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation();
        onActivate(position);
      }}
      onKeyDown={(event) => handleAssetKey(event, position, onActivate)}
    >
      <title>{positionDescription(position, state)}</title>
      <circle className="physical-battery__asset-hit" cx={x} cy={y} r="27" />
      <circle className="physical-battery__focus" cx={x} cy={y} r="25" />
      <circle className="physical-battery__motor" cx={x} cy={y} r="18" />
      <circle className="physical-battery__motor-core" cx={x} cy={y} r="7" />
      <text className="physical-battery__asset-code" x={x} y={y + 38} textAnchor="middle">
        {shortLabel}
      </text>
      {currentState === 'critical' || currentState === 'work-order' ? (
        <circle className="physical-battery__os-indicator" cx={x + 16} cy={y - 16} r="6" />
      ) : null}
    </g>
  );
}

function InteractiveReducer({
  position,
  state,
  x,
  y,
  accent,
  shortLabel,
  selected,
  dimmed,
  onActivate,
}: InteractiveAssetProps) {
  const currentState = slotState(position, state);
  const points = `${x - 18},${y - 14} ${x + 12},${y - 14} ${x + 21},${y} ${x + 12},${
    y + 14
  } ${x - 18},${y + 14} ${x - 25},${y}`;
  return (
    <g
      className="physical-battery__asset"
      data-kind="reducer"
      data-accent={accent}
      data-state={currentState}
      data-selected={selected}
      data-dimmed={dimmed}
      role="button"
      tabIndex={0}
      aria-label={positionDescription(position, state)}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation();
        onActivate(position);
      }}
      onKeyDown={(event) => handleAssetKey(event, position, onActivate)}
    >
      <title>{positionDescription(position, state)}</title>
      <rect
        className="physical-battery__asset-hit"
        x={x - 29}
        y={y - 25}
        width="58"
        height="50"
        rx="10"
      />
      <rect
        className="physical-battery__focus"
        x={x - 28}
        y={y - 24}
        width="56"
        height="48"
        rx="10"
      />
      <polygon className="physical-battery__reducer" points={points} />
      <circle className="physical-battery__reducer-core" cx={x} cy={y} r="5" />
      <text className="physical-battery__asset-code" x={x} y={y + 38} textAnchor="middle">
        {shortLabel}
      </text>
      {currentState === 'critical' || currentState === 'work-order' ? (
        <circle className="physical-battery__os-indicator" cx={x + 18} cy={y - 16} r="6" />
      ) : null}
    </g>
  );
}

function makeResolvedPosition(
  code: StandardBatteryPositionCode,
  provided: BatteryPositionDatum | undefined,
): BatteryPositionSelection {
  const definition = POSITION_DEFINITIONS[code];
  return {
    positionId: provided?.positionId ?? null,
    code,
    label: provided?.label ?? definition.label,
    kind: provided?.kind ?? definition.kind,
    domain: provided?.domain ?? definition.domain,
    asset: provided?.asset ?? null,
    loaded: provided !== undefined,
  };
}

export function BatteryDiagram({
  postureNumber,
  batteryCode,
  positions,
  transverseMotor,
  state = 'ready',
  errorMessage,
  selectedPositionCode = null,
  onPositionSelect,
  layer: controlledLayer,
  defaultLayer = 'all',
  onLayerChange,
}: BatteryDiagramProps) {
  const idPrefix = useId().replace(/:/g, '');
  const headingId = `${idPrefix}-battery-title`;
  const floorGradientId = `${idPrefix}-battery-floor-gradient`;
  const cagePatternId = `${idPrefix}-battery-cage-pattern`;
  const [localLayer, setLocalLayer] = useState<PhysicalLayer>(defaultLayer);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const dragPoint = useRef<Point | null>(null);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const pointerMoved = useRef(false);

  const layer = controlledLayer ?? localLayer;
  const providedByCode = useMemo(
    () => new Map(positions.map((position) => [position.code, position])),
    [positions],
  );
  const resolvedPositions = useMemo(
    () =>
      STANDARD_BATTERY_POSITION_CODES.map((code) =>
        makeResolvedPosition(code, providedByCode.get(code)),
      ),
    [providedByCode],
  );
  const positionByCode = useMemo(
    () => new Map(resolvedPositions.map((position) => [position.code, position])),
    [resolvedPositions],
  );
  const resolvedTransverse = useMemo<BatteryPositionSelection | null>(() => {
    if (!transverseMotor) return null;
    return {
      positionId: transverseMotor.positionId ?? null,
      code: transverseMotor.code,
      label: transverseMotor.label ?? 'Motor da esteira preta / transversal',
      kind: transverseMotor.kind ?? 'motor',
      domain: transverseMotor.domain ?? 'electrical',
      asset: transverseMotor.asset,
      loaded: true,
    };
  }, [transverseMotor]);

  const loadedPositions = resolvedPositions.filter((position) => position.loaded).length;
  const installedAssets = resolvedPositions.filter((position) => position.asset !== null).length;
  const viewWidth = VIEWBOX_WIDTH / zoom;
  const viewHeight = VIEWBOX_HEIGHT / zoom;
  const viewX = (VIEWBOX_WIDTH - viewWidth) / 2 - pan.x;
  const viewY = (VIEWBOX_HEIGHT - viewHeight) / 2 - pan.y;
  const titleParts = [
    postureNumber === undefined ? null : `Postura ${String(postureNumber).padStart(2, '0')}`,
    batteryCode ?? null,
  ].filter((part): part is string => part !== null);
  const diagramTitle = titleParts.length > 0 ? titleParts.join(' · ') : 'Bateria';

  function position(code: StandardBatteryPositionCode) {
    const value = positionByCode.get(code);
    if (!value) throw new Error(`Posição física obrigatória ausente: ${code}`);
    return value;
  }

  function changeLayer(nextLayer: PhysicalLayer) {
    if (controlledLayer === undefined) setLocalLayer(nextLayer);
    onLayerChange?.(nextLayer);
  }

  function changeZoom(nextZoom: number) {
    setZoom(clampZoom(nextZoom));
  }

  function resetViewport() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      dragPoint.current = { x: event.clientX, y: event.clientY };
      pointerMoved.current = false;
      return;
    }
    const distance = pointerDistance([...pointers.current.values()]);
    pinchStart.current = { distance, zoom };
    dragPoint.current = null;
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2) {
      const pinch = pinchStart.current;
      const distance = pointerDistance([...pointers.current.values()]);
      if (pinch && pinch.distance > 0) changeZoom(pinch.zoom * (distance / pinch.distance));
      pointerMoved.current = true;
      return;
    }

    const previous = dragPoint.current;
    if (!previous) return;
    const deltaX = event.clientX - previous.x;
    const deltaY = event.clientY - previous.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) pointerMoved.current = true;
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      setPan((current) => ({
        x: current.x + deltaX * (viewWidth / rect.width),
        y: current.y + deltaY * (viewHeight / rect.height),
      }));
    }
    dragPoint.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerEnd(event: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pinchStart.current = null;
    const remaining = [...pointers.current.values()][0];
    dragPoint.current = remaining ?? null;
    if (pointerMoved.current) {
      window.setTimeout(() => {
        pointerMoved.current = false;
      }, 0);
    }
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault();
    changeZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  }

  function activatePosition(item: BatteryPositionSelection) {
    if (pointerMoved.current) {
      pointerMoved.current = false;
      return;
    }
    onPositionSelect?.(item);
  }

  function dimmed(item: BatteryPositionSelection) {
    return !isLayerMatch(item, layer);
  }

  return (
    <section className="physical-panel physical-battery" aria-labelledby={headingId}>
      <header className="physical-panel__header physical-battery__header">
        <div>
          <p className="physical-eyebrow">Representação lateral esquemática</p>
          <h2 id={headingId}>{diagramTitle}</h2>
          <p>
            Frente no lado do elevador e dos motores de nylon; fundo no lado das esteiras brancas e
            da esteira transversal. Toque em um motor ou redutor para abrir sua ficha.
          </p>
        </div>
        <dl className="physical-battery__readout" aria-label="Leitura dos dados da bateria">
          <div>
            <dt>Posições lidas</dt>
            <dd>
              {loadedPositions}/{STANDARD_BATTERY_POSITION_CODES.length}
            </dd>
          </div>
          <div>
            <dt>Ativos exibidos</dt>
            <dd>{installedAssets}</dd>
          </div>
        </dl>
      </header>

      <div className="physical-battery__toolbar">
        <label className="physical-field physical-field--select">
          <span>Camada visual</span>
          <select
            value={layer}
            onChange={(event) => changeLayer(event.target.value as PhysicalLayer)}
          >
            {DIAGRAM_LAYER_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="physical-zoom-controls" role="group" aria-label="Controles de zoom">
          <button
            type="button"
            aria-label="Diminuir zoom"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => changeZoom(zoom - ZOOM_STEP)}
          >
            <Minus aria-hidden="true" size={18} />
          </button>
          <output aria-live="polite" aria-label="Nível de zoom">
            {Math.round(zoom * 100)}%
          </output>
          <button
            type="button"
            aria-label="Aumentar zoom"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => changeZoom(zoom + ZOOM_STEP)}
          >
            <Plus aria-hidden="true" size={18} />
          </button>
          <button type="button" aria-label="Restaurar enquadramento" onClick={resetViewport}>
            <LocateFixed aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      {state === 'error' ? (
        <div className="physical-state physical-state--error" role="alert">
          <strong>Não foi possível carregar os ativos desta bateria.</strong>
          <span>{errorMessage ?? 'A estrutura física continua visível para orientação.'}</span>
        </div>
      ) : null}

      <div className="physical-battery__viewport" data-state={state}>
        <svg
          ref={svgRef}
          viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
          role="img"
          aria-label={`Diagrama lateral da ${diagramTitle}`}
          aria-busy={state === 'loading'}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={handleWheel}
          onDoubleClick={() => changeZoom(zoom + ZOOM_STEP)}
        >
          <desc>
            Diagrama técnico lateral com seis níveis de esteiras de nylon azuis, seis esteiras
            brancas representadas em laranja, estrutura de gaiolas preta, carrinho de ração cinza,
            elevador vermelho e posições interativas de motores e redutores.
          </desc>
          <defs>
            <linearGradient id={floorGradientId} x1="0" x2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0" />
              <stop offset="0.5" stopColor="currentColor" stopOpacity="0.32" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
            <pattern id={cagePatternId} width="54" height="24" patternUnits="userSpaceOnUse">
              <path d="M0 0h54v24H0z" className="physical-battery__cage-fill" />
              <path d="M0 0v24M27 0v24M54 0v24" className="physical-battery__cage-wire" />
            </pattern>
          </defs>

          <g className="physical-battery__drawing">
            <text className="physical-battery__orientation" x="66" y="36">
              FRENTE DO GALPÃO
            </text>
            <path className="physical-battery__orientation-line" d="M68 49h118" />
            <text className="physical-battery__orientation" x="780" y="36">
              FUNDO DO GALPÃO
            </text>
            <path className="physical-battery__orientation-line" d="M778 49h118" />

            <path
              className="physical-battery__floor"
              d="M50 560H910"
              stroke={`url(#${floorGradientId})`}
            />
            <rect
              className="physical-battery__base"
              x="166"
              y="526"
              width="650"
              height="22"
              rx="4"
            />

            <g className="physical-battery__structure" aria-hidden="true">
              <rect x="170" y="91" width="640" height="432" rx="5" />
              {[135, 195, 255, 365, 425, 485].map((y) => (
                <g key={y}>
                  <rect
                    className="physical-battery__cage"
                    x="188"
                    y={y - 31}
                    width="590"
                    height="35"
                    rx="2"
                    fill={`url(#${cagePatternId})`}
                  />
                  <line
                    className="physical-battery__nylon"
                    x1="173"
                    y1={y + 9}
                    x2="793"
                    y2={y + 9}
                  />
                  <line
                    className="physical-battery__white-belt"
                    x1="181"
                    y1={y + 25}
                    x2="801"
                    y2={y + 25}
                  />
                </g>
              ))}
              <path className="physical-battery__group-divider" d="M181 308H800" />
              <text className="physical-battery__group-label" x="205" y="86">
                CONJUNTO SUPERIOR · 3 NÍVEIS
              </text>
              <text className="physical-battery__group-label" x="205" y="345">
                CONJUNTO INFERIOR · 3 NÍVEIS
              </text>
            </g>

            <g className="physical-battery__elevator" aria-hidden="true">
              <rect x="82" y="92" width="54" height="432" rx="7" />
              <path d="M109 112v388" />
              {[144, 204, 264, 374, 434, 494].map((y) => (
                <path d={`M109 ${y}h65`} key={y} />
              ))}
              <text x="109" y="82" textAnchor="middle">
                ELEVADOR
              </text>
            </g>

            <g className="physical-battery__feed-cart" aria-hidden="true">
              <rect x="466" y="97" width="55" height="421" rx="8" />
              <path d="M480 112v390M508 112v390" />
              <path className="physical-battery__feed-arrow" d="M407 538h175" />
              <path className="physical-battery__feed-arrow-head" d="m407 538 12-8m-12 8 12 8" />
              <path className="physical-battery__feed-arrow-head" d="m582 538-12-8m12 8-12 8" />
              <text x="494" y="292" textAnchor="middle" transform="rotate(-90 494 292)">
                CARRINHO DE RAÇÃO
              </text>
            </g>

            <path className="physical-battery__shaft" d="M116 535h78" aria-hidden="true" />
            <InteractiveMotor
              position={position('motor_elevador')}
              state={state}
              x={88}
              y={548}
              accent="red"
              shortLabel="ME"
              selected={selectedPositionCode === 'motor_elevador'}
              dimmed={dimmed(position('motor_elevador'))}
              onActivate={activatePosition}
            />
            <InteractiveReducer
              position={position('redutor_elevador')}
              state={state}
              x={146}
              y={548}
              accent="red"
              shortLabel="RE"
              selected={selectedPositionCode === 'redutor_elevador'}
              dimmed={dimmed(position('redutor_elevador'))}
              onActivate={activatePosition}
            />

            <path className="physical-battery__shaft" d="M445 72h122" aria-hidden="true" />
            <InteractiveMotor
              position={position('motor_racao')}
              state={state}
              x={456}
              y={72}
              accent="gray"
              shortLabel="MR"
              selected={selectedPositionCode === 'motor_racao'}
              dimmed={dimmed(position('motor_racao'))}
              onActivate={activatePosition}
            />
            <InteractiveReducer
              position={position('redutor_racao')}
              state={state}
              x={515}
              y={72}
              accent="gray"
              shortLabel="RR"
              selected={selectedPositionCode === 'redutor_racao'}
              dimmed={dimmed(position('redutor_racao'))}
              onActivate={activatePosition}
            />

            <path className="physical-battery__shaft" d="M139 170h48" aria-hidden="true" />
            <InteractiveMotor
              position={position('motor_esteira_nylon_superior')}
              state={state}
              x={145}
              y={170}
              accent="blue"
              shortLabel="NS"
              selected={selectedPositionCode === 'motor_esteira_nylon_superior'}
              dimmed={dimmed(position('motor_esteira_nylon_superior'))}
              onActivate={activatePosition}
            />
            <InteractiveMotor
              position={position('motor_esteira_branca_superior')}
              state={state}
              x={872}
              y={238}
              accent="orange"
              shortLabel="BS"
              selected={selectedPositionCode === 'motor_esteira_branca_superior'}
              dimmed={dimmed(position('motor_esteira_branca_superior'))}
              onActivate={activatePosition}
            />
            <path className="physical-battery__shaft" d="M139 410h48" aria-hidden="true" />
            <InteractiveMotor
              position={position('motor_esteira_nylon_inferior')}
              state={state}
              x={145}
              y={410}
              accent="blue"
              shortLabel="NI"
              selected={selectedPositionCode === 'motor_esteira_nylon_inferior'}
              dimmed={dimmed(position('motor_esteira_nylon_inferior'))}
              onActivate={activatePosition}
            />
            <InteractiveMotor
              position={position('motor_esteira_branca_inferior')}
              state={state}
              x={872}
              y={478}
              accent="orange"
              shortLabel="BI"
              selected={selectedPositionCode === 'motor_esteira_branca_inferior'}
              dimmed={dimmed(position('motor_esteira_branca_inferior'))}
              onActivate={activatePosition}
            />

            {resolvedTransverse ? (
              <g>
                <text className="physical-battery__transverse-label" x="818" y="568">
                  MOTOR TRANSVERSAL
                </text>
                <InteractiveMotor
                  position={resolvedTransverse}
                  state={state}
                  x={882}
                  y={535}
                  accent="black"
                  shortLabel="MT"
                  selected={selectedPositionCode === resolvedTransverse.code}
                  dimmed={dimmed(resolvedTransverse)}
                  onActivate={activatePosition}
                />
              </g>
            ) : null}
          </g>
        </svg>

        <div className="physical-battery__gesture-help" aria-hidden="true">
          Arraste para mover · pinça ou roda para ampliar · toque duplo para zoom
        </div>
      </div>

      <div className="physical-battery__legend" aria-label="Legenda do diagrama">
        <span>
          <i data-color="motor" /> Círculo: motor
        </span>
        <span>
          <i data-color="reducer" /> Forma acoplada: redutor
        </span>
        <span>
          <i data-color="nylon" /> Esteiras de nylon
        </span>
        <span>
          <i data-color="white-belt" /> Esteiras brancas
        </span>
        <span>
          <i data-color="feed" /> Carrinho de ração
        </span>
        <span>
          <i data-color="elevator" /> Elevador de ovos
        </span>
      </div>
    </section>
  );
}
