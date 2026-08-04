import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingBag,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  FileSpreadsheet,
  Edit2,
  Copy,
  XCircle,
  CreditCard,
  Printer,
  Download,
  Building2,
  DollarSign,
  Clock,
  Filter,
  ArrowUpDown,
  RotateCcw
} from 'lucide-react'
import { PrintPreviewModal } from '../../../components/ui/PrintPreviewModal'
import { purchaseService, type Purchase, type PurchaseSummaryStats } from '../../../services/purchases'
import { vendorService, type VendorDropdownItem } from '../../../services/vendors'
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseNumberInput from '../../../components/ui/EnterpriseNumberInput'

export const PurchasesPage: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useNotificationStore()

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [summaryStats, setSummaryStats] = useState<PurchaseSummaryStats | null>(null)
  const [vendors, setVendors] = useState<VendorDropdownItem[]>([])

  // Comprehensive Filter State
  const [search, setSearch] = useState<string>('')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedVendorId, setSelectedVendorId] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedTaxType, setSelectedTaxType] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [minAmount, setMinAmount] = useState<string>('')
  const [maxAmount, setMaxAmount] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('date_desc')

  // Pagination State
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [pageSize] = useState<number>(12)
  const [totalCount, setTotalCount] = useState<number>(0)

  // Payment Modal State for Quick Row Action
  const [paymentModalPurchase, setPaymentModalPurchase] = useState<Purchase | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<number | string>(0)
  const [paymentMethod, setPaymentMethod] = useState<string>('BankAccount')
  const [paymentRef, setPaymentRef] = useState<string>('')
  const [paymentSubmitting, setPaymentSubmitting] = useState<boolean>(false)

  // Print Preview Modal States
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printDocData, setPrintDocData] = useState<any>(null)

  const categories = [
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

  useEffect(() => {
    vendorService.getVendorDropdown().then(setVendors).catch(() => {})
  }, [])

  const fetchPurchases = async () => {
    setLoading(true)
    try {
      let sDate: string | undefined = undefined
      let eDate: string | undefined = undefined

      const now = new Date()
      if (dateFilter === 'today') {
        sDate = new Date(now.setHours(0,0,0,0)).toISOString()
        eDate = new Date(now.setHours(23,59,59,999)).toISOString()
      } else if (dateFilter === 'this_week') {
        const first = now.getDate() - now.getDay()
        sDate = new Date(now.setDate(first)).toISOString()
        eDate = new Date().toISOString()
      } else if (dateFilter === 'this_month') {
        sDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        eDate = new Date().toISOString()
      } else if (dateFilter === 'custom') {
        if (startDate) sDate = new Date(startDate).toISOString()
        if (endDate) eDate = new Date(endDate).toISOString()
      }

      const response = await purchaseService.getPurchases({
        pageNumber,
        pageSize,
        search,
        startDate: sDate,
        endDate: eDate,
        vendorId: selectedVendorId || undefined,
        category: selectedCategory || undefined,
        paymentStatus: selectedStatus || undefined
      })

      setPurchases(response.items || [])
      setTotalCount(response.totalCount || 0)
      if (response.summaryStats) {
        setSummaryStats(response.summaryStats)
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to fetch purchases', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPurchases()
  }, [pageNumber, search, dateFilter, startDate, endDate, selectedVendorId, selectedCategory, selectedTaxType, selectedStatus, selectedPaymentMethod, minAmount, maxAmount, sortBy])

  const clearFilters = () => {
    setSearch('')
    setDateFilter('all')
    setStartDate('')
    setEndDate('')
    setSelectedVendorId('')
    setSelectedCategory('')
    setSelectedTaxType('')
    setSelectedStatus('')
    setSelectedPaymentMethod('')
    setMinAmount('')
    setMaxAmount('')
    setSortBy('date_desc')
    setPageNumber(1)
  }

  const handleCancel = async (id: string, purchaseNo: string) => {
    if (!window.confirm(`Are you sure you want to cancel purchase ${purchaseNo}? This will reverse inventory stock and vendor balances.`)) return
    try {
      await purchaseService.cancelPurchase(id)
      showToast(`Purchase ${purchaseNo} cancelled successfully.`, 'info')
      fetchPurchases()
    } catch (err: any) {
      showToast(err?.message || 'Failed to cancel purchase', 'error')
    }
  }

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

  const handleDelete = async (id: string, purchaseNo: string) => {
    if (!window.confirm(`Are you sure you want to soft-delete purchase ${purchaseNo}?`)) return
    try {
      await purchaseService.deletePurchase(id)
      showToast('Purchase record deleted successfully', 'info')
      fetchPurchases()
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete purchase', 'error')
    }
  }

  const handleQuickPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentModalPurchase) return
    const amt = typeof paymentAmount === 'number' ? paymentAmount : (parseFloat(paymentAmount) || 0)
    if (amt <= 0) {
      showToast('Payment amount must be greater than zero.', 'error')
      return
    }

    setPaymentSubmitting(true)
    try {
      await purchaseService.addPayment(paymentModalPurchase.id, {
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod,
        amount: amt,
        referenceNo: paymentRef
      })
      showToast('Payment recorded successfully', 'success')
      setPaymentModalPurchase(null)
      fetchPurchases()
    } catch (err: any) {
      showToast(err?.message || 'Failed to add payment', 'error')
    } finally {
      setPaymentSubmitting(false)
    }
  }

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
    });
    setPrintModalOpen(true);
  };

  const exportCSV = () => {
    if (purchases.length === 0) return
    const headers = ['Purchase No', 'Date', 'Vendor', 'Vendor Code', 'Category', 'Invoice No', 'Tax Type', 'Payment Method', 'Gross Total', 'Paid Amount', 'Balance', 'Status', 'Created By']
    const rows = purchases.map((p) => [
      p.purchaseNo,
      new Date(p.purchaseDate).toLocaleDateString('en-IN'),
      `"${p.vendorName}"`,
      p.vendorCode || '-',
      p.purchaseCategory,
      p.invoiceNumber || '-',
      p.taxAmount > 0 ? 'GST' : 'Non-GST',
      p.paymentMethod,
      p.grandTotal,
      p.amountPaid,
      p.balanceAmount,
      p.paymentStatus,
      `"${p.createdByName || 'Company Administrator'}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `purchases_register_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusBadge = (p: Purchase) => {
    if (p.isCancelled || p.paymentStatus === 'Cancelled') {
      return <EnterpriseBadge variant="danger">Cancelled</EnterpriseBadge>
    }
    switch (p.paymentStatus) {
      case 'Paid':
        return <EnterpriseBadge variant="success">Paid</EnterpriseBadge>
      case 'PartiallyPaid':
        return <EnterpriseBadge variant="warning">Partial</EnterpriseBadge>
      default:
        return <EnterpriseBadge variant="danger">Credit</EnterpriseBadge>
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="space-y-6 select-none w-full">
      {/* Header */}
      <EnterpriseHeader
        title="Purchase Management"
        description="Comprehensive procurement register, raw material inventory intake, and vendor liabilities"
        actions={
          <div className="flex items-center gap-2">
            <EnterpriseButton variant="secondary" size="sm" onClick={fetchPurchases} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </EnterpriseButton>
            <EnterpriseButton variant="secondary" size="sm" onClick={exportCSV}>
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Export Register
            </EnterpriseButton>
            <EnterpriseButton variant="primary" size="sm" onClick={() => navigate('/company/accounts/purchases/new')}>
              <Plus className="w-4 h-4 mr-1.5" /> Create Purchase
            </EnterpriseButton>
          </div>
        }
      />

      {/* Quick Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <EnterpriseCard className="p-3 border-l-4 border-l-blue-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Total Purchases</span>
          <div className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">
            {summaryStats?.totalPurchasesCount ?? totalCount}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-3 border-l-4 border-l-indigo-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Today's Purchases</span>
          <div className="text-lg font-extrabold text-indigo-600 font-mono mt-0.5">
            {summaryStats?.todayPurchasesCount ?? 0}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-3 border-l-4 border-l-emerald-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Total Value</span>
          <div className="text-lg font-extrabold text-emerald-600 font-mono mt-0.5 truncate">
            ₹{(summaryStats?.totalPurchaseValue ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-3 border-l-4 border-l-red-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Outstanding Balance</span>
          <div className="text-lg font-extrabold text-red-600 font-mono mt-0.5 truncate">
            ₹{(summaryStats?.outstandingBalance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-3 border-l-4 border-l-amber-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Pending Payments</span>
          <div className="text-lg font-extrabold text-amber-600 font-mono mt-0.5">
            {summaryStats?.pendingPaymentsCount ?? 0}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-3 border-l-4 border-l-purple-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Active Vendors</span>
          <div className="text-lg font-extrabold text-purple-600 font-mono mt-0.5">
            {summaryStats?.activeVendorsCount ?? vendors.length}
          </div>
        </EnterpriseCard>
      </div>

      {/* Advanced Rich Filter Bar */}
      <EnterpriseCard className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative col-span-1 md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Purchase No, Vendor, Invoice No..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPageNumber(1)
              }}
              className="w-full h-[38px] pl-9 pr-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
            />
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full h-[38px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-medium"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Vendor */}
          <div>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full h-[38px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-medium"
            >
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-[38px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-medium"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-[38px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-medium"
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="PartiallyPaid">Partially Paid</option>
              <option value="Unpaid">Credit / Unpaid</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Custom Date Inputs & Clear Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E5E9F2]">
          <div className="flex items-center gap-3">
            {dateFilter === 'custom' && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 h-[34px] text-xs bg-white border border-[#D0D5DD] rounded-[6px]"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 h-[34px] text-xs bg-white border border-[#D0D5DD] rounded-[6px]"
                />
              </>
            )}
            <span className="text-xs text-slate-500 font-medium">
              Showing {purchases.length} of {totalCount} records
            </span>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-[#1A56DB] hover:underline font-semibold flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
          </button>
        </div>
      </EnterpriseCard>

      {/* Enterprise Full-Width High-Density Table */}
      <EnterpriseCard className="p-0 overflow-hidden">
        {loading ? (
          <EnterpriseLoading label="Loading Procurement Ledger..." />
        ) : purchases.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <ShoppingBag className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">No Purchase Records Found</p>
            <p className="text-xs">Adjust your search filters or record a new purchase transaction.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E5E9F2] text-slate-600 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">Purchase No</th>
                  <th className="px-4 py-3">Purchase Date</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3 text-right">Gross Amount</th>
                  <th className="px-4 py-3 text-right">Paid Amount</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Payment Status</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E9F2]">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-[#1A56DB] font-mono whitespace-nowrap">
                      {purchase.purchaseNo}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(purchase.purchaseDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div>
                        {purchase.vendorName}
                        {purchase.vendorCode && (
                          <span className="text-[10px] text-slate-400 font-mono block">{purchase.vendorCode}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <EnterpriseBadge variant="info">{purchase.purchaseCategory}</EnterpriseBadge>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                      {purchase.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-900 font-mono whitespace-nowrap">
                      ₹{purchase.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold font-mono whitespace-nowrap">
                      ₹{purchase.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-semibold font-mono whitespace-nowrap">
                      ₹{purchase.balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(purchase)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <div>
                        <span className="font-semibold text-slate-700 block">
                          {new Date(purchase.updatedAt || purchase.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          by {purchase.updatedByName || purchase.createdByName || 'Unknown User'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* VIEW */}
                        <button
                          onClick={() => navigate(`/company/accounts/purchases/${purchase.id}`)}
                          className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* EDIT */}
                        {!purchase.isCancelled && (
                          <button
                            onClick={() => navigate(`/company/accounts/purchases/edit/${purchase.id}`)}
                            className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                            title="Edit Purchase"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* PRINT */}
                        <button
                          onClick={() => handlePrintPurchase(purchase)}
                          className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                          title="Print Purchase Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {/* DELETE */}
                        <button
                          onClick={() => handleDelete(purchase.id, purchase.purchaseNo)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                          title="Delete Purchase"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* MODULE SPECIFIC EXTRA ACTIONS */}
                        {!purchase.isCancelled && purchase.balanceAmount > 0 && (
                          <button
                            onClick={() => {
                              setPaymentModalPurchase(purchase)
                              setPaymentAmount(purchase.balanceAmount)
                            }}
                            className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
                            title="Record Payment"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDuplicate(purchase.id)}
                          className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors"
                          title="Duplicate Purchase"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {!purchase.isCancelled && (
                          <button
                            onClick={() => handleCancel(purchase.id, purchase.purchaseNo)}
                            className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                            title="Cancel Purchase"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-[#E5E9F2] flex items-center justify-between bg-slate-50/50">
            <EnterpriseButton
              variant="secondary"
              size="sm"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((p) => p - 1)}
            >
              Previous
            </EnterpriseButton>
            <span className="text-xs text-slate-500 font-medium">
              Page {pageNumber} of {totalPages} ({totalCount} Records)
            </span>
            <EnterpriseButton
              variant="secondary"
              size="sm"
              disabled={pageNumber >= totalPages}
              onClick={() => setPageNumber((p) => p + 1)}
            >
              Next
            </EnterpriseButton>
          </div>
        )}
      </EnterpriseCard>

      {/* Quick Record Payment Modal */}
      {paymentModalPurchase && (
        <EnterpriseModal
          isOpen={!!paymentModalPurchase}
          onClose={() => setPaymentModalPurchase(null)}
          title={`Record Payment for ${paymentModalPurchase.purchaseNo}`}
        >
          <form onSubmit={handleQuickPaymentSubmit} className="space-y-4">
            <div className="p-3 bg-blue-50/70 rounded-[8px] border border-blue-100 text-xs">
              <span className="text-slate-600 block">Vendor: <strong>{paymentModalPurchase.vendorName}</strong></span>
              <span className="text-slate-600 block mt-0.5">Outstanding Balance: <strong className="text-red-600 font-mono">₹{paymentModalPurchase.balanceAmount.toFixed(2)}</strong></span>
            </div>

            <EnterpriseNumberInput
              label="Payment Amount (₹)"
              value={paymentAmount}
              onValueChange={(val) => setPaymentAmount(val)}
              placeholder="0.00"
            />

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-bold text-slate-900"
              >
                <option value="BankAccount">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">Reference Number / UTR</label>
              <input
                type="text"
                placeholder="e.g. UTR-99812739"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-mono"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-[#E5E9F2]">
              <EnterpriseButton
                type="button"
                variant="secondary"
                onClick={() => setPaymentModalPurchase(null)}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                loading={paymentSubmitting}
              >
                Save Payment
              </EnterpriseButton>
            </div>
          </form>
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
    </div>
  )
}

export default PurchasesPage
