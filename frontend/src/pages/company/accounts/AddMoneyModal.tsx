import React, { useState, useEffect, useMemo } from 'react'
import {
  AlertCircle,
  Calendar,
  FileText,
  Hash,
  Wallet,
  Building2,
  UserCheck,
  ArrowDownRight,
  Lock
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseSelect from '../../../components/ui/EnterpriseSelect'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type { AddMoneyRequest, CashBook, BankAccount } from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'

interface AddMoneyModalProps {
  isOpen: boolean
  onClose: () => void
  bankAccountId?: string
  cashBookId?: string
  targetType?: 'bank' | 'cash'
  bankAccounts?: { id: string; name: string }[]
  cashBooks?: (CashBook | { id: string; name: string; ownerId?: string; ownerName?: string; currentBalance?: number })[]
  prefilledCashBook?: CashBook | null
  prefilledBankAccount?: BankAccount | null
  onSuccess: () => void
  ledgerEntry?: any // If present, we are in Edit mode
}

const SOURCES = [
  'Owner Investment',
  'Cash Deposit',
  'Bank Deposit',
  'Loan Received',
  'Interest Received',
  'Customer Advance',
  'Capital',
  'Transfer From Another Account',
  'Other'
]

export const AddMoneyModal: React.FC<AddMoneyModalProps> = ({
  isOpen,
  onClose,
  bankAccountId,
  cashBookId,
  targetType = 'bank',
  bankAccounts = [],
  cashBooks = [],
  prefilledCashBook,
  prefilledBankAccount,
  onSuccess,
  ledgerEntry
}) => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()
  const isEdit = !!ledgerEntry

  const initialType = (cashBookId || prefilledCashBook) ? 'cash' : ((bankAccountId || prefilledBankAccount) ? 'bank' : targetType)
  const [selectedType, setSelectedType] = useState<'bank' | 'cash'>(initialType)
  const [selectedBankId, setSelectedBankId] = useState<string>(bankAccountId || prefilledBankAccount?.id || '')
  const [selectedCashId, setSelectedCashId] = useState<string>(cashBookId || prefilledCashBook?.id || '')

  // Form states
  const [amount, setAmount] = useState<string>('')
  const [source, setSource] = useState<string>('Owner Investment')
  const [referenceNo, setReferenceNo] = useState<string>('')
  const [date, setDate] = useState<string>(new Date().toISOString().substring(0, 10))
  const [description, setDescription] = useState<string>('')

  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Determine currently selected cashbook object
  const currentCashBook = useMemo(() => {
    if (selectedType !== 'cash') return null
    if (prefilledCashBook && (!selectedCashId || prefilledCashBook.id === selectedCashId)) {
      return prefilledCashBook
    }
    return cashBooks.find(c => c.id === selectedCashId) || null
  }, [selectedType, prefilledCashBook, cashBooks, selectedCashId])

  // Determine currently selected bank account object
  const currentBankAccount = useMemo(() => {
    if (selectedType !== 'bank') return null
    if (prefilledBankAccount && (!selectedBankId || prefilledBankAccount.id === selectedBankId)) {
      return prefilledBankAccount
    }
    return bankAccounts.find(b => b.id === selectedBankId) || null
  }, [selectedType, prefilledBankAccount, bankAccounts, selectedBankId])

  // Resolve linked owner strictly from the database relationship (never inferred from name)
  const isOwnerLinked = Boolean(currentCashBook?.ownerId || currentCashBook?.ownerName)
  const linkedOwnerName = currentCashBook?.ownerName || ''
  const linkedOwnerId = currentCashBook?.ownerId || undefined
  const isDirectAccountTarget = Boolean((cashBookId || bankAccountId || prefilledCashBook || prefilledBankAccount) && !isEdit)

  // Initialize and synchronize fields on open/edit change
  useEffect(() => {
    if (isOpen) {
      setFormError(null)

      const effectiveType = (cashBookId || prefilledCashBook) ? 'cash' : ((bankAccountId || prefilledBankAccount) ? 'bank' : targetType)
      setSelectedType(effectiveType)

      const bankId = bankAccountId || prefilledBankAccount?.id || (bankAccounts.length > 0 ? bankAccounts[0].id : '')
      const cashId = cashBookId || prefilledCashBook?.id || (cashBooks.length > 0 ? cashBooks[0].id : '')
      setSelectedBankId(bankId)
      setSelectedCashId(cashId)

      if (ledgerEntry) {
        // Edit Mode
        const creditAmount = ledgerEntry.credit || 0
        setAmount(creditAmount.toString())
        setDate(new Date(ledgerEntry.transactionDate || ledgerEntry.createdAt).toISOString().substring(0, 10))
        setReferenceNo(ledgerEntry.referenceNumber || '')

        const desc = ledgerEntry.description || ''
        const matchedSource = SOURCES.find(src => desc.startsWith(src))
        if (matchedSource) {
          setSource(matchedSource)
          if (desc.startsWith(matchedSource + ' - ')) {
            setDescription(desc.substring(matchedSource.length + 3))
          } else {
            setDescription('')
          }
        } else {
          setSource('Other')
          setDescription(desc)
        }
      } else {
        // Create Mode
        setAmount('')
        setReferenceNo('')
        setDate(new Date().toISOString().substring(0, 10))
        setDescription('')

        // Resolve target cashbook to determine default source
        const targetBook = prefilledCashBook || cashBooks.find(c => c.id === cashId) || null
        const isTargetOwnerLinked = Boolean(targetBook?.ownerId || targetBook?.ownerName)

        if (effectiveType === 'cash') {
          setSource(isTargetOwnerLinked ? 'Owner Investment' : 'Cash Deposit')
        } else {
          setSource('Bank Deposit')
        }
      }
    }
  }, [isOpen, ledgerEntry, cashBookId, bankAccountId, prefilledCashBook, prefilledBankAccount, targetType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const parsedAmount = parseFloat(amount) || 0
    if (parsedAmount <= 0) {
      setFormError('Amount must be greater than zero.')
      return
    }

    if (!date) {
      setFormError('Date is required.')
      return
    }

    const targetBankId = bankAccountId || (selectedType === 'bank' ? selectedBankId : undefined)
    const targetCashId = cashBookId || (selectedType === 'cash' ? selectedCashId : undefined)

    if (selectedType === 'bank' && !targetBankId) {
      setFormError('Please select a Bank Account.')
      return
    }

    if (selectedType === 'cash' && !targetCashId) {
      setFormError('Please select a Cash Book.')
      return
    }

    try {
      setSubmitting(true)

      // Resolve transaction date payload:
      // If date is today, preserve current timestamp so the exact occurrence time is recorded.
      // If editing and date was not changed, preserve existing transaction timestamp.
      // If historical date, preserve the chosen business date.
      let txDatePayload: string
      const todayStr = new Date().toISOString().substring(0, 10)
      if (isEdit && ledgerEntry?.transactionDate) {
        const existingTxDateStr = new Date(ledgerEntry.transactionDate).toISOString().substring(0, 10)
        if (date === existingTxDateStr) {
          txDatePayload = new Date(ledgerEntry.transactionDate).toISOString()
        } else if (date === todayStr) {
          txDatePayload = new Date().toISOString()
        } else {
          txDatePayload = new Date(`${date}T00:00:00.000Z`).toISOString()
        }
      } else if (date === todayStr) {
        txDatePayload = new Date().toISOString()
      } else {
        txDatePayload = new Date(`${date}T00:00:00.000Z`).toISOString()
      }

      const payload: AddMoneyRequest = {
        amount: parsedAmount,
        source: source,
        referenceNo: referenceNo.trim() || undefined,
        date: txDatePayload,
        description: description.trim() || undefined,
        ownerId: (selectedType === 'cash' && isOwnerLinked) ? linkedOwnerId : undefined
      }

      if (isEdit) {
        const isBank =
          bankAccountId ||
          (ledgerEntry?.bankAccountId && ledgerEntry.bankAccountId !== '00000000-0000-0000-0000-000000000000') ||
          ledgerEntry?.accountType === 'BANK'

        if (isBank) {
          await simpleAccountsService.updateBankDeposit(ledgerEntry.id, payload)
        } else {
          await simpleAccountsService.updateCashDeposit(ledgerEntry.id, payload)
        }
        showToast('Deposit updated successfully!', 'success')
      } else {
        if (targetBankId) {
          await simpleAccountsService.addBankMoney(targetBankId, payload)
        } else if (targetCashId) {
          await simpleAccountsService.addCashMoney(targetCashId, payload)
        }
        showToast('Money added successfully!', 'success')
      }

      // Invalidate relevant caches to ensure instant and persisted sync
      queryClient.invalidateQueries({ queryKey: ['cashBooksList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountsList'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['unifiedLedger'] })
      queryClient.invalidateQueries({ queryKey: ['unifiedLedgerSummary'] })
      queryClient.invalidateQueries({ queryKey: ['ownersList'] })
      queryClient.invalidateQueries({ queryKey: ['companyTotalInvestment'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })

      onSuccess()
      onClose()
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'An error occurred while saving transaction.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Deposit Transaction' : 'Add Cash / Deposit'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {formError}
          </div>
        )}

        {/* 1. Account & Owner Context Banner */}
        {isDirectAccountTarget ? (
          <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedType === 'cash'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  }`}
                >
                  {selectedType === 'cash' ? <Wallet className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Target {selectedType === 'cash' ? 'Cash Book' : 'Bank Account'}
                    </span>
                    <span title="Account locked for this action">
                      <Lock className="w-3 h-3 text-slate-400" />
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {selectedType === 'cash'
                      ? currentCashBook?.name || 'Selected Cash Book'
                      : currentBankAccount
                        ? ('accountName' in currentBankAccount
                            ? `${currentBankAccount.bankName} (${currentBankAccount.accountName})`
                            : ('name' in currentBankAccount ? (currentBankAccount as any).name : 'Selected Bank Account'))
                        : 'Selected Bank Account'}
                  </h4>
                </div>
              </div>

              {/* Transaction Direction Badge */}
              <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Money received / Cash In (+)</span>
              </div>
            </div>

            {/* Read-Only Linked Owner Context */}
            {selectedType === 'cash' && isOwnerLinked && (
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/80 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-slate-500 font-medium">Linked Owner:</span>
                  <span className="font-bold text-slate-900">{linkedOwnerName}</span>
                </div>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  Owner-Linked Account
                </span>
              </div>
            )}
          </div>
        ) : !isEdit ? (
          /* Generic selector when modal is opened globally */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Deposit To *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedType('bank')
                    if (!selectedBankId && bankAccounts.length > 0) setSelectedBankId(bankAccounts[0].id)
                    setSource('Bank Deposit')
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                    selectedType === 'bank'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Bank Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedType('cash')
                    if (!selectedCashId && cashBooks.length > 0) setSelectedCashId(cashBooks[0].id)
                    const targetBook = cashBooks.find(c => c.id === (selectedCashId || cashBooks[0]?.id))
                    setSource(targetBook?.ownerId || targetBook?.ownerName ? 'Owner Investment' : 'Cash Deposit')
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                    selectedType === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Cash Book
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Select {selectedType === 'bank' ? 'Bank Account' : 'Cash Book'} *
              </label>
              {selectedType === 'bank' ? (
                <EnterpriseSelect
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  options={[
                    { value: '', label: 'Select Bank Account...' },
                    ...bankAccounts.map((b) => ({ value: b.id, label: b.name }))
                  ]}
                />
              ) : (
                <EnterpriseSelect
                  value={selectedCashId}
                  onChange={(e) => {
                    const nextId = e.target.value
                    setSelectedCashId(nextId)
                    const nextBook = cashBooks.find(c => c.id === nextId)
                    if (nextBook?.ownerId || nextBook?.ownerName) {
                      setSource('Owner Investment')
                    } else {
                      setSource('Cash Deposit')
                    }
                  }}
                  options={[
                    { value: '', label: 'Select Cash Book...' },
                    ...cashBooks.map((c) => ({
                      value: c.id,
                      label: `${c.name}${c.ownerName ? ` (${c.ownerName})` : ''}`
                    }))
                  ]}
                />
              )}
            </div>

            {selectedType === 'cash' && isOwnerLinked && (
              <div className="col-span-full pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-slate-500 font-medium">Linked Owner:</span>
                  <span className="font-bold text-slate-900">{linkedOwnerName}</span>
                </div>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  Auto-Selected
                </span>
              </div>
            )}
          </div>
        ) : null}

        {/* 2. Amount and Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Amount */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Amount (₹) *</label>
            <div className="relative">
              <span className="absolute left-3 top-[13px] text-slate-400 text-sm font-semibold">₹</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="Enter amount (e.g. 10000)"
                className="h-[42px] pl-7 pr-3 w-full border border-slate-200 rounded-[8px] text-sm focus:border-emerald-500 focus:outline-none font-semibold text-slate-900"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-[13px] text-slate-400 w-4 h-4" />
              <input
                type="date"
                required
                className="h-[42px] pl-9 pr-3 w-full border border-slate-200 rounded-[8px] text-sm focus:border-emerald-500 focus:outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Source Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Transaction Source *</label>
            <EnterpriseSelect
              value={source}
              onChange={(e) => setSource(e.target.value)}
              options={SOURCES.map((src) => ({ value: src, label: src }))}
            />
          </div>

          {/* Reference No */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Reference / Cheque No (Optional)
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-[13px] text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="e.g. CASH-REC-01, CHQ-1002"
                className="h-[42px] pl-9 pr-3 w-full border border-slate-200 rounded-[8px] text-sm focus:border-emerald-500 focus:outline-none"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 3. Description / Remarks */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Description / Remarks (Optional)
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-[13px] text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder={
                source === 'Owner Investment' && isOwnerLinked
                  ? `e.g. Additional capital contribution by ${linkedOwnerName}`
                  : 'e.g. Operational cash deposit'
              }
              className="h-[42px] pl-9 pr-3 w-full border border-slate-200 rounded-[8px] text-sm focus:border-emerald-500 focus:outline-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* 4. Form Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <EnterpriseButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton
            variant="primary"
            type="submit"
            disabled={submitting}
            loading={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isEdit ? 'Save Changes' : 'Confirm & Add Cash'}
          </EnterpriseButton>
        </div>
      </form>
    </EnterpriseModal>
  )
}
