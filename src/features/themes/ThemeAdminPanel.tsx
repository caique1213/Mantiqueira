import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useAuth } from '../auth/AuthProvider';
import { useTheme } from './ThemeContext';
import { ThemeEditor } from './ThemeEditor';
import { ThemePreview } from './ThemePreview';
import { ThemeSelector } from './ThemeSelector';
import {
  fetchThemeVersionHistory,
  isThemeUuid,
  restoreThemeVersion,
  type ThemeVersionRecord,
} from './supabase-theme.adapter';
import './theme-admin.css';

const STATUS_MESSAGES = {
  idle: 'Prévia ativa. Alterações ainda não salvas permanecem somente nesta sessão.',
  loading: 'Carregando a aparência salva…',
  saving: 'Salvando a aparência…',
  saved: 'Aparência salva com sucesso.',
  error: 'Não foi possível concluir a operação.',
} as const;

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function ThemeAdminPanel() {
  const auth = useAuth();
  const siteId = auth.access?.site_ids[0];
  const [versionToRestore, setVersionToRestore] = useState<ThemeVersionRecord | null>(null);
  const {
    activeTheme,
    draftTheme,
    status,
    errorMessage,
    isDirty,
    canUndo,
    startCustomizing,
    undo,
    discardChanges,
    restoreDefault,
    save,
  } = useTheme();
  const historyThemeId = useMemo(() => {
    if (activeTheme.kind === 'custom' && isThemeUuid(activeTheme.id)) return activeTheme.id;
    if (draftTheme.kind === 'custom' && isThemeUuid(draftTheme.id)) return draftTheme.id;
    return null;
  }, [activeTheme.id, activeTheme.kind, draftTheme.id, draftTheme.kind]);

  const historyQuery = useQuery({
    queryKey: ['theme-version-history', historyThemeId],
    queryFn: () => fetchThemeVersionHistory(historyThemeId ?? ''),
    enabled: Boolean(historyThemeId),
  });

  const restoreMutation = useMutation({
    mutationFn: async (version: ThemeVersionRecord) => {
      if (!siteId) throw new Error('Unidade ativa não encontrada.');
      await restoreThemeVersion(siteId, version.id);
    },
    onSuccess: () => {
      setVersionToRestore(null);
      window.location.reload();
    },
  });

  useEffect(() => {
    if (!isDirty) return;
    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnAboutUnsavedChanges);
    return () => window.removeEventListener('beforeunload', warnAboutUnsavedChanges);
  }, [isDirty]);

  return (
    <div className="theme-admin-panel">
      <header className="theme-admin-panel__intro">
        <div>
          <p className="theme-admin-panel__eyebrow">Administração · Aparência</p>
          <h1>Identidade visual do sistema</h1>
          <p>
            Escolha um preset completo ou personalize os tokens. A matriz física e as regras
            operacionais não são alteradas pelo tema.
          </p>
        </div>
        <span className="theme-admin-panel__preview-label">Pré-visualização em tempo real</span>
      </header>

      <ThemeSelector />

      <div className="theme-admin-panel__workspace">
        <div className="theme-admin-panel__configuration">
          {draftTheme.kind === 'custom' ? (
            <>
              <ThemeEditor />
              <section className="theme-admin-panel__history">
                <header>
                  <div>
                    <p className="theme-admin-panel__eyebrow">Histórico salvo</p>
                    <h2>Versões do tema personalizado</h2>
                  </div>
                  {historyQuery.isFetching ? <span>Atualizando...</span> : null}
                </header>

                {!historyThemeId ? (
                  <p className="theme-admin-panel__history-empty">
                    Salve este tema uma vez para iniciar o histórico persistente.
                  </p>
                ) : historyQuery.isError ? (
                  <p className="theme-admin-panel__history-empty is-error">
                    Não foi possível carregar o histórico de versões.
                  </p>
                ) : historyQuery.data && historyQuery.data.length > 0 ? (
                  <ol className="theme-admin-panel__history-list">
                    {historyQuery.data.map((version) => (
                      <li key={version.id}>
                        <div>
                          <strong>Versão {version.version_number}</strong>
                          <small>{DATE_FORMATTER.format(new Date(version.created_at))}</small>
                          {version.note ? <span>{version.note}</span> : null}
                        </div>
                        <button onClick={() => setVersionToRestore(version)} type="button">
                          <RotateCcw aria-hidden="true" />
                          Restaurar
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="theme-admin-panel__history-empty">
                    Nenhuma versão salva foi encontrada para este tema.
                  </p>
                )}
              </section>
            </>
          ) : (
            <section className="theme-admin-panel__preset-note">
              <p className="theme-admin-panel__eyebrow">Preset completo</p>
              <h2>{draftTheme.name}</h2>
              <p>
                O preset já controla cores, mapas, ativos, status, tipografia, formas, sombras e
                densidade. Para alterar um detalhe, crie uma cópia personalizada.
              </p>
              <button
                onClick={() => startCustomizing(`${draftTheme.name} personalizado`)}
                type="button"
              >
                Personalizar este modelo
              </button>
            </section>
          )}
        </div>

        <aside className="theme-admin-panel__preview" aria-label="Prévia fixa do tema">
          <ThemePreview />
        </aside>
      </div>

      <footer className="theme-admin-panel__actions">
        <p
          aria-live="polite"
          className={status === 'error' ? 'is-error' : undefined}
          role={status === 'error' ? 'alert' : 'status'}
        >
          {errorMessage ?? STATUS_MESSAGES[status]}
          {isDirty && status !== 'saving' ? ' Há alterações pendentes.' : ''}
        </p>
        <div>
          <button disabled={!canUndo || status === 'saving'} onClick={undo} type="button">
            Desfazer
          </button>
          <button disabled={!isDirty || status === 'saving'} onClick={discardChanges} type="button">
            Descartar
          </button>
          <button disabled={status === 'saving'} onClick={restoreDefault} type="button">
            Restaurar modelo
          </button>
          <button
            className="is-primary"
            disabled={!isDirty || status === 'saving' || status === 'loading'}
            onClick={() => void save()}
            type="button"
          >
            {status === 'saving' ? 'Salvando…' : 'Salvar como padrão'}
          </button>
        </div>
      </footer>

      <ConfirmDialog
        busy={restoreMutation.isPending}
        confirmLabel="Restaurar versão"
        description={
          <p>
            Esta ação aplicará a versão {versionToRestore?.version_number} como visual ativo do
            sistema. Alterações não salvas da prévia atual serão descartadas.
          </p>
        }
        onConfirm={() => {
          if (versionToRestore) void restoreMutation.mutateAsync(versionToRestore);
        }}
        onOpenChange={(open) => {
          if (!open && !restoreMutation.isPending) setVersionToRestore(null);
        }}
        open={Boolean(versionToRestore)}
        title="Restaurar versão do tema?"
        typedConfirmation="RESTAURAR"
      />
    </div>
  );
}
