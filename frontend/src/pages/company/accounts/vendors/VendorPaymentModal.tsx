import React, { useState, useEffect, useMemo } from 'react'
import { X, AlertCircle, AlertTriangle, CheckCircle2, Landmark, Wallet, DollarSign } from 'lucide-react'
import { vendorService, type Vendor, type RecordVendorPaymentRequest } from '../../../../services/vendors'
import {
  simpleAccountsService,
  type BankAccountDropdown,
  type CashBookDropdown
} from '../../../../services/simpleAccounts'
import { useNotificationStore } from '../../../../store/useNotificationStore'
import { formatINR, toPaise, fromPaise } from './vendorHelpers'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'

interface VendorPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  vendor: Vendor | null
  onSuccess: (updatedVendor: Vendor) => void
}

export const VendorPaymentModal: React.FC<VendorPaymentModalProps> = ({
  isOpen,
  onClose,
  vendor,
  onSuccess
}) => {
  const { showToast } = useNotificationStore()

  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<'BankAccount' | 'Cash'>('BankAccount')
  const [amount, setAmount] = useState<string>('')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [cashBookId, setCashBookId] = useState<string>('')
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const [bankAccounts, setBankAccounts] = useState<BankAccountDropdown[]>([])
  const [cashBooks, setCashBooks] = useState<CashBookDropdown[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false)

  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const outstandingBalance = vendor?.currentBalance || 0

  useEffect(() => {
    if (isOpen && vendor) {
      setAmount(outstandingBalance > 0 ? outstandingBalance.toFixed(2) : '0.00')
      setPaymentDate(new Date().toISOString().slice(0, 10))
      setPaymentMethod('BankAccount')
      setReferenceNumber('')
      setNotes('')
      setErrorMessage(null)
      fetchAccounts()
    }
  }, [isOpen, vendor, outstandingBalance])

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

  // Selected account and balance warning
  const selectedAccountBalance = useMemo(() => {
    if (paymentMethod === 'BankAccount') {
      const acc = bankAccounts.find(b => b.id === bankAccountId)
      return acc?.currentBalance !== undefined ? acc.currentBalance : null
    } else {
      const acc = cashBooks.find(c => c.id === cashBookId)
      return acc?.currentBalance !== undefined ? acc.currentBalance : null
    }
  }, [paymentMethod, bankAccountId, cashBookId, bankAccounts, cashBooks])

  const enteredAmount = parseFloat(amount) || 0
  const balanceAfterPayment = Math.max(0, outstandingBalance - enteredAmount)

  const isLowAccountBalance =
    selectedAccountBalance !== null &&
    enteredAmount > 0 &&
    enteredAmount > selectedAccountBalance

  // Validation
  const isValidAmount = enteredAmount > 0 && enteredAmount <= outstandingBalance

  const handlePayFullBalance = () => {
    setAmount(outstandingBalance.toFixed(2))
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendor) return

    if (!isValidAmount) {
      setErrorMessage(`Please enter a valid amount between ₹0.01 and ₹${outstandingBalance.toFixed(2)}.`)
      return
    }

    if (paymentMethod === 'BankAccount' && !bankAccountId) {
      setErrorMessage('Please select a company bank account.')
      return
    }

    if (paymentMethod === 'Cash' && !cashBookId) {
      setErrorMessage('Please select a company cash register.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const payload: RecordVendorPaymentRequest = {
        amount: enteredAmount,
        paymentDate: new Date(paymentDate).toISOString(),
        paymentMethod,
        bankAccountId: paymentMethod === 'BankAccount' ? bankAccountId : undefined,
        cashBookId: paymentMethod === 'Cash' ? cashBookId : undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined
      }

      const updatedVendor = await vendorService.recordPayment(vendor.id, payload)
      showToast(`Payment of ₹${enteredAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} recorded successfully.`, 'success')
      onSuccess(updatedVendor)
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to record payment.'
      setErrorMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !vendor) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none">
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Record Vendor Payment</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pay creditor balance for <span className="font-semibold text-slate-800">{vendor.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Outstanding Balance Banner */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">
                Current Outstanding Balance
              </span>
              <span className="text-lg font-bold font-mono text-rose-600">
                {formatINR(outstandingBalance)}
              </span>
            </div>
            <button
              type="button"
              onClick={handlePayFullBalance}
              className="text-xs font-semibold text-[#1A56DB] hover:underline cursor-pointer bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/60"
            >
              Pay full balance
            </button>
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Payment Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={outstandingBalance}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-[36px] pl-7 pr-3 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-semibold focus:outline-none focus:border-[#1A56DB]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Payment Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1A56DB]"
                required
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('BankAccount')}
                className={`h-[36px] px-3 rounded-lg border font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  paymentMethod === 'BankAccount'
                    ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Landmark className="w-4 h-4" />
                <span>Bank Account</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Cash')}
                className={`h-[36px] px-3 rounded-lg border font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  paymentMethod === 'Cash'
                    ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Cash Book</span>
              </button>
            </div>
          </div>

          {/* Account Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {paymentMethod === 'BankAccount' ? 'Company Bank Account' : 'Company Cash Register'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            {paymentMethod === 'BankAccount' ? (
              <select
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
                disabled={loadingAccounts || bankAccounts.length === 0}
                className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB]"
                required
              >
                {bankAccounts.length === 0 && <option value="">No bank accounts available</option>}
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bankName || b.accountName} - {b.accountNumber} (Bal: ₹{Number(b.currentBalance || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={cashBookId}
                onChange={e => setCashBookId(e.target.value)}
                disabled={loadingAccounts || cashBooks.length === 0}
                className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB]"
                required
              >
                {cashBooks.length === 0 && <option value="">No cash registers available</option>}
                {cashBooks.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Bal: ₹{Number(c.currentBalance || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            )}

            {/* Low Balance Warning */}
            {isLowAccountBalance && (
              <div className="mt-1.5 p-2 rounded-md bg-amber-50 border border-amber-200 flex items-center gap-1.5 text-[11px] text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Warning: Payment amount exceeds selected account balance (₹{selectedAccountBalance?.toLocaleString('en-IN')}).
                </span>
              </div>
            )}
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reference / Cheque No <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                placeholder="e.g. UTR / CHQ-1049"
                className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Notes / Remarks <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Remarks about payment"
                className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>

          {/* Balance Preview */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Balance After Payment:</span>
            <span className={`font-mono font-bold ${balanceAfterPayment === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
              {formatINR(balanceAfterPayment)}
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <EnterpriseButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="!h-[32px] text-xs font-semibold"
            >
              Cancel
            </EnterpriseButton>

            <EnterpriseButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting || !isValidAmount}
              className="!h-[32px] text-xs font-semibold shadow-xs"
            >
              {submitting ? 'Recording...' : `Record Payment (${formatINR(enteredAmount)})`}
            </EnterpriseButton>
          </div>
        </form>
      </div>
    </div>
  )
}

export default VendorPaymentModal
