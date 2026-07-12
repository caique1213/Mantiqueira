import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Boxes, ClipboardPlus, MapPin, Wrench, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { StatePanel } from '../../components/ui/StatePanel';
import { BatteryDiagram } from './BatteryDiagram';
import { BatterySummaryList } from './BatterySummary';
import { PostureSummary } from './PostureSummary';
import { fetchPostureAssets, fetchPostureDetail } from './physical.api';
import type {
  BatteryAssetView,
  BatteryPositionDatum,
  BatteryPositionSelection,
  BatterySummaryDatum,
} from './types';
import styles from './posture-detail-page.module.css';

export function PostureDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postureNumber = Number(params.postureNumber);
  const validNumber = Number.isInteger(postureNumber) && postureNumber >= 1 && postureNumber <= 48;
  const detail = useQuery({
    queryKey: ['posture-detail', postureNumber],
    queryFn: () => fetchPostureDetail(postureNumber),
    enabled: validNumber,
  });
  const assets = useQuery({
    queryKey: ['posture-assets', detail.data?.posture_id],
    queryFn: () => fetchPostureAssets(detail.data!.posture_id),
    enabled: Boolean(detail.data?.posture_id),
  });
  const [selectedBattery, setSelectedBattery] = useState(1);
  const [selectedPosition, setSelectedPosition] = useState<BatteryPositionSelection | null>(null);
  const requestedBattery = searchParams.get('bateria');

  useEffect(() => {
    const match = requestedBattery?.match(/^B([1-6])$/i);
    setSelectedBattery(match ? Number(match[1]) : 1);
    setSelectedPosition(null);
  }, [postureNumber, requestedBattery]);

  useEffect(() => {
    if (!detail.data?.batteries.length) return;
    if (!detail.data.batteries.some((battery) => battery.ordinal === selectedBattery)) {
      setSelectedBattery(detail.data.batteries[0]!.ordinal);
      setSelectedPosition(null);
    }
  }, [detail.data, selectedBattery]);

  if (!validNumber) {
    return (
      <StatePanel
        kind="empty"
        title="Postura inválida"
        description="Use um número entre 1 e 48."
        secondaryAction={<Link to="/mapa">Voltar ao mapa</Link>}
      />
    );
  }

  if (detail.isError) {
    return (
      <StatePanel
        kind="error"
        title={`Não foi possível carregar a Postura ${postureNumber}`}
        description={detail.error.message}
        actionLabel="Tentar novamente"
        onAction={() => void detail.refetch()}
      />
    );
  }

  const data = detail.data;
  const selectedBatteryData = data?.batteries.find(
    (battery) => battery.ordinal === selectedBattery,
  );
  const assetByPosition = new Map(
    (assets.data ?? [])
      .filter((asset) => asset.asset_position_id)
      .map((asset) => [asset.asset_position_id!, asset]),
  );

  const batterySummaries: BatterySummaryDatum[] =
    data?.batteries.map((battery) => {
      const batteryAssets = (assets.data ?? []).filter((asset) => asset.battery_id === battery.id);
      const completeness = batteryAssets.length
        ? batteryAssets.reduce((sum, asset) => sum + asset.completeness_percent, 0) /
          battery.positions.length
        : 0;
      return {
        id: battery.id,
        number: battery.ordinal,
        code: battery.code,
        active: battery.active,
        installedAssets: batteryAssets.length,
        expectedPositions: battery.positions.length,
        completeness,
        openWorkOrders: batteryAssets.reduce((sum, asset) => sum + asset.open_work_orders, 0),
        criticalWorkOrders: batteryAssets.reduce(
          (sum, asset) => sum + asset.critical_open_work_orders,
          0,
        ),
      };
    }) ?? [];

  const diagramPositions: BatteryPositionDatum[] =
    selectedBatteryData?.positions.map((position) => {
      const asset = assetByPosition.get(position.id);
      const mapped: BatteryAssetView | null = asset?.installation_id
        ? {
            assetId: asset.asset_id,
            installationId: asset.installation_id,
            positionId: position.id,
            internalCode: asset.internal_code,
            assetType: asset.asset_type_name,
            manufacturer: asset.manufacturer_name,
            model: asset.model_name,
            serialNumber: asset.serial_number,
            completeness: asset.completeness_percent,
            hasNameplatePhoto: asset.has_nameplate_photo,
            openWorkOrders: asset.open_work_orders,
            statusLabel: asset.status_name,
            criticalWorkOrders: asset.critical_open_work_orders,
          }
        : null;
      return {
        positionId: position.id,
        code: position.code,
        label: position.name,
        kind: position.code.startsWith('redutor_') ? 'reducer' : 'motor',
        domain: position.domain,
        asset: mapped,
      };
    }) ?? [];

  const transversePosition = data?.general_positions.find(
    (position) => position.code === 'motor_esteira_preta',
  );
  const transverseAsset = transversePosition
    ? assetByPosition.get(transversePosition.id)
    : undefined;
  const transverseMotor: BatteryPositionDatum | undefined = transversePosition
    ? {
        positionId: transversePosition.id,
        code: transversePosition.code,
        label: transversePosition.name,
        kind: 'motor',
        domain: transversePosition.domain,
        asset: transverseAsset?.installation_id
          ? {
              assetId: transverseAsset.asset_id,
              installationId: transverseAsset.installation_id,
              positionId: transversePosition.id,
              internalCode: transverseAsset.internal_code,
              assetType: transverseAsset.asset_type_name,
              manufacturer: transverseAsset.manufacturer_name,
              model: transverseAsset.model_name,
              serialNumber: transverseAsset.serial_number,
              completeness: transverseAsset.completeness_percent,
              hasNameplatePhoto: transverseAsset.has_nameplate_photo,
              openWorkOrders: transverseAsset.open_work_orders,
              statusLabel: transverseAsset.status_name,
              criticalWorkOrders: transverseAsset.critical_open_work_orders,
            }
          : null,
      }
    : undefined;

  return (
    <div className={styles.page}>
      <header className={styles.breadcrumbs}>
        <Link to="/mapa">
          <ArrowLeft /> Mapa
        </Link>
        <span>/</span>
        <strong>Postura {String(postureNumber).padStart(2, '0')}</strong>
      </header>

      <PostureSummary
        posture={{
          ...(data?.posture_id ? { id: data.posture_id } : {}),
          number: postureNumber,
          ...(data
            ? {
                name: data.posture_name,
                active: data.posture_active,
                installedAssets: data.installed_assets,
                expectedPositions: data.total_positions,
                inventoryCompleteness: data.inventory_completeness,
                activeWorkOrders: data.open_work_orders,
                criticalWorkOrders: data.critical_open_work_orders,
                lastMaintenanceAt: data.latest_activity_at,
              }
            : {}),
        }}
        state={detail.isLoading ? 'loading' : 'ready'}
        onOpenWorkOrders={() => navigate(`/ordens?posture=${postureNumber}`)}
        onOpenInventory={() => navigate(`/inventario?posture=${postureNumber}`)}
      />

      <section className={styles.batteryNavigation}>
        <div className={styles.sectionTitle}>
          <span>ESTRUTURA DA POSTURA</span>
          <h2>Selecione uma bateria</h2>
        </div>
        <BatterySummaryList
          postureNumber={postureNumber}
          batteries={batterySummaries}
          state={
            detail.isLoading || assets.isLoading ? 'loading' : assets.isError ? 'error' : 'ready'
          }
          selectedBatteryNumber={selectedBattery}
          onBatterySelect={(number) => {
            setSelectedBattery(number);
            setSelectedPosition(null);
          }}
        />
      </section>

      <section className={styles.diagramSection}>
        <div className={styles.sectionTitle}>
          <span>VISTA LATERAL · FRENTE / FUNDO</span>
          <h2>Bateria B{selectedBattery}</h2>
          <p>Clique em qualquer motor ou redutor para abrir a ficha contextual.</p>
        </div>
        <BatteryDiagram
          postureNumber={postureNumber}
          batteryCode={`B${selectedBattery}`}
          positions={diagramPositions}
          {...(transverseMotor ? { transverseMotor } : {})}
          state={
            detail.isLoading || assets.isLoading ? 'loading' : assets.isError ? 'error' : 'ready'
          }
          {...(assets.error ? { errorMessage: assets.error.message } : {})}
          selectedPositionCode={selectedPosition?.code ?? null}
          onPositionSelect={setSelectedPosition}
        />
      </section>

      <section className={styles.generalAssets}>
        <div className={styles.sectionTitle}>
          <span>ÁREA GERAL</span>
          <h2>Ativos da postura</h2>
        </div>
        <div className={styles.generalGrid}>
          {(data?.general_positions ?? []).map((position) => {
            const asset = assetByPosition.get(position.id);
            return (
              <button
                key={position.id}
                type="button"
                onClick={() =>
                  setSelectedPosition({
                    positionId: position.id,
                    code: position.code,
                    label: position.name,
                    kind: position.code.startsWith('motor') ? 'motor' : 'general',
                    domain: position.domain,
                    asset: asset?.installation_id
                      ? {
                          assetId: asset.asset_id,
                          installationId: asset.installation_id,
                          positionId: position.id,
                          internalCode: asset.internal_code,
                          assetType: asset.asset_type_name,
                          manufacturer: asset.manufacturer_name,
                          model: asset.model_name,
                          serialNumber: asset.serial_number,
                          completeness: asset.completeness_percent,
                          hasNameplatePhoto: asset.has_nameplate_photo,
                          openWorkOrders: asset.open_work_orders,
                          statusLabel: asset.status_name,
                          criticalWorkOrders: asset.critical_open_work_orders,
                        }
                      : null,
                    loaded: true,
                  })
                }
              >
                <span className={styles.generalIcon}>
                  <Wrench />
                </span>
                <span>
                  <strong>{position.name}</strong>
                  <small>
                    {asset
                      ? [asset.manufacturer_name, asset.model_name].filter(Boolean).join(' · ') ||
                        'Cadastrado'
                      : 'Sem ativo instalado'}
                  </small>
                </span>
                <ArrowRight />
              </button>
            );
          })}
        </div>
      </section>

      {selectedPosition && (
        <>
          <button
            className={styles.drawerBackdrop}
            aria-label="Fechar detalhes"
            onClick={() => setSelectedPosition(null)}
          />
          <aside className={styles.drawer} aria-label={`Detalhes de ${selectedPosition.label}`}>
            <header>
              <div>
                <span>POSIÇÃO TÉCNICA</span>
                <h2>{selectedPosition.label}</h2>
              </div>
              <IconButton label="Fechar" icon={<X />} onClick={() => setSelectedPosition(null)} />
            </header>
            {selectedPosition.asset ? (
              <div className={styles.assetDetails}>
                <span className={styles.assetIcon}>
                  <Boxes />
                </span>
                <h3>{selectedPosition.asset.manufacturer ?? selectedPosition.asset.assetType}</h3>
                <p>{selectedPosition.asset.model ?? 'Modelo ainda não informado'}</p>
                <dl>
                  <div>
                    <dt>Código interno</dt>
                    <dd>{selectedPosition.asset.internalCode ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Número de série</dt>
                    <dd>{selectedPosition.asset.serialNumber ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Completude</dt>
                    <dd>{Math.round(selectedPosition.asset.completeness)}%</dd>
                  </div>
                  <div>
                    <dt>OS abertas</dt>
                    <dd>{selectedPosition.asset.openWorkOrders}</dd>
                  </div>
                </dl>
                <Button
                  fullWidth
                  trailingIcon={<ArrowRight />}
                  onClick={() => navigate(`/ativos/${selectedPosition.asset!.assetId}`)}
                >
                  Abrir ficha completa
                </Button>
                <Button
                  fullWidth
                  variant="secondary"
                  leadingIcon={<ClipboardPlus />}
                  onClick={() =>
                    navigate(
                      `/ordens/nova?posture=${data?.posture_id ?? ''}&battery=${selectedBatteryData?.id ?? ''}&position=${selectedPosition.asset!.positionId}`,
                    )
                  }
                >
                  Abrir OS neste ativo
                </Button>
              </div>
            ) : (
              <div className={styles.emptyPosition}>
                <MapPin />
                <h3>Sem ativo instalado</h3>
                <p>
                  A posição existe fisicamente, mas nenhum equipamento real está instalado nela.
                </p>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() =>
                    navigate(
                      `/inventario?create=1${selectedPosition.positionId ? `&position=${selectedPosition.positionId}` : ''}`,
                    )
                  }
                >
                  Cadastrar ativo
                </Button>
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
