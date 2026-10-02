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

interface PurchaseCardMobileProps {
  purchase: Purchase
  isSelected: boolean
  onToggleSelect: () => void
  onOpenDrawer: () => void
  onEdit: () => void
  onPrint: () => void
  onDuplicate: () => void
  onRecordPayment: () => void
  onCancel: () => void
  onDelete: () => void
  canWrite: boolean
}

export const PurchaseCardMobile: React.FC<PurchaseCardMobileProps> = ({
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

  const dateFormatted = new Date(purchase.purchaseDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  const gross = purchase.grandTotal || 0
  const paid = purchase.amountPaid || 0
  const balance = purchase.balanceAmount || 0
  const progressPercent = gross > 0 ? Math.min(100, Math.max(0, (paid / gross) * 100)) : 0

  const isBank = (purchase.paymentMethod || '').toLowerCase().includes('bank')
  const isCash = (purchase.paymentMethod || '').toLowerCase().includes('cash')

  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('input[type="checkbox"]') || target.closest('button')) {
          return
        }
        onOpenDrawer()
      }}
      className={`p-3.5 bg-white border border-[#E5E9F2] rounded-xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-3 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50/70 border-blue-200' : 'hover:bg-slate-50/60'
      } ${isCancelled ? 'opacity-65' : ''}`}
    >
      {/* Top Header: Checkbox top-left, Vendor + Date in middle, Menu top-right */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#1A56DB] focus:ring-0 cursor-pointer shrink-0"
          />
          <div className="min-w-0">
            <span className="font-bold text-slate-900 text-xs block truncate leading-snug">
              {purchase.vendorName || 'General Vendor'}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-normal mt-0.5 truncate">
              <span>{dateFormatted}</span>
              {purchase.vendorCode && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono">{purchase.vendorCode}</span>
                </>
              )}
              {purchase.invoiceNumber && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-slate-600 bg-slate-100 px-1 py-0.2 rounded text-[10px]">
                    #{purchase.invoiceNumber}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top-Right Menu (⋮) */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            aria-label="More actions"
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-8 z-30 w-44 rounded-xl bg-white shadow-xl border border-slate-200 py-1 text-xs focus:outline-none"
              role="menu"
            >
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

              <div className="my-1 border-t border-slate-100" />

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
      </div>

      {/* Middle: Category Pill & Gross Amount */}
      <div className="flex items-center justify-between gap-2">
        <CategoryPill category={purchase.purchaseCategory} size="sm" />
        <span className={`text-sm font-bold font-mono text-slate-900 ${
          isCancelled ? 'line-through text-slate-400' : ''
        }`}>
          {formatINR(gross)}
        </span>
      </div>

      {/* Payment details with 3px progress bar & balance */}
      <div className="pt-2 border-t border-slate-100 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span
            style={{
              backgroundColor: statusStyle.bg,
              color: statusStyle.text,
              borderColor: statusStyle.border
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
            {statusStyle.label}
          </span>

          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
            {isBank ? (
              <Landmark className="w-3 h-3 text-slate-400" />
            ) : isCash ? (
              <Wallet className="w-3 h-3 text-amber-500" />
            ) : (
              <Receipt className="w-3 h-3 text-slate-400" />
            )}
            <span>{purchase.paymentMethod || 'Bank'}</span>
          </div>
        </div>

        <div className="h-[3px] w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isCancelled ? 'bg-slate-300' : 'bg-emerald-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {balance > 0 && !isCancelled && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Balance:</span>
            <span className="font-mono font-bold text-rose-600">
              {formatINR(balance)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
