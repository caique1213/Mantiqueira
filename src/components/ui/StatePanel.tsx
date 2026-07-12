import type { ReactNode } from 'react';
import { AlertTriangle, CloudOff, Inbox, LockKeyhole, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from './Button';
import styles from './ui.module.css';

type StateKind = 'empty' | 'error' | 'permission' | 'offline' | 'configuration';

const stateIcons = {
  empty: Inbox,
  error: AlertTriangle,
  permission: LockKeyhole,
  offline: CloudOff,
  configuration: Settings2,
} satisfies Record<StateKind, typeof Inbox>;

interface StatePanelProps {
  kind: StateKind;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: ReactNode;
  compact?: boolean;
}

export function StatePanel({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
  compact,
}: StatePanelProps) {
  const Icon = stateIcons[kind];
  return (
    <section
      className={compact ? styles.stateCompact : styles.statePanel}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className={styles.stateIcon}>
        <Icon aria-hidden="true" />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {(actionLabel || secondaryAction) && (
        <div className={styles.stateActions}>
          {actionLabel && onAction && (
            <Button
              variant="secondary"
              leadingIcon={kind === 'error' || kind === 'offline' ? <RefreshCw /> : undefined}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
    </section>
  );
}
