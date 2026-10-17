import React from 'react'

export interface StatTileProps {
  label: string
  value: string | number
  hint?: string
  tone?: 'ok' | 'warn' | 'bad' | 'default'
  icon?: React.ReactNode
  iconBg?: string
  borderAccentColor?: string
  height?: string
  className?: string
  isHero?: boolean
  onClick?: () => void
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  hint,
  tone = 'default',
  icon,
  iconBg = 'bg-slate-100 text-slate-600',
  borderAccentColor = 'border-l-slate-400',
  height = 'h-[74px]',
  className = '',
  onClick
}) => {
  const toneColor =
    tone === 'ok'
      ? 'text-emerald-600'
      : tone === 'warn'
      ? 'text-amber-600'
      : tone === 'bad'
      ? 'text-rose-600'
      : 'text-slate-400'

  return (
    <div
      onClick={onClick}
      className={`min-w-0 ${height} rounded-xl bg-white border border-slate-200/90 border-l-4 ${borderAccentColor} px-3.5 py-2.5 shadow-2xs flex flex-col justify-between select-none ${
        onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-xs transition-all' : ''
      } ${className}`}
    >
      {/* Top row: Label on left, Icon container on right (matching Accounts Dashboard KPI cards) */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </span>
        {icon && (
          <div
            className={`w-6 h-6 rounded-md shrink-0 flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5 ${iconBg}`}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Bottom row: Value and Hint */}
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums leading-none tracking-tight truncate">
          {value}
        </span>
        {hint && (
          <span
            className={`text-[10px] sm:text-[11px] ${toneColor} font-medium truncate leading-none`}
          >
            {hint}
          </span>
        )}
      </div>
    </div>
  )
}

export default StatTile
