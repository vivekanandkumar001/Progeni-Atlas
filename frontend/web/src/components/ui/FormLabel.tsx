import React from 'react';

export interface FormLabelProps {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  htmlFor?: string;
  hint?: string;
}

export const FormLabel = ({
  label,
  required = true,
  icon,
  htmlFor,
  hint,
}: FormLabelProps) => (
  <label
    htmlFor={htmlFor}
    className="inline-flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink mb-1.5"
  >
    {icon && <span className="text-accent-cyan shrink-0">{icon}</span>}
    <span>{label}</span>
    {required && (
      <span className="text-accent-rose font-bold" aria-hidden="true">
        *
      </span>
    )}
    {hint && <span className="text-[11px] font-normal text-ink-muted">({hint})</span>}
  </label>
);
