import React from 'react'
import type { LucideIcon } from 'lucide-react'

export interface KpiCardProps {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  iconBgColor?: string
  iconTextColor?: string
  subLabel?: React.ReactNode
  isShortScreen?: boolean
  className?: string
  valueClassName?: string
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  icon: Icon,
  iconBgColor = 'bg-blue-50',
  iconTextColor = 'text-[#1A56DB]',
  subLabel,
  isShortScreen = false,
  className = '',
  valueClassName = 'text-slate-900'
}) => {
  const cardPadding = isShortScreen ? 'p-2.5 h-[76px]' : 'p-3.5 h-[94px]'

  return (
    <div
      className={`bg-white border border-[#E5E9F2] rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col justify-between transition-all select-none ${cardPadding} ${className}`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {label}
          </span>
          <div className={`p-1 rounded-md ${iconBgColor} ${iconTextColor}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-0.5">
          <h3 className={`text-lg sm:text-xl font-bold tracking-tight font-mono leading-none ${valueClassName}`}>
            {value}
          </h3>
        </div>
      </div>

      {!isShortScreen && subLabel && (
        <div className="pt-1 border-t border-slate-100 text-[10px] flex items-center justify-between">
          {subLabel}
        </div>
      )}
    </div>
  )
}

export default KpiCard
