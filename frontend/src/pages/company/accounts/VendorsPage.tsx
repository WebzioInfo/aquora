import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw, Plus } from 'lucide-react'
import { vendorService, type Vendor } from '../../../services/vendors'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useAuthStore } from '../../../store/useAuthStore'

// Shared UI components
import PageHeader from '../../../components/ui/PageHeader'
import FitScreenPage from '../../../components/ui/FitScreenPage'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseNumberInput from '../../../components/ui/EnterpriseNumberInput'
import { PrintPreviewModal } from '../../../components/ui/PrintPreviewModal'

// Vendor Subcomponents
import { VendorKpiCards } from './vendors/VendorKpiCards'
import { VendorFilters, type VendorStatusChip, type VendorViewMode } from './vendors/VendorFilters'
import { VendorBulkBar } from './vendors/VendorBulkBar'
import { VendorsTable } from './vendors/VendorsTable'
import { VendorDetailDrawer } from './vendors/VendorDetailDrawer'
import { VendorPaymentModal } from './vendors/VendorPaymentModal'
import { formatINR } from './vendors/vendorHelpers'

export const VendorsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
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

  // 1. URL & LocalStorage State
  const initialSearch = searchParams.get('search') || ''
  const initialStatus = (searchParams.get('status') as VendorStatusChip) || 'all'
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const savedLimit = localStorage.getItem('vendor_page_size')
  const initialPageSize = savedLimit ? parseInt(savedLimit, 10) : 25
  const savedView = (localStorage.getItem('vendor_view_mode') as VendorViewMode) || 'table'

  const [search, setSearch] = useState<string>(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch)
  const [statusChip, setStatusChip] = useState<VendorStatusChip>(initialStatus)
  const [pageNumber, setPageNumber] = useState<number>(initialPage)
  const [pageSize, setPageSize] = useState<number>(initialPageSize)
  const [viewMode, setViewMode] = useState<VendorViewMode>(savedView)

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPageNumber(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Sync to URL & LocalStorage
  useEffect(() => {
    const params: Record<string, string> = {}
    if (debouncedSearch) params.search = debouncedSearch
    if (statusChip !== 'all') params.status = statusChip
    if (pageNumber > 1) params.page = String(pageNumber)
    if (pageSize !== 25) params.limit = String(pageSize)
    setSearchParams(params, { replace: true })
  }, [debouncedSearch, statusChip, pageNumber, pageSize, setSearchParams])

  useEffect(() => {
    localStorage.setItem('vendor_page_size', String(pageSize))
  }, [pageSize])

  useEffect(() => {
    localStorage.setItem('vendor_view_mode', viewMode)
  }, [viewMode])

  // 2. Data States
  const [rawVendors, setRawVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  // Active drawer & modals
  const [activeDrawerVendor, setActiveDrawerVendor] = useState<Vendor | null>(null)
  const [paymentVendor, setPaymentVendor] = useState<Vendor | null>(null)
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [submittingVendor, setSubmittingVendor] = useState<boolean>(false)

  // Print modal
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false)
  const [printDocData, setPrintDocData] = useState<any>(null)

  // Add/Edit Form state
  const [formData, setFormData] = useState<{
    name: string
    phone: string
    email: string
    gst: string
    address: string
    openingBalance: number | string
    creditLimit: number | string
    notes: string
  }>({
    name: '',
    phone: '',
    email: '',
    gst: '',
    address: '',
    openingBalance: 0,
    creditLimit: 0,
    notes: ''
  })

  // 3. Fetch Vendors
  const fetchVendors = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch up to 1000 items so client-side chip filtering, share-of-payable, and pagination remain 100% accurate
      const data = await vendorService.getVendors({
        pageNumber: 1,
        pageSize: 1000,
        search: debouncedSearch || undefined
      })
      setRawVendors(data.items || [])
    } catch (err: any) {
      showToast(err?.message || 'Failed to load vendors', 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, showToast])

  useEffect(() => {
    fetchVendors()
  }, [fetchVendors])

  // 4. Client-side filter by statusChip
  const filteredVendors = useMemo(() => {
    return rawVendors.filter(v => {
      if (statusChip === 'with-balance') return (v.currentBalance || 0) > 0
      if (statusChip === 'settled') return (v.currentBalance || 0) === 0
      if (statusChip === 'inactive') return !v.isActive
      return true
    })
  }, [rawVendors, statusChip])

  const totalFilteredCount = filteredVendors.length
  const totalPayableFiltered = useMemo(() => {
    return filteredVendors.reduce((sum, v) => sum + (v.currentBalance || 0), 0)
  }, [filteredVendors])

  // Total pages and out-of-range clamping
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize))
  useEffect(() => {
    if (totalFilteredCount > 0 && pageNumber > totalPages) {
      setPageNumber(totalPages)
    }
  }, [totalFilteredCount, pageNumber, totalPages])

  // Paginated slice
  const paginatedVendors = useMemo(() => {
    const start = (pageNumber - 1) * pageSize
    return filteredVendors.slice(start, start + pageSize)
  }, [filteredVendors, pageNumber, pageSize])

  // Clear selection on page, view, or filter change
  useEffect(() => {
    setSelectedIds(new Set())
    setLastSelectedIndex(null)
  }, [pageNumber, pageSize, statusChip, debouncedSearch, viewMode])

  // 5. Selection Handlers with shift-click support
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const shiftKey = e.shiftKey
    const currentIndex = paginatedVendors.findIndex(v => v.id === id)

    setSelectedIds(prev => {
      const next = new Set(prev)
      if (shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== currentIndex && currentIndex !== -1) {
        const start = Math.min(lastSelectedIndex, currentIndex)
        const end = Math.max(lastSelectedIndex, currentIndex)
        for (let i = start; i <= end; i++) {
          if (paginatedVendors[i]) next.add(paginatedVendors[i].id)
        }
      } else {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      return next
    })
    setLastSelectedIndex(currentIndex !== -1 ? currentIndex : null)
  }

  const handleToggleSelectAll = () => {
    const isAllSelected =
      paginatedVendors.length > 0 && paginatedVendors.every(v => selectedIds.has(v.id))
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedVendors.map(v => v.id)))
    }
  }

  const selectedVendorsList = useMemo(() => {
    return rawVendors.filter(v => selectedIds.has(v.id))
  }, [rawVendors, selectedIds])

  const totalPayableSelected = useMemo(() => {
    return selectedVendorsList.reduce((sum, v) => sum + (v.currentBalance || 0), 0)
  }, [selectedVendorsList])

  // 6. Drawer Navigation Next/Prev
  const drawerIndex = activeDrawerVendor
    ? filteredVendors.findIndex(v => v.id === activeDrawerVendor.id)
    : -1
  const hasPrevDrawer = drawerIndex > 0
  const hasNextDrawer = drawerIndex >= 0 && drawerIndex < filteredVendors.length - 1

  const handleDrawerPrev = () => {
    if (hasPrevDrawer) setActiveDrawerVendor(filteredVendors[drawerIndex - 1])
  }
  const handleDrawerNext = () => {
    if (hasNextDrawer) setActiveDrawerVendor(filteredVendors[drawerIndex + 1])
  }

  // 7. Actions: Toggle Status, Delete, Print, Payment
  const handleToggleStatus = async (vendor: Vendor) => {
    try {
      await vendorService.toggleVendorStatus(vendor.id)
      showToast(`Status updated for vendor "${vendor.name}".`, 'info')
      fetchVendors()
      if (activeDrawerVendor?.id === vendor.id) {
        setActiveDrawerVendor(prev => (prev ? { ...prev, isActive: !prev.isActive } : null))
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to toggle status', 'error')
    }
  }

  const handleDelete = async (vendor: Vendor) => {
    const hasHistory = (vendor.totalPurchasesCount || 0) > 0 || (vendor.openingBalance || 0) > 0
    if (hasHistory) {
      showToast(`Cannot delete vendor "${vendor.name}" with purchase or ledger history.`, 'warning')
      return
    }

    if (!window.confirm(`Are you sure you want to permanently delete vendor "${vendor.name}"?`)) return

    try {
      await vendorService.deleteVendor(vendor.id)
      showToast('Vendor deleted successfully.', 'info')
      if (activeDrawerVendor?.id === vendor.id) setActiveDrawerVendor(null)
      fetchVendors()
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete vendor', 'error')
    }
  }

  const handlePrintStatement = (vendor: Vendor) => {
    setPrintDocData({
      title: 'Vendor Statement',
      docNumber: vendor.vendorCode || `VND-${vendor.id.substring(0, 4).toUpperCase()}`,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      partyLabel: 'Vendor Info',
      partyInfo: {
        name: vendor.name,
        details1: `Email: ${vendor.email || 'N/A'} | Phone: ${vendor.phone || 'N/A'}`,
        details2: `GST: ${vendor.gst || 'N/A'} | Address: ${vendor.address || '—'}`
      },
      preparedBy: user?.fullName || 'Accounts Administrator',
      paymentDetails: {
        method: 'Statement Record'
      },
      items: [
        {
          sno: 1,
          description: 'Opening Balance Statement Mapping',
          amount: Number(vendor.openingBalance) || 0
        },
        {
          sno: 2,
          description: 'Accumulated Purchases Value',
          amount: (vendor.totalPurchasesCount || 0) > 0 ? (vendor.totalPurchaseValue || 0) : 0
        }
      ],
      financialSummary: {
        subTotal: (Number(vendor.openingBalance) || 0) + (vendor.totalPurchaseValue || 0),
        grandTotal: (Number(vendor.openingBalance) || 0) + (vendor.totalPurchaseValue || 0),
        amountPaid:
          (Number(vendor.openingBalance) || 0) +
          (vendor.totalPurchaseValue || 0) -
          (vendor.currentBalance || 0),
        balance: vendor.currentBalance || 0
      },
      notes: vendor.notes || 'This statement summarizes the creditor ledger standing.'
    })
    setPrintModalOpen(true)
  }

  const handleBulkPrintStatements = () => {
    if (selectedVendorsList.length === 0) return
    const totalOpen = selectedVendorsList.reduce((sum, v) => sum + (Number(v.openingBalance) || 0), 0)
    const totalPurch = selectedVendorsList.reduce((sum, v) => sum + (Number(v.totalPurchaseValue) || 0), 0)
    const totalBal = selectedVendorsList.reduce((sum, v) => sum + (Number(v.currentBalance) || 0), 0)

    setPrintDocData({
      title: 'Batch Vendor Statements',
      docNumber: `BATCH-VND-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      partyLabel: 'Consolidated Creditors',
      partyInfo: {
        name: `${selectedVendorsList.length} Selected Vendors`,
        details1: `Total Payable: ${formatINR(totalBal)}`,
        details2: `Vendors: ${selectedVendorsList.map(v => v.name).slice(0, 3).join(', ')}${
          selectedVendorsList.length > 3 ? '...' : ''
        }`
      },
      preparedBy: user?.fullName || 'Accounts Administrator',
      paymentDetails: {
        method: 'Consolidated Statement'
      },
      items: selectedVendorsList.map((v, idx) => ({
        sno: idx + 1,
        description: `${v.name} (${v.vendorCode || 'VND'}) - Purchases: ${v.totalPurchasesCount || 0}`,
        amount: v.currentBalance || 0
      })),
      financialSummary: {
        subTotal: totalOpen + totalPurch,
        grandTotal: totalOpen + totalPurch,
        amountPaid: totalOpen + totalPurch - totalBal,
        balance: totalBal
      },
      notes: `Consolidated vendor statement for ${selectedVendorsList.length} supplier accounts.`
    })
    setPrintModalOpen(true)
  }

  const handleExportCSV = (list = selectedVendorsList.length > 0 ? selectedVendorsList : filteredVendors) => {
    if (list.length === 0) {
      showToast('No vendor records to export', 'info')
      return
    }
    const headers = [
      'Code',
      'Vendor Name',
      'Phone',
      'Email',
      'GST',
      'Address',
      'Opening Balance',
      'Purchases Count',
      'Total Purchases',
      'Outstanding Balance',
      'Status'
    ]
    const rows = list.map(v => [
      `"${v.vendorCode || ''}"`,
      `"${v.name}"`,
      `"${v.phone || ''}"`,
      `"${v.email || ''}"`,
      `"${v.gst || ''}"`,
      `"${(v.address || '').replace(/"/g, '""')}"`,
      v.openingBalance || 0,
      v.totalPurchasesCount || 0,
      v.totalPurchaseValue || 0,
      v.currentBalance || 0,
      v.isActive ? 'Active' : 'Inactive'
    ])
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `vendors_register_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleBulkDeactivate = async () => {
    if (selectedVendorsList.length === 0) return
    const activeSelected = selectedVendorsList.filter(v => v.isActive)
    if (activeSelected.length === 0) {
      showToast('Selected vendors are already inactive', 'info')
      return
    }

    if (!window.confirm(`Deactivate ${activeSelected.length} selected vendors?`)) return

    let successCount = 0
    let failureCount = 0
    const failedIds = new Set<string>()

    for (const v of activeSelected) {
      try {
        await vendorService.toggleVendorStatus(v.id)
        successCount++
      } catch {
        failureCount++
        failedIds.add(v.id)
      }
    }

    if (failureCount > 0) {
      showToast(`Deactivated ${successCount} vendors. ${failureCount} failed.`, 'warning')
      setSelectedIds(failedIds)
    } else {
      showToast(`Successfully deactivated ${successCount} vendors.`, 'success')
      setSelectedIds(new Set())
    }
    fetchVendors()
  }

  // 8. Add/Edit Vendor Modal Handlers
  const handleOpenCreateModal = () => {
    setEditingVendor(null)
    setFormData({
      name: '',
      phone: '',
      email: '',
      gst: '',
      address: '',
      openingBalance: 0,
      creditLimit: 0,
      notes: ''
    })
    setShowAddEditModal(true)
  }

  const handleOpenEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      name: vendor.name,
      phone: vendor.phone || '',
      email: vendor.email || '',
      gst: vendor.gst || '',
      address: vendor.address || '',
      openingBalance: vendor.openingBalance || 0,
      creditLimit: vendor.creditLimit || 0,
      notes: vendor.notes || ''
    })
    setShowAddEditModal(true)
  }

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      showToast('Vendor Name is required.', 'error')
      return
    }

    setSubmittingVendor(true)
    try {
      const parsedBalance =
        typeof formData.openingBalance === 'number'
          ? formData.openingBalance
          : parseFloat(formData.openingBalance) || 0
      const parsedCreditLimit =
        typeof formData.creditLimit === 'number'
          ? formData.creditLimit
          : parseFloat(formData.creditLimit) || 0

      if (editingVendor) {
        const updated = await vendorService.updateVendor(editingVendor.id, {
          name: formData.name.trim(),
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          gst: formData.gst.trim() || undefined,
          address: formData.address.trim() || undefined,
          creditLimit: parsedCreditLimit,
          notes: formData.notes.trim() || undefined
        })
        showToast('Vendor updated successfully.', 'success')
        if (activeDrawerVendor?.id === editingVendor.id && updated) {
          setActiveDrawerVendor(updated)
        }
      } else {
        await vendorService.createVendor({
          name: formData.name.trim(),
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          gst: formData.gst.trim() || undefined,
          address: formData.address.trim() || undefined,
          openingBalance: parsedBalance,
          creditLimit: parsedCreditLimit,
          notes: formData.notes.trim() || undefined
        })
        showToast('Vendor created successfully.', 'success')
      }
      setShowAddEditModal(false)
      fetchVendors()
    } catch (err: any) {
      showToast(err?.message || 'Operation failed', 'error')
    } finally {
      setSubmittingVendor(false)
    }
  }

  // 9. Payment Success callback
  const handlePaymentSuccess = (updatedVendor: Vendor) => {
    fetchVendors()
    if (activeDrawerVendor?.id === updatedVendor.id) {
      setActiveDrawerVendor(updatedVendor)
    }
  }

  const hasActiveFilters = Boolean(search || statusChip !== 'all')
  const handleClearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setStatusChip('all')
    setPageNumber(1)
  }

  return (
    <FitScreenPage className="space-y-2.5 text-left">
      {/* 1. Page Header (Exact match to Expenses / Purchases) */}
      <PageHeader
        title="Vendor Management"
        subtitle="Supplier directory, creditor ledgers, purchasing history, and balance tracking"
        actions={
          <>
            <EnterpriseButton
              variant="secondary"
              size="sm"
              onClick={fetchVendors}
              disabled={loading}
              className="!h-[32px] text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </EnterpriseButton>

            {canWrite && (
              <EnterpriseButton
                variant="primary"
                size="sm"
                onClick={handleOpenCreateModal}
                className="!h-[32px] text-xs font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add New Vendor
              </EnterpriseButton>
            )}
          </>
        }
      />

      {/* 2. KPI Cards Row (4 cards, no breakdown cards) */}
      <VendorKpiCards
        vendors={filteredVendors}
        loading={loading}
        totalFilteredCount={totalFilteredCount}
      />

      {/* 3. Table Card (Flex:1, min-h-[260px], overflow-hidden) */}
      <div className="bg-white border border-[#E5E9F2] rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden w-full flex-1 min-h-[260px] flex flex-col">
        {/* Top bar: Bulk Bar when 1+ selected, else Filter Bar */}
        {selectedIds.size > 0 ? (
          <VendorBulkBar
            selectedCount={selectedIds.size}
            totalPayableSelected={totalPayableSelected}
            onExport={() => handleExportCSV(selectedVendorsList)}
            onPrint={handleBulkPrintStatements}
            onDeactivate={handleBulkDeactivate}
            onClear={() => setSelectedIds(new Set())}
            canWrite={canWrite}
          />
        ) : (
          <VendorFilters
            search={search}
            onSearchChange={setSearch}
            statusChip={statusChip}
            onStatusChipChange={chip => {
              setStatusChip(chip)
              setPageNumber(1)
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
          />
        )}

        {/* Vendors Table / Card Grid with Pinned Pagination */}
        <VendorsTable
          vendors={paginatedVendors}
          loading={loading}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onRowClick={vendor => setActiveDrawerVendor(vendor)}
          onOpenEdit={handleOpenEditModal}
          onOpenPayment={vendor => setPaymentVendor(vendor)}
          onPrintStatement={handlePrintStatement}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
          totalPayableFiltered={totalPayableFiltered}
          totalCount={totalFilteredCount}
          pageNumber={pageNumber}
          pageSize={pageSize}
          onPageChange={setPageNumber}
          onPageSizeChange={size => {
            setPageSize(size)
            setPageNumber(1)
          }}
          viewMode={viewMode}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          onOpenCreate={handleOpenCreateModal}
          canWrite={canWrite}
        />
      </div>

      {/* 4. Vendor Detail Slide-Over Drawer */}
      <VendorDetailDrawer
        isOpen={Boolean(activeDrawerVendor)}
        onClose={() => setActiveDrawerVendor(null)}
        vendor={activeDrawerVendor}
        onOpenEdit={handleOpenEditModal}
        onOpenPayment={vendor => setPaymentVendor(vendor)}
        onPrintStatement={handlePrintStatement}
        onToggleStatus={handleToggleStatus}
        onPrev={handleDrawerPrev}
        onNext={handleDrawerNext}
        hasPrev={hasPrevDrawer}
        hasNext={hasNextDrawer}
        canWrite={canWrite}
      />

      {/* 5. Record Payment Modal */}
      <VendorPaymentModal
        isOpen={Boolean(paymentVendor)}
        onClose={() => setPaymentVendor(null)}
        vendor={paymentVendor}
        onSuccess={handlePaymentSuccess}
      />

      {/* 6. Add/Edit Vendor Modal */}
      <EnterpriseModal
        isOpen={showAddEditModal}
        onClose={() => setShowAddEditModal(false)}
        title={editingVendor ? 'Edit Vendor Record' : 'Register New Vendor'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveVendor} className="space-y-4 text-xs select-none">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Vendor Legal Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Biofix Organics India Pvt Ltd"
              className="w-full h-[36px] px-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full h-[36px] px-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="procurement@vendor.com"
                className="w-full h-[36px] px-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">GSTIN Number</label>
              <input
                type="text"
                value={formData.gst}
                onChange={e => setFormData({ ...formData, gst: e.target.value.toUpperCase() })}
                placeholder="27ABCDE1234F1Z5"
                className="w-full h-[36px] px-3 border border-slate-300 rounded-lg text-slate-900 uppercase font-mono focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Credit Limit (₹)</label>
              <EnterpriseNumberInput
                value={formData.creditLimit}
                onChange={val => setFormData({ ...formData, creditLimit: val })}
                className="w-full h-[36px] px-3 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>
          </div>

          {!editingVendor && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Account Opening Balance (₹)
              </label>
              <EnterpriseNumberInput
                value={formData.openingBalance}
                onChange={val => setFormData({ ...formData, openingBalance: val })}
                className="w-full h-[36px] px-3 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Initial creditor balance carried forward from previous accounting records.
              </p>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Office / Factory Address</label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              placeholder="Full physical or billing address"
              className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
            <input
              type="text"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Terms, bank account notes, etc."
              className="w-full h-[36px] px-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB]"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <EnterpriseButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowAddEditModal(false)}
              disabled={submittingVendor}
              className="!h-[32px] text-xs font-semibold"
            >
              Cancel
            </EnterpriseButton>

            <EnterpriseButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={submittingVendor}
              className="!h-[32px] text-xs font-semibold shadow-xs"
            >
              {submittingVendor ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Register Vendor'}
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {/* 7. Statement Print Preview Modal */}
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

export default VendorsPage
