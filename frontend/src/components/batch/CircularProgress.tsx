import React from 'react'

export interface CircularProgressProps {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  className?: string
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max,
  size = 56,
  strokeWidth = 5,
  className = ''
}) => {
  const isOver = max > 0 && value > max
  const pct = max > 0 ? (isOver ? 100 : Math.min(100, Math.max(0, (value / max) * 100))) : 0
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (pct / 100) * circumference

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100"
          fill="none"
        />
        {/* Progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-300 ${
            isOver ? 'text-amber-500' : 'text-blue-600'
          }`}
          fill="none"
        />
      </svg>
      {/* Center percentage label */}
      <span className="absolute text-[11px] font-mono font-bold text-slate-800 tabular-nums">
        {isOver ? '100%' : `${Math.round(pct)}%`}
      </span>
    </div>
  )
}

export default CircularProgress
