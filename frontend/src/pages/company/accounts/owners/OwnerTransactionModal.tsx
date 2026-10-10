import React, { useState, useEffect, useRef, useMemo } from 'react'
import { X, ArrowRight, AlertCircle, AlertTriangle, Loader2, ArrowLeftRight, Landmark, Wallet } from 'lucide-react'
import type { Owner, BankAccountDropdown, CashBookDropdown, CreateOwnerTransactionRequest } from '../../../../services/simpleAccounts'
import { formatINR, getOwnerTransactionTotals } from './ownerHelpers'

interface OwnerTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  owners: Owner[]
  prefilledOwner?: Owner | null
  bankAccounts?: BankAccountDropdown[]
  cashBooks?: CashBookDropdown[]
  onSubmit: (ownerId: string, req: CreateOwnerTransactionRequest) => Promise<void>
}

export const OwnerTransactionModal: React.FC<OwnerTransactionModalProps> = ({
  isOpen,
  onClose,
  owners,
  prefilledOwner = null,
  bankAccounts = [],
  cashBooks = [],
  onSubmit
}) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const amountInputRef = useRef<HTMLInputElement>(null)

  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(prefilledOwner?.id || owners[0]?.id || '')
  const [transactionType, setTransactionType] = useState<'Investment' | 'Withdrawal'>('Investment')
  const [amountStr, setAmountStr] = useState<string>('')
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<'BankAccount' | 'CashBook'>('BankAccount')
  const [bankAccountId, setBankAccountId] = useState<string>(bankAccounts[0]?.id || '')
  const [cashBookId, setCashBookId] = useState<string>(cashBooks[0]?.id || '')
  const [notes, setNotes] = useState<string>('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Update selection if prefilledOwner changes or on open
  useEffect(() => {
    if (prefilledOwner?.id) {
      setSelectedOwnerId(prefilledOwner.id)
    } else if (owners.length > 0 && !selectedOwnerId) {
      setSelectedOwnerId(owners[0].id)
    }
  }, [prefilledOwner, owners])

  // Default account selection
  useEffect(() => {
    if (bankAccounts.length > 0 && !bankAccountId) {
      setBankAccountId(bankAccounts[0].id)
    }
    if (cashBooks.length > 0 && !cashBookId) {
      setCashBookId(cashBooks[0].id)
    }
  }, [bankAccounts, cashBooks, bankAccountId, cashBookId])

  // Focus trap and Esc key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    setTimeout(() => {
      amountInputRef.current?.focus()
    }, 100)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const selectedOwner = useMemo(() => {
    return owners.find(o => o.id === selectedOwnerId) || null
  }, [owners, selectedOwnerId])

  const { initialInv, currentInv, totalWithdrawn } = useMemo(() => {
    if (!selectedOwner) return { initialInv: 0, currentInv: 0, totalWithdrawn: 0 }
    const { totalWithdrawn: w } = getOwnerTransactionTotals(selectedOwner)
    return {
      initialInv: Number(selectedOwner.initialInvestment || 0),
      currentInv: Number(selectedOwner.currentInvestment || 0),
      totalWithdrawn: w
    }
  }, [selectedOwner])

  const totalCompanyCapital = useMemo(() => {
    return owners.reduce((acc, o) => acc + Number(o.currentInvestment || 0), 0)
  }, [owners])

  const amountNum = useMemo(() => {
    const parsed = parseFloat(amountStr)
    return isNaN(parsed) || parsed < 0 ? 0 : parsed
  }, [amountStr])

  // Selected Account details
  const selectedAccount = useMemo(() => {
    if (paymentMethod === 'BankAccount') {
      const acc = bankAccounts.find(b => b.id === bankAccountId)
      return acc ? { name: `${acc.bankName} (${acc.accountNumber || acc.accountName})`, balance: Number(acc.currentBalance || 0) } : null
    } else {
      const cb = cashBooks.find(c => c.id === cashBookId)
      return cb ? { name: cb.name, balance: Number(cb.currentBalance || 0) } : null
    }
  }, [paymentMethod, bankAccountId, cashBookId, bankAccounts, cashBooks])

  // Live "Before -> After" values
  const ownerInvestmentAfter = useMemo(() => {
    if (transactionType === 'Investment') {
      return currentInv + amountNum
    } else {
      return currentInv - amountNum
    }
  }, [currentInv, amountNum, transactionType])

  const accountBalanceAfter = useMemo(() => {
    if (!selectedAccount) return null
    if (transactionType === 'Investment') {
      return selectedAccount.balance + amountNum
    } else {
      return selectedAccount.balance - amountNum
    }
  }, [selectedAccount, amountNum, transactionType])

  const totalCapitalAfter = useMemo(() => {
    if (transactionType === 'Investment') {
      return totalCompanyCapital + amountNum
    } else {
      return totalCompanyCapital - amountNum
    }
  }, [totalCompanyCapital, amountNum, transactionType])

  // Warnings
  const isWithdrawalExceedingInvestment = transactionType === 'Withdrawal' && amountNum > currentInv
  const isWithdrawalExceedingAccount = transactionType === 'Withdrawal' && selectedAccount && amountNum > selectedAccount.balance

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOwnerId) {
      setErrorBanner('Please select an owner.')
      return
    }
    if (amountNum <= 0) {
      setErrorBanner('Please enter a transaction amount greater than ₹0.')
      amountInputRef.current?.focus()
      return
    }

    if (paymentMethod === 'BankAccount' && !bankAccountId) {
      setErrorBanner('Please select a bank account.')
      return
    }
    if (paymentMethod === 'CashBook' && !cashBookId) {
      setErrorBanner('Please select a cashbook.')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorBanner(null)
      await onSubmit(selectedOwnerId, {
        transactionDate: new Date(transactionDate).toISOString(),
        amount: amountNum,
        transactionType,
        paymentMethod,
        bankAccountId: paymentMethod === 'BankAccount' ? bankAccountId : undefined,
        cashBookId: paymentMethod === 'CashBook' ? cashBookId : undefined,
        notes: notes.trim() || undefined
      })
      onClose()
    } catch (err: any) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to record transaction.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-[460px] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/60">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-[#1A56DB]" />
              <span>Owner transaction</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Record an additional investment or a withdrawal
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Error Banner */}
          {errorBanner && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* 1. Owner Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Owner
            </label>
            <select
              value={selectedOwnerId}
              onChange={e => setSelectedOwnerId(e.target.value)}
              className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#1A56DB] transition-colors"
            >
              {owners.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.ownershipPercentage}% ownership)
                </option>
              ))}
            </select>

            {/* 3 Info Tiles below Owner selector */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-center">
                <span className="text-[10px] text-slate-500 font-medium block">Initial</span>
                <span className="text-xs font-bold text-slate-800 font-mono">
                  {formatINR(initialInv)}
                </span>
              </div>
              <div className="p-2 bg-blue-50/50 border border-blue-200/60 rounded-lg text-center">
                <span className="text-[10px] text-blue-700 font-medium block">Current</span>
                <span className="text-xs font-bold text-slate-900 font-mono">
                  {formatINR(currentInv)}
                </span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-center">
                <span className="text-[10px] text-slate-500 font-medium block">Withdrawn</span>
                <span className="text-xs font-bold text-slate-800 font-mono">
                  {formatINR(totalWithdrawn)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Transaction Type Selectable Segments */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTransactionType('Investment')}
                className={`h-[40px] px-3 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                  transactionType === 'Investment'
                    ? 'bg-blue-50 text-[#1A56DB] border-[#1A56DB] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>Investment (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setTransactionType('Withdrawal')}
                className={`h-[40px] px-3 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                  transactionType === 'Withdrawal'
                    ? 'bg-blue-50 text-[#1A56DB] border-[#1A56DB] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>Withdrawal (−)</span>
              </button>
            </div>
          </div>

          {/* 3. Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">
                  ₹
                </span>
                <input
                  ref={amountInputRef}
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="w-full h-[38px] pl-7 pr-3 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1A56DB] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Date
              </label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={e => setTransactionDate(e.target.value)}
                className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#1A56DB] transition-colors"
              />
            </div>
          </div>

          {/* Warnings for Withdrawal */}
          {isWithdrawalExceedingInvestment && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Withdrawal of <strong>{formatINR(amountNum)}</strong> exceeds current owner investment of{' '}
                <strong>{formatINR(currentInv)}</strong>. Balance will become negative ({formatINR(ownerInvestmentAfter)}).
              </span>
            </div>
          )}

          {/* 4. Via & Account Select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {transactionType === 'Investment' ? 'Deposit to account' : 'Pay from account'}
              </label>

              {/* Via Chips */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BankAccount')}
                  className={`px-2 py-0.5 rounded-md font-medium flex items-center gap-1 transition-colors ${
                    paymentMethod === 'BankAccount'
                      ? 'bg-white text-[#1A56DB] shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Landmark className="w-3 h-3" />
                  <span>Bank</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CashBook')}
                  className={`px-2 py-0.5 rounded-md font-medium flex items-center gap-1 transition-colors ${
                    paymentMethod === 'CashBook'
                      ? 'bg-white text-[#1A56DB] shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Wallet className="w-3 h-3" />
                  <span>Cash</span>
                </button>
              </div>
            </div>

            {paymentMethod === 'BankAccount' ? (
              <select
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
                className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#1A56DB]"
              >
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountNumber || b.accountName} (Bal: {formatINR(b.currentBalance, true)})
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={cashBookId}
                onChange={e => setCashBookId(e.target.value)}
                className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#1A56DB]"
              >
                {cashBooks.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Bal: {formatINR(c.currentBalance, true)})
                  </option>
                ))}
              </select>
            )}

            {isWithdrawalExceedingAccount && (
              <div className="p-2 rounded bg-amber-50 border border-amber-200/70 text-amber-800 text-[11px] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Withdrawal amount exceeds account balance ({formatINR(selectedAccount?.balance)}).
                </span>
              </div>
            )}
          </div>

          {/* 5. Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Q3 Equity infusion, Dividend distribution..."
              className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#1A56DB]"
            />
          </div>

          {/* 6. Live "Before → After" Preview Card */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Live Impact Preview
            </span>

            {/* Owner current investment */}
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Owner current investment:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-slate-500">{formatINR(currentInv)}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className={`font-bold ${ownerInvestmentAfter < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {formatINR(ownerInvestmentAfter)}
                </span>
              </div>
            </div>

            {/* Account balance */}
            {selectedAccount && accountBalanceAfter !== null && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Account balance:</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-slate-500">{formatINR(selectedAccount.balance, true)}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className={`font-bold ${accountBalanceAfter < 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                    {formatINR(accountBalanceAfter, true)}
                  </span>
                </div>
              </div>
            )}

            {/* Total company capital */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
              <span className="text-slate-600">Total owner capital:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-slate-500">{formatINR(totalCompanyCapital)}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="font-bold text-[#1A56DB]">
                  {formatINR(totalCapitalAfter)}
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-[34px] px-3.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || amountNum <= 0}
            className="h-[34px] px-4 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium rounded-lg text-xs shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>
              {transactionType === 'Investment' ? 'Record investment' : 'Record withdrawal'}{' '}
              {amountNum > 0 ? formatINR(amountNum) : ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default OwnerTransactionModal
