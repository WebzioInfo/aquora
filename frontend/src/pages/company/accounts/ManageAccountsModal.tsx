import React, { useState } from 'react'
import {
  Landmark,
  Wallet,
  Plus,
  PenSquare,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building2,
  DollarSign,
  Scale
} from 'lucide-react'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseInput from '../../../components/ui/EnterpriseInput'
import EnterpriseSelect from '../../../components/ui/EnterpriseSelect'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type {
  BankAccount,
  CashBook,
  CreateBankAccountRequest,
  UpdateBankAccountRequest,
  CreateCashBookRequest,
  UpdateCashBookRequest
} from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { SettleCashBookModal } from './SettleCashBookModal'
import { parseBalance, formatBalanceCurrency, getBalanceColorClass } from '../../../utils/balanceFormat'

interface ManageAccountsModalProps {
  isOpen: boolean
  onClose: () => void
  bankAccounts: BankAccount[]
  cashBooks: CashBook[]
  canWrite: boolean
  onRefresh: () => void
  onOpenAddMoney: (type: 'bank' | 'cash', accountId: string) => void
}

export const ManageAccountsModal: React.FC<ManageAccountsModalProps> = ({
  isOpen,
  onClose,
  bankAccounts,
  cashBooks,
  canWrite,
  onRefresh,
  onOpenAddMoney
}) => {
  const { showToast } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<'bank' | 'cash'>('bank')

  // Bank Form State
  const [isBankFormOpen, setIsBankFormOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null)
  const [bankFormData, setBankFormData] = useState<CreateBankAccountRequest & { status: string }>({
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    openingBalance: 0,
    notes: '',
    status: 'Active'
  })

  // Cash Form State
  const [isCashFormOpen, setIsCashFormOpen] = useState(false)
  const [editingCash, setEditingCash] = useState<CashBook | null>(null)
  const [cashFormData, setCashFormData] = useState<CreateCashBookRequest & { status: string }>({
    name: '',
    description: '',
    openingBalance: 0,
    notes: '',
    status: 'Active'
  })

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<{ type: 'bank' | 'cash', id: string, name: string } | null>(null)
  const [isSettleOpen, setIsSettleOpen] = useState(false)
  const [settleTargetBook, setSettleTargetBook] = useState<CashBook | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Bank Handlers
  const handleOpenAddBank = () => {
    setEditingBank(null)
    setBankFormData({
      bankName: '',
      accountName: '',
      accountNumber: '',
      ifscCode: '',
      openingBalance: 0,
      notes: '',
      status: 'Active'
    })
    setFormError(null)
    setIsBankFormOpen(true)
  }

  const handleOpenEditBank = (b: BankAccount) => {
    setEditingBank(b)
    setBankFormData({
      bankName: b.bankName,
      accountName: b.accountName,
      accountNumber: b.accountNumber,
      ifscCode: b.ifscCode,
      openingBalance: b.openingBalance,
      notes: b.notes || '',
      status: b.status || 'Active'
    })
    setFormError(null)
    setIsBankFormOpen(true)
  }

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankFormData.bankName.trim()) return setFormError('Bank Name is required.')
    if (!bankFormData.accountName.trim()) return setFormError('Account Name is required.')
    if (!bankFormData.accountNumber.trim()) return setFormError('Account Number is required.')
    if (!bankFormData.ifscCode.trim()) return setFormError('IFSC Code is required.')

    try {
      setSubmitting(true)
      setFormError(null)
      if (editingBank) {
        await simpleAccountsService.updateBankAccount(editingBank.id, {
          bankName: bankFormData.bankName.trim(),
          accountName: bankFormData.accountName.trim(),
          accountNumber: bankFormData.accountNumber.trim(),
          ifscCode: bankFormData.ifscCode.trim(),
          notes: bankFormData.notes?.trim() || undefined,
          status: bankFormData.status
        })
        showToast('Bank account updated successfully.', 'success')
      } else {
        await simpleAccountsService.createBankAccount({
          bankName: bankFormData.bankName.trim(),
          accountName: bankFormData.accountName.trim(),
          accountNumber: bankFormData.accountNumber.trim(),
          ifscCode: bankFormData.ifscCode.trim(),
          openingBalance: Number(bankFormData.openingBalance) || 0,
          notes: bankFormData.notes?.trim() || undefined,
          status: bankFormData.status
        })
        showToast('Bank account created successfully.', 'success')
      }
      setIsBankFormOpen(false)
      onRefresh()
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save bank account.')
    } finally {
      setSubmitting(false)
    }
  }

  // Cash Handlers
  const handleOpenAddCash = () => {
    setEditingCash(null)
    setCashFormData({
      name: '',
      description: '',
      openingBalance: 0,
      notes: '',
      status: 'Active'
    })
    setFormError(null)
    setIsCashFormOpen(true)
  }

  const handleOpenEditCash = (c: CashBook) => {
    setEditingCash(c)
    setCashFormData({
      name: c.name,
      description: c.description || '',
      openingBalance: c.openingBalance,
      notes: c.notes || '',
      status: c.status || 'Active'
    })
    setFormError(null)
    setIsCashFormOpen(true)
  }

  const handleSaveCash = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashFormData.name.trim()) return setFormError('Cash Book Name is required.')

    try {
      setSubmitting(true)
      setFormError(null)
      if (editingCash) {
        await simpleAccountsService.updateCashBook(editingCash.id, {
          name: cashFormData.name.trim(),
          description: cashFormData.description?.trim() || undefined,
          notes: cashFormData.notes?.trim() || undefined,
          status: cashFormData.status
        })
        showToast('Cash book updated successfully.', 'success')
      } else {
        await simpleAccountsService.createCashBook({
          name: cashFormData.name.trim(),
          description: cashFormData.description?.trim() || undefined,
          openingBalance: Number(cashFormData.openingBalance) || 0,
          notes: cashFormData.notes?.trim() || undefined,
          status: cashFormData.status
        })
        showToast('Cash book created successfully.', 'success')
      }
      setIsCashFormOpen(false)
      onRefresh()
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save cash book.')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete Action
  const handleDeleteConfirm = async () => {
    if (!deletingItem) return
    try {
      setSubmitting(true)
      if (deletingItem.type === 'bank') {
        await simpleAccountsService.deleteBankAccount(deletingItem.id)
        showToast('Bank account deleted.', 'success')
      } else {
        await simpleAccountsService.deleteCashBook(deletingItem.id)
        showToast('Cash book deleted.', 'success')
      }
      setIsDeleteOpen(false)
      setDeletingItem(null)
      onRefresh()
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to delete account.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <EnterpriseModal
        isOpen={isOpen}
        onClose={onClose}
        title="Manage Accounts & Cash Books"
        maxWidth="2xl"
      >
        <div className="flex flex-col gap-5 text-left">
          {/* Subheader tabs & quick add */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('bank')}
                className={`flex items-center gap-2 py-1.5 px-4 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'bank'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                Bank Accounts ({bankAccounts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cash')}
                className={`flex items-center gap-2 py-1.5 px-4 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'cash'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                Cash Books ({cashBooks.length})
              </button>
            </div>

            {canWrite && (
              <div>
                {activeTab === 'bank' ? (
                  <EnterpriseButton variant="primary" size="sm" onClick={handleOpenAddBank}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    New Bank Account
                  </EnterpriseButton>
                ) : (
                  <EnterpriseButton variant="primary" size="sm" onClick={handleOpenAddCash}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    New Cash Book
                  </EnterpriseButton>
                )}
              </div>
            )}
          </div>

          {/* Tab Content */}
          {activeTab === 'bank' ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {bankAccounts.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Landmark className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No bank accounts yet</p>
                  <p className="text-xs text-slate-400 mt-1">Add your company's bank accounts to track transactions and balances.</p>
                </div>
              ) : (
                bankAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{account.bankName}</h4>
                          <span className="text-xs text-slate-500 font-medium">({account.accountName})</span>
                          <EnterpriseBadge
                            variant={account.status === 'Active' ? 'success' : 'gray'}
                          >
                            {account.status}
                          </EnterpriseBadge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                          <span>A/C: <span className="font-mono font-semibold text-slate-700">{account.accountNumber}</span></span>
                          <span>•</span>
                          <span>IFSC: <span className="font-mono text-slate-700">{account.ifscCode}</span></span>
                          {account.notes && (
                            <>
                              <span>•</span>
                              <span className="italic text-slate-400 truncate max-w-xs">{account.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Current Balance</span>
                        <span className={`font-bold text-sm ${getBalanceColorClass(account.currentBalance)}`}>
                          {formatBalanceCurrency(account.currentBalance)}
                        </span>
                      </div>

                      {canWrite && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Deposit Money"
                            onClick={() => onOpenAddMoney('bank', account.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Edit Account"
                            onClick={() => handleOpenEditBank(account)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <PenSquare className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete Account"
                            onClick={() => {
                              setDeletingItem({ type: 'bank', id: account.id, name: `${account.bankName} (${account.accountName})` })
                              setIsDeleteOpen(true)
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {cashBooks.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No cash books yet</p>
                  <p className="text-xs text-slate-400 mt-1">Add cash registers or petty cash books to record physical cash flow.</p>
                </div>
              ) : (
                cashBooks.map((book) => (
                  <div
                    key={book.id}
                    className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0 mt-0.5">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{book.name}</h4>
                          <EnterpriseBadge
                            variant={book.status === 'Active' ? 'success' : 'gray'}
                          >
                            {book.status}
                          </EnterpriseBadge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 truncate">
                          {book.description || 'General Cash Book'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Current Balance</span>
                        <span className={`font-bold text-sm ${getBalanceColorClass(book.currentBalance)}`}>
                          {formatBalanceCurrency(book.currentBalance)}
                        </span>
                      </div>

                      {canWrite && (
                        <div className="flex items-center gap-1.5">
                          {parseBalance(book.currentBalance) < 0 && (
                            <button
                              type="button"
                              title="Settle Negative Balance"
                              onClick={() => {
                                setSettleTargetBook(book)
                                setIsSettleOpen(true)
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg transition-colors flex items-center gap-1 shadow-2xs shrink-0 cursor-pointer"
                            >
                              <Scale className="w-3.5 h-3.5 text-amber-600" />
                              Settle
                            </button>
                          )}
                          <button
                            type="button"
                            title="Add Cash"
                            onClick={() => onOpenAddMoney('cash', book.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Edit Cash Book"
                            onClick={() => handleOpenEditCash(book)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <PenSquare className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete Cash Book"
                            onClick={() => {
                              setDeletingItem({ type: 'cash', id: book.id, name: book.name })
                              setIsDeleteOpen(true)
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <EnterpriseButton variant="secondary" onClick={onClose}>
              Close
            </EnterpriseButton>
          </div>
        </div>
      </EnterpriseModal>

      {/* Add / Edit Bank Account Modal */}
      {isBankFormOpen && (
        <EnterpriseModal
          isOpen={isBankFormOpen}
          onClose={() => setIsBankFormOpen(false)}
          title={editingBank ? 'Edit Bank Account' : 'Add Bank Account'}
          maxWidth="md"
        >
          <form onSubmit={handleSaveBank} className="flex flex-col gap-4 text-left">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <EnterpriseInput
              label="Bank Name *"
              placeholder="e.g. HDFC Bank, State Bank of India"
              value={bankFormData.bankName}
              onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
              required
            />

            <EnterpriseInput
              label="Account Holder / Display Name *"
              placeholder="e.g. Aquora Main Current A/C"
              value={bankFormData.accountName}
              onChange={(e) => setBankFormData({ ...bankFormData, accountName: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EnterpriseInput
                label="Account Number *"
                placeholder="e.g. 50200012345678"
                value={bankFormData.accountNumber}
                onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                required
              />

              <EnterpriseInput
                label="IFSC Code *"
                placeholder="e.g. HDFC0001234"
                value={bankFormData.ifscCode}
                onChange={(e) => setBankFormData({ ...bankFormData, ifscCode: e.target.value.toUpperCase() })}
                required
              />
            </div>

            {!editingBank && (
              <EnterpriseInput
                label="Opening Balance (₹)"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={bankFormData.openingBalance.toString()}
                onChange={(e) => setBankFormData({ ...bankFormData, openingBalance: parseFloat(e.target.value) || 0 })}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Status</label>
                <EnterpriseSelect
                  value={bankFormData.status}
                  onChange={(e) => setBankFormData({ ...bankFormData, status: e.target.value })}
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' }
                  ]}
                />
              </div>

              <EnterpriseInput
                label="Notes (Optional)"
                placeholder="Branch or remarks"
                value={bankFormData.notes || ''}
                onChange={(e) => setBankFormData({ ...bankFormData, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <EnterpriseButton variant="secondary" onClick={() => setIsBankFormOpen(false)} disabled={submitting}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton variant="primary" type="submit" disabled={submitting} loading={submitting}>
                {editingBank ? 'Save Changes' : 'Create Bank Account'}
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* Add / Edit Cash Book Modal */}
      {isCashFormOpen && (
        <EnterpriseModal
          isOpen={isCashFormOpen}
          onClose={() => setIsCashFormOpen(false)}
          title={editingCash ? 'Edit Cash Book' : 'Add Cash Book'}
          maxWidth="md"
        >
          <form onSubmit={handleSaveCash} className="flex flex-col gap-4 text-left">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <EnterpriseInput
              label="Cash Book Name *"
              placeholder="e.g. Main Cash Book, Petty Cash"
              value={cashFormData.name}
              onChange={(e) => setCashFormData({ ...cashFormData, name: e.target.value })}
              required
            />

            <EnterpriseInput
              label="Description (Optional)"
              placeholder="e.g. Office daily petty cash drawer"
              value={cashFormData.description || ''}
              onChange={(e) => setCashFormData({ ...cashFormData, description: e.target.value })}
            />

            {!editingCash && (
              <EnterpriseInput
                label="Opening Balance (₹)"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cashFormData.openingBalance.toString()}
                onChange={(e) => setCashFormData({ ...cashFormData, openingBalance: parseFloat(e.target.value) || 0 })}
              />
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Status</label>
              <EnterpriseSelect
                value={cashFormData.status}
                onChange={(e) => setCashFormData({ ...cashFormData, status: e.target.value })}
                options={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' }
                ]}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <EnterpriseButton variant="secondary" onClick={() => setIsCashFormOpen(false)} disabled={submitting}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton variant="primary" type="submit" disabled={submitting} loading={submitting}>
                {editingCash ? 'Save Changes' : 'Create Cash Book'}
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && deletingItem && (
        <EnterpriseModal
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          title={`Delete ${deletingItem.type === 'bank' ? 'Bank Account' : 'Cash Book'}`}
          maxWidth="sm"
        >
          <div className="flex flex-col gap-4 text-left">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete <span className="font-bold text-slate-900">{deletingItem.name}</span>?
              This action cannot be undone if no transactions exist.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <EnterpriseButton variant="secondary" onClick={() => setIsDeleteOpen(false)} disabled={submitting}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton variant="danger" onClick={handleDeleteConfirm} disabled={submitting} loading={submitting}>
                Delete
              </EnterpriseButton>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* Settle Negative Cash Balance Modal */}
      <SettleCashBookModal
        isOpen={isSettleOpen}
        onClose={() => {
          setIsSettleOpen(false)
          setSettleTargetBook(null)
        }}
        targetCashBook={settleTargetBook}
        onSuccess={() => {
          onRefresh()
        }}
      />
    </>
  )
}
