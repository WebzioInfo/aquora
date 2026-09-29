import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Search,
  Filter,
  Eye,
  PenSquare,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  History,
  PlusCircle,
  Printer,
  Download,
  RotateCcw
} from 'lucide-react'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import { getTransactionEventBadge } from '../../../utils/transactionBadge'
import { AddMoneyModal } from './AddMoneyModal'
import { PrintPreviewModal } from '../../../components/ui/PrintPreviewModal'
import type {
  BankAccount,
  BankSummary,
  BankLedgerEntry,
  BankLedgerFilter,
  SimpleExpense,
  UpdateSimpleExpenseRequest,
  BankAccountDropdown,
  BankLedgerAuditEntry
} from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useAuthStore } from '../../../store/useAuthStore'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseInput from '../../../components/ui/EnterpriseInput'
import EnterpriseNumberInput from '../../../components/ui/EnterpriseNumberInput'
import EnterpriseSelect from '../../../components/ui/EnterpriseSelect'
import { PageContainer, PageHeader, KPICard, SectionCard } from '../../../components/ui/layout'


const EXPENSE_CATEGORIES = [
  'Salary',
  'Electricity',
  'Fuel',
  'Maintenance',
  'Vehicle',
  'Rent',
  'Infrastructure',
  'Purchase Related',
  'Miscellaneous',
  'Tax',
  'Stationary',
]

export const BankAccountDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useNotificationStore()

  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null)
  const [summary, setSummary] = useState<BankSummary | null>(null)
  const [ledgerItems, setLedgerItems] = useState<BankLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isNotFound, setIsNotFound] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<BankLedgerFilter>({})

  // Modals for Actions
  const [isViewExpenseOpen, setIsViewExpenseOpen] = useState(false)
  const [viewExpense, setViewExpense] = useState<SimpleExpense | null>(null)

  const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editingLedgerEntry, setEditingLedgerEntry] = useState<BankLedgerEntry | null>(null)
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [bankAccountsDropdown, setBankAccountsDropdown] = useState<BankAccountDropdown[]>([])
  const [editFormData, setEditFormData] = useState<UpdateSimpleExpenseRequest>({
    expenseDate: new Date().toISOString().split('T')[0],
    category: 'Miscellaneous',
    vendor: '',
    description: '',
    amount: 0,
    paymentMethod: 'Bank',
    bankAccountId: id,
    notes: ''
  })

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const [deletingRefNumber, setDeletingRefNumber] = useState<string>('')
  const [submittingDelete, setSubmittingDelete] = useState(false)

  // Deposit Modal States
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false)
  const [isEditDepositOpen, setIsEditDepositOpen] = useState(false)
  const [selectedDepositEntry, setSelectedDepositEntry] = useState<any | null>(null)
  const [isDeleteDepositOpen, setIsDeleteDepositOpen] = useState(false)
  const [submittingDeleteDeposit, setSubmittingDeleteDeposit] = useState(false)
  const [isViewDepositOpen, setIsViewDepositOpen] = useState(false)

  // Audit History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState<BankLedgerAuditEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedLedgerRef, setSelectedLedgerRef] = useState('')

  // Print Preview Modal States
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printDocData, setPrintDocData] = useState<any>(null)

  const { user } = useAuthStore()
  const roles = user?.roles || []
  const isOwner = roles.some((r: string) => ['owner', 'companyowner', 'platformowner'].includes(r.toLowerCase())) || user?.roleName?.toLowerCase() === 'owner'
  const isAdmin = !isOwner && (roles.includes('CompanyAdmin') || roles.includes('Accountant') || roles.includes('SuperAdmin') || roles.includes('PlatformAdmin'))
  const isManager = !isOwner && (roles.includes('Manager') || roles.includes('GeneralManager'))

  const canEdit = isAdmin
  const canDelete = isAdmin


  useEffect(() => {
    if (id) {
      fetchData()
    }
  }, [id])

  useEffect(() => {
    if (id) {
      fetchLedger()
    }
  }, [id, page, pageSize, filter])

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    setIsNotFound(false)
    setFetchError(null)

    try {
      // Fetch Bank Account Details, Summary, and Dropdown in parallel
      const [accountRes, summaryRes, dropdownRes] = await Promise.all([
        simpleAccountsService.getBankAccountById(id),
        simpleAccountsService.getBankSummary(id).catch((sumErr) => {
          console.error('Failed to load bank summary:', sumErr)
          return null
        }),
        simpleAccountsService.getBankAccountDropdown().catch((ddErr) => {
          console.error('Failed to load bank dropdown:', ddErr)
          return []
        })
      ])

      if (!accountRes) {
        setIsNotFound(true)
        setLoading(false)
        return
      }

      setBankAccount(accountRes)
      if (summaryRes) {
        setSummary(summaryRes)
      } else {
        setSummary({
          currentBalance: accountRes.currentBalance,
          totalTransactions: 0,
          totalMoneyReceived: 0,
          totalMoneyPaid: 0,
          largestDeposit: 0,
          largestExpense: 0,
          todaysTransactions: 0,
          thisMonthTransactions: 0
        })
      }
      setBankAccountsDropdown(dropdownRes || [])
    } catch (err: any) {
      console.error('Error fetching bank account:', err)
      const status = err.response?.status || err.status
      if (status === 404 || err.message?.toLowerCase().includes('not found')) {
        setIsNotFound(true)
      } else {
        setFetchError(err.message || 'Failed to load bank account details')
        showToast(err.message || 'Failed to load bank account details', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchLedger = async () => {
    if (!id) return
    try {
      const res = await simpleAccountsService.getBankLedger(id, {
        pageNumber: page,
        pageSize: pageSize,
        search: search || undefined,
        ...filter
      })
      setLedgerItems(res?.items || [])
      setTotalCount(res?.totalCount || 0)
      setTotalPages(res?.totalPages || 0)
    } catch (err: any) {
      console.error('Failed to load ledger:', err)
      setLedgerItems([])
      setTotalCount(0)
      setTotalPages(0)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchLedger()
  }

  const handleOpenViewHistory = async (ledgerEntryId: string, referenceNumber: string) => {
    try {
      setLoadingHistory(true)
      setSelectedLedgerRef(referenceNumber || 'N/A')
      setIsHistoryOpen(true)
      const items = await simpleAccountsService.getLedgerHistory(ledgerEntryId)
      setHistoryItems(items || [])
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch transaction history', 'error')
      setIsHistoryOpen(false)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Handle Action Modals
  const handleOpenViewExpense = async (expenseId: string) => {
    try {
      const exp = await simpleAccountsService.getExpenseById(expenseId)
      setViewExpense(exp)
      setIsViewExpenseOpen(true)
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch expense details', 'error')
    }
  }

  const getNumberInputValue = (value: unknown) => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') return Number(value) || 0

    const eventValue = (value as { target?: { valueAsNumber?: number; value?: string } })?.target
    if (eventValue) {
      if (typeof eventValue.valueAsNumber === 'number' && !Number.isNaN(eventValue.valueAsNumber)) {
        return eventValue.valueAsNumber
      }
      return Number(eventValue.value) || 0
    }

    return 0
  }

  const handleOpenEditExpense = async (
    ledgerEntry: BankLedgerEntry,
    event?: React.MouseEvent<HTMLButtonElement>
  ) => {
    event?.preventDefault()
    event?.stopPropagation()

    if (!ledgerEntry.relatedEntityId || ledgerEntry.relatedEntityType?.toLowerCase() !== 'expense') {
      showToast('Only linked expense ledger entries can be edited from this view.', 'error')
      return
    }

    try {
      setEditingLedgerEntry(ledgerEntry)
      const expenseId = ledgerEntry.relatedEntityId
      const exp = await simpleAccountsService.getExpenseById(expenseId)
      setEditingExpenseId(exp.id)
      setEditFormData({
        expenseDate: exp.expenseDate ? exp.expenseDate.split('T')[0] : new Date().toISOString().split('T')[0],
        category: exp.category || 'Miscellaneous',
        vendor: exp.vendor || '',
        description: exp.description || '',
        amount: exp.amount || 0,
        paymentMethod: exp.paymentMethod || 'Bank',
        bankAccountId: exp.bankAccountId || id,
        notes: exp.notes || ''
      })
      setIsEditExpenseOpen(true)
    } catch (err: any) {
      console.error('Failed to open ledger expense editor:', err)
      showToast(err.message || 'Failed to fetch expense for editing', 'error')
      setEditingLedgerEntry(null)
    }
  }

  const handleSaveEditExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingEdit) return

    if (!editingExpenseId) {
      showToast('Unable to save because no linked expense is selected.', 'error')
      return
    }

    if (!editFormData.description.trim()) {
      showToast('Description is required.', 'error')
      return
    }

    if (editFormData.amount <= 0) {
      showToast('Amount must be greater than zero.', 'error')
      return
    }

    if (editFormData.paymentMethod === 'Bank' && !editFormData.bankAccountId) {
      showToast('Bank account is required for bank-paid expenses.', 'error')
      return
    }

    try {
      setSubmittingEdit(true)
      await simpleAccountsService.updateExpense(editingExpenseId, editFormData)
      showToast('Expense updated successfully.', 'success')
      setIsEditExpenseOpen(false)
      setEditingLedgerEntry(null)
      await Promise.all([fetchData(), fetchLedger()])
    } catch (err: any) {
      console.error('Failed to save ledger expense edit:', err)
      showToast(err.message || 'Failed to update expense', 'error')
    } finally {
      setSubmittingEdit(false)
    }
  }

  const handleOpenDeleteExpense = (expenseId: string, refNum: string) => {
    setDeletingExpenseId(expenseId)
    setDeletingRefNumber(refNum)
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDeleteExpense = async () => {
    if (!deletingExpenseId) return
    try {
      setSubmittingDelete(true)
      await simpleAccountsService.deleteExpense(deletingExpenseId)
      showToast('Expense deleted and bank balance updated.', 'success')
      setIsDeleteModalOpen(false)
      fetchData()
      fetchLedger()
    } catch (err: any) {
      showToast(err.message || 'Failed to delete expense', 'error')
    } finally {
      setSubmittingDelete(false)
    }
  }

  const handleDeleteDeposit = async () => {
    if (!selectedDepositEntry) return
    try {
      setSubmittingDeleteDeposit(true)
      await simpleAccountsService.deleteBankDeposit(selectedDepositEntry.id)
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0)

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return { dayStr: '—', timeStr: '' }

    // Ensure the date string is treated as UTC if it doesn't have timezone info,
    // although our backend now explicitly returns UTC with Z
    const dateToParse = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : `${dateStr}Z`;
    const date = new Date(dateToParse)

    if (isNaN(date.getTime())) return { dayStr: '—', timeStr: '' }

    const dayStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
    return { dayStr, timeStr }
  }

  const handlePrintLedgerEntry = (item: BankLedgerEntry) => {
    const isOutflow = item.debit > 0;
    const amount = isOutflow ? item.debit : item.credit;

    setPrintDocData({
      title: isOutflow ? 'Bank Payment Voucher' : 'Bank Deposit Receipt',
      docNumber: item.referenceNumber || 'VOUCHER-TEMP',
      date: new Date(item.createdAt || item.transactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
      partyLabel: isOutflow ? 'Paid To' : 'Received From',
      partyInfo: {
        name: item.description?.split('Paid to')?.[1]?.trim() || item.description?.split('Received from')?.[1]?.trim() || 'Internal Allocation',
        details1: `Transaction Ref: ${item.referenceNumber || 'N/A'}`
      },
      preparedBy: item.createdBy || 'System',
      paymentDetails: {
        method: 'Bank Account Transfer',
        reference: item.referenceNumber || 'N/A'
      },
      items: [
        {
          sno: 1,
          description: item.description || 'Ledger transaction entry record',
          quantity: 1,
          unitPrice: amount,
          amount: amount
        }
      ],
      financialSummary: {
        subTotal: amount,
        grandTotal: amount,
        amountPaid: amount,
        balance: 0
      },
      notes: 'This is a system-generated bank transaction record from Aquzio ledger accounts.'
    });
    setPrintModalOpen(true);
  };

  const getTransactionTypeBadge = (item: BankLedgerEntry) => {
    const type = item.transactionType || ''
    const relType = item.relatedEntityType || ''
    const desc = (item.description || '').toLowerCase()

    // Check Reversal first
    if (relType.toLowerCase() === 'reversal' || type.toLowerCase().includes('reversal') || desc.includes('reversal')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Reversal
        </span>
      )
    }

    if (relType.toLowerCase() === 'purchase' || type.toLowerCase().includes('purchase')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
          Purchase Payment
        </span>
      )
    }

    if (relType.toLowerCase() === 'expense' || type.toLowerCase().includes('expense')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Expense
        </span>
      )
    }

    if (relType.toLowerCase() === 'salary' || relType.toLowerCase() === 'payroll' || type.toLowerCase().includes('salary') || type.toLowerCase().includes('payroll') || desc.includes('salary') || desc.includes('payroll') || desc.includes('payslip')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          Salary
        </span>
      )
    }

    if (type.toLowerCase() === 'opening balance' || desc.includes('opening balance')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Opening Balance
        </span>
      )
    }

    if (type.toLowerCase() === 'deposit') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Deposit
        </span>
      )
    }

    if (type.toLowerCase() === 'withdrawal') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
          Withdrawal
        </span>
      )
    }

    if (type.toLowerCase().includes('transfer') || desc.includes('transfer')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          Bank Transfer
        </span>
      )
    }

    if (type.toLowerCase().includes('refund') || desc.includes('refund')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Vendor Refund
        </span>
      )
    }

    if (type.toLowerCase().includes('receipt') || type.toLowerCase().includes('customer') || desc.includes('receipt') || desc.includes('customer')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
          Customer Receipt
        </span>
      )
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
        {type}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-slate-200 border-t-[#1A56DB] animate-spin"></div>
          <p className="text-xs font-medium text-slate-500 animate-pulse">Loading bank details...</p>
        </div>
      </div>
    )
  }

  if (isNotFound) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-3 border border-rose-100">
          <Building2 className="w-6 h-6 text-rose-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Bank account not found.</h2>
        <p className="text-xs text-slate-500 mb-4 max-w-xs">The requested bank account does not exist or was removed.</p>
        <EnterpriseButton variant="primary" onClick={() => navigate('/company/accounts/bank-accounts')}>
          Back to Bank Accounts
        </EnterpriseButton>
      </div>
    )
  }

  if (fetchError && !bankAccount) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-3 border border-amber-100">
          <Activity className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Error Loading Details</h2>
        <p className="text-xs text-slate-500 mb-4 max-w-xs">{fetchError}</p>
        <EnterpriseButton variant="primary" onClick={() => fetchData()}>
          Retry
        </EnterpriseButton>
      </div>
    )
  }

  if (!bankAccount) return null

  const maskAccountNumber = (num: string) => {
    if (!num) return ''
    if (num.length <= 4) return num
    return '•'.repeat(num.length - 4) + num.slice(-4)
  }

  return (
    <PageContainer>
      {/* HEADER */}
      <PageHeader
        title={bankAccount.bankName}
        description={`${bankAccount.accountName} • ${maskAccountNumber(bankAccount.accountNumber)}${bankAccount.ifscCode ? ` • IFSC: ${bankAccount.ifscCode}` : ''}`}
        icon={Building2}
        badge={
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${bankAccount.status === 'Active'
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
            {bankAccount.status}
          </span>
        }
        actions={
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="text-right px-3.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Current Balance</p>
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(bankAccount.currentBalance)}
              </p>
            </div>
            <EnterpriseButton
              variant="primary"
              onClick={() => setIsAddMoneyOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 hover:border-emerald-700 text-white shrink-0"
            >
              <PlusCircle className="w-4 h-4" /> Add Money
            </EnterpriseButton>
            <EnterpriseButton variant="secondary" onClick={() => navigate('/company/accounts/bank-accounts')}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </EnterpriseButton>
          </div>
        }
      />

      {/* KPI CARDS */}
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
            label="Avg Monthly Flow"
            value={formatCurrency(summary.averageMonthlyFlow || 0)}
            subtitle={`Largest Credit: ${formatCurrency(summary.largestDeposit || 0)}`}
            icon={Activity}
          />
          <KPICard
            label="Last Transaction"
            value={summary.lastTransactionAmount ? formatCurrency(summary.lastTransactionAmount) : '—'}
            subtitle={summary.lastTransactionDate ? `${new Date(summary.lastTransactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • ${summary.lastTransactionDescription || ''}` : 'No transactions'}
            icon={Wallet}
            colorClass="text-slate-900"
          />
        </div>
      )}

      {/* COMPACT BANK LEDGER TABLE */}
      <SectionCard title="Bank Ledger" description="Complete transaction history and running balance statement.">
        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">

          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch} className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search ref or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] w-full sm:w-56 transition-all shadow-2xs"
              />
            </form>
            <EnterpriseButton variant="secondary" onClick={() => { }} className="gap-1.5 py-1.5 text-xs shrink-0">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </EnterpriseButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Date & Time</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Ref / Details</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Transaction Type</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Recorded By</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Debit (Out)</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Credit (In)</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Running Balance</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgerItems.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center py-12 px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 border border-slate-100">
                        <Activity className="w-6 h-6 text-slate-300" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mb-0.5">No transactions available.</h3>
                      <p className="text-xs text-slate-500 text-center max-w-xs">
                        There are no ledger entries for this bank account yet.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                ledgerItems.map((item) => {
                  const { dayStr, timeStr } = formatDateTime(item.createdAt || item.transactionDate)
                  const relType = (item.relatedEntityType || '').toLowerCase()
                  const type = (item.transactionType || '').toLowerCase()

                  return (
                    <tr
                      key={item.id}
                      className="group hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-900">
                            {dayStr}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {timeStr}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col max-w-xs">
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {item.referenceNumber || '—'}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate" title={item.description}>
                            {item.description || 'No description provided'}
                          </span>
                          {item.auditNotes && (
                            <span className="text-[10px] text-amber-700 font-medium block truncate mt-0.5" title={item.auditNotes}>
                              {item.auditNotes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {getTransactionEventBadge(item)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-slate-700 font-medium">
                          {item.createdBy || 'System'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        {item.debit > 0 ? (
                          <span className="text-xs font-bold text-rose-600">
                            {formatCurrency(item.debit)}
                          </span>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        {item.credit > 0 ? (
                          <span className="text-xs font-bold text-emerald-600">
                            {formatCurrency(item.credit)}
                          </span>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        <span className="text-xs font-bold text-slate-900">
                          {formatCurrency(item.runningBalance)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* VIEW */}
                          {relType === 'purchase' && (
                            <button
                              onClick={() => navigate(`/company/accounts/purchases/${item.relatedEntityId}`)}
                              title="View Purchase"
                              className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {relType === 'expense' && (
                            <button
                              onClick={() => handleOpenViewExpense(item.relatedEntityId!)}
                              title="View Expense"
                              className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(relType === 'salary' || relType === 'payroll' || type.toLowerCase().includes('salary')) && (
                            <button
                              onClick={() => navigate('/company/accounts/payroll')}
                              title="View Payroll"
                              className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(type.toLowerCase() === 'deposit' || type.toLowerCase() === 'withdrawal' || type.toLowerCase() === 'opening balance') && !relType && (
                            <button
                              onClick={() => {
                                setSelectedDepositEntry(item)
                                setIsViewDepositOpen(true)
                              }}
                              title="View Details"
                              className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* EDIT */}
                          {relType === 'purchase' && canEdit && (
                            <button
                              onClick={() => navigate(`/company/accounts/purchases/edit/${item.relatedEntityId}`)}
                              title="Edit Purchase"
                              className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                            >
                              <PenSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {relType === 'expense' && canEdit && (
                            <button
                              onClick={(e) => handleOpenEditExpense(item, e)}
                              title="Edit Expense"
                              className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                            >
                              <PenSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(type.toLowerCase() === 'deposit' || type.toLowerCase() === 'withdrawal') && !relType && canEdit && (
                            <button
                              onClick={() => {
                                setSelectedDepositEntry(item)
                                setIsEditDepositOpen(true)
                              }}
                              title="Edit Transaction"
                              className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                            >
                              <PenSquare className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* PRINT */}
                          <button
                            onClick={() => handlePrintLedgerEntry(item)}
                            title="Print Ledger Entry"
                            className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* DELETE */}
                          {(type.toLowerCase() === 'deposit' || type.toLowerCase() === 'withdrawal' || type.toLowerCase() === 'opening balance') && !relType && canDelete && (
                            <button
                              onClick={() => {
                                setSelectedDepositEntry(item)
                                setIsDeleteDepositOpen(true)
                              }}
                              title="Delete Transaction"
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* AUDIT TIMELINE */}
                          <button
                            onClick={() => handleOpenViewHistory(item.id, item.referenceNumber)}
                            title="View Audit History"
                            className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* COMPACT PAGINATION */}
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-xs">
            <span className="text-slate-500">
              Showing <span className="font-medium text-slate-900">{(page - 1) * pageSize + 1}</span> to <span className="font-medium text-slate-900">{Math.min(page * pageSize, totalCount)}</span> of <span className="font-medium text-slate-900">{totalCount}</span> entries
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-2.5 py-1 border border-slate-200 rounded-md text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 transition-colors shadow-2xs"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-2.5 py-1 border border-slate-200 rounded-md text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 transition-colors shadow-2xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* VIEW EXPENSE MODAL */}
      {isViewExpenseOpen && viewExpense && (
        <EnterpriseModal
          isOpen={isViewExpenseOpen}
          onClose={() => setIsViewExpenseOpen(false)}
          title={`Expense Details - ${viewExpense.expenseNumber}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Expense Date</p>
                <p className="text-xs font-bold text-slate-900">
                  {new Date(viewExpense.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Amount</p>
                <p className="text-xs font-bold text-rose-600">{formatCurrency(viewExpense.amount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Category</p>
                <p className="text-xs font-medium text-slate-800">{viewExpense.category}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Payment Method</p>
                <p className="text-xs font-medium text-slate-800">{viewExpense.paidFrom || viewExpense.paymentMethod}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</p>
              <p className="text-xs text-slate-800 bg-white p-2 rounded-lg border border-slate-200">{viewExpense.description || 'N/A'}</p>
            </div>

            {viewExpense.vendor && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Vendor</p>
                <p className="text-xs text-slate-800">{viewExpense.vendor}</p>
              </div>
            )}

            {viewExpense.notes && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200">{viewExpense.notes}</p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <EnterpriseButton variant="secondary" onClick={() => setIsViewExpenseOpen(false)}>
                Close
              </EnterpriseButton>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* EDIT EXPENSE MODAL */}
      {isEditExpenseOpen && (
        <EnterpriseModal
          isOpen={isEditExpenseOpen}
          onClose={() => setIsEditExpenseOpen(false)}
          title="Edit Expense"
        >
          <form onSubmit={handleSaveEditExpense} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EnterpriseInput
                type="date"
                label="Expense Date"
                value={editFormData.expenseDate}
                onChange={(e) => setEditFormData({ ...editFormData, expenseDate: e.target.value })}
                required
              />
              <EnterpriseSelect
                label="Category"
                value={editFormData.category}
                onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))}
                required
              />
            </div>

            <EnterpriseInput
              label="Description"
              placeholder="e.g. Office electricity bill payment"
              value={editFormData.description}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EnterpriseNumberInput
                label="Amount (₹)"
                value={editFormData.amount}
                onChange={(val) => setEditFormData({ ...editFormData, amount: getNumberInputValue(val) })}
                required
                min={0.01}
              />
              <EnterpriseInput
                label="Vendor (Optional)"
                placeholder="e.g. EB Department"
                value={editFormData.vendor || ''}
                onChange={(e) => setEditFormData({ ...editFormData, vendor: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EnterpriseSelect
                label="Payment Method"
                value={editFormData.paymentMethod}
                onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                options={[
                  { value: 'Bank', label: 'Bank Account' },
                  { value: 'Cash', label: 'Cash' }
                ]}
                required
              />

              {editFormData.paymentMethod === 'Bank' && (
                <EnterpriseSelect
                  label="Bank Account"
                  value={editFormData.bankAccountId || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, bankAccountId: e.target.value })}
                  options={bankAccountsDropdown.map(b => ({
                    value: b.id,
                    label: `${b.bankName} - ${b.accountName} (₹${b.currentBalance.toLocaleString('en-IN')})`
                  }))}
                  required
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <EnterpriseButton
                variant="secondary"
                type="button"
                onClick={() => {
                  setIsEditExpenseOpen(false)
                  setEditingLedgerEntry(null)
                }}
                disabled={submittingEdit}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton variant="primary" type="submit" loading={submittingEdit}>
                Save Changes
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <EnterpriseModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Confirm Delete Expense"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-rose-900">Are you sure you want to delete expense {deletingRefNumber}?</p>
                <p className="mt-1 text-xs text-rose-700">
                  Deleting this expense will permanently remove it and automatically restore the deducted amount to the bank account balance.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <EnterpriseButton variant="secondary" onClick={() => setIsDeleteModalOpen(false)} disabled={submittingDelete}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                variant="primary"
                onClick={handleConfirmDeleteExpense}
                loading={submittingDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Delete Expense
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
          <div className="space-y-4 text-xs">
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
                      <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-white ${isCreated ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}></span>
                      <div className="flex items-center justify-between font-bold text-slate-900 mb-0.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${isCreated
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}>
                          {item.action}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {new Date(item.changedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                          {new Date(item.changedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                        <div className="grid grid-cols-2 gap-2 text-[11px] mb-1.5">
                          <div>
                            <span className="text-slate-500">Amount:</span>{' '}
                            <span className="font-bold text-slate-800">
                              {formatCurrency(item.newAmount)}
                            </span>
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

      {/* ADD DEPOSIT MODAL */}
      <AddMoneyModal
        isOpen={isAddMoneyOpen}
        onClose={() => setIsAddMoneyOpen(false)}
        bankAccountId={id}
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
        bankAccountId={id}
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
                  Deleting this deposit will permanently remove it from the ledger history and decrease the current bank balance. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <EnterpriseButton variant="secondary" onClick={() => {
                setIsDeleteDepositOpen(false)
                setSelectedDepositEntry(null)
              }} disabled={submittingDeleteDeposit}>
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
                <p className="text-sm font-bold text-emerald-600">{formatCurrency(selectedDepositEntry.credit || selectedDepositEntry.debit)}</p>
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
              <p className="text-xs font-semibold text-slate-900 bg-slate-50 p-2 border border-slate-100 rounded-lg">{selectedDepositEntry.description || '—'}</p>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <EnterpriseButton variant="secondary" onClick={() => {
                setIsViewDepositOpen(false)
                setSelectedDepositEntry(null)
              }}>
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
    </PageContainer>
  )
}

export default BankAccountDetailsPage
