import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import clsx from 'clsx';
import styles from './ui.module.css';

interface FieldFrameProps {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
}

export function FieldFrame({ id, label, hint, error, required, children }: FieldFrameProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldLabel}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      {children}
      {error ? (
        <span id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className={styles.fieldHint}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, id, className, required, ...props },
  ref,
) {
  const fieldId = id ?? props.name ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error} required={required}>
      <input
        ref={ref}
        id={fieldId}
        className={clsx(styles.input, error && styles.inputError, className)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        required={required}
        {...props}
      />
    </FieldFrame>
  );
});

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, id, className, required, children, ...props },
  ref,
) {
  const fieldId = id ?? props.name ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref}
        id={fieldId}
        className={clsx(styles.input, error && styles.inputError, className)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        required={required}
        {...props}
      >
        {children}
      </select>
    </FieldFrame>
  );
});
