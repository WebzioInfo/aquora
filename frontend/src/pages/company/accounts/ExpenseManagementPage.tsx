import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type { SimpleExpense, CreateSimpleExpenseRequest, UpdateSimpleExpenseRequest, BankAccountDropdown, CashBookDropdown } from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import EnterpriseNumberInput from '../../../components/ui/EnterpriseNumberInput'
import { Plus, Search, Eye, Edit2, Trash2, Landmark, RefreshCw, Printer } from 'lucide-react'
import { PrintPreviewModal } from '../../../components/ui/PrintPreviewModal'

const EXPENSE_CATEGORIES = [
  'Salary',
  'Electricity',
  'Fuel',
  'Maintenance',
  'Vehicle',
  'Rent',
  'Office',
  'Purchase Related',
  'Miscellaneous'
]

const PAYMENT_METHODS = ['Cash', 'Bank']

export const ExpenseManagementPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()

  // Filter & Search states
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<SimpleExpense | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Print Preview Modal States
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printDocData, setPrintDocData] = useState<any>(null)

  // Form Fields
  const [formData, setFormData] = useState<{
    expenseDate: string
    category: string
    vendor: string
    description: string
    amount: number
    paymentMethod: string
    bankAccountId: string
    cashBookId: string
    notes: string
  }>({
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

  const handlePrintExpense = (exp: SimpleExpense) => {
    setPrintDocData({
      title: 'Expense Voucher',
      docNumber: exp.expenseNumber || 'EXP-VOUCHER',
      date: new Date(exp.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      partyLabel: 'Paid To / Vendor',
      partyInfo: {
        name: exp.vendor || 'General Vendor',
        details1: 'Category: ' + exp.category
      },
      preparedBy: 'Authorized Person',
      paymentDetails: {
        method: exp.paymentMethod || 'Cash',
        reference: exp.expenseNumber || '—'
      },
      items: [
        {
          sno: 1,
          description: exp.description || 'Business operational expense',
          quantity: 1,
          unitPrice: exp.amount,
          amount: exp.amount
        }
      ],
      financialSummary: {
        subTotal: exp.amount,
        grandTotal: exp.amount,
        amountPaid: exp.amount,
        balance: 0
      },
      notes: exp.notes || 'No remarks provided.'
    });
    setPrintModalOpen(true);
  };

  // Bank Search Term in Modal
  const [bankSearchTerm, setBankSearchTerm] = useState('')
  const [cashBookSearchTerm, setCashBookSearchTerm] = useState('')

  // Query bank accounts dropdown
  const { data: bankAccounts } = useQuery<BankAccountDropdown[]>({
    queryKey: ['bankAccountDropdownList'],
    queryFn: () => simpleAccountsService.getBankAccountDropdown()
  })

  const { data: cashBooks } = useQuery<CashBookDropdown[]>({
    queryKey: ['cashBookDropdownList'],
    queryFn: () => simpleAccountsService.getCashBookDropdown()
  })

  // Query expenses
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['expensesList', pageNumber, pageSize, searchTerm, categoryFilter, paymentMethodFilter, startDateFilter, endDateFilter],
    queryFn: () => simpleAccountsService.getExpenses({
      pageNumber,
      pageSize,
      search: searchTerm || undefined,
      category: categoryFilter || undefined,
      paymentMethod: paymentMethodFilter || undefined,
      startDate: startDateFilter ? new Date(startDateFilter).toISOString() : undefined,
      endDate: endDateFilter ? new Date(endDateFilter).toISOString() : undefined
    })
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (req: CreateSimpleExpenseRequest) => simpleAccountsService.createExpense(req),
    onSuccess: () => {
      showToast('Expense created successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['expensesList'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
      setIsCreateModalOpen(false)
      resetForm()
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to create expense.')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateSimpleExpenseRequest }) => simpleAccountsService.updateExpense(id, req),
    onSuccess: () => {
      showToast('Expense updated successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['expensesList'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
      setIsEditModalOpen(false)
      setSelectedExpense(null)
      resetForm()
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to update expense.')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => simpleAccountsService.deleteExpense(id),
    onSuccess: () => {
      showToast('Expense deleted successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['expensesList'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to delete expense.', 'error')
    }
  })

  const resetForm = () => {
    setFormData({
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
    setBankSearchTerm('')
    setCashBookSearchTerm('')
    setFormError(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    if (bankAccounts && bankAccounts.length > 0) {
      setFormData(prev => ({ ...prev, bankAccountId: bankAccounts[0].id }))
    }
    setIsCreateModalOpen(true)
  }

  const handleOpenEdit = (expense: SimpleExpense) => {
    setSelectedExpense(expense)
    setFormData({
      expenseDate: new Date(expense.expenseDate).toISOString().split('T')[0],
      category: expense.category,
      vendor: expense.vendor || '',
      description: expense.description,
      amount: expense.amount,
      paymentMethod: expense.paymentMethod.toLowerCase() === 'bank' ? 'Bank' : 'Cash',
      bankAccountId: expense.bankAccountId || (bankAccounts && bankAccounts.length > 0 ? bankAccounts[0].id : ''),
      cashBookId: expense.cashBookId || (cashBooks && cashBooks.length > 0 ? cashBooks[0].id : ''),
      notes: expense.notes || ''
    })
    setBankSearchTerm('')
    setCashBookSearchTerm('')
    setFormError(null)
    setIsEditModalOpen(true)
  }

  const handleOpenView = (expense: SimpleExpense) => {
    setSelectedExpense(expense)
    setIsViewModalOpen(true)
  }

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault()
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

    const req: CreateSimpleExpenseRequest = {
      expenseDate: new Date(formData.expenseDate).toISOString(),
      category: formData.category,
      vendor: formData.vendor.trim() || undefined,
      description: formData.description.trim(),
      amount: formData.amount,
      paymentMethod: formData.paymentMethod,
      bankAccountId: formData.paymentMethod === 'Bank' ? formData.bankAccountId : undefined,
      cashBookId: formData.paymentMethod === 'Cash' ? formData.cashBookId : undefined,
      notes: formData.notes.trim() || undefined
    }
    createMutation.mutate(req)
  }

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedExpense) return
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

    const req: UpdateSimpleExpenseRequest = {
      expenseDate: new Date(formData.expenseDate).toISOString(),
      category: formData.category,
      vendor: formData.vendor.trim() || undefined,
      description: formData.description.trim(),
      amount: formData.amount,
      paymentMethod: formData.paymentMethod,
      bankAccountId: formData.paymentMethod === 'Bank' ? formData.bankAccountId : undefined,
      cashBookId: formData.paymentMethod === 'Cash' ? formData.cashBookId : undefined,
      notes: formData.notes.trim() || undefined
    }
    updateMutation.mutate({ id: selectedExpense.id, req })
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      deleteMutation.mutate(id)
    }
  }

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN')}`
  }

  // Filtered bank accounts for searchable dropdown
  const filteredBankAccounts = (bankAccounts || []).filter(b =>
    !bankSearchTerm ||
    b.bankName.toLowerCase().includes(bankSearchTerm.toLowerCase()) ||
    b.accountName.toLowerCase().includes(bankSearchTerm.toLowerCase()) ||
    b.accountNumber.toLowerCase().includes(bankSearchTerm.toLowerCase())
  )
  const filteredCashBooks = (cashBooks || []).filter(c => !cashBookSearchTerm || c.name.toLowerCase().includes(cashBookSearchTerm.toLowerCase()))

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <EnterpriseHeader
        title="Expense Management"
        description="Record operational expenses, manage payment sources, and maintain automated bank balance deductions."
        actions={
          <EnterpriseButton variant="primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-2" /> Add Expense
          </EnterpriseButton>
        }
      />

      {/* FILTER TOOLBAR */}
      <EnterpriseCard className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Expense #, Description or Category..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPageNumber(1); }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPageNumber(1); }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Payment Method Filter */}
          <select
            value={paymentMethodFilter}
            onChange={(e) => { setPaymentMethodFilter(e.target.value); setPageNumber(1); }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Payment Methods</option>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Start Date */}
          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => { setStartDateFilter(e.target.value); setPageNumber(1); }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </EnterpriseCard>

      {/* TABLE */}
      <EnterpriseCard className="p-5 overflow-hidden">
        {isLoading ? (
          <EnterpriseLoading label="Loading expenses..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  {/* <th className="p-3">Expense #</th> */}
                  <th className="p-3">Date</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Paid From</th>
                  <th className="p-3">Created By</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items && data.items.length > 0 ? (
                  data.items.map((expense) => (
                    <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                      {/* <td className="p-3 font-bold text-slate-900">{expense.expenseNumber}</td> */}
                      <td className="p-3 text-slate-600">{new Date(expense.expenseDate).toLocaleDateString()}</td>
                      <td className="p-3"><EnterpriseBadge variant="gray">{expense.category}</EnterpriseBadge></td>
                      <td className="p-3 text-slate-700 max-w-[200px] truncate" title={expense.description}>{expense.description}</td>
                      <td className="p-3 text-right font-bold text-rose-600">{formatCurrency(expense.amount)}</td>
                      <td className="p-3 font-semibold text-slate-700">
                        {expense.paymentMethod.toLowerCase() === 'bank' ? (
                          <span className="flex items-center gap-1.5 text-indigo-600 font-bold">
                            <Landmark className="w-3.5 h-3.5" />
                            {expense.paidFrom || expense.bankAccountName || 'Bank'}
                          </span>
                        ) : (
                          <span className="text-slate-600">{expense.paidFrom || expense.cashBookName || 'Cash'}</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 font-semibold">{expense.createdByName || expense.createdBy || 'System'}</td>
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenView(expense)}
                          className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(expense)}
                          className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                          title="Edit Expense"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handlePrintExpense(expense)}
                          className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                          title="Print Expense Voucher"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-medium">No expenses found matching the criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* PAGINATION */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-500 font-semibold">
                  Page {data.pageNumber} of {data.totalPages} ({data.totalCount} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={!data.hasPreviousPage}
                    onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 border border-slate-200 rounded text-xs font-semibold disabled:opacity-40 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={!data.hasNextPage}
                    onClick={() => setPageNumber(p => p + 1)}
                    className="px-3 py-1.5 border border-slate-200 rounded text-xs font-semibold disabled:opacity-40 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </EnterpriseCard>

      {/* CREATE EXPENSE MODAL */}
      {isCreateModalOpen && (
        <EnterpriseModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Add New Expense"
        >
          <form onSubmit={handleSubmitCreate} className="space-y-4">
            {formError && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Expense Date</label>
                <input
                  type="date"
                  required
                  value={formData.expenseDate}
                  onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <EnterpriseNumberInput
                  label="Amount (₹)"
                  placeholder="0.00"
                  value={formData.amount}
                  onValueChange={(val) => setFormData({ ...formData, amount: Number(val) || 0 })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                >
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>


            {formData.paymentMethod === 'Cash' && (
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-emerald-900 uppercase">Select Cash Book *</label>
                <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search cash book..." value={cashBookSearchTerm} onChange={(e) => setCashBookSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600" /></div>
                <select value={formData.cashBookId} onChange={(e) => setFormData({ ...formData, cashBookId: e.target.value })} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 font-semibold">
                  <option value="">-- Choose Cash Book --</option>
                  {filteredCashBooks.map(c => <option key={c.id} value={c.id}>{c.name} [Bal: ₹ {c.currentBalance.toLocaleString('en-IN')}]</option>)}
                </select>
                {(!cashBooks || cashBooks.length === 0) && <p className="text-[10px] text-amber-600 font-medium mt-1">No active cash books found. Please create one in Ledger first.</p>}
              </div>
            )}
            {/* SEARCHABLE BANK SELECTOR IF PAYMENT METHOD == BANK */}
            {formData.paymentMethod === 'Bank' && (
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-indigo-900 uppercase">Select Bank Account *</label>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search bank name or account..."
                    value={bankSearchTerm}
                    onChange={(e) => setBankSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* Dropdown Select */}
                <select
                  value={formData.bankAccountId}
                  onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600 font-semibold"
                >
                  <option value="">-- Choose Bank Account --</option>
                  {filteredBankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountName} ({b.accountNumber}) [Bal: ₹{b.currentBalance.toLocaleString('en-IN')}]
                    </option>
                  ))}
                </select>

                {(!bankAccounts || bankAccounts.length === 0) && (
                  <p className="text-[10px] text-amber-600 font-medium mt-1">
                    No active bank accounts found. Please add a bank account in Bank Accounts page first.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vendor (Optional)</label>
              <input
                type="text"
                placeholder="Vendor or payee name"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
              <input
                type="text"
                required
                placeholder="Brief description of expense"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="Additional remarks..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <EnterpriseButton variant="secondary" type="button" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton variant="primary" type="submit" loading={createMutation.isPending}>
                Save Expense
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* EDIT EXPENSE MODAL */}
      {isEditModalOpen && (
        <EnterpriseModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Expense"
        >
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            {formError && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Expense Date</label>
                <input
                  type="date"
                  required
                  value={formData.expenseDate}
                  onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <EnterpriseNumberInput
                  label="Amount (₹)"
                  placeholder="0.00"
                  value={formData.amount}
                  onValueChange={(val) => setFormData({ ...formData, amount: Number(val) || 0 })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                >
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>


            {formData.paymentMethod === 'Cash' && (
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-emerald-900 uppercase">Select Cash Book *</label>
                <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search cash book..." value={cashBookSearchTerm} onChange={(e) => setCashBookSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600" /></div>
                <select value={formData.cashBookId} onChange={(e) => setFormData({ ...formData, cashBookId: e.target.value })} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 font-semibold">
                  <option value="">-- Choose Cash Book --</option>
                  {filteredCashBooks.map(c => <option key={c.id} value={c.id}>{c.name} [Bal: ?{c.currentBalance.toLocaleString('en-IN')}]</option>)}
                </select>
                {(!cashBooks || cashBooks.length === 0) && <p className="text-[10px] text-amber-600 font-medium mt-1">No active cash books found. Please create one in Ledger first.</p>}
              </div>
            )}
            {/* SEARCHABLE BANK SELECTOR IF PAYMENT METHOD == BANK */}
            {formData.paymentMethod === 'Bank' && (
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-indigo-900 uppercase">Select Bank Account *</label>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search bank name or account..."
                    value={bankSearchTerm}
                    onChange={(e) => setBankSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* Dropdown Select */}
                <select
                  value={formData.bankAccountId}
                  onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600 font-semibold"
                >
                  <option value="">-- Choose Bank Account --</option>
                  {filteredBankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountName} ({b.accountNumber}) [Bal: ₹{b.currentBalance.toLocaleString('en-IN')}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vendor (Optional)</label>
              <input
                type="text"
                placeholder="Vendor or payee name"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
              <input
                type="text"
                required
                placeholder="Brief description of expense"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="Additional remarks..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <EnterpriseButton variant="secondary" type="button" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton variant="primary" type="submit" loading={updateMutation.isPending}>
                Update Expense
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* VIEW EXPENSE DETAILS MODAL */}
      {isViewModalOpen && selectedExpense && (
        <EnterpriseModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title={`Expense ${selectedExpense.expenseNumber}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block font-semibold uppercase">Category</span>
                <span className="font-bold text-slate-900">{selectedExpense.category}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold uppercase">Expense Date</span>
                <span className="font-bold text-slate-900">{new Date(selectedExpense.expenseDate).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold uppercase">Amount</span>
                <span className="font-black text-rose-600 text-sm">{formatCurrency(selectedExpense.amount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold uppercase">Paid From</span>
                <span className="font-bold text-indigo-600">{selectedExpense.paidFrom || selectedExpense.paymentMethod}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500 font-semibold block uppercase">Vendor</span>
                <span className="text-slate-800 font-medium">{selectedExpense.vendor || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block uppercase">Description</span>
                <span className="text-slate-800 font-medium">{selectedExpense.description}</span>
              </div>
              {selectedExpense.notes && (
                <div>
                  <span className="text-slate-500 font-semibold block uppercase">Notes</span>
                  <span className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 block">{selectedExpense.notes}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex justify-between">
                <span>Created by: <strong className="text-slate-700">{selectedExpense.createdByName || selectedExpense.createdBy}</strong></span>
                <span>On: {new Date(selectedExpense.createdDate).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <EnterpriseButton variant="secondary" onClick={() => setIsViewModalOpen(false)}>
                Close
              </EnterpriseButton>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* PRINT PREVIEW MODAL */}
      {printModalOpen && printDocData && (
        <PrintPreviewModal
          isOpen={printModalOpen}
          onClose={() => {
            setPrintModalOpen(false)
            setPrintDocData(null)
          }}
          documentData={printDocData}
        />
      )}
    </div>
  )
}

export default ExpenseManagementPage
