import React from 'react';

type StatusVariant =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'default';

const VARIANT_STYLES: Record<StatusVariant, string> = {
  active:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-100  text-slate-500  border-slate-200',
  pending:  'bg-amber-50   text-amber-700  border-amber-200',
  success:  'bg-green-50   text-green-700  border-green-200',
  error:    'bg-red-50     text-red-700    border-red-200',
  warning:  'bg-orange-50  text-orange-700 border-orange-200',
  info:     'bg-blue-50    text-blue-700   border-blue-200',
  default:  'bg-slate-100  text-slate-600  border-slate-200',
};

const DOT_STYLES: Record<StatusVariant, string> = {
  active:   'bg-emerald-500',
  inactive: 'bg-slate-400',
  pending:  'bg-amber-500',
  success:  'bg-green-500',
  error:    'bg-red-500',
  warning:  'bg-orange-500',
  info:     'bg-blue-500',
  default:  'bg-slate-400',
};

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  showDot?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Single source of truth for all status indicators across the ERP.
 * Replaces EnterpriseBadge and all inline badge patterns.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  showDot = true,
  size = 'sm',
}) => {
  const displayLabel = label ?? status.charAt(0).toUpperCase() + status.slice(1);
  const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full border ${sizeClass} ${VARIANT_STYLES[status]}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_STYLES[status]}`} />
      )}
      {displayLabel}
    </span>
  );
};

export default StatusBadge;
