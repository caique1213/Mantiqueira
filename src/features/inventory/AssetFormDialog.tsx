import { useEffect, useMemo, useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation } from '@tanstack/react-query';
import { Database, Info, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FieldFrame, SelectField, TextField } from '../../components/ui/Field';
import { IconButton } from '../../components/ui/IconButton';
import { normalizeError } from '../../lib/errors';
import { createAsset, updateAsset } from './inventory.api';
import type { AssetCatalogs, AssetDetail, AssetFormValues } from './inventory.types';
import styles from './inventory.module.css';

const emptyValues: AssetFormValues = {
  siteId: '',
  assetTypeId: '',
  manufacturerId: '',
  technicalModelId: '',
  statusId: '',
  internalCode: '',
  serialNumber: '',
  manufacturedOn: '',
  criticality: 'medium',
  dataSource: 'unknown',
  notes: '',
  nameplateText: '',
  specs: {},
};

const motorFields = [
  ['rated_power_kw', 'Potência (kW)', 'Ex.: 1,5'],
  ['rated_power_cv', 'Potência (cv)', 'Ex.: 2'],
  ['voltage_v', 'Tensões (V)', 'Ex.: 220, 380'],
  ['current_a', 'Correntes (A)', 'Ex.: 6,2; 3,6'],
  ['frequency_hz', 'Frequência (Hz)', 'Ex.: 60'],
  ['rpm', 'Rotação (RPM)', 'Ex.: 1730'],
  ['poles', 'Polos', 'Ex.: 4'],
  ['connection', 'Ligação', 'Ex.: Δ/Y'],
  ['frame', 'Carcaça', 'Ex.: 90L'],
  ['ip_rating', 'Grau de proteção', 'Ex.: IP55'],
  ['insulation_class', 'Classe de isolamento', 'Ex.: F'],
  ['efficiency_percent', 'Rendimento (%)', 'Ex.: 86,5'],
  ['power_factor', 'Fator de potência', 'Ex.: 0,82'],
  ['duty', 'Regime', 'Ex.: S1'],
  ['bearing_de', 'Rolamento DE', 'Ex.: 6205-2Z'],
  ['bearing_nde', 'Rolamento NDE', 'Ex.: 6204-2Z'],
] as const;

const reducerFields = [
  ['reducer_type', 'Tipo', 'Ex.: helicoidal'],
  ['ratio', 'Relação (i)', 'Ex.: 25,4'],
  ['input_rpm', 'RPM de entrada', 'Ex.: 1750'],
  ['output_rpm', 'RPM de saída', 'Ex.: 68,9'],
  ['torque_nm', 'Torque (N·m)', 'Ex.: 245'],
  ['mounting_position', 'Posição de montagem', 'Ex.: M1'],
  ['oil_type', 'Óleo', 'Ex.: CLP 220'],
  ['oil_quantity_l', 'Quantidade de óleo (L)', 'Ex.: 1,2'],
  ['output_shaft', 'Eixo de saída', 'Ex.: Ø 40 mm'],
] as const;

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogs: AssetCatalogs;
  initialValues?: AssetFormValues;
  asset?: AssetDetail;
  onSaved: (assetId: string) => void | Promise<void>;
}

export function AssetFormDialog({
  open,
  onOpenChange,
  catalogs,
  initialValues,
  asset,
  onSaved,
}: AssetFormDialogProps) {
  const [values, setValues] = useState<AssetFormValues>(emptyValues);
  const [validation, setValidation] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    const defaults = initialValues ?? emptyValues;
    setValues({
      ...emptyValues,
      ...defaults,
      siteId: defaults.siteId || catalogs.sites[0]?.id || '',
      statusId: defaults.statusId || catalogs.statuses[0]?.id || '',
      specs: { ...defaults.specs },
    });
    setValidation({});
  }, [catalogs.sites, catalogs.statuses, initialValues, open]);

  const selectedType = catalogs.assetTypes.find((item) => item.id === values.assetTypeId);
  const models = useMemo(
    () =>
      catalogs.technicalModels.filter(
        (item) =>
          item.assetTypeId === values.assetTypeId &&
          (!values.manufacturerId || item.manufacturerId === values.manufacturerId),
      ),
    [catalogs.technicalModels, values.assetTypeId, values.manufacturerId],
  );
  const selectedModel = catalogs.technicalModels.find(
    (item) => item.id === values.technicalModelId,
  );
  const specificFields =
    selectedType?.code === 'motor'
      ? motorFields
      : selectedType?.code === 'reducer'
        ? reducerFields
        : [];

  const mutation = useMutation({
    mutationFn: async () => {
      if (asset) {
        await updateAsset(asset, values);
        return asset.id;
      }
      const created = await createAsset(values);
      return created.id;
    },
    onSuccess: async (assetId) => {
      toast.success(
        asset ? 'Ativo atualizado com histórico preservado.' : 'Ativo físico cadastrado.',
      );
      setConfirming(false);
      onOpenChange(false);
      await onSaved(assetId);
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  const patch = <Key extends keyof AssetFormValues>(key: Key, value: AssetFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setValidation((current) => ({ ...current, [key]: '' }));
  };

  const requestConfirmation = (event: FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!values.siteId) errors.siteId = 'Selecione a unidade.';
    if (!values.assetTypeId) errors.assetTypeId = 'Selecione o tipo físico.';
    if (values.technicalModelId && selectedModel?.assetTypeId !== values.assetTypeId) {
      errors.technicalModelId = 'O modelo não pertence ao tipo selecionado.';
    }
    setValidation(errors);
    if (Object.keys(errors).length === 0) setConfirming(true);
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.dialogOverlay} />
          <Dialog.Content className={styles.assetFormDialog}>
            <header className={styles.dialogHeading}>
              <span className={styles.dialogHeadingIcon}>
                <Database />
              </span>
              <div>
                <Dialog.Title>
                  {asset ? 'Editar ativo físico' : 'Cadastrar ativo físico'}
                </Dialog.Title>
                <Dialog.Description>
                  A placa deste equipamento prevalece sobre qualquer dado sugerido pela biblioteca.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <IconButton label="Fechar" icon={<X />} />
              </Dialog.Close>
            </header>

            <form className={styles.assetForm} onSubmit={requestConfirmation}>
              <section className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                  <span>01</span>
                  <div>
                    <h3>Identidade física</h3>
                    <p>Dados que pertencem a este equipamento específico.</p>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <SelectField
                    label="Unidade"
                    value={values.siteId}
                    error={validation.siteId}
                    required
                    disabled={Boolean(asset)}
                    onChange={(event) => patch('siteId', event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {catalogs.sites.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Tipo de ativo"
                    value={values.assetTypeId}
                    error={validation.assetTypeId}
                    required
                    disabled={Boolean(asset)}
                    onChange={(event) => {
                      patch('assetTypeId', event.target.value);
                      patch('technicalModelId', '');
                    }}
                  >
                    <option value="">Selecione</option>
                    {catalogs.assetTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Código interno"
                    value={values.internalCode}
                    maxLength={80}
                    onChange={(event) => patch('internalCode', event.target.value)}
                  />
                  <TextField
                    label="Número de série"
                    value={values.serialNumber}
                    maxLength={160}
                    onChange={(event) => patch('serialNumber', event.target.value)}
                  />
                  <TextField
                    label="Data de fabricação"
                    type="date"
                    value={values.manufacturedOn}
                    onChange={(event) => patch('manufacturedOn', event.target.value)}
                  />
                  <SelectField
                    label="Criticidade"
                    value={values.criticality}
                    onChange={(event) =>
                      patch('criticality', event.target.value as AssetFormValues['criticality'])
                    }
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </SelectField>
                  {asset && (
                    <SelectField
                      label="Estado"
                      value={values.statusId}
                      onChange={(event) => patch('statusId', event.target.value)}
                    >
                      {catalogs.statuses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </SelectField>
                  )}
                </div>
              </section>

              <section className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                  <span>02</span>
                  <div>
                    <h3>Biblioteca técnica</h3>
                    <p>Referência reutilizável; ela nunca substitui a leitura da placa.</p>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <SelectField
                    label="Fabricante"
                    value={values.manufacturerId}
                    onChange={(event) => {
                      patch('manufacturerId', event.target.value);
                      patch('technicalModelId', '');
                    }}
                  >
                    <option value="">Não identificado</option>
                    {catalogs.manufacturers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Modelo de referência"
                    value={values.technicalModelId}
                    error={validation.technicalModelId}
                    disabled={!values.assetTypeId}
                    onChange={(event) => patch('technicalModelId', event.target.value)}
                  >
                    <option value="">Sem modelo vinculado</option>
                    {models.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </SelectField>
                </div>
                {selectedModel && (
                  <div className={styles.modelNotice}>
                    <Info />
                    <span>
                      <strong>{selectedModel.label}</strong>
                      {selectedModel.description || 'Dados de referência da biblioteca.'}
                    </span>
                    <small>
                      {selectedModel.verified ? 'Fonte verificada' : 'Confirmar na placa física'}
                    </small>
                  </div>
                )}
              </section>

              <section className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                  <span>03</span>
                  <div>
                    <h3>Dados da placa física</h3>
                    <p>Preencha exatamente o que está legível no equipamento instalado.</p>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <SelectField
                    label="Fonte dos dados"
                    value={values.dataSource}
                    onChange={(event) =>
                      patch('dataSource', event.target.value as AssetFormValues['dataSource'])
                    }
                  >
                    <option value="physical_nameplate">Placa física</option>
                    <option value="field_measurement">Medição em campo</option>
                    <option value="manual">Manual</option>
                    <option value="library">Biblioteca</option>
                    <option value="unknown">Não informada</option>
                  </SelectField>
                </div>
                {specificFields.length > 0 && (
                  <div className={styles.formGrid}>
                    {specificFields.map(([key, label, placeholder]) => (
                      <TextField
                        key={key}
                        label={label}
                        placeholder={placeholder}
                        inputMode={
                          [
                            'connection',
                            'frame',
                            'ip_rating',
                            'insulation_class',
                            'duty',
                            'bearing_de',
                            'bearing_nde',
                            'reducer_type',
                            'mounting_position',
                            'oil_type',
                            'output_shaft',
                          ].includes(key)
                            ? 'text'
                            : 'decimal'
                        }
                        value={values.specs[key] ?? ''}
                        onChange={(event) =>
                          patch('specs', { ...values.specs, [key]: event.target.value })
                        }
                      />
                    ))}
                  </div>
                )}
                <FieldFrame
                  id="asset-nameplate-extra"
                  label="Outros campos da placa"
                  hint="Uma informação por linha, no formato Campo: valor."
                >
                  <textarea
                    id="asset-nameplate-extra"
                    className={styles.textarea}
                    rows={4}
                    value={values.nameplateText}
                    onChange={(event) => patch('nameplateText', event.target.value)}
                    placeholder={'Ex.:\nCódigo da placa: 12345\nTemperatura ambiente: 40 °C'}
                  />
                </FieldFrame>
              </section>

              <section className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                  <span>04</span>
                  <div>
                    <h3>Observações</h3>
                    <p>Não use este campo para substituir o histórico de instalação.</p>
                  </div>
                </div>
                <FieldFrame id="asset-notes" label="Observações">
                  <textarea
                    id="asset-notes"
                    className={styles.textarea}
                    rows={4}
                    maxLength={5000}
                    value={values.notes}
                    onChange={(event) => patch('notes', event.target.value)}
                  />
                </FieldFrame>
              </section>

              <footer className={styles.formFooter}>
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost">
                    Cancelar
                  </Button>
                </Dialog.Close>
                <Button type="submit" leadingIcon={<Save />}>
                  Revisar e salvar
                </Button>
              </footer>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={asset ? 'Confirmar alteração do ativo' : 'Confirmar cadastro do ativo'}
        description={
          asset
            ? 'A ficha atual será atualizada e a alteração ficará registrada na timeline técnica.'
            : 'Será criado um novo ativo físico. Número de série, fotos e histórico serão exclusivos deste registro.'
        }
        confirmLabel={asset ? 'Salvar alterações' : 'Cadastrar ativo'}
        busy={mutation.isPending}
        onConfirm={async () => {
          await mutation.mutateAsync();
        }}
      />
    </>
  );
}
