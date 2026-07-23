import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional LucideIcon displayed left of title */
  icon?: LucideIcon;
  /** Badge / pill shown beside title */
  badge?: React.ReactNode;
  /** Right-aligned action buttons */
  actions?: React.ReactNode;
}

/**
 * Standard page header used on every list and detail page.
 * Left side: optional icon + title + optional description.
 * Right side: action buttons.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  badge,
  actions,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Left */}
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] font-black tracking-tight text-slate-900 leading-none">
              {title}
            </h1>
            {badge && <div className="flex items-center">{badge}</div>}
          </div>
          {description && (
            <p className="text-[13px] font-medium text-slate-500 mt-1.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Right */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
