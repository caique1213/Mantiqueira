import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import styles from './pagination.module.css';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className={styles.pagination} aria-label="Paginação">
      <span>
        {total === 0
          ? 'Nenhum registro'
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`}
      </span>
      <div>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<ChevronLeft />}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <span className={styles.pageNumber}>
          {page} / {pages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          trailingIcon={<ChevronRight />}
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </nav>
  );
}
