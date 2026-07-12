import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './ui.module.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  tone?: 'default' | 'danger';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, tone = 'default', className, ...props },
  ref,
) {
  return (
    <Tooltip.Provider delayDuration={450}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            ref={ref}
            type="button"
            className={clsx(styles.iconButton, tone === 'danger' && styles.iconDanger, className)}
            aria-label={label}
            {...props}
          >
            {icon}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className={styles.tooltip} sideOffset={8}>
            {label}
            <Tooltip.Arrow className={styles.tooltipArrow} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
});
