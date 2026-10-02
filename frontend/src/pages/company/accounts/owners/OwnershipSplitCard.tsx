import React, { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import type { Owner } from '../../../../services/simpleAccounts'
import { getOwnerColor } from './ownerHelpers'

interface OwnershipSplitCardProps {
  owners: Owner[]
  onSelectOwner: (owner: Owner) => void
  hoveredOwnerId?: string | null
  onHoverOwner?: (id: string | null) => void
  isCollapseBreakdown?: boolean
  loading?: boolean
}

export const OwnershipSplitCard: React.FC<OwnershipSplitCardProps> = ({
  owners,
  onSelectOwner,
  hoveredOwnerId = null,
  onHoverOwner,
  isCollapseBreakdown = false,
  loading = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState(isCollapseBreakdown)

  // Recalculate collapsed state when viewport collapsed flag changes
  React.useEffect(() => {
    setIsCollapsed(isCollapseBreakdown)
  }, [isCollapseBreakdown])

  // Compute total allocation
  const totalAllocated = React.useMemo(() => {
    const sum = owners.reduce((acc, o) => acc + Number(o.ownershipPercentage || 0), 0)
    return Math.round(sum * 100) / 100
  }, [owners])

  const unallocated = Math.max(0, Math.round((100 - totalAllocated) * 100) / 100)
  const overAllocated = Math.max(0, Math.round((totalAllocated - 100) * 100) / 100)

  if (loading) {
    return (
      <div className="bg-white border border-[#E5E9F2] rounded-[12px] p-3 shadow-2xs animate-pulse h-16 shrink-0" />
    )
  }

  // Accessibility string describing the entire ownership split
  const accessibleAltText = `Ownership allocation: ${owners
    .map(o => `${o.name}: ${o.ownershipPercentage}%`)
    .join(', ')}${unallocated > 0 ? `, Unallocated: ${unallocated}%` : ''}. Total: ${totalAllocated}%.`

  return (
    <div className="bg-white border border-[#E5E9F2] rounded-[12px] p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] shrink-0 select-none transition-all">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">Ownership split</span>
          {isCollapseBreakdown && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-[11px] font-semibold text-[#1A56DB] hover:text-blue-700 flex items-center gap-0.5 ml-1"
            >
              <span>{isCollapsed ? 'Show split' : 'Hide split'}</span>
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        <div className="text-xs font-medium text-slate-500">
          Total{' '}
          <strong className={`font-mono font-bold ${
            totalAllocated > 100
              ? 'text-rose-600'
              : totalAllocated === 100
              ? 'text-emerald-600'
              : 'text-slate-900'
          }`}>
            {totalAllocated}%
          </strong>{' '}
          of 100%
        </div>
      </div>

      {/* Bar, Legend, and Alert (collapsed when isCollapsed is true) */}
      {!isCollapsed && (
        <div className="mt-2.5 space-y-2.5">
          {/* 10px Stacked Bar */}
          <div
            className="w-full h-2.5 bg-slate-100 rounded-full flex gap-0.5 p-0.5 overflow-hidden"
            role="img"
            aria-label={accessibleAltText}
          >
            {owners.map(owner => {
              const pct = Number(owner.ownershipPercentage || 0)
              if (pct <= 0) return null

              const color = getOwnerColor(owner.id || owner.name)
              const isHovered = hoveredOwnerId === owner.id

              // Relative basis against 100% or totalAllocated if > 100
              const scale = Math.max(100, totalAllocated)
              const widthPct = (pct / scale) * 100

              return (
                <button
                  key={owner.id}
                  type="button"
                  onClick={() => onSelectOwner(owner)}
                  onMouseEnter={() => onHoverOwner?.(owner.id)}
                  onMouseLeave={() => onHoverOwner?.(null)}
                  style={{ width: `${widthPct}%`, minWidth: '8px', backgroundColor: color.hex }}
                  className={`h-full rounded-full transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-600 ${
                    isHovered ? 'brightness-110 scale-y-125 z-10' : 'hover:opacity-90'
                  }`}
                  title={`${owner.name}: ${pct}% (Click to view details)`}
                />
              )
            })}

            {/* Gray Unallocated segment */}
            {unallocated > 0 && (
              <div
                style={{ width: `${unallocated}%`, minWidth: '8px' }}
                className="h-full bg-slate-300 rounded-full"
                title={`Unallocated: ${unallocated}%`}
              />
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            {owners.map(owner => {
              const color = getOwnerColor(owner.id || owner.name)
              const isHovered = hoveredOwnerId === owner.id

              return (
                <button
                  key={owner.id}
                  type="button"
                  onClick={() => onSelectOwner(owner)}
                  onMouseEnter={() => onHoverOwner?.(owner.id)}
                  onMouseLeave={() => onHoverOwner?.(null)}
                  className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer rounded px-1 -mx-1 ${
                    isHovered ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span>
                    {owner.name}{' '}
                    <strong className="font-mono text-slate-900 font-medium">
                      {owner.ownershipPercentage}%
                    </strong>
                  </span>
                </button>
              )
            })}

            {/* Unallocated Legend Item */}
            {unallocated > 0 && (
              <div className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                <span>
                  Unallocated{' '}
                  <strong className="font-mono text-slate-700 font-medium">
                    {unallocated}%
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Alert Line if < 100% or > 100% */}
          {totalAllocated < 100 && (
            <div className="pt-2 border-t border-amber-100 flex items-center gap-1.5 text-[11px] text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                Ownership adds up to <strong>{totalAllocated}%</strong>. Assign the remaining{' '}
                <strong>{unallocated}%</strong> to reach 100%.
              </span>
            </div>
          )}

          {totalAllocated > 100 && (
            <div className="pt-2 border-t border-rose-100 flex items-center gap-1.5 text-[11px] text-rose-700">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>
                Ownership exceeds 100% by <strong>{overAllocated}%</strong>. Adjust owner shares so the total equals 100%.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default OwnershipSplitCard
