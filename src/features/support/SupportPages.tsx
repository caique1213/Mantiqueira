import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BellRing,
  CheckCircle2,
  ClipboardPlus,
  LifeBuoy,
  MessageSquareWarning,
  MonitorCheck,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../auth/AuthProvider';
import { fetchAppBootstrap } from '../dashboard/dashboard.api';
import styles from './support-pages.module.css';

export function HelpPage() {
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="GUIA RÁPIDO"
        title="Ajuda do sistema"
        description="Um resumo simples para a equipe usar durante a fase de teste."
      />
      <section className={styles.grid}>
        <HelpCard icon={<ClipboardPlus />} title="Abrir OS">
          Entre em <strong>Abrir OS</strong>, escolha postura, bateria ou posição, selecione setor,
          prioridade e descreva o problema com clareza.
        </HelpCard>
        <HelpCard icon={<MonitorCheck />} title="Painéis de equipe">
          Elétrica, Mecânica e Civil possuem painéis próprios. Use o botão <strong>Modo TV</strong>{' '}
          para deixar em tela cheia na sala da equipe.
        </HelpCard>
        <HelpCard icon={<BellRing />} title="Alarme">
          O alarme toca enquanto há OS nova não visualizada. Ao abrir ou iniciar a OS, o alerta para.
        </HelpCard>
        <HelpCard icon={<MessageSquareWarning />} title="Feedback">
          Encontrou erro, texto ruim, botão invisível ou dado incorreto? Registre na aba{' '}
          <strong>Feedback</strong> com print.
        </HelpCard>
      </section>
    </main>
  );
}

export function ReleaseNotesPage() {
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="BETA 1.0"
        title="Novidades da versão"
        description="Mudanças principais preparadas para a fase de teste na empresa."
      />
      <section className={styles.timeline}>
        <article>
          <Sparkles />
          <div>
            <h2>Painéis operacionais separados</h2>
            <p>Galponista, Elétrica, Mecânica e Civil agora possuem fluxos próprios.</p>
          </div>
        </article>
        <article>
          <MonitorCheck />
          <div>
            <h2>Modo TV</h2>
            <p>Painéis técnicos podem ficar em tela cheia para sala/monitor da equipe.</p>
          </div>
        </article>
        <article>
          <MessageSquareWarning />
          <div>
            <h2>Feedback de teste</h2>
            <p>Usuários podem registrar erros e sugestões com prioridade e anexo.</p>
          </div>
        </article>
        <article>
          <BellRing />
          <div>
            <h2>Alarmes configuráveis</h2>
            <p>Administrador define o som padrão e cada usuário ajusta seu próprio volume.</p>
          </div>
        </article>
      </section>
    </main>
  );
}

export function SystemStatusPage() {
  const auth = useAuth();
  const bootstrap = useQuery({ queryKey: ['app-bootstrap'], queryFn: fetchAppBootstrap });
  const permissions = auth.access?.permissions ?? [];
  const roles = auth.access?.roles ?? [];
  const settings = bootstrap.data?.settings ?? {};
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="DIAGNÓSTICO"
        title="Status do sistema"
        description="Informações úteis para printar ou copiar quando alguém disser que algo não funciona."
      />
      <section className={styles.statusGrid}>
        <StatusCard title="Conexão" value={bootstrap.isError ? 'Com erro' : 'Conectado'} ok={!bootstrap.isError} />
        <StatusCard title="Usuário" value={auth.access?.profile.display_name ?? auth.user?.email ?? '—'} ok />
        <StatusCard title="Versão" value={String(settings['system.version_label'] ?? 'Beta 1.0')} ok />
        <StatusCard title="Unidade" value={bootstrap.data?.site?.name ?? 'Carregando'} ok={!bootstrap.isError} />
      </section>
      <section className={styles.permissionsBox}>
        <h2>Perfil e permissões</h2>
        <p>
          <strong>Perfis:</strong> {roles.join(', ') || 'Nenhum'}
        </p>
        <p>
          <strong>Permissões:</strong> {permissions.slice(0, 40).join(', ')}
          {permissions.length > 40 ? '...' : ''}
        </p>
        <Link to="/feedback">
          <LifeBuoy /> Reportar problema com estas informações
        </Link>
      </section>
    </main>
  );
}

function HelpCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className={styles.card}>
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </article>
  );
}

function StatusCard({ title, value, ok }: { title: string; value: string; ok: boolean }) {
  return (
    <article className={styles.statusCard}>
      <Activity />
      <span>{title}</span>
      <strong>{value}</strong>
      {ok && <CheckCircle2 />}
    </article>
  );
}
