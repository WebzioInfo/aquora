import React from 'react'
import { FileSpreadsheet, Printer, XCircle, Trash2, X, CreditCard } from 'lucide-react'
import type { Purchase } from '../../../../services/purchases'
import { formatINR, toPaise, fromPaise } from './purchaseHelpers'

interface PurchaseBulkBarProps {
  selectedPurchases: Purchase[]
  onClearSelection: () => void
  onExportSelected: () => void
  onPrintSelected: () => void
  onCancelSelected: () => void
  onDeleteSelected: () => void
  onPaySelected: () => void
  canWrite: boolean
}

export const PurchaseBulkBar: React.FC<PurchaseBulkBarProps> = ({
  selectedPurchases,
  onClearSelection,
  onExportSelected,
  onPrintSelected,
  onCancelSelected,
  onDeleteSelected,
  onPaySelected,
  canWrite
}) => {
  const count = selectedPurchases.length
  if (count === 0) return null

  // Calculate totals in paise
  let grossPaise = 0
  let balancePaise = 0
  const vendorIds = new Set<string>()
  let allHaveBalance = true
  let hasActiveNonCancelled = false

  for (const p of selectedPurchases) {
    const isCancelled = p.isCancelled || p.paymentStatus === 'Cancelled'
    grossPaise += toPaise(p.grandTotal)
    balancePaise += toPaise(p.balanceAmount)
    
    if (p.vendorId || p.vendorName) {
      vendorIds.add(p.vendorId || p.vendorName)
    }

    if (toPaise(p.balanceAmount) <= 0 || isCancelled) {
      allHaveBalance = false
    }

    if (!isCancelled) {
      hasActiveNonCancelled = true
    }
  }

  const grossTotal = fromPaise(grossPaise)
  const balanceTotal = fromPaise(balancePaise)

  // "Pay selected" button visible ONLY when:
  // 1) canWrite is true
  // 2) Every selected purchase has balance > 0 and is not cancelled
  // 3) Every selected purchase belongs to the EXACT SAME vendor (vendorIds.size === 1)
  const canPaySelected = canWrite && allHaveBalance && vendorIds.size === 1 && count > 0

  return (
    <div className="p-2.5 sm:px-4 border-b border-blue-200 bg-[#EFF6FF] flex items-center justify-between gap-3 flex-wrap">
      {/* Left: Summary */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="inline-flex items-center justify-center bg-[#1A56DB] text-white text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
          {count}
        </span>
        <div className="text-xs text-slate-800 font-semibold truncate">
          <span>{count} selected</span>
          <span className="mx-1.5 text-slate-400">·</span>
          <span>Gross <strong className="font-mono text-slate-900">{formatINR(grossTotal)}</strong></span>
          <span className="mx-1.5 text-slate-400">·</span>
          <span>Balance <strong className={`font-mono ${balanceTotal > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{formatINR(balanceTotal)}</strong></span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Pay Selected (only if same vendor & balance > 0) */}
        {canPaySelected && (
          <button
            type="button"
            onClick={onPaySelected}
            className="h-[30px] px-2.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Pay all selected purchases for this vendor"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Pay Selected</span>
          </button>
        )}

        {/* Export Selected */}
        <button
          type="button"
          onClick={onExportSelected}
          className="h-[30px] px-2.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Print Selected */}
        <button
          type="button"
          onClick={onPrintSelected}
          className="h-[30px] px-2.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden sm:inline">Print</span>
        </button>

        {/* Cancel Selected (only if canWrite and has active non-cancelled) */}
        {canWrite && hasActiveNonCancelled && (
          <button
            type="button"
            onClick={onCancelSelected}
            className="h-[30px] px-2.5 text-xs font-semibold bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Cancel selected active purchases"
          >
            <XCircle className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Cancel</span>
          </button>
        )}

        {/* Delete Selected (only if canWrite) */}
        {canWrite && (
          <button
            type="button"
            onClick={onDeleteSelected}
            className="h-[30px] px-2.5 text-xs font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Delete selected purchases"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}

        <div className="h-4 w-[1px] bg-blue-200 mx-0.5" />

        {/* Clear selection */}
        <button
          type="button"
          onClick={onClearSelection}
          className="h-[30px] px-2 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 hover:bg-blue-100/50 rounded-lg transition-colors cursor-pointer"
          title="Clear Selection"
        >
          <X className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>
    </div>
  )
}
