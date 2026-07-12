import { useEffect, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import styles from './ui.module.css';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  tone?: 'default' | 'danger';
  typedConfirmation?: string;
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = 'default',
  typedConfirmation,
  busy = false,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const valid =
    !typedConfirmation || typed.trim().toUpperCase() === typedConfirmation.toUpperCase();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content className={styles.dialogContent}>
          <div className={styles.dialogHeader}>
            <span className={tone === 'danger' ? styles.dialogDangerIcon : styles.dialogIcon}>
              <AlertTriangle aria-hidden="true" />
            </span>
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description asChild>
                <div className={styles.dialogDescription}>{description}</div>
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Fechar" icon={<X />} />
            </Dialog.Close>
          </div>

          {typedConfirmation && (
            <label className={styles.confirmField}>
              <span>
                Digite <strong>{typedConfirmation}</strong> para confirmar
              </span>
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
              />
            </label>
          )}

          <div className={styles.dialogActions}>
            <Dialog.Close asChild>
              <Button variant="ghost">Cancelar</Button>
            </Dialog.Close>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              disabled={!valid}
              loading={busy}
              onClick={() => void onConfirm()}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
