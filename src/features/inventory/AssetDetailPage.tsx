import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  BookOpen,
  CalendarClock,
  Camera,
  CheckCircle2,
  CircleGauge,
  ClipboardPlus,
  ExternalLink,
  FileImage,
  Gauge,
  History,
  MapPin,
  PackageCheck,
  Pencil,
  ShieldAlert,
  Tag,
  Trash2,
  Unplug,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { IconButton } from '../../components/ui/IconButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { normalizeError } from '../../lib/errors';
import { useAuth } from '../auth/AuthProvider';
import { AssetFormDialog } from './AssetFormDialog';
import {
  InstallationDialog,
  MediaUploadDialog,
  RemovalDialog,
  ReplacementDialog,
} from './AssetLifecycleDialogs';
import {
  archiveAssetMedia,
  assetDetailToFormValues,
  fetchAssetCatalogs,
  fetchAssetDetail,
} from './inventory.api';
import type { AssetDomain, AssetMedia } from './inventory.types';
import styles from './inventory.module.css';

const criticalityLabels = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
} as const;
const sourceLabels = {
  physical_nameplate: 'Placa física',
  field_measurement: 'Medição em campo',
  manual: 'Manual técnico',
  library: 'Biblioteca',
  unknown: 'Não informada',
} as const;

const fieldLabels: Record<string, string> = {
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
  torque_nm: 'Torque (N·m)',
  mounting_position: 'Posição de montagem',
  oil_type: 'Óleo',
  oil_quantity_l: 'Óleo (L)',
  output_shaft: 'Eixo de saída',
};

function canEditDomain(auth: ReturnType<typeof useAuth>, domain: AssetDomain): boolean {
  return auth.hasPermission('assets.edit.all') || auth.hasPermission(`assets.edit.${domain}`);
}

function canReplaceDomain(auth: ReturnType<typeof useAuth>, domain: AssetDomain): boolean {
  return auth.hasPermission('assets.replace.all') || auth.hasPermission(`assets.replace.${domain}`);
}

export function AssetDetailPage() {
  const { assetId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canView = auth.hasPermission('assets.view');
  const detail = useQuery({
    queryKey: ['asset-detail', assetId],
    queryFn: () => fetchAssetDetail(assetId),
    enabled: canView && Boolean(assetId),
  });
  const catalogs = useQuery({
    queryKey: ['asset-catalogs', auth.access?.site_ids],
    queryFn: () => fetchAssetCatalogs(auth.access?.site_ids),
    enabled: canView,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [archiveMedia, setArchiveMedia] = useState<AssetMedia | null>(null);
  const automaticInstallOpened = useRef(false);
  const requestedInstallPositionId = searchParams.get('installPosition');

  useEffect(() => {
    const asset = detail.data;
    if (
      automaticInstallOpened.current ||
      !requestedInstallPositionId ||
      !asset ||
      asset.currentLocation ||
      !canEditDomain(auth, asset.domain)
    ) {
      return;
    }
    automaticInstallOpened.current = true;
    setInstallOpen(true);
  }, [auth, detail.data, requestedInstallPositionId]);
  const archiveMutation = useMutation({
    mutationFn: (mediaId: string) => archiveAssetMedia(mediaId),
    onSuccess: async () => {
      toast.success('Mídia arquivada. O histórico do ativo foi preservado.');
      setArchiveMedia(null);
      await queryClient.invalidateQueries({ queryKey: ['asset-detail', assetId] });
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  if (!canView)
    return (
      <StatePanel
        kind="permission"
        title="Ficha técnica não autorizada"
        description="Seu perfil não possui permissão para consultar ativos físicos."
      />
    );
  if (detail.isLoading || catalogs.isLoading) return <PageSkeleton />;
  if (detail.isError) {
    return (
      <StatePanel
        kind={/permission|row-level|forbidden/i.test(detail.error.message) ? 'permission' : 'error'}
        title="Não foi possível abrir o ativo"
        description={detail.error.message}
        actionLabel="Tentar novamente"
        onAction={() => void detail.refetch()}
      />
    );
  }
  if (!detail.data)
    return (
      <StatePanel
        kind="empty"
        title="Ativo não encontrado"
        description="O registro pode ter sido arquivado ou estar fora das unidades permitidas para seu perfil."
      />
    );

  const asset = detail.data;
  const canEdit = canEditDomain(auth, asset.domain);
  const canReplace = canReplaceDomain(auth, asset.domain);
  const identity = asset.internalCode ?? asset.serialNumber ?? asset.id.slice(0, 8).toUpperCase();
  const nameplateRows = [
    ...Object.entries(asset.specificSpecs.values).filter(
      ([key, value]) => key !== 'asset_id' && key !== 'updated_at' && value != null && value !== '',
    ),
    ...Object.entries(asset.nameplateSpecs).filter(([, value]) => value != null && value !== ''),
  ];
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['asset-detail', asset.id] }),
      queryClient.invalidateQueries({ queryKey: ['inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] }),
    ]);
  };

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to="/inventario">
        <ArrowLeft /> Voltar ao inventário
      </Link>
      <PageHeader
        eyebrow={`${asset.assetTypeName.toUpperCase()} · ${identity}`}
        title={`${asset.manufacturerName ?? 'Fabricante não informado'}${asset.technicalModel?.label ? ` ${asset.technicalModel.label}` : ''}`}
        description={
          asset.currentLocation
            ? `Instalado na Postura ${String(asset.currentLocation.postureNumber).padStart(2, '0')}${asset.currentLocation.batteryCode ? `, ${asset.currentLocation.batteryCode}` : ''} — ${asset.currentLocation.positionName}`
            : 'Ativo sem instalação atual. O histórico anterior continua disponível abaixo.'
        }
        meta={
          <div className={styles.detailMeta}>
            <span style={{ '--status-color': asset.statusColor } as React.CSSProperties}>
              <i />
              {asset.statusName}
            </span>
            <span data-criticality={asset.criticality}>
              <ShieldAlert /> Criticidade {criticalityLabels[asset.criticality]}
            </span>
            <span>
              <CircleGauge />{' '}
              {asset.completenessPercent === null
                ? 'Completude indisponível'
                : `${Math.round(asset.completenessPercent)}% completo`}
            </span>
          </div>
        }
        actions={
          <>
            {canEdit && (
              <Button
                variant="secondary"
                leadingIcon={<Camera />}
                onClick={() => setMediaOpen(true)}
              >
                Adicionar foto
              </Button>
            )}
            {canEdit && (
              <Button
                variant="secondary"
                leadingIcon={<Pencil />}
                onClick={() => setEditOpen(true)}
              >
                Editar
              </Button>
            )}
            {canReplace && asset.currentLocation && (
              <Button
                variant="danger"
                leadingIcon={<Unplug />}
                onClick={() => setRemoveOpen(true)}
              >
                Remover
              </Button>
            )}
            {canReplace && asset.currentLocation && (
              <Button
                variant="secondary"
                leadingIcon={<ArrowLeftRight />}
                onClick={() => setReplaceOpen(true)}
              >
                Substituir
              </Button>
            )}
            {canEdit && !asset.currentLocation && (
              <Button leadingIcon={<PackageCheck />} onClick={() => setInstallOpen(true)}>
                Instalar
              </Button>
            )}
            {asset.currentLocation && (
              <Link
                className={styles.linkPrimary}
                to={`/ordens/nova?posture=${asset.currentLocation.postureId}${asset.currentLocation.batteryId ? `&battery=${asset.currentLocation.batteryId}` : ''}&position=${asset.currentLocation.assetPositionId}`}
              >
                <ClipboardPlus /> Abrir OS
              </Link>
            )}
          </>
        }
      />

      <section className={styles.assetHeroStrip}>
        <div className={styles.assetIdentityMark} data-domain={asset.domain}>
          <Wrench />
        </div>
        <div>
          <span>IDENTIDADE FÍSICA</span>
          <strong>{identity}</strong>
          <small>Série: {asset.serialNumber ?? 'não informada'}</small>
        </div>
        <div className={styles.heroStripLocation}>
          <MapPin />
          <span>
            <strong>
              {asset.currentLocation
                ? `Postura ${String(asset.currentLocation.postureNumber).padStart(2, '0')}`
                : 'Sem instalação'}
            </strong>
            <small>
              {asset.currentLocation
                ? `${asset.currentLocation.batteryCode ? `${asset.currentLocation.batteryCode} · ` : ''}${asset.currentLocation.positionName}`
                : 'Disponível para instalação ou em manutenção'}
            </small>
          </span>
        </div>
        <CompletenessRing value={asset.completenessPercent} />
      </section>

      {asset.missingFields.length > 0 && (
        <section className={styles.missingPanel}>
          <Gauge />
          <div>
            <strong>Cadastro ainda incompleto</strong>
            <p>Faltam: {asset.missingFields.join(', ')}.</p>
          </div>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              Completar agora
            </Button>
          )}
        </section>
      )}

      <section className={styles.comparisonGrid}>
        <article className={styles.dataPanel} data-source="physical">
          <header>
            <span className={styles.panelIcon}>
              <Tag />
            </span>
            <div>
              <small>DADOS SOBERANOS</small>
              <h2>Placa física</h2>
            </div>
            <span className={styles.sourceBadge}>{sourceLabels[asset.dataSource]}</span>
          </header>
          {nameplateRows.length ? (
            <dl className={styles.specGrid}>
              {nameplateRows.map(([key, value]) => (
                <Spec key={key} label={fieldLabels[key] ?? key} value={value} />
              ))}
            </dl>
          ) : (
            <StatePanel
              compact
              kind="empty"
              title="Placa ainda não transcrita"
              description="Cadastre os valores legíveis e adicione uma foto da placa."
            />
          )}
          <footer>
            <CheckCircle2 /> Em caso de divergência, estes dados prevalecem sobre a biblioteca.
          </footer>
        </article>

        <article className={styles.dataPanel} data-source="library">
          <header>
            <span className={styles.panelIcon}>
              <BookOpen />
            </span>
            <div>
              <small>REFERÊNCIA REUTILIZÁVEL</small>
              <h2>Modelo técnico</h2>
            </div>
            {asset.technicalModel?.verified && (
              <span className={styles.verifiedBadge}>Verificado</span>
            )}
          </header>
          {asset.technicalModel ? (
            <>
              <div className={styles.modelSummary}>
                <strong>
                  {asset.manufacturerName} {asset.technicalModel.label}
                </strong>
                <p>
                  {asset.technicalModel.description || 'Sem descrição adicional na biblioteca.'}
                </p>
              </div>
              {Object.keys(asset.technicalModel.referenceSpecs).length > 0 && (
                <dl className={styles.specGrid}>
                  {Object.entries(asset.technicalModel.referenceSpecs).map(([key, value]) => (
                    <Spec key={key} label={fieldLabels[key] ?? key} value={value} />
                  ))}
                </dl>
              )}
              {(asset.technicalModel.sourceName ||
                safeExternalUrl(asset.technicalModel.sourceUrl)) && (
                <div className={styles.modelSource}>
                  Fonte:{' '}
                  {safeExternalUrl(asset.technicalModel.sourceUrl) ? (
                    <a href={asset.technicalModel.sourceUrl!} target="_blank" rel="noreferrer">
                      {asset.technicalModel.sourceName ?? 'Abrir fonte'} <ExternalLink />
                    </a>
                  ) : (
                    asset.technicalModel.sourceName
                  )}
                </div>
              )}
            </>
          ) : (
            <StatePanel
              compact
              kind="empty"
              title="Sem modelo vinculado"
              description="O ativo continua válido; o modelo de biblioteca é apenas uma referência opcional."
            />
          )}
          <footer>
            <BookOpen /> Nunca copie número de série, foto ou histórico de outro ativo.
          </footer>
        </article>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div>
            <span>REGISTRO VISUAL</span>
            <h2>Fotos e placa</h2>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Camera />}
              onClick={() => setMediaOpen(true)}
            >
              Adicionar
            </Button>
          )}
        </div>
        {asset.media.length ? (
          <div className={styles.mediaGrid}>
            {asset.media.map((media) => (
              <figure key={media.id} className={styles.mediaCard}>
                {media.signedUrl && media.mimeType.startsWith('image/') ? (
                  <img
                    src={media.signedUrl}
                    alt={
                      media.caption ||
                      (media.mediaType === 'nameplate' ? 'Foto da placa do ativo' : 'Foto do ativo')
                    }
                  />
                ) : (
                  <div className={styles.mediaUnavailable}>
                    <FileImage />
                    <span>{media.previewError ?? 'Prévia indisponível'}</span>
                  </div>
                )}
                <figcaption>
                  <span>
                    <strong>{media.mediaType === 'nameplate' ? 'Placa' : 'Foto geral'}</strong>
                    <small>{media.caption || formatDate(media.createdAt)}</small>
                  </span>
                  {canEdit && (
                    <IconButton
                      label="Arquivar imagem"
                      tone="danger"
                      icon={<Trash2 />}
                      onClick={() => setArchiveMedia(media)}
                    />
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <StatePanel
            compact
            kind="empty"
            title="Nenhuma foto cadastrada"
            description="As imagens internas serão armazenadas em bucket privado e abertas por link temporário."
          />
        )}
      </section>

      <div className={styles.detailColumns}>
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeading}>
            <div>
              <span>CICLO DE VIDA</span>
              <h2>Timeline técnica</h2>
            </div>
            <History />
          </div>
          {asset.timeline.length ? (
            <ol className={styles.timeline}>
              {asset.timeline.map((item) => (
                <li key={item.id} data-event={item.eventType}>
                  <span className={styles.timelineDot} />
                  <div>
                    <time>{formatDateTime(item.occurredAt)}</time>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    {item.workOrderId && (
                      <Link to={`/ordens/${item.workOrderId}`}>
                        Abrir OS <ExternalLink />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <StatePanel
              compact
              kind="empty"
              title="Nenhum evento registrado"
              description="Os próximos eventos técnicos aparecerão aqui sem substituir registros anteriores."
            />
          )}
        </section>

        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeading}>
            <div>
              <span>RASTREABILIDADE</span>
              <h2>Instalações</h2>
            </div>
            <CalendarClock />
          </div>
          {asset.installations.length ? (
            <div className={styles.installationList}>
              {asset.installations.map((installation) => (
                <article key={installation.id} data-active={!installation.removedAt}>
                  <span className={styles.installationState}>
                    {installation.removedAt ? 'Encerrada' : 'Atual'}
                  </span>
                  <h3>
                    Postura{' '}
                    {installation.postureNumber
                      ? String(installation.postureNumber).padStart(2, '0')
                      : '—'}
                    {installation.batteryCode ? ` · ${installation.batteryCode}` : ''}
                  </h3>
                  <p>{installation.positionName}</p>
                  <dl>
                    <div>
                      <dt>Instalação</dt>
                      <dd>{formatDateTime(installation.installedAt)}</dd>
                    </div>
                    <div>
                      <dt>Remoção</dt>
                      <dd>
                        {installation.removedAt ? formatDateTime(installation.removedAt) : 'Em uso'}
                      </dd>
                    </div>
                  </dl>
                  {(installation.installationReason || installation.removalReason) && (
                    <small>{installation.removalReason ?? installation.installationReason}</small>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <StatePanel
              compact
              kind="empty"
              title="Nunca instalado"
              description="Este ativo ainda não possui um período de instalação registrado."
            />
          )}
          {asset.notes && (
            <div className={styles.notesBox}>
              <strong>Observações do ativo</strong>
              <p>{asset.notes}</p>
            </div>
          )}
        </section>
      </div>

      {catalogs.data && (
        <AssetFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          catalogs={catalogs.data}
          asset={asset}
          initialValues={assetDetailToFormValues(asset)}
          onSaved={refresh}
        />
      )}
      <InstallationDialog
        open={installOpen}
        onOpenChange={(open) => {
          setInstallOpen(open);
          if (!open && requestedInstallPositionId) setSearchParams({}, { replace: true });
        }}
        asset={asset}
        initialPositionId={requestedInstallPositionId}
        onCompleted={refresh}
      />
      <ReplacementDialog
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        asset={asset}
        onCompleted={refresh}
      />
      <RemovalDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        asset={asset}
        onCompleted={refresh}
      />
      <MediaUploadDialog
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        asset={asset}
        onCompleted={refresh}
      />
      <ConfirmDialog
        open={Boolean(archiveMedia)}
        onOpenChange={(open) => !open && setArchiveMedia(null)}
        title="Arquivar esta imagem?"
        description="Ela deixará de aparecer na galeria ativa. O registro técnico não será apagado do histórico."
        confirmLabel="Arquivar imagem"
        tone="danger"
        typedConfirmation="ARQUIVAR"
        busy={archiveMutation.isPending}
        onConfirm={async () => {
          if (archiveMedia) await archiveMutation.mutateAsync(archiveMedia.id);
        }}
      />
    </main>
  );
}

function CompletenessRing({ value }: { value: number | null }) {
  const score = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      className={styles.completenessRing}
      style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}
    >
      <span>
        <strong>{value === null ? '—' : Math.round(value)}</strong>
        <small>{value === null ? '' : '%'}</small>
      </span>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: unknown }) {
  const formatted = Array.isArray(value)
    ? value.join(' / ')
    : typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : String(value);
  return (
    <div>
      <dt>{label.replaceAll('_', ' ')}</dt>
      <dd>{formatted}</dd>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function safeExternalUrl(value: string | null): boolean {
  return Boolean(value && /^https?:\/\//i.test(value));
}
