import React from 'react'
import { AlertTriangle, Trash2, XCircle } from 'lucide-react'
import type { Purchase } from '../../../../services/purchases'
import { formatINR, toPaise, fromPaise } from './purchaseHelpers'

interface CancelDialogProps {
  isOpen: boolean
  purchases: Purchase[]
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

export const PurchaseCancelDialog: React.FC<CancelDialogProps> = ({
  isOpen,
  purchases,
  onClose,
  onConfirm,
  loading = false
}) => {
  if (!isOpen || purchases.length === 0) return null

  const isBulk = purchases.length > 1

  let totalGrossPaise = 0
  let totalBalancePaise = 0
  for (const p of purchases) {
    totalGrossPaise += toPaise(p.grandTotal)
    totalBalancePaise += toPaise(p.balanceAmount)
  }
  const grossTotal = fromPaise(totalGrossPaise)
  const balanceTotal = fromPaise(totalBalancePaise)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 space-y-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <XCircle className="w-5 h-5" />
          </div>

          <div className="text-center space-y-1">
            <h3 className="font-bold text-base text-slate-900">
              {isBulk ? `Cancel ${purchases.length} Purchases?` : `Cancel Purchase #${purchases[0].purchaseNo}?`}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isBulk ? (
                <>
                  Are you sure you want to cancel <strong>{purchases.length} purchases</strong> totaling Gross <strong>{formatINR(grossTotal)}</strong> (Balance <strong>{formatINR(balanceTotal)}</strong>)?
                </>
              ) : (
                <>
                  Are you sure you want to cancel purchase <strong>{purchases[0].purchaseNo}</strong>?
                </>
              )}
            </p>
            <p className="text-xs text-amber-800 font-semibold mt-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-left">
              This will reverse inventory stock and vendor balances.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-[36px] px-4 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="h-[36px] px-4 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface DeleteDialogProps {
  isOpen: boolean
  purchases: Purchase[]
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

export const PurchaseDeleteDialog: React.FC<DeleteDialogProps> = ({
  isOpen,
  purchases,
  onClose,
  onConfirm,
  loading = false
}) => {
  if (!isOpen || purchases.length === 0) return null

  const isBulk = purchases.length > 1

  let totalGrossPaise = 0
  for (const p of purchases) {
    totalGrossPaise += toPaise(p.grandTotal)
  }
  const grossTotal = fromPaise(totalGrossPaise)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 space-y-4">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Trash2 className="w-5 h-5" />
          </div>

          <div className="text-center space-y-1">
            <h3 className="font-bold text-base text-slate-900">
              {isBulk ? `Soft-Delete ${purchases.length} Purchases?` : `Soft-Delete Purchase #${purchases[0].purchaseNo}?`}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isBulk ? (
                <>
                  Are you sure you want to soft-delete <strong>{purchases.length} purchases</strong> totaling Gross <strong>{formatINR(grossTotal)}</strong>?
                </>
              ) : (
                <>
                  Are you sure you want to soft-delete purchase <strong>{purchases[0].purchaseNo}</strong>?
                </>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              This action will remove the record from active procurement registers.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-[36px] px-4 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="h-[36px] px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                'Confirm Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
