import React, { useState, useEffect } from 'react'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import EnterpriseNumberInput from '../../../../components/ui/EnterpriseNumberInput'
import { Search } from 'lucide-react'
import type {
  SimpleExpense,
  BankAccountDropdown,
  CashBookDropdown
} from '../../../../services/simpleAccounts'
import { getCategoryMeta } from './categoryMeta'

export const EXPENSE_CATEGORIES = [
  'Salary',
  'Electricity',
  'Fuel',
  'Maintenance',
  'Vehicle',
  'Rent',
  'Infrastructure',
  'Purchase Related',
  'Stationary',
  'Tax',
  'Miscellaneous'
]

export const PAYMENT_METHODS = ['Cash', 'Bank']

interface ExpenseFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (formData: {
    expenseDate: string
    category: string
    vendor?: string
    description: string
    amount: number
    paymentMethod: string
    bankAccountId?: string
    cashBookId?: string
    notes?: string
  }) => Promise<void>
  initialData?: SimpleExpense | null
  bankAccounts?: BankAccountDropdown[]
  cashBooks?: CashBookDropdown[]
  loading?: boolean
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  bankAccounts = [],
  cashBooks = [],
  loading = false
}) => {
  const isEdit = !!initialData

  const [formData, setFormData] = useState({
    expenseDate: new Date().toISOString().split('T')[0],
    category: 'Miscellaneous',
    vendor: '',
    description: '',
    amount: 0,
    paymentMethod: 'Cash',
    bankAccountId: '',
    cashBookId: '',
    notes: ''
  })

  const [bankSearchTerm, setBankSearchTerm] = useState('')
  const [cashBookSearchTerm, setCashBookSearchTerm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setFormData({
        expenseDate: new Date(initialData.expenseDate).toISOString().split('T')[0],
        category: initialData.category || 'Miscellaneous',
        vendor: initialData.vendor || '',
        description: initialData.description || '',
        amount: initialData.amount || 0,
        paymentMethod: initialData.paymentMethod?.toLowerCase() === 'bank' ? 'Bank' : 'Cash',
        bankAccountId: initialData.bankAccountId || (bankAccounts[0]?.id || ''),
        cashBookId: initialData.cashBookId || (cashBooks[0]?.id || ''),
        notes: initialData.notes || ''
      })
    } else {
      setFormData({
        expenseDate: new Date().toISOString().split('T')[0],
        category: 'Miscellaneous',
        vendor: '',
        description: '',
        amount: 0,
        paymentMethod: 'Cash',
        bankAccountId: bankAccounts[0]?.id || '',
        cashBookId: cashBooks[0]?.id || '',
        notes: ''
      })
    }
    setBankSearchTerm('')
    setCashBookSearchTerm('')
    setFormError(null)
  }, [initialData, isOpen, bankAccounts, cashBooks])

  const filteredBankAccounts = bankAccounts.filter(
    b =>
      !bankSearchTerm ||
      b.bankName.toLowerCase().includes(bankSearchTerm.toLowerCase()) ||
      b.accountName.toLowerCase().includes(bankSearchTerm.toLowerCase()) ||
      b.accountNumber.toLowerCase().includes(bankSearchTerm.toLowerCase())
  )

  const filteredCashBooks = cashBooks.filter(
    c => !cashBookSearchTerm || c.name.toLowerCase().includes(cashBookSearchTerm.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.description.trim()) {
      setFormError('Description is required.')
      return
    }
    if (formData.amount <= 0) {
      setFormError('Amount must be greater than zero.')
      return
    }
    if (formData.paymentMethod === 'Bank' && !formData.bankAccountId) {
      setFormError('Please select a Bank Account for Bank payments.')
      return
    }
    if (formData.paymentMethod === 'Cash' && !formData.cashBookId) {
      setFormError('Please select a Cash Book for Cash payments.')
      return
    }

    try {
      await onSubmit({
        expenseDate: new Date(formData.expenseDate).toISOString(),
        category: formData.category,
        vendor: formData.vendor.trim() || undefined,
        description: formData.description.trim(),
        amount: formData.amount,
        paymentMethod: formData.paymentMethod,
        bankAccountId: formData.paymentMethod === 'Bank' ? formData.bankAccountId : undefined,
        cashBookId: formData.paymentMethod === 'Cash' ? formData.cashBookId : undefined,
        notes: formData.notes.trim() || undefined
      })
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save expense.')
    }
  }

  if (!isOpen) return null

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Expense ${initialData.expenseNumber || ''}` : 'Add Expense'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {formError && (
          <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Expense Date *
            </label>
            <input
              type="date"
              required
              value={formData.expenseDate}
              onChange={e => setFormData({ ...formData, expenseDate: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Category *
            </label>
            <div className="relative flex items-center">
              {formData.category && (
                <span
                  className="absolute left-3 w-2 h-2 rounded-full z-10 pointer-events-none"
                  style={{ backgroundColor: getCategoryMeta(formData.category).dot }}
                />
              )}
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className={`w-full ${
                  formData.category ? 'pl-7' : 'px-3'
                } py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB]`}
              >
                {EXPENSE_CATEGORIES.map(c => {
                  const meta = getCategoryMeta(c)
                  return (
                    <option key={c} value={c} style={{ color: meta.text }}>
                      ● {c}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <EnterpriseNumberInput
              label="Amount (₹) *"
              placeholder="0.00"
              value={formData.amount}
              onValueChange={val => setFormData({ ...formData, amount: Number(val) || 0 })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Payment Method *
            </label>
            <select
              value={formData.paymentMethod}
              onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB]"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cash Source Selector */}
        {formData.paymentMethod === 'Cash' && (
          <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-emerald-900 uppercase">
              Select Cash Book *
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search cash book..."
                value={cashBookSearchTerm}
                onChange={e => setCashBookSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
            <select
              value={formData.cashBookId}
              onChange={e => setFormData({ ...formData, cashBookId: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 font-semibold"
            >
              <option value="">-- Choose Cash Book --</option>
              {filteredCashBooks.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} [Bal: ₹{c.currentBalance.toLocaleString('en-IN')}]
                </option>
              ))}
            </select>
            {(!cashBooks || cashBooks.length === 0) && (
              <p className="text-[10px] text-amber-600 font-medium mt-1">
                No active cash books found. Please create one in Ledger first.
              </p>
            )}
          </div>
        )}

        {/* Bank Source Selector */}
        {formData.paymentMethod === 'Bank' && (
          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-indigo-900 uppercase">
              Select Bank Account *
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search bank name or account..."
                value={bankSearchTerm}
                onChange={e => setBankSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>
            <select
              value={formData.bankAccountId}
              onChange={e => setFormData({ ...formData, bankAccountId: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600 font-semibold"
            >
              <option value="">-- Choose Bank Account --</option>
              {filteredBankAccounts.map(b => (
                <option key={b.id} value={b.id}>
                  {b.bankName} - {b.accountName} ({b.accountNumber}) [Bal: ₹
                  {b.currentBalance.toLocaleString('en-IN')}]
                </option>
              ))}
            </select>
            {(!bankAccounts || bankAccounts.length === 0) && (
              <p className="text-[10px] text-amber-600 font-medium mt-1">
                No active bank accounts found. Please add one in Ledger first.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Vendor / Payee (Optional)
          </label>
          <input
            type="text"
            placeholder="Vendor or payee name"
            value={formData.vendor}
            onChange={e => setFormData({ ...formData, vendor: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Description *
          </label>
          <input
            type="text"
            required
            placeholder="Brief description of expense"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Notes (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="Additional remarks..."
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <EnterpriseButton
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </EnterpriseButton>
          <EnterpriseButton
            variant="primary"
            type="submit"
            loading={loading}
            disabled={loading}
          >
            {isEdit ? 'Update Expense' : 'Save Expense'}
          </EnterpriseButton>
        </div>
      </form>
    </EnterpriseModal>
  )
}
