import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Boxes, ClipboardList, FileSearch, MapPin, Search, Shapes, UserRound } from 'lucide-react';
import { z } from 'zod';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { requireSupabaseClient } from '../../lib/supabase';
import styles from './global-search.module.css';

const searchResultSchema = z.object({
  entity_type: z.string(),
  entity_id: z.string().uuid(),
  title: z.string(),
  subtitle: z.string().default(''),
  route: z.string(),
  rank: z.coerce.number(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

type SearchResult = z.infer<typeof searchResultSchema>;

const icons: Record<string, typeof Search> = {
  posture: MapPin,
  battery: Shapes,
  asset: Boxes,
  technical_model: FileSearch,
  work_order: ClipboardList,
  profile: UserRound,
};

const groupNames: Record<string, string> = {
  posture: 'Posturas',
  battery: 'Baterias',
  asset: 'Ativos',
  technical_model: 'Modelos técnicos',
  work_order: 'Ordens de Serviço',
  profile: 'Usuários',
};

async function searchEntities(query: string): Promise<SearchResult[]> {
  const { data, error } = await requireSupabaseClient().rpc('search_global', {
    p_query: query,
    p_site_id: null,
    p_limit: 30,
  });
  if (error) throw error;
  return z.array(searchResultSchema).parse(data ?? []);
}

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 280);
  const results = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => searchEntities(debounced),
    enabled: open && debounced.length >= 2,
  });

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const groups = useMemo(() => {
    const grouped = new Map<string, SearchResult[]>();
    for (const result of results.data ?? []) {
      const existing = grouped.get(result.entity_type) ?? [];
      existing.push(result);
      grouped.set(result.entity_type, existing);
    }
    return [...grouped.entries()];
  }, [results.data]);

  if (!open) return null;

  function openResult(result: SearchResult) {
    onOpenChange(false);
    void navigate(result.route);
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Pesquisa global">
      <button
        className={styles.backdrop}
        aria-label="Fechar pesquisa"
        onClick={() => onOpenChange(false)}
      />
      <section className={styles.panel}>
        <div className={styles.inputRow}>
          <Search aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Postura 27, NORD, OS 153, número de série..."
          />
          <button type="button" onClick={() => onOpenChange(false)}>
            ESC
          </button>
        </div>

        <div className={styles.results} aria-live="polite">
          {query.trim().length < 2 ? (
            <div className={styles.message}>
              <Search />
              <strong>Pesquise em todo o sistema</strong>
              <span>
                Digite pelo menos dois caracteres. Os resultados respeitam suas permissões.
              </span>
            </div>
          ) : results.isLoading ? (
            <div className={styles.loading}>
              <span /> Consultando dados autorizados...
            </div>
          ) : results.isError ? (
            <div className={styles.error}>
              <strong>Não foi possível pesquisar</strong>
              <span>{results.error.message}</span>
              <button type="button" onClick={() => void results.refetch()}>
                Tentar novamente
              </button>
            </div>
          ) : groups.length === 0 ? (
            <div className={styles.message}>
              <FileSearch />
              <strong>Nenhum resultado</strong>
              <span>Revise a escrita ou tente marca, modelo, número de série ou postura.</span>
            </div>
          ) : (
            groups.map(([type, items]) => (
              <section key={type} className={styles.group}>
                <header>
                  {groupNames[type] ?? type} <span>{items.length}</span>
                </header>
                {items.map((result) => {
                  const Icon = icons[result.entity_type] ?? FileSearch;
                  return (
                    <button
                      key={`${result.entity_type}-${result.entity_id}`}
                      type="button"
                      onClick={() => openResult(result)}
                    >
                      <span className={styles.resultIcon}>
                        <Icon />
                      </span>
                      <span className={styles.resultCopy}>
                        <strong>{result.title}</strong>
                        <small>{result.subtitle}</small>
                      </span>
                      <span className={styles.enter}>↵</span>
                    </button>
                  );
                })}
              </section>
            ))
          )}
        </div>

        <footer className={styles.footer}>
          <span>Busca no banco com RLS</span>
          <span>
            <kbd>ESC</kbd> fechar
          </span>
        </footer>
      </section>
    </div>
  );
}
