import React from 'react';

interface FilterBarProps {
  children: React.ReactNode;
  /** Optional right-side action buttons (Export, Add, etc.) */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard filter toolbar above tables and lists.
 * Search inputs, dropdowns, and date pickers go into `children`.
 * Action buttons (Export, Add) go into `actions`.
 */
export const FilterBar: React.FC<FilterBarProps> = ({ children, actions, className = '' }) => {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full ${className}`}
    >
      <div className="flex flex-1 flex-wrap items-center gap-3">{children}</div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-3">
          {actions}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
