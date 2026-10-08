import React, { useState, useEffect } from 'react'
import {
  AlertCircle,
  Wallet,
  Building2,
  Plus,
  RefreshCw
} from 'lucide-react'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseInput from '../../../components/ui/EnterpriseInput'
import EnterpriseSelect from '../../../components/ui/EnterpriseSelect'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type {
  CashBook,
  BankAccountDropdown,
  CashBookDropdown,
  SettleCashBookRequest,
  CreateCashBookRequest
} from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { formatBalanceCurrency } from '../../../utils/balanceFormat'

interface SettleCashBookModalProps {
  isOpen: boolean
  onClose: () => void
  targetCashBook: CashBook | null
  onSuccess: () => void
}

export const SettleCashBookModal: React.FC<SettleCashBookModalProps> = ({
  isOpen,
  onClose,
  targetCashBook,
  onSuccess
}) => {
  const { showToast } = useNotificationStore()

  // Target deficit
  const rawBalance = targetCashBook?.currentBalance ?? 0
  const deficitAmount = Math.max(0, -rawBalance)

  // Settlement Mode: full vs partial
  const [settlementType, setSettlementType] = useState<'full' | 'partial'>('full')
  const [amountStr, setAmountStr] = useState<string>('')

  // Funding Source
  const [settlementVia, setSettlementVia] = useState<'Cash' | 'Bank'>('Cash')
  const [sourceCashBookId, setSourceCashBookId] = useState<string>('')
  const [sourceBankAccountId, setSourceBankAccountId] = useState<string>('')

  // Additional details
  const [date, setDate] = useState<string>(new Date().toISOString().substring(0, 10))
  const [referenceNo, setReferenceNo] = useState<string>('')
  const [description, setDescription] = useState<string>('')

  // Lists
  const [cashBooksList, setCashBooksList] = useState<CashBookDropdown[]>([])
  const [bankAccountsList, setBankAccountsList] = useState<BankAccountDropdown[]>([])
  const [loadingSources, setLoadingSources] = useState<boolean>(false)

  // Quick Create Cashbook inline
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState<boolean>(false)
  const [quickCashName, setQuickCashName] = useState<string>('')
  const [quickCashDesc, setQuickCashDesc] = useState<string>('')
  const [quickCashOpening, setQuickCashOpening] = useState<number>(0)
  const [creatingQuickCash, setCreatingQuickCash] = useState<boolean>(false)

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Load available sources
  const loadSources = async () => {
    try {
      setLoadingSources(true)
      const [cbData, baData] = await Promise.all([
        simpleAccountsService.getCashBookDropdown().catch(() => []),
        simpleAccountsService.getBankAccountDropdown().catch(() => [])
      ])
      setCashBooksList(cbData || [])
      setBankAccountsList(baData || [])
    } catch (err: any) {
      console.error('Failed to load sources for settlement', err)
    } finally {
      setLoadingSources(false)
    }
  }

  useEffect(() => {
    if (isOpen && targetCashBook) {
      setFormError(null)
      setSettlementType('full')
      setAmountStr(deficitAmount.toString())
      setSettlementVia('Cash')
      setSourceCashBookId('')
      setSourceBankAccountId('')
      setDate(new Date().toISOString().substring(0, 10))
      setReferenceNo('')
      setDescription('')
      setIsQuickCreateOpen(false)
      loadSources()
    }
  }, [isOpen, targetCashBook])

  // Update amount when toggle changes
  const handleSettlementTypeChange = (type: 'full' | 'partial') => {
    setSettlementType(type)
    if (type === 'full') {
      setAmountStr(deficitAmount.toString())
    } else {
      setAmountStr('')
    }
  }

  // Calculate parsed amount & projected balance
  const parsedAmount = settlementType === 'full' ? deficitAmount : (parseFloat(amountStr) || 0)
  const projectedBalance = rawBalance + parsedAmount

  // Validation
  const isSourceSelected =
    settlementVia === 'Cash'
      ? Boolean(sourceCashBookId && sourceCashBookId !== targetCashBook?.id)
      : Boolean(sourceBankAccountId)
  const isAmountValid = parsedAmount > 0 && parsedAmount <= deficitAmount
  const isDateValid = Boolean(date && date.trim())
  const canSubmit = isSourceSelected && isAmountValid && isDateValid && !submitting

  // Handle Quick Create Cashbook
  const handleQuickCreateCashBook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickCashName.trim()) {
      showToast('Please enter cash book name.', 'warning')
      return
    }

    try {
      setCreatingQuickCash(true)
      const req: CreateCashBookRequest = {
        name: quickCashName.trim(),
        description: quickCashDesc.trim() || undefined,
        openingBalance: Number(quickCashOpening) || 0,
        status: 'Active'
      }
      const created = await simpleAccountsService.createCashBook(req)
      showToast(`Cash book "${created.name}" created!`, 'success')

      // Refresh list & select newly created cashbook
      const updatedList = await simpleAccountsService.getCashBookDropdown()
      setCashBooksList(updatedList || [])
      setSourceCashBookId(created.id)

      // Reset and close quick creator
      setQuickCashName('')
      setQuickCashDesc('')
      setQuickCashOpening(0)
      setIsQuickCreateOpen(false)
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to create cash book.', 'error')
    } finally {
      setCreatingQuickCash(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!targetCashBook) return

    if (deficitAmount <= 0) {
      setFormError('Target cash book has no negative deficit to settle.')
      return
    }

    if (parsedAmount <= 0) {
      setFormError('Enter an amount.')
      return
    }

    if (parsedAmount > deficitAmount) {
      setFormError('Amount exceeds outstanding balance.')
      return
    }

    if (!isSourceSelected) {
      setFormError('Select a source.')
      return
    }

    if (!isDateValid) {
      setFormError('Select a settlement date.')
      return
    }

    try {
      setSubmitting(true)

      const payload: SettleCashBookRequest = {
        amount: parsedAmount,
        settlementVia,
        sourceCashBookId: settlementVia === 'Cash' ? sourceCashBookId : undefined,
        sourceBankAccountId: settlementVia === 'Bank' ? sourceBankAccountId : undefined,
        date: new Date(date).toISOString(),
        referenceNo: referenceNo.trim() || undefined,
        description: description.trim() || undefined
      }

      await simpleAccountsService.settleCashBook(targetCashBook.id, payload)
      showToast(`Settled ${formatBalanceCurrency(parsedAmount)} for ${targetCashBook.name}`, 'success')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Settlement error:', err)
      setFormError(err.response?.data?.message || err.message || 'Failed to complete settlement.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!targetCashBook) return null

  // Filter available cashbooks (cannot pick the target cashbook itself)
  const availableCashBooks = cashBooksList.filter((cb) => cb.id !== targetCashBook.id)

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Settle Cash Balance"
      maxWidth="sm"
      className="!max-w-[540px]"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {formError && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{formError}</span>
          </div>
        )}

        {/* 1. COMPACT BALANCE SUMMARY */}
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-slate-800 block">{targetCashBook.name}</span>
          </div>
          <div className="flex items-center gap-5 text-right">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Current Balance</span>
              <span className="text-sm font-bold text-rose-600">{formatBalanceCurrency(rawBalance)}</span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Outstanding</span>
              <span className="text-sm font-bold text-slate-800">{formatBalanceCurrency(deficitAmount)}</span>
            </div>
          </div>
        </div>

        {/* 2. SETTLEMENT MODE (FULL / PARTIAL) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Settlement
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/90 rounded-lg">
            <button
              type="button"
              onClick={() => handleSettlementTypeChange('full')}
              className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                settlementType === 'full'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full
            </button>
            <button
              type="button"
              onClick={() => handleSettlementTypeChange('partial')}
              className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                settlementType === 'partial'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Partial
            </button>
          </div>
        </div>

        {/* 3. SETTLEMENT AMOUNT */}
        {settlementType === 'full' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Settlement Amount
            </label>
            <div className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center text-sm font-bold text-slate-800 select-none">
              {formatBalanceCurrency(deficitAmount)}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Settlement Amount *</label>
              <span className="text-[11px] text-slate-500">Max {formatBalanceCurrency(deficitAmount)}</span>
            </div>
            <EnterpriseInput
              type="number"
              min="0.01"
              max={deficitAmount}
              step="any"
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              required
            />
          </div>
        )}

        {/* 4. FUND SOURCE (CASH / BANK) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Settlement From *
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/90 rounded-lg">
            <button
              type="button"
              onClick={() => setSettlementVia('Cash')}
              className={`py-1.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                settlementVia === 'Cash'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
              Cash
            </button>
            <button
              type="button"
              onClick={() => setSettlementVia('Bank')}
              className={`py-1.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                settlementVia === 'Bank'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              Bank
            </button>
          </div>
        </div>

        {/* 5. CASH SOURCE OR BANK SOURCE SELECTION */}
        {settlementVia === 'Cash' ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Cashbook *</label>
              <button
                type="button"
                onClick={() => setIsQuickCreateOpen(!isQuickCreateOpen)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                {isQuickCreateOpen ? 'Cancel' : '+ New Cashbook'}
              </button>
            </div>

            {/* Quick create inline form */}
            {isQuickCreateOpen && (
              <div className="mb-2 p-3 bg-indigo-50/50 border border-indigo-200/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                    New Cash Book
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsQuickCreateOpen(false)}
                    className="text-[11px] text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Name *</label>
                    <EnterpriseInput
                      placeholder="e.g. Counter Cash"
                      value={quickCashName}
                      onChange={(e) => setQuickCashName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Opening Balance</label>
                    <EnterpriseInput
                      type="number"
                      placeholder="0"
                      value={quickCashOpening.toString()}
                      onChange={(e) => setQuickCashOpening(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Description</label>
                  <EnterpriseInput
                    placeholder="e.g. Operating cash drawer"
                    value={quickCashDesc}
                    onChange={(e) => setQuickCashDesc(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <EnterpriseButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsQuickCreateOpen(false)}
                  >
                    Cancel
                  </EnterpriseButton>
                  <EnterpriseButton
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={creatingQuickCash || !quickCashName.trim()}
                    onClick={handleQuickCreateCashBook}
                  >
                    {creatingQuickCash ? 'Creating...' : 'Create & Select'}
                  </EnterpriseButton>
                </div>
              </div>
            )}

            <EnterpriseSelect
              value={sourceCashBookId}
              onChange={(e) => setSourceCashBookId(e.target.value)}
              options={[
                { value: '', label: 'Select Cashbook' },
                ...availableCashBooks.map((cb) => ({
                  value: cb.id,
                  label: `${cb.name} — Balance ${formatBalanceCurrency(cb.currentBalance)}`
                }))
              ]}
            />
            {availableCashBooks.length === 0 && !loadingSources && !isQuickCreateOpen && (
              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                No other cash books available. Use "+ New Cashbook" to create one.
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account *</label>
            <EnterpriseSelect
              value={sourceBankAccountId}
              onChange={(e) => setSourceBankAccountId(e.target.value)}
              options={[
                { value: '', label: 'Select Bank Account' },
                ...bankAccountsList.map((ba) => ({
                  value: ba.id,
                  label: `${ba.bankName} — A/C ${ba.accountNumber} (Balance ${formatBalanceCurrency(ba.currentBalance)})`
                }))
              ]}
            />
          </div>
        )}

        {/* 6. SETTLEMENT DATE & REFERENCE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Settlement Date *</label>
            <EnterpriseInput
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reference</label>
            <EnterpriseInput
              placeholder="SETTLE-001 / Voucher No."
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          </div>
        </div>

        {/* 7. DESCRIPTION */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
          <EnterpriseInput
            placeholder="e.g. Cash received for settlement"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* 8. COMPACT BALANCE PREVIEW */}
        <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl grid grid-cols-3 divide-x divide-slate-200 text-center text-xs">
          <div className="px-2">
            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Current</span>
            <span className="font-bold text-rose-600 block mt-0.5">{formatBalanceCurrency(rawBalance)}</span>
          </div>
          <div className="px-2">
            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Settlement</span>
            <span className="font-bold text-slate-800 block mt-0.5">{formatBalanceCurrency(parsedAmount)}</span>
          </div>
          <div className="px-2">
            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">After</span>
            <span
              className={`font-bold block mt-0.5 ${
                projectedBalance < 0
                  ? 'text-rose-600'
                  : projectedBalance > 0
                  ? 'text-emerald-600'
                  : 'text-slate-700'
              }`}
            >
              {formatBalanceCurrency(projectedBalance)}
            </span>
          </div>
        </div>

        {/* 9. ACTIONS */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <EnterpriseButton
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </EnterpriseButton>
          <EnterpriseButton
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[130px]"
          >
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Settling...
              </span>
            ) : (
              `Settle ${formatBalanceCurrency(parsedAmount)}`
            )}
          </EnterpriseButton>
        </div>
      </form>
    </EnterpriseModal>
  )
}

export default SettleCashBookModal
