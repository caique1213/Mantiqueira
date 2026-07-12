import clsx from 'clsx';
import styles from './ui.module.css';

export function Skeleton({ className }: { className?: string | undefined }) {
  return <span className={clsx(styles.skeleton, className)} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className={styles.pageSkeleton} aria-label="Carregando conteúdo" role="status">
      <Skeleton className={styles.skeletonEyebrow} />
      <Skeleton className={styles.skeletonTitle} />
      <Skeleton className={styles.skeletonLine} />
      <div className={styles.skeletonGrid}>
        <Skeleton className={styles.skeletonCard} />
        <Skeleton className={styles.skeletonCard} />
        <Skeleton className={styles.skeletonCard} />
      </div>
    </div>
  );
}
