import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type { CreateOwnerTransactionRequest } from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import OwnerTransactionModal from './owners/OwnerTransactionModal'
import { ArrowLeft, Plus, Landmark, TrendingUp, TrendingDown, Calendar, User, Phone, Mail } from 'lucide-react'

export const OwnerDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()

  const [isTxModalOpen, setIsTxModalOpen] = useState(false)

  // Query Owner details
  const { data: owner, isLoading } = useQuery({
    queryKey: ['ownerDetails', id],
    queryFn: () => simpleAccountsService.getOwnerById(id!),
    enabled: !!id
  })

  // Query Bank accounts & Cashbooks for transaction destination
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccountDropdownList'],
    queryFn: () => simpleAccountsService.getBankAccountDropdown()
  })

  const { data: cashBooks = [] } = useQuery({
    queryKey: ['cashBookDropdownList'],
    queryFn: () => simpleAccountsService.getCashBookDropdown()
  })

  // Mutation
  const txMutation = useMutation({
    mutationFn: (req: CreateOwnerTransactionRequest) => simpleAccountsService.addOwnerTransaction(id!, req),
    onSuccess: () => {
      showToast('Transaction recorded successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['ownerDetails', id] })
      queryClient.invalidateQueries({ queryKey: ['ownersList'] })
      queryClient.invalidateQueries({ queryKey: ['companyTotalInvestment'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBooksList'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountsList'] })
      queryClient.invalidateQueries({ queryKey: ['unifiedLedger'] })
      queryClient.invalidateQueries({ queryKey: ['unifiedLedgerSummary'] })
      queryClient.invalidateQueries({ queryKey: ['assetSummary'] })
      setIsTxModalOpen(false)
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || err.message || 'Failed to record transaction.', 'error')
    }
  })

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0)
  }

  if (isLoading) {
    return <EnterpriseLoading label="Loading owner details..." />
  }

  if (!owner) {
    return (
      <div className="space-y-4">
        <EnterpriseButton variant="secondary" onClick={() => navigate('/company/accounts/owners')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Owners List
        </EnterpriseButton>
        <EnterpriseCard className="p-8 text-center text-slate-500 font-bold">
          Owner not found.
        </EnterpriseCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/company/accounts/owners')}
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <EnterpriseHeader
          title={owner.name}
          description="Owner profile, equity overview, and transaction logs"
          actions={
            <EnterpriseButton variant="primary" onClick={() => setIsTxModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Transaction
            </EnterpriseButton>
          }
        />
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EnterpriseCard className="p-5 border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Investment</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            {formatCurrency(owner.currentInvestment)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-5 border-l-4 border-l-indigo-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Initial Contribution</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            {formatCurrency(owner.initialInvestment)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-5 border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ownership Percentage</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <User className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-blue-600">
            {owner.ownershipPercentage}%
          </div>
        </EnterpriseCard>
      </div>

      {/* OWNER INFORMATION CARD */}
      <EnterpriseCard className="p-6">
        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4">Owner Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500 uppercase font-bold block mb-1">Full Name</span>
            <span className="text-slate-900 font-bold text-sm">{owner.name}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-bold block mb-1">Phone Number</span>
            <span className="text-slate-900 font-semibold">{owner.phone}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-bold block mb-1">Email Address</span>
            <span className="text-slate-900 font-semibold">{owner.email || 'N/A'}</span>
          </div>
        </div>

        {owner.notes && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs">
            <span className="text-slate-500 uppercase font-bold block mb-1">Notes</span>
            <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">{owner.notes}</p>
          </div>
        )}
      </EnterpriseCard>

      {/* INVESTMENT HISTORY TABLE */}
      <EnterpriseCard className="p-6">
        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4">Investment History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                <th className="p-3">Date</th>
                <th className="p-3">Type</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Notes</th>
                <th className="p-3">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {owner.transactions && owner.transactions.length > 0 ? (
                owner.transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-900 font-medium">{new Date(tx.transactionDate).toLocaleDateString()}</td>
                    <td className="p-3">
                      <EnterpriseBadge variant={tx.transactionType === 'Investment' ? 'success' : 'warning'}>
                        {tx.transactionType}
                      </EnterpriseBadge>
                    </td>
                    <td className={`p-3 font-bold ${tx.transactionType === 'Investment' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="p-3 text-slate-600 max-w-[200px] truncate">{tx.notes || '-'}</td>
                    <td className="p-3 text-slate-500">{tx.createdBy}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400 font-medium">No additional transactions recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </EnterpriseCard>

      {/* ADD TRANSACTION MODAL */}
      {isTxModalOpen && owner && (
        <OwnerTransactionModal
          isOpen={isTxModalOpen}
          onClose={() => setIsTxModalOpen(false)}
          owners={[owner]}
          prefilledOwner={owner}
          bankAccounts={bankAccounts}
          cashBooks={cashBooks}
          onSubmit={async (ownerId, req) => {
            await txMutation.mutateAsync(req)
          }}
        />
      )}
    </div>
  )
}

export default OwnerDetailsPage
