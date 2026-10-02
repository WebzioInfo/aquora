import React, { useState, useMemo } from 'react'
import { X, AlertCircle, AlertTriangle, Loader2, Info } from 'lucide-react'
import type { MonthlySalaryDirectory } from '../../../../services/payroll'
import { payrollService } from '../../../../services/payroll'
import type { BankAccountDropdown, CashBookDropdown } from '../../../../services/simpleAccounts'
import { formatINR } from './payrollHelpers'

interface BulkSettleModalProps {
  isOpen: boolean
  onClose: () => void
  records: MonthlySalaryDirectory[]
  bankAccounts: BankAccountDropdown[]
  cashBooks: CashBookDropdown[]
  onSuccess: (failedIds: string[], skippedCount: number) => void
}

export const BulkSettleModal: React.FC<BulkSettleModalProps> = ({
  isOpen,
  onClose,
  records,
  bankAccounts,
  cashBooks,
  onSuccess
}) => {
  // Filter eligible records (exclude finalized and balance <= 0.01)
  const { eligibleRecords, skippedCount } = useMemo(() => {
    const eligible: MonthlySalaryDirectory[] = []
    let skipped = 0
    for (const r of records) {
      const isLocked = Boolean(r.isFinalized)
      const isZeroBalance = Number(r.remainingBalance || 0) <= 0.01
      if (isLocked || isZeroBalance) {
        skipped++
      } else {
        eligible.push(r)
      }
    }
    return { eligibleRecords: eligible, skippedCount: skipped }
  }, [records])

  // Amounts map: recordId -> amount to pay
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<'BankAccount' | 'CashBook'>('BankAccount')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [cashBookId, setCashBookId] = useState<string>('')

  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Initialize amounts map
  React.useEffect(() => {
    if (isOpen) {
      const map: Record<string, number> = {}
      for (const r of eligibleRecords) {
        map[r.id] = Number(r.remainingBalance || 0)
      }
      setAmounts(map)
      setPaymentDate(new Date().toISOString().slice(0, 10))
      setPaymentMethod('BankAccount')
      if (bankAccounts.length > 0) setBankAccountId(bankAccounts[0].id)
      if (cashBooks.length > 0) setCashBookId(cashBooks[0].id)
      setIsProcessing(false)
      setProgress(null)
      setErrorBanner(null)
    }
  }, [isOpen, eligibleRecords, bankAccounts, cashBooks])

  const totalAmountToPay = useMemo(() => {
    return Object.values(amounts).reduce((acc, curr) => acc + (Number(curr) || 0), 0)
  }, [amounts])

  const handleAmountChange = (id: string, val: string, maxBal: number) => {
    const num = parseFloat(val)
    if (isNaN(num)) {
      setAmounts(prev => ({ ...prev, [id]: 0 }))
    } else {
      setAmounts(prev => ({ ...prev, [id]: Math.min(maxBal, Math.max(0, num)) }))
    }
  }

  // Account balance warning
  const selectedAccountBalance = useMemo(() => {
    if (paymentMethod === 'BankAccount') {
      const b = bankAccounts.find(x => x.id === bankAccountId)
      return b?.currentBalance ?? null
    } else {
      const c = cashBooks.find(x => x.id === cashBookId)
      return c?.currentBalance ?? null
    }
  }, [paymentMethod, bankAccountId, cashBookId, bankAccounts, cashBooks])

  const isLowAccountBalance =
    selectedAccountBalance !== null &&
    totalAmountToPay > 0 &&
    selectedAccountBalance < totalAmountToPay

  const handleProcessBulk = async () => {
    if (isProcessing) return
    setErrorBanner(null)

    if (totalAmountToPay <= 0) {
      setErrorBanner('Total payment amount must be greater than zero.')
      return
    }

    try {
      setIsProcessing(true)
      const total = eligibleRecords.length
      const failedIds: string[] = []

      for (let i = 0; i < total; i++) {
        const item = eligibleRecords[i]
        const amt = amounts[item.id] || 0
        setProgress({ current: i + 1, total })

        if (amt <= 0.01) {
          continue
        }

        try {
          await payrollService.processSalaryPayment({
            monthlySalaryId: item.id,
            paymentType: 'Salary Settlement',
            amount: amt,
            paymentMethod,
            bankAccountId: paymentMethod === 'BankAccount' ? bankAccountId : undefined,
            cashBookId: paymentMethod === 'CashBook' ? cashBookId : undefined,
            workingDays: item.workingDays || 30,
            daysWorked: item.daysWorked ?? item.workingDays ?? 30,
            paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined
          })
        } catch {
          failedIds.push(item.id)
        }
      }

      onSuccess(failedIds, skippedCount)
      onClose()
    } catch (err: any) {
      setErrorBanner(err.message || 'An error occurred during bulk settlement.')
    } finally {
      setIsProcessing(false)
      setProgress(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden select-none">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-[620px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] animate-in fade-in zoom-in-95 duration-150 z-10">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Settle Selected Employees</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pay outstanding balance for {eligibleRecords.length} selected employee(s)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 text-xs">
          {errorBanner && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* Skipped Info Banner */}
          {skippedCount > 0 && (
            <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-[11px] flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>
                {skippedCount} selected record(s) skipped (locked or paid in full).
              </span>
            </div>
          )}

          {/* Progress Banner */}
          {progress && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
              <div className="flex justify-between text-blue-900 font-semibold text-xs">
                <span>Processing settlements...</span>
                <span>
                  {progress.current} of {progress.total}
                </span>
              </div>
              <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1A56DB] transition-all duration-200"
                  style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Payment Account and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Paid Via</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BankAccount')}
                  disabled={isProcessing}
                  className={`flex-1 h-[32px] rounded-lg text-xs font-medium border ${
                    paymentMethod === 'BankAccount'
                      ? 'bg-blue-50 border-[#1A56DB] text-[#1A56DB] font-semibold'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Bank
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CashBook')}
                  disabled={isProcessing}
                  className={`flex-1 h-[32px] rounded-lg text-xs font-medium border ${
                    paymentMethod === 'CashBook'
                      ? 'bg-blue-50 border-[#1A56DB] text-[#1A56DB] font-semibold'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Cash
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {paymentMethod === 'BankAccount' ? 'Bank Account' : 'Cash Book'}
              </label>
              {paymentMethod === 'BankAccount' ? (
                <select
                  value={bankAccountId}
                  onChange={e => setBankAccountId(e.target.value)}
                  disabled={isProcessing}
                  className="w-full h-[32px] px-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB]"
                >
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} (Bal: {formatINR(b.currentBalance)})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={cashBookId}
                  onChange={e => setCashBookId(e.target.value)}
                  disabled={isProcessing}
                  className="w-full h-[32px] px-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB]"
                >
                  {cashBooks.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Bal: {formatINR(c.currentBalance)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                disabled={isProcessing}
                className="w-full h-[32px] px-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>

          {/* Account Balance Warning */}
          {isLowAccountBalance && (
            <div className="p-2 rounded-md bg-amber-50 border border-amber-200 flex items-center gap-1.5 text-[11px] text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                Warning: Total payment exceeds selected account balance ({formatINR(selectedAccountBalance)}).
              </span>
            </div>
          )}

          {/* Employee list with editable amounts */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <span>Employee & Month</span>
              <span>Amount to Settle</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {eligibleRecords.map(r => {
                const bal = Number(r.remainingBalance || 0)
                const currentVal = amounts[r.id] ?? bal
                return (
                  <div key={r.id} className="p-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {r.employeeName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {r.salaryMonth} · Due: <span className="font-mono text-rose-600">{formatINR(bal)}</span>
                      </div>
                    </div>
                    <div className="relative w-32 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₹</span>
                      <input
                        type="number"
                        min="0"
                        max={bal}
                        step="0.01"
                        value={currentVal}
                        disabled={isProcessing}
                        onChange={e => handleAmountChange(r.id, e.target.value, bal)}
                        className="w-full h-[30px] pl-6 pr-2 bg-white border border-slate-300 rounded-lg text-right font-mono font-medium focus:outline-none focus:border-[#1A56DB]"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2.5 shrink-0">
          <div className="text-xs">
            <span className="text-slate-500">Total Settlement: </span>
            <span className="font-mono font-bold text-slate-900 text-sm">{formatINR(totalAmountToPay)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="h-[34px] px-3.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProcessBulk}
              disabled={isProcessing || totalAmountToPay <= 0}
              className="h-[34px] px-4 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium rounded-lg text-xs shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Pay {formatINR(totalAmountToPay)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BulkSettleModal
