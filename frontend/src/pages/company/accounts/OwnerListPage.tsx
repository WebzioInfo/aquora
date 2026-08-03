import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type { Owner, CreateOwnerRequest, UpdateOwnerRequest, CreateOwnerTransactionRequest } from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import EnterpriseNumberInput from '../../../components/ui/EnterpriseNumberInput'
import { Plus, Eye, Edit2, Trash2, Landmark, TrendingUp, TrendingDown } from 'lucide-react'

export const OwnerListPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Owner Form State
  const [ownerForm, setOwnerForm] = useState({
    name: '',
    phone: '',
    email: '',
    ownershipPercentage: 0,
    initialInvestment: 0,
    notes: ''
  })

  // Transaction Form State
  const [txForm, setTxForm] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    amount: 0,
    transactionType: 'Investment' as 'Investment' | 'Withdrawal',
    notes: ''
  })

  // Query owners list
  const { data: owners, isLoading } = useQuery({
    queryKey: ['ownersList'],
    queryFn: () => simpleAccountsService.getOwners()
  })

  // Query total company investment
  const { data: companyTotal } = useQuery({
    queryKey: ['companyTotalInvestment'],
    queryFn: () => simpleAccountsService.getCompanyTotalInvestment()
  })

  // Mutations
  const createOwnerMutation = useMutation({
    mutationFn: (req: CreateOwnerRequest) => simpleAccountsService.createOwner(req),
    onSuccess: () => {
      showToast('Owner added successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['ownersList'] })
      queryClient.invalidateQueries({ queryKey: ['companyTotalInvestment'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
      setIsCreateModalOpen(false)
      resetOwnerForm()
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to add owner.')
    }
  })

  const updateOwnerMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateOwnerRequest }) => simpleAccountsService.updateOwner(id, req),
    onSuccess: () => {
      showToast('Owner updated successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['ownersList'] })
      queryClient.invalidateQueries({ queryKey: ['companyTotalInvestment'] })
      setIsEditModalOpen(false)
      setSelectedOwner(null)
      resetOwnerForm()
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to update owner.')
    }
  })

  const deleteOwnerMutation = useMutation({
    mutationFn: (id: string) => simpleAccountsService.deleteOwner(id),
    onSuccess: () => {
      showToast('Owner removed successfully.', 'info')
      queryClient.invalidateQueries({ queryKey: ['ownersList'] })
      queryClient.invalidateQueries({ queryKey: ['companyTotalInvestment'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to delete owner.', 'error')
    }
  })

  const txMutation = useMutation({
    mutationFn: ({ ownerId, req }: { ownerId: string; req: CreateOwnerTransactionRequest }) => simpleAccountsService.addOwnerTransaction(ownerId, req),
    onSuccess: () => {
      showToast('Investment transaction recorded successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['ownersList'] })
      queryClient.invalidateQueries({ queryKey: ['companyTotalInvestment'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
      setIsTxModalOpen(false)
      setSelectedOwner(null)
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to record transaction.')
    }
  })

  const resetOwnerForm = () => {
    setOwnerForm({
      name: '',
      phone: '',
      email: '',
      ownershipPercentage: 0,
      initialInvestment: 0,
      notes: ''
    })
    setFormError(null)
  }

  const handleOpenCreate = () => {
    resetOwnerForm()
    setIsCreateModalOpen(true)
  }

  const handleOpenEdit = (owner: Owner) => {
    setSelectedOwner(owner)
    setOwnerForm({
      name: owner.name,
      phone: owner.phone,
      email: owner.email || '',
      ownershipPercentage: owner.ownershipPercentage,
      initialInvestment: owner.initialInvestment,
      notes: owner.notes || ''
    })
    setFormError(null)
    setIsEditModalOpen(true)
  }

  const handleOpenTx = (owner: Owner) => {
    setSelectedOwner(owner)
    setTxForm({
      transactionDate: new Date().toISOString().split('T')[0],
      amount: 0,
      transactionType: 'Investment',
      notes: ''
    })
    setFormError(null)
    setIsTxModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to remove this owner record?')) {
      deleteOwnerMutation.mutate(id)
    }
  }

  const handleSubmitCreateOwner = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    createOwnerMutation.mutate({
      name: ownerForm.name,
      phone: ownerForm.phone,
      email: ownerForm.email || undefined,
      ownershipPercentage: ownerForm.ownershipPercentage,
      initialInvestment: ownerForm.initialInvestment,
      notes: ownerForm.notes || undefined
    })
  }

  const handleSubmitEditOwner = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOwner) return
    setFormError(null)
    updateOwnerMutation.mutate({
      id: selectedOwner.id,
      req: {
        name: ownerForm.name,
        phone: ownerForm.phone,
        email: ownerForm.email || undefined,
        ownershipPercentage: ownerForm.ownershipPercentage,
        notes: ownerForm.notes || undefined
      }
    })
  }

  const handleSubmitTx = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOwner) return
    setFormError(null)
    if (txForm.amount <= 0) {
      setFormError('Amount must be greater than zero.')
      return
    }
    txMutation.mutate({
      ownerId: selectedOwner.id,
      req: {
        transactionDate: new Date(txForm.transactionDate).toISOString(),
        amount: txForm.amount,
        transactionType: txForm.transactionType,
        notes: txForm.notes || undefined
      }
    })
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)
  }

  return (
    <div className="space-y-6">
      <EnterpriseHeader
        title="Owner Management"
        description="Manage equity owners, initial contributions, and investment/withdrawal logs"
        actions={
          <EnterpriseButton variant="primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Owner
          </EnterpriseButton>
        }
      />

      {/* TOTAL INVESTMENT OVERVIEW CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <EnterpriseCard className="p-4 border-l-4 border-l-blue-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Current Investment</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            {formatCurrency(companyTotal?.totalCurrentInvestment || 0)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-indigo-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Initial Investment</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            {formatCurrency(companyTotal?.totalInitialInvestment || 0)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-emerald-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Additional Invested</span>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">
            {formatCurrency(companyTotal?.totalAdditionalInvested || 0)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-amber-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Withdrawn</span>
          <div className="text-xl font-extrabold text-amber-600 mt-1">
            {formatCurrency(companyTotal?.totalWithdrawn || 0)}
          </div>
        </EnterpriseCard>
      </div>

      {/* OWNER LIST TABLE */}
      <EnterpriseCard className="p-5">
        {isLoading ? (
          <EnterpriseLoading label="Loading owners..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3">Owner Name</th>
                  <th className="p-3">Ownership %</th>
                  <th className="p-3">Initial Investment</th>
                  <th className="p-3">Current Investment</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {owners && owners.length > 0 ? (
                  owners.map((owner) => (
                    <tr key={owner.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{owner.name}</div>
                        {owner.email && <div className="text-[10px] text-slate-400">{owner.email}</div>}
                      </td>
                      <td className="p-3">
                        <EnterpriseBadge variant="info">{owner.ownershipPercentage}%</EnterpriseBadge>
                      </td>
                      <td className="p-3 text-slate-600 font-semibold">{formatCurrency(owner.initialInvestment)}</td>
                      <td className="p-3 font-extrabold text-emerald-600">{formatCurrency(owner.currentInvestment)}</td>
                      <td className="p-3 text-slate-600">{owner.phone}</td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => navigate(`/company/accounts/owners/${owner.id}`)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenTx(owner)}
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-bold text-[10px] uppercase"
                          title="Record Investment or Withdrawal"
                        >
                          + Transact
                        </button>
                        <button
                          onClick={() => handleOpenEdit(owner)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50"
                          title="Edit Owner"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(owner.id)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50"
                          title="Delete Owner"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400 font-medium">No owners found. Add an owner to get started.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </EnterpriseCard>

      {/* CREATE OWNER MODAL */}
      {isCreateModalOpen && (
        <EnterpriseModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Add New Owner"
        >
          <form onSubmit={handleSubmitCreateOwner} className="space-y-4">
            {formError && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Owner Name</label>
              <input
                type="text"
                required
                placeholder="Full Name"
                value={ownerForm.name}
                onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="+91..."
                  value={ownerForm.phone}
                  onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="owner@company.com"
                  value={ownerForm.email}
                  onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <EnterpriseNumberInput
                  label="Ownership (%)"
                  placeholder="0.00"
                  min={0}
                  max={100}
                  value={ownerForm.ownershipPercentage}
                  onValueChange={(val) => setOwnerForm({ ...ownerForm, ownershipPercentage: Number(val) || 0 })}
                />
              </div>

              <div>
                <EnterpriseNumberInput
                  label="Initial Investment (₹)"
                  placeholder="0.00"
                  min={0}
                  value={ownerForm.initialInvestment}
                  onValueChange={(val) => setOwnerForm({ ...ownerForm, initialInvestment: Number(val) || 0 })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="Additional notes..."
                value={ownerForm.notes}
                onChange={(e) => setOwnerForm({ ...ownerForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <EnterpriseButton variant="secondary" type="button" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton variant="primary" type="submit" loading={createOwnerMutation.isPending}>
                Save Owner
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* EDIT OWNER MODAL */}
      {isEditModalOpen && (
        <EnterpriseModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Owner Details"
        >
          <form onSubmit={handleSubmitEditOwner} className="space-y-4">
            {formError && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Owner Name</label>
              <input
                type="text"
                required
                value={ownerForm.name}
                onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={ownerForm.phone}
                  onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={ownerForm.email}
                  onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <EnterpriseNumberInput
                label="Ownership (%)"
                placeholder="0.00"
                min={0}
                max={100}
                value={ownerForm.ownershipPercentage}
                onValueChange={(val) => setOwnerForm({ ...ownerForm, ownershipPercentage: Number(val) || 0 })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes (Optional)</label>
              <textarea
                rows={2}
                value={ownerForm.notes}
                onChange={(e) => setOwnerForm({ ...ownerForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <EnterpriseButton variant="secondary" type="button" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton variant="primary" type="submit" loading={updateOwnerMutation.isPending}>
                Update Owner
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* RECORD TRANSACTION MODAL */}
      {isTxModalOpen && selectedOwner && (
        <EnterpriseModal
          isOpen={isTxModalOpen}
          onClose={() => setIsTxModalOpen(false)}
          title={`Record Transaction - ${selectedOwner.name}`}
        >
          <form onSubmit={handleSubmitTx} className="space-y-4">
            {formError && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Transaction Type</label>
                <select
                  value={txForm.transactionType}
                  onChange={(e) => setTxForm({ ...txForm, transactionType: e.target.value as 'Investment' | 'Withdrawal' })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 font-bold"
                >
                  <option value="Investment">Investment (+)</option>
                  <option value="Withdrawal">Withdrawal (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={txForm.transactionDate}
                  onChange={(e) => setTxForm({ ...txForm, transactionDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <EnterpriseNumberInput
                label="Amount (₹)"
                placeholder="0.00"
                min={0.01}
                value={txForm.amount}
                onValueChange={(val) => setTxForm({ ...txForm, amount: Number(val) || 0 })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="Reason or notes..."
                value={txForm.notes}
                onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <EnterpriseButton variant="secondary" type="button" onClick={() => setIsTxModalOpen(false)}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton variant="primary" type="submit" loading={txMutation.isPending}>
                Save Transaction
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}
    </div>
  )
}

export default OwnerListPage
