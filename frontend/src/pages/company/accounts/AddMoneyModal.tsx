import React, { useState, useEffect } from 'react'
import { AlertCircle, Calendar, DollarSign, FileText, Hash } from 'lucide-react'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseInput from '../../../components/ui/EnterpriseInput'
import EnterpriseSelect from '../../../components/ui/EnterpriseSelect'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type { AddMoneyRequest } from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'

interface AddMoneyModalProps {
  isOpen: boolean
  onClose: () => void
  bankAccountId?: string
  cashBookId?: string
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
  onSuccess,
  ledgerEntry
}) => {
  const { showToast } = useNotificationStore()
  const isEdit = !!ledgerEntry

  // Form states (using raw string for amount to avoid backspace locks)
  const [amount, setAmount] = useState<string>('0')
  const [source, setSource] = useState<string>('Owner Investment')
  const [referenceNo, setReferenceNo] = useState<string>('')
  const [date, setDate] = useState<string>(new Date().toISOString().substring(0, 10)) // YYYY-MM-DD
  const [description, setDescription] = useState<string>('')
  
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Initialize fields on open/edit change
  useEffect(() => {
    if (isOpen) {
      setFormError(null)
      if (ledgerEntry) {
        // Parse details for Edit Mode
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
        // Default values for Create Mode
        setAmount('0')
        setSource('Owner Investment')
        setReferenceNo('')
        setDate(new Date().toISOString().substring(0, 10))
        setDescription('')
      }
    }
  }, [isOpen, ledgerEntry])

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

    try {
      setSubmitting(true)
      const payload: AddMoneyRequest = {
        amount: parsedAmount,
        source: source,
        referenceNo: referenceNo.trim() || undefined,
        date: new Date(date).toISOString(),
        description: description.trim() || undefined
      }

      if (isEdit) {
        // Edit flow
        if (bankAccountId) {
          await simpleAccountsService.updateBankDeposit(ledgerEntry.id, payload)
        } else {
          await simpleAccountsService.updateCashDeposit(ledgerEntry.id, payload)
        }
        showToast('Deposit updated successfully!', 'success')
      } else {
        // Create flow
        if (bankAccountId) {
          await simpleAccountsService.addBankMoney(bankAccountId, payload)
        } else if (cashBookId) {
          await simpleAccountsService.addCashMoney(cashBookId, payload)
        } else {
          throw new Error('Missing account identification.')
        }
        showToast('Money added successfully!', 'success')
      }

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
      title={isEdit ? 'Edit Deposit Transaction' : 'Add Money'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Amount */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-[13px] text-slate-400 text-sm font-semibold">₹</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                className="h-[42px] pl-7 pr-3 w-full border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
                className="h-[42px] pl-9 pr-3 w-full border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Source Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Source *</label>
            <EnterpriseSelect
              value={source}
              onChange={(e) => setSource(e.target.value)}
              options={SOURCES.map(src => ({ value: src, label: src }))}
            />
          </div>

          {/* Reference No */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Reference No (Optional)</label>
            <div className="relative">
              <Hash className="absolute left-3 top-[13px] text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="e.g. CHQ-1002, TXN-9981"
                className="h-[42px] pl-9 pr-3 w-full border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Description / Remarks */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Description / Remarks (Optional)</label>
          <div className="relative">
            <FileText className="absolute left-3 top-[13px] text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="e.g. Received from primary investor, deposit to cover payroll"
              className="h-[42px] pl-9 pr-3 w-full border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <EnterpriseButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton variant="primary" type="submit" disabled={submitting} loading={submitting}>
            {isEdit ? 'Save Changes' : 'Save'}
          </EnterpriseButton>
        </div>
      </form>
    </EnterpriseModal>
  )
}
