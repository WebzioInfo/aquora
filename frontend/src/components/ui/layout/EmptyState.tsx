import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  /** LucideIcon to display */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional CTA button */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Universal empty state used in all tables and lists.
 * Consistent icon size, spacing, and typography across the ERP.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-[14px] font-bold text-slate-700 mb-1">{title}</h3>
      {description && (
        <p className="text-[12px] font-medium text-slate-400 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default EmptyState;
