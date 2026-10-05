import React from 'react'
import { TileLabel } from './TileLabel'

export interface MaterialTileProps {
  name: string
  used: number | string
  waste: number | string
  unit: string
  className?: string
}

export const MaterialTile: React.FC<MaterialTileProps> = ({
  name,
  used,
  waste,
  unit,
  className = ''
}) => {
  const numUsed = Number(used) || 0
  const numWaste = Number(waste) || 0
  const total = Math.max(1, numUsed + numWaste)
  const wastePct = Math.min(100, Math.max(0, (numWaste / total) * 100))
  const hasWaste = numWaste > 0

  return (
    <div
      className={`min-w-0 h-[72px] rounded-xl border border-slate-200 bg-white px-3 py-2 flex flex-col justify-between select-none ${className}`}
    >
      <div className="flex items-center justify-between">
        <TileLabel>{name}</TileLabel>
        {hasWaste ? (
          <span className="text-xs text-red-600 font-normal leading-none">
            Waste <span className="font-mono tabular-nums font-medium">{waste}</span> {unit}
          </span>
        ) : (
          <span className="text-xs text-slate-400 font-normal leading-none">
            <span className="font-mono tabular-nums">0</span> waste
          </span>
        )}
      </div>

      <div className="text-[17px] font-mono font-bold text-slate-900 leading-tight tabular-nums truncate">
        {used} <span className="text-xs text-slate-500 font-normal font-sans">{unit}</span>
      </div>

      {/* Red waste progress bar */}
      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
        {hasWaste ? (
          <div
            className="h-full bg-red-500 rounded-full transition-all duration-300"
            style={{ width: `${wastePct}%` }}
          />
        ) : (
          <div className="h-full bg-slate-200 rounded-full" style={{ width: '0%' }} />
        )}
      </div>
    </div>
  )
}

export default MaterialTile
