import { useEffect, useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, ImagePlus, MapPin, PackageCheck, Unplug, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FieldFrame, SelectField, TextField } from '../../components/ui/Field';
import { IconButton } from '../../components/ui/IconButton';
import { StatePanel } from '../../components/ui/StatePanel';
import { normalizeError } from '../../lib/errors';
import {
  fetchAvailablePositions,
  fetchReplacementAssets,
  installAsset,
  removeAsset,
  replaceAsset,
  uploadAssetMedia,
} from './inventory.api';
import type { AssetDetail } from './inventory.types';
import styles from './inventory.module.css';

function localNow(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

interface LifecycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetDetail;
  onCompleted: () => void | Promise<void>;
}

interface InstallationDialogProps extends LifecycleDialogProps {
  initialPositionId?: string | null;
}

export function InstallationDialog({
  open,
  onOpenChange,
  asset,
  onCompleted,
  initialPositionId,
}: InstallationDialogProps) {
  const [positionId, setPositionId] = useState('');
  const [installedAt, setInstalledAt] = useState(localNow);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const positions = useQuery({
    queryKey: ['available-asset-positions', asset.siteId, asset.assetTypeId],
    queryFn: () => fetchAvailablePositions(asset.siteId, asset.assetTypeId),
    enabled: open,
  });
  useEffect(() => {
    if (!open) return;
    setPositionId(initialPositionId ?? '');
    setInstalledAt(localNow());
    setReason('');
  }, [initialPositionId, open]);
  const selected = positions.data?.find((item) => item.id === positionId);
  const mutation = useMutation({
    mutationFn: () =>
      installAsset({ assetId: asset.id, assetPositionId: positionId, installedAt, reason }),
    onSuccess: async () => {
      toast.success('Instalação registrada sem apagar o histórico anterior.');
      setConfirming(false);
      onOpenChange(false);
      await onCompleted();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });
  const requestConfirmation = (event: FormEvent) => {
    event.preventDefault();
    if (!positionId || !installedAt) return;
    setConfirming(true);
  };

  return (
    <>
      <WorkflowDialog
        open={open}
        onOpenChange={onOpenChange}
        icon={<MapPin />}
        title="Instalar ativo"
        description="Associe o equipamento físico a uma posição técnica livre."
      >
        {positions.isLoading ? (
          <div className={styles.dialogLoading}>Carregando posições disponíveis…</div>
        ) : positions.isError ? (
          <StatePanel
            compact
            kind="error"
            title="Posições indisponíveis"
            description={positions.error.message}
            actionLabel="Tentar novamente"
            onAction={() => void positions.refetch()}
          />
        ) : positions.data?.length ? (
          <form className={styles.workflowForm} onSubmit={requestConfirmation}>
            <SelectField
              label="Posição técnica"
              value={positionId}
              required
              onChange={(event) => setPositionId(event.target.value)}
            >
              <option value="">Selecione</option>
              {positions.data.map((item) => (
                <option key={item.id} value={item.id}>
                  Postura {String(item.postureNumber).padStart(2, '0')}
                  {item.batteryCode ? ` · ${item.batteryCode}` : ''} — {item.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Data e hora da instalação"
              type="datetime-local"
              value={installedAt}
              required
              onChange={(event) => setInstalledAt(event.target.value)}
            />
            <FieldFrame id="installation-reason" label="Motivo / contexto">
              <textarea
                id="installation-reason"
                className={styles.textarea}
                rows={3}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ex.: instalação inicial após levantamento de campo"
              />
            </FieldFrame>
            <div className={styles.workflowActions}>
              <Button type="submit" leadingIcon={<PackageCheck />}>
                Revisar instalação
              </Button>
            </div>
          </form>
        ) : (
          <StatePanel
            compact
            kind="empty"
            title="Nenhuma posição compatível livre"
            description="Todas as posições deste tipo estão ocupadas ou não estão disponíveis para sua unidade."
          />
        )}
      </WorkflowDialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Confirmar instalação"
        description={
          selected
            ? `O ativo será instalado na Postura ${String(selected.postureNumber).padStart(2, '0')}${selected.batteryCode ? `, ${selected.batteryCode}` : ''}, posição ${selected.name}.`
            : 'Confirme a posição selecionada.'
        }
        confirmLabel="Registrar instalação"
        busy={mutation.isPending}
        onConfirm={() => mutation.mutateAsync()}
      />
    </>
  );
}

export function RemovalDialog({
  open,
  onOpenChange,
  asset,
  onCompleted,
}: LifecycleDialogProps) {
  const [removedAt, setRemovedAt] = useState(localNow);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRemovedAt(localNow());
    setReason('');
    setNotes('');
    setConfirming(false);
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!asset.currentLocation) throw new Error('A instalação atual não está mais disponível.');
      return removeAsset({
        installationId: asset.currentLocation.installationId,
        removedAt,
        reason,
        notes,
      });
    },
    onSuccess: async () => {
      toast.success('Ativo removido da posição; todo o histórico foi preservado.');
      setConfirming(false);
      onOpenChange(false);
      await onCompleted();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  return (
    <>
      <WorkflowDialog
        open={open}
        onOpenChange={onOpenChange}
        icon={<Unplug />}
        title="Remover ativo da posição"
        description="Encerra a instalação atual sem apagar o ativo, as fotos, as OS ou a linha do tempo."
      >
        <form
          className={styles.workflowForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (removedAt && reason.trim().length >= 3) setConfirming(true);
          }}
        >
          <TextField
            label="Data e hora da remoção"
            type="datetime-local"
            value={removedAt}
            required
            onChange={(event) => setRemovedAt(event.target.value)}
          />
          <TextField
            label="Motivo da remoção"
            value={reason}
            minLength={3}
            maxLength={1000}
            required
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex.: equipamento retirado para manutenção em bancada"
          />
          <FieldFrame id="removal-notes" label="Observações">
            <textarea
              id="removal-notes"
              className={styles.textarea}
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FieldFrame>
          <div className={styles.workflowActions}>
            <Button type="submit" variant="danger" leadingIcon={<Unplug />}>
              Revisar remoção
            </Button>
          </div>
        </form>
      </WorkflowDialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Confirmar remoção técnica"
        description={
          <>
            A instalação em <strong>{asset.currentLocation?.positionName}</strong> será encerrada.
            O ativo continuará disponível no inventário e poderá ser instalado novamente.
          </>
        }
        confirmLabel="Remover da posição"
        tone="danger"
        typedConfirmation="REMOVER"
        busy={mutation.isPending}
        onConfirm={() => mutation.mutateAsync()}
      />
    </>
  );
}

export function ReplacementDialog({
  open,
  onOpenChange,
  asset,
  onCompleted,
}: LifecycleDialogProps) {
  const [newAssetId, setNewAssetId] = useState('');
  const [replacedAt, setReplacedAt] = useState(localNow);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const candidates = useQuery({
    queryKey: ['replacement-assets', asset.siteId, asset.assetTypeId, asset.id],
    queryFn: () => fetchReplacementAssets(asset.siteId, asset.assetTypeId, asset.id),
    enabled: open,
  });
  useEffect(() => {
    if (!open) return;
    setNewAssetId('');
    setReplacedAt(localNow());
    setReason('');
    setNotes('');
  }, [open]);
  const selected = candidates.data?.find((item) => item.id === newAssetId);
  const mutation = useMutation({
    mutationFn: () => {
      if (!asset.currentLocation) throw new Error('A instalação atual não está mais disponível.');
      return replaceAsset({
        currentInstallationId: asset.currentLocation.installationId,
        newAssetId,
        replacedAt,
        reason,
        notes,
      });
    },
    onSuccess: async () => {
      toast.success('Substituição concluída; os dois ativos mantiveram seus históricos.');
      setConfirming(false);
      onOpenChange(false);
      await onCompleted();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });
  const requestConfirmation = (event: FormEvent) => {
    event.preventDefault();
    if (newAssetId && replacedAt && reason.trim().length >= 3) setConfirming(true);
  };
  return (
    <>
      <WorkflowDialog
        open={open}
        onOpenChange={onOpenChange}
        icon={<ArrowLeftRight />}
        title="Substituir ativo"
        description="Encerra a instalação atual e cria a nova em uma única transação."
      >
        {candidates.isLoading ? (
          <div className={styles.dialogLoading}>Localizando ativos de reserva…</div>
        ) : candidates.isError ? (
          <StatePanel
            compact
            kind="error"
            title="Reservas indisponíveis"
            description={candidates.error.message}
            actionLabel="Tentar novamente"
            onAction={() => void candidates.refetch()}
          />
        ) : candidates.data?.length ? (
          <form className={styles.workflowForm} onSubmit={requestConfirmation}>
            <SelectField
              label="Novo ativo físico"
              value={newAssetId}
              required
              onChange={(event) => setNewAssetId(event.target.value)}
            >
              <option value="">Selecione um ativo não instalado</option>
              {candidates.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Data e hora da troca"
              type="datetime-local"
              value={replacedAt}
              required
              onChange={(event) => setReplacedAt(event.target.value)}
            />
            <TextField
              label="Motivo da substituição"
              value={reason}
              minLength={3}
              maxLength={1000}
              required
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: falha elétrica irreparável"
            />
            <FieldFrame id="replacement-notes" label="Observações">
              <textarea
                id="replacement-notes"
                className={styles.textarea}
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </FieldFrame>
            <div className={styles.workflowActions}>
              <Button type="submit" leadingIcon={<ArrowLeftRight />}>
                Revisar substituição
              </Button>
            </div>
          </form>
        ) : (
          <StatePanel
            compact
            kind="empty"
            title="Nenhum ativo de reserva compatível"
            description="Cadastre outro ativo físico do mesmo tipo e unidade antes de realizar a substituição."
          />
        )}
      </WorkflowDialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Confirmar substituição técnica"
        description={
          <>
            <strong>{asset.internalCode ?? asset.serialNumber ?? asset.id.slice(0, 8)}</strong> será
            removido da posição atual e substituído por{' '}
            <strong>{selected?.label ?? 'outro ativo'}</strong>. Nenhum histórico será apagado.
          </>
        }
        confirmLabel="Substituir ativo"
        tone="danger"
        typedConfirmation="SUBSTITUIR"
        busy={mutation.isPending}
        onConfirm={() => mutation.mutateAsync()}
      />
    </>
  );
}

export function MediaUploadDialog({
  open,
  onOpenChange,
  asset,
  onCompleted,
}: LifecycleDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'general' | 'nameplate'>('nameplate');
  const [caption, setCaption] = useState('');
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setMediaType('nameplate');
    setCaption('');
  }, [open]);
  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Selecione uma imagem.');
      return uploadAssetMedia({
        assetId: asset.id,
        siteId: asset.siteId,
        file,
        mediaType,
        caption,
      });
    },
    onSuccess: async () => {
      toast.success('Imagem otimizada e armazenada de forma privada.');
      onOpenChange(false);
      await onCompleted();
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });
  return (
    <WorkflowDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<ImagePlus />}
      title="Adicionar foto privada"
      description="A imagem será convertida para WebP e só será aberta com URL assinada temporária."
    >
      <form
        className={styles.workflowForm}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <SelectField
          label="Tipo da imagem"
          value={mediaType}
          onChange={(event) => setMediaType(event.target.value as 'general' | 'nameplate')}
        >
          <option value="nameplate">Foto da placa</option>
          <option value="general">Foto geral do ativo</option>
        </SelectField>
        <FieldFrame
          id="asset-media-file"
          label="Imagem"
          required
          hint="JPEG, PNG, HEIC compatível com o navegador ou WebP; máximo de 25 MB após otimização."
        >
          <input
            id="asset-media-file"
            className={styles.fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </FieldFrame>
        <TextField
          label="Legenda"
          value={caption}
          maxLength={300}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Ex.: placa do motor após limpeza"
        />
        <div className={styles.workflowActions}>
          <Button type="submit" loading={mutation.isPending} leadingIcon={<ImagePlus />}>
            Enviar com segurança
          </Button>
        </div>
      </form>
    </WorkflowDialog>
  );
}

function WorkflowDialog({
  open,
  onOpenChange,
  icon,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content className={styles.workflowDialog}>
          <header className={styles.dialogHeading}>
            <span className={styles.dialogHeadingIcon}>{icon}</span>
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Fechar" icon={<X />} />
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
