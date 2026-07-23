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
      className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between min-h-[104px] w-full transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-[0.99]' : ''
      }`}
    >
      {/* Top row */}
      <div className="flex justify-between items-start">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">
          {label}
        </h3>
        {Icon && (
          <div className={`p-2 rounded-lg shrink-0 ${iconBgClass} ${iconColorClass}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mt-2">
        {loading ? (
          <div className="h-7 w-16 bg-slate-100 rounded animate-pulse" />
        ) : (
          <div className={`text-[26px] font-black leading-none ${colorClass}`}>{value}</div>
        )}
        {subtitle && (
          <p className="text-[11px] font-medium text-slate-400 mt-1">{subtitle}</p>
        )}
        {trend && !loading && (
          <div className="flex items-center gap-1 mt-1.5">
            <span
              className={`text-[10px] font-black ${
                trend.isPositive ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {trend.isPositive ? '+' : '-'}{trend.value}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              {trend.label ?? 'vs last period'}
            </span>
          </div>
        )}
      </div>
    </Wrapper>
  );
};

export default KPICard;
