import React, { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  PenSquare,
  Trash2,
  AlertCircle,
  RefreshCw,
  Wallet,
  Eye,
  PlusCircle,
  Scale
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseInput from '../../../components/ui/EnterpriseInput'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseSelect from '../../../components/ui/EnterpriseSelect'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import EnterpriseNumberInput from '../../../components/ui/EnterpriseNumberInput'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type {
  CashBook,
  CreateCashBookRequest,
  UpdateCashBookRequest
} from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useAuthStore } from '../../../store/useAuthStore'
import LedgerTabSwitcher from './LedgerTabSwitcher'
import { AddMoneyModal } from './AddMoneyModal'
import { SettleCashBookModal } from './SettleCashBookModal'
import { parseBalance, formatBalanceCurrency, getBalanceColorClass } from '../../../utils/balanceFormat'

const CashBooksPage: React.FC = () => {
  const { showToast } = useNotificationStore()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isOwner = (user?.roles?.some(r => ['owner', 'companyowner', 'platformowner'].includes(r.toLowerCase())) || user?.roleName?.toLowerCase() === 'owner') ?? false
  const canWrite = !isOwner && (user?.roles?.some(r => ['CompanyAdmin', 'Admin', 'Manager', 'Accountant'].includes(r)) ?? false)

  // State
  const [cashBooks, setCashBooks] = useState<CashBook[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedBook, setSelectedBook] = useState<CashBook | null>(null)
  const [isAddMoneyModalOpen, setIsAddMoneyModalOpen] = useState(false)
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false)
  const [bookToSettle, setBookToSettle] = useState<CashBook | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState<{
    name: string
    description: string
    openingBalance: number
    notes: string
    status: string
  }>({
    name: '',
    description: '',
    openingBalance: 0,
    notes: '',
    status: 'Active'
  })

  const fetchCashBooks = async () => {
    try {
      setLoading(true)
      const data = await simpleAccountsService.getCashBooks({
        pageNumber: page,
        pageSize: 10,
        search: search || undefined,
        status: statusFilter === 'All' ? undefined : statusFilter
      })
      setCashBooks(data?.items || [])
      setTotalCount(data?.totalCount || 0)
    } catch (err: any) {
      showToast(err.message || 'Failed to load cash books.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCashBooks()
  }, [page, search, statusFilter])

  const openAdd = () => {
    setFormData({
      name: '',
      description: '',
      openingBalance: 0,
      notes: '',
      status: 'Active'
    })
    setFormError(null)
    setIsAddModalOpen(true)
  }

  const openEdit = (book: CashBook) => {
    setSelectedBook(book)
    setFormData({
      name: book.name,
      description: book.description || '',
      openingBalance: book.openingBalance,
      notes: book.notes || '',
      status: book.status || 'Active'
    })
    setFormError(null)
    setIsEditModalOpen(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return setFormError('Cash Book Name is required.')

    try {
      setSubmitting(true)
      setFormError(null)
      const req: CreateCashBookRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        openingBalance: Number(formData.openingBalance) || 0,
        notes: formData.notes.trim() || undefined,
        status: formData.status
      }
      await simpleAccountsService.createCashBook(req)
      showToast('Cash Book created successfully!', 'success')
      setIsAddModalOpen(false)
      fetchCashBooks()
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to create cash book.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBook) return
    if (!formData.name.trim()) return setFormError('Cash Book Name is required.')

    try {
      setSubmitting(true)
      setFormError(null)
      const req: UpdateCashBookRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        status: formData.status
      }
      await simpleAccountsService.updateCashBook(selectedBook.id, req)
      showToast('Cash Book updated successfully!', 'success')
      setIsEditModalOpen(false)
      fetchCashBooks()
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to update cash book.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedBook) return
    try {
      setSubmitting(true)
      await simpleAccountsService.deleteCashBook(selectedBook.id)
      showToast('Cash Book deleted successfully.', 'success')
      setIsDeleteModalOpen(false)
      fetchCashBooks()
    } catch (err: any) {
      showToast(err.message || 'Failed to delete cash book.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const totalCashBalance = cashBooks.reduce((acc, curr) => acc + curr.currentBalance, 0)
  const activeBooksCount = cashBooks.filter((b) => b.status === 'Active').length
  const currency = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <EnterpriseHeader
        title="Cash Books"
        description="Manage company cash books, monitor cash balances, and track automated cash transactions."
        actions={
          canWrite ? (
            <EnterpriseButton variant="primary" onClick={openAdd}>
              <Plus className="w-4 h-4 mr-2" /> Create Cash Book
            </EnterpriseButton>
          ) : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <EnterpriseCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Cash Balance</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">{currency(totalCashBalance)}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Cash Books</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{activeBooksCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Cash Books</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
        </EnterpriseCard>
      </div>

      {/* Tab Switcher */}
      <LedgerTabSwitcher />

      {/* Toolbar */}
      <EnterpriseCard className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by cash book name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="w-full sm:w-48">
            <EnterpriseSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'All', label: 'All Statuses' },
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
            />
          </div>
          <EnterpriseButton variant="ghost" onClick={fetchCashBooks} className="shrink-0">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </EnterpriseButton>
        </div>
      </EnterpriseCard>

      {/* Table & Empty State */}
      <EnterpriseCard className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <EnterpriseLoading label="Loading cash books..." />
          </div>
        ) : cashBooks.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-4">
            <Wallet className="w-12 h-12 text-slate-300 mx-auto" />
            <div>
              <p className="font-semibold text-slate-700">No cash books found.</p>
              <p className="text-xs text-slate-400 mt-1">Create a cash book to begin tracking cash transactions.</p>
            </div>
            <EnterpriseButton variant="secondary" onClick={openAdd} className="mt-2 mx-auto">
              <Plus className="w-4 h-4 mr-2" /> Create Cash Book
            </EnterpriseButton>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Cash Book Name</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5 text-right">Opening Balance</th>
                  <th className="p-3.5 text-right">Current Balance</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashBooks.map((book) => (
                  <tr key={book.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                          <Wallet className="w-4 h-4" />
                        </div>
                        {book.name}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600 font-medium">
                      {book.description || 'No description'}
                    </td>
                    <td className="p-3.5 text-right font-medium text-slate-500">
                      {currency(book.openingBalance)}
                    </td>
                    <td className="p-3.5 text-right font-black">
                      <span className={getBalanceColorClass(book.currentBalance)}>
                        {formatBalanceCurrency(book.currentBalance)}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <EnterpriseBadge variant={book.status === 'Active' ? 'success' : 'gray'}>
                        {book.status}
                      </EnterpriseBadge>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canWrite && parseBalance(book.currentBalance) < 0 && (
                          <button
                            onClick={() => {
                              setBookToSettle(book)
                              setIsSettleModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors shadow-2xs"
                            title="Settle Negative Deficit"
                          >
                            <Scale className="w-3.5 h-3.5 text-amber-600" />
                            Settle
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/company/accounts/cash-books/${book.id}`)}
                          className="p-1.5 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                          title="View Ledger"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => openEdit(book)}
                            className="p-1.5 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                            title="Edit Cash Book"
                          >
                            <PenSquare className="w-4 h-4" />
                          </button>
                        )}
                        {canWrite && (
                          <button
                            onClick={() => {
                              setSelectedBook(book)
                              setIsDeleteModalOpen(true)
                            }}
                            className="p-1.5 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                            title="Delete Cash Book"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {canWrite && (
                          <button
                            onClick={() => {
                              setSelectedBook(book)
                              setIsAddMoneyModalOpen(true)
                            }}
                            className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded transition-colors"
                            title="Add Money"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </EnterpriseCard>

      {/* Add / Edit Modal */}
      {(isAddModalOpen || (isEditModalOpen && selectedBook)) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {isAddModalOpen ? 'Create Cash Book' : 'Edit Cash Book'}
            </h3>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={isAddModalOpen ? handleCreate : handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cash Book Name *</label>
                <EnterpriseInput
                  placeholder="e.g. Office Cash, Factory Cash, Petty Cash"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <EnterpriseInput
                  placeholder="e.g. Daily expenses for office supplies"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {isAddModalOpen ? (
                <div>
                  <EnterpriseNumberInput
                    label="Opening Balance (₹)"
                    placeholder="0.00"
                    value={formData.openingBalance}
                    onValueChange={(val) => setFormData({ ...formData, openingBalance: Number(val) || 0 })}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    This initial balance sets the starting Cash Balance for this book.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block font-medium">Opening Balance</span>
                    <span className="font-bold text-slate-900">{currency(selectedBook?.openingBalance || 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Current Balance</span>
                    <span className="font-bold text-emerald-600">{currency(selectedBook?.currentBalance || 0)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <EnterpriseSelect
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <textarea
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  rows={2}
                  placeholder="Optional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <EnterpriseButton
                  variant="secondary"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setIsEditModalOpen(false)
                  }}
                  disabled={submitting}
                >
                  Cancel
                </EnterpriseButton>
                <EnterpriseButton variant="primary" type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Cash Book'}
                </EnterpriseButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && selectedBook && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete Cash Book</h3>
              <p className="text-xs text-slate-500 mt-2">
                Are you sure you want to delete <span className="font-bold text-slate-900">{selectedBook.name}</span>?
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <EnterpriseButton variant="secondary" onClick={() => setIsDeleteModalOpen(false)} disabled={submitting}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton variant="danger" onClick={handleDelete} disabled={submitting}>
                {submitting ? 'Deleting...' : 'Delete'}
              </EnterpriseButton>
            </div>
          </div>
        </div>
      )}

      <AddMoneyModal
        isOpen={isAddMoneyModalOpen}
        onClose={() => {
          setIsAddMoneyModalOpen(false)
          setSelectedBook(null)
        }}
        cashBookId={selectedBook?.id}
        onSuccess={fetchCashBooks}
      />

      <SettleCashBookModal
        isOpen={isSettleModalOpen}
        onClose={() => {
          setIsSettleModalOpen(false)
          setBookToSettle(null)
        }}
        targetCashBook={bookToSettle}
        onSuccess={fetchCashBooks}
      />
    </div>
  )
}

export default CashBooksPage
