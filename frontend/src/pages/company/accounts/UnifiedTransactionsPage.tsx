import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Landmark,
  Wallet,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  SlidersHorizontal,
  Calendar,
  Layers,
  ChevronDown,
  Eye,
  History,
  PenSquare,
  Trash2,
  FileText,
  Building2,
  AlertCircle,
  X,
  CreditCard,
  DollarSign
} from 'lucide-react'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseInput from '../../../components/ui/EnterpriseInput'
import EnterpriseSelect from '../../../components/ui/EnterpriseSelect'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type {
  UnifiedLedgerEntry,
  UnifiedLedgerSummary,
  AccountsMetadata,
  BankAccount,
  CashBook,
  BankLedgerAuditEntry,
  AddMoneyRequest
} from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useAuthStore } from '../../../store/useAuthStore'
import { ManageAccountsModal } from './ManageAccountsModal'
import { AddMoneyModal } from './AddMoneyModal'
import { formatBalanceCurrency, getBalanceColorClass, parseBalance } from '../../../utils/balanceFormat'
import { formatLedgerDateTime } from '../../../utils/dateFormatter'

const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' }
]

const TRANSACTION_TYPES = [
  { value: '', label: 'All Transaction Types' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Sales Payment', label: 'Sales Payment / Dispatch' },
  { value: 'Customer Receipt', label: 'Customer Receipt' },
  { value: 'Supplier Payment', label: 'Supplier / Purchase Payment' },
  { value: 'Deposit', label: 'Deposit' },
  { value: 'Withdrawal', label: 'Withdrawal' },
  { value: 'Salary Payment', label: 'Salary Payment' },
  { value: 'Owner Investment', label: 'Owner Investment' },
  { value: 'Owner Withdrawal', label: 'Owner Withdrawal' },
  { value: 'Opening Balance', label: 'Opening Balance' }
]

export const UnifiedTransactionsPage: React.FC = () => {
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const isOwner = (user?.roles?.some(r => ['owner', 'companyowner', 'platformowner'].includes(r.toLowerCase())) || user?.roleName?.toLowerCase() === 'owner') ?? false
  const canWrite = !isOwner && (user?.roles?.some(r => ['CompanyAdmin', 'Admin', 'Manager', 'Accountant'].includes(r)) ?? false)

  // URL-driven query state
  const typeParam = (searchParams.get('type') || 'all').toLowerCase()
  const accountType: 'ALL' | 'BANK' | 'CASH' = typeParam === 'bank' ? 'BANK' : typeParam === 'cash' ? 'CASH' : 'ALL'
  const accountIdParam = searchParams.get('accountId') || ''
  const cashBookIdParam = searchParams.get('cashBookId') || ''
  const searchParam = searchParams.get('search') || ''
  const datePresetParam = searchParams.get('datePreset') || 'all'
  const dateFromParam = searchParams.get('dateFrom') || ''
  const dateToParam = searchParams.get('dateTo') || ''
  const txnTypeParam = searchParams.get('txnType') || ''
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const pageSizeParam = parseInt(searchParams.get('pageSize') || '25', 10)

  // Local state for immediate inputs
  const [searchTerm, setSearchTerm] = useState(searchParam)
  const [selectedTxnType, setSelectedTxnType] = useState(txnTypeParam)
  const [datePreset, setDatePreset] = useState(datePresetParam)
  const [customDateFrom, setCustomDateFrom] = useState(dateFromParam)
  const [customDateTo, setCustomDateTo] = useState(dateToParam)

  // Data state
  const [transactions, setTransactions] = useState<UnifiedLedgerEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize, setPageSize] = useState(pageSizeParam)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Summary & Accounts metadata
  const [summary, setSummary] = useState<UnifiedLedgerSummary | null>(null)
  const [metadata, setMetadata] = useState<AccountsMetadata | null>(null)
  const [allBankAccounts, setAllBankAccounts] = useState<BankAccount[]>([])
  const [allCashBooks, setAllCashBooks] = useState<CashBook[]>([])

  // Modals state
  const [isManageAccountsOpen, setIsManageAccountsOpen] = useState(false)
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false)
  const [addMoneyTarget, setAddMoneyTarget] = useState<{
    type: 'bank' | 'cash'
    id?: string
    prefilledAccount?: BankAccount | CashBook | null
  }>({ type: 'bank' })
  const [selectedEntryDetails, setSelectedEntryDetails] = useState<UnifiedLedgerEntry | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  // Audit History Modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState<BankLedgerAuditEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedHistoryRef, setSelectedHistoryRef] = useState('')

  // Edit / Delete Deposit Modal
  const [isEditDepositOpen, setIsEditDepositOpen] = useState(false)
  const [editingDepositEntry, setEditingDepositEntry] = useState<UnifiedLedgerEntry | null>(null)
  const [isDeleteDepositOpen, setIsDeleteDepositOpen] = useState(false)
  const [deletingDepositEntry, setDeletingDepositEntry] = useState<UnifiedLedgerEntry | null>(null)
  const [submittingDeleteDeposit, setSubmittingDeleteDeposit] = useState(false)

  // Add Dropdown open
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false)

  // Synchronize local input state when URL changes
  useEffect(() => {
    setSearchTerm(searchParam)
    setSelectedTxnType(txnTypeParam)
    setDatePreset(datePresetParam)
    setCustomDateFrom(dateFromParam)
    setCustomDateTo(dateToParam)
    setPageSize(pageSizeParam)
  }, [searchParam, txnTypeParam, datePresetParam, dateFromParam, dateToParam, pageSizeParam])

  // Helper to update URL search params
  const updateQueryParams = (updates: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined || val === '') {
        next.delete(key)
      } else {
        next.set(key, val)
      }
    })
    setSearchParams(next)
  }

  // Calculate actual Date Range from Preset
  const calculatedDateRange = useMemo(() => {
    const now = new Date()
    if (datePreset === 'today') {
      const todayStr = now.toISOString().substring(0, 10)
      return { from: todayStr, to: todayStr }
    }
    if (datePreset === 'week') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      const monday = new Date(now.setDate(diff))
      const mondayStr = monday.toISOString().substring(0, 10)
      const nowStr = new Date().toISOString().substring(0, 10)
      return { from: mondayStr, to: nowStr }
    }
    if (datePreset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const firstDayStr = firstDay.toISOString().substring(0, 10)
      const nowStr = new Date().toISOString().substring(0, 10)
      return { from: firstDayStr, to: nowStr }
    }
    if (datePreset === 'custom') {
      return { from: customDateFrom || undefined, to: customDateTo || undefined }
    }
    return { from: undefined, to: undefined }
  }, [datePreset, customDateFrom, customDateTo])

  // Load Accounts Metadata
  const loadAccountsMetadata = async () => {
    try {
      const [meta, banksRes, cashRes] = await Promise.all([
        simpleAccountsService.getAccountsMetadata(),
        simpleAccountsService.getBankAccounts({ pageSize: 100 }),
        simpleAccountsService.getCashBooks({ pageSize: 100 })
      ])
      setMetadata(meta)
      setAllBankAccounts(banksRes?.items || [])
      setAllCashBooks(cashRes?.items || [])
    } catch (err: any) {
      console.error('Failed to load accounts metadata:', err)
    }
  }

  // Load Transactions & Summary
  const fetchLedgerData = async () => {
    try {
      setLoading(true)
      const filter = {
        accountType: accountType,
        bankAccountId: accountType === 'BANK' && accountIdParam ? accountIdParam : undefined,
        cashBookId: accountType === 'CASH' && cashBookIdParam ? cashBookIdParam : undefined,
        search: searchParam || undefined,
        dateFrom: calculatedDateRange.from ? `${calculatedDateRange.from}T00:00:00Z` : undefined,
        dateTo: calculatedDateRange.to ? `${calculatedDateRange.to}T23:59:59Z` : undefined,
        transactionType: txnTypeParam || undefined,
        pageNumber: pageParam,
        pageSize: pageSize
      }

      const [ledgerResult, summaryResult] = await Promise.all([
        simpleAccountsService.getUnifiedLedger(filter),
        simpleAccountsService.getUnifiedLedgerSummary(filter)
      ])

      setTransactions(ledgerResult?.items || [])
      setTotalCount(ledgerResult?.totalCount || 0)
      setTotalPages(ledgerResult?.totalPages || 1)
      setSummary(summaryResult)
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to load ledger transactions.', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadAccountsMetadata()
  }, [])

  useEffect(() => {
    fetchLedgerData()
  }, [
    accountType,
    accountIdParam,
    cashBookIdParam,
    searchParam,
    datePresetParam,
    calculatedDateRange.from,
    calculatedDateRange.to,
    txnTypeParam,
    pageParam,
    pageSize
  ])

  // Handle Tab Change
  const handleTabChange = (type: 'ALL' | 'BANK' | 'CASH') => {
    updateQueryParams({
      type: type.toLowerCase(),
      accountId: null,
      cashBookId: null,
      page: '1'
    })
  }

  // Handle Secondary Account Selector
  const handleBankSelect = (bankId: string) => {
    updateQueryParams({
      accountId: bankId || null,
      page: '1'
    })
  }

  const handleCashBookSelect = (bookId: string) => {
    updateQueryParams({
      cashBookId: bookId || null,
      page: '1'
    })
  }

  // Search handler
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateQueryParams({
      search: searchTerm.trim() || null,
      page: '1'
    })
  }

  // Date Preset handler
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset)
    if (preset !== 'custom') {
      updateQueryParams({
        datePreset: preset === 'all' ? null : preset,
        dateFrom: null,
        dateTo: null,
        page: '1'
      })
    } else {
      updateQueryParams({
        datePreset: 'custom',
        page: '1'
      })
    }
  }

  const handleCustomDateApply = () => {
    updateQueryParams({
      datePreset: 'custom',
      dateFrom: customDateFrom || null,
      dateTo: customDateTo || null,
      page: '1'
    })
  }

  // Txn Type handler
  const handleTxnTypeChange = (type: string) => {
    setSelectedTxnType(type)
    updateQueryParams({
      txnType: type || null,
      page: '1'
    })
  }

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('')
    setSelectedTxnType('')
    setDatePreset('all')
    setCustomDateFrom('')
    setCustomDateTo('')
    updateQueryParams({
      accountId: null,
      cashBookId: null,
      search: null,
      datePreset: null,
      dateFrom: null,
      dateTo: null,
      txnType: null,
      page: '1'
    })
  }

  // Page size handler (defaults to 25, resets page to 1)
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    updateQueryParams({
      pageSize: newSize === 25 ? null : newSize.toString(),
      page: '1'
    })
  }

  const hasActiveFilters = !!(
    searchParam ||
    (accountType === 'BANK' && accountIdParam) ||
    (accountType === 'CASH' && cashBookIdParam) ||
    (datePresetParam && datePresetParam !== 'all') ||
    txnTypeParam
  )

  // Audit History Viewer
  const handleViewHistory = async (entry: UnifiedLedgerEntry) => {
    try {
      setSelectedHistoryRef(entry.referenceNumber || entry.description)
      setIsHistoryOpen(true)
      setLoadingHistory(true)
      const history = await simpleAccountsService.getLedgerHistory(entry.id)
      setHistoryItems(history || [])
    } catch (err: any) {
      showToast('No history available for this entry.', 'info')
      setHistoryItems([])
    } finally {
      setLoadingHistory(false)
    }
  }

  // Delete Deposit confirmation
  const handleDeleteDeposit = async () => {
    if (!deletingDepositEntry) return
    try {
      setSubmittingDeleteDeposit(true)
      if (deletingDepositEntry.accountType === 'BANK') {
        await simpleAccountsService.deleteBankDeposit(deletingDepositEntry.id)
      } else {
        await simpleAccountsService.deleteCashDeposit(deletingDepositEntry.id)
      }
      showToast('Deposit transaction deleted.', 'success')
      setIsDeleteDepositOpen(false)
      setDeletingDepositEntry(null)
      fetchLedgerData()
      loadAccountsMetadata()
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to delete deposit.', 'error')
    } finally {
      setSubmittingDeleteDeposit(false)
    }
  }

  // Open Add Money Modal
  const openAddMoney = (type: 'bank' | 'cash', accountId?: string, prefilledAccount?: BankAccount | CashBook | null) => {
    let resolvedAccount = prefilledAccount
    if (!resolvedAccount && accountId) {
      if (type === 'cash') {
        resolvedAccount = allCashBooks.find(c => c.id === accountId) || null
      } else {
        resolvedAccount = allBankAccounts.find(b => b.id === accountId) || null
      }
    }
    setAddMoneyTarget({ type, id: accountId, prefilledAccount: resolvedAccount })
    setIsAddMoneyOpen(true)
    setIsAddDropdownOpen(false)
  }

  // Format currency
  const formatCurrency = (val: number | undefined | null) => {
    return formatBalanceCurrency(val)
  }

  // Format date
  const formatDateTime = (dateStr: string, createdAtStr?: string) => {
    if (!dateStr && !createdAtStr) return '-'
    const { dayStr, timeStr } = formatLedgerDateTime(dateStr, createdAtStr)
    return timeStr && timeStr !== '—' ? `${dayStr} ${timeStr}` : dayStr
  }

  // Dropdown items for Add Money modal
  const dropdownBankOptions = useMemo(() => {
    return (metadata?.bankAccounts || []).map(b => ({
      id: b.id,
      name: `${b.bankName} - ${b.accountName} (${formatCurrency(b.currentBalance)})`
    }))
  }, [metadata])

  const dropdownCashOptions = useMemo(() => {
    return (metadata?.cashBooks || []).map(c => ({
      id: c.id,
      name: `${c.name} (${formatCurrency(c.currentBalance)})`
    }))
  }, [metadata])

  return (
    <div className="w-full flex flex-col space-y-3 text-left h-[calc(100vh-7rem)] min-h-[500px]">
      {/* 1. Header with Title & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2.5 border-b border-slate-200 select-none shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Accounts Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-normal">
            Unified chronological transaction feed across all bank accounts and cash books
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <EnterpriseButton
            variant="secondary"
            size="sm"
            onClick={() => {
              setRefreshing(true)
              fetchLedgerData()
              loadAccountsMetadata()
            }}
            disabled={refreshing}
            className="!h-[32px] text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            Refresh
          </EnterpriseButton>

          <EnterpriseButton
            variant="secondary"
            size="sm"
            onClick={() => setIsManageAccountsOpen(true)}
            className="!h-[32px] text-xs"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Manage Accounts
          </EnterpriseButton>

          {canWrite && (
            <div className="relative">
              {accountType === 'ALL' ? (
                <>
                  <EnterpriseButton
                    variant="primary"
                    size="sm"
                    onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
                    className="!h-[32px] text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add / Deposit
                    <ChevronDown className="w-3 h-3 ml-1 opacity-80" />
                  </EnterpriseButton>
                  {isAddDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-30 animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddDropdownOpen(false)
                          setIsManageAccountsOpen(true)
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2"
                      >
                        <Landmark className="w-4 h-4 text-indigo-500" />
                        + Add Bank Account
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddDropdownOpen(false)
                          setIsManageAccountsOpen(true)
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2"
                      >
                        <Wallet className="w-4 h-4 text-emerald-500" />
                        + Add Cash Book
                      </button>
                      <div className="h-px bg-slate-100 my-1" />
                      <button
                        type="button"
                        onClick={() => openAddMoney('bank')}
                        className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2"
                      >
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        Deposit to Bank
                      </button>
                      <button
                        type="button"
                        onClick={() => openAddMoney('cash')}
                        className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2"
                      >
                        <DollarSign className="w-4 h-4 text-amber-600" />
                        Add Cash to Book
                      </button>
                    </div>
                  )}
                </>
              ) : accountType === 'BANK' ? (
                <div className="flex items-center gap-1.5">
                  <EnterpriseButton
                    variant="secondary"
                    size="sm"
                    onClick={() => openAddMoney('bank', accountIdParam || undefined)}
                    className="!h-[32px] text-xs"
                  >
                    <DollarSign className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Deposit Money
                  </EnterpriseButton>
                  <EnterpriseButton
                    variant="primary"
                    size="sm"
                    onClick={() => setIsManageAccountsOpen(true)}
                    className="!h-[32px] text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Bank Account
                  </EnterpriseButton>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <EnterpriseButton
                    variant="secondary"
                    size="sm"
                    onClick={() => openAddMoney('cash', cashBookIdParam || undefined)}
                    className="!h-[32px] text-xs"
                  >
                    <DollarSign className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Add Cash
                  </EnterpriseButton>
                  <EnterpriseButton
                    variant="primary"
                    size="sm"
                    onClick={() => setIsManageAccountsOpen(true)}
                    className="!h-[32px] text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Cash Book
                  </EnterpriseButton>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Compact Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full shrink-0">
        {/* Total Balance Card */}
        <div className="p-3 flex flex-col justify-between h-[92px] sm:h-[96px] bg-white border border-slate-200/80 rounded-xl shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {accountType === 'ALL'
                  ? 'Total Accounts Balance'
                  : accountType === 'BANK'
                  ? accountIdParam ? 'Account Balance' : 'Total Bank Balance'
                  : cashBookIdParam ? 'Cash Book Balance' : 'Total Cash Balance'}
              </span>
              <div className={`p-1 rounded-md shrink-0 ${
                accountType === 'BANK' ? 'bg-indigo-50 text-indigo-600' :
                accountType === 'CASH' ? 'bg-emerald-50 text-emerald-600' :
                'bg-blue-50 text-blue-600'
              }`}>
                {accountType === 'CASH' ? <Wallet className="w-3.5 h-3.5" /> : <Landmark className="w-3.5 h-3.5" />}
              </div>
            </div>
            <div className="mt-0.5">
              <h3 className={`text-xl font-black tracking-tight font-mono leading-none ${getBalanceColorClass(summary?.totalBalance)}`}>
                {formatBalanceCurrency(summary?.totalBalance)}
              </h3>
            </div>
          </div>
          <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between truncate">
            {accountType === 'ALL' ? (
              <div className="flex items-center gap-1.5 flex-wrap truncate text-[10px]">
                <span className="font-semibold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded">
                  Bank: {formatCurrency(summary?.totalBankBalance)}
                </span>
                <span>•</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded">
                  Cash: {formatCurrency(summary?.totalCashBalance)}
                </span>
              </div>
            ) : accountType === 'BANK' ? (
              <span className="truncate">
                {accountIdParam
                  ? allBankAccounts.find(b => b.id === accountIdParam)?.bankName || 'Specific Bank Account'
                  : `${summary?.activeBankAccountsCount || 0} active bank accounts`}
              </span>
            ) : (
              <span className="truncate">
                {cashBookIdParam
                  ? allCashBooks.find(c => c.id === cashBookIdParam)?.name || 'Specific Cash Book'
                  : `${summary?.activeCashBooksCount || 0} active cash books`}
              </span>
            )}
          </div>
        </div>

        {/* Money In (Credit) */}
        <div className="p-3 flex flex-col justify-between h-[92px] sm:h-[96px] bg-white border border-slate-200/80 rounded-xl shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Money In (Received)</span>
              <div className="p-1 rounded-md shrink-0 bg-emerald-50 text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-0.5">
              <h3 className="text-xl font-black text-emerald-600 tracking-tight font-mono leading-none">
                +{formatCurrency(summary?.totalMoneyReceived)}
              </h3>
            </div>
          </div>
          <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-400">
            Total credits in view
          </div>
        </div>

        {/* Money Out (Debit) */}
        <div className="p-3 flex flex-col justify-between h-[92px] sm:h-[96px] bg-white border border-slate-200/80 rounded-xl shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Money Out (Paid)</span>
              <div className="p-1 rounded-md shrink-0 bg-rose-50 text-rose-600">
                <ArrowDownRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-0.5">
              <h3 className="text-xl font-black text-rose-600 tracking-tight font-mono leading-none">
                -{formatCurrency(summary?.totalMoneyPaid)}
              </h3>
            </div>
          </div>
          <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-400">
            Total debits in view
          </div>
        </div>

        {/* Net Flow / Activity */}
        <div className="p-3 flex flex-col justify-between h-[92px] sm:h-[96px] bg-white border border-slate-200/80 rounded-xl shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Net Flow / Activity</span>
              <div className="p-1 rounded-md shrink-0 bg-slate-100 text-slate-600">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-0.5">
              <h3 className={`text-xl font-black tracking-tight font-mono leading-none ${
                (summary?.netCashFlow || 0) >= 0 ? 'text-slate-900' : 'text-amber-600'
              }`}>
                {formatCurrency(summary?.netCashFlow)}
              </h3>
            </div>
          </div>
          <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Total records</span>
            <span className="font-bold text-slate-800">{totalCount}</span>
          </div>
        </div>
      </div>

      {/* 3. Compact Filter Toolbar (Single Row on Desktop) */}
      <div className="p-2 sm:px-3 sm:py-2 border border-slate-200/90 shadow-xs w-full bg-white rounded-xl shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          {/* Left / Middle Group */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Segmented Dataset Toggle Pills */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 shadow-inner shrink-0">
              <button
                type="button"
                onClick={() => handleTabChange('ALL')}
                className={`py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  accountType === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                ALL
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('BANK')}
                className={`flex items-center gap-1 py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  accountType === 'BANK'
                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Landmark className="w-3 h-3" />
                BANK
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('CASH')}
                className={`flex items-center gap-1 py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  accountType === 'CASH'
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Wallet className="w-3 h-3" />
                CASH
              </button>
            </div>

            {/* Date Preset Selector */}
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="h-[32px] px-2 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer shrink-0"
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            {/* Custom Date Inputs if Custom is selected */}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 shrink-0">
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="h-[26px] px-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none"
                />
                <span className="text-[10px] text-slate-400">to</span>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="h-[26px] px-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none"
                />
                <EnterpriseButton variant="primary" size="sm" onClick={handleCustomDateApply} className="!h-[26px] !py-0 !px-2 text-xs">
                  Apply
                </EnterpriseButton>
              </div>
            )}

            {/* Transaction Type Filter */}
            <select
              value={selectedTxnType}
              onChange={(e) => handleTxnTypeChange(e.target.value)}
              className="h-[32px] px-2 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[170px] truncate shrink-0"
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {/* Dynamic Secondary Filter: Bank Account selector or Cash Book selector */}
            {accountType === 'BANK' && (
              <select
                value={accountIdParam}
                onChange={(e) => handleBankSelect(e.target.value)}
                className="h-[32px] px-2 text-xs bg-white border border-indigo-200 rounded-lg font-semibold text-indigo-950 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[200px] truncate shrink-0"
              >
                <option value="">All Bank Accounts</option>
                {(metadata?.bankAccounts || []).map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountName} ({formatCurrency(b.currentBalance)})
                  </option>
                ))}
              </select>
            )}

            {accountType === 'CASH' && (
              <select
                value={cashBookIdParam}
                onChange={(e) => handleCashBookSelect(e.target.value)}
                className="h-[32px] px-2 text-xs bg-white border border-emerald-200 rounded-lg font-semibold text-emerald-950 focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[200px] truncate shrink-0"
              >
                <option value="">All Cash Books</option>
                {(metadata?.cashBooks || []).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({formatCurrency(c.currentBalance)})
                  </option>
                ))}
              </select>
            )}

            {/* Reset Filters button if any active */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer py-1 px-1.5 shrink-0"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>

          {/* Right Group: Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 w-full sm:w-60 md:w-72 lg:w-80 shrink-0">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search reference, party, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-[32px] pl-8 pr-6 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('')
                    updateQueryParams({ search: null, page: '1' })
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <EnterpriseButton variant="secondary" size="sm" type="submit" className="!h-[32px] !py-0 !px-3 text-xs">
              Search
            </EnterpriseButton>
          </form>
        </div>
      </div>

      {/* 4. Unified Transaction Table / Feed Card */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden w-full flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <EnterpriseLoading label="Loading unified transaction feed..." />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-2.5 text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {accountType === 'BANK'
                ? 'No bank transactions found'
                : accountType === 'CASH'
                ? 'No cash transactions found'
                : 'No transactions found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {hasActiveFilters
                ? 'No transactions matched your selected filters or search query.'
                : accountType === 'BANK'
                ? 'No transactions recorded for bank accounts yet.'
                : accountType === 'CASH'
                ? 'No transactions recorded for cash books yet.'
                : 'No transactions recorded yet across any bank account or cash book.'}
            </p>
            {hasActiveFilters && (
              <div className="mt-3">
                <EnterpriseButton variant="secondary" size="sm" onClick={handleClearFilters} className="!h-[30px] !py-0 text-xs">
                  Clear All Filters
                </EnterpriseButton>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Scrollable Rows Container (Only this area scrolls) */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs min-w-[950px]">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] select-none">
                  <tr className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3.5 w-[130px] whitespace-nowrap bg-slate-50">Date & Time</th>
                    <th className="py-2.5 px-3.5 min-w-[180px] whitespace-nowrap bg-slate-50">Account</th>
                    <th className="py-2.5 px-3.5 w-[150px] whitespace-nowrap bg-slate-50">Type</th>
                    <th className="py-2.5 px-3.5 min-w-[240px] max-w-md bg-slate-50">Description / Reference</th>
                    <th className="py-2.5 px-3.5 w-[120px] text-right whitespace-nowrap bg-slate-50">Money In</th>
                    <th className="py-2.5 px-3.5 w-[120px] text-right whitespace-nowrap bg-slate-50">Money Out</th>
                    <th className="py-2.5 px-3.5 w-[130px] text-right whitespace-nowrap bg-slate-50">Running Balance</th>
                    <th className="py-2.5 px-3.5 w-[90px] text-center whitespace-nowrap bg-slate-50">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {transactions.map((txn) => {
                    const isBank = txn.accountType === 'BANK'
                    const isManual = ['Deposit', 'Withdrawal', 'Opening Balance'].some(t =>
                      txn.transactionType.toLowerCase().includes(t.toLowerCase())
                    )

                    return (
                      <tr
                        key={txn.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-default"
                      >
                        {/* Date & Time */}
                        <td className="py-2 px-3.5 whitespace-nowrap">
                          {(() => {
                            const { dayStr, timeStr } = formatLedgerDateTime(txn.transactionDate, txn.createdAt)
                            return (
                              <>
                                <span className="font-semibold text-slate-900 block text-xs">
                                  {dayStr}
                                </span>
                                {timeStr && timeStr !== '—' ? (
                                  <span className="text-[10px] text-slate-500 font-mono block">
                                    {timeStr}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    —
                                  </span>
                                )}
                              </>
                            )
                          })()}
                        </td>

                        {/* Account */}
                        <td className="py-2 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1 py-0.2 rounded text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                                isBank
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                              }`}
                            >
                              {isBank ? 'BANK' : 'CASH'}
                            </span>
                            <span className="font-bold text-slate-800 text-xs truncate max-w-[180px]" title={txn.accountName}>
                              {txn.accountName}
                            </span>
                          </div>
                          {txn.accountNumber && (
                            <span className="text-[10px] text-slate-400 font-mono block pl-10">
                              A/C: {txn.accountNumber}
                            </span>
                          )}
                        </td>

                        {/* Transaction Type */}
                        <td className="py-2 px-3.5 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 block text-xs">
                            {txn.transactionType}
                          </span>
                          {txn.eventLabel && txn.eventLabel !== txn.transactionType && (
                            <span className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200/50 font-medium inline-block">
                              {txn.eventLabel}
                            </span>
                          )}
                        </td>

                        {/* Description & Reference */}
                        <td className="py-2 px-3.5 max-w-md">
                          <p className="font-medium text-slate-800 text-xs truncate" title={txn.description}>
                            {txn.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                            {txn.referenceNumber && (
                              <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-slate-600 border border-slate-200/60">
                                Ref: {txn.referenceNumber}
                              </span>
                            )}
                            {txn.createdBy && (
                              <span>By: {txn.createdBy}</span>
                            )}
                          </div>
                        </td>

                        {/* Money In */}
                        <td className="py-2 px-3.5 text-right whitespace-nowrap font-mono">
                          {txn.credit > 0 ? (
                            <span className="font-bold text-emerald-600 text-xs">
                              +{formatCurrency(txn.credit)}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Money Out */}
                        <td className="py-2 px-3.5 text-right whitespace-nowrap font-mono">
                          {txn.debit > 0 ? (
                            <span className="font-bold text-rose-600 text-xs">
                              -{formatCurrency(txn.debit)}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Running Balance */}
                        <td className="py-2 px-3.5 text-right whitespace-nowrap font-mono">
                          <span className={`font-semibold text-xs ${getBalanceColorClass(txn.runningBalance)}`}>
                            {formatBalanceCurrency(txn.runningBalance)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2 px-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              title="View Transaction Details"
                              onClick={() => {
                                setSelectedEntryDetails(txn)
                                setIsDetailsOpen(true)
                              }}
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              title="Audit History"
                              onClick={() => handleViewHistory(txn)}
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            {canWrite && isManual && txn.transactionType !== 'Opening Balance' && (
                              <>
                                <button
                                  type="button"
                                  title="Edit Deposit"
                                  onClick={() => {
                                    setEditingDepositEntry(txn)
                                    setIsEditDepositOpen(true)
                                  }}
                                  className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                                >
                                  <PenSquare className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Delete Deposit"
                                  onClick={() => {
                                    setDeletingDepositEntry(txn)
                                    setIsDeleteDepositOpen(true)
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 5. Pagination - Outside Scroll Container */}
            {totalCount > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3.5 py-2 bg-slate-50/90 border-t border-slate-200/90 text-xs text-slate-600 shrink-0">
                <div className="flex items-center gap-1.5 select-none text-[11px]">
                  <span>Showing</span>
                  <span className="font-bold text-slate-900">
                    {Math.min((pageParam - 1) * pageSize + 1, totalCount)}
                  </span>
                  <span>–</span>
                  <span className="font-bold text-slate-900">
                    {Math.min(pageParam * pageSize, totalCount)}
                  </span>
                  <span>of</span>
                  <span className="font-bold text-slate-900">{totalCount}</span>
                  <span>transactions</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 select-none text-[11px]">
                    <span className="text-slate-500 font-medium">Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                      className="h-6 px-1.5 border border-slate-200 rounded bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <EnterpriseButton
                      variant="secondary"
                      size="sm"
                      disabled={pageParam <= 1}
                      onClick={() => updateQueryParams({ page: (pageParam - 1).toString() })}
                      className="!h-[28px] !py-0 !px-2.5 text-xs"
                    >
                      Previous
                    </EnterpriseButton>
                    <span className="px-2 font-semibold text-slate-700 select-none text-xs">
                      Page {pageParam} of {totalPages}
                    </span>
                    <EnterpriseButton
                      variant="secondary"
                      size="sm"
                      disabled={pageParam >= totalPages}
                      onClick={() => updateQueryParams({ page: (pageParam + 1).toString() })}
                      className="!h-[28px] !py-0 !px-2.5 text-xs"
                    >
                      Next
                    </EnterpriseButton>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 6. Manage Accounts Modal */}
      {isManageAccountsOpen && (
        <ManageAccountsModal
          isOpen={isManageAccountsOpen}
          onClose={() => setIsManageAccountsOpen(false)}
          bankAccounts={allBankAccounts}
          cashBooks={allCashBooks}
          canWrite={canWrite}
          onRefresh={() => {
            loadAccountsMetadata()
            fetchLedgerData()
          }}
          onOpenAddMoney={(type, id, account) => {
            setIsManageAccountsOpen(false)
            openAddMoney(type, id, account)
          }}
        />
      )}

      {/* 7. Add Money Modal */}
      {isAddMoneyOpen && (
        <AddMoneyModal
          isOpen={isAddMoneyOpen}
          onClose={() => setIsAddMoneyOpen(false)}
          bankAccountId={addMoneyTarget.type === 'bank' ? addMoneyTarget.id : undefined}
          cashBookId={addMoneyTarget.type === 'cash' ? addMoneyTarget.id : undefined}
          prefilledCashBook={addMoneyTarget.type === 'cash' ? (addMoneyTarget.prefilledAccount as CashBook) : undefined}
          prefilledBankAccount={addMoneyTarget.type === 'bank' ? (addMoneyTarget.prefilledAccount as BankAccount) : undefined}
          targetType={addMoneyTarget.type}
          bankAccounts={dropdownBankOptions}
          cashBooks={allCashBooks.length > 0 ? allCashBooks : dropdownCashOptions}
          onSuccess={() => {
            fetchLedgerData()
            loadAccountsMetadata()
          }}
        />
      )}

      {/* 8. Edit Deposit Modal */}
      {isEditDepositOpen && editingDepositEntry && (
        <AddMoneyModal
          isOpen={isEditDepositOpen}
          onClose={() => {
            setIsEditDepositOpen(false)
            setEditingDepositEntry(null)
          }}
          bankAccountId={editingDepositEntry.accountType === 'BANK' ? editingDepositEntry.bankAccountId : undefined}
          cashBookId={editingDepositEntry.accountType === 'CASH' ? editingDepositEntry.cashBookId : undefined}
          ledgerEntry={editingDepositEntry}
          onSuccess={() => {
            fetchLedgerData()
            loadAccountsMetadata()
          }}
        />
      )}

      {/* 9. Delete Deposit Modal */}
      {isDeleteDepositOpen && deletingDepositEntry && (
        <EnterpriseModal
          isOpen={isDeleteDepositOpen}
          onClose={() => {
            setIsDeleteDepositOpen(false)
            setDeletingDepositEntry(null)
          }}
          title="Delete Deposit Transaction"
          maxWidth="sm"
        >
          <div className="flex flex-col gap-4 text-left">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this deposit of{' '}
              <span className="font-bold text-slate-900">
                {formatCurrency(deletingDepositEntry.credit || deletingDepositEntry.amount)}
              </span>{' '}
              on <span className="font-medium text-slate-800">{deletingDepositEntry.accountName}</span>?
              The account running balance will be recalculated automatically.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <EnterpriseButton
                variant="secondary"
                onClick={() => {
                  setIsDeleteDepositOpen(false)
                  setDeletingDepositEntry(null)
                }}
                disabled={submittingDeleteDeposit}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                variant="danger"
                onClick={handleDeleteDeposit}
                disabled={submittingDeleteDeposit}
                loading={submittingDeleteDeposit}
              >
                Delete
              </EnterpriseButton>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* 10. Transaction Details Modal */}
      {isDetailsOpen && selectedEntryDetails && (
        <EnterpriseModal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false)
            setSelectedEntryDetails(null)
          }}
          title="Transaction Details"
          maxWidth="md"
        >
          <div className="space-y-4 text-left">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Account</span>
                <span className="font-bold text-slate-900 text-sm flex items-center gap-2 mt-0.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    selectedEntryDetails.accountType === 'BANK'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {selectedEntryDetails.accountType}
                  </span>
                  {selectedEntryDetails.accountName}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Amount</span>
                <span className={`font-mono font-bold text-sm ${
                  selectedEntryDetails.credit > 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {selectedEntryDetails.credit > 0
                    ? `+${formatCurrency(selectedEntryDetails.credit)}`
                    : `-${formatCurrency(selectedEntryDetails.debit)}`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Transaction Type</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{selectedEntryDetails.transactionType}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Reference No</span>
                <span className="font-mono font-semibold text-slate-800 mt-0.5 block">{selectedEntryDetails.referenceNumber || '-'}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Date & Time</span>
                <span className="font-medium text-slate-800 mt-0.5 block">{formatDateTime(selectedEntryDetails.transactionDate, selectedEntryDetails.createdAt)}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Account Running Balance</span>
                <span className="font-mono font-semibold text-slate-800 mt-0.5 block">{formatCurrency(selectedEntryDetails.runningBalance)}</span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-lg border border-slate-200/80 text-xs">
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Description</span>
              <p className="font-medium text-slate-800 mt-1">{selectedEntryDetails.description || 'No description recorded.'}</p>
              {selectedEntryDetails.auditNotes && (
                <div className="mt-2 pt-2 border-t border-slate-100 text-slate-500 italic">
                  Note: {selectedEntryDetails.auditNotes}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
              <span>Recorded by: <span className="font-semibold text-slate-700">{selectedEntryDetails.createdBy || 'System'}</span></span>
              <span>Sequence: <span className="font-mono">{selectedEntryDetails.ledgerSequence}</span></span>
            </div>

            <div className="flex justify-end pt-2">
              <EnterpriseButton variant="secondary" onClick={() => setIsDetailsOpen(false)}>
                Close
              </EnterpriseButton>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* 11. Audit History Modal */}
      {isHistoryOpen && (
        <EnterpriseModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          title={`Audit History (${selectedHistoryRef})`}
          maxWidth="md"
        >
          <div className="space-y-4 text-left">
            {loadingHistory ? (
              <div className="py-12 flex justify-center">
                <EnterpriseLoading label="Loading audit history..." />
              </div>
            ) : historyItems.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No audit changes recorded for this entry.
              </div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {historyItems.map((hist) => (
                  <div
                    key={hist.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 uppercase tracking-wide text-[10px] bg-slate-200/70 px-1.5 py-0.5 rounded">
                        {hist.action}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {formatDateTime(hist.changedAt)}
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium pt-1">{hist.remarks || 'Amount or details updated'}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span>Changed by: <span className="font-semibold text-slate-700">{hist.changedBy}</span></span>
                      <span>Old: ₹{hist.oldAmount} → New: ₹{hist.newAmount}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <EnterpriseButton variant="secondary" onClick={() => setIsHistoryOpen(false)}>
                Close
              </EnterpriseButton>
            </div>
          </div>
        </EnterpriseModal>
      )}
    </div>
  )
}

export default UnifiedTransactionsPage
