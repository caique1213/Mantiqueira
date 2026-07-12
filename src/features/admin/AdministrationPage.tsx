import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Tabs from '@radix-ui/react-tabs';
import {
  BookOpenCheck,
  History,
  Palette,
  Save,
  Settings2,
  ShieldCheck,
  UserCog,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { ThemeAdminPanel } from '../themes';
import { useAuth } from '../auth/AuthProvider';
import {
  fetchAppSettings,
  fetchAuditLog,
  fetchUsersAdmin,
  inviteUser,
  manageUser,
  setAppSetting,
  type ManagedUser,
} from './admin.api';
import styles from './administration.module.css';
import { CatalogsPanel } from './CatalogsPanel';

const tabs = [
  { value: 'general', label: 'Geral', icon: Settings2 },
  { value: 'appearance', label: 'AparÃªncia', icon: Palette },
  { value: 'users', label: 'UsuÃ¡rios', icon: UserCog },
  { value: 'catalogs', label: 'CatÃ¡logos', icon: BookOpenCheck },
  { value: 'audit', label: 'Auditoria', icon: History },
] as const;

interface PendingUserChange {
  user: ManagedUser;
  displayName: string;
  active: boolean;
  roleCodes: string[];
  primarySectorId: string | null;
}

const editableGeneralSettings = [
  'system.name',
  'company.name',
  'system.timezone',
  'system.date_format',
  'home.title',
  'home.subtitle',
  'analytics.recurrence.count',
  'analytics.recurrence.window_days',
  'inventory.stale_after_days',
];

export function AdministrationPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="ADMINISTRAÃ‡ÃƒO"
        title="Controle do sistema"
        description="ConfiguraÃ§Ãµes profundas com validaÃ§Ã£o, histÃ³rico e proteÃ§Ã£o das regras fÃ­sicas nÃ£o negociÃ¡veis."
      />

      <Tabs.Root className={styles.tabs} defaultValue="general">
        <Tabs.List className={styles.tabList} aria-label="SeÃ§Ãµes administrativas">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Tabs.Trigger key={tab.value} className={styles.tabTrigger} value={tab.value}>
                <Icon /> {tab.label}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
        <Tabs.Content className={styles.tabContent} value="general">
          <GeneralSettings />
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="appearance">
          <ThemeAdminPanel />
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="users">
          <UsersAdmin />
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="catalogs">
          <CatalogsPanel />
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="audit">
          <AuditPanel />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function GeneralSettings() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: fetchAppSettings });
  const initialValues = useMemo(() => {
    const values: Record<string, string> = {};
    for (const setting of settings.data ?? []) {
      if (editableGeneralSettings.includes(setting.key)) {
        values[setting.key] = String(setting.value ?? '');
      }
      if (
        setting.key === 'analytics.recurrence' &&
        typeof setting.value === 'object' &&
        setting.value
      ) {
        const recurrence = setting.value as Record<string, unknown>;
        values['analytics.recurrence.count'] = String(recurrence.count ?? 3);
        values['analytics.recurrence.window_days'] = String(recurrence.window_days ?? 30);
      }
    }
    return values;
  }, [settings.data]);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(changes)) {
        if (key.startsWith('analytics.recurrence.')) continue;
        await setAppSetting(key, key === 'inventory.stale_after_days' ? Number(value) : value);
      }
      if (
        'analytics.recurrence.count' in changes ||
        'analytics.recurrence.window_days' in changes
      ) {
        await setAppSetting('analytics.recurrence', {
          count: Number(
            changes['analytics.recurrence.count'] ??
              initialValues['analytics.recurrence.count'] ??
              3,
          ),
          window_days: Number(
            changes['analytics.recurrence.window_days'] ??
              initialValues['analytics.recurrence.window_days'] ??
              30,
          ),
        });
      }
    },
    onSuccess: async () => {
      setChanges({});
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] });
      toast.success('ConfiguraÃ§Ãµes salvas e auditadas.');
    },
    onError: (error) => toast.error(error.message),
  });

  if (settings.isLoading) return <PageSkeleton />;
  if (settings.isError) {
    return (
      <StatePanel
        kind="error"
        title="ConfiguraÃ§Ãµes indisponÃ­veis"
        description={settings.error.message}
      />
    );
  }

  const labels: Record<string, string> = {
    'system.name': 'Nome do sistema',
    'company.name': 'Empresa',
    'system.timezone': 'Fuso horÃ¡rio',
    'system.date_format': 'Formato de data e hora',
    'home.title': 'TÃ­tulo da Home',
    'home.subtitle': 'SubtÃ­tulo da Home',
    'analytics.recurrence.count': 'Quantidade para reincidÃªncia',
    'analytics.recurrence.window_days': 'Janela da reincidÃªncia (dias)',
    'inventory.stale_after_days': 'Cadastro desatualizado apÃ³s (dias)',
  };

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <span>GERAL</span>
          <h2>Identidade e comportamento</h2>
          <p>Textos sÃ£o armazenados como dados, sem permitir HTML ou SQL.</p>
        </div>
        <Button
          leadingIcon={<Save />}
          disabled={Object.keys(changes).length === 0}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Salvar alteraÃ§Ãµes
        </Button>
      </header>
      <div className={styles.settingsGrid}>
        {editableGeneralSettings.map((key) => (
          <label key={key} className={styles.settingField}>
            <span>{labels[key]}</span>
            <input
              value={changes[key] ?? initialValues[key] ?? ''}
              onChange={(event) =>
                setChanges((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          </label>
        ))}
      </div>
      <div className={styles.protectedNote}>
        <ShieldCheck />
        <span>
          <strong>Estrutura protegida</strong>
          <small>
            A matriz das 48 posturas e suas quantidades de baterias nÃ£o sÃ£o editÃ¡veis nesta tela.
          </small>
        </span>
      </div>
    </section>
  );
}

function UsersAdmin() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsersAdmin });
  const [pending, setPending] = useState<PendingUserChange | null>(null);
  const [userDrafts, setUserDrafts] = useState<
    Record<string, { displayName: string; roleCode: string; primarySectorId: string }>
  >({});
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({
    email: '',
    displayName: '',
    password: '',
    roleCode: 'galponista',
    primarySectorId: '',
  });
  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteUser({
        email: invite.email.trim(),
        displayName: invite.displayName.trim(),
        password: invite.password,
        roleCode: invite.roleCode,
        primarySectorId: invite.primarySectorId || null,
      }),
    onSuccess: async () => {
      setInvite({
        email: '',
        displayName: '',
        password: '',
        roleCode: 'galponista',
        primarySectorId: '',
      });
      setInviteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('UsuÃ¡rio criado e perfil configurado.');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel enviar o convite.'),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) {
    return (
      <StatePanel
        kind="error"
        title="UsuÃ¡rios indisponÃ­veis"
        description={query.error?.message ?? 'Sem dados.'}
      />
    );
  }

  async function confirmChange() {
    if (!pending) return;
    setBusy(true);
    try {
      await manageUser({
        userId: pending.user.id,
        displayName: pending.displayName,
        active: pending.active,
        roleCodes: pending.roleCodes,
        primarySectorId: pending.primarySectorId,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setUserDrafts((current) => {
        const next = { ...current };
        delete next[pending.user.id];
        return next;
      });
      setPending(null);
      toast.success('Acesso atualizado e auditado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel atualizar o usuÃ¡rio.');
    } finally {
      setBusy(false);
    }
  }

  function readDraft(user: ManagedUser) {
    return (
      userDrafts[user.id] ?? {
        displayName: user.display_name,
        roleCode: user.roleCodes[0] ?? 'galponista',
        primarySectorId: user.primary_sector_id ?? '',
      }
    );
  }

  function updateDraft(
    user: ManagedUser,
    patch: Partial<{ displayName: string; roleCode: string; primarySectorId: string }>,
  ) {
    setUserDrafts((current) => ({ ...current, [user.id]: { ...readDraft(user), ...patch } }));
  }

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <span>ACESSO</span>
          <h2>UsuÃ¡rios e perfis</h2>
          <p>Novos usuÃ¡rios sÃ£o convidados pelo Supabase; aqui vocÃª controla escopo e ativaÃ§Ã£o.</p>
        </div>
        <Button leadingIcon={<UserPlus />} onClick={() => setInviteOpen((value) => !value)}>
          Criar usuário
        </Button>
      </header>
      {inviteOpen && (
        <form
          className={styles.inviteForm}
          onSubmit={(event) => {
            event.preventDefault();
            void inviteMutation.mutateAsync();
          }}
        >
          <label>
            <span>Nome</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={invite.displayName}
              onChange={(event) =>
                setInvite((current) => ({ ...current, displayName: event.target.value }))
              }
            />
          </label>
          <label>
            <span>E-mail</span>
            <input
              required
              type="email"
              value={invite.email}
              onChange={(event) =>
                setInvite((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Senha temporária</span>
            <input
              required
              type="text"
              minLength={8}
              maxLength={128}
              value={invite.password}
              onChange={(event) =>
                setInvite((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Ex: Mantiqueira@123"
            />
          </label>
          <label>
            <span>Perfil inicial</span>
            <select
              value={invite.roleCode}
              onChange={(event) =>
                setInvite((current) => ({ ...current, roleCode: event.target.value }))
              }
            >
              {query.data.roles.map((role) => (
                <option key={role.id} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Setor principal</span>
            <select
              value={invite.primarySectorId}
              onChange={(event) =>
                setInvite((current) => ({ ...current, primarySectorId: event.target.value }))
              }
            >
              <option value="">Geral</option>
              {query.data.sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.inviteActions}>
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={inviteMutation.isPending}
              disabled={
                invite.displayName.trim().length < 2 ||
                !invite.email.includes('@') ||
                invite.password.length < 8
              }
            >
              Criar usuário
            </Button>
          </div>
        </form>
      )}
      <div className={styles.userList}>
        {query.data.users.map((user) => {
          const self = user.id === auth.user?.id;
          const draft = readDraft(user);
          const draftName = draft.displayName.trim();
          const draftRoleCodes = draft.roleCode ? [draft.roleCode] : user.roleCodes;
          const draftSectorId = draft.primarySectorId || null;
          const hasDraftChanges =
            draftName !== user.display_name ||
            draft.roleCode !== (user.roleCodes[0] ?? '') ||
            draftSectorId !== user.primary_sector_id;
          return (
            <article key={user.id} className={styles.userRow}>
              <span className={styles.userAvatar}>{user.display_name.charAt(0).toUpperCase()}</span>
              <div className={styles.userIdentity}>
                <strong>
                  {user.display_name}
                  {self ? ' (vocÃª)' : ''}
                </strong>
                <small>{user.roleCodes.join(' Â· ') || 'Sem perfil'}</small>
              </div>
              <div className={styles.userEditor}>
                <label>
                  <span>Nome na tela</span>
                  <input
                    minLength={2}
                    maxLength={120}
                    value={draft.displayName}
                    onChange={(event) => updateDraft(user, { displayName: event.target.value })}
                  />
                </label>
                <label>
                  <span>Perfil</span>
                  <select
                    aria-label={`Perfil de ${user.display_name}`}
                    value={draft.roleCode}
                    onChange={(event) => updateDraft(user, { roleCode: event.target.value })}
                  >
                    {query.data.roles.map((role) => (
                      <option key={role.id} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Setor</span>
                  <select
                    value={draft.primarySectorId}
                    onChange={(event) =>
                      updateDraft(user, { primarySectorId: event.target.value })
                    }
                  >
                    <option value="">Geral</option>
                    {query.data.sectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.userControls}>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!hasDraftChanges || draftName.length < 2}
                  onClick={() =>
                    setPending({
                      user,
                      displayName: draftName,
                      active: user.active,
                      roleCodes: draftRoleCodes,
                      primarySectorId: draftSectorId,
                    })
                  }
                >
                  Salvar
                </Button>
                <button
                  type="button"
                  className={user.active ? styles.activeButton : styles.inactiveButton}
                  disabled={self}
                  onClick={() =>
                    setPending({
                      user,
                      displayName: draftName,
                      active: !user.active,
                      roleCodes: draftRoleCodes,
                      primarySectorId: draftSectorId,
                    })
                  }
                >
                  {user.active ? 'Ativo' : 'Inativo'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
        title="Confirmar mudanÃ§a de acesso"
        description={
          pending ? (
            <p>
              <strong>{pending.user.display_name}</strong> ficarÃ¡{' '}
              {pending.active ? 'ativo' : 'inativo'} com o perfil{' '}
              <strong>{pending.roleCodes.join(', ')}</strong>. A mudanÃ§a serÃ¡ registrada.
            </p>
          ) : null
        }
        confirmLabel="Confirmar alteraÃ§Ã£o"
        typedConfirmation="CONFIRMAR"
        tone="danger"
        busy={busy}
        onConfirm={confirmChange}
      />
    </section>
  );
}

function AuditPanel() {
  const query = useQuery({ queryKey: ['audit-log'], queryFn: () => fetchAuditLog(100) });
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError)
    return (
      <StatePanel kind="error" title="Auditoria indisponÃ­vel" description={query.error.message} />
    );
  if (!query.data?.length)
    return (
      <StatePanel
        kind="empty"
        title="Nenhum evento registrado"
        description="As aÃ§Ãµes crÃ­ticas aparecerÃ£o aqui."
      />
    );
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <span>HISTÃ“RICO</span>
          <h2>Auditoria do sistema</h2>
          <p>Registro append-only das alteraÃ§Ãµes importantes.</p>
        </div>
      </header>
      <div className={styles.auditList}>
        {query.data.map((entry) => (
          <article key={entry.id}>
            <time>
              {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
                new Date(entry.occurred_at),
              )}
            </time>
            <div>
              <strong>{entry.action}</strong>
              <small>
                {entry.entity_table} Â· {entry.entity_id ?? 'sistema'}
              </small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

