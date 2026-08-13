import React, { useState, useEffect } from 'react'
import {
  Landmark,
  Plus,
  Search,
  PenSquare,
  Trash2,
  AlertCircle,
  Building2,
  RefreshCw,
  Wallet,
  CheckCircle2,
  XCircle,
  Eye,
  PlusCircle,
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
  BankAccount,
  CreateBankAccountRequest,
  UpdateBankAccountRequest,
} from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useAuthStore } from '../../../store/useAuthStore'
import LedgerTabSwitcher from './LedgerTabSwitcher'
import { AddMoneyModal } from './AddMoneyModal'

const BankAccountsPage: React.FC = () => {
  const { showToast } = useNotificationStore()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isOwner = (user?.roles?.some(r => ['owner', 'companyowner', 'platformowner'].includes(r.toLowerCase())) || user?.roleName?.toLowerCase() === 'owner') ?? false
  const canWrite = !isOwner && (user?.roles?.some(r => ['CompanyAdmin', 'Admin', 'Manager', 'Accountant'].includes(r)) ?? false)

  // State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const [isAddMoneyModalOpen, setIsAddMoneyModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [formData, setFormData] = useState<{
    bankName: string
    accountName: string
    accountNumber: string
    ifscCode: string
    openingBalance: number
    notes: string
    status: string
  }>({
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    openingBalance: 0,
    notes: '',
    status: 'Active',
  })

  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    fetchBankAccounts()
  }, [page, search, statusFilter])

  const fetchBankAccounts = async () => {
    try {
      setLoading(true)
      const data = await simpleAccountsService.getBankAccounts({
        pageNumber: page,
        pageSize: 10,
        search: search || undefined,
        status: statusFilter === 'All' ? undefined : statusFilter,
      })
      setBankAccounts(data?.items || [])
      setTotalCount(data?.totalCount || 0)
    } catch (err: any) {
      showToast(err.message || 'Failed to load bank accounts.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAddModal = () => {
    setFormData({
      bankName: '',
      accountName: '',
      accountNumber: '',
      ifscCode: '',
      openingBalance: 0,
      notes: '',
      status: 'Active',
    })
    setFormError(null)
    setIsAddModalOpen(true)
  }

  const handleOpenEditModal = (account: BankAccount) => {
    setSelectedAccount(account)
    setFormData({
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      ifscCode: account.ifscCode,
      openingBalance: account.openingBalance,
      notes: account.notes || '',
      status: account.status || 'Active',
    })
    setFormError(null)
    setIsEditModalOpen(true)
  }

  const handleOpenDeleteModal = (account: BankAccount) => {
    setSelectedAccount(account)
    setIsDeleteModalOpen(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.bankName.trim()) return setFormError('Bank Name is required.')
    if (!formData.accountName.trim()) return setFormError('Account Name is required.')
    if (!formData.accountNumber.trim()) return setFormError('Account Number is required.')
    if (!formData.ifscCode.trim()) return setFormError('IFSC Code is required.')

    try {
      setSubmitting(true)
      setFormError(null)

      const req: CreateBankAccountRequest = {
        bankName: formData.bankName.trim(),
        accountName: formData.accountName.trim(),
        accountNumber: formData.accountNumber.trim(),
        ifscCode: formData.ifscCode.trim(),
        openingBalance: Number(formData.openingBalance) || 0,
        notes: formData.notes.trim() || undefined,
        status: formData.status,
      }

      await simpleAccountsService.createBankAccount(req)
      showToast('Bank Account created successfully!', 'success')
      setIsAddModalOpen(false)
      fetchBankAccounts()
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to create bank account.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccount) return
    if (!formData.bankName.trim()) return setFormError('Bank Name is required.')
    if (!formData.accountName.trim()) return setFormError('Account Name is required.')
    if (!formData.accountNumber.trim()) return setFormError('Account Number is required.')
    if (!formData.ifscCode.trim()) return setFormError('IFSC Code is required.')

    try {
      setSubmitting(true)
      setFormError(null)

      const req: UpdateBankAccountRequest = {
        bankName: formData.bankName.trim(),
        accountName: formData.accountName.trim(),
        accountNumber: formData.accountNumber.trim(),
        ifscCode: formData.ifscCode.trim(),
        notes: formData.notes.trim() || undefined,
        status: formData.status,
      }

      await simpleAccountsService.updateBankAccount(selectedAccount.id, req)
      showToast('Bank Account updated successfully!', 'success')
      setIsEditModalOpen(false)
      fetchBankAccounts()
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to update bank account.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedAccount) return
    try {
      setSubmitting(true)
      await simpleAccountsService.deleteBankAccount(selectedAccount.id)
      showToast('Bank Account deleted successfully.', 'success')
      setIsDeleteModalOpen(false)
      fetchBankAccounts()
    } catch (err: any) {
      showToast(err.message || 'Failed to delete bank account.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const totalBankBalanceSum = bankAccounts.reduce((acc, curr) => acc + curr.currentBalance, 0)
  const activeAccountsCount = bankAccounts.filter((b) => b.status === 'Active').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <EnterpriseHeader
        title="Bank Accounts"
        description="Manage company bank accounts, monitor current balances, and track automated transactions."
        actions={
          canWrite ? (
            <EnterpriseButton variant="primary" onClick={handleOpenAddModal}>
              <Plus className="w-4 h-4 mr-2" /> Add Bank Account
            </EnterpriseButton>
          ) : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <EnterpriseCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bank Balance</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">₹{totalBankBalanceSum.toLocaleString('en-IN')}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Landmark className="w-6 h-6" />
            </div>
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Accounts</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{activeAccountsCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-5 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Registered</p>
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
              placeholder="Search by Bank Name, Account Name, Number or IFSC..."
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
                { value: 'Inactive', label: 'Inactive' },
              ]}
            />
          </div>

          <EnterpriseButton variant="ghost" onClick={fetchBankAccounts} className="shrink-0">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </EnterpriseButton>
        </div>
      </EnterpriseCard>

      {/* Accounts Table */}
      <EnterpriseCard className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <EnterpriseLoading label="Loading bank accounts..." />
          </div>
        ) : bankAccounts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No bank accounts found.</p>
            <p className="text-xs text-slate-400 mt-1">Create a new bank account to begin tracking automated bank transactions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Bank Name</th>
                  <th className="p-3.5">Account Name</th>
                  <th className="p-3.5">Account Number</th>
                  <th className="p-3.5">IFSC Code</th>
                  <th className="p-3.5 text-right">Opening Balance</th>
                  <th className="p-3.5 text-right">Current Balance</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bankAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <Landmark className="w-4 h-4" />
                      </div>
                      {account.bankName}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-700">{account.accountName}</td>
                    <td className="p-3.5 font-mono text-slate-600">{account.accountNumber}</td>
                    <td className="p-3.5 font-mono text-slate-500">{account.ifscCode}</td>
                    <td className="p-3.5 text-right font-medium text-slate-500">₹{account.openingBalance.toLocaleString('en-IN')}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-600">₹{account.currentBalance.toLocaleString('en-IN')}</td>
                    <td className="p-3.5 text-center">
                      <EnterpriseBadge variant={account.status === 'Active' ? 'success' : 'gray'}>
                        {account.status}
                      </EnterpriseBadge>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/company/accounts/bank-accounts/${account.id}`)}
                          className="p-1.5 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                          title="View Ledger"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => handleOpenEditModal(account)}
                            className="p-1.5 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                            title="Edit Bank Account"
                          >
                            <PenSquare className="w-4 h-4" />
                          </button>
                        )}
                        {canWrite && (
                          <button
                            onClick={() => handleOpenDeleteModal(account)}
                            className="p-1.5 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                            title="Delete Bank Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {canWrite && (
                          <button
                            onClick={() => {
                              setSelectedAccount(account)
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

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Add Bank Account</h3>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name *</label>
                <EnterpriseInput
                  placeholder="e.g. Federal Bank, State Bank of India, HDFC Bank"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Name *</label>
                <EnterpriseInput
                  placeholder="e.g. Primary Current Account, SBI Operational"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Number *</label>
                <EnterpriseInput
                  placeholder="e.g. 1004592039401"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code *</label>
                <EnterpriseInput
                  placeholder="e.g. FDRL0001045"
                  value={formData.ifscCode}
                  onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                />
              </div>

              <div>
                <EnterpriseNumberInput
                  label="Opening Balance (₹)"
                  placeholder="0.00"
                  value={formData.openingBalance}
                  onValueChange={(val) => setFormData({ ...formData, openingBalance: Number(val) || 0 })}
                />
                <p className="text-[10px] text-slate-400 mt-0.5">This initial balance sets the starting Current Balance for this account.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <EnterpriseSelect
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <textarea
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  rows={2}
                  placeholder="Optional account notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <EnterpriseButton variant="secondary" onClick={() => setIsAddModalOpen(false)} disabled={submitting}>
                  Cancel
                </EnterpriseButton>
                <EnterpriseButton variant="primary" type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Save Account'}
                </EnterpriseButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedAccount && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Edit Bank Account</h3>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name *</label>
                <EnterpriseInput
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Name *</label>
                <EnterpriseInput
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Number *</label>
                <EnterpriseInput
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code *</label>
                <EnterpriseInput
                  value={formData.ifscCode}
                  onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Opening Balance</span>
                  <span className="font-bold text-slate-900">₹{selectedAccount.openingBalance.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Current Balance</span>
                  <span className="font-bold text-emerald-600">₹{selectedAccount.currentBalance.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <EnterpriseSelect
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <textarea
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <EnterpriseButton variant="secondary" onClick={() => setIsEditModalOpen(false)} disabled={submitting}>
                  Cancel
                </EnterpriseButton>
                <EnterpriseButton variant="primary" type="submit" disabled={submitting}>
                  {submitting ? 'Updating...' : 'Update Account'}
                </EnterpriseButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedAccount && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete Bank Account</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-bold text-slate-900">{selectedAccount.bankName} ({selectedAccount.accountName})</span>?
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
          setSelectedAccount(null)
        }}
        bankAccountId={selectedAccount?.id}
        onSuccess={fetchBankAccounts}
      />
    </div>
  )
}

export default BankAccountsPage
