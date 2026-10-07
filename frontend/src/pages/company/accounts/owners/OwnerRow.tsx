import React, { useState, useRef, useEffect } from 'react'
import { MoreVertical, Eye, Edit2, Trash2, ArrowLeftRight } from 'lucide-react'
import type { Owner } from '../../../../services/simpleAccounts'
import { formatINR, getOwnerInitials, getOwnerColor, getOwnerTransactionTotals } from './ownerHelpers'

interface OwnerRowProps {
  owner: Owner
  isHighlighted?: boolean
  onRowClick: (owner: Owner) => void
  onOpenTransact: (owner: Owner) => void
  onOpenEdit: (owner: Owner) => void
  onDelete: (owner: Owner) => void
}

export const OwnerRow: React.FC<OwnerRowProps> = ({
  owner,
  isHighlighted = false,
  onRowClick,
  onOpenTransact,
  onOpenEdit,
  onDelete
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const initials = getOwnerInitials(owner.name)
  const color = getOwnerColor(owner.id || owner.name)
  const pct = Number(owner.ownershipPercentage || 0)
  const initialInv = Number(owner.initialInvestment || 0)
  const currentInv = Number(owner.currentInvestment || 0)

  const { additionalInvested, totalWithdrawn } = getOwnerTransactionTotals(owner)

  // Has transactions condition to disable delete
  const hasHistory = Boolean(owner.transactions && owner.transactions.length > 0)

  return (
    <tr
      onClick={() => onRowClick(owner)}
      className={`border-b border-[#E5E9F2] hover:bg-slate-50/80 transition-colors cursor-pointer text-xs select-none ${
        isHighlighted ? 'bg-blue-50/50' : ''
      }`}
    >
      {/* 1. Owner Name & Phone & Tablet Initial */}
      <td className="px-3 py-2.5 min-w-[200px]">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${color.bg} ${color.text} ${color.border}`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
              <span>{owner.name}</span>
              {owner.userId && (
                <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded" title="Integrated Employee profile">
                  Employee
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
              <span>{owner.phone || 'No phone'}</span>
              {/* Tablet secondary Initial investment (hidden on desktop) */}
              <span className="lg:hidden text-slate-400">
                · Initial {formatINR(initialInv)}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* 2. Ownership % & Mini Progress Bar */}
      <td className="px-3 py-2.5 min-w-[140px]">
        <div className="flex flex-col gap-1 max-w-[120px]">
          <div className="font-semibold text-slate-900 font-mono">
            {pct}%
          </div>
          <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, pct))}%`,
                backgroundColor: color.hex
              }}
            />
          </div>
        </div>
      </td>

      {/* 3. Initial Investment (Hidden on Tablet, merges under Owner) */}
      <td className="hidden lg:table-cell px-3 py-2.5 min-w-[120px]">
        <div className="font-medium text-slate-800 font-mono">
          {formatINR(initialInv)}
        </div>
      </td>

      {/* 4. Current Investment & Breakdown Line */}
      <td className="px-3 py-2.5 min-w-[180px]">
        <div className="font-semibold text-slate-900 font-mono">
          {formatINR(currentInv)}
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          {additionalInvested > 0 || totalWithdrawn > 0 ? (
            <span>
              +{formatINR(additionalInvested)} added · −{formatINR(totalWithdrawn)} withdrawn
            </span>
          ) : (
            <span className="text-slate-400 font-sans">No additional transactions</span>
          )}
        </div>
      </td>

      {/* 5. Action Button: Transact */}
      <td className="px-3 py-2.5 text-right w-24">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onOpenTransact(owner)
          }}
          className="h-[28px] px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors border border-slate-200 shadow-2xs"
          title="Record investment or withdrawal"
        >
          <ArrowLeftRight className="w-3 h-3 text-[#1A56DB]" />
          <span>Transact</span>
        </button>
      </td>

      {/* 6. Row Menu (⋮) */}
      <td className="w-10 px-2 py-2.5 text-center relative">
        <div ref={menuRef} className="relative inline-block text-left">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              setMenuOpen(!menuOpen)
            }}
            aria-label="More actions"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onRowClick(owner)
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>View details</span>
              </button>

              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onOpenEdit(owner)
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Edit owner</span>
              </button>

              <div className="my-1 border-t border-slate-100" />

              <div title={hasHistory ? 'Owner has transaction history' : undefined}>
                <button
                  type="button"
                  disabled={hasHistory}
                  onClick={e => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    onDelete(owner)
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default OwnerRow
