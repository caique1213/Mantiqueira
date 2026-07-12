import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  CircleGauge,
  Factory,
  FilterX,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { FilterBar } from '../../components/ui/FilterBar';
import { SelectField, TextField } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAuth } from '../auth/AuthProvider';
import { AssetFormDialog } from './AssetFormDialog';
import { fetchAssetCatalogs, fetchInventoryPage } from './inventory.api';
import type { AssetCriticality, InventoryFilters } from './inventory.types';
import styles from './inventory.module.css';

const initialFilters: InventoryFilters = {
  search: '',
  assetTypeId: '',
  manufacturerId: '',
  postureNumber: '',
  completeness: 'all',
};

const criticalityLabels: Record<AssetCriticality, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export function InventoryPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<InventoryFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const pageSize = 18;
  const debouncedSearch = useDebouncedValue(filters.search, 350);
  const appliedFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [debouncedSearch, filters],
  );
  const canView = auth.hasPermission('assets.view');
  const canCreate = ['assets.edit.all', 'assets.edit.electrical', 'assets.edit.mechanical'].some(
    auth.hasPermission,
  );
  const createRequested = searchParams.get('create') === '1';
  const requestedPositionId = searchParams.get('position');
  const requestedPosture = searchParams.get('posture');

  useEffect(() => {
    if (createRequested && canCreate) setCreateOpen(true);
  }, [canCreate, createRequested]);

  useEffect(() => {
    if (!requestedPosture || !/^([1-9]|[1-3][0-9]|4[0-8])$/.test(requestedPosture)) return;
    setFilters((current) => ({ ...current, postureNumber: requestedPosture }));
  }, [requestedPosture]);

  const catalogs = useQuery({
    queryKey: ['asset-catalogs', auth.access?.site_ids],
    queryFn: () => fetchAssetCatalogs(auth.access?.site_ids),
    enabled: canView,
  });
  const inventory = useQuery({
    queryKey: ['inventory', page, pageSize, appliedFilters],
    queryFn: () => fetchInventoryPage({ page, pageSize, filters: appliedFilters }),
    enabled: canView,
    placeholderData: (previous) => previous,
  });

  useEffect(
    () => setPage(1),
    [
      debouncedSearch,
      filters.assetTypeId,
      filters.completeness,
      filters.manufacturerId,
      filters.postureNumber,
    ],
  );

  if (!canView) {
    return (
      <StatePanel
        kind="permission"
        title="Inventário não autorizado"
        description="Seu perfil não possui a permissão assets.view. Solicite acesso a um administrador."
      />
    );
  }
  if ((catalogs.isLoading || inventory.isLoading) && !inventory.data) return <PageSkeleton />;
  if (catalogs.isError) {
    return (
      <StatePanel
        kind={
          /permission|row-level|forbidden/i.test(catalogs.error.message) ? 'permission' : 'error'
        }
        title="Não foi possível carregar os filtros"
        description={catalogs.error.message}
        actionLabel="Tentar novamente"
        onAction={() => void catalogs.refetch()}
      />
    );
  }
  if (inventory.isError) {
    return (
      <StatePanel
        kind={
          /permission|row-level|forbidden/i.test(inventory.error.message) ? 'permission' : 'error'
        }
        title="Não foi possível carregar o inventário"
        description={inventory.error.message}
        actionLabel="Tentar novamente"
        onAction={() => void inventory.refetch()}
      />
    );
  }

  const activeFilters = Object.entries(filters).some(
    ([key, value]) => value && value !== 'all' && !(key === 'search' && !value.trim()),
  );

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="ATIVOS FÍSICOS INSTALADOS"
        title="Inventário técnico"
        description="Encontre o equipamento real pela postura, posição, placa ou modelo. A localização vem do histórico ativo de instalação."
        meta={
          <span className={styles.headerMeta}>
            <Boxes /> {(inventory.data?.total ?? 0).toLocaleString('pt-BR')} ativos encontrados
          </span>
        }
        actions={
          canCreate ? (
            <Button leadingIcon={<Plus />} onClick={() => setCreateOpen(true)}>
              Novo ativo
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        actions={
          activeFilters ? (
            <Button
              variant="ghost"
              leadingIcon={<FilterX />}
              onClick={() => setFilters(initialFilters)}
            >
              Limpar
            </Button>
          ) : undefined
        }
      >
        <TextField
          label="Pesquisar"
          value={filters.search}
          placeholder="Código, série, marca, modelo..."
          type="search"
          onChange={(event) =>
            setFilters((current) => ({ ...current, search: event.target.value }))
          }
        />
        <SelectField
          label="Tipo"
          value={filters.assetTypeId}
          onChange={(event) =>
            setFilters((current) => ({ ...current, assetTypeId: event.target.value }))
          }
        >
          <option value="">Todos</option>
          {catalogs.data?.assetTypes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Fabricante"
          value={filters.manufacturerId}
          onChange={(event) =>
            setFilters((current) => ({ ...current, manufacturerId: event.target.value }))
          }
        >
          <option value="">Todos</option>
          {catalogs.data?.manufacturers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Postura"
          value={filters.postureNumber}
          type="number"
          min={1}
          max={48}
          placeholder="1–48"
          onChange={(event) =>
            setFilters((current) => ({ ...current, postureNumber: event.target.value }))
          }
        />
        <SelectField
          label="Completude"
          value={filters.completeness}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              completeness: event.target.value as InventoryFilters['completeness'],
            }))
          }
        >
          <option value="all">Todos</option>
          <option value="complete">Cadastro completo</option>
          <option value="incomplete">Cadastro incompleto</option>
          <option value="missing_nameplate">Sem foto da placa</option>
        </SelectField>
      </FilterBar>

      {inventory.isFetching && inventory.data && (
        <div className={styles.refreshBar} role="status">
          Atualizando resultados…
        </div>
      )}

      {inventory.data?.rows.length ? (
        <>
          <section className={styles.inventoryGrid} aria-label="Ativos instalados">
            {inventory.data.rows.map((asset) => {
              const identity =
                asset.internalCode ?? asset.serialNumber ?? asset.assetId.slice(0, 8).toUpperCase();
              return (
                <Link
                  key={asset.assetId}
                  to={`/ativos/${asset.assetId}`}
                  className={styles.assetCard}
                >
                  <div className={styles.assetCardTop}>
                    <span className={styles.typeIcon} data-domain={asset.domain}>
                      <Factory />
                    </span>
                    <span className={styles.statusPill} data-status={asset.statusCode}>
                      {asset.statusName}
                    </span>
                  </div>
                  <div className={styles.assetCardCopy}>
                    <span className={styles.assetEyebrow}>{asset.assetTypeName}</span>
                    <h2>
                      {asset.manufacturerName ?? 'Fabricante não informado'}{' '}
                      <span>{asset.modelName ?? ''}</span>
                    </h2>
                    <p>{identity}</p>
                  </div>
                  <div className={styles.locationLine}>
                    <MapPin />
                    <span>
                      <strong>
                        Postura {String(asset.postureNumber).padStart(2, '0')}
                        {asset.batteryCode ? ` · ${asset.batteryCode}` : ''}
                      </strong>
                      <small>{asset.positionName}</small>
                    </span>
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.criticality} data-criticality={asset.criticality}>
                      <ShieldAlert /> {criticalityLabels[asset.criticality]}
                    </span>
                    <span
                      className={styles.completeness}
                      data-complete={(asset.completenessPercent ?? 0) >= 100}
                    >
                      <CircleGauge />{' '}
                      {asset.completenessPercent === null
                        ? '—'
                        : `${Math.round(asset.completenessPercent)}%`}
                    </span>
                    <ArrowRight className={styles.cardArrow} />
                  </div>
                </Link>
              );
            })}
          </section>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={inventory.data.total}
            onPageChange={setPage}
          />
        </>
      ) : (
        <StatePanel
          kind="empty"
          title={activeFilters ? 'Nenhum ativo corresponde aos filtros' : 'Nenhum ativo instalado'}
          description={
            activeFilters
              ? 'Ajuste os filtros. Nenhum dado de demonstração será criado para preencher esta tela.'
              : 'Cadastre um ativo físico e conclua sua instalação para ele aparecer neste inventário.'
          }
          {...(activeFilters
            ? {
                actionLabel: 'Limpar filtros',
                onAction: () => setFilters(initialFilters),
                secondaryAction: (
                  <span className={styles.emptySearchHint}>
                    <Search /> A pesquisa consulta o banco, não apenas esta página.
                  </span>
                ),
              }
            : canCreate
              ? { actionLabel: 'Cadastrar primeiro ativo', onAction: () => setCreateOpen(true) }
              : {})}
        />
      )}

      {catalogs.data && (
        <AssetFormDialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open && createRequested) setSearchParams({}, { replace: true });
          }}
          catalogs={catalogs.data}
          onSaved={async (assetId) => {
            await queryClient.invalidateQueries({ queryKey: ['inventory'] });
            void navigate(
              `/ativos/${assetId}${requestedPositionId ? `?installPosition=${encodeURIComponent(requestedPositionId)}` : ''}`,
            );
          }}
        />
      )}
    </main>
  );
}
