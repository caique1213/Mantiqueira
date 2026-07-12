import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import {
  BookOpenCheck,
  Boxes,
  ChevronRight,
  CircleDot,
  Factory,
  Flag,
  Gauge,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { IconButton } from '../../components/ui/IconButton';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import {
  deleteAdminCatalog,
  fetchAdminCatalogs,
  saveAdminCatalog,
  suggestedCatalogCode,
  type AdminCatalogData,
  type AdminCatalogItem,
  type AdminCatalogKind,
} from './admin.api';
import styles from './administration.module.css';

const catalogDefinitions: Array<{
  kind: AdminCatalogKind;
  title: string;
  description: string;
  icon: typeof CircleDot;
  createLabel: string;
}> = [
  {
    kind: 'work-order-statuses',
    title: 'Status de OS',
    description: 'Rótulo e aparência editáveis; a semântica terminal permanece protegida.',
    icon: CircleDot,
    createLabel: 'Novo status',
  },
  {
    kind: 'priorities',
    title: 'Prioridades',
    description: 'Peso operacional, SLA, ícone, cor e ordem de exibição.',
    icon: Flag,
    createLabel: 'Nova prioridade',
  },
  {
    kind: 'problem-types',
    title: 'Tipos de problema',
    description: 'Classificações de falha e vínculo opcional ao setor responsável.',
    icon: Gauge,
    createLabel: 'Novo tipo',
  },
  {
    kind: 'manufacturers',
    title: 'Fabricantes',
    description: 'Marcas usadas na biblioteca técnica e nos ativos físicos.',
    icon: Factory,
    createLabel: 'Novo fabricante',
  },
  {
    kind: 'technical-models',
    title: 'Modelos técnicos',
    description: 'Dados de referência que sugerem valores, sem substituir a placa física.',
    icon: BookOpenCheck,
    createLabel: 'Novo modelo',
  },
  {
    kind: 'asset-types',
    title: 'Tipos de ativo',
    description: 'Domínio elétrico, mecânico ou geral e organização do inventário.',
    icon: Boxes,
    createLabel: 'Novo tipo de ativo',
  },
  {
    kind: 'ui-modules',
    title: 'Módulos de navegação',
    description: 'Nome, descrição, ícone, permissão, visibilidade e ordem do menu.',
    icon: LayoutGrid,
    createLabel: 'Novo módulo',
  },
];

interface FormValues {
  name: string;
  code: string;
  description: string;
  semanticState: string;
  color: string;
  icon: string;
  weight: string;
  slaMinutes: string;
  sectorId: string;
  domain: string;
  website: string;
  assetTypeId: string;
  manufacturerId: string;
  referenceSpecs: string;
  sourceName: string;
  sourceUrl: string;
  verified: boolean;
  confidence: string;
  active: boolean;
  sortOrder: string;
  route: string;
  requiredPermission: string;
  visible: boolean;
}

const emptyForm: FormValues = {
  name: '',
  code: '',
  description: '',
  semanticState: 'awaiting',
  color: '#F6B900',
  icon: 'circle',
  weight: '10',
  slaMinutes: '',
  sectorId: '',
  domain: 'general',
  website: '',
  assetTypeId: '',
  manufacturerId: '',
  referenceSpecs: '{}',
  sourceName: '',
  sourceUrl: '',
  verified: false,
  confidence: 'unverified',
  active: true,
  sortOrder: '100',
  route: '/',
  requiredPermission: '',
  visible: true,
};

function formFromItem(item: AdminCatalogItem | null): FormValues {
  if (!item) return { ...emptyForm };
  return {
    name: item.name,
    code: item.code,
    description: item.description,
    semanticState: item.semantic_state ?? 'awaiting',
    color: item.color ?? '#F6B900',
    icon: item.icon ?? 'circle',
    weight: String(item.weight ?? 10),
    slaMinutes: item.sla_minutes === null ? '' : String(item.sla_minutes),
    sectorId: item.sector_id ?? '',
    domain: item.domain ?? 'general',
    website: item.website ?? '',
    assetTypeId: item.asset_type_id ?? '',
    manufacturerId: item.manufacturer_id ?? '',
    referenceSpecs: JSON.stringify(item.reference_specs, null, 2),
    sourceName: item.source_name ?? '',
    sourceUrl: item.source_url ?? '',
    verified: item.verified ?? false,
    confidence: item.confidence ?? 'unverified',
    active: item.active,
    sortOrder: String(item.sort_order),
    route: item.route ?? '/',
    requiredPermission: item.required_permission ?? '',
    visible: item.visible ?? item.active,
  };
}

function buildPayload(kind: AdminCatalogKind, values: FormValues, creating: boolean) {
  const baseCode = values.code.trim() || suggestedCatalogCode(values.name, kind);
  switch (kind) {
    case 'work-order-statuses':
      return {
        name: values.name,
        color: values.color,
        icon: values.icon,
        sort_order: Number(values.sortOrder),
        ...(creating ? { code: baseCode, semantic_state: values.semanticState } : {}),
      };
    case 'priorities':
      return {
        name: values.name,
        weight: Number(values.weight),
        sla_minutes: values.slaMinutes ? Number(values.slaMinutes) : null,
        color: values.color,
        icon: values.icon,
        active: values.active,
        sort_order: Number(values.sortOrder),
        ...(creating ? { code: baseCode } : {}),
      };
    case 'problem-types':
      return {
        name: values.name,
        description: values.description,
        sector_id: values.sectorId || null,
        active: values.active,
        sort_order: Number(values.sortOrder),
        ...(creating ? { code: baseCode } : {}),
      };
    case 'manufacturers':
      return { name: values.name, website: values.website, active: values.active };
    case 'technical-models': {
      const referenceSpecs = JSON.parse(values.referenceSpecs) as unknown;
      if (!referenceSpecs || typeof referenceSpecs !== 'object' || Array.isArray(referenceSpecs)) {
        throw new Error('As especificações de referência devem formar um objeto JSON.');
      }
      return {
        asset_type_id: values.assetTypeId,
        manufacturer_id: values.manufacturerId,
        model: values.name,
        description: values.description,
        reference_specs: referenceSpecs,
        source_name: values.sourceName || null,
        source_url: values.sourceUrl || null,
        verified: values.verified,
        confidence: values.confidence,
        active: values.active,
      };
    }
    case 'asset-types':
      return {
        name: values.name,
        icon: values.icon,
        active: values.active,
        sort_order: Number(values.sortOrder),
        ...(creating ? { code: baseCode, domain: values.domain } : {}),
      };
    case 'ui-modules':
      return {
        label: values.name,
        description: values.description,
        icon: values.icon,
        required_permission: values.requiredPermission || null,
        visible: values.visible,
        sort_order: Number(values.sortOrder),
        ...(creating ? { slug: baseCode.replaceAll('_', '-'), route: values.route } : {}),
      };
  }
}

function itemMetadata(kind: AdminCatalogKind, item: AdminCatalogItem, data: AdminCatalogData) {
  switch (kind) {
    case 'work-order-statuses':
      return `${item.semantic_state ?? 'sem semântica'} · ${item.is_terminal ? 'terminal' : 'operacional'}`;
    case 'priorities':
      return `Peso ${item.weight ?? 0}${item.sla_minutes ? ` · SLA ${item.sla_minutes} min` : ' · sem SLA'}`;
    case 'problem-types':
      return (
        data.sectors.find((sector) => sector.id === item.sector_id)?.name ?? 'Todos os setores'
      );
    case 'manufacturers':
      return item.website || 'Sem site informado';
    case 'technical-models': {
      const maker = data.catalogs.manufacturers.find(
        (entry) => entry.id === item.manufacturer_id,
      )?.name;
      const type = data.catalogs['asset-types'].find(
        (entry) => entry.id === item.asset_type_id,
      )?.name;
      return [maker, type, item.verified ? 'verificado' : item.confidence]
        .filter(Boolean)
        .join(' · ');
    }
    case 'asset-types':
      return `${item.domain ?? 'geral'} · código ${item.code}`;
    case 'ui-modules':
      return `${item.route ?? '/'} · ${item.required_permission ?? 'sem permissão específica'}`;
  }
}

export function CatalogsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin-catalogs'], queryFn: fetchAdminCatalogs });
  const [selectedKind, setSelectedKind] = useState<AdminCatalogKind>('work-order-statuses');
  const [search, setSearch] = useState('');
  const [editorItem, setEditorItem] = useState<AdminCatalogItem | null | undefined>(undefined);
  const [deleteItem, setDeleteItem] = useState<AdminCatalogItem | null>(null);

  const saveMutation = useMutation({
    mutationFn: saveAdminCatalog,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-catalogs'] });
      setEditorItem(undefined);
      toast.success('Catálogo salvo e disponibilizado no sistema.');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: AdminCatalogItem) => deleteAdminCatalog(selectedKind, item),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-catalogs'] });
      setDeleteItem(null);
      toast.success('Item excluído do catálogo.');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir.'),
  });

  const selectedDefinition = catalogDefinitions.find(
    (definition) => definition.kind === selectedKind,
  )!;
  const visibleItems = useMemo(() => {
    const items = query.data?.catalogs[selectedKind] ?? [];
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.name} ${item.code} ${item.description}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalized),
    );
  }, [query.data, search, selectedKind]);

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) {
    return (
      <StatePanel
        kind="error"
        title="Catálogos indisponíveis"
        description={query.error?.message ?? 'Sem dados.'}
      />
    );
  }

  const SelectedIcon = selectedDefinition.icon;
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <span>CATÁLOGOS</span>
          <h2>Regras administráveis</h2>
          <p>Cadastros funcionais com proteção das semânticas e estruturas essenciais.</p>
        </div>
      </header>

      <div className={styles.catalogWorkspace}>
        <nav className={styles.catalogNavigation} aria-label="Catálogos administrativos">
          {catalogDefinitions.map((definition) => {
            const Icon = definition.icon;
            const count = query.data.catalogs[definition.kind].length;
            return (
              <button
                key={definition.kind}
                type="button"
                className={
                  selectedKind === definition.kind
                    ? styles.catalogNavActive
                    : styles.catalogNavButton
                }
                onClick={() => {
                  setSelectedKind(definition.kind);
                  setSearch('');
                }}
              >
                <Icon />
                <span>
                  <strong>{definition.title}</strong>
                  <small>{count} registros</small>
                </span>
                <ChevronRight />
              </button>
            );
          })}
        </nav>

        <div className={styles.catalogContent}>
          <div className={styles.catalogContentHeader}>
            <div className={styles.catalogTitle}>
              <span>
                <SelectedIcon />
              </span>
              <div>
                <h3>{selectedDefinition.title}</h3>
                <p>{selectedDefinition.description}</p>
              </div>
            </div>
            <Button leadingIcon={<Plus />} onClick={() => setEditorItem(null)}>
              {selectedDefinition.createLabel}
            </Button>
          </div>

          <label className={styles.catalogSearch}>
            <Search aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Pesquisar em ${selectedDefinition.title.toLocaleLowerCase('pt-BR')}...`}
            />
          </label>

          {selectedKind === 'ui-modules' && (
            <div className={styles.catalogNotice}>
              Códigos e rotas de módulos existentes ficam bloqueados; você pode ajustar
              apresentação, permissão, visibilidade e ordem.
            </div>
          )}

          <div className={styles.catalogRows}>
            {visibleItems.length === 0 ? (
              <StatePanel
                kind="empty"
                title="Nenhum registro encontrado"
                description="Ajuste a busca ou crie um item personalizado."
              />
            ) : (
              visibleItems.map((item) => (
                <article key={item.id} className={styles.catalogRow}>
                  <span
                    className={styles.catalogColor}
                    style={item.color ? { backgroundColor: item.color } : undefined}
                    aria-hidden="true"
                  >
                    {!item.color && item.name.charAt(0).toUpperCase()}
                  </span>
                  <div className={styles.catalogIdentity}>
                    <strong>{item.name}</strong>
                    <small>{itemMetadata(selectedKind, item, query.data)}</small>
                  </div>
                  <div className={styles.catalogFlags}>
                    {item.system && <span>Sistema</span>}
                    <span className={item.active ? styles.catalogActive : styles.catalogInactive}>
                      {item.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className={styles.catalogActions}>
                    <IconButton
                      label={`Editar ${item.name}`}
                      icon={<Pencil />}
                      onClick={() => setEditorItem(item)}
                    />
                    {!item.system && (
                      <IconButton
                        label={`Excluir ${item.name}`}
                        icon={<Trash2 />}
                        onClick={() => setDeleteItem(item)}
                      />
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      <CatalogEditorDialog
        open={editorItem !== undefined}
        item={editorItem ?? null}
        kind={selectedKind}
        data={query.data}
        busy={saveMutation.isPending}
        onOpenChange={(open) => !open && setEditorItem(undefined)}
        onSave={async (values) => {
          await saveMutation.mutateAsync({
            kind: selectedKind,
            id: editorItem?.id ?? null,
            values: buildPayload(selectedKind, values, !editorItem),
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteItem)}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Excluir item do catálogo"
        description={
          <p>
            O item <strong>{deleteItem?.name}</strong> será excluído. Se já estiver em uso, o banco
            bloqueará a operação para preservar o histórico.
          </p>
        }
        confirmLabel="Excluir definitivamente"
        typedConfirmation="EXCLUIR"
        tone="danger"
        busy={deleteMutation.isPending}
        onConfirm={async () => {
          if (deleteItem) await deleteMutation.mutateAsync(deleteItem);
        }}
      />
    </section>
  );
}

function CatalogEditorDialog({
  open,
  item,
  kind,
  data,
  busy,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  item: AdminCatalogItem | null;
  kind: AdminCatalogKind;
  data: AdminCatalogData;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: FormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>(() => formFromItem(item));
  const [formError, setFormError] = useState<string | null>(null);
  const creating = item === null;

  useEffect(() => {
    if (open) {
      setValues(formFromItem(item));
      setFormError(null);
    }
  }, [item, open]);

  function update<Key extends keyof FormValues>(key: Key, value: FormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await onSave(values);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Revise os campos informados.');
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.catalogDialogOverlay} />
        <Dialog.Content className={styles.catalogDialog}>
          <header className={styles.catalogDialogHeader}>
            <div>
              <span>
                {creating ? 'NOVO REGISTRO' : item.system ? 'ITEM ESTRUTURAL' : 'EDITAR REGISTRO'}
              </span>
              <Dialog.Title>{creating ? 'Adicionar ao catálogo' : item.name}</Dialog.Title>
              <Dialog.Description>
                {item?.system
                  ? 'Campos estruturais estão bloqueados para preservar os fluxos do sistema.'
                  : 'A alteração será validada pelas regras e permissões do banco.'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Fechar" icon={<X />} />
            </Dialog.Close>
          </header>

          <form className={styles.catalogForm} onSubmit={(event) => void submit(event)}>
            <CatalogFields kind={kind} item={item} values={values} data={data} update={update} />
            {formError && (
              <p className={styles.catalogFormError} role="alert">
                {formError}
              </p>
            )}
            <footer className={styles.catalogDialogFooter}>
              <Dialog.Close asChild>
                <Button variant="ghost" type="button">
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button type="submit" loading={busy}>
                {creating ? 'Criar registro' : 'Salvar alterações'}
              </Button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CatalogFields({
  kind,
  item,
  values,
  data,
  update,
}: {
  kind: AdminCatalogKind;
  item: AdminCatalogItem | null;
  values: FormValues;
  data: AdminCatalogData;
  update: <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) => void;
}) {
  const creating = item === null;
  const system = item?.system ?? false;
  const text =
    (key: keyof FormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      update(key, event.target.value as never);
  const checkbox = (key: keyof FormValues) => (event: React.ChangeEvent<HTMLInputElement>) =>
    update(key, event.target.checked as never);

  return (
    <div className={styles.catalogFormGrid}>
      <label className={styles.catalogField}>
        <span>
          {kind === 'technical-models' ? 'Modelo' : kind === 'ui-modules' ? 'Nome no menu' : 'Nome'}{' '}
          *
        </span>
        <input value={values.name} onChange={text('name')} required maxLength={160} />
      </label>

      {creating && !['manufacturers', 'technical-models'].includes(kind) && (
        <label className={styles.catalogField}>
          <span>{kind === 'ui-modules' ? 'Slug' : 'Código'} *</span>
          <input
            value={values.code}
            onChange={text('code')}
            placeholder={suggestedCatalogCode(values.name || 'novo item', kind)}
          />
        </label>
      )}

      {kind === 'work-order-statuses' && creating && (
        <label className={styles.catalogField}>
          <span>Semântica *</span>
          <select value={values.semanticState} onChange={text('semanticState')}>
            <option value="awaiting">Aguardando</option>
            <option value="in_progress">Em execução</option>
            <option value="waiting_part">Aguardando peça</option>
            <option value="resolved">Resolvida / terminal</option>
            <option value="cancelled">Cancelada / terminal</option>
          </select>
        </label>
      )}

      {kind === 'priorities' && (
        <>
          <label className={styles.catalogField}>
            <span>Peso *</span>
            <input
              type="number"
              min="0"
              max="1000"
              value={values.weight}
              onChange={text('weight')}
              required
            />
          </label>
          <label className={styles.catalogField}>
            <span>SLA em minutos</span>
            <input
              type="number"
              min="1"
              value={values.slaMinutes}
              onChange={text('slaMinutes')}
              placeholder="Sem SLA"
            />
          </label>
        </>
      )}

      {kind === 'problem-types' && (
        <label className={styles.catalogField}>
          <span>Setor</span>
          <select value={values.sectorId} onChange={text('sectorId')}>
            <option value="">Todos os setores</option>
            {data.sectors.map((sector) => (
              <option key={sector.id} value={sector.id}>
                {sector.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {kind === 'manufacturers' && (
        <label className={styles.catalogField}>
          <span>Site oficial</span>
          <input
            type="url"
            value={values.website}
            onChange={text('website')}
            placeholder="https://..."
          />
        </label>
      )}

      {kind === 'technical-models' && (
        <>
          <label className={styles.catalogField}>
            <span>Tipo de ativo *</span>
            <select value={values.assetTypeId} onChange={text('assetTypeId')} required>
              <option value="">Selecione</option>
              {data.catalogs['asset-types']
                .filter((entry) => entry.active)
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
            </select>
          </label>
          <label className={styles.catalogField}>
            <span>Fabricante *</span>
            <select value={values.manufacturerId} onChange={text('manufacturerId')} required>
              <option value="">Selecione</option>
              {data.catalogs.manufacturers
                .filter((entry) => entry.active)
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
            </select>
          </label>
        </>
      )}

      {kind === 'asset-types' && creating && (
        <label className={styles.catalogField}>
          <span>Domínio *</span>
          <select value={values.domain} onChange={text('domain')}>
            <option value="electrical">Elétrico</option>
            <option value="mechanical">Mecânico</option>
            <option value="general">Geral</option>
          </select>
        </label>
      )}

      {kind === 'ui-modules' && creating && (
        <label className={styles.catalogField}>
          <span>Rota *</span>
          <input
            value={values.route}
            onChange={text('route')}
            required
            pattern="/.*"
            placeholder="/novo-modulo"
          />
        </label>
      )}

      {kind === 'ui-modules' && (
        <label className={styles.catalogField}>
          <span>Permissão necessária</span>
          <select value={values.requiredPermission} onChange={text('requiredPermission')}>
            <option value="">Nenhuma permissão específica</option>
            {data.permissions.map((permission) => (
              <option key={permission.id} value={permission.code}>
                {permission.code} — {permission.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {['work-order-statuses', 'priorities'].includes(kind) && (
        <label className={styles.catalogField}>
          <span>Cor *</span>
          <span className={styles.colorField}>
            <input type="color" value={values.color} onChange={text('color')} />
            <input value={values.color} onChange={text('color')} pattern="#[0-9A-Fa-f]{6}" />
          </span>
        </label>
      )}

      {['work-order-statuses', 'priorities', 'asset-types', 'ui-modules'].includes(kind) && (
        <label className={styles.catalogField}>
          <span>Ícone Lucide *</span>
          <input value={values.icon} onChange={text('icon')} required />
        </label>
      )}

      {['work-order-statuses', 'priorities', 'problem-types', 'asset-types', 'ui-modules'].includes(
        kind,
      ) && (
        <label className={styles.catalogField}>
          <span>Ordem *</span>
          <input
            type="number"
            min="0"
            max="32767"
            value={values.sortOrder}
            onChange={text('sortOrder')}
            required
          />
        </label>
      )}

      {['problem-types', 'technical-models', 'ui-modules'].includes(kind) && (
        <label className={`${styles.catalogField} ${styles.catalogFieldWide}`}>
          <span>Descrição</span>
          <textarea
            value={values.description}
            onChange={text('description')}
            rows={3}
            maxLength={2000}
          />
        </label>
      )}

      {kind === 'technical-models' && (
        <>
          <label className={styles.catalogField}>
            <span>Fonte</span>
            <input
              value={values.sourceName}
              onChange={text('sourceName')}
              placeholder="Catálogo oficial"
            />
          </label>
          <label className={styles.catalogField}>
            <span>URL da fonte</span>
            <input
              type="url"
              value={values.sourceUrl}
              onChange={text('sourceUrl')}
              placeholder="https://..."
            />
          </label>
          <label className={styles.catalogField}>
            <span>Confiança</span>
            <select value={values.confidence} onChange={text('confidence')}>
              <option value="unverified">Não verificado</option>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="verified">Verificada</option>
            </select>
          </label>
          <label className={`${styles.catalogField} ${styles.catalogFieldWide}`}>
            <span>Especificações de referência (JSON)</span>
            <textarea
              className={styles.catalogCodeArea}
              value={values.referenceSpecs}
              onChange={text('referenceSpecs')}
              rows={8}
              spellCheck={false}
            />
          </label>
        </>
      )}

      {kind === 'ui-modules' && (
        <label className={styles.catalogCheck}>
          <input type="checkbox" checked={values.visible} onChange={checkbox('visible')} />
          <span>
            <strong>Visível na navegação</strong>
            <small>Usuários ainda precisam ter a permissão configurada.</small>
          </span>
        </label>
      )}

      {!['work-order-statuses', 'ui-modules'].includes(kind) && (
        <label className={styles.catalogCheck}>
          <input
            type="checkbox"
            checked={values.active}
            disabled={system}
            onChange={checkbox('active')}
          />
          <span>
            <strong>Registro ativo</strong>
            <small>
              {system
                ? 'Itens estruturais não podem ser desativados.'
                : 'Inativos deixam de aparecer nas novas seleções.'}
            </small>
          </span>
        </label>
      )}

      {kind === 'technical-models' && (
        <label className={styles.catalogCheck}>
          <input type="checkbox" checked={values.verified} onChange={checkbox('verified')} />
          <span>
            <strong>Fonte verificada</strong>
            <small>A placa física do ativo instalado continua prevalecendo.</small>
          </span>
        </label>
      )}
    </div>
  );
}
