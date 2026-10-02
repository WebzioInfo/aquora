import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Calculator, RefreshCw } from 'lucide-react'
import { payrollService } from '../../../services/payroll'
import type {
  MonthlySalaryDirectory,
  MonthlySalaryDetails,
  PayrollMetrics
} from '../../../services/payroll'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type { BankAccountDropdown, CashBookDropdown } from '../../../services/simpleAccounts'
import { api } from '../../../services/api'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { printSalarySlip } from '../../../utils/salaryStatementPdfEngine'

// Shared UI components
import FitScreenPage from '../../../components/ui/FitScreenPage'
import PageHeader from '../../../components/ui/PageHeader'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'

// Payroll sub-components
import { formatMonthLabel } from './payroll/payrollHelpers'
import PayrollKpiCards from './payroll/PayrollKpiCards'
import PayrollFilters, { type PayrollStatusFilter } from './payroll/PayrollFilters'
import PayrollBulkBar from './payroll/PayrollBulkBar'
import PayrollTable from './payroll/PayrollTable'
import SalarySettlementModal from './payroll/SalarySettlementModal'
import SalaryAdvanceModal from './payroll/SalaryAdvanceModal'
import BulkSettleModal from './payroll/BulkSettleModal'
import PayrollDetailDrawer from './payroll/PayrollDetailDrawer'

export const PayrollPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()
  const [searchParams, setSearchParams] = useSearchParams()

  // 1. URL State Initialization
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), [])

  const initialMonth = searchParams.get('month') ?? currentMonthStr
  const initialSearch = searchParams.get('search') ?? ''
  const initialStatus = (searchParams.get('status') as PayrollStatusFilter) ?? 'all'
  const initialDept = searchParams.get('department') ?? ''
  const initialPage = parseInt(searchParams.get('page') || '1', 10)
  const initialLimit = parseInt(
    searchParams.get('limit') || localStorage.getItem('aquora_payroll_page_size') || '10',
    10
  )

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth)
  const [searchTerm, setSearchTerm] = useState<string>(initialSearch)
  const [statusFilter, setStatusFilter] = useState<PayrollStatusFilter>(initialStatus)
  const [departmentFilter, setDepartmentFilter] = useState<string>(initialDept)
  const [pageNumber, setPageNumber] = useState<number>(initialPage)
  const [pageSize, setPageSize] = useState<number>(initialLimit)
  const [monthSortOrder, setMonthSortOrder] = useState<'asc' | 'desc' | null>(null)

  // Selection state for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Modal / Drawer states
  const [settlementModalOpen, setSettlementModalOpen] = useState(false)
  const [settleRecord, setSettleRecord] = useState<MonthlySalaryDirectory | null>(null)

  const [advanceModalOpen, setAdvanceModalOpen] = useState(false)
  const [advanceRecord, setAdvanceRecord] = useState<MonthlySalaryDirectory | null>(null)

  const [bulkSettleOpen, setBulkSettleOpen] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerRecord, setDrawerRecord] = useState<MonthlySalaryDirectory | null>(null)
  const [drawerInitialTab, setDrawerInitialTab] = useState<'payslip' | 'payments' | 'advances'>('payslip')

  // Sync state to URL Query Params
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedMonth) params.set('month', selectedMonth)
    if (searchTerm) params.set('search', searchTerm)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (departmentFilter) params.set('department', departmentFilter)
    if (pageNumber > 1) params.set('page', String(pageNumber))
    if (pageSize !== 10) params.set('limit', String(pageSize))

    setSearchParams(params, { replace: true })
  }, [selectedMonth, searchTerm, statusFilter, departmentFilter, pageNumber, pageSize, setSearchParams])

  // Clear selection on page/filter change
  useEffect(() => {
    setSelectedIds(new Set())
  }, [selectedMonth, searchTerm, statusFilter, departmentFilter, pageNumber, pageSize])

  // 2. Data Queries
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['employeesListDropdown'],
    queryFn: async () => {
      const res = await api.get('/api/v1/employees')
      return res.data.data || []
    }
  })

  const { data: bankAccounts = [] } = useQuery<BankAccountDropdown[]>({
    queryKey: ['bankAccountDropdownList'],
    queryFn: () => simpleAccountsService.getBankAccountDropdown()
  })

  const { data: cashBooks = [] } = useQuery<CashBookDropdown[]>({
    queryKey: ['cashBookDropdownList'],
    queryFn: () => simpleAccountsService.getCashBookDropdown()
  })

  // Payroll Metrics for selected month
  const { data: payrollMetrics } = useQuery<PayrollMetrics>({
    queryKey: ['payrollMetrics', selectedMonth],
    queryFn: () => payrollService.getPayrollMetrics(selectedMonth || undefined)
  })

  // Salary Records Query (fetch all or paged; we fetch with month to compute filtered KPIs accurately)
  const {
    data: pagedData,
    isLoading,
    isRefetching,
    refetch
  } = useQuery({
    queryKey: ['salaryPaymentsList', selectedMonth],
    queryFn: () =>
      payrollService.getMonthlySalaries({
        pageNumber: 1,
        pageSize: 1000, // Fetch set for client-side multi-filtering and accurate KPI math
        month: selectedMonth || undefined
      })
  })

  const allRecords = useMemo(() => pagedData?.items || [], [pagedData])

  // If initial month is empty and records exist, default to the latest available month
  useEffect(() => {
    if (!selectedMonth && allRecords.length > 0) {
      const months = Array.from(new Set(allRecords.map(r => r.salaryMonth).filter(Boolean))).sort().reverse()
      if (months.length > 0) {
        setSelectedMonth(months[0])
      }
    }
  }, [allRecords, selectedMonth])

  // Extract distinct departments
  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const r of allRecords) {
      if (r.department) set.add(r.department)
    }
    for (const e of employees) {
      if (e.department) set.add(e.department)
    }
    return Array.from(set).sort()
  }, [allRecords, employees])

  // Available distinct months for switcher
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    for (const r of allRecords) {
      if (r.salaryMonth) set.add(r.salaryMonth)
    }
    return Array.from(set).sort().reverse()
  }, [allRecords])

  // Finalized months set for switcher lock icons
  const finalizedMonths = useMemo(() => {
    const set = new Set<string>()
    for (const r of allRecords) {
      if (r.isFinalized && r.salaryMonth) {
        set.add(r.salaryMonth)
      }
    }
    return set
  }, [allRecords])

  // Filter records by search, status, department
  const filteredRecords = useMemo(() => {
    return allRecords.filter(r => {
      // Month
      if (selectedMonth && r.salaryMonth !== selectedMonth) {
        return false
      }

      // Search (salaryNo or employeeName)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim()
        const matchesNo = r.salaryNo?.toLowerCase().includes(query)
        const matchesName = r.employeeName?.toLowerCase().includes(query)
        if (!matchesNo && !matchesName) return false
      }

      // Department
      if (departmentFilter && r.department !== departmentFilter) {
        return false
      }

      // Status
      if (statusFilter !== 'all') {
        const earned = Number(r.earnedSalary ?? r.netSalaryEntitlement ?? r.baseSalary ?? 0)
        const paid = Number(r.totalPaid ?? 0)
        const bal = Number(r.remainingBalance ?? 0)
        const statusLower = (r.status || '').toLowerCase()

        const isFullyPaid =
          r.isFinalized ||
          statusLower === 'fully paid' ||
          statusLower === 'paid' ||
          (earned > 0 && bal <= 0.01)

        const isPartiallyPaid = !isFullyPaid && (statusLower === 'partially paid' || (paid > 0 && bal > 0.01))
        const isUnpaid = !isFullyPaid && !isPartiallyPaid

        if (statusFilter === 'paid' && !isFullyPaid) return false
        if (statusFilter === 'partial' && !isPartiallyPaid) return false
        if (statusFilter === 'unpaid' && !isUnpaid) return false
      }

      return true
    })
  }, [allRecords, selectedMonth, searchTerm, departmentFilter, statusFilter])

  // Clamping pagination
  const totalFilteredCount = filteredRecords.length
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize))

  useEffect(() => {
    if (pageNumber > totalPages) {
      setPageNumber(totalPages)
    }
  }, [pageNumber, totalPages])

  // Sorted records by month if month sort is active
  const sortedFilteredRecords = useMemo(() => {
    if (!monthSortOrder) return filteredRecords
    return [...filteredRecords].sort((a, b) => {
      const ma = a.salaryMonth || ''
      const mb = b.salaryMonth || ''
      if (ma === mb) return 0
      return monthSortOrder === 'asc' ? ma.localeCompare(mb) : mb.localeCompare(ma)
    })
  }, [filteredRecords, monthSortOrder])

  // Paginated records for table view
  const pagedRecords = useMemo(() => {
    const start = (pageNumber - 1) * pageSize
    return sortedFilteredRecords.slice(start, start + pageSize)
  }, [sortedFilteredRecords, pageNumber, pageSize])

  // Footer / KPI Totals for FILTERED set
  const { totalEarned, totalPaid, totalBalance } = useMemo(() => {
    let earned = 0
    let paid = 0
    let bal = 0
    for (const r of filteredRecords) {
      earned += Number(r.earnedSalary ?? r.netSalaryEntitlement ?? r.baseSalary ?? 0)
      paid += Number(r.totalPaid ?? 0)
      bal += Number(r.remainingBalance ?? 0)
    }
    return {
      totalEarned: earned,
      totalPaid: paid,
      totalBalance: bal
    }
  }, [filteredRecords])

  // Selection Handlers
  const handleToggleSelectRow = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const allCurrentSelected = pagedRecords.length > 0 && pagedRecords.every(r => prev.has(r.id))
      if (allCurrentSelected) {
        return new Set()
      } else {
        const next = new Set(prev)
        pagedRecords.forEach(r => next.add(r.id))
        return next
      }
    })
  }, [pagedRecords])

  // Row / Menu Handlers
  const handleOpenRowSettle = useCallback((record: MonthlySalaryDirectory) => {
    setSettleRecord(record)
    setSettlementModalOpen(true)
  }, [])

  const handleOpenRowAdvance = useCallback((record: MonthlySalaryDirectory) => {
    setAdvanceRecord(record)
    setAdvanceModalOpen(true)
  }, [])

  const handleOpenRowDetail = useCallback((record: MonthlySalaryDirectory, tab: 'payslip' | 'payments' | 'advances' = 'payslip') => {
    setDrawerRecord(record)
    setDrawerInitialTab(tab)
    setDrawerOpen(true)
  }, [])

  const handlePrintSinglePayslip = useCallback(async (record: MonthlySalaryDirectory) => {
    try {
      showToast('Preparing salary slip PDF...', 'info')
      const report = await payrollService.getEmployeeSalaryStatement(record.employeeId, record.salaryMonth)
      if (report) {
        printSalarySlip(report)
      } else {
        showToast('Unable to load employee salary slip data.', 'error')
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to print salary slip.', 'error')
    }
  }, [showToast])

  // Bulk Actions
  const selectedRecords = useMemo(() => {
    return filteredRecords.filter(r => selectedIds.has(r.id))
  }, [filteredRecords, selectedIds])

  const totalBalanceSelected = useMemo(() => {
    return selectedRecords.reduce((acc, r) => acc + Number(r.remainingBalance || 0), 0)
  }, [selectedRecords])

  const canSettleSelected = useMemo(() => {
    return selectedRecords.some(r => Number(r.remainingBalance || 0) > 0.01)
  }, [selectedRecords])

  const handleExportCSV = useCallback((recordsToExport: MonthlySalaryDirectory[]) => {
    if (recordsToExport.length === 0) {
      showToast('No records to export.', 'info')
      return
    }

    const headers = [
      'Salary No',
      'Employee Name',
      'Department',
      'Designation',
      'Month',
      'Base Salary',
      'Days Worked',
      'Working Days',
      'Earned Salary',
      'Total Paid',
      'Remaining Balance',
      'Status',
      'Last Payment Date'
    ]

    const rows = recordsToExport.map(r => [
      `"${r.salaryNo || ''}"`,
      `"${r.employeeName || ''}"`,
      `"${r.department || ''}"`,
      `"${r.designation || ''}"`,
      `"${r.salaryMonth || ''}"`,
      r.baseSalary || 0,
      r.daysWorked || 0,
      r.workingDays || 30,
      r.earnedSalary ?? r.netSalaryEntitlement ?? r.baseSalary ?? 0,
      r.totalPaid || 0,
      r.remainingBalance || 0,
      `"${r.status || ''}"`,
      `"${r.lastPaymentDate || ''}"`
    ])

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `payroll_${selectedMonth || 'all'}_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast(`Exported ${recordsToExport.length} payroll records to CSV.`, 'success')
  }, [selectedMonth, showToast])

  const handleBulkPrintPayslips = useCallback(async () => {
    if (selectedRecords.length === 0) return
    showToast(`Generating payslips for ${selectedRecords.length} employees...`, 'info')
    for (const r of selectedRecords) {
      try {
        const report = await payrollService.getEmployeeSalaryStatement(r.employeeId, r.salaryMonth)
        if (report) printSalarySlip(report)
      } catch {
        // Continue
      }
    }
  }, [selectedRecords, showToast])

  const handleToggleMonthSort = useCallback(() => {
    setMonthSortOrder(prev => (prev === 'desc' ? 'asc' : prev === 'asc' ? null : 'desc'))
  }, [])

  const handleBulkSettleSuccess = useCallback((failedIds: string[], skippedCount: number = 0) => {
    queryClient.invalidateQueries({ queryKey: ['salaryPaymentsList'] })
    queryClient.invalidateQueries({ queryKey: ['payrollMetrics'] })
    queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
    queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })

    const skippedMsg = skippedCount > 0 ? ` (${skippedCount} locked or paid in full skipped)` : ''
    if (failedIds.length === 0) {
      showToast(`All eligible salary settlements processed successfully.${skippedMsg}`, 'success')
      setSelectedIds(new Set())
    } else {
      showToast(`Settlement processed with ${failedIds.length} failures.${skippedMsg} Failed rows remain selected.`, 'warning')
      setSelectedIds(new Set(failedIds))
    }
  }, [queryClient, showToast])

  // Filter Clear Handler
  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    statusFilter !== 'all' ||
    departmentFilter ||
    (selectedMonth && selectedMonth !== currentMonthStr)
  )

  const handleClearFilters = useCallback(() => {
    setSearchTerm('')
    setStatusFilter('all')
    setDepartmentFilter('')
    setSelectedMonth(currentMonthStr)
    setPageNumber(1)
  }, [currentMonthStr])

  // Refresh data handler
  const handleRefresh = useCallback(() => {
    refetch()
    queryClient.invalidateQueries({ queryKey: ['payrollMetrics'] })
  }, [refetch, queryClient])

  return (
    <FitScreenPage className="space-y-2.5 text-left">
      {/* 1. Page Header (Exact title, subtitle, and buttons preserved) */}
      <PageHeader
        title="Payroll Directory & Settlement System"
        subtitle="Disburse mid-month salary advances and calculate attendance-based month-end final salary settlements."
        actions={
          <>
            <EnterpriseButton
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefetching}
              className="!h-[32px] text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-slate-500 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </EnterpriseButton>

            <EnterpriseButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setAdvanceRecord(null)
                setAdvanceModalOpen(true)
              }}
              className="!h-[32px] text-xs font-semibold"
            >
              <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-amber-500" />
              Salary Advance
            </EnterpriseButton>

            <EnterpriseButton
              variant="primary"
              size="sm"
              onClick={() => {
                setSettleRecord(null)
                setSettlementModalOpen(true)
              }}
              className="!h-[32px] text-xs font-semibold shadow-xs"
            >
              <Calculator className="w-3.5 h-3.5 mr-1" />
              Salary Settlement
            </EnterpriseButton>
          </>
        }
      />

      {/* 2. KPI Cards Row (4 cards, no breakdown cards, responsive scroll strip) */}
      <PayrollKpiCards
        records={filteredRecords}
        loading={isLoading}
        selectedMonth={selectedMonth}
        totalFilteredCount={totalFilteredCount}
        metrics={payrollMetrics}
      />

      {/* 3. Table Card */}
      <div className="bg-white border border-[#E5E9F2] rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden w-full flex-1 min-h-[260px] flex flex-col">
        {/* Top Filter Bar or Bulk Action Bar */}
        {selectedIds.size > 0 ? (
          <PayrollBulkBar
            selectedCount={selectedIds.size}
            totalBalanceSelected={totalBalanceSelected}
            canSettleSelected={canSettleSelected}
            onSettleSelected={() => setBulkSettleOpen(true)}
            onExportSelected={() => handleExportCSV(selectedRecords)}
            onPrintPayslips={handleBulkPrintPayslips}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        ) : (
          <PayrollFilters
            selectedMonth={selectedMonth}
            onMonthChange={m => {
              setSelectedMonth(m)
              setPageNumber(1)
            }}
            availableMonths={availableMonths}
            finalizedMonths={finalizedMonths}
            searchTerm={searchTerm}
            onSearchChange={s => {
              setSearchTerm(s)
              setPageNumber(1)
            }}
            statusFilter={statusFilter}
            onStatusChange={st => {
              setStatusFilter(st)
              setPageNumber(1)
            }}
            departmentFilter={departmentFilter}
            onDepartmentChange={d => {
              setDepartmentFilter(d)
              setPageNumber(1)
            }}
            departments={departments}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        )}

        {/* Scrollable Table View or Mobile Card List */}
        <PayrollTable
          records={pagedRecords}
          loading={isLoading}
          selectedIds={selectedIds}
          onToggleSelectRow={handleToggleSelectRow}
          onToggleSelectAll={handleToggleSelectAll}
          onRowClick={r => handleOpenRowDetail(r, 'payslip')}
          onOpenAdvance={handleOpenRowAdvance}
          onOpenSettle={handleOpenRowSettle}
          onOpenHistory={r => handleOpenRowDetail(r, 'payments')}
          onOpenPayslip={r => handleOpenRowDetail(r, 'payslip')}
          onPrintPayslip={handlePrintSinglePayslip}
          pageNumber={pageNumber}
          pageSize={pageSize}
          totalCount={totalFilteredCount}
          onPageChange={setPageNumber}
          onPageSizeChange={newSize => {
            setPageSize(newSize)
            localStorage.setItem('aquora_payroll_page_size', String(newSize))
            setPageNumber(1)
          }}
          totalEarnedFiltered={totalEarned}
          totalPaidFiltered={totalPaid}
          totalBalanceFiltered={totalBalance}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          onOpenCreateAdvance={() => {
            setAdvanceRecord(null)
            setAdvanceModalOpen(true)
          }}
          onOpenCreateSettlement={() => {
            setSettleRecord(null)
            setSettlementModalOpen(true)
          }}
          selectedMonthLabel={formatMonthLabel(selectedMonth)}
          monthSortOrder={monthSortOrder}
          onToggleMonthSort={handleToggleMonthSort}
        />
      </div>

      {/* 4. Salary Settlement Modal */}
      {settlementModalOpen && (
        <SalarySettlementModal
          isOpen={settlementModalOpen}
          onClose={() => {
            setSettlementModalOpen(false)
            setSettleRecord(null)
          }}
          prefilledRecord={settleRecord}
          employees={employees}
          bankAccounts={bankAccounts}
          cashBooks={cashBooks}
          defaultMonth={selectedMonth}
          onViewPayslip={r => handleOpenRowDetail(r, 'payslip')}
          onPaymentSuccess={() => {
            showToast('Salary settlement recorded successfully.', 'success')
            queryClient.invalidateQueries({ queryKey: ['salaryPaymentsList'] })
            queryClient.invalidateQueries({ queryKey: ['payrollMetrics'] })
            queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
            queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
          }}
        />
      )}

      {/* 5. Salary Advance Modal */}
      {advanceModalOpen && (
        <SalaryAdvanceModal
          isOpen={advanceModalOpen}
          onClose={() => {
            setAdvanceModalOpen(false)
            setAdvanceRecord(null)
          }}
          prefilledRecord={advanceRecord}
          employees={employees}
          bankAccounts={bankAccounts}
          cashBooks={cashBooks}
          defaultMonth={selectedMonth}
          onViewPayslip={r => handleOpenRowDetail(r, 'payslip')}
          onPaymentSuccess={() => {
            showToast('Salary advance disbursed successfully.', 'success')
            queryClient.invalidateQueries({ queryKey: ['salaryPaymentsList'] })
            queryClient.invalidateQueries({ queryKey: ['payrollMetrics'] })
            queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
            queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
          }}
        />
      )}

      {/* 6. Bulk Settlement Modal */}
      {bulkSettleOpen && (
        <BulkSettleModal
          isOpen={bulkSettleOpen}
          onClose={() => setBulkSettleOpen(false)}
          records={selectedRecords}
          bankAccounts={bankAccounts}
          cashBooks={cashBooks}
          onSuccess={handleBulkSettleSuccess}
        />
      )}

      {/* 7. Employee Detail Drawer */}
      {drawerOpen && drawerRecord && (
        <PayrollDetailDrawer
          isOpen={drawerOpen}
          onClose={() => {
            setDrawerOpen(false)
            setDrawerRecord(null)
          }}
          record={drawerRecord}
          allRecords={filteredRecords}
          onSelectRecord={r => setDrawerRecord(r)}
          initialTab={drawerInitialTab}
          onOpenSettle={r => {
            setDrawerOpen(false)
            handleOpenRowSettle(r)
          }}
          onOpenAdvance={r => {
            setDrawerOpen(false)
            handleOpenRowAdvance(r)
          }}
          onPrintPayslip={handlePrintSinglePayslip}
        />
      )}
    </FitScreenPage>
  )
}

export default PayrollPage
