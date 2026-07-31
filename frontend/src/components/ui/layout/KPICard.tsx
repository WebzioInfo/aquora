import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number | string;
    isPositive: boolean;
    label?: string;
  };
  colorClass?: string;
  iconColorClass?: string;
  iconBgClass?: string;
  onClick?: () => void;
  loading?: boolean;
}

/**
 * Standard KPI / statistic card used across all dashboards and list pages.
 * All instances share the same height, padding, shadow, and typography.
 */
export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  colorClass = 'text-slate-900',
  iconColorClass = 'text-blue-600',
  iconBgClass = 'bg-blue-50',
  onClick,
  loading = false,
}) => {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`bg-white border border-[#E5E7EB] rounded-lg py-2 px-3 shadow-sm flex flex-col justify-center min-h-[54px] text-center w-full transition-all duration-150 select-none ${
        onClick ? 'cursor-pointer hover:border-slate-300 active:scale-[0.99]' : ''
      }`}
    >
      {loading ? (
        <div className="h-5 w-16 bg-slate-100 rounded animate-pulse mx-auto" />
      ) : (
        <span className={`text-[20px] font-black leading-tight ${colorClass}`}>{value}</span>
      )}
      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{label}</span>
      {subtitle && <span className="text-[9px] text-slate-400 font-medium">{subtitle}</span>}
    </Wrapper>
  );
};

export default KPICard;
