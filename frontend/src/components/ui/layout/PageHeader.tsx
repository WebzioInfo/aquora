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
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm px-5 py-3 flex flex-wrap items-center justify-between gap-3">
      {/* Left */}
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[20px] font-black text-slate-900 leading-tight tracking-tight">
              {title}
            </h1>
            {badge && <div className="flex items-center">{badge}</div>}
          </div>
          {description && (
            <p className="text-[12px] text-slate-500 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Right */}
      {actions && (
        <div className="flex items-center gap-3 ml-auto">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
