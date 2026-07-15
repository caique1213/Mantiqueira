import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AtSign,
  BellRing,
  CalendarClock,
  Eye,
  KeyRound,
  Save,
  ShieldCheck,
  UserRound,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { normalizeError } from '../../lib/errors';
import { useAuth } from '../auth/AuthProvider';
import {
  fetchNotificationSettings,
  previewNotificationSound,
  updateNotificationSettings,
} from '../notifications/notifications.api';
import { fetchMyProfile, updateMyProfile } from './profile.api';
import {
  loadPersonalPreferences,
  savePersonalPreferences,
  type PersonalPreferences,
} from './personal-preferences';
import styles from './profile.module.css';

export function ProfilePage() {
  const auth = useAuth();
  const profileId = auth.user?.id ?? '';
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ['my-profile', profileId],
    queryFn: () => fetchMyProfile(profileId),
    enabled: Boolean(profileId),
  });
  const notificationSettings = useQuery({
    queryKey: ['notification-settings', profileId],
    queryFn: () => fetchNotificationSettings(profileId),
    enabled: Boolean(profileId),
  });
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('America/Cuiaba');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [alarmVolume, setAlarmVolume] = useState(0.75);
  const [preferences, setPreferences] = useState<PersonalPreferences>({
    themeMode: 'system',
    lowVision: false,
  });

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.display_name);
    setTimezone(profile.data.timezone);
  }, [profile.data]);

  useEffect(() => {
    if (!profileId) return;
    setPreferences(loadPersonalPreferences(profileId));
  }, [profileId]);

  useEffect(() => {
    if (!notificationSettings.data) return;
    setAlarmVolume(notificationSettings.data.preferences.volume);
  }, [notificationSettings.data]);

  const saveProfile = useMutation({
    mutationFn: () => updateMyProfile(displayName, timezone, profile.data?.avatar_path ?? null),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-profile', profileId] }),
        auth.refreshAccess(),
      ]);
      toast.success('Perfil atualizado.');
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });
  const savePassword = useMutation({
    mutationFn: () => auth.updatePassword(password),
    onSuccess: () => {
      setPassword('');
      setPasswordConfirmation('');
      toast.success('Senha alterada com segurança.');
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });
  const saveAlarmVolume = useMutation({
    mutationFn: () => {
      if (!notificationSettings.data) throw new Error('Configuração de alarme indisponível.');
      const { preferences: current } = notificationSettings.data;
      return updateNotificationSettings(profileId, {
        enabled: current.enabled,
        sound_enabled: current.sound_enabled,
        sound_preset_id: current.sound_preset_id,
        volume: alarmVolume,
        speech_enabled: current.speech_enabled,
        repeat_count: current.repeat_count,
        quiet_hours: current.quiet_hours,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-settings', profileId] });
      toast.success('Volume do alarme salvo para este login.');
    },
    onError: (error) => toast.error(normalizeError(error).message),
  });

  function updatePreferences(next: PersonalPreferences) {
    setPreferences(next);
    savePersonalPreferences(profileId, next);
    toast.success('Preferência visual aplicada neste login.');
  }

  if (!profileId)
    return (
      <StatePanel
        kind="permission"
        title="Sessão indisponível"
        description="Entre novamente para editar seu perfil."
      />
    );
  if (profile.isLoading) return <PageSkeleton />;
  if (profile.isError || !profile.data)
    return (
      <StatePanel
        kind="error"
        title="Perfil indisponível"
        description={profile.error?.message ?? 'Dados não encontrados.'}
        actionLabel="Tentar novamente"
        onAction={() => void profile.refetch()}
      />
    );

  function handlePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 10) return toast.error('Use pelo menos 10 caracteres.');
    if (password !== passwordConfirmation) return toast.error('As senhas não conferem.');
    void savePassword.mutateAsync();
  }

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="CONTA"
        title="Meu perfil"
        description="Dados pessoais, escopo de acesso e segurança da sua conta."
      />
      <section className={styles.identityHero}>
        <span className={styles.avatar}>{profile.data.display_name.charAt(0).toUpperCase()}</span>
        <div>
          <small>USUÁRIO ATIVO</small>
          <h1>{profile.data.display_name}</h1>
          <p>{auth.user?.email}</p>
        </div>
        <span className={styles.activeBadge}>
          <ShieldCheck /> Acesso ativo
        </span>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <header>
            <div>
              <small>DADOS PESSOAIS</small>
              <h2>Identificação</h2>
            </div>
            <UserRound />
          </header>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void saveProfile.mutateAsync();
            }}
          >
            <TextField
              label="Nome de exibição"
              minLength={2}
              maxLength={120}
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <SelectField
              label="Fuso horário"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
              <option value="America/Cuiaba">Cuiabá / MT</option>
              <option value="America/Sao_Paulo">Brasília / SP</option>
              <option value="America/Manaus">Manaus / AM</option>
            </SelectField>
            <Button
              type="submit"
              leadingIcon={<Save />}
              loading={saveProfile.isPending}
              disabled={displayName.trim().length < 2}
            >
              Salvar perfil
            </Button>
          </form>
        </section>

        <section className={styles.panel}>
          <header>
            <div>
              <small>ACESSO CONCEDIDO</small>
              <h2>Perfis e setores</h2>
            </div>
            <ShieldCheck />
          </header>
          <dl className={styles.accessList}>
            <div>
              <dt>Perfis</dt>
              <dd>{auth.access?.roles.join(', ') || 'Nenhum perfil'}</dd>
            </div>
            <div>
              <dt>Setores</dt>
              <dd>{auth.access?.departments.join(', ') || 'Geral'}</dd>
            </div>
            <div>
              <dt>Unidades permitidas</dt>
              <dd>{auth.access?.site_ids.length ?? 0}</dd>
            </div>
            <div>
              <dt>Permissões efetivas</dt>
              <dd>
                {auth.access?.permissions.includes('*')
                  ? 'Acesso administrativo total'
                  : `${auth.access?.permissions.length ?? 0} permissões`}
              </dd>
            </div>
          </dl>
          <p className={styles.accessNote}>
            A alteração de perfil é feita por um administrador e sempre gera auditoria.
          </p>
        </section>

        <section className={styles.panel}>
          <header>
            <div>
              <small>ACESSIBILIDADE</small>
              <h2>Minha visualização</h2>
            </div>
            <Eye />
          </header>
          <div className={styles.form}>
            <SelectField
              label="Tema neste login"
              value={preferences.themeMode}
              onChange={(event) =>
                updatePreferences({
                  ...preferences,
                  themeMode: event.target.value as PersonalPreferences['themeMode'],
                })
              }
              hint="Não muda o tema global da empresa; vale só para você neste aparelho."
            >
              <option value="system">Padrão do sistema</option>
              <option value="dark">Escuro</option>
              <option value="light">Claro</option>
            </SelectField>
            <label className={styles.toggleLine}>
              <input
                type="checkbox"
                checked={preferences.lowVision}
                onChange={(event) =>
                  updatePreferences({ ...preferences, lowVision: event.target.checked })
                }
              />
              <span>
                <strong>Modo baixa visão</strong>
                <small>Letras maiores, campos mais altos e leitura mais confortável.</small>
              </span>
            </label>
          </div>
        </section>

        <section className={styles.panel}>
          <header>
            <div>
              <small>ALARMES</small>
              <h2>Meu volume</h2>
            </div>
            <BellRing />
          </header>
          <div className={styles.form}>
            <div className={styles.volumeBox}>
              <label htmlFor="alarm-volume">
                <strong>Volume do alarme</strong>
                <small>
                  O som é definido pela empresa; aqui você ajusta somente o volume deste login.
                </small>
              </label>
              <input
                id="alarm-volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={alarmVolume}
                onChange={(event) => setAlarmVolume(Number(event.target.value))}
              />
              <span>{Math.round(alarmVolume * 100)}%</span>
            </div>
            <div className={styles.inlineActions}>
              <Button
                type="button"
                variant="secondary"
                leadingIcon={<Volume2 />}
                disabled={!notificationSettings.data?.globalSound}
                onClick={() => {
                  const sound = notificationSettings.data?.globalSound;
                  if (sound) previewNotificationSound(sound.audio_key, alarmVolume);
                }}
              >
                Testar volume
              </Button>
              <Button
                type="button"
                leadingIcon={<Save />}
                loading={saveAlarmVolume.isPending}
                disabled={!notificationSettings.data}
                onClick={() => saveAlarmVolume.mutate()}
              >
                Salvar volume
              </Button>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <header>
            <div>
              <small>SEGURANÇA</small>
              <h2>Alterar senha</h2>
            </div>
            <KeyRound />
          </header>
          <form className={styles.form} onSubmit={handlePassword}>
            <TextField
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint="Mínimo de 10 caracteres; prefira uma frase longa e exclusiva."
            />
            <TextField
              label="Confirmar nova senha"
              type="password"
              autoComplete="new-password"
              required
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
            />
            <Button
              type="submit"
              variant="secondary"
              leadingIcon={<KeyRound />}
              loading={savePassword.isPending}
              disabled={password.length < 10 || password !== passwordConfirmation}
            >
              Atualizar senha
            </Button>
          </form>
        </section>

        <section className={styles.panel}>
          <header>
            <div>
              <small>INFORMAÇÕES DA CONTA</small>
              <h2>Registro</h2>
            </div>
            <CalendarClock />
          </header>
          <dl className={styles.accessList}>
            <div>
              <dt>E-mail</dt>
              <dd>
                <AtSign /> {auth.user?.email ?? 'Não informado'}
              </dd>
            </div>
            <div>
              <dt>Conta criada</dt>
              <dd>{formatDate(profile.data.created_at)}</dd>
            </div>
            <div>
              <dt>Perfil atualizado</dt>
              <dd>{formatDate(profile.data.updated_at)}</dd>
            </div>
            <div>
              <dt>Idioma</dt>
              <dd>{profile.data.locale}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(value));
}
