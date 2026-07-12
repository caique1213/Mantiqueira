import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './filter-bar.module.css';

export function FilterBar({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx(styles.bar, className)} aria-label="Filtros">
      <div className={styles.fields}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </section>
  );
}
