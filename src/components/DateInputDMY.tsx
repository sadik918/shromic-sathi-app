import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import type { Language } from '../types';
import { formatDateSlashDMY } from '../utils/i18n';

interface DateInputDMYProps {
  id?: string;
  value: string;
  onChange: (newDate: string) => void;
  lang?: Language;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  'data-testid'?: string;
  dataTestId?: string;
  'aria-label'?: string;
  ariaLabel?: string;
}

/**
 * Custom Date Input component that displays dates strictly in Date/Month/Year (DD/MM/YYYY) format
 * (e.g., ২৭/১০/২০২৬ or 27/10/2026) instead of the browser's US MM/DD/YYYY format,
 * while preserving native mobile/desktop calendar picker functionality.
 */
export const DateInputDMY: React.FC<DateInputDMYProps> = ({
  id,
  value,
  onChange,
  lang = 'bn',
  min,
  max,
  disabled = false,
  required = false,
  className = '',
  'data-testid': dataTestIdAttr,
  dataTestId: dataTestIdProp,
  'aria-label': ariaLabelAttr,
  ariaLabel: ariaLabelProp,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dataTestId = dataTestIdAttr || dataTestIdProp;
  const ariaLabel = ariaLabelAttr || ariaLabelProp;

  const formattedDisplay = value
    ? formatDateSlashDMY(value, lang)
    : lang === 'bn'
    ? 'দিন/মাস/সাল'
    : 'DD/MM/YYYY';

  const handleContainerClick = () => {
    if (disabled) return;
    if (inputRef.current) {
      try {
        if (typeof inputRef.current.showPicker === 'function') {
          inputRef.current.showPicker();
        } else {
          inputRef.current.focus();
        }
      } catch {
        inputRef.current.focus();
      }
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`relative inline-flex items-center justify-between gap-2 select-none ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <span
        data-testid={dataTestId ? `${dataTestId}-display` : undefined}
        className="truncate tabular-nums tracking-tight"
      >
        {formattedDisplay}
      </span>
      <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0 pointer-events-none" />
      <input
        ref={inputRef}
        id={id}
        data-testid={dataTestId}
        aria-label={ariaLabel}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
};
