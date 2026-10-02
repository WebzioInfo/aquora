import React, { useState, useRef, useEffect } from 'react'
import {
  MoreVertical,
  Eye,
  Edit2,
  Printer,
  Copy,
  CreditCard,
  XCircle,
  Trash2,
  Landmark,
  Wallet,
  Receipt
} from 'lucide-react'
import type { Purchase } from '../../../../services/purchases'
import { CategoryPill } from '../expenses/categoryMeta'
import { formatINR, getStatusStyle } from './purchaseHelpers'

interface PurchaseRowProps {
  purchase: Purchase
  isSelected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
  onOpenDrawer: () => void
  onEdit: () => void
  onPrint: () => void
  onDuplicate: () => void
  onRecordPayment: () => void
  onCancel: () => void
  onDelete: () => void
  canWrite: boolean
}

export const PurchaseRow: React.FC<PurchaseRowProps> = ({
  purchase,
  isSelected,
  onToggleSelect,
  onOpenDrawer,
  onEdit,
  onPrint,
  onDuplicate,
  onRecordPayment,
  onCancel,
  onDelete,
  canWrite
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside)
    }
  }, [menuOpen])

  const isCancelled = purchase.isCancelled || purchase.paymentStatus === 'Cancelled'
  const statusStyle = getStatusStyle(purchase.paymentStatus, purchase.isCancelled)

  // Format date: DD Mon YYYY
  const dateFormatted = new Date(purchase.purchaseDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  // Payment percentage calculation
  const gross = purchase.grandTotal || 0
  const paid = purchase.amountPaid || 0
  const balance = purchase.balanceAmount || 0
  const progressPercent = gross > 0 ? Math.min(100, Math.max(0, (paid / gross) * 100)) : 0

  const isBank = (purchase.paymentMethod || '').toLowerCase().includes('bank')
  const isCash = (purchase.paymentMethod || '').toLowerCase().includes('cash')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onOpenDrawer()
    } else if (e.key === ' ') {
      e.preventDefault()
      onToggleSelect(e as any)
    }
  }

  return (
    <tr
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        // Only trigger drawer if click wasn't on checkbox, menu, or actions
        const target = e.target as HTMLElement
        if (target.closest('input[type="checkbox"]') || target.closest('button') || target.closest('[data-no-drawer="true"]')) {
          return
        }
        onOpenDrawer()
      }}
      className={`group border-b border-[#E5E9F2] transition-colors cursor-pointer outline-none focus:bg-blue-50/50 ${
        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50/80 bg-white'
      } ${isCancelled ? 'opacity-65' : ''}`}
    >
      {/* 1. Checkbox */}
      <td
        className="w-10 px-3 py-3 text-center align-middle"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={onToggleSelect}
          className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-0 focus:ring-offset-0 cursor-pointer"
        />
      </td>

      {/* 2. Purchase (Vendor + Date / Code / Invoice) */}
      <td className="px-3 py-3 min-w-[200px]">
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 text-xs truncate leading-snug">
            {purchase.vendorName || 'General Vendor'}
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-normal mt-0.5 truncate">
            <span>{dateFormatted}</span>
            {purchase.vendorCode && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-slate-500 font-medium">{purchase.vendorCode}</span>
              </>
            )}
            {purchase.invoiceNumber && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-slate-600 bg-slate-100 px-1 py-0.2 rounded text-[10px]" title="Invoice Number">
                  #{purchase.invoiceNumber}
                </span>
              </>
            )}
          </div>
          {/* On tablet screens (640-1023px), category pill renders here */}
          <div className="mt-1 lg:hidden">
            <CategoryPill category={purchase.purchaseCategory} size="sm" />
          </div>
        </div>
      </td>

      {/* 3. Category (Hidden on 640-1023px tablet) */}
      <td className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">
        <CategoryPill category={purchase.purchaseCategory} size="sm" />
      </td>

      {/* 4. Gross Amount (Right aligned, neutral font) */}
      <td className="px-3 py-3 text-right whitespace-nowrap">
        <span className={`font-semibold font-mono text-xs text-slate-900 ${
          isCancelled ? 'line-through text-slate-400' : ''
        }`}>
          {formatINR(gross)}
        </span>
      </td>

      {/* 5. Payment Column: Status pill + Method icon/text + 3px progress bar + Balance */}
      <td className="px-3 py-3 min-w-[190px] whitespace-nowrap">
        <div className="space-y-1.5 max-w-[220px]">
          {/* Line 1: Status Pill & Method */}
          <div className="flex items-center justify-between gap-2">
            <span
              style={{
                backgroundColor: statusStyle.bg,
                color: statusStyle.text,
                borderColor: statusStyle.border
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
              {statusStyle.label}
            </span>

            {/* Payment Method */}
            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium truncate">
              {isBank ? (
                <Landmark className="w-3 h-3 text-slate-400 shrink-0" />
              ) : isCash ? (
                <Wallet className="w-3 h-3 text-amber-500 shrink-0" />
              ) : (
                <Receipt className="w-3 h-3 text-slate-400 shrink-0" />
              )}
              <span className="truncate">{purchase.paymentMethod || 'Bank'}</span>
            </div>
          </div>

          {/* Line 2: 3px Progress Bar */}
          <div className="h-[3px] w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isCancelled ? 'bg-slate-300' : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Line 3: Balance Amount (Danger color when > 0) */}
          {balance > 0 && !isCancelled && (
            <div className="flex items-center justify-between text-[10px] leading-none">
              <span className="text-slate-400">Balance:</span>
              <span className="font-mono font-bold text-rose-600">
                {formatINR(balance)}
              </span>
            </div>
          )}
        </div>
      </td>

      {/* 6. Row Menu (⋮) */}
      <td
        className="w-12 px-3 py-3 text-right whitespace-nowrap relative"
        onClick={(e) => e.stopPropagation()}
        data-no-drawer="true"
      >
        <div ref={menuRef} className="relative inline-block text-left">
          <button
            type="button"
            aria-label="More actions"
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-8 z-30 w-44 rounded-xl bg-white shadow-xl border border-slate-200 py-1 text-xs focus:outline-none animate-in fade-in zoom-in-95 duration-100"
              role="menu"
            >
              {/* View details */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenDrawer()
                }}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                View details
              </button>

              {/* Edit */}
              {canWrite && !isCancelled && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onEdit()
                  }}
                  className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                  Edit
                </button>
              )}

              {/* Print */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onPrint()
                }}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                Print
              </button>

              {/* Duplicate */}
              {canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onDuplicate()
                  }}
                  className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  Duplicate
                </button>
              )}

              {/* Record Payment (only when balance > 0 and not cancelled) */}
              {canWrite && !isCancelled && balance > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onRecordPayment()
                  }}
                  className="w-full text-left px-3 py-2 text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 font-semibold"
                >
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  Record payment
                </button>
              )}

              {/* Divider */}
              <div className="my-1 border-t border-slate-100" />

              {/* Cancel Purchase */}
              {canWrite && !isCancelled && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onCancel()
                  }}
                  className="w-full text-left px-3 py-2 text-amber-700 hover:bg-amber-50 flex items-center gap-2 font-medium"
                >
                  <XCircle className="w-3.5 h-3.5 text-amber-600" />
                  Cancel purchase
                </button>
              )}

              {/* Delete Purchase */}
              {canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                  className="w-full text-left px-3 py-2 text-rose-700 hover:bg-rose-50 flex items-center gap-2 font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
