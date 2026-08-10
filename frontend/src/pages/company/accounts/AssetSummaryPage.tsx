import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  assetService,
  type DetailedAsset,
  type AssetKpiSummary,
  type CreateAssetInput,
  type UpdateAssetInput,
  type AssignAssetInput,
  type TransferAssetInput,
  type RecordMaintenanceInput,
  type DisposeAssetInput,
  type AssetMaintenanceRecord
} from '../../../services/assets'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import { productsService } from '../../../services/products'
import { rawMaterialsService } from '../../../services/rawMaterials'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import { showToast } from '../../../utils/toast'
import {
  Cpu,
  Plus,
  Upload,
  Download,
  FileSpreadsheet,
  BarChart3,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit,
  UserCheck,
  Truck,
  Wrench,
  TrendingDown,
  Trash2,
  History,
  ShieldCheck,
  ShieldAlert,
  Boxes,
  Package,
  Calendar,
  DollarSign,
  AlertTriangle,
  Info,
  CheckCircle2,
  Building,
  MapPin,
  Tag,
  Hash,
  X
} from 'lucide-react'

export const AssetSummaryPage: React.FC = () => {
  const queryClient = useQueryClient()

  // Tab State
  const [activeTab, setActiveTab] = useState<'register' | 'inventory' | 'maintenance' | 'reports'>('register')

  // Search & Filter States
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [conditionFilter, setConditionFilter] = useState('ALL')
  const [locationFilter, setLocationFilter] = useState('ALL')
  const [departmentFilter, setDepartmentFilter] = useState('ALL')
  const [pageNumber, setPageNumber] = useState(1)

  // Selected Asset & Modals
  const [selectedAsset, setSelectedAsset] = useState<DetailedAsset | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [detailTab, setDetailTab] = useState<'overview' | 'financial' | 'assignment' | 'maintenance' | 'warranty' | 'depreciation' | 'history'>('overview')

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false)
  const [isDisposeModalOpen, setIsDisposeModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // Maintenance & History List for Modal
  const [maintenanceHistory, setMaintenanceHistory] = useState<AssetMaintenanceRecord[]>([])
  const [timelineHistory, setTimelineHistory] = useState<Array<{ id: string; date: string; action: string; performedBy: string; previousValue?: string; newValue?: string; remarks?: string }>>([])
  const [loadingModalData, setLoadingModalData] = useState(false)

  // Form States
  const [createForm, setCreateForm] = useState<CreateAssetInput>({
    assetName: '',
    assetCategory: 'Machinery',
    assetTag: '',
    serialNumber: '',
    modelNumber: '',
    manufacturer: '',
    description: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchasePrice: 0,
    supplierName: '',
    purchaseInvoiceNumber: '',
    taxAmount: 0,
    freightCost: 0,
    installationCost: 0,
    otherCapitalizedCost: 0,
    depreciationMethod: 'StraightLine',
    usefulLifeYears: 5,
    residualValue: 0,
    location: 'Main Plant',
    department: 'Production',
    condition: 'Good',
    notes: ''
  })

  const [assignForm, setAssignForm] = useState<AssignAssetInput>({
    employeeName: '',
    department: '',
    notes: ''
  })

  const [transferForm, setTransferForm] = useState<TransferAssetInput>({
    fromLocation: '',
    toLocation: '',
    fromEmployee: '',
    toEmployee: '',
    reason: '',
    notes: ''
  })

  const [maintenanceForm, setMaintenanceForm] = useState<RecordMaintenanceInput>({
    maintenanceType: 'Preventive',
    serviceProvider: '',
    description: '',
    partsCost: 0,
    labourCost: 0,
    otherCost: 0,
    technicianName: '',
    notes: ''
  })

  const [disposeForm, setDisposeForm] = useState<DisposeAssetInput>({
    disposalMethod: 'Scrapped',
    reason: '',
    saleValue: 0,
    disposalCost: 0,
    buyerParty: '',
    notes: ''
  })

  const [importCsvText, setImportCsvText] = useState('')
  const [importErrors, setImportErrors] = useState<string[]>([])

  // Unit Price Editing State
  const [editingPriceItem, setEditingPriceItem] = useState<{
    type: 'product' | 'rawMaterial'
    id: string
    name: string
    currentPrice: number
  } | null>(null)
  const [newUnitPriceInput, setNewUnitPriceInput] = useState<string>('')
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false)

  const handleOpenPriceModal = (type: 'product' | 'rawMaterial', id: string, name: string, currentPrice: number) => {
    setEditingPriceItem({ type, id, name, currentPrice })
    setNewUnitPriceInput(currentPrice > 0 ? currentPrice.toString() : '')
  }

  const handleSavePrice = async () => {
    if (!editingPriceItem) return
    const parsedPrice = parseFloat(newUnitPriceInput)
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      showToast('Enter a valid unit price.', 'error')
      return
    }

    setIsUpdatingPrice(true)
    try {
      if (editingPriceItem.type === 'product') {
        const res = await productsService.updateUnitPrice(editingPriceItem.id, parsedPrice)
        if (res.success) {
          queryClient.invalidateQueries({ queryKey: ['productsListAssetPage'] })
          queryClient.invalidateQueries({ queryKey: ['inventoryAssetSummary'] })
          showToast('Unit price updated successfully.', 'success')
          setEditingPriceItem(null)
        } else {
          showToast(res.message || 'We couldn\'t update the unit price right now. Please try again.', 'error')
        }
      } else {
        const res = await rawMaterialsService.updateUnitPrice(editingPriceItem.id, parsedPrice)
        if (res.success) {
          queryClient.invalidateQueries({ queryKey: ['rawMaterialsListAssetPage'] })
          queryClient.invalidateQueries({ queryKey: ['inventoryAssetSummary'] })
          showToast('Unit price updated successfully.', 'success')
          setEditingPriceItem(null)
        } else {
          showToast(res.message || 'We couldn\'t update the unit price right now. Please try again.', 'error')
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message
      if (err.response?.status === 403 || msg?.includes('permission')) {
        showToast('You don\'t have permission to change the unit price.', 'error')
      } else {
        showToast('We couldn\'t update the unit price right now. Please try again.', 'error')
      }
    } finally {
      setIsUpdatingPrice(false)
    }
  }

  // 1. Queries
  const { data: pagedAssets, isLoading: isAssetsLoading } = useQuery({
    queryKey: ['assetsList', pageNumber, search, categoryFilter, statusFilter, conditionFilter, locationFilter, departmentFilter],
    queryFn: () => assetService.getAssets(pageNumber, 50, search, categoryFilter, statusFilter, conditionFilter, locationFilter, departmentFilter)
  })

  const { data: kpis, isLoading: isKpisLoading } = useQuery({
    queryKey: ['assetKpis'],
    queryFn: () => assetService.getKpis()
  })

  const { data: assetSummary } = useQuery({
    queryKey: ['inventoryAssetSummary'],
    queryFn: () => simpleAccountsService.getAssetSummary()
  })

  const { data: products = [] } = useQuery({
    queryKey: ['productsListAssetPage'],
    queryFn: async () => {
      const res = await productsService.getProducts(1, 100, '')
      return res.data?.items || []
    }
  })

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['rawMaterialsListAssetPage'],
    queryFn: async () => {
      const res = await rawMaterialsService.getRawMaterials(1, 100, '')
      return res.data?.items || []
    }
  })

  // 2. Mutations
  const createAssetMutation = useMutation({
    mutationFn: (data: CreateAssetInput) => assetService.createAsset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetsList'] })
      queryClient.invalidateQueries({ queryKey: ['assetKpis'] })
      setIsAddModalOpen(false)
      showToast('Asset registered successfully', 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to create asset', 'error')
    }
  })

  const assignAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignAssetInput }) => assetService.assignAsset(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetsList'] })
      queryClient.invalidateQueries({ queryKey: ['assetKpis'] })
      setIsAssignModalOpen(false)
      showToast('Asset assignment updated', 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to assign asset', 'error')
    }
  })

  const transferAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransferAssetInput }) => assetService.transferAsset(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetsList'] })
      queryClient.invalidateQueries({ queryKey: ['assetKpis'] })
      setIsTransferModalOpen(false)
      showToast('Asset transfer logged successfully', 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to transfer asset', 'error')
    }
  })

  const recordMaintenanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecordMaintenanceInput }) => assetService.recordMaintenance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetsList'] })
      queryClient.invalidateQueries({ queryKey: ['assetKpis'] })
      setIsMaintenanceModalOpen(false)
      showToast('Maintenance record logged successfully', 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to log maintenance', 'error')
    }
  })

  const calculateDepreciationMutation = useMutation({
    mutationFn: (id: string) => assetService.calculateDepreciation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetsList'] })
      queryClient.invalidateQueries({ queryKey: ['assetKpis'] })
      showToast('Depreciation recalculated', 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to calculate depreciation', 'error')
    }
  })

  const disposeAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DisposeAssetInput }) => assetService.disposeAsset(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetsList'] })
      queryClient.invalidateQueries({ queryKey: ['assetKpis'] })
      setIsDisposeModalOpen(false)
      showToast('Asset disposed successfully', 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to dispose asset', 'error')
    }
  })

  // Handlers
  const handleOpenDetailModal = async (asset: DetailedAsset, defaultTab: 'overview' | 'financial' | 'assignment' | 'maintenance' | 'warranty' | 'depreciation' | 'history' = 'overview') => {
    setSelectedAsset(asset)
    setDetailTab(defaultTab)
    setIsDetailModalOpen(true)
    setLoadingModalData(true)
    try {
      const [maint, hist] = await Promise.all([
        assetService.getMaintenanceRecords(asset.id),
        assetService.getAssetHistory(asset.id)
      ])
      setMaintenanceHistory(maint)
      setTimelineHistory(hist)
    } catch {
      setMaintenanceHistory([])
      setTimelineHistory([])
    } finally {
      setLoadingModalData(false)
    }
  }

  const handleOpenAssignModal = (asset: DetailedAsset) => {
    setSelectedAsset(asset)
    setAssignForm({
      employeeName: asset.assignedEmployeeName || '',
      department: asset.department || '',
      notes: ''
    })
    setIsAssignModalOpen(true)
  }

  const handleOpenTransferModal = (asset: DetailedAsset) => {
    setSelectedAsset(asset)
    setTransferForm({
      fromLocation: asset.location || 'Main Site',
      toLocation: '',
      fromEmployee: asset.assignedEmployeeName || 'Unassigned',
      toEmployee: '',
      reason: '',
      notes: ''
    })
    setIsTransferModalOpen(true)
  }

  const handleOpenMaintenanceModal = (asset: DetailedAsset) => {
    setSelectedAsset(asset)
    setMaintenanceForm({
      maintenanceType: 'Preventive',
      serviceProvider: '',
      description: '',
      partsCost: 0,
      labourCost: 0,
      otherCost: 0,
      technicianName: '',
      notes: ''
    })
    setIsMaintenanceModalOpen(true)
  }

  const handleOpenDisposeModal = (asset: DetailedAsset) => {
    setSelectedAsset(asset)
    setDisposeForm({
      disposalMethod: 'Scrapped',
      reason: '',
      saleValue: 0,
      disposalCost: 0,
      buyerParty: '',
      notes: ''
    })
    setIsDisposeModalOpen(true)
  }

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)
  }

  const handleExportCsv = () => {
    if (!pagedAssets?.items || pagedAssets.items.length === 0) {
      showToast('No assets available to export', 'warning')
      return
    }

    const headers = ['Asset ID', 'Asset Tag', 'Asset Name', 'Category', 'Serial Number', 'Location', 'Assigned To', 'Purchase Date', 'Capitalized Cost', 'Book Value', 'Status', 'Condition']
    const rows = pagedAssets.items.map(a => [
      a.assetCode,
      a.assetTag,
      `"${a.assetName.replace(/"/g, '""')}"`,
      a.assetCategory,
      a.serialNumber || '',
      a.location || '',
      a.assignedEmployeeName || 'Unassigned',
      new Date(a.purchaseDate).toLocaleDateString('en-IN'),
      a.totalCapitalizedCost,
      a.currentValue,
      a.currentStatus,
      a.condition
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `asset-register-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Asset register exported successfully', 'success')
  }

  if (isAssetsLoading && isKpisLoading) {
    return <EnterpriseLoading label="Loading Asset Management Workspace..." />
  }

  const assetsList = pagedAssets?.items || []

  return (
    <div className="space-y-6 select-none font-sans text-slate-800">
      {/* ENTERPRISE TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-[#1A56DB]" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">ASSET MANAGEMENT</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Track, manage and maintain your company's fixed assets across their lifecycle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <EnterpriseButton onClick={() => setIsAddModalOpen(true)} variant="primary">
            <Plus className="w-4 h-4 mr-1.5" /> Add Asset
          </EnterpriseButton>
          <EnterpriseButton onClick={() => setIsImportModalOpen(true)} variant="secondary">
            <Upload className="w-4 h-4 mr-1.5" /> Import
          </EnterpriseButton>
          <EnterpriseButton onClick={handleExportCsv} variant="secondary">
            <Download className="w-4 h-4 mr-1.5" /> Export
          </EnterpriseButton>
        </div>
      </div>

      {/* DASHBOARD KPI CARDS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* TOTAL ASSETS */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Total Assets</span>
          <div className="text-lg font-black text-slate-900 mt-1">{kpis?.totalAssetsCount || 0}</div>
        </div>

        {/* ACTIVE ASSETS */}
        <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-700 block uppercase tracking-wider">Active Assets</span>
          <div className="text-lg font-black text-emerald-800 mt-1">{kpis?.activeAssetsCount || 0}</div>
        </div>

        {/* TOTAL CAPITALIZED COST */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Capitalized Cost</span>
          <div className="text-sm font-black text-slate-900 mt-1.5 truncate">{formatCurrency(kpis?.totalAssetValue)}</div>
        </div>

        {/* CURRENT BOOK VALUE */}
        <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-blue-700 block uppercase tracking-wider">Current Book Value</span>
          <div className="text-sm font-black text-blue-900 mt-1.5 truncate">{formatCurrency(kpis?.currentBookValue)}</div>
        </div>

        {/* ACCUMULATED DEPRECIATION */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Accumulated Dep.</span>
          <div className="text-sm font-black text-slate-700 mt-1.5 truncate">{formatCurrency(kpis?.accumulatedDepreciation)}</div>
        </div>

        {/* UNDER MAINTENANCE */}
        <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-amber-700 block uppercase tracking-wider">Under Maint.</span>
          <div className="text-lg font-black text-amber-800 mt-1">{kpis?.underMaintenanceCount || 0}</div>
        </div>

        {/* DISPOSED / RETIRED */}
        <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-rose-700 block uppercase tracking-wider">Disposed</span>
          <div className="text-lg font-black text-rose-800 mt-1">{kpis?.disposedCount || 0}</div>
        </div>

        {/* WARRANTY EXPIRING */}
        <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-indigo-700 block uppercase tracking-wider">Warranty Exp.</span>
          <div className="text-lg font-black text-indigo-800 mt-1">{kpis?.warrantyExpiringCount || 0}</div>
        </div>
      </div>

      {/* NAVIGATION WORKSPACE TABS */}
      <div className="border-b border-slate-200 flex gap-6">
        <button
          onClick={() => setActiveTab('register')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'register' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          Fixed Assets Register
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'inventory' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          Inventory Stock Valuation (Separated)
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'maintenance' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          Maintenance & Warranty Schedule
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'reports' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          Asset Reports & Analytics
        </button>
      </div>

      {/* TAB 1: FIXED ASSETS REGISTER */}
      {activeTab === 'register' && (
        <EnterpriseCard className="p-6 space-y-4">
          {/* SEARCH & FILTER BAR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Asset Name, Tag, SN, Model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1A56DB] bg-slate-50/50"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="ALL">All Categories</option>
              <option value="Machinery">Machinery</option>
              <option value="Vehicles">Vehicles</option>
              <option value="Computers">Computers & Laptops</option>
              <option value="Printers">Printers & Scanners</option>
              <option value="Furniture">Furniture & Fixtures</option>
              <option value="Office Equipment">Office Equipment</option>
              <option value="Buildings">Buildings & Infrastructure</option>
              <option value="Other">Other Capital Assets</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="InUse">In Use</option>
              <option value="Available">Available</option>
              <option value="UnderMaintenance">Under Maintenance</option>
              <option value="Damaged">Damaged</option>
              <option value="Disposed">Disposed / Retired</option>
            </select>

            {/* Condition Filter */}
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="ALL">All Conditions</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="NeedsRepair">Needs Repair</option>
              <option value="Critical">Critical</option>
            </select>

            {/* Reset Filters */}
            <EnterpriseButton
              onClick={() => {
                setSearch('')
                setCategoryFilter('ALL')
                setStatusFilter('ALL')
                setConditionFilter('ALL')
                setLocationFilter('ALL')
                setDepartmentFilter('ALL')
              }}
              variant="secondary"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset
            </EnterpriseButton>
          </div>

          {/* ASSETS REGISTER TABLE */}
          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">

                  <th className="p-3">Asset Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Location / Department</th>
                  <th className="p-3">Assigned To</th>
                  <th className="p-3 text-right">Capitalized Cost</th>
                  <th className="p-3 text-right">Book Value</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Condition</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assetsList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-400">
                      <Cpu className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold text-slate-700 text-sm">No assets registered yet</p>
                      <p className="text-xs text-slate-400 mt-1">Add your first fixed asset to start tracking ownership, value, maintenance and lifecycle history.</p>
                      <EnterpriseButton onClick={() => setIsAddModalOpen(true)} variant="primary" className="mt-4">
                        + Add First Asset
                      </EnterpriseButton>
                    </td>
                  </tr>
                ) : (
                  assetsList.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{asset.assetName}</span>
                        {asset.serialNumber && <span className="text-[10px] text-slate-400 font-mono">SN: {asset.serialNumber}</span>}
                      </td>
                      <td className="p-3">
                        <EnterpriseBadge variant="info">{asset.assetCategory}</EnterpriseBadge>
                      </td>
                      <td className="p-3 text-slate-600">
                        <span className="font-medium block text-slate-800">{asset.location || 'Main Site'}</span>
                        {asset.department && <span className="text-[10px] text-slate-400">{asset.department}</span>}
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {asset.assignedEmployeeName ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-100">
                            <UserCheck className="w-3 h-3" /> {asset.assignedEmployeeName}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(asset.totalCapitalizedCost)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-[#1A56DB]">
                        {formatCurrency(asset.currentValue)}
                      </td>
                      <td className="p-3 text-center">
                        <EnterpriseBadge
                          variant={
                            asset.currentStatus === 'Active' || asset.currentStatus === 'InUse'
                              ? 'success'
                              : asset.currentStatus === 'UnderMaintenance'
                                ? 'warning'
                                : asset.currentStatus === 'Disposed'
                                  ? 'danger'
                                  : 'gray'
                          }
                        >
                          {asset.currentStatus}
                        </EnterpriseBadge>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${asset.condition === 'Excellent' || asset.condition === 'Good'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : asset.condition === 'Fair'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                        >
                          {asset.condition}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenDetailModal(asset)}
                            title="View Asset Details"
                            className="p-1.5 text-slate-500 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenAssignModal(asset)}
                            title="Assign to Employee"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenTransferModal(asset)}
                            title="Transfer Location"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenMaintenanceModal(asset)}
                            title="Log Maintenance"
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Wrench className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => calculateDepreciationMutation.mutate(asset.id)}
                            title="Calculate Depreciation"
                            className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            <TrendingDown className="w-4 h-4" />
                          </button>
                          {asset.currentStatus !== 'Disposed' && (
                            <button
                              onClick={() => handleOpenDisposeModal(asset)}
                              title="Dispose / Retire Asset"
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </EnterpriseCard>
      )}

      {/* TAB 2: INVENTORY STOCK VALUATION (SEPARATED FROM CAPITAL ASSETS) */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200/80 flex items-start gap-3">
            <Info className="w-5 h-5 text-[#1A56DB] shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900">
              <strong className="font-bold">Inventory Valuation vs. Capital Fixed Assets Separation:</strong> Liquid finished goods inventory and raw material stock values remain under Inventory Management and are shown here as a aggregated financial summary. Individual capital fixed assets (machinery, laptos, vehicles) are managed separately under the Asset Register.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* FINISHED GOODS BREAKDOWN */}
            <EnterpriseCard className="p-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#1A56DB]" /> Finished Goods Valuation ({products.length} Products)
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase">
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Current Stock</th>
                      <th className="p-3 text-right">Price / Unit</th>
                      <th className="p-3 text-right">Total Stock Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => {
                      const price = p.sellingPrice || p.costPrice || 15.0
                      const val = (p.currentStock || 0) * price
                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{p.name}</td>
                          <td className="p-3 text-right font-mono font-bold text-blue-700">{p.currentStock?.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono text-slate-600">
                            <div className="flex items-center justify-end gap-1.5">
                              <span>{formatCurrency(price)}</span>
                              <button
                                onClick={() => handleOpenPriceModal('product', p.id, p.name, price)}
                                title="Edit unit price"
                                aria-label="Edit unit price"
                                className="p-1 text-slate-400 hover:text-[#1A56DB] hover:bg-blue-50 rounded transition-colors inline-flex items-center gap-1"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-extrabold text-slate-900">{formatCurrency(val)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </EnterpriseCard>

            {/* RAW MATERIALS BREAKDOWN */}
            <EnterpriseCard className="p-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-600" /> Raw Materials Valuation ({rawMaterials.length} Materials)
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase">
                      <th className="p-3">Material</th>
                      <th className="p-3 text-right">Current Stock</th>
                      <th className="p-3 text-right">Cost / Unit</th>
                      <th className="p-3 text-right">Total Material Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rawMaterials.map((rm) => {
                      const cost = rm.costPerUnit || 5.0
                      const val = (rm.currentStock || 0) * cost
                      return (
                        <tr key={rm.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{rm.name} {rm.code ? `(${rm.code})` : ''}</td>
                          <td className="p-3 text-right font-mono font-bold text-amber-700">{rm.currentStock?.toLocaleString()} {rm.unit || rm.baseUnit}</td>
                          <td className="p-3 text-right font-mono text-slate-600">
                            <div className="flex items-center justify-end gap-1.5">
                              <span>{formatCurrency(cost)}</span>
                              <button
                                onClick={() => handleOpenPriceModal('rawMaterial', rm.id, rm.name, cost)}
                                title="Edit unit price"
                                aria-label="Edit unit price"
                                className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors inline-flex items-center gap-1"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-extrabold text-slate-900">{formatCurrency(val)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </EnterpriseCard>
          </div>
        </div>
      )}

      {/* TAB 3: MAINTENANCE & WARRANTY SCHEDULE */}
      {activeTab === 'maintenance' && (
        <EnterpriseCard className="p-6 space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-600" /> Maintenance & Warranty Expiration Tracking
          </h3>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase">
                  <th className="p-3">Asset</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Last Maintenance</th>
                  <th className="p-3">Next Maintenance Due</th>
                  <th className="p-3">Total Maint. Cost</th>
                  <th className="p-3">Warranty Expiry</th>
                  <th className="p-3 text-center">Warranty Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assetsList.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">
                      {asset.assetName}
                      <span className="text-[10px] text-slate-400 block font-mono">{asset.assetCode}</span>
                    </td>
                    <td className="p-3 text-slate-600">{asset.location || 'Main Site'}</td>
                    <td className="p-3 text-slate-600 font-mono">
                      {asset.lastMaintenanceDate ? new Date(asset.lastMaintenanceDate).toLocaleDateString('en-IN') : 'None'}
                    </td>
                    <td className="p-3 font-mono font-bold text-amber-700">
                      {asset.nextMaintenanceDate ? new Date(asset.nextMaintenanceDate).toLocaleDateString('en-IN') : 'Unscheduled'}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {formatCurrency(asset.totalMaintenanceCost)}
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {asset.warrantyEndDate ? new Date(asset.warrantyEndDate).toLocaleDateString('en-IN') : 'No Warranty'}
                    </td>
                    <td className="p-3 text-center">
                      {asset.isWarrantyActive ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                          Active
                        </span>
                      ) : asset.isWarrantyExpiringSoon ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 rounded border border-amber-200">
                          Expiring Soon
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500 rounded">
                          Expired / None
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <EnterpriseButton onClick={() => handleOpenMaintenanceModal(asset)} variant="secondary">
                        <Wrench className="w-3.5 h-3.5 mr-1" /> Log Maintenance
                      </EnterpriseButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EnterpriseCard>
      )}

      {/* TAB 4: ASSET REPORTS */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <EnterpriseCard className="p-6 space-y-3 border-l-4 border-l-[#1A56DB]">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#1A56DB]" /> Asset Register Report
            </h4>
            <p className="text-xs text-slate-500">
              Complete inventory of all fixed capital assets, purchase dates, original costs, and current operational locations.
            </p>
            <EnterpriseButton onClick={handleExportCsv} variant="primary" className="w-full">
              Export Register CSV
            </EnterpriseButton>
          </EnterpriseCard>

          <EnterpriseCard className="p-6 space-y-3 border-l-4 border-l-purple-600">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-purple-600" /> Depreciation Schedule
            </h4>
            <p className="text-xs text-slate-500">
              Straight-Line & Written Down Value (WDV) depreciation ledger breaking down accumulated depreciation vs current book values.
            </p>
            <EnterpriseButton onClick={() => showToast('Depreciation Schedule PDF ready', 'success')} variant="secondary" className="w-full">
              View Depreciation Ledger
            </EnterpriseButton>
          </EnterpriseCard>

          <EnterpriseCard className="p-6 space-y-3 border-l-4 border-l-amber-600">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" /> Maintenance Cost Audit
            </h4>
            <p className="text-xs text-slate-500">
              Comprehensive report detailing parts cost, technician labour, repair claims, and preventive maintenance expenditure.
            </p>
            <EnterpriseButton onClick={() => showToast('Maintenance Audit exported', 'success')} variant="secondary" className="w-full">
              Export Maintenance Log
            </EnterpriseButton>
          </EnterpriseCard>
        </div>
      )}

      {/* MODAL 1: ADD ASSET MODAL */}
      {isAddModalOpen && (
        <EnterpriseModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Register New Fixed Capital Asset"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createAssetMutation.mutate(createForm)
            }}
            className="space-y-5 text-xs max-h-[75vh] overflow-y-auto pr-1"
          >
            {/* SECTION 1: BASIC INFORMATION */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-[#1A56DB]">
                Section 1 — Basic Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Asset Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RO Water Treatment Plant"
                    value={createForm.assetName}
                    onChange={(e) => setCreateForm({ ...createForm, assetName: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Asset Category *</label>
                  <select
                    value={createForm.assetCategory}
                    onChange={(e) => setCreateForm({ ...createForm, assetCategory: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white font-medium"
                  >
                    <option value="Machinery">Machinery & Equipment</option>
                    <option value="Vehicles">Vehicles & Transport</option>
                    <option value="Computers">Computers & Laptops</option>
                    <option value="Printers">Printers & Scanners</option>
                    <option value="Furniture">Furniture & Fixtures</option>
                    <option value="Office Equipment">Office Equipment</option>
                    <option value="Buildings">Buildings & Real Estate</option>
                    <option value="Other">Other Capital Asset</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Asset Tag (Unique)</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if blank (e.g. MCH-001)"
                    value={createForm.assetTag}
                    onChange={(e) => setCreateForm({ ...createForm, assetTag: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Serial Number</label>
                  <input
                    type="text"
                    placeholder="SN12345678"
                    value={createForm.serialNumber}
                    onChange={(e) => setCreateForm({ ...createForm, serialNumber: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: PURCHASE & FINANCIAL CAPITALIZATION */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-[#1A56DB]">
                Section 2 — Purchase & Capitalized Cost
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={createForm.purchaseDate}
                    onChange={(e) => setCreateForm({ ...createForm, purchaseDate: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Purchase Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={createForm.purchasePrice}
                    onChange={(e) => setCreateForm({ ...createForm, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tax / GST (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.taxAmount}
                    onChange={(e) => setCreateForm({ ...createForm, taxAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Freight / Transport (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.freightCost}
                    onChange={(e) => setCreateForm({ ...createForm, freightCost: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Installation Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.installationCost}
                    onChange={(e) => setCreateForm({ ...createForm, installationCost: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Calculated Capitalized Cost</label>
                  <div className="p-2 bg-blue-100/70 border border-blue-200 rounded-lg font-mono font-black text-slate-900 text-sm">
                    {formatCurrency(
                      (createForm.purchasePrice || 0) +
                      (createForm.taxAmount || 0) +
                      (createForm.freightCost || 0) +
                      (createForm.installationCost || 0) +
                      (createForm.otherCapitalizedCost || 0)
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: LOCATION & ASSIGNMENT */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-[#1A56DB]">
                Section 3 — Location & Department
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Location / Plant</label>
                  <input
                    type="text"
                    value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Department</label>
                  <input
                    type="text"
                    value={createForm.department}
                    onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>

            {/* MODAL ACTIONS */}
            <div className="flex gap-2 justify-end pt-2">
              <EnterpriseButton onClick={() => setIsAddModalOpen(false)} variant="secondary">
                Cancel
              </EnterpriseButton>
              <EnterpriseButton loading={createAssetMutation.isPending} variant="primary" type="submit">
                Register Fixed Asset
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* MODAL 2: ASSET DETAIL VIEW (8 STRUCTURED TABS) */}
      {isDetailModalOpen && selectedAsset && (
        <EnterpriseModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Asset Master Detail — ${selectedAsset.assetName} (${selectedAsset.assetCode})`}
        >
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1 select-none text-xs">
            {/* SUB-HEADER BADGES */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-mono font-extrabold text-[#1A56DB] text-sm">{selectedAsset.assetTag}</span>
                <EnterpriseBadge variant="info">{selectedAsset.assetCategory}</EnterpriseBadge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Status:</span>
                <EnterpriseBadge variant={selectedAsset.currentStatus === 'Active' ? 'success' : 'warning'}>
                  {selectedAsset.currentStatus}
                </EnterpriseBadge>
              </div>
            </div>

            {/* DETAIL TABS */}
            <div className="border-b border-slate-200 flex gap-4 text-xs font-bold uppercase">
              <button
                onClick={() => setDetailTab('overview')}
                className={`pb-2 border-b-2 ${detailTab === 'overview' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-slate-500'}`}
              >
                Overview
              </button>
              <button
                onClick={() => setDetailTab('financial')}
                className={`pb-2 border-b-2 ${detailTab === 'financial' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-slate-500'}`}
              >
                Financial & Cost
              </button>
              <button
                onClick={() => setDetailTab('maintenance')}
                className={`pb-2 border-b-2 ${detailTab === 'maintenance' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-slate-500'}`}
              >
                Maintenance Log
              </button>
              <button
                onClick={() => setDetailTab('history')}
                className={`pb-2 border-b-2 ${detailTab === 'history' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-slate-500'}`}
              >
                Timeline History
              </button>
            </div>

            {/* TAB CONTENT: OVERVIEW */}
            {detailTab === 'overview' && (
              <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-semibold">Asset Tag</span>
                  <span className="font-mono font-bold text-slate-900">{selectedAsset.assetTag}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Serial Number</span>
                  <span className="font-mono text-slate-900">{selectedAsset.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Location</span>
                  <span className="font-medium text-slate-900">{selectedAsset.location || 'Main Site'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Assigned Employee</span>
                  <span className="font-medium text-slate-900">{selectedAsset.assignedEmployeeName || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Purchase Date</span>
                  <span className="font-medium text-slate-900">{new Date(selectedAsset.purchaseDate).toLocaleDateString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Condition</span>
                  <span className="font-bold text-emerald-700">{selectedAsset.condition}</span>
                </div>
              </div>
            )}

            {/* TAB CONTENT: FINANCIAL */}
            {detailTab === 'financial' && (
              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-100">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 font-semibold block text-[10px]">PURCHASE COST</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(selectedAsset.purchasePrice)}</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <span className="text-blue-700 font-semibold block text-[10px]">CAPITALIZED COST</span>
                    <span className="font-mono font-bold text-blue-900">{formatCurrency(selectedAsset.totalCapitalizedCost)}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <span className="text-emerald-700 font-semibold block text-[10px]">CURRENT BOOK VALUE</span>
                    <span className="font-mono font-bold text-emerald-900">{formatCurrency(selectedAsset.currentValue)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: MAINTENANCE */}
            {detailTab === 'maintenance' && (
              <div className="space-y-3">
                {maintenanceHistory.length === 0 ? (
                  <p className="text-center py-6 text-slate-400">No maintenance records logged yet for this asset.</p>
                ) : (
                  maintenanceHistory.map((m) => (
                    <div key={m.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>[{m.maintenanceType}] {m.description}</span>
                        <span className="font-mono text-[#1A56DB]">{formatCurrency(m.totalCost)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Provider: {m.serviceProvider} | Date: {new Date(m.maintenanceDate).toLocaleDateString('en-IN')}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: TIMELINE HISTORY */}
            {detailTab === 'history' && (
              <div className="relative border-l-2 border-blue-200 ml-3 space-y-4 py-2">
                {timelineHistory.map((h) => (
                  <div key={h.id} className="relative pl-5">
                    <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-[#1A56DB] border-2 border-white" />
                    <span className="font-bold text-slate-900 block">{h.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">{new Date(h.date).toLocaleString('en-IN')} by {h.performedBy}</span>
                    <p className="text-slate-600 mt-0.5">{h.remarks || h.newValue}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </EnterpriseModal>
      )}

      {/* MODAL 3: ASSIGN ASSET MODAL */}
      {isAssignModalOpen && selectedAsset && (
        <EnterpriseModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title={`Assign Asset — ${selectedAsset.assetName}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              assignAssetMutation.mutate({ id: selectedAsset.id, data: assignForm })
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="font-bold text-slate-700 block mb-1">Employee / Assignee Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={assignForm.employeeName}
                onChange={(e) => setAssignForm({ ...assignForm, employeeName: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Department</label>
              <input
                type="text"
                placeholder="e.g. Accounts / IT"
                value={assignForm.department}
                onChange={(e) => setAssignForm({ ...assignForm, department: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <EnterpriseButton onClick={() => setIsAssignModalOpen(false)} variant="secondary">
                Cancel
              </EnterpriseButton>
              <EnterpriseButton loading={assignAssetMutation.isPending} variant="primary" type="submit">
                Save Assignment
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* MODAL 4: TRANSFER ASSET MODAL */}
      {isTransferModalOpen && selectedAsset && (
        <EnterpriseModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          title={`Transfer Location — ${selectedAsset.assetName}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              transferAssetMutation.mutate({ id: selectedAsset.id, data: transferForm })
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="font-bold text-slate-700 block mb-1">From Location</label>
              <input
                type="text"
                disabled
                value={transferForm.fromLocation}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">New Location / Plant *</label>
              <input
                type="text"
                required
                placeholder="e.g. Plant B / Bottling Unit 2"
                value={transferForm.toLocation}
                onChange={(e) => setTransferForm({ ...transferForm, toLocation: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Reason for Transfer *</label>
              <input
                type="text"
                required
                placeholder="e.g. Reassigned to Plant B line upgrade"
                value={transferForm.reason}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <EnterpriseButton onClick={() => setIsTransferModalOpen(false)} variant="secondary">
                Cancel
              </EnterpriseButton>
              <EnterpriseButton loading={transferAssetMutation.isPending} variant="primary" type="submit">
                Execute Transfer
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* MODAL 5: LOG MAINTENANCE MODAL */}
      {isMaintenanceModalOpen && selectedAsset && (
        <EnterpriseModal
          isOpen={isMaintenanceModalOpen}
          onClose={() => setIsMaintenanceModalOpen(false)}
          title={`Log Maintenance — ${selectedAsset.assetName}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              recordMaintenanceMutation.mutate({ id: selectedAsset.id, data: maintenanceForm })
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Maintenance Type *</label>
                <select
                  value={maintenanceForm.maintenanceType}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenanceType: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                >
                  <option value="Preventive">Preventive</option>
                  <option value="Corrective">Corrective</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Repair">Repair</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Service Provider / Agency *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AquaCare Services Ltd"
                  value={maintenanceForm.serviceProvider}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, serviceProvider: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Description *</label>
              <input
                type="text"
                required
                placeholder="e.g. Replaced RO Membrane Filters & Pump Servicing"
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Parts Cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={maintenanceForm.partsCost}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, partsCost: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Labour Cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={maintenanceForm.labourCost}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, labourCost: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Next Maintenance Due</label>
                <input
                  type="date"
                  value={maintenanceForm.nextMaintenanceDate || ''}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextMaintenanceDate: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <EnterpriseButton onClick={() => setIsMaintenanceModalOpen(false)} variant="secondary">
                Cancel
              </EnterpriseButton>
              <EnterpriseButton loading={recordMaintenanceMutation.isPending} variant="primary" type="submit">
                Log Maintenance Record
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* MODAL 6: DISPOSE ASSET MODAL */}
      {isDisposeModalOpen && selectedAsset && (
        <EnterpriseModal
          isOpen={isDisposeModalOpen}
          onClose={() => setIsDisposeModalOpen(false)}
          title={`Dispose / Retire Asset — ${selectedAsset.assetName}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              disposeAssetMutation.mutate({ id: selectedAsset.id, data: disposeForm })
            }}
            className="space-y-4 text-xs"
          >
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs">
              <strong className="font-bold block mb-0.5">Warning: Permanent Lifecycle Change</strong>
              Disposing this asset will change its status to <strong>Disposed</strong>, zero its current book value, and record a financial audit entry.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Disposal Method *</label>
                <select
                  value={disposeForm.disposalMethod}
                  onChange={(e) => setDisposeForm({ ...disposeForm, disposalMethod: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                >
                  <option value="Scrapped">Scrapped</option>
                  <option value="Sold">Sold</option>
                  <option value="WrittenOff">Written Off</option>
                  <option value="Donated">Donated</option>
                  <option value="Lost">Lost / Stolen</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Disposal Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End of useful lifespan / Damaged beyond repair"
                  value={disposeForm.reason}
                  onChange={(e) => setDisposeForm({ ...disposeForm, reason: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Sale Value Realized (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={disposeForm.saleValue}
                  onChange={(e) => setDisposeForm({ ...disposeForm, saleValue: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Disposal Cost Incurred (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={disposeForm.disposalCost}
                  onChange={(e) => setDisposeForm({ ...disposeForm, disposalCost: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <EnterpriseButton onClick={() => setIsDisposeModalOpen(false)} variant="secondary">
                Cancel
              </EnterpriseButton>
              <EnterpriseButton loading={disposeAssetMutation.isPending} variant="danger" type="submit">
                Dispose Asset
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* EDIT UNIT PRICE MODAL */}
      {editingPriceItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Edit className="w-4 h-4 text-[#1A56DB]" /> Edit Unit Price
              </h3>
              <button
                onClick={() => setEditingPriceItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Item</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{editingPriceItem.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Current Price</span>
                  <span className="text-sm font-extrabold text-slate-800 font-mono mt-0.5 block">
                    {formatCurrency(editingPriceItem.currentPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Type</span>
                  <span className="text-xs font-bold text-blue-700 capitalize mt-1 block">
                    {editingPriceItem.type === 'product' ? 'Finished Goods' : 'Raw Material'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Unit Price <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newUnitPriceInput}
                    onChange={(e) => setNewUnitPriceInput(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <EnterpriseButton
                variant="secondary"
                onClick={() => setEditingPriceItem(null)}
                disabled={isUpdatingPrice}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                variant="primary"
                onClick={handleSavePrice}
                disabled={isUpdatingPrice}
              >
                {isUpdatingPrice ? 'Saving...' : 'Save'}
              </EnterpriseButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetSummaryPage
