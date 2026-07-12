import { Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { StatePanel } from '../components/ui/StatePanel';
import styles from './system-pages.module.css';

export function ModulePlaceholderPage({ module }: { module: string }) {
  return (
    <div className={styles.page}>
      <StatePanel
        kind="empty"
        title={`${module} em integração`}
        description="A estrutura desta rota já está protegida e será substituída pelo módulo conectado ao banco nesta mesma implementação. Nenhum dado de demonstração está sendo apresentado como dado real."
        secondaryAction={
          <Link className={styles.linkButton} to="/">
            <ArrowLeft /> Voltar à visão geral
          </Link>
        }
      />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <StatePanel
        kind="empty"
        title="Página não encontrada"
        description="O endereço acessado não pertence a este sistema ou foi alterado."
        secondaryAction={
          <Link className={styles.linkButton} to="/">
            <Home /> Ir para o início
          </Link>
        }
      />
    </div>
  );
}
