import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Camera, ClipboardPlus, MapPin, ShieldAlert, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { FieldFrame, SelectField } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { normalizeError } from '../../lib/errors';
import { useAuth } from '../auth/AuthProvider';
import {
  fetchInstalledAssetForPosition,
  fetchPositions,
  fetchWorkOrderCatalogs,
  openWorkOrder,
  uploadWorkOrderMedia,
  type OpenWorkOrderInput,
} from './work-orders.api';
import styles from './new-work-order.module.css';

interface FormState {
  postureId: string;
  batteryId: string;
  sectorId: string;
  positionId: string;
  problemTypeId: string;
  priorityId: string;
  description: string;
}

const initialState: FormState = {
  postureId: '',
  batteryId: '',
  sectorId: '',
  positionId: '',
  problemTypeId: '',
  priorityId: '',
  description: '',
};

export function NewWorkOrderPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormState>(initialState);
  const [problemPhoto, setProblemPhoto] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const catalogs = useQuery({ queryKey: ['work-order-catalogs'], queryFn: fetchWorkOrderCatalogs });
  const positions = useQuery({
    queryKey: ['asset-positions', form.postureId, form.batteryId || null],
    queryFn: () => fetchPositions(form.postureId, form.batteryId || null),
    enabled: Boolean(form.postureId),
  });
  const installedAsset = useQuery({
    queryKey: ['installed-asset-position', form.positionId],
    queryFn: () => fetchInstalledAssetForPosition(form.positionId),
    enabled: Boolean(form.positionId),
  });

  useEffect(() => {
    if (!catalogs.data) return;
    setForm((current) => ({
      ...current,
      postureId: current.postureId || searchParams.get('posture') || '',
      batteryId: current.batteryId || searchParams.get('battery') || '',
      positionId: current.positionId || searchParams.get('position') || '',
      priorityId:
        current.priorityId ||
        catalogs.data.priorities.find((priority) => priority.code === 'normal')?.id ||
        catalogs.data.priorities[0]?.id ||
        '',
    }));
  }, [catalogs.data, searchParams]);

  const postureBatteries = useMemo(
    () => catalogs.data?.batteries.filter((battery) => battery.posture_id === form.postureId) ?? [],
    [catalogs.data, form.postureId],
  );

  const problemTypes = useMemo(
    () =>
      catalogs.data?.problemTypes.filter(
        (type) => !type.sectorId || !form.sectorId || type.sectorId === form.sectorId,
      ) ?? [],
    [catalogs.data, form.sectorId],
  );

  const mutation = useMutation({
    mutationFn: async (input: OpenWorkOrderInput) => {
      const created = await openWorkOrder(input);
      let photoWarning = false;
      const siteId = auth.access?.site_ids[0];
      if (problemPhoto && siteId) {
        try {
          await uploadWorkOrderMedia({
            workOrderId: created.id,
            siteId,
            file: problemPhoto,
            mediaType: 'problem',
            caption: 'Foto registrada durante a abertura da OS.',
          });
        } catch {
          photoWarning = true;
        }
      }
      return { created, photoWarning };
    },
    onSuccess: ({ created, photoWarning }) => {
      toast.success(`OS ${created.number.toLocaleString('pt-BR')} aberta com sucesso.`);
      if (photoWarning) {
        toast.warning('A OS foi aberta, mas a foto não foi enviada. Tente novamente nos detalhes.');
      }
      void navigate(`/ordens/${created.id}`);
    },
    onError: (caught) => setMessage(normalizeError(caught).message),
  });

  if (catalogs.isLoading) return <PageSkeleton />;
  if (catalogs.isError) {
    return (
      <StatePanel
        kind="error"
        title="Não foi possível preparar o formulário"
        description={catalogs.error.message}
        actionLabel="Tentar novamente"
        onAction={() => void catalogs.refetch()}
      />
    );
  }

  const catalogData = catalogs.data;
  if (!catalogData) return null;

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => {
      if (field === 'postureId') {
        return { ...current, postureId: value, batteryId: '', positionId: '' };
      }
      if (field === 'batteryId') return { ...current, batteryId: value, positionId: '' };
      return { ...current, [field]: value };
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (
      !form.postureId ||
      !form.sectorId ||
      !form.priorityId ||
      form.description.trim().length < 5
    ) {
      setMessage('Informe postura, setor, prioridade e uma descrição com pelo menos 5 caracteres.');
      return;
    }
    mutation.mutate({
      postureId: form.postureId,
      batteryId: form.batteryId || null,
      sectorId: form.sectorId,
      assetPositionId: form.positionId || null,
      assetId: installedAsset.data?.asset_id ?? null,
      problemTypeId: form.problemTypeId || null,
      priorityId: form.priorityId,
      description: form.description.trim(),
    });
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="ORDEM DE SERVIÇO"
        title="Abrir novo chamado"
        description="Comece pelo local físico. Se houver um ativo instalado na posição, ele será vinculado automaticamente."
        actions={
          <Button variant="ghost" leadingIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
            Voltar
          </Button>
        }
      />

      <form className={styles.form} onSubmit={submit}>
        <section className={styles.section}>
          <header className={styles.sectionHeading}>
            <span>
              <MapPin />
            </span>
            <div>
              <strong>1. Local e ativo</strong>
              <small>Identifique exatamente onde o problema está.</small>
            </div>
          </header>
          <div className={styles.grid}>
            <SelectField
              label="Postura"
              value={form.postureId}
              onChange={(event) => update('postureId', event.target.value)}
              required
            >
              <option value="">Selecione</option>
              {catalogData.postures.map((posture) => (
                <option key={posture.id} value={posture.id}>
                  Postura {posture.number}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Bateria ou área geral"
              value={form.batteryId}
              onChange={(event) => update('batteryId', event.target.value)}
              disabled={!form.postureId}
            >
              <option value="">Área geral da postura</option>
              {postureBatteries.map((battery) => (
                <option key={battery.id} value={battery.id}>
                  {battery.code}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Posição técnica"
              value={form.positionId}
              onChange={(event) => update('positionId', event.target.value)}
              disabled={!form.postureId || positions.isLoading}
            >
              <option value="">Sem posição específica</option>
              {positions.data?.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </SelectField>
          </div>

          {form.positionId && (
            <div className={styles.assetContext} data-empty={!installedAsset.data}>
              <Wrench />
              {installedAsset.isLoading ? (
                <span>Consultando ativo instalado...</span>
              ) : installedAsset.data ? (
                <span>
                  <strong>{installedAsset.data.asset_label ?? 'Ativo físico instalado'}</strong>
                  <small>
                    {[installedAsset.data.manufacturer_name, installedAsset.data.model_name]
                      .filter(Boolean)
                      .join(' · ') || 'Placa/modelo ainda não preenchidos'}
                  </small>
                </span>
              ) : (
                <span>
                  <strong>Posição sem ativo instalado</strong>
                  <small>A OS continuará vinculada ao local, sem inventar um equipamento.</small>
                </span>
              )}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeading}>
            <span>
              <ShieldAlert />
            </span>
            <div>
              <strong>2. Classificação</strong>
              <small>Direcione o chamado ao setor correto.</small>
            </div>
          </header>
          <div className={styles.grid}>
            <SelectField
              label="Setor"
              value={form.sectorId}
              onChange={(event) => {
                update('sectorId', event.target.value);
                update('problemTypeId', '');
              }}
              required
            >
              <option value="">Selecione</option>
              {catalogData.sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Tipo de problema"
              value={form.problemTypeId}
              onChange={(event) => update('problemTypeId', event.target.value)}
            >
              <option value="">Outros / não definido</option>
              {problemTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Prioridade"
              value={form.priorityId}
              onChange={(event) => update('priorityId', event.target.value)}
              required
            >
              <option value="">Selecione</option>
              {catalogData.priorities.map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.label}
                </option>
              ))}
            </SelectField>
          </div>
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeading}>
            <span>
              <ClipboardPlus />
            </span>
            <div>
              <strong>3. Descrição</strong>
              <small>Explique o sintoma observado no campo.</small>
            </div>
          </header>
          <FieldFrame id="work-order-description" label="O que está acontecendo?" required>
            <textarea
              id="work-order-description"
              className={styles.textarea}
              rows={7}
              maxLength={5000}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Ex.: motor da esteira de nylon superior aquecendo e desarmando após alguns minutos..."
              required
            />
          </FieldFrame>
          <label className={styles.photoPlaceholder} data-selected={Boolean(problemPhoto)}>
            <Camera />
            <span>
              <strong>{problemPhoto ? problemPhoto.name : 'Adicionar foto do problema'}</strong>
              <small>
                {problemPhoto
                  ? 'A imagem será otimizada e enviada junto com a abertura.'
                  : 'JPG, PNG ou WebP · você também poderá adicionar outras fotos depois.'}
              </small>
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(event) => setProblemPhoto(event.target.files?.[0] ?? null)}
            />
          </label>
        </section>

        {message && (
          <p className={styles.formMessage} role="alert">
            {message}
          </p>
        )}

        <footer className={styles.footer}>
          <p>Ao abrir, a OS ficará em “Aguardando atendimento” e será registrada na auditoria.</p>
          <Button
            type="submit"
            size="lg"
            leadingIcon={<ClipboardPlus />}
            loading={mutation.isPending}
          >
            Abrir Ordem de Serviço
          </Button>
        </footer>
      </form>
    </div>
  );
}
