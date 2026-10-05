import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import EnterpriseNumberInput from '../../../../components/ui/EnterpriseNumberInput'
import { Search, Plus, X } from 'lucide-react'
import {
  simpleAccountsService,
  type SimpleExpense,
  type BankAccountDropdown,
  type CashBookDropdown
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

  const queryClient = useQueryClient()
  const { data: dbCategories = [] } = useQuery({
    queryKey: ['expenseCategories'],
    queryFn: () => simpleAccountsService.getExpenseCategories(),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen
  })

  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [categoryModalError, setCategoryModalError] = useState<string | null>(null)

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

  const categoryOptions = useMemo(() => {
    const names = dbCategories.map(c => c.name)
    const set = new Set(names.length > 0 ? names : EXPENSE_CATEGORIES)
    if (formData.category && !set.has(formData.category)) {
      set.add(formData.category)
    }
    return Array.from(set)
  }, [dbCategories, formData.category])

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newCategoryName.trim()
    if (!trimmed) {
      setCategoryModalError('Category name is required.')
      return
    }

    if (categoryOptions.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryModalError(`Category "${trimmed}" already exists.`)
      return
    }

    try {
      setIsCreatingCategory(true)
      setCategoryModalError(null)

      const created = await simpleAccountsService.createExpenseCategory({ name: trimmed })

      await queryClient.invalidateQueries({ queryKey: ['expenseCategories'] })

      // Auto-select new category while preserving all other entered form data
      setFormData(prev => ({ ...prev, category: created.name }))

      setIsCreateCategoryOpen(false)
      setNewCategoryName('')
    } catch (err: any) {
      setCategoryModalError(
        err.response?.data?.message || err.message || 'Failed to create category.'
      )
    } finally {
      setIsCreatingCategory(false)
    }
  }

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
    <>
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Category *
              </label>
              <button
                type="button"
                onClick={() => {
                  setNewCategoryName('')
                  setCategoryModalError(null)
                  setIsCreateCategoryOpen(true)
                }}
                className="text-xs font-semibold text-[#1A56DB] hover:text-blue-700 active:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer focus:outline-none focus-visible:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Category</span>
              </button>
            </div>
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
                {categoryOptions.map(c => {
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

    {/* Compact Create Expense Category Modal */}
    {isCreateCategoryOpen && (
      <div 
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => !isCreatingCategory && setIsCreateCategoryOpen(false)}
      >
        <div
          className="relative w-full max-w-sm bg-white border border-slate-200 rounded-[14px] shadow-2xl p-5 sm:p-6 animate-in zoom-in-95 duration-150 text-left"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h4 className="text-sm font-bold text-slate-800 tracking-tight">
              Create Expense Category
            </h4>
            <button
              type="button"
              onClick={() => !isCreatingCategory && setIsCreateCategoryOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              disabled={isCreatingCategory}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {categoryModalError && (
            <div className="p-2.5 mb-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {categoryModalError}
            </div>
          )}

          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Category Name *
              </label>
              <input
                type="text"
                autoFocus
                required
                placeholder="E.g., Vehicle Maintenance"
                value={newCategoryName}
                onChange={e => {
                  setNewCategoryName(e.target.value)
                  if (categoryModalError) setCategoryModalError(null)
                }}
                disabled={isCreatingCategory}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100/50"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <EnterpriseButton
                type="button"
                variant="secondary"
                onClick={() => setIsCreateCategoryOpen(false)}
                disabled={isCreatingCategory}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                disabled={isCreatingCategory || !newCategoryName.trim()}
              >
                {isCreatingCategory ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating...</span>
                  </span>
                ) : (
                  'Create Category'
                )}
              </EnterpriseButton>
            </div>
          </form>
        </div>
      </div>
    )}
  </>
  )
}
