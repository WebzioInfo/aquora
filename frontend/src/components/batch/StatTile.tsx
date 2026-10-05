import React from 'react'

export interface StatTileProps {
  label: string
  value: string | number
  hint?: string
  tone?: 'ok' | 'warn' | 'bad' | 'default'
  icon?: React.ReactNode
  iconBg?: string
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
  height = 'h-16',
  className = '',
  isHero = false,
  onClick
}) => {
  const toneColor =
    tone === 'ok'
      ? 'text-emerald-600'
      : tone === 'warn'
      ? 'text-amber-600'
      : tone === 'bad'
      ? 'text-red-600'
      : 'text-slate-400'

  return (
    <div
      onClick={onClick}
      className={`min-w-0 ${height} rounded-xl border ${
        isHero ? 'border-blue-300 bg-blue-50/25' : 'border-slate-200 bg-white'
      } px-3 py-2 flex items-center gap-3 select-none ${
        onClick ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-colors' : ''
      } ${className}`}
    >
      {/* Icon chip: 28px rounded-lg tinted square with 16px icon */}
      {icon && (
        <div
          className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4 ${iconBg}`}
        >
          {icon}
        </div>
      )}

      {/* Text block: label on top, value & hint inline */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-xs text-slate-500 font-normal leading-none truncate">
          {label}
        </span>
        <div className="flex items-baseline gap-2 mt-1 min-w-0">
          <span
            className={`font-mono font-bold tabular-nums leading-none truncate tracking-tight ${
              isHero
                ? 'text-[26px] text-blue-600'
                : 'text-[20px] text-slate-900'
            }`}
          >
            {value}
          </span>
          {hint && (
            <span
              className={`text-xs ${toneColor} font-normal leading-none truncate`}
            >
              {hint}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatTile
