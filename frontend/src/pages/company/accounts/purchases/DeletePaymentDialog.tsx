import React, { useState } from 'react'
import { AlertTriangle, Trash2, X, ArrowRight, Building2, Calendar, CreditCard } from 'lucide-react'
import {
  purchaseService,
  type Purchase,
  type PurchasePayment
} from '../../../../services/purchases'
import { useNotificationStore } from '../../../../store/useNotificationStore'
import { formatINR, toPaise, fromPaise } from './purchaseHelpers'

interface DeletePaymentDialogProps {
  isOpen: boolean
  onClose: () => void
  purchase: Purchase
  payment: PurchasePayment
  onSuccess: (updatedPurchase: Purchase) => void
}

export const DeletePaymentDialog: React.FC<DeletePaymentDialogProps> = ({
  isOpen,
  onClose,
  purchase,
  payment,
  onSuccess
}) => {
  const { showToast } = useNotificationStore()
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const paymentAmountPaise = toPaise(payment.amount)
  const currentPaidPaise = toPaise(purchase.amountPaid)
  const currentBalancePaise = toPaise(purchase.balanceAmount)

  const projectedPaidPaise = Math.max(0, currentPaidPaise - paymentAmountPaise)
  const projectedBalancePaise = currentBalancePaise + paymentAmountPaise

  const projectedPaid = fromPaise(projectedPaidPaise)
  const projectedBalance = fromPaise(projectedBalancePaise)

  const accountName =
    payment.bankAccountName ||
    payment.cashBookName ||
    (payment.paymentMethod === 'Cash' ? 'Cash Book' : 'Bank Account')

  const dateStr = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : 'Unknown Date'

  const handleDelete = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const updated = await purchaseService.deletePayment(purchase.id, payment.id)
      showToast(`Payment of ${formatINR(payment.amount)} deleted and reversed successfully`, 'success')
      onSuccess(updated)
      onClose()
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete payment. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Delete Purchase Payment
              </h3>
              <p className="text-[11px] text-slate-500">
                Purchase #{purchase.purchaseNo}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <p className="text-slate-700 leading-relaxed">
            Are you sure you want to delete this payment of{' '}
            <strong className="text-slate-900 font-mono font-bold">
              {formatINR(payment.amount)}
            </strong>{' '}
            from <strong className="text-slate-900">{accountName}</strong> for purchase{' '}
            <strong className="text-slate-900">#{purchase.purchaseNo}</strong>?
          </p>

          {/* Payment Details Card */}
          <div className="bg-[#F8FAFC] border border-[#E5E9F2] rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">Vendor</span>
              <span className="font-semibold text-slate-900">{purchase.vendorName || 'General Vendor'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">Payment Date</span>
              <span className="font-mono text-slate-800">{dateStr}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">Method / Account</span>
              <span className="font-semibold text-slate-800">{payment.paymentMethod} · {accountName}</span>
            </div>
            {payment.referenceNo && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Reference No</span>
                <span className="font-mono text-slate-700">{payment.referenceNo}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-700 uppercase">Amount Being Removed</span>
              <span className="font-mono font-bold text-rose-600 text-sm">
                - {formatINR(payment.amount)}
              </span>
            </div>
          </div>

          {/* Financial Impact Box */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2 text-[11px] text-amber-950">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Expected Financial Impact</span>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-amber-200/60">
                <span className="text-slate-600">Purchase Outstanding Balance</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-slate-500">{formatINR(purchase.balanceAmount)}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="font-bold text-rose-600">+{formatINR(projectedBalance)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-amber-200/60">
                <span className="text-slate-600">Total Recorded Payments</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-slate-500">{formatINR(purchase.amountPaid)}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="font-bold text-slate-800">{formatINR(projectedPaid)}</span>
                </div>
              </div>
            </div>

            <p className="pt-1 text-[10.5px] text-amber-800 leading-normal">
              Deleting this record will reverse the financial debit from{' '}
              <strong className="font-semibold text-amber-950">{accountName}</strong>, restore the vendor payable balance, and update the purchase payment status.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-[#E5E9F2] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-[36px] px-3.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="h-[36px] px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting & Reversing...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Confirm Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
