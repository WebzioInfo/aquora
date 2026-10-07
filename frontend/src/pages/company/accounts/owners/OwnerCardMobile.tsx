import React, { useState, useRef, useEffect } from 'react'
import { MoreVertical, Eye, Edit2, Trash2, ArrowLeftRight } from 'lucide-react'
import type { Owner } from '../../../../services/simpleAccounts'
import { formatINR, getOwnerInitials, getOwnerColor, getOwnerTransactionTotals } from './ownerHelpers'

interface OwnerCardMobileProps {
  owner: Owner
  onCardClick: (owner: Owner) => void
  onOpenTransact: (owner: Owner) => void
  onOpenEdit: (owner: Owner) => void
  onDelete: (owner: Owner) => void
}

export const OwnerCardMobile: React.FC<OwnerCardMobileProps> = ({
  owner,
  onCardClick,
  onOpenTransact,
  onOpenEdit,
  onDelete
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
  const hasHistory = Boolean(owner.transactions && owner.transactions.length > 0)

  return (
    <div
      onClick={() => onCardClick(owner)}
      className="p-3.5 bg-white border border-[#E5E9F2] rounded-xl shadow-2xs space-y-3 cursor-pointer text-xs select-none hover:border-slate-300 transition-colors"
    >
      {/* Top Header: Avatar, Name & ⋮ */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${color.bg} ${color.text} ${color.border}`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-slate-900 truncate text-sm flex items-center gap-1.5">
              <span>{owner.name}</span>
              {owner.userId && (
                <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded" title="Integrated Employee profile">
                  Employee
                </span>
              )}
            </h4>
            <div className="text-[11px] text-slate-500 truncate">
              {owner.phone || 'No phone'}
            </div>
          </div>
        </div>

        {/* Menu (⋮) */}
        <div ref={menuRef} className="relative shrink-0">
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
                  onCardClick(owner)
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
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ownership Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-slate-500 font-medium">Ownership share:</span>
          <span className="font-semibold text-slate-900 font-mono">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, pct))}%`,
              backgroundColor: color.hex
            }}
          />
        </div>
      </div>

      {/* Financials & Transact Action */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            Current Investment
          </div>
          <div className="text-sm font-bold text-slate-900 font-mono">
            {formatINR(currentInv)}
          </div>
          <div className="text-[10px] text-slate-500">
            Initial: {formatINR(initialInv)}
          </div>
        </div>

        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onOpenTransact(owner)
          }}
          className="h-[32px] px-3 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors shadow-2xs"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Transact</span>
        </button>
      </div>
    </div>
  )
}

export default OwnerCardMobile
