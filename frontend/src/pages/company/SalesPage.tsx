import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Search, Plus, Eye, Edit2, Trash2, X, AlertTriangle, 
  User as UserIcon, Calendar, ArrowUpDown, Filter, ChevronLeft, ChevronRight, CheckCircle2,
  Package, ShoppingCart, Info, Phone, MessageSquare, Tag, FileSpreadsheet
} from 'lucide-react'
import { salesService } from '../../services/sales'
import type { SalesTransaction, CreateSalesTransactionRequest } from '../../services/sales'
import { productsService } from '../../services/products'
import { customersService } from '../../services/customers'
import { useAuthStore } from '../../store/useAuthStore'
import EnterpriseHeader from '../../components/ui/EnterpriseHeader'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseButton from '../../components/ui/EnterpriseButton'

const PremiumLabel: React.FC<{ label: string; required?: boolean }> = ({ label, required }) => {
  const hasAsterisk = required || label.endsWith('*');
  const cleanLabel = hasAsterisk ? label.replace('*', '').trim() : label;
  return (
    <label className="text-[13px] font-semibold text-gray-700 select-none mb-1.5 flex items-center">
      <span>{cleanLabel}</span>
      {hasAsterisk && <span className="text-red-500 ml-1 font-bold text-xs select-none">*</span>}
    </label>
  );
};

export const SalesPage: React.FC<{ canWrite: boolean; showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void }> = ({ canWrite, showToast }) => {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  // Table parameters
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [productIdFilter, setProductIdFilter] = useState('')
  const [customerIdFilter, setCustomerIdFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Selected records
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null)
  const [selectedTxn, setSelectedTxn] = useState<SalesTransaction | null>(null)

  // Forms
  const [formType, setFormType] = useState('Sales Dispatch')
  const [formProductId, setFormProductId] = useState('')
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formCases, setFormCases] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().substring(0, 10))
  const [formRef, setFormRef] = useState('')
  const [formRemarks, setFormRemarks] = useState('')

  // Searchable customer dropdown UI state
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)

  // Queries
  const { data: txnsData, isLoading: isTxnsLoading } = useQuery({
    queryKey: ['salesTransactionsList', page, search, productIdFilter, customerIdFilter, typeFilter, statusFilter, startDateFilter, endDateFilter, sortOrder],
    queryFn: () => salesService.getTransactions(
      page, 10, search, productIdFilter, customerIdFilter, typeFilter, statusFilter, startDateFilter, endDateFilter, sortOrder
    )
  })

  const transactions = txnsData?.data?.items || []
  const pagination = txnsData?.data

  // Fetch all active products for selection
  const { data: productsData } = useQuery({
    queryKey: ['activeProductsForSales'],
    queryFn: async () => {
      const res = await productsService.getProducts(1, 100, '')
      return res.data?.items.filter(p => p.isActive) || []
    }
  })
  const products = productsData || []

  // Fetch all active customers for selection
  const { data: customersData } = useQuery({
    queryKey: ['activeCustomersForSales'],
    queryFn: async () => {
      const res = await customersService.getCustomers(1, 100, '', '', 'Active')
      return res.data?.items.filter(c => c.isActive) || []
    }
  })
  const customers = customersData || []

  // Computed properties for selected product and customer in form
  const selectedProductInForm = useMemo(() => {
    return products.find(p => p.id === formProductId)
  }, [products, formProductId])

  const selectedCustomerInForm = useMemo(() => {
    return customers.find(c => c.id === formCustomerId)
  }, [customers, formCustomerId])

  // Filtered customers list for the searchable dropdown
  const filteredCustomersForForm = useMemo(() => {
    if (!customerSearch) return customers
    const s = customerSearch.toLowerCase()
    return customers.filter(c => 
      c.customerName.toLowerCase().includes(s) || 
      c.customerCode.toLowerCase().includes(s) || 
      (c.businessName && c.businessName.toLowerCase().includes(s))
    )
  }, [customers, customerSearch])

  // Mutations
  const createMutation = useMutation({
    mutationFn: salesService.createTransaction,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Sales transaction recorded successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['salesTransactionsList'] })
        queryClient.invalidateQueries({ queryKey: ['salesDashboard'] })
        queryClient.invalidateQueries({ queryKey: ['activeProductsForSales'] })
        setIsCreateOpen(false)
        resetForm()
      } else {
        showToast(res.message || 'Failed to create transaction.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Error creating transaction.', 'error')
    }
  })

  const updateMutation = useMutation({
    mutationFn: salesService.updateTransaction,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Sales transaction updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['salesTransactionsList'] })
        queryClient.invalidateQueries({ queryKey: ['salesDashboard'] })
        queryClient.invalidateQueries({ queryKey: ['activeProductsForSales'] })
        setIsEditOpen(false)
        resetForm()
      } else {
        showToast(res.message || 'Failed to update transaction.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Error updating transaction.', 'error')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: salesService.deleteTransaction,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Transaction deleted and stock successfully restored.', 'success')
        queryClient.invalidateQueries({ queryKey: ['salesTransactionsList'] })
        queryClient.invalidateQueries({ queryKey: ['salesDashboard'] })
        queryClient.invalidateQueries({ queryKey: ['activeProductsForSales'] })
        setIsDeleteOpen(false)
        setSelectedTxn(null)
      } else {
        showToast(res.message || 'Failed to delete transaction.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Error deleting transaction.', 'error')
    }
  })

  // Handlers
  const resetForm = () => {
    setFormType('Sales Dispatch')
    setFormProductId('')
    setFormCustomerId('')
    setFormCases('')
    setFormDate(new Date().toISOString().substring(0, 10))
    setFormRef('')
    setFormRemarks('')
    setCustomerSearch('')
  }

  const handleOpenCreate = () => {
    if (!canWrite) {
      showToast('You do not have write permissions.', 'warning')
      return
    }
    resetForm()
    setIsCreateOpen(true)
  }

  const handleOpenView = (txn: SalesTransaction) => {
    setSelectedTxn(txn)
    setIsViewOpen(true)
  }

  const handleOpenEdit = (txn: SalesTransaction) => {
    if (!canWrite) {
      showToast('You do not have write permissions.', 'warning')
      return
    }
    setSelectedTxn(txn)
    setFormType(txn.transactionType)
    setFormProductId(txn.productId)
    setFormCustomerId(txn.customerId)
    setFormCases(txn.cases.toString())
    setFormDate(txn.transactionDate.substring(0, 10))
    setFormRef(txn.referenceNumber || '')
    setFormRemarks(txn.remarks || '')
    const matchedCustomer = customers.find(c => c.id === txn.customerId)
    setCustomerSearch(matchedCustomer ? matchedCustomer.customerName : '')
    setIsEditOpen(true)
  }

  const handleOpenDelete = (txn: SalesTransaction) => {
    if (!canWrite) {
      showToast('You do not have write permissions.', 'warning')
      return
    }
    setSelectedTxn(txn)
    setIsDeleteOpen(true)
  }

  // Submission validation logic
  const validateForm = (): boolean => {
    if (!formType || !formProductId || !formCustomerId || !formCases || !formDate) {
      showToast('Please fill in all required fields.', 'warning')
      return false
    }

    const casesNum = parseFloat(formCases)
    if (isNaN(casesNum) || casesNum <= 0) {
      showToast('Cases must be a valid number greater than 0.', 'warning')
      return false
    }

    // Check available stock for Sales Dispatch and Damage
    if (formType === 'Sales Dispatch' || formType === 'Damage') {
      const prod = products.find(p => p.id === formProductId)
      if (prod) {
        let maxAvailable = prod.currentStock
        // If we are editing, we add back the original cases of this transaction to calculate stock correctly
        if (isEditOpen && selectedTxn && selectedTxn.productId === formProductId) {
          maxAvailable += selectedTxn.cases
        }

        if (casesNum > maxAvailable) {
          showToast(`Insufficient stock. Max available: ${maxAvailable} Cases.`, 'error')
          return false
        }
      }
    }

    return true
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: CreateSalesTransactionRequest = {
      customerId: formCustomerId,
      productId: formProductId,
      cases: parseFloat(formCases),
      transactionType: formType,
      transactionDate: formDate,
      referenceNumber: formRef ? formRef.trim() : undefined,
      remarks: formRemarks ? formRemarks.trim() : undefined
    }

    createMutation.mutate(payload)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTxn) return
    if (!validateForm()) return

    const payload: CreateSalesTransactionRequest = {
      customerId: formCustomerId,
      productId: formProductId,
      cases: parseFloat(formCases),
      transactionType: formType,
      transactionDate: formDate,
      referenceNumber: formRef ? formRef.trim() : undefined,
      remarks: formRemarks ? formRemarks.trim() : undefined
    }

    updateMutation.mutate({ id: selectedTxn.id, data: payload })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-5">
        <EnterpriseHeader 
          title="Sales Ledger & Dispatch" 
          description="Log finished goods dispatches, returns, and damages with proper inventory adjustments."
        />
        <EnterpriseButton
          variant="primary"
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 h-10 px-4 text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Transaction
        </EnterpriseButton>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450" />
            <input 
              type="text"
              placeholder="Search txn, customer, product..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-4 w-full h-[40px] text-xs bg-white border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="w-full h-[40px] px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">All Transaction Types</option>
              <option value="Sales Dispatch">Sales Dispatch</option>
              <option value="Customer Return">Customer Return</option>
              <option value="Damage">Damage</option>
            </select>
          </div>

          <div>
            <select
              value={productIdFilter}
              onChange={(e) => { setProductIdFilter(e.target.value); setPage(1); }}
              className="w-full h-[40px] px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">All Finished Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={customerIdFilter}
              onChange={(e) => { setCustomerIdFilter(e.target.value); setPage(1); }}
              className="w-full h-[40px] px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">All Customers</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.customerName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100/50">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-550 whitespace-nowrap">Start:</span>
            <input 
              type="date"
              value={startDateFilter}
              onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }}
              className="w-full h-[36px] px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-550 whitespace-nowrap">End:</span>
            <input 
              type="date"
              value={endDateFilter}
              onChange={(e) => { setEndDateFilter(e.target.value); setPage(1); }}
              className="w-full h-[36px] px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
            />
          </div>

          <div>
            <select
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}
              className="w-full h-[36px] px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="largest_qty">Sort: Largest Quantity</option>
            </select>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={() => {
                setSearch('')
                setProductIdFilter('')
                setCustomerIdFilter('')
                setTypeFilter('')
                setStatusFilter('')
                setStartDateFilter('')
                setEndDateFilter('')
                setSortOrder('newest')
                setPage(1)
              }}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        {isTxnsLoading ? (
          <div className="py-20 flex flex-col justify-center items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-xs font-semibold text-slate-400">Loading ledger logs...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-20 flex flex-col justify-center items-center text-center">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 stroke-[1.2] mb-3" />
            <h3 className="text-sm font-bold text-slate-700">No Sales Transactions</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">No transactions matched your search filters. Click 'Create Transaction' to log stock changes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Transaction No</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Cases</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {new Date(txn.transactionDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {txn.transactionNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {txn.customerName}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {txn.productName}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        txn.transactionType === 'Sales Dispatch' 
                          ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                          : txn.transactionType === 'Customer Return' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {txn.transactionType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black tabular-nums text-slate-800">
                      {txn.cases.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <EnterpriseBadge variant="success">{txn.status}</EnterpriseBadge>
                    </td>
                    <td className="py-3 px-4 text-slate-650">
                      {txn.createdByName}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenView(txn)}
                          title="View Details"
                          className="p-1.5 text-slate-400 hover:text-blue-650 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(txn)}
                          title="Edit Transaction"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(txn)}
                          title="Delete/Reverse"
                          className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION CONTROLS */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing page <strong className="font-bold text-slate-700">{page}</strong> of <strong className="font-bold text-slate-700">{pagination.totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                Record Sales Transaction
              </h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-650">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Transaction Type */}
                <div className="flex flex-col">
                  <PremiumLabel label="Transaction Type *" />
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] bg-white rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50 appearance-none cursor-pointer"
                  >
                    <option value="Sales Dispatch">Sales Dispatch</option>
                    <option value="Customer Return">Customer Return</option>
                    <option value="Damage">Damage</option>
                  </select>
                </div>

                {/* Transaction Date */}
                <div className="flex flex-col">
                  <PremiumLabel label="Transaction Date *" />
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50"
                  />
                </div>
              </div>

              {/* Product Selection */}
              <div className="flex flex-col">
                <PremiumLabel label="Product *" />
                <select
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] bg-white rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50"
                >
                  <option value="">Select Finished Product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku ? `(SKU: ${p.sku})` : ''}</option>
                  ))}
                </select>

                {/* Live Product details indicator */}
                {selectedProductInForm && (
                  <div className="mt-2.5 bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-blue-800">
                      <span className="font-medium flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        Current Stock:
                      </span>
                      <span className="font-bold font-mono text-[12px]">{selectedProductInForm.currentStock.toLocaleString()} Cases</span>
                    </div>
                    <div className="flex items-center justify-between text-blue-800">
                      <span className="font-medium">Available Stock:</span>
                      <span className="font-bold font-mono text-[12px]">{selectedProductInForm.currentStock.toLocaleString()} Cases</span>
                    </div>
                    <div className="flex items-center justify-between text-blue-800">
                      <span className="font-medium">Unit:</span>
                      <span>Cases</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Searchable Customer Selection */}
              <div className="flex flex-col relative">
                <PremiumLabel label="Customer *" />
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search and select active customer..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      setIsCustomerDropdownOpen(true)
                    }}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerSearch('')
                        setFormCustomerId('')
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isCustomerDropdownOpen && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomersForForm.length === 0 ? (
                      <div className="py-3 px-4 text-xs text-slate-400 italic">No customers found.</div>
                    ) : (
                      filteredCustomersForForm.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setFormCustomerId(c.id)
                            setCustomerSearch(c.customerName)
                            setIsCustomerDropdownOpen(false)
                          }}
                          className="w-full text-left py-2.5 px-4 text-xs hover:bg-slate-50 transition-colors border-b border-slate-100/50 last:border-0"
                        >
                          <div className="font-bold text-slate-700">{c.customerName}</div>
                          <div className="text-[10px] text-slate-450 mt-0.5">{c.customerCode} &bull; {c.phone}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Selected Customer details panel */}
                {selectedCustomerInForm && (
                  <div className="mt-2.5 bg-slate-50 border border-slate-150 rounded-lg p-3 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        Customer Code:
                      </span>
                      <span className="font-bold font-mono text-slate-800">{selectedCustomerInForm.customerCode}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        Contact:
                      </span>
                      <span>{selectedCustomerInForm.phone}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-650">
                      <span className="font-medium flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        Outstanding Balance:
                      </span>
                      <span className={`font-bold font-mono ${
                        selectedCustomerInForm.balanceType === 'Receivable' ? 'text-blue-600' : selectedCustomerInForm.balanceType === 'Payable' ? 'text-rose-500' : 'text-slate-700'
                      }`}>
                        {selectedCustomerInForm.balanceType === 'Receivable' ? '+' : selectedCustomerInForm.balanceType === 'Payable' ? '-' : ''}
                        ₹{selectedCustomerInForm.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Cases Quantity and Reference Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <PremiumLabel label="Quantity (Cases) *" />
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Enter cases..."
                    value={formCases}
                    onChange={(e) => setFormCases(e.target.value)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50"
                  />
                </div>

                <div className="flex flex-col">
                  <PremiumLabel label="Reference Number" />
                  <input
                    type="text"
                    placeholder="E.g., Invoice, Lorry No..."
                    value={formRef}
                    onChange={(e) => setFormRef(e.target.value)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div className="flex flex-col">
                <PremiumLabel label="Remarks" />
                <textarea
                  placeholder="Notes about transport, payment, etc..."
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  className="w-full p-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50 min-h-[70px]"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <EnterpriseButton
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 bg-blue-650 hover:bg-blue-750 text-white rounded-lg h-11 text-sm font-semibold transition-all shadow-md shadow-blue-200/50 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving Transaction...
                    </>
                  ) : (
                    'Record Transaction'
                  )}
                </EnterpriseButton>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="w-[100px] h-11 border border-slate-200 text-slate-500 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditOpen && selectedTxn && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-500" />
                Edit Transaction: {selectedTxn.transactionNumber}
              </h2>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-650">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Important transactional warning banner */}
              <div className="bg-amber-50 border border-amber-250 rounded-lg p-3.5 text-xs text-amber-800 flex items-start gap-2.5 leading-relaxed">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Important Stock Reversal Alert:</span>
                  <p className="mt-0.5">
                    Modifying this transaction will automatically reverse the original stock movement of <strong>{selectedTxn.cases} Cases</strong> before applying the new quantity. This prevents stock duplication or inconsistencies.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Transaction Type */}
                <div className="flex flex-col">
                  <PremiumLabel label="Transaction Type *" />
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] bg-white rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50 appearance-none cursor-pointer"
                  >
                    <option value="Sales Dispatch">Sales Dispatch</option>
                    <option value="Customer Return">Customer Return</option>
                    <option value="Damage">Damage</option>
                  </select>
                </div>

                {/* Transaction Date */}
                <div className="flex flex-col">
                  <PremiumLabel label="Transaction Date *" />
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              {/* Product Selection */}
              <div className="flex flex-col">
                <PremiumLabel label="Product *" />
                <select
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] bg-white rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Finished Product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku ? `(SKU: ${p.sku})` : ''}</option>
                  ))}
                </select>

                {/* Live Product details indicator */}
                {selectedProductInForm && (
                  <div className="mt-2.5 bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-blue-800">
                      <span className="font-medium flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        Current Stock:
                      </span>
                      <span className="font-bold font-mono text-[12px]">{selectedProductInForm.currentStock.toLocaleString()} Cases</span>
                    </div>
                    <div className="flex items-center justify-between text-blue-800">
                      <span className="font-medium">Unit:</span>
                      <span>Cases</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Searchable Customer Selection */}
              <div className="flex flex-col relative">
                <PremiumLabel label="Customer *" />
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search and select active customer..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      setIsCustomerDropdownOpen(true)
                    }}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerSearch('')
                        setFormCustomerId('')
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isCustomerDropdownOpen && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomersForForm.length === 0 ? (
                      <div className="py-3 px-4 text-xs text-slate-400 italic">No customers found.</div>
                    ) : (
                      filteredCustomersForForm.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setFormCustomerId(c.id)
                            setCustomerSearch(c.customerName)
                            setIsCustomerDropdownOpen(false)
                          }}
                          className="w-full text-left py-2.5 px-4 text-xs hover:bg-slate-50 transition-colors border-b border-slate-100/50 last:border-0"
                        >
                          <div className="font-bold text-slate-700">{c.customerName}</div>
                          <div className="text-[10px] text-slate-450 mt-0.5">{c.customerCode} &bull; {c.phone}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Selected Customer details panel */}
                {selectedCustomerInForm && (
                  <div className="mt-2.5 bg-slate-50 border border-slate-150 rounded-lg p-3 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium">Customer Code:</span>
                      <span className="font-bold font-mono text-slate-800">{selectedCustomerInForm.customerCode}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-650">
                      <span className="font-medium">Outstanding Balance:</span>
                      <span className="font-bold font-mono">
                        ₹{selectedCustomerInForm.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Cases Quantity and Reference Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <PremiumLabel label="Quantity (Cases) *" />
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Enter cases..."
                    value={formCases}
                    onChange={(e) => setFormCases(e.target.value)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none"
                  />
                </div>

                <div className="flex flex-col">
                  <PremiumLabel label="Reference Number" />
                  <input
                    type="text"
                    placeholder="Reference..."
                    value={formRef}
                    onChange={(e) => setFormRef(e.target.value)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div className="flex flex-col">
                <PremiumLabel label="Remarks" />
                <textarea
                  placeholder="Notes..."
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  className="w-full p-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none min-h-[70px]"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <EnterpriseButton
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 bg-amber-650 hover:bg-amber-700 text-white rounded-lg h-11 text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Updating Transaction...
                    </>
                  ) : (
                    'Update Transaction'
                  )}
                </EnterpriseButton>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="w-[100px] h-11 border border-slate-200 text-slate-500 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {isViewOpen && selectedTxn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex justify-center items-center p-4 transition-all duration-300">
          <div className="bg-white border border-slate-150 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transform scale-100 transition-all">
            
            {/* Cool Gradient Header */}
            <div className="relative bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 text-white flex justify-between items-center overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
              <div className="relative flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-inner ${
                  selectedTxn.transactionType === 'Sales Dispatch' 
                    ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' 
                    : selectedTxn.transactionType === 'Customer Return' 
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                    : 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                }`}>
                  {selectedTxn.transactionType === 'Sales Dispatch' ? (
                    <ShoppingCart className="w-5 h-5" />
                  ) : selectedTxn.transactionType === 'Customer Return' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Transaction Ledger</span>
                  <h2 className="text-base font-black tracking-tight text-white font-mono mt-0.5">
                    {selectedTxn.transactionNumber}
                  </h2>
                </div>
              </div>
              <button 
                onClick={() => setIsViewOpen(false)} 
                className="relative bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Transaction Type & Date Row */}
              <div className="flex justify-between items-center">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  selectedTxn.transactionType === 'Sales Dispatch' 
                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                    : selectedTxn.transactionType === 'Customer Return' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    selectedTxn.transactionType === 'Sales Dispatch' ? 'bg-blue-600' : selectedTxn.transactionType === 'Customer Return' ? 'bg-emerald-600' : 'bg-rose-600'
                  }`} />
                  {selectedTxn.transactionType}
                </span>

                <span className="text-xs font-semibold text-slate-450 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(selectedTxn.transactionDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                </span>
              </div>

              {/* Product and Stock Effect Card */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-4 translate-x-4 opacity-5 pointer-events-none">
                  <Package className="w-24 h-24 text-slate-900" />
                </div>
                <div className="relative space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Product Catalog SKU</span>
                  <h3 className="text-sm font-black text-slate-850">{selectedTxn.productName}</h3>
                  <p className="text-[11px] font-mono text-slate-455">{selectedTxn.productSku || 'NO_SKU_CODE'}</p>
                </div>
                <div className="relative text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider block mb-1">Stock Effect</span>
                  <div className={`inline-flex items-baseline font-black font-mono text-2xl tracking-tight px-3 py-1 rounded-xl ${
                    selectedTxn.transactionType === 'Customer Return' 
                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' 
                      : 'text-rose-650 bg-rose-55 text-rose-100'
                  }`}>
                    <span className="text-lg mr-0.5">{selectedTxn.transactionType === 'Customer Return' ? '+' : '-'}</span>
                    {selectedTxn.cases.toLocaleString()}
                    <span className="text-xs font-semibold ml-1.5 text-slate-500 font-sans">Cases</span>
                  </div>
                </div>
              </div>

              {/* Customer Box */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-200/60 flex items-center justify-center text-slate-500">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Wholesale Customer</span>
                      <h4 className="text-xs font-black text-slate-850 mt-1">{selectedTxn.customerName}</h4>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-slate-450 bg-slate-200/50 px-2.5 py-0.5 rounded-md">
                    {selectedTxn.customerCode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Contact Number:</span>
                    <span className="font-bold text-slate-700">{selectedCustomerInForm?.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Outstanding Balance:</span>
                    <span className="font-bold font-mono text-slate-850">
                      ₹{(selectedCustomerInForm?.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reference and Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 text-xs">
                  <span className="text-slate-400 block mb-1">Reference Code</span>
                  <span className="font-mono font-bold text-slate-800">{selectedTxn.referenceNumber || '—'}</span>
                </div>
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 text-xs">
                  <span className="text-slate-400 block mb-1">Remarks</span>
                  <span className="text-slate-800 italic">{selectedTxn.remarks || '—'}</span>
                </div>
              </div>

              {/* Audit Card */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-extrabold text-slate-600 uppercase text-[11px]">
                    {selectedTxn.createdByName.charAt(0)}
                  </div>
                  <div>
                    <span className="text-slate-450 block leading-none">Logged By</span>
                    <span className="font-bold text-slate-800 mt-1 block">{selectedTxn.createdByName}</span>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-455">
                  <span className="block font-medium">Logged Date</span>
                  <span className="font-mono mt-0.5 block">{new Date(selectedTxn.createdAt).toLocaleString('en-IN')}</span>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setIsViewOpen(false)}
                className="w-full bg-slate-900 hover:bg-slate-950 text-white rounded-xl h-11 text-xs font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {isDeleteOpen && selectedTxn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex justify-center items-center p-4">
          <div className="bg-white border border-slate-100 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3.5 text-rose-600">
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-850 leading-tight">Reverse Stock & Delete?</h3>
                <p className="text-xs text-slate-450 mt-1 leading-normal">
                  This transaction will be soft-deleted. The inventory effect will be automatically reversed.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-3 text-xs text-slate-650">
              <div className="flex justify-between border-b border-slate-150/40 pb-2">
                <span className="font-semibold text-slate-400">Transaction ID:</span>
                <span className="font-mono font-bold text-slate-800">{selectedTxn.transactionNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150/40 pb-2">
                <span className="font-semibold text-slate-400">Product:</span>
                <span className="font-bold text-slate-800">{selectedTxn.productName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150/40 pb-2">
                <span className="font-semibold text-slate-400">Customer:</span>
                <span className="font-bold text-slate-800">{selectedTxn.customerName}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-bold text-slate-650 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Inventory Restored:
                </span>
                <span className="font-black font-mono text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-lg text-xs">
                  {selectedTxn.transactionType === 'Customer Return' ? '-' : '+'}{selectedTxn.cases} Cases
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => deleteMutation.mutate(selectedTxn.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-11 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-200/50 active:scale-[0.98] cursor-pointer"
              >
                {deleteMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing Reversal...
                  </>
                ) : (
                  'Confirm & Reverse'
                )}
              </button>
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="w-[100px] h-11 border border-slate-200 text-slate-500 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
