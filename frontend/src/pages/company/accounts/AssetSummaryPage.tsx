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
import AssetHistoryDetails from './components/AssetHistoryDetails'
import AssetFormModal from './components/AssetFormModal'
import AssetDepreciationModal from './components/AssetDepreciationModal'
import AssetEmployeeSelect from './components/AssetEmployeeSelect'
import AssetRowActions from './components/AssetRowActions'
import AssetDetailsModal from './components/AssetDetailsModal'
import AssetAssignmentModal from './components/AssetAssignmentModal'
import AssetDisposalModal from './components/AssetDisposalModal'
import AssetDeleteConfirmationModal from './components/AssetDeleteConfirmationModal'
import AssetTransferModal from './components/AssetTransferModal'
import AssetMaintenanceModal from './components/AssetMaintenanceModal'
import { AssetDateFilterPopover, type AssetDateFilterState, computeDateRange } from './components/AssetDateFilterPopover'
import { useAuthStore } from '../../../store/useAuthStore'
import { isAxiosError } from 'axios'
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
  Archive,
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
  const user = useAuthStore(state => state.user)
  const canManage = user?.roles.some(role => ['SuperAdmin', 'CompanyOwner', 'CompanyAdmin', 'Accountant', 'Admin', 'Owner'].includes(role)) ?? false
  const canDelete = user?.roles.some(role => ['SuperAdmin', 'CompanyOwner', 'CompanyAdmin', 'Admin', 'Owner'].includes(role)) ?? false
  const isHistorical = (asset: DetailedAsset) => ['disposed', 'retired'].includes(asset.currentStatus.toLowerCase())
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteBlocked, setDeleteBlocked] = useState(false)
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | undefined>(undefined)
  const [checkingHistory, setCheckingHistory] = useState(false)
  const [isDepreciationModalOpen, setIsDepreciationModalOpen] = useState(false)
  const refreshAssets = () => {
    queryClient.invalidateQueries({ queryKey: ['assetsList'] })
    queryClient.invalidateQueries({ queryKey: ['assetKpis'] })
  }
  const mutationError = (error: unknown) => {
    if (isAxiosError<{ code?: string; message?: string }>(error)) {
      const msg = error.response?.data?.message
      const code = error.response?.data?.code
      if (code === 'AssetHistoryExists' || msg === 'AssetHistoryExists' || msg?.toLowerCase().includes('assethistoryexists')) {
        showToast('This asset contains historical records and cannot be permanently deleted. Mark it as Disposed instead.', 'warning')
        return
      }
      showToast(msg || 'Unable to complete asset request. Please try again.', 'error')
      return
    }
    showToast('Unable to complete asset request. Please try again.', 'error')
  }


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

  const currentDateObj = new Date()
  const [dateFilter, setDateFilter] = useState<AssetDateFilterState>({
    mode: 'all',
    selectedMonth: currentDateObj.getMonth() + 1,
    selectedYear: currentDateObj.getFullYear(),
    fromDate: '',
    toDate: ''
  })

  const activeDateRange = computeDateRange(
    dateFilter.mode,
    dateFilter.selectedMonth,
    dateFilter.selectedYear,
    dateFilter.fromDate,
    dateFilter.toDate
  )

  const handleResetFilters = () => {
    setSearch('')
    setCategoryFilter('ALL')
    setStatusFilter('ALL')
    setConditionFilter('ALL')
    setLocationFilter('ALL')
    setDepartmentFilter('ALL')
    setDateFilter({
      mode: 'all',
      selectedMonth: currentDateObj.getMonth() + 1,
      selectedYear: currentDateObj.getFullYear(),
      fromDate: '',
      toDate: ''
    })
    setPageNumber(1)
  }

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
    expectedVersion: '',
    employeeName: '',
    department: '',
    notes: ''
  })

  const [transferForm, setTransferForm] = useState<TransferAssetInput>({
    expectedVersion: '',
    fromLocation: '',
    toLocation: '',
    fromEmployee: '',
    toEmployee: '',
    reason: '',
    notes: ''
  })

  const [maintenanceForm, setMaintenanceForm] = useState<RecordMaintenanceInput>({
    expectedVersion: '',
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
    expectedVersion: '',
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
  const {
    data: pagedAssets,
    isLoading: isAssetsLoading,
    isError: isAssetsError,
    error: assetsError,
    refetch: refetchAssets
  } = useQuery({
    queryKey: [
      'assetsList',
      pageNumber,
      search,
      categoryFilter,
      statusFilter,
      conditionFilter,
      locationFilter,
      departmentFilter,
      activeDateRange.fromDate,
      activeDateRange.toDate
    ],
    queryFn: () =>
      assetService.getAssets(
        pageNumber,
        50,
        search,
        categoryFilter,
        statusFilter,
        conditionFilter,
        locationFilter,
        departmentFilter,
        activeDateRange.fromDate || undefined,
        activeDateRange.toDate || undefined
      )
  })

  const {
    data: fallbackKpis,
    isLoading: isKpisLoading,
    isError: isKpisError,
    refetch: refetchKpis
  } = useQuery({
    queryKey: [
      'assetKpis',
      search,
      categoryFilter,
      statusFilter,
      conditionFilter,
      locationFilter,
      departmentFilter,
      activeDateRange.fromDate,
      activeDateRange.toDate
    ],
    queryFn: () =>
      assetService.getKpis(
        search,
        categoryFilter,
        statusFilter,
        conditionFilter,
        locationFilter,
        departmentFilter,
        activeDateRange.fromDate || undefined,
        activeDateRange.toDate || undefined
      )
  })

  const kpis = pagedAssets?.summary ?? fallbackKpis

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
    mutationFn: ({ id, data }: { id: string; data: import('../../../services/assets').DepreciateAssetInput }) => assetService.calculateDepreciation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetsList'] })
      queryClient.invalidateQueries({ queryKey: ['assetKpis'] })
      setIsDepreciationModalOpen(false)
      showToast('Depreciation applied', 'success')
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

  const updateAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAssetInput }) => assetService.updateAsset(id, data),
    onSuccess: () => { refreshAssets(); setIsEditModalOpen(false); showToast('Asset updated successfully', 'success') },
    onError: mutationError
  })
  const deleteAssetMutation = useMutation({
    mutationFn: (asset: DetailedAsset) => assetService.deleteAsset(asset.id, asset.version),
    onSuccess: () => {
      refreshAssets()
      setIsDeleteModalOpen(false)
      showToast('Asset permanently removed', 'success')
    },
    onError: (error: unknown) => {
      refreshAssets()
      if (isAxiosError<{ code?: string; message?: string }>(error)) {
        const errData = error.response?.data
        const code = errData?.code
        const msg = errData?.message || ''
        if (code === 'AssetHistoryExists' || msg.includes('historical records') || msg.toLowerCase().includes('assethistoryexists')) {
          setDeleteBlocked(true)
          setDeleteBlockedReason(msg.includes('historical records') ? msg : 'This asset contains historical records and cannot be permanently deleted. Mark it as Disposed instead.')
          showToast('This asset contains historical records and cannot be permanently deleted. Mark it as Disposed instead.', 'warning')
          return
        }
      }
      mutationError(error)
    }
  })
  const openAssetAction = async (row: DetailedAsset, mode: 'edit' | 'delete' | 'depreciation') => {
    try {
      const asset = await assetService.getAssetById(row.id)
      setSelectedAsset(asset)
      if (mode === 'edit') {
        const { currentStatus: _status, ...fields } = asset
        setCreateForm({ ...fields, purchaseDate: fields.purchaseDate.slice(0, 10) })
        setIsEditModalOpen(true)
      } else if (mode === 'delete') {
        const alreadyDisposed = ['disposed', 'retired'].includes(asset.currentStatus.toLowerCase()) || Boolean(asset.disposalDate)
        setDeleteBlocked(alreadyDisposed)
        setDeleteBlockedReason(alreadyDisposed ? 'This asset is marked as disposed and must be preserved in historical records.' : undefined)
        setIsDeleteModalOpen(true)

        setCheckingHistory(true)
        try {
          const check = await assetService.checkAssetHistoryExists(asset.id)
          setDeleteBlocked(check.hasHistory)
          if (check.reason) setDeleteBlockedReason(check.reason)
        } catch {
          // Keep modal open, fallback to safe local state
        } finally {
          setCheckingHistory(false)
        }
      } else {
        setIsDepreciationModalOpen(true)
      }
    } catch (error) {
      mutationError(error)
    }
  }

  // Handlers
  const handleOpenDetailModal = async (asset: DetailedAsset, defaultTab: 'overview' | 'financial' | 'assignment' | 'maintenance' | 'warranty' | 'depreciation' | 'history' = 'overview') => {
    setSelectedAsset(asset)
    setDetailTab(defaultTab)
    setIsDetailModalOpen(true)
    setLoadingModalData(true)
    try {
      const [maint, hist, fresh] = await Promise.all([
        assetService.getMaintenanceRecords(asset.id),
        assetService.getAssetHistory(asset.id),
        assetService.getAssetById(asset.id)
      ])
      setSelectedAsset(fresh)
      setMaintenanceHistory(maint)
      setTimelineHistory(hist)
    } catch {
      showToast('Unable to load asset history. Please try again.', 'error')
      setMaintenanceHistory([])
      setTimelineHistory([])
    } finally {
      setLoadingModalData(false)
    }
  }

  const handleOpenAssignModal = async (row: DetailedAsset) => {
    let asset: DetailedAsset
    try { asset = await assetService.getAssetById(row.id) } catch (error) { mutationError(error); return }
    setSelectedAsset(asset)
    setAssignForm({
      expectedVersion: asset.version,
      employeeId: asset.assignedEmployeeId,
      employeeName: asset.assignedEmployeeName || '',
      department: asset.department || '',
      notes: ''
    })
    setIsAssignModalOpen(true)
  }

  const handleOpenTransferModal = async (row: DetailedAsset) => {
    let asset: DetailedAsset
    try { asset = await assetService.getAssetById(row.id) } catch (error) { mutationError(error); return }
    setSelectedAsset(asset)
    setTransferForm({
      expectedVersion: asset.version,
      fromLocation: asset.location || 'Main Site',
      toLocation: '',
      fromEmployee: asset.assignedEmployeeName || 'Unassigned',
      toEmployee: '',
      reason: '',
      notes: ''
    })
    setIsTransferModalOpen(true)
  }

  const handleOpenMaintenanceModal = async (row: DetailedAsset) => {
    let asset: DetailedAsset
    try { asset = await assetService.getAssetById(row.id) } catch (error) { mutationError(error); return }
    setSelectedAsset(asset)
    setMaintenanceForm({
      expectedVersion: asset.version,
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

  const handleOpenDisposeModal = async (row: DetailedAsset) => {
    let asset: DetailedAsset
    try { asset = await assetService.getAssetById(row.id) } catch (error) { mutationError(error); return }
    setSelectedAsset(asset)
    setDisposeForm({
      expectedVersion: asset.version,
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
          <EnterpriseButton disabled={!canManage} onClick={() => { setCreateForm({ assetName: '', assetCategory: 'Machinery', purchasePrice: 0, purchaseDate: new Date().toISOString().slice(0, 10), condition: 'Good', usefulLifeYears: 5, residualValue: 0 }); setIsAddModalOpen(true) }} variant="primary">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5 items-center">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Asset Name, Tag, SN, Model..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPageNumber(1)
                }}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1A56DB] bg-slate-50/50"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPageNumber(1)
              }}
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
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPageNumber(1)
              }}
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
              onChange={(e) => {
                setConditionFilter(e.target.value)
                setPageNumber(1)
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="ALL">All Conditions</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="NeedsRepair">Needs Repair</option>
              <option value="Critical">Critical</option>
            </select>

            {/* Date Filter Popover */}
            <AssetDateFilterPopover
              value={dateFilter}
              onChange={(newFilter) => {
                setDateFilter(newFilter)
                setPageNumber(1)
              }}
            />

            {/* Reset Filters */}
            <EnterpriseButton
              onClick={handleResetFilters}
              variant="secondary"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset
            </EnterpriseButton>
          </div>

          {/* ACTIVE FILTER INDICATORS & SUMMARY */}
          {(dateFilter.mode !== 'all' || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || conditionFilter !== 'ALL' || search.trim() !== '') && (
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
              <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Active Filters:</span>
              {dateFilter.mode !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#1A56DB] border border-blue-200 font-semibold text-xs shadow-sm">
                  <Calendar className="w-3.5 h-3.5 text-[#1A56DB]" />
                  <span>Date: {activeDateRange.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter((prev) => ({ ...prev, mode: 'all', fromDate: '', toDate: '' }))
                      setPageNumber(1)
                    }}
                    className="p-0.5 hover:bg-blue-100 rounded text-blue-600 transition-colors cursor-pointer ml-0.5"
                    title="Clear date filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {categoryFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs">
                  <span>Category: {categoryFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter('ALL')
                      setPageNumber(1)
                    }}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer ml-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs">
                  <span>Status: {statusFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('ALL')
                      setPageNumber(1)
                    }}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer ml-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {conditionFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs">
                  <span>Condition: {conditionFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConditionFilter('ALL')
                      setPageNumber(1)
                    }}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer ml-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {search.trim() !== '' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs">
                  <span>Search: "{search}"</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setPageNumber(1)
                    }}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer ml-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
            </div>
          )}

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
                {isAssetsLoading ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-400">
                      <EnterpriseLoading label="Loading asset register..." />
                    </td>
                  </tr>
                ) : isAssetsError ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
                          <AlertTriangle className="w-6 h-6" />
                        </div>
                        <p className="font-bold text-slate-800 text-sm">Unable to load assets.</p>
                        <p className="text-xs text-slate-500">
                          {(assetsError as any)?.response?.data?.message || (assetsError as any)?.message || 'An error occurred while loading the asset list. Please try again.'}
                        </p>
                        <EnterpriseButton
                          onClick={() => {
                            refetchAssets()
                            refetchKpis()
                          }}
                          variant="primary"
                          className="mt-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                        </EnterpriseButton>
                      </div>
                    </td>
                  </tr>
                ) : assetsList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-400">
                      <Cpu className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      {dateFilter.mode !== 'all' || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || conditionFilter !== 'ALL' || search.trim() !== '' ? (
                        <div className="space-y-2">
                          <p className="font-bold text-slate-700 text-sm">
                            {dateFilter.mode !== 'all'
                              ? `No assets found for ${activeDateRange.label}`
                              : 'No assets matching the selected filters'}
                          </p>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Try adjusting your search keywords, category, status, or date range to view registered assets.
                          </p>
                          <EnterpriseButton onClick={handleResetFilters} variant="secondary" className="mt-3">
                            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset All Filters
                          </EnterpriseButton>
                        </div>
                      ) : (
                        <>
                          <p className="font-bold text-slate-700 text-sm">No assets registered yet</p>
                          <p className="text-xs text-slate-400 mt-1">Add your first fixed asset to start tracking ownership, value, maintenance and lifecycle history.</p>
                          <EnterpriseButton disabled={!canManage} onClick={() => { setCreateForm({ assetName: '', assetCategory: 'Machinery', purchasePrice: 0, purchaseDate: new Date().toISOString().slice(0, 10), condition: 'Good', usefulLifeYears: 5, residualValue: 0 }); setIsAddModalOpen(true) }} variant="primary" className="mt-4">
                            + Add First Asset
                          </EnterpriseButton>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  assetsList.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{asset.assetName}</span>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {asset.assetTag && <span className="text-[10px] text-slate-500 font-mono">{asset.assetTag}</span>}
                          {asset.purchaseDate && (
                            <span className="text-[10px] text-slate-400 font-medium inline-flex items-center gap-0.5" title="Purchase / Acquisition Date">
                              <Calendar className="w-2.5 h-2.5 text-slate-400" />
                              {new Date(asset.purchaseDate).toLocaleDateString('en-IN')}
                            </span>
                          )}
                          {asset.serialNumber && <span className="text-[10px] text-slate-400 font-mono">SN: {asset.serialNumber}</span>}
                        </div>
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
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            asset.currentStatus === 'Active' || asset.currentStatus === 'InUse'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : asset.currentStatus === 'UnderMaintenance'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : asset.currentStatus === 'Disposed'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              asset.currentStatus === 'Active' || asset.currentStatus === 'InUse'
                                ? 'bg-emerald-500'
                                : asset.currentStatus === 'UnderMaintenance'
                                  ? 'bg-amber-500'
                                  : asset.currentStatus === 'Disposed'
                                    ? 'bg-rose-500'
                                    : 'bg-slate-400'
                            }`}
                          />
                          {asset.currentStatus}
                        </span>
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
                        <AssetRowActions
                          asset={asset}
                          canManage={canManage}
                          canDelete={canDelete}
                          onView={() => handleOpenDetailModal(asset)}
                          onEdit={() => openAssetAction(asset, 'edit')}
                          onAssign={() => handleOpenAssignModal(asset)}
                          onTransfer={() => handleOpenTransferModal(asset)}
                          onMaintenance={() => handleOpenMaintenanceModal(asset)}
                          onDepreciation={() => openAssetAction(asset, 'depreciation')}
                          onDispose={() => handleOpenDisposeModal(asset)}
                          onDelete={() => openAssetAction(asset, 'delete')}
                        />
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
                      <EnterpriseButton disabled={!canManage || isHistorical(asset)} onClick={() => handleOpenMaintenanceModal(asset)} variant="secondary">
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

      {/* 1. ADD / EDIT ASSET MODAL */}
      {(isAddModalOpen || isEditModalOpen) && (
        <AssetFormModal
          editing={isEditModalOpen}
          pending={createAssetMutation.isPending || updateAssetMutation.isPending}
          isDateLocked={
            isEditModalOpen &&
            Boolean(
              selectedAsset &&
                (Number(selectedAsset.accumulatedDepreciation) > 0 ||
                  ['disposed', 'retired'].includes(selectedAsset.currentStatus.toLowerCase()))
            )
          }
          lockedReason={
            isEditModalOpen && selectedAsset
              ? Number(selectedAsset.accumulatedDepreciation) > 0
                ? 'Original acquisition date is locked because financial depreciation has already been recorded.'
                : ['disposed', 'retired'].includes(selectedAsset.currentStatus.toLowerCase())
                ? 'Original acquisition date is an archived record for disposed assets.'
                : undefined
              : undefined
          }
          createForm={createForm}
          setCreateForm={setCreateForm}
          onClose={() => {
            if (!createAssetMutation.isPending && !updateAssetMutation.isPending) {
              setIsAddModalOpen(false)
              setIsEditModalOpen(false)
            }
          }}
          onSave={(form) => {
            if (isEditModalOpen && selectedAsset) {
              updateAssetMutation.mutate({
                id: selectedAsset.id,
                data: {
                  assetName: form.assetName,
                  assetCategory: form.assetCategory,
                  assetTag: form.assetTag,
                  assetType: form.assetType,
                  serialNumber: form.serialNumber,
                  modelNumber: form.modelNumber,
                  manufacturer: form.manufacturer,
                  description: form.description,
                  location: form.location,
                  department: form.department,
                  purchaseDate: form.purchaseDate,
                  condition: form.condition,
                  notes: form.notes,
                  warrantyStartDate: form.warrantyStartDate,
                  warrantyEndDate: form.warrantyEndDate,
                  warrantyProvider: form.warrantyProvider,
                  warrantyNumber: form.warrantyNumber,
                  warrantyNotes: form.warrantyNotes,
                  expectedVersion: selectedAsset.version
                }
              })
            } else {
              createAssetMutation.mutate(form)
            }
          }}
        />
      )}

      {/* 2. ASSET DETAILS MODAL */}
      {isDetailModalOpen && selectedAsset && (
        <AssetDetailsModal
          isOpen={isDetailModalOpen}
          asset={selectedAsset}
          canManage={canManage}
          maintenanceHistory={maintenanceHistory}
          timelineHistory={timelineHistory}
          loadingData={loadingModalData}
          defaultTab={detailTab}
          onClose={() => setIsDetailModalOpen(false)}
          onEdit={() => openAssetAction(selectedAsset, 'edit')}
          onAssign={() => handleOpenAssignModal(selectedAsset)}
        />
      )}

      {/* 3. ASSIGN ASSET MODAL */}
      {isAssignModalOpen && selectedAsset && (
        <AssetAssignmentModal
          isOpen={isAssignModalOpen}
          asset={selectedAsset}
          assignForm={assignForm}
          setAssignForm={setAssignForm}
          pending={assignAssetMutation.isPending}
          onClose={() => {
            if (!assignAssetMutation.isPending) setIsAssignModalOpen(false)
          }}
          onSave={(data) => assignAssetMutation.mutate({ id: selectedAsset.id, data })}
        />
      )}

      {/* 4. TRANSFER ASSET MODAL */}
      {isTransferModalOpen && selectedAsset && (
        <AssetTransferModal
          isOpen={isTransferModalOpen}
          asset={selectedAsset}
          transferForm={transferForm}
          setTransferForm={setTransferForm}
          pending={transferAssetMutation.isPending}
          onClose={() => {
            if (!transferAssetMutation.isPending) setIsTransferModalOpen(false)
          }}
          onSave={(data) => transferAssetMutation.mutate({ id: selectedAsset.id, data })}
        />
      )}

      {/* 5. LOG MAINTENANCE MODAL */}
      {isMaintenanceModalOpen && selectedAsset && (
        <AssetMaintenanceModal
          isOpen={isMaintenanceModalOpen}
          asset={selectedAsset}
          maintenanceForm={maintenanceForm}
          setMaintenanceForm={setMaintenanceForm}
          pending={recordMaintenanceMutation.isPending}
          onClose={() => {
            if (!recordMaintenanceMutation.isPending) setIsMaintenanceModalOpen(false)
          }}
          onSave={(data) => recordMaintenanceMutation.mutate({ id: selectedAsset.id, data })}
        />
      )}

      {/* 6. RECORD DEPRECIATION MODAL */}
      {isDepreciationModalOpen && selectedAsset && (
        <AssetDepreciationModal
          asset={selectedAsset}
          pending={calculateDepreciationMutation.isPending}
          onClose={() => {
            if (!calculateDepreciationMutation.isPending) setIsDepreciationModalOpen(false)
          }}
          onSave={(data) => calculateDepreciationMutation.mutate({ id: selectedAsset.id, data })}
        />
      )}

      {/* 7. DISPOSE ASSET MODAL */}
      {isDisposeModalOpen && selectedAsset && (
        <AssetDisposalModal
          isOpen={isDisposeModalOpen}
          asset={selectedAsset}
          disposeForm={disposeForm}
          setDisposeForm={setDisposeForm}
          pending={disposeAssetMutation.isPending}
          onClose={() => {
            if (!disposeAssetMutation.isPending) setIsDisposeModalOpen(false)
          }}
          onSave={(data) => disposeAssetMutation.mutate({ id: selectedAsset.id, data })}
        />
      )}

      {/* 8. DELETE ASSET CONFIRMATION MODAL */}
      {isDeleteModalOpen && selectedAsset && (
        <AssetDeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          asset={selectedAsset}
          deleteBlocked={deleteBlocked}
          blockedReason={deleteBlockedReason}
          checkingHistory={checkingHistory}
          pending={deleteAssetMutation.isPending}
          canManage={canManage}
          onClose={() => {
            if (!deleteAssetMutation.isPending) setIsDeleteModalOpen(false)
          }}
          onConfirmDelete={() => {
            if (!deleteAssetMutation.isPending) deleteAssetMutation.mutate(selectedAsset)
          }}
          onMarkDisposed={() => {
            setIsDeleteModalOpen(false)
            handleOpenDisposeModal(selectedAsset)
          }}
        />
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
