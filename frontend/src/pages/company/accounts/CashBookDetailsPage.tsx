import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Search,
  History,
  PlusCircle,
  Eye,
  PenSquare,
  Trash2,
  AlertCircle
} from 'lucide-react'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type { BankLedgerEntry, BankSummary, CashBook } from '../../../services/simpleAccounts'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import { PageContainer, PageHeader, KPICard, SectionCard } from '../../../components/ui/layout'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { AddMoneyModal } from './AddMoneyModal'

const CashBookDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useNotificationStore()

  // State
  const [cashBook, setCashBook] = useState<CashBook | null>(null)
  const [summary, setSummary] = useState<BankSummary | null>(null)
  const [ledgerItems, setLedgerItems] = useState<BankLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  // Deposit Modal States
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false)
  const [isEditDepositOpen, setIsEditDepositOpen] = useState(false)
  const [selectedDepositEntry, setSelectedDepositEntry] = useState<any | null>(null)
  const [isDeleteDepositOpen, setIsDeleteDepositOpen] = useState(false)
  const [submittingDeleteDeposit, setSubmittingDeleteDeposit] = useState(false)
  const [isViewDepositOpen, setIsViewDepositOpen] = useState(false)

  // Audit History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedLedgerRef, setSelectedLedgerRef] = useState('')

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0)

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr?.endsWith('Z') ? dateStr : `${dateStr}Z`)
    if (Number.isNaN(date.getTime())) return { dayStr: '-', timeStr: '' }
    return {
      dayStr: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      timeStr: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }
  }

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const account = await simpleAccountsService.getCashBookById(id)
      setCashBook(account)
      const sum = await simpleAccountsService.getCashBookSummary(id)
      setSummary(sum)
    } catch (err: any) {
      console.error('Failed to load cash book details:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchLedger = async () => {
    if (!id) return
    try {
      const res = await simpleAccountsService.getCashBookLedger(id, {
        pageNumber: page,
        pageSize: 20,
        search: search || undefined
      })
      setLedgerItems(res?.items || [])
      setTotalPages(res?.totalPages || 0)
    } catch (err: any) {
      console.error('Failed to load ledger items:', err)
      setLedgerItems([])
      setTotalPages(0)
    }
  }

  const handleOpenViewHistory = async (entryId: string, refNum: string) => {
    setSelectedLedgerRef(refNum || '')
    setIsHistoryOpen(true)
    setLoadingHistory(true)
    try {
      const history = await simpleAccountsService.getLedgerHistory(entryId)
      setHistoryItems(history || [])
    } catch (err: any) {
      showToast(err.message || 'Failed to load transaction history', 'error')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleDeleteDeposit = async () => {
    if (!selectedDepositEntry) return
    try {
      setSubmittingDeleteDeposit(true)
      await simpleAccountsService.deleteCashDeposit(selectedDepositEntry.id)
      showToast('Deposit deleted successfully and running balances updated.', 'success')
      setIsDeleteDepositOpen(false)
      setSelectedDepositEntry(null)
      fetchData()
      fetchLedger()
    } catch (err: any) {
      showToast(err.message || 'Failed to delete deposit', 'error')
    } finally {
      setSubmittingDeleteDeposit(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  useEffect(() => {
    fetchLedger()
  }, [id, page])

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-slate-50/50">
        <p className="text-xs font-medium text-slate-500 animate-pulse">Loading cash book details...</p>
      </div>
    )
  }

  if (!cashBook) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <Wallet className="w-8 h-8 text-rose-500 mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">Cash book not found.</h2>
        <EnterpriseButton variant="primary" onClick={() => navigate('/company/accounts/ledger/cash-books')}>
          Back to Cash Books
        </EnterpriseButton>
      </div>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title={cashBook.name}
        description={cashBook.description || 'Cash book ledger and running balance'}
        icon={Wallet}
        badge={
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              cashBook.status === 'Active'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {cashBook.status}
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            <div className="text-right px-3.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Current Balance</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(cashBook.currentBalance)}</p>
            </div>
            <EnterpriseButton
              variant="primary"
              onClick={() => setIsAddMoneyOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 hover:border-emerald-700 text-white shrink-0"
            >
              <PlusCircle className="w-4 h-4" /> Add Money
            </EnterpriseButton>
            <EnterpriseButton variant="secondary" onClick={() => navigate('/company/accounts/ledger/cash-books')}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </EnterpriseButton>
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Total Received"
            value={formatCurrency(summary.totalMoneyReceived)}
            icon={ArrowDownRight}
            colorClass="text-emerald-600"
            iconColorClass="text-emerald-600"
            iconBgClass="bg-emerald-50"
          />
          <KPICard
            label="Total Paid"
            value={formatCurrency(summary.totalMoneyPaid)}
            icon={ArrowUpRight}
            colorClass="text-rose-600"
            iconColorClass="text-rose-600"
            iconBgClass="bg-rose-50"
          />
          <KPICard
            label="Transactions"
            value={summary.totalTransactions}
            subtitle={`${summary.todaysTransactions} Today • ${summary.thisMonthTransactions} This Month`}
            icon={Activity}
          />
          <KPICard
            label="Largest Records"
            value={formatCurrency(summary.largestDeposit)}
            subtitle={`Largest Payment: ${formatCurrency(summary.largestExpense)}`}
            icon={Wallet}
          />
        </div>
      )}

      <SectionCard title="Cash Ledger" description="Complete cash transaction history and running balance statement.">
        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setPage(1)
              fetchLedger()
            }}
            className="relative max-w-xs"
          >
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ref or description..."
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Reference</th>
                <th className="px-4 py-2.5 text-left">Transaction Type</th>
                <th className="px-4 py-2.5 text-left">Recorded By</th>
                <th className="px-4 py-2.5 text-right">Debit</th>
                <th className="px-4 py-2.5 text-right">Credit</th>
                <th className="px-4 py-2.5 text-right">Running Balance</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {ledgerItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-500">
                    There are no ledger entries for this cash book yet.
                  </td>
                </tr>
              ) : (
                ledgerItems.map((item) => {
                  const d = formatDateTime(item.transactionDate || item.createdAt)
                  const isDeposit = item.transactionType?.toLowerCase() === 'deposit'

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-semibold text-slate-900">{d.dayStr}</span>
                        <span className="block text-[10px] text-slate-500">{d.timeStr}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-semibold text-slate-900">{item.referenceNumber || '-'}</span>
                        <span className="block text-[11px] text-slate-500 truncate max-w-xs" title={item.description}>
                          {item.description || 'No description'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {item.transactionType?.toLowerCase() === 'deposit' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Deposit
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                            {item.transactionType}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">{item.createdBy || 'System'}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-rose-600">
                        {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-emerald-600">
                        {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-900">
                        {formatCurrency(item.runningBalance)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenViewHistory(item.id, item.referenceNumber)}
                            title="View Transaction History"
                            className="p-1 rounded-md text-indigo-500 hover:bg-indigo-50 transition-colors"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          {isDeposit && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedDepositEntry(item)
                                  setIsViewDepositOpen(true)
                                }}
                                title="View Deposit Details"
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDepositEntry(item)
                                  setIsEditDepositOpen(true)
                                }}
                                title="Edit Deposit"
                                className="p-1 rounded-md text-[#1A56DB] hover:text-[#1A56DB]/80 hover:bg-blue-50 transition-colors"
                              >
                                <PenSquare className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDepositEntry(item)
                                  setIsDeleteDepositOpen(true)
                                }}
                                title="Delete Deposit"
                                className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-slate-200 flex justify-end gap-1.5 bg-slate-50">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 border border-slate-200 rounded-md text-xs disabled:opacity-50 hover:bg-white transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 border border-slate-200 rounded-md text-xs disabled:opacity-50 hover:bg-white transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </SectionCard>

      {/* ADD DEPOSIT MODAL */}
      <AddMoneyModal
        isOpen={isAddMoneyOpen}
        onClose={() => setIsAddMoneyOpen(false)}
        cashBookId={id}
        onSuccess={() => {
          fetchData()
          fetchLedger()
        }}
      />

      {/* EDIT DEPOSIT MODAL */}
      <AddMoneyModal
        isOpen={isEditDepositOpen}
        onClose={() => {
          setIsEditDepositOpen(false)
          setSelectedDepositEntry(null)
        }}
        cashBookId={id}
        ledgerEntry={selectedDepositEntry}
        onSuccess={() => {
          fetchData()
          fetchLedger()
        }}
      />

      {/* DELETE DEPOSIT MODAL */}
      {isDeleteDepositOpen && selectedDepositEntry && (
        <EnterpriseModal
          isOpen={isDeleteDepositOpen}
          onClose={() => {
            setIsDeleteDepositOpen(false)
            setSelectedDepositEntry(null)
          }}
          title="Delete Deposit Transaction"
        >
          <div className="space-y-4 text-xs text-left">
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <span className="font-bold text-sm">Are you sure you want to delete this deposit?</span>
                <p className="mt-1 text-slate-600 font-medium">
                  Ref: <span className="font-bold text-slate-800">{selectedDepositEntry.referenceNumber || '—'}</span>
                </p>
                <p className="text-slate-600 font-medium">
                  Amount: <span className="font-bold text-slate-800">{formatCurrency(selectedDepositEntry.credit)}</span>
                </p>
                <p className="mt-2 text-rose-700 font-semibold">
                  Deleting this deposit will permanently remove it from the ledger history and decrease the current cash balance. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <EnterpriseButton
                variant="secondary"
                onClick={() => {
                  setIsDeleteDepositOpen(false)
                  setSelectedDepositEntry(null)
                }}
                disabled={submittingDeleteDeposit}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                variant="primary"
                onClick={handleDeleteDeposit}
                loading={submittingDeleteDeposit}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Delete Deposit
              </EnterpriseButton>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* VIEW DEPOSIT MODAL */}
      {isViewDepositOpen && selectedDepositEntry && (
        <EnterpriseModal
          isOpen={isViewDepositOpen}
          onClose={() => {
            setIsViewDepositOpen(false)
            setSelectedDepositEntry(null)
          }}
          title="Deposit Details"
        >
          <div className="space-y-4 text-xs text-left">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-400 font-medium">Date & Time</p>
                <p className="text-sm font-semibold text-slate-900">
                  {new Date(selectedDepositEntry.transactionDate || selectedDepositEntry.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Amount</p>
                <p className="text-sm font-bold text-emerald-600">{formatCurrency(selectedDepositEntry.credit)}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Reference Number</p>
                <p className="text-sm font-semibold text-slate-900">{selectedDepositEntry.referenceNumber || '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Transaction Type</p>
                <p className="text-sm font-semibold text-slate-900">{selectedDepositEntry.transactionType}</p>
              </div>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Description</p>
              <p className="text-xs font-semibold text-slate-900 bg-slate-50 p-2 border border-slate-100 rounded-lg">
                {selectedDepositEntry.description || '—'}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <EnterpriseButton
                variant="secondary"
                onClick={() => {
                  setIsViewDepositOpen(false)
                  setSelectedDepositEntry(null)
                }}
              >
                Close
              </EnterpriseButton>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* TRANSACTION HISTORY MODAL */}
      {isHistoryOpen && (
        <EnterpriseModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          title={`Transaction Audit History - Ref: ${selectedLedgerRef}`}
        >
          <div className="space-y-4 text-xs text-left">
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 rounded-full border-3 border-slate-200 border-t-[#1A56DB] animate-spin"></div>
              </div>
            ) : historyItems.length === 0 ? (
              <p className="text-center py-6 text-slate-500">No audit history found for this transaction.</p>
            ) : (
              <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4">
                {historyItems.map((item) => {
                  const isCreated = item.action.toLowerCase() === 'created'
                  return (
                    <div key={item.id} className="relative">
                      <span
                        className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-white ${
                          isCreated ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                      ></span>
                      <div className="flex items-center justify-between font-bold text-slate-900 mb-0.5">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                            isCreated
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}
                        >
                          {item.action}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {new Date(item.changedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}{' '}
                          {new Date(item.changedAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                        <div className="grid grid-cols-2 gap-2 text-[11px] mb-1.5">
                          <div>
                            <span className="text-slate-500">Amount:</span>{' '}
                            <span className="font-bold text-slate-800">{formatCurrency(item.newAmount)}</span>
                            {!isCreated && item.oldAmount > 0 && (
                              <span className="text-slate-400 line-through ml-1.5">
                                {formatCurrency(item.oldAmount)}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500">By:</span>{' '}
                            <span className="font-medium text-slate-700">{item.changedBy || 'System'}</span>
                          </div>
                        </div>
                        {item.remarks && (
                          <div className="text-[10px] text-slate-600 bg-white px-2 py-1.5 rounded border border-slate-100 mt-1 italic">
                            <span className="font-semibold not-italic text-slate-500 mr-1">Remarks:</span>
                            {item.remarks}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <EnterpriseButton variant="secondary" onClick={() => setIsHistoryOpen(false)}>
                Close
              </EnterpriseButton>
            </div>
          </div>
        </EnterpriseModal>
      )}
    </PageContainer>
  )
}

export default CashBookDetailsPage
