import React, { useState, useEffect, useMemo } from 'react'
import { X, AlertCircle, AlertTriangle, CheckCircle2, CreditCard, Landmark, Wallet } from 'lucide-react'
import { purchaseService, type Purchase, type AddPurchasePaymentRequest } from '../../../../services/purchases'
import {
  simpleAccountsService,
  type BankAccountDropdown,
  type CashBookDropdown
} from '../../../../services/simpleAccounts'
import { useNotificationStore } from '../../../../store/useNotificationStore'
import { formatINR, toPaise, fromPaise } from './purchaseHelpers'

interface RecordPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  purchase?: Purchase | null
  purchases?: Purchase[] // For "Pay selected" bulk payment
  onSuccess: (updatedPurchases: Purchase[]) => void
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  purchase,
  purchases,
  onSuccess
}) => {
  const { showToast } = useNotificationStore()

  // Determine target purchases array
  const targetPurchases: Purchase[] = useMemo(() => {
    if (purchases && purchases.length > 0) return purchases
    if (purchase) return [purchase]
    return []
  }, [purchase, purchases])

  // Aggregate totals
  const { totalGross, totalPaid, totalBalance, vendorName } = useMemo(() => {
    let gPaise = 0
    let pPaise = 0
    let bPaise = 0
    let vName = 'General Vendor'

    for (const p of targetPurchases) {
      gPaise += toPaise(p.grandTotal)
      pPaise += toPaise(p.amountPaid)
      bPaise += toPaise(p.balanceAmount)
      if (p.vendorName) vName = p.vendorName
    }

    return {
      totalGross: fromPaise(gPaise),
      totalPaid: fromPaise(pPaise),
      totalBalance: fromPaise(bPaise),
      vendorName: vName
    }
  }, [targetPurchases])

  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10))
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

  // Initialize form state
  useEffect(() => {
    if (isOpen && targetPurchases.length > 0) {
      setAmount(totalBalance.toFixed(2))
      setPaymentDate(new Date().toISOString().slice(0, 10))
      setPaymentMethod('BankAccount')
      setReferenceNo('')
      setNotes('')
      setErrorMessage(null)
      fetchAccounts()
    }
  }, [isOpen, targetPurchases.length, totalBalance])

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

      if (bList.length > 0) setBankAccountId(bList[0].id)
      if (cList.length > 0) setCashBookId(cList[0].id)
    } finally {
      setLoadingAccounts(false)
    }
  }

  if (!isOpen || targetPurchases.length === 0) return null

  const numAmount = parseFloat(amount) || 0
  const balancePaise = toPaise(totalBalance)
  const enteredPaise = toPaise(numAmount)
  const remainingPaise = Math.max(0, balancePaise - enteredPaise)
  const balanceAfterPayment = fromPaise(remainingPaise)

  // Check account balance warning
  const selectedBankAccount = bankAccounts.find(b => b.id === bankAccountId)
  const selectedCashBook = cashBooks.find(c => c.id === cashBookId)
  const activeAccountBalance = paymentMethod === 'BankAccount'
    ? selectedBankAccount?.currentBalance
    : selectedCashBook?.currentBalance

  const showBalanceWarning = activeAccountBalance !== undefined && activeAccountBalance < numAmount

  const handlePayFullBalance = () => {
    setAmount(totalBalance.toFixed(2))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (numAmount <= 0) {
      setErrorMessage('Payment amount must be greater than zero.')
      return
    }

    if (enteredPaise > balancePaise) {
      setErrorMessage(`Payment amount cannot exceed outstanding balance of ${formatINR(totalBalance)}.`)
      return
    }

    setSubmitting(true)

    try {
      // Clean GUID IDs: Never send empty string for Nullable<Guid>
      const cleanBankAccountId = paymentMethod === 'BankAccount' && bankAccountId ? bankAccountId : undefined
      const cleanCashBookId = paymentMethod === 'Cash' && cashBookId ? cashBookId : undefined

      // Allocate payments across target purchases oldest-first
      // Sort oldest-first by purchaseDate
      const sorted = [...targetPurchases].sort(
        (a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
      )

      let remainingAllocPaise = enteredPaise
      const updatedList: Purchase[] = []
      let successCount = 0
      let failureCount = 0

      for (const p of sorted) {
        if (remainingAllocPaise <= 0) break

        const pBalPaise = toPaise(p.balanceAmount)
        const payForThisPaise = Math.min(pBalPaise, remainingAllocPaise)
        const payForThis = fromPaise(payForThisPaise)

        if (payForThis > 0) {
          const payload: AddPurchasePaymentRequest = {
            paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
            paymentMethod,
            amount: payForThis,
            bankAccountId: cleanBankAccountId,
            cashBookId: cleanCashBookId,
            referenceNo: referenceNo.trim() || undefined,
            notes: notes.trim() || undefined
          }

          try {
            const updated = await purchaseService.addPayment(p.id, payload)
            if (updated) {
              updatedList.push(updated)
              successCount++
            }
          } catch (err: any) {
            failureCount++
            console.error(`Failed payment for purchase ${p.purchaseNo}`, err)
          }

          remainingAllocPaise -= payForThisPaise
        }
      }

      if (failureCount > 0 && successCount === 0) {
        setErrorMessage('Failed to record payment. Please try again.')
        setSubmitting(false)
        return
      }

      if (failureCount > 0) {
        showToast(`Recorded payment on ${successCount} purchases, but ${failureCount} failed`, 'warning')
      } else {
        showToast(`Payment of ${formatINR(numAmount)} recorded successfully`, 'success')
      }

      onSuccess(updatedList)
      onClose()
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred while recording payment.')
    } finally {
      setSubmitting(false)
    }
  }

  const isBulk = targetPurchases.length > 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E9F2] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {isBulk ? `Record Payment — ${targetPurchases.length} Purchases` : `Record Payment — #${targetPurchases[0].purchaseNo}`}
              </h3>
              <p className="text-[11px] text-slate-500">
                {vendorName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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

          {/* Reference & Balance Summary Block */}
          <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E5E9F2] grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Gross Total</span>
              <span className="font-mono font-semibold text-slate-800 block mt-0.5">{formatINR(totalGross)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Paid</span>
              <span className="font-mono font-semibold text-slate-800 block mt-0.5">{formatINR(totalPaid)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Outstanding</span>
              <span className="font-mono font-bold text-rose-600 block mt-0.5">{formatINR(totalBalance)}</span>
            </div>
          </div>

          {/* Amount Field + Shortcut */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-800">
                Payment Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handlePayFullBalance}
                className="text-[11px] text-[#1A56DB] hover:underline font-semibold cursor-pointer"
              >
                Pay full balance ({formatINR(totalBalance)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={totalBalance}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-[38px] pl-8 pr-3 text-sm font-mono font-bold text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] bg-white"
                required
              />
            </div>
            {/* Live Preview: Balance after payment */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
              <span>Balance after payment:</span>
              <span className={`font-mono font-bold ${balanceAfterPayment > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatINR(balanceAfterPayment)}
              </span>
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
              {paymentMethod === 'BankAccount' ? 'Bank Account' : 'Cash Book'}
            </label>
            {paymentMethod === 'BankAccount' ? (
              <select
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
                disabled={loadingAccounts}
                className="w-full h-[36px] px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] bg-white text-slate-800"
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
              >
                <option value="">-- Choose Cash Book --</option>
                {cashBooks.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Bal: {formatINR(c.currentBalance)})
                  </option>
                ))}
              </select>
            )}

            {/* Inline warning if account balance < payment amount */}
            {showBalanceWarning && (
              <div className="mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-1.5 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Warning: Selected account balance ({formatINR(activeAccountBalance || 0)}) is lower than payment amount ({formatINR(numAmount)}).
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
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="Optional remarks"
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
              disabled={submitting || numAmount <= 0}
              className="h-[36px] px-4 text-xs font-semibold text-white bg-[#1A56DB] hover:bg-[#1746B3] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Recording...
                </>
              ) : (
                'Confirm Payment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
