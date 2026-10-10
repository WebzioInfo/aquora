import React, { useState, useEffect, useMemo } from 'react'
import { X, AlertCircle, AlertTriangle, Landmark, Wallet, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react'
import {
  purchaseService,
  type Purchase,
  type PurchasePayment,
  type UpdatePurchasePaymentRequest
} from '../../../../services/purchases'
import {
  simpleAccountsService,
  type BankAccountDropdown,
  type CashBookDropdown
} from '../../../../services/simpleAccounts'
import { useNotificationStore } from '../../../../store/useNotificationStore'
import { formatINR, toPaise, fromPaise } from './purchaseHelpers'

interface EditPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  purchase: Purchase
  payment: PurchasePayment
  onSuccess: (updatedPurchase: Purchase) => void
}

export const EditPaymentModal: React.FC<EditPaymentModalProps> = ({
  isOpen,
  onClose,
  purchase,
  payment,
  onSuccess
}) => {
  const { showToast } = useNotificationStore()

  const [paymentDate, setPaymentDate] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'BankAccount' | 'Cash'>('BankAccount')
  const [amount, setAmount] = useState<string>('')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [cashBookId, setCashBookId] = useState<string>('')
  const [referenceNo, setReferenceNo] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const [bankAccounts, setBankAccounts] = useState<BankAccountDropdown[]>([])
  const [cashBooks, setCashBooks] = useState<CashBookDropdown[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false)

  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Max allowed payment for this purchase:
  // GrandTotal minus (AmountPaid - this payment's original amount)
  const maxAllowedAmount = useMemo(() => {
    const grossPaise = toPaise(purchase.grandTotal)
    const otherPaidPaise = toPaise(purchase.amountPaid) - toPaise(payment.amount)
    return fromPaise(Math.max(0, grossPaise - otherPaidPaise))
  }, [purchase.grandTotal, purchase.amountPaid, payment.amount])

  useEffect(() => {
    if (isOpen && payment) {
      const dateStr = payment.paymentDate
        ? new Date(payment.paymentDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
      setPaymentDate(dateStr)
      setPaymentMethod(
        payment.paymentMethod?.toLowerCase().includes('cash') || !!payment.cashBookId
          ? 'Cash'
          : 'BankAccount'
      )
      setAmount(payment.amount.toFixed(2))
      setBankAccountId(payment.bankAccountId || '')
      setCashBookId(payment.cashBookId || '')
      setReferenceNo(payment.referenceNo || '')
      setNotes(payment.notes || '')
      setErrorMessage(null)
      fetchAccounts()
    }
  }, [isOpen, payment])

  const fetchAccounts = async () => {
    setLoadingAccounts(true)
    try {
      const [banks, cash] = await Promise.all([
        simpleAccountsService.getBankAccountDropdown().catch(() => []),
        simpleAccountsService.getCashBookDropdown().catch(() => [])
      ])
      const bList = Array.isArray(banks) ? banks : []
      const cList = Array.isArray(cash) ? cash : []
      setBankAccounts(bList)
      setCashBooks(cList)

      // Fallback selection if current IDs are missing
      if (!payment.bankAccountId && bList.length > 0) {
        setBankAccountId(bList[0].id)
      }
      if (!payment.cashBookId && cList.length > 0) {
        setCashBookId(cList[0].id)
      }
    } finally {
      setLoadingAccounts(false)
    }
  }

  if (!isOpen) return null

  const oldAmount = payment.amount
  const newAmount = parseFloat(amount) || 0
  const amountDelta = newAmount - oldAmount

  // Projected new purchase values
  const oldAmountPaidPaise = toPaise(purchase.amountPaid)
  const newAmountPaidPaise = oldAmountPaidPaise + toPaise(amountDelta)
  const newAmountPaid = fromPaise(newAmountPaidPaise)
  const newBalanceAmount = fromPaise(toPaise(purchase.grandTotal) - newAmountPaidPaise)

  // Account labels
  const oldAccountName =
    payment.bankAccountName ||
    payment.cashBookName ||
    (payment.paymentMethod === 'Cash' ? 'Cash' : 'Bank Account')

  const selectedBankAccount = bankAccounts.find(b => b.id === bankAccountId)
  const selectedCashBook = cashBooks.find(c => c.id === cashBookId)
  const newAccountName =
    paymentMethod === 'BankAccount'
      ? selectedBankAccount?.accountName || 'Bank Account'
      : selectedCashBook?.name || 'Cash Book'

  const activeAccountBalance =
    paymentMethod === 'BankAccount'
      ? selectedBankAccount?.currentBalance
      : selectedCashBook?.currentBalance

  // Account switch check
  const isAccountChanged =
    (paymentMethod === 'BankAccount' && payment.bankAccountId !== bankAccountId) ||
    (paymentMethod === 'Cash' && payment.cashBookId !== cashBookId) ||
    (paymentMethod === 'Cash' && !payment.cashBookId) ||
    (paymentMethod === 'BankAccount' && !payment.bankAccountId)

  const showBalanceWarning =
    activeAccountBalance !== undefined &&
    newAmount > 0 &&
    (isAccountChanged
      ? activeAccountBalance < newAmount
      : amountDelta > 0 && activeAccountBalance < amountDelta)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (newAmount <= 0) {
      setErrorMessage('Payment amount must be greater than zero.')
      return
    }

    if (newAmount > maxAllowedAmount) {
      setErrorMessage(
        `Payment amount cannot exceed ${formatINR(maxAllowedAmount)} (Purchase Grand Total is ${formatINR(purchase.grandTotal)}).`
      )
      return
    }

    if (paymentMethod === 'BankAccount' && !bankAccountId) {
      setErrorMessage('Please select a valid Bank Account.')
      return
    }

    if (paymentMethod === 'Cash' && !cashBookId) {
      setErrorMessage('Please select a valid Cash Book.')
      return
    }

    setSubmitting(true)

    try {
      const payload: UpdatePurchasePaymentRequest = {
        paymentDate,
        paymentMethod: paymentMethod === 'BankAccount' ? 'BankAccount' : 'Cash',
        bankAccountId: paymentMethod === 'BankAccount' ? bankAccountId : undefined,
        cashBookId: paymentMethod === 'Cash' ? cashBookId : undefined,
        amount: newAmount,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined
      }

      const updated = await purchaseService.updatePayment(purchase.id, payment.id, payload)
      showToast(`Payment updated successfully to ${formatINR(newAmount)}`, 'success')
      onSuccess(updated)
      onClose()
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update payment. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E9F2] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1A56DB] flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Edit Payment — #{purchase.purchaseNo}
              </h3>
              <p className="text-[11px] text-slate-500">
                {purchase.vendorName || 'General Vendor'} · Original: {formatINR(oldAmount)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Context & Financial Delta Banner */}
          <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-600">Financial Impact Preview</span>
              <span className="font-mono text-[10px] text-slate-400">Ledger Recalculation</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Paid</span>
                <div className="flex items-center gap-1 mt-0.5 font-mono">
                  <span className="text-slate-500 line-through">{formatINR(purchase.amountPaid)}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="font-bold text-slate-900">{formatINR(newAmountPaid)}</span>
                </div>
              </div>

              <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Outstanding Balance</span>
                <div className="flex items-center gap-1 mt-0.5 font-mono">
                  <span className="text-slate-500 line-through">{formatINR(purchase.balanceAmount)}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className={`font-bold ${newBalanceAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatINR(newBalanceAmount)}
                  </span>
                </div>
              </div>
            </div>

            {amountDelta !== 0 && (
              <p className="text-[11px] text-blue-900 font-medium">
                {amountDelta > 0 ? (
                  <>
                    Payment increases by <span className="font-mono font-bold">{formatINR(amountDelta)}</span>. Purchase outstanding balance will decrease and account balance will be debited further.
                  </>
                ) : (
                  <>
                    Payment decreases by <span className="font-mono font-bold">{formatINR(Math.abs(amountDelta))}</span>. Purchase outstanding balance will increase and account balance will be restored by <span className="font-mono font-bold">{formatINR(Math.abs(amountDelta))}</span>.
                  </>
                )}
              </p>
            )}

            {isAccountChanged && (
              <div className="text-[11px] text-amber-900 font-medium bg-amber-50/80 border border-amber-200/80 rounded-lg p-2 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Account changed: Original effect on <span className="font-semibold">{oldAccountName}</span> will be reversed, and the revised transaction will be posted to <span className="font-semibold">{newAccountName}</span>.
                </span>
              </div>
            )}
          </div>

          {/* Amount Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-800">
                Payment Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setAmount(maxAllowedAmount.toFixed(2))}
                className="text-[11px] text-[#1A56DB] hover:underline font-semibold cursor-pointer"
              >
                Max allowed ({formatINR(maxAllowedAmount)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={maxAllowedAmount}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-[38px] pl-8 pr-3 text-sm font-mono font-bold text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] bg-white"
                required
              />
            </div>
          </div>

          {/* Date & Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-800 block mb-1">
                Payment Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full h-[36px] px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] bg-white text-slate-800"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-slate-800 block mb-1">
                Payment Method <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BankAccount')}
                  className={`h-[36px] text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    paymentMethod === 'BankAccount'
                      ? 'bg-blue-50 border-[#1A56DB] text-[#1A56DB]'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5" />
                  Bank
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={`h-[36px] text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    paymentMethod === 'Cash'
                      ? 'bg-amber-50 border-amber-500 text-amber-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Cash
                </button>
              </div>
            </div>
          </div>

          {/* Account Selector */}
          <div>
            <label className="font-semibold text-slate-800 block mb-1">
              {paymentMethod === 'BankAccount' ? 'Bank Account' : 'Cash Book'} <span className="text-rose-500">*</span>
            </label>
            {paymentMethod === 'BankAccount' ? (
              <select
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
                disabled={loadingAccounts}
                className="w-full h-[36px] px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] bg-white text-slate-800"
                required
              >
                <option value="">-- Choose Bank Account --</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountName} (Bal: {formatINR(b.currentBalance)})
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={cashBookId}
                onChange={e => setCashBookId(e.target.value)}
                disabled={loadingAccounts}
                className="w-full h-[36px] px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] bg-white text-slate-800"
                required
              >
                <option value="">-- Choose Cash Book --</option>
                {cashBooks.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Bal: {formatINR(c.currentBalance)})
                  </option>
                ))}
              </select>
            )}

            {showBalanceWarning && (
              <div className="mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-1.5 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Warning: Selected account balance ({formatINR(activeAccountBalance || 0)}) is lower than payment adjustment.
                </span>
              </div>
            )}
          </div>

          {/* Reference / UTR */}
          <div>
            <label className="font-semibold text-slate-800 block mb-1">
              Reference / UTR / Cheque No (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UTR-98827138"
              value={referenceNo}
              onChange={e => setReferenceNo(e.target.value)}
              className="w-full h-[36px] px-2.5 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] bg-white text-slate-800"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="font-semibold text-slate-800 block mb-1">
              Notes / Correction Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Corrected payment amount"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full h-[36px] px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] bg-white text-slate-800"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#E5E9F2] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-[36px] px-3.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || newAmount <= 0}
              className="h-[36px] px-4 text-xs font-semibold text-white bg-[#1A56DB] hover:bg-[#1746B3] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
