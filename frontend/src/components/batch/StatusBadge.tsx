import React from 'react'

export interface StatusBadgeProps {
  status?: string
  className?: string
  showDot?: boolean
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = '',
  className = '',
  showDot = true
}) => {
  const s = status.toLowerCase()
  let colorCls = 'bg-slate-100 text-slate-700 border-slate-200'
  let label = status || 'Unknown'
  let isRunning = false

  if (s === 'running' || s === 'active' || s === 'in progress' || s === 'bottling active') {
    colorCls = 'bg-emerald-50 text-emerald-700 border-emerald-200'
    label = 'Running'
    isRunning = true
  } else if (s === 'paused') {
    colorCls = 'bg-amber-50 text-amber-700 border-amber-200'
    label = 'Paused'
  } else if (s === 'completed') {
    colorCls = 'bg-blue-50 text-blue-700 border-blue-200'
    label = 'Completed'
  } else if (s === 'stopped' || s === 'cancelled') {
    colorCls = 'bg-rose-50 text-rose-700 border-rose-200'
    label = s === 'stopped' ? 'Stopped' : 'Cancelled'
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-none ${colorCls} ${className}`}
    >
      {isRunning && showDot && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block mr-1.5 shrink-0" />
      )}
      <span>{label}</span>
    </span>
  )
}

export default StatusBadge
