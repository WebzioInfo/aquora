import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  RefreshCw,
  Plus,
  FileSpreadsheet
} from 'lucide-react'
import PageHeader from '../../../components/ui/PageHeader'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import { PrintPreviewModal } from '../../../components/ui/PrintPreviewModal'
import { purchaseService, type Purchase, type PurchaseSummaryStats } from '../../../services/purchases'
import { vendorService, type VendorDropdownItem } from '../../../services/vendors'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useAuthStore } from '../../../store/useAuthStore'

// Subcomponents
import { PurchaseKpiCards } from './purchases/PurchaseKpiCards'
import { SpendBreakdownCards } from './purchases/SpendBreakdownCards'
import { PurchaseFilters, type PurchaseFilterValues, getDateRangeForPreset } from './purchases/PurchaseFilters'
import { PurchaseBulkBar } from './purchases/PurchaseBulkBar'
import { PurchasesTable } from './purchases/PurchasesTable'
import { PurchaseDetailDrawer } from './purchases/PurchaseDetailDrawer'
import { RecordPaymentModal } from './purchases/RecordPaymentModal'
import { PurchaseCancelDialog, PurchaseDeleteDialog } from './purchases/PurchaseConfirmDialogs'
import FitScreenPage from '../../../components/ui/FitScreenPage'

export const PurchasesPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()

  // Permissions matching original
  const isOwner = (user?.roles?.some(r => ['owner', 'companyowner', 'platformowner'].includes(r.toLowerCase())) || user?.roleName?.toLowerCase() === 'owner') ?? false
  const canWrite = !isOwner && (user?.roles?.some(r => ['CompanyAdmin', 'Admin', 'Manager', 'Accountant'].includes(r)) ?? false)

  // Data states
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [summaryStats, setSummaryStats] = useState<PurchaseSummaryStats | null>(null)
  const [vendors, setVendors] = useState<VendorDropdownItem[]>([])

  // Pagination State
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const [pageNumber, setPageNumber] = useState<number>(isNaN(pageParam) || pageParam < 1 ? 1 : pageParam)

  const limitParam = parseInt(
    searchParams.get('limit') || localStorage.getItem('aquora_purchases_page_size') || '25',
    10
  )
  const [pageSize, setPageSize] = useState<number>(() => {
    const validSizes = [10, 25, 50, 100]
    return validSizes.includes(limitParam) ? limitParam : 25
  })
  const [totalCount, setTotalCount] = useState<number>(0)

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSize(newSize)
      localStorage.setItem('aquora_purchases_page_size', newSize.toString())
      setPageNumber(1)
      const params = new URLSearchParams(searchParams)
      params.set('limit', newSize.toString())
      params.set('page', '1')
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPageNumber(newPage)
      const params = new URLSearchParams(searchParams)
      params.set('page', newPage.toString())
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  // Filters State initialized from URL query params
  const [filters, setFilters] = useState<PurchaseFilterValues>(() => {
    const preset = (searchParams.get('preset') || 'all') as any
    const validPresets = ['all', 'today', 'thisWeek', 'thisMonth', 'lastMonth', 'custom']
    const datePreset = validPresets.includes(preset) ? preset : 'all'

    return {
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || '',
      vendorId: searchParams.get('vendor') || '',
      category: searchParams.get('category') || '',
      paymentMethod: searchParams.get('method') || '',
      datePreset,
      startDate: searchParams.get('from') || undefined,
      endDate: searchParams.get('to') || undefined
    }
  })

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filters.search)
    }, 300)
    return () => clearTimeout(handler)
  }, [filters.search])

  // Sync filters to URL query params
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.status) params.set('status', filters.status)
    if (filters.vendorId) params.set('vendor', filters.vendorId)
    if (filters.category) params.set('category', filters.category)
    if (filters.paymentMethod) params.set('method', filters.paymentMethod)
    if (filters.datePreset !== 'all') params.set('preset', filters.datePreset)
    if (filters.startDate) params.set('from', filters.startDate)
    if (filters.endDate) params.set('to', filters.endDate)
    if (pageNumber > 1) params.set('page', pageNumber.toString())
    if (pageSize !== 25) params.set('limit', pageSize.toString())

    setSearchParams(params, { replace: true })
  }, [filters, pageNumber, pageSize, setSearchParams])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // Clamp page if out of bounds (e.g. after deletion or filter changes)
  useEffect(() => {
    if (totalCount > 0 && pageNumber > totalPages) {
      handlePageChange(totalPages)
    }
  }, [totalCount, pageNumber, totalPages, handlePageChange])

  // Selection states (for bulk actions)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  // Drawer & Modals state
  const [activeDrawerPurchase, setActiveDrawerPurchase] = useState<Purchase | null>(null)

  // Payment Modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentTargetPurchase, setPaymentTargetPurchase] = useState<Purchase | null>(null)
  const [paymentBulkPurchases, setPaymentBulkPurchases] = useState<Purchase[]>([])

  // Cancel & Delete Dialog states
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelTargetPurchases, setCancelTargetPurchases] = useState<Purchase[]>([])
  const [cancelLoading, setCancelLoading] = useState(false)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTargetPurchases, setDeleteTargetPurchases] = useState<Purchase[]>([])
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Print Preview Modal states
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printDocData, setPrintDocData] = useState<any>(null)

  const [dbCategories, setDbCategories] = useState<string[]>([])

  useEffect(() => {
    purchaseService.getPurchaseCategories().then(cats => {
      if (Array.isArray(cats) && cats.length > 0) {
        setDbCategories(cats.map(c => c.code))
      }
    }).catch(() => {})
  }, [])

  const categories = useMemo(() => {
    if (dbCategories.length > 0) return dbCategories
    return [
      'RawMaterial',
      'Machine',
      'OfficeAsset',
      'OfficeExpense',
      'Service',
      'Maintenance',
      'Utility',
      'Vehicle',
      'Software',
      'Other'
    ]
  }, [dbCategories])

  // Load vendors list
  useEffect(() => {
    vendorService.getVendorDropdown().then(setVendors).catch(() => {})
  }, [])

  // Fetch purchases data
  const fetchPurchases = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let sDate: string | undefined = undefined
      let eDate: string | undefined = undefined

      if (filters.datePreset === 'custom') {
        if (filters.startDate) sDate = new Date(filters.startDate).toISOString()
        if (filters.endDate) eDate = new Date(filters.endDate).toISOString()
      } else if (filters.datePreset !== 'all') {
        const range = getDateRangeForPreset(filters.datePreset)
        if (range.startDate) sDate = new Date(range.startDate).toISOString()
        if (range.endDate) eDate = new Date(range.endDate).toISOString()
      }

      const response = await purchaseService.getPurchases({
        pageNumber,
        pageSize,
        search: debouncedSearch,
        startDate: sDate,
        endDate: eDate,
        vendorId: filters.vendorId || undefined,
        category: filters.category || undefined,
        paymentStatus: filters.status || undefined
      })

      const items = response.items || []
      // Client-side filter for paymentMethod if backend doesn't support query param directly
      const filteredByMethod = filters.paymentMethod
        ? items.filter(p => (p.paymentMethod || '').toLowerCase() === filters.paymentMethod.toLowerCase())
        : items

      setPurchases(filteredByMethod)
      setTotalCount(response.totalCount || 0)
      if (response.summaryStats) {
        setSummaryStats(response.summaryStats)
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch purchases'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [pageNumber, pageSize, debouncedSearch, filters, showToast])

  // Clear selection on filter or page change
  useEffect(() => {
    setSelectedIds(new Set())
    setLastSelectedIndex(null)
  }, [pageNumber, debouncedSearch, filters])

  // Fetch when filters or page change
  useEffect(() => {
    fetchPurchases()
  }, [fetchPurchases])

  // Filter change handlers
  const handleFilterChange = (newFilters: Partial<PurchaseFilterValues>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPageNumber(1)
  }

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: '',
      vendorId: '',
      category: '',
      paymentMethod: '',
      datePreset: 'all',
      startDate: undefined,
      endDate: undefined
    })
    setPageNumber(1)
  }

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.status ||
    filters.vendorId ||
    filters.category ||
    filters.paymentMethod ||
    filters.datePreset !== 'all'
  )

  // Selection toggle handlers with shift-click range support
  const handleToggleSelect = (id: string, index: number, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)
        for (let i = start; i <= end; i++) {
          if (purchases[i]) next.add(purchases[i].id)
        }
      } else {
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
      }
      return next
    })
    setLastSelectedIndex(index)
  }

  const handleToggleSelectAll = () => {
    const isAllSelected = purchases.length > 0 && purchases.every(p => selectedIds.has(p.id))
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(purchases.map(p => p.id)))
    }
  }

  // Selected purchases objects
  const selectedPurchasesList = useMemo(() => {
    return purchases.filter(p => selectedIds.has(p.id))
  }, [purchases, selectedIds])

  // Print purchase voucher/invoice
  const handlePrintPurchase = (p: Purchase) => {
    setPrintDocData({
      title: 'Purchase Invoice',
      docNumber: p.purchaseNo,
      date: new Date(p.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      partyLabel: 'Vendor',
      partyInfo: {
        name: p.vendorName || 'General Vendor',
        details1: '—',
        details2: '—'
      },
      preparedBy: p.createdByName || 'System',
      paymentDetails: {
        method: p.paymentMethod || 'N/A',
        reference: '—'
      },
      items: p.items?.map((item, index) => ({
        sno: index + 1,
        description: item.rawMaterialName || item.itemName || 'Raw Material Item',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.totalAmount
      })) || [
        {
          sno: 1,
          description: `Purchase record: ${p.purchaseCategory || ''}`,
          quantity: 1,
          unitPrice: p.grandTotal,
          amount: p.grandTotal
        }
      ],
      financialSummary: {
        subTotal: p.subTotal || p.grandTotal,
        taxAmount: p.taxAmount || 0,
        discountAmount: p.discountAmount || 0,
        grandTotal: p.grandTotal,
        amountPaid: p.amountPaid || 0,
        balance: p.balanceAmount || 0
      },
      notes: p.notes || 'No remarks provided.'
    })
    setPrintModalOpen(true)
  }

  // Bulk Print
  const handleBulkPrint = () => {
    if (selectedPurchasesList.length === 0) return
    if (selectedPurchasesList.length === 1) {
      handlePrintPurchase(selectedPurchasesList[0])
      return
    }

    // Concatenate all selected purchases into a combined multi-voucher print
    const combinedItems = selectedPurchasesList.flatMap((p, pIdx) =>
      (p.items || [{
        itemName: `Purchase #${p.purchaseNo} - ${p.purchaseCategory}`,
        quantity: 1,
        unit: 'item',
        unitPrice: p.grandTotal,
        totalAmount: p.grandTotal
      }]).map((it, idx) => ({
        sno: `${pIdx + 1}.${idx + 1}`,
        description: `[${p.purchaseNo}] ${it.itemName || it.rawMaterialName}`,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        amount: it.totalAmount
      }))
    )

    let totalGross = 0
    let totalPaid = 0
    let totalBalance = 0
    for (const p of selectedPurchasesList) {
      totalGross += p.grandTotal
      totalPaid += p.amountPaid
      totalBalance += p.balanceAmount
    }

    setPrintDocData({
      title: 'Batch Procurement Register Voucher',
      docNumber: `BATCH-${new Date().toISOString().slice(0, 10)}`,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      partyLabel: 'Procurement Summary',
      partyInfo: {
        name: `${selectedPurchasesList.length} Selected Purchases`,
        details1: '—',
        details2: '—'
      },
      preparedBy: user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Authorized Officer',
      paymentDetails: {
        method: 'Multiple',
        reference: 'Batch Export'
      },
      items: combinedItems,
      financialSummary: {
        subTotal: totalGross,
        taxAmount: 0,
        discountAmount: 0,
        grandTotal: totalGross,
        amountPaid: totalPaid,
        balance: totalBalance
      },
      notes: `Batch print for ${selectedPurchasesList.length} procurement orders.`
    })
    setPrintModalOpen(true)
  }

  // Duplicate purchase
  const handleDuplicate = async (id: string) => {
    try {
      const draft = await purchaseService.duplicatePurchase(id)
      if (draft) {
        showToast('Duplicate purchase draft generated!', 'success')
        navigate('/company/accounts/purchases/new', { state: { draftData: draft } })
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to duplicate purchase', 'error')
    }
  }

  // CSV Export for all purchases on page or selected
  const exportCSV = (listToExport = purchases, filenamePrefix = 'purchases_register') => {
    if (listToExport.length === 0) {
      showToast('No records available to export', 'info')
      return
    }
    const headers = [
      'Purchase No',
      'Date',
      'Vendor',
      'Vendor Code',
      'Category',
      'Invoice No',
      'Tax Type',
      'Payment Method',
      'Gross Total',
      'Paid Amount',
      'Balance',
      'Status',
      'Created By'
    ]
    const rows = listToExport.map((p) => [
      p.purchaseNo,
      new Date(p.purchaseDate).toLocaleDateString('en-IN'),
      `"${p.vendorName || ''}"`,
      p.vendorCode || '-',
      p.purchaseCategory || '',
      p.invoiceNumber || '-',
      p.taxAmount > 0 ? 'GST' : 'Non-GST',
      p.paymentMethod || '',
      p.grandTotal || 0,
      p.amountPaid || 0,
      p.balanceAmount || 0,
      p.paymentStatus || '',
      `"${p.createdByName || 'Company Administrator'}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Single & Bulk Cancel handlers
  const handleOpenCancelDialog = (p: Purchase) => {
    setCancelTargetPurchases([p])
    setCancelModalOpen(true)
  }

  const handleOpenBulkCancelDialog = () => {
    const nonCancelled = selectedPurchasesList.filter(p => !p.isCancelled && p.paymentStatus !== 'Cancelled')
    if (nonCancelled.length === 0) {
      showToast('Selected purchases are already cancelled', 'info')
      return
    }
    setCancelTargetPurchases(nonCancelled)
    setCancelModalOpen(true)
  }

  const handleConfirmCancel = async () => {
    setCancelLoading(true)
    let successCount = 0
    let failureCount = 0
    const successfulIds: string[] = []

    for (const p of cancelTargetPurchases) {
      try {
        await purchaseService.cancelPurchase(p.id)
        successCount++
        successfulIds.push(p.id)
      } catch (err: any) {
        failureCount++
        console.error(`Failed to cancel purchase ${p.purchaseNo}`, err)
      }
    }

    setCancelLoading(false)
    setCancelModalOpen(false)

    // Remove successful IDs from selection
    setSelectedIds(prev => {
      const next = new Set(prev)
      successfulIds.forEach(id => next.delete(id))
      return next
    })

    if (failureCount > 0) {
      showToast(`Cancelled ${successCount} purchases, ${failureCount} failed`, 'warning')
    } else {
      showToast(
        cancelTargetPurchases.length === 1
          ? `Purchase ${cancelTargetPurchases[0].purchaseNo} cancelled successfully.`
          : `Successfully cancelled ${successCount} purchases.`,
        'info'
      )
    }

    if (activeDrawerPurchase && successfulIds.includes(activeDrawerPurchase.id)) {
      setActiveDrawerPurchase(prev => prev ? { ...prev, isCancelled: true, paymentStatus: 'Cancelled' } : null)
    }

    fetchPurchases()
  }

  // Single & Bulk Delete handlers
  const handleOpenDeleteDialog = (p: Purchase) => {
    setDeleteTargetPurchases([p])
    setDeleteModalOpen(true)
  }

  const handleOpenBulkDeleteDialog = () => {
    if (selectedPurchasesList.length === 0) return
    setDeleteTargetPurchases(selectedPurchasesList)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    setDeleteLoading(true)
    let successCount = 0
    let failureCount = 0
    const successfulIds: string[] = []

    for (const p of deleteTargetPurchases) {
      try {
        await purchaseService.deletePurchase(p.id)
        successCount++
        successfulIds.push(p.id)
      } catch (err: any) {
        failureCount++
        console.error(`Failed to delete purchase ${p.purchaseNo}`, err)
      }
    }

    setDeleteLoading(false)
    setDeleteModalOpen(false)

    // Remove successful IDs from selection
    setSelectedIds(prev => {
      const next = new Set(prev)
      successfulIds.forEach(id => next.delete(id))
      return next
    })

    if (failureCount > 0) {
      showToast(`Deleted ${successCount} purchases, ${failureCount} failed`, 'warning')
    } else {
      showToast(
        deleteTargetPurchases.length === 1
          ? 'Purchase record deleted successfully'
          : `Successfully deleted ${successCount} purchases`,
        'info'
      )
    }

    if (activeDrawerPurchase && successfulIds.includes(activeDrawerPurchase.id)) {
      setActiveDrawerPurchase(null)
    }

    fetchPurchases()
  }

  // Record Payment Handlers
  const handleOpenPaymentModal = (p: Purchase) => {
    setPaymentTargetPurchase(p)
    setPaymentBulkPurchases([])
    setPaymentModalOpen(true)
  }

  const handleOpenBulkPayModal = () => {
    const payable = selectedPurchasesList.filter(
      p => !p.isCancelled && p.paymentStatus !== 'Cancelled' && p.balanceAmount > 0
    )
    if (payable.length === 0) return
    setPaymentTargetPurchase(null)
    setPaymentBulkPurchases(payable)
    setPaymentModalOpen(true)
  }

  const handlePaymentSuccess = (updatedPurchases: Purchase[]) => {
    // Update active drawer if it matches any updated purchase
    if (activeDrawerPurchase) {
      const match = updatedPurchases.find(u => u.id === activeDrawerPurchase.id)
      if (match) setActiveDrawerPurchase(match)
    }
    // Clear selection
    setSelectedIds(new Set())
    fetchPurchases()
  }

  // Drawer Next/Prev navigation
  const drawerIndex = activeDrawerPurchase
    ? purchases.findIndex(p => p.id === activeDrawerPurchase.id)
    : -1
  const hasPrevDrawer = drawerIndex > 0
  const hasNextDrawer = drawerIndex >= 0 && drawerIndex < purchases.length - 1

  const handleDrawerPrev = () => {
    if (hasPrevDrawer) {
      setActiveDrawerPurchase(purchases[drawerIndex - 1])
    }
  }

  const handleDrawerNext = () => {
    if (hasNextDrawer) {
      setActiveDrawerPurchase(purchases[drawerIndex + 1])
    }
  }

  return (
    <FitScreenPage className="space-y-2.5 text-left">
      {/* 
        Header - PageHeader matching Expenses exactly
        title "Purchase Management", subtitle, and the Refresh, Export Register, and Create Purchase buttons
      */}
      <PageHeader
        title="Purchase Management"
        subtitle="Comprehensive procurement register, raw material inventory intake, and vendor liabilities"
        actions={
          <>
            <EnterpriseButton
              variant="secondary"
              size="sm"
              onClick={fetchPurchases}
              disabled={loading}
              className="!h-[32px] text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </EnterpriseButton>
            <EnterpriseButton
              variant="secondary"
              size="sm"
              onClick={() => exportCSV(purchases, 'purchases_register')}
              className="!h-[32px] text-xs font-semibold"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Export Register
            </EnterpriseButton>
            {canWrite && (
              <EnterpriseButton
                variant="primary"
                size="sm"
                onClick={() => navigate('/company/accounts/purchases/new')}
                className="!h-[32px] text-xs font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create Purchase
              </EnterpriseButton>
            )}
          </>
        }
      />

      {/* 1. KPI Row (4 cards desktop, 2 tablet, 1 mobile) */}
      <PurchaseKpiCards
        purchases={purchases}
        summaryStats={summaryStats}
        loading={loading}
        totalCount={totalCount}
      />

      {/* 2. Breakdown Cards: "Spend by Category" & "Paid Via" Side-by-Side */}
      <SpendBreakdownCards
        purchases={purchases}
        selectedCategory={filters.category}
        onSelectCategory={(cat) => handleFilterChange({ category: cat })}
        selectedPaymentMethod={filters.paymentMethod}
        onSelectPaymentMethod={(method) => handleFilterChange({ paymentMethod: method })}
        loading={loading}
      />

      {/* 3. Main Procurement Table Card (Flex:1, min-h-[260px], overflow-hidden) */}
      <div className="bg-white border border-[#E5E9F2] rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden w-full flex-1 min-h-[260px] flex flex-col">
        {/* If 1+ rows selected, show Bulk Action Bar; otherwise show Filter Bar */}
        {selectedIds.size > 0 ? (
          <PurchaseBulkBar
            selectedPurchases={selectedPurchasesList}
            onClearSelection={() => setSelectedIds(new Set())}
            onExportSelected={() => exportCSV(selectedPurchasesList, 'selected_purchases')}
            onPrintSelected={handleBulkPrint}
            onCancelSelected={handleOpenBulkCancelDialog}
            onDeleteSelected={handleOpenBulkDeleteDialog}
            onPaySelected={handleOpenBulkPayModal}
            canWrite={canWrite}
          />
        ) : (
          <PurchaseFilters
            vendors={vendors}
            categories={categories}
            filters={filters}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        )}

        {/* Table & Rows */}
        <PurchasesTable
          purchases={purchases}
          summaryStats={summaryStats}
          loading={loading}
          error={error}
          onRetry={fetchPurchases}
          totalCount={totalCount}
          pageNumber={pageNumber}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onOpenDrawer={setActiveDrawerPurchase}
          onEdit={(p) => navigate(`/company/accounts/purchases/edit/${p.id}`)}
          onPrint={handlePrintPurchase}
          onDuplicate={(p) => handleDuplicate(p.id)}
          onRecordPayment={handleOpenPaymentModal}
          onCancel={handleOpenCancelDialog}
          onDelete={handleOpenDeleteDialog}
          canWrite={canWrite}
          hasFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          onCreatePurchase={() => navigate('/company/accounts/purchases/new')}
        />
      </div>

      {/* Slide-over Detail Drawer */}
      <PurchaseDetailDrawer
        isOpen={!!activeDrawerPurchase}
        purchase={activeDrawerPurchase}
        onClose={() => setActiveDrawerPurchase(null)}
        hasPrev={hasPrevDrawer}
        hasNext={hasNextDrawer}
        onNavigatePrev={handleDrawerPrev}
        onNavigateNext={handleDrawerNext}
        onEdit={(p) => navigate(`/company/accounts/purchases/edit/${p.id}`)}
        onPrint={handlePrintPurchase}
        onDuplicate={(p) => handleDuplicate(p.id)}
        onRecordPayment={handleOpenPaymentModal}
        onCancel={handleOpenCancelDialog}
        onDelete={handleOpenDeleteDialog}
        canWrite={canWrite}
      />

      {/* Record Payment Modal (Single or Bulk Pay Selected) */}
      {paymentModalOpen && (
        <RecordPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false)
            setPaymentTargetPurchase(null)
            setPaymentBulkPurchases([])
          }}
          purchase={paymentTargetPurchase}
          purchases={paymentBulkPurchases}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Cancel Purchase Confirm Dialog */}
      <PurchaseCancelDialog
        isOpen={cancelModalOpen}
        purchases={cancelTargetPurchases}
        onClose={() => {
          setCancelModalOpen(false)
          setCancelTargetPurchases([])
        }}
        onConfirm={handleConfirmCancel}
        loading={cancelLoading}
      />

      {/* Delete Purchase Confirm Dialog */}
      <PurchaseDeleteDialog
        isOpen={deleteModalOpen}
        purchases={deleteTargetPurchases}
        onClose={() => {
          setDeleteModalOpen(false)
          setDeleteTargetPurchases([])
        }}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />

      {/* Print Preview Modal */}
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

export default PurchasesPage
