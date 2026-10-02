import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type {
  SimpleExpense,
  CreateSimpleExpenseRequest,
  UpdateSimpleExpenseRequest,
  BankAccountDropdown,
  CashBookDropdown
} from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useAuthStore } from '../../../store/useAuthStore'
import { PrintPreviewModal } from '../../../components/ui/PrintPreviewModal'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import { Plus, Download, AlertCircle, RefreshCw } from 'lucide-react'

// Modular subcomponents
import { ExpenseKpiCards } from './expenses/ExpenseKpiCards'
import { CategoryBar } from './expenses/CategoryBar'
import { ExpenseFilters, getDateRangeForPreset } from './expenses/ExpenseFilters'
import type { ExpenseFilterValues } from './expenses/ExpenseFilters'
import { BulkActionBar } from './expenses/BulkActionBar'
import { ExpensesTable } from './expenses/ExpensesTable'
import { ExpenseDetailDrawer } from './expenses/ExpenseDetailDrawer'
import { ExpenseDeleteModal } from './expenses/ExpenseDeleteModal'
import { ExpenseFormModal, EXPENSE_CATEGORIES } from './expenses/ExpenseFormModal'
import FitScreenPage from '../../../components/ui/FitScreenPage'
import PageHeader from '../../../components/ui/PageHeader'

export const ExpenseManagementPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()

  const isOwner =
    (user?.roles?.some(r =>
      ['owner', 'companyowner', 'platformowner'].includes(r.toLowerCase())
    ) || user?.roleName?.toLowerCase() === 'owner') ??
    false
  const canWrite =
    !isOwner &&
    (user?.roles?.some(r =>
      ['CompanyAdmin', 'Admin', 'Manager', 'Accountant'].includes(r)
    ) ??
      false)

  // URL Query Parameters synchronization
  const [searchParams, setSearchParams] = useSearchParams()

  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const limitParam = parseInt(
    searchParams.get('limit') || localStorage.getItem('aquora_expenses_page_size') || '25',
    10
  )
  const [pageSize, setPageSize] = useState<number>(() => {
    const validSizes = [10, 25, 50, 100]
    return validSizes.includes(limitParam) ? limitParam : 25
  })
  const searchParam = searchParams.get('search') || ''
  const methodParam = searchParams.get('method') || ''
  const categoryParam = searchParams.get('category') || ''
  const presetParam = (searchParams.get('preset') as any) || 'all'
  const fromParam = searchParams.get('from') || ''
  const toParam = searchParams.get('to') || ''

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSize(newSize)
      localStorage.setItem('aquora_expenses_page_size', newSize.toString())
      const params = new URLSearchParams(searchParams)
      params.set('limit', newSize.toString())
      params.set('page', '1')
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  // Active filter state
  const filters: ExpenseFilterValues = useMemo(
    () => ({
      search: searchParam,
      method: methodParam,
      category: categoryParam,
      datePreset: presetParam,
      startDate: fromParam || undefined,
      endDate: toParam || undefined
    }),
    [searchParam, methodParam, categoryParam, presetParam, fromParam, toParam]
  )

  const hasActiveFilters = !!(
    filters.search ||
    filters.method ||
    filters.category ||
    filters.datePreset !== 'all' ||
    filters.startDate ||
    filters.endDate
  )

  const updateFilters = useCallback(
    (newFilters: Partial<ExpenseFilterValues>) => {
      const next = { ...filters, ...newFilters }
      const params = new URLSearchParams()

      if (next.search) params.set('search', next.search)
      if (next.method) params.set('method', next.method)
      if (next.category) params.set('category', next.category)
      if (next.datePreset && next.datePreset !== 'all') params.set('preset', next.datePreset)
      if (next.startDate) params.set('from', next.startDate)
      if (next.endDate) params.set('to', next.endDate)

      // Always reset to page 1 on filter changes unless page is explicitly kept
      params.set('page', '1')

      setSearchParams(params, { replace: true })
    },
    [filters, setSearchParams]
  )

  const handleClearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams({ page: '1' }), { replace: true })
  }, [setSearchParams])

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams)
      params.set('page', newPage.toString())
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  // Clear selection on filter / page change
  useEffect(() => {
    setSelectedIds(new Set())
    setLastSelectedId(null)
  }, [searchParam, methodParam, categoryParam, presetParam, fromParam, toParam, pageParam])

  // Modals & Drawer State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<SimpleExpense | null>(null)
  const [detailExpense, setDetailExpense] = useState<SimpleExpense | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [itemsToDelete, setItemsToDelete] = useState<SimpleExpense[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number } | null>(
    null
  )

  // Print modal state
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printDocData, setPrintDocData] = useState<any>(null)

  // Queries
  const { data: bankAccounts } = useQuery<BankAccountDropdown[]>({
    queryKey: ['bankAccountDropdownList'],
    queryFn: () => simpleAccountsService.getBankAccountDropdown()
  })

  const { data: cashBooks } = useQuery<CashBookDropdown[]>({
    queryKey: ['cashBookDropdownList'],
    queryFn: () => simpleAccountsService.getCashBookDropdown()
  })

  // Date range for API
  const apiDates = useMemo(() => {
    if (filters.datePreset === 'custom') {
      return {
        startDate: filters.startDate ? new Date(filters.startDate).toISOString() : undefined,
        endDate: filters.endDate ? new Date(filters.endDate).toISOString() : undefined
      }
    }
    const dates = getDateRangeForPreset(filters.datePreset)
    return {
      startDate: dates.startDate ? new Date(dates.startDate).toISOString() : undefined,
      endDate: dates.endDate ? new Date(dates.endDate).toISOString() : undefined
    }
  }, [filters.datePreset, filters.startDate, filters.endDate])

  // Query expenses
  const {
    data: expensesData,
    isLoading: isExpensesLoading,
    isError: isExpensesError,
    refetch: refetchExpenses
  } = useQuery({
    queryKey: [
      'expensesList',
      pageParam,
      pageSize,
      filters.search,
      filters.category,
      filters.method,
      apiDates.startDate,
      apiDates.endDate
    ],
    queryFn: () =>
      simpleAccountsService.getExpenses({
        pageNumber: pageParam,
        pageSize,
        search: filters.search || undefined,
        category: filters.category || undefined,
        paymentMethod: filters.method || undefined,
        startDate: apiDates.startDate,
        endDate: apiDates.endDate
      }),
    placeholderData: (prev) => prev
  })

  const expenses = useMemo(() => expensesData?.items || [], [expensesData])
  const totalCount = expensesData?.totalCount || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // Clamp page if out of bounds (e.g. after row deletion or filter change)
  useEffect(() => {
    if (totalCount > 0 && pageParam > totalPages) {
      handlePageChange(totalPages)
    }
  }, [totalCount, pageParam, totalPages, handlePageChange])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (req: CreateSimpleExpenseRequest) => simpleAccountsService.createExpense(req),
    onSuccess: () => {
      showToast('Expense created successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['expensesList'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
      setIsFormModalOpen(false)
      setEditingExpense(null)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateSimpleExpenseRequest }) =>
      simpleAccountsService.updateExpense(id, req),
    onSuccess: () => {
      showToast('Expense updated successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['expensesList'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
      setIsFormModalOpen(false)
      setEditingExpense(null)
      if (detailExpense) {
        setIsDetailOpen(false)
        setDetailExpense(null)
      }
    }
  })

  // Checkbox toggle & Shift-click range selection
  const handleToggleSelect = useCallback(
    (e: React.SyntheticEvent, id: string) => {
      e.stopPropagation()
      const isShift = (e as React.MouseEvent).shiftKey

      setSelectedIds(prev => {
        const next = new Set(prev)
        if (isShift && lastSelectedId && lastSelectedId !== id) {
          const idxA = expenses.findIndex(x => x.id === lastSelectedId)
          const idxB = expenses.findIndex(x => x.id === id)
          if (idxA !== -1 && idxB !== -1) {
            const start = Math.min(idxA, idxB)
            const end = Math.max(idxA, idxB)
            for (let i = start; i <= end; i++) {
              next.add(expenses[i].id)
            }
            return next
          }
        }

        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
      setLastSelectedId(id)
    },
    [expenses, lastSelectedId]
  )

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (expenses.length > 0 && expenses.every(e => prev.has(e.id))) {
        return new Set()
      }
      return new Set(expenses.map(e => e.id))
    })
  }, [expenses])

  // Selected items helper
  const selectedExpenses = useMemo(() => {
    return expenses.filter(e => selectedIds.has(e.id))
  }, [expenses, selectedIds])

  const totalSelectedAmount = useMemo(() => {
    return selectedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  }, [selectedExpenses])

  // CSV Export
  const handleExportCSV = useCallback(
    (itemsToExport: SimpleExpense[]) => {
      const items = itemsToExport.length > 0 ? itemsToExport : expenses
      if (items.length === 0) {
        showToast('No expenses available to export.', 'info')
        return
      }

      const headers = [
        'Expense Number',
        'Date',
        'Category',
        'Description',
        'Vendor',
        'Amount',
        'Payment Method',
        'Paid From',
        'Created By',
        'Created Date',
        'Notes'
      ]

      const rows = items.map(e => [
        `"${(e.expenseNumber || '').replace(/"/g, '""')}"`,
        `"${(e.expenseDate ? new Date(e.expenseDate).toLocaleDateString('en-IN') : '').replace(/"/g, '""')}"`,
        `"${(e.category || '').replace(/"/g, '""')}"`,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        `"${(e.vendor || '').replace(/"/g, '""')}"`,
        e.amount || 0,
        `"${(e.paymentMethod || '').replace(/"/g, '""')}"`,
        `"${(e.paidFrom || e.bankAccountName || e.cashBookName || '').replace(/"/g, '""')}"`,
        `"${(e.createdByName || e.createdBy || '').replace(/"/g, '""')}"`,
        `"${(e.createdDate ? new Date(e.createdDate).toLocaleString('en-IN') : '').replace(/"/g, '""')}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ])

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `expenses_export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      showToast(`Exported ${items.length} expenses to CSV.`, 'success')
    },
    [expenses, showToast]
  )

  // Print single or multiple vouchers
  const handlePrintExpenses = useCallback(
    (items: SimpleExpense[]) => {
      if (items.length === 0) return

      if (items.length === 1) {
        const exp = items[0]
        setPrintDocData({
          title: 'Expense Voucher',
          docNumber: exp.expenseNumber || 'EXP-VOUCHER',
          date: new Date(exp.expenseDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }),
          partyLabel: 'Paid To / Vendor',
          partyInfo: {
            name: exp.vendor || 'General Vendor',
            details1: 'Category: ' + exp.category
          },
          preparedBy: exp.createdByName || exp.createdBy || 'Authorized Person',
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
        })
      } else {
        // Multi-item consolidated voucher
        const totalAmount = items.reduce((sum, e) => sum + (e.amount || 0), 0)
        setPrintDocData({
          title: 'Consolidated Expense Voucher',
          docNumber: `EXP-BATCH-${Date.now().toString().slice(-6)}`,
          date: new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }),
          partyLabel: 'Consolidated Summary',
          partyInfo: {
            name: `${items.length} Expense Records`,
            details1: `Categories: ${Array.from(new Set(items.map(e => e.category))).join(', ')}`
          },
          preparedBy:
            user?.fullName ||
            (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Authorized Person'),
          paymentDetails: {
            method: 'Multiple Sources',
            reference: `Batch of ${items.length} items`
          },
          items: items.map((exp, idx) => ({
            sno: idx + 1,
            description: `${exp.expenseNumber || ''} - ${exp.description} (${exp.category})`,
            quantity: 1,
            unitPrice: exp.amount,
            amount: exp.amount
          })),
          financialSummary: {
            subTotal: totalAmount,
            grandTotal: totalAmount,
            amountPaid: totalAmount,
            balance: 0
          },
          notes: `Consolidated voucher for ${items.length} selected expenses.`
        })
      }
      setPrintModalOpen(true)
    },
    [user]
  )

  // Delete Handlers
  const handleOpenSingleDelete = useCallback((exp: SimpleExpense) => {
    setItemsToDelete([exp])
    setIsDeleteModalOpen(true)
  }, [])

  const handleOpenBulkDelete = useCallback(() => {
    if (selectedExpenses.length === 0) return
    setItemsToDelete(selectedExpenses)
    setIsDeleteModalOpen(true)
  }, [selectedExpenses])

  const handleConfirmDelete = async () => {
    if (itemsToDelete.length === 0) return

    setIsDeleting(true)
    let successCount = 0
    let failCount = 0
    const failedIds = new Set<string>()

    setDeleteProgress({ current: 0, total: itemsToDelete.length })

    for (let i = 0; i < itemsToDelete.length; i++) {
      const item = itemsToDelete[i]
      try {
        await simpleAccountsService.deleteExpense(item.id)
        successCount++
      } catch (err) {
        failCount++
        failedIds.add(item.id)
      }
      setDeleteProgress({ current: i + 1, total: itemsToDelete.length })
    }

    setIsDeleting(false)
    setIsDeleteModalOpen(false)
    setDeleteProgress(null)
    setItemsToDelete([])

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['expensesList'] })
    queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
    queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
    queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })

    if (failCount === 0) {
      showToast(
        itemsToDelete.length === 1
          ? 'Expense deleted. Bank/cash balances restored.'
          : `Successfully deleted ${successCount} expenses. Bank/cash balances restored.`,
        'success'
      )
      setSelectedIds(new Set())
    } else {
      showToast(
        `Deleted ${successCount} expenses. Failed to delete ${failCount} items.`,
        'warning'
      )
      setSelectedIds(failedIds)
    }
  }

  // Row Click -> Open Drawer
  const handleRowClick = useCallback((exp: SimpleExpense) => {
    setDetailExpense(exp)
    setIsDetailOpen(true)
  }, [])

  // Edit Expense
  const handleOpenEdit = useCallback((exp: SimpleExpense) => {
    setEditingExpense(exp)
    setIsFormModalOpen(true)
  }, [])

  // Create Expense
  const handleOpenCreate = useCallback(() => {
    setEditingExpense(null)
    setIsFormModalOpen(true)
  }, [])

  const handleFormSubmit = async (formData: {
    expenseDate: string
    category: string
    vendor?: string
    description: string
    amount: number
    paymentMethod: string
    bankAccountId?: string
    cashBookId?: string
    notes?: string
  }) => {
    if (editingExpense) {
      await updateMutation.mutateAsync({
        id: editingExpense.id,
        req: formData
      })
    } else {
      await createMutation.mutateAsync(formData as CreateSimpleExpenseRequest)
    }
  }

  return (
    <FitScreenPage className="space-y-2.5 text-left">
      {/* 1. Page Header (Fixed) */}
      <PageHeader
        title="Expenses"
        subtitle="Track spending and bank or cash deductions in one place"
        actions={
          <>
            <EnterpriseButton
              variant="secondary"
              size="sm"
              onClick={() => handleExportCSV(expenses)}
              className="!h-[32px] text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Export
            </EnterpriseButton>

            {canWrite && (
              <EnterpriseButton
                variant="primary"
                size="sm"
                onClick={handleOpenCreate}
                className="!h-[32px] text-xs font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add expense
              </EnterpriseButton>
            )}
          </>
        }
      />

      {/* Error Banner */}
      {isExpensesError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-rose-800 font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Failed to load expenses data from server.</span>
          </div>
          <EnterpriseButton
            variant="secondary"
            size="sm"
            onClick={() => refetchExpenses()}
            className="!h-[28px] !py-0 text-xs text-rose-700 border-rose-200 hover:bg-rose-100"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </EnterpriseButton>
        </div>
      )}

      {/* 2. KPI Row: 4 Cards (Shrink-0) */}
      <ExpenseKpiCards
        expenses={expenses}
        loading={isExpensesLoading}
        totalCount={totalCount}
      />

      {/* 3. Spend by Category Card (Shrink-0) */}
      <CategoryBar
        expenses={expenses}
        selectedCategory={filters.category}
        onSelectCategory={cat => updateFilters({ category: cat })}
        loading={isExpensesLoading}
      />

      {/* 4. Table Card (Flex:1, min-h-[260px], overflow-hidden) */}
      <div className="bg-white border border-[#E5E9F2] rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden w-full flex-1 min-h-[260px] flex flex-col">
        {/* Top of Card: Bulk Action Bar when 1+ selected, otherwise Filter Bar */}
        {selectedIds.size > 0 ? (
          <BulkActionBar
            selectedCount={selectedIds.size}
            totalSelectedAmount={totalSelectedAmount}
            onExport={() => handleExportCSV(selectedExpenses)}
            onPrint={() => handlePrintExpenses(selectedExpenses)}
            onDelete={handleOpenBulkDelete}
            onClear={() => setSelectedIds(new Set())}
            canWrite={canWrite}
          />
        ) : (
          <ExpenseFilters
            categories={EXPENSE_CATEGORIES}
            filters={filters}
            onChange={updateFilters}
            onClear={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        )}

        {/* Table & Pagination */}
        <ExpensesTable
          expenses={expenses}
          loading={isExpensesLoading}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onRowClick={handleRowClick}
          onEdit={handleOpenEdit}
          onPrint={exp => handlePrintExpenses([exp])}
          onDelete={handleOpenSingleDelete}
          canWrite={canWrite}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          onAddExpense={handleOpenCreate}
          pageNumber={pageParam}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* 5. Row Detail Drawer (Right slide-over) */}
      <ExpenseDetailDrawer
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        expense={detailExpense}
        expensesList={expenses}
        onSelectExpense={exp => setDetailExpense(exp)}
        onEdit={exp => handleOpenEdit(exp)}
        onPrint={exp => handlePrintExpenses([exp])}
        onDelete={exp => handleOpenSingleDelete(exp)}
        canWrite={canWrite}
      />

      {/* 6. Create / Edit Expense Modal */}
      {isFormModalOpen && (
        <ExpenseFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false)
            setEditingExpense(null)
          }}
          onSubmit={handleFormSubmit}
          initialData={editingExpense}
          bankAccounts={bankAccounts}
          cashBooks={cashBooks}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* 7. Delete Confirmation Modal (Single & Bulk) */}
      {isDeleteModalOpen && (
        <ExpenseDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false)
              setItemsToDelete([])
            }
          }}
          onConfirm={handleConfirmDelete}
          isSubmitting={isDeleting}
          itemsToDelete={itemsToDelete}
          progress={deleteProgress}
        />
      )}

      {/* 8. Print Preview Modal */}
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
    </FitScreenPage>
  )
}

export default ExpenseManagementPage
