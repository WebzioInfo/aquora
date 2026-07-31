import React from 'react';
import type { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700 shadow-sm',
  secondary: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm',
  danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700 shadow-sm',
  ghost: 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900',
  outline: 'bg-transparent text-blue-600 border-blue-300 hover:bg-blue-50',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8  px-3   text-[11px] gap-1.5 rounded-lg',
  md: 'h-9  px-3.5 text-[12px] gap-2   rounded-lg',
  lg: 'h-10 px-4   text-[13px] gap-2   rounded-xl',
};

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  children?: React.ReactNode;
}

/**
 * Standardized button used for all page-level actions.
 * Replaces EnterpriseButton and inline button patterns.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-bold border transition-all duration-150 cursor-pointer
        whitespace-nowrap shrink-0
        active:scale-[0.97]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${SIZE_CLASSES[size]}
        ${VARIANT_CLASSES[variant]}
        ${className}
      `}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        Icon && <Icon className="w-3.5 h-3.5 shrink-0" />
      )}
      {children}
      {IconRight && !loading && <IconRight className="w-3.5 h-3.5 shrink-0" />}
    </button>
  );
};

export default ActionButton;