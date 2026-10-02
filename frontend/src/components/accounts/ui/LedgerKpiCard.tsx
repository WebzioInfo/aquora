import React from 'react'
import type { LucideIcon } from 'lucide-react'

export interface LedgerKpiCardProps {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  iconBgColor?: string
  iconTextColor?: string
  subLabel?: React.ReactNode
  valueClassName?: string
  className?: string
}

export const LedgerKpiCard: React.FC<LedgerKpiCardProps> = ({
  label,
  value,
  icon: Icon,
  iconBgColor = 'bg-blue-50',
  iconTextColor = 'text-blue-600',
  subLabel,
  valueClassName = 'text-slate-900',
  className = ''
}) => {
  return (
    <div
      className={`p-3 flex flex-col justify-between h-[92px] sm:h-[96px] bg-white border border-slate-200/80 rounded-xl shadow-xs transition-all select-none ${className}`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {label}
          </span>
          <div className={`p-1 rounded-md shrink-0 ${iconBgColor} ${iconTextColor}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-0.5">
          <h3 className={`text-xl font-black tracking-tight font-mono leading-none ${valueClassName}`}>
            {value}
          </h3>
        </div>
      </div>
      {subLabel && (
        <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between truncate">
          {subLabel}
        </div>
      )}
    </div>
  )
}

export default LedgerKpiCard
