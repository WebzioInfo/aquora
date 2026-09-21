import React from 'react';

interface SectionCardProps {
  /** Optional card title */
  title?: string;
  /** Optional subtitle / description */
  description?: string;
  /** Right-side actions (buttons, badges, etc.) */
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Remove inner padding (useful for full-bleed tables) */
  noPadding?: boolean;
  /** Compact ERP padding */
  compact?: boolean;
  className?: string;
}

/**
 * Universal content card wrapper used across all pages.
 * Provides consistent border, radius, shadow, and inner spacing.
 * Use noPadding for tables that need edge-to-edge rendering.
 */
export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  actions,
  children,
  noPadding = false,
  compact = false,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      {(title || actions) && (
        <div className={`flex items-start justify-between gap-4 border-b border-slate-100 ${compact ? 'px-4 py-2.5' : 'px-5 py-4'}`}>
          {title && (
            <div>
              <h2 className={`${compact ? 'text-[13px]' : 'text-[14px]'} font-bold text-slate-800 leading-tight`}>{title}</h2>
              {description && (
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">{description}</p>
              )}
            </div>
          )}
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}

      {/* Body */}
      <div className={noPadding ? '' : (compact ? 'p-3.5' : 'p-5')}>{children}</div>
    </div>
  );
};

export default SectionCard;
