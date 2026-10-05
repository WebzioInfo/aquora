import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
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
import { productsService } from '../../../services/products'
import { rawMaterialsService } from '../../../services/rawMaterials'
import { useAuthStore } from '../../../store/useAuthStore'
import { showToast } from '../../../utils/toast'

// UI components matching Ledger page
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import { Plus, Upload, Download, Edit, X } from 'lucide-react'

// Asset modular subcomponents matching Ledger styling
import { AssetTabs, type AssetTabKey } from './assets/AssetTabs'
import { AssetLedgerKpiRow } from './assets/AssetLedgerKpiRow'
import { AssetRegisterFilterBar } from './assets/AssetRegisterFilterBar'
import { AssetBulkBar } from './assets/AssetBulkBar'
import { AssetRegisterTable } from './assets/AssetRegisterTable'
import { AssetDetailDrawer } from './assets/AssetDetailDrawer'
import { StockValuationTab } from './assets/StockValuationTab'
import { MaintenanceWarrantyTab } from './assets/MaintenanceWarrantyTab'
import { ReportsTab } from './assets/ReportsTab'
import { ImportAssetsModal } from './assets/ImportAssetsModal'
import { formatINR } from './assets/assetHelpers'

// Modals
import AssetFormModal from './components/AssetFormModal'
import AssetAssignmentModal from './components/AssetAssignmentModal'
import AssetTransferModal from './components/AssetTransferModal'
import AssetMaintenanceModal from './components/AssetMaintenanceModal'
import AssetDepreciationModal from './components/AssetDepreciationModal'
import AssetDisposalModal from './components/AssetDisposalModal'
import AssetDeleteConfirmationModal from './components/AssetDeleteConfirmationModal'

export const AssetSummaryPage: React.FC = () => {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const canManage =
    user?.roles.some((role) =>
      ['SuperAdmin', 'CompanyOwner', 'CompanyAdmin', 'Accountant', 'Admin', 'Owner'].includes(role)
    ) ?? false
  const canDelete =
    user?.roles.some((role) =>
      ['SuperAdmin', 'CompanyOwner', 'CompanyAdmin', 'Admin', 'Owner'].includes(role)
    ) ?? false

  // URL search params sync
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = (searchParams.get('tab') as AssetTabKey) || 'register'
  const validTabs: AssetTabKey[] = ['register', 'stock', 'maintenance', 'reports']
  const activeTab: AssetTabKey = validTabs.includes(tabParam) ? tabParam : 'register'

  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const pageNumber = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const limitParam = parseInt(
    searchParams.get('limit') || localStorage.getItem('aquora_assets_page_size') || '25',
    10
  )
  const [pageSize, setPageSize] = useState<number>(() => {
    const validSizes = [10, 25, 50, 100]
    return validSizes.includes(limitParam) ? limitParam : 25
  })

  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'ALL')
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || 'ALL')
  const [conditionFilter, setConditionFilter] = useState(() => searchParams.get('condition') || 'ALL')
  const [datePreset, setDatePreset] = useState(() => searchParams.get('datePreset') || 'all')
  const [fromDate, setFromDate] = useState(() => searchParams.get('fromDate') || '')
  const [toDate, setToDate] = useState(() => searchParams.get('toDate') || '')

  // Update URL search parameters
  const updateQueryParams = (updates: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined || val === '') {
        next.delete(key)
      } else {
        next.set(key, val)
      }
    })
    setSearchParams(next, { replace: true })
  }

  const handleTabChange = (newTab: AssetTabKey) => {
    setSelectedIds(new Set())
    updateQueryParams({ tab: newTab, page: '1' })
  }

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus)
    setSelectedIds(new Set())
    updateQueryParams({ status: newStatus === 'ALL' ? null : newStatus, page: '1' })
  }

  const handleCategoryChange = (newCat: string) => {
    setCategoryFilter(newCat)
    setSelectedIds(new Set())
    updateQueryParams({ category: newCat === 'ALL' ? null : newCat, page: '1' })
  }

  const handleConditionChange = (newCond: string) => {
    setConditionFilter(newCond)
    setSelectedIds(new Set())
    updateQueryParams({ condition: newCond === 'ALL' ? null : newCond, page: '1' })
  }

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset)
    setSelectedIds(new Set())
    const now = new Date()
    const toYMD = (d: Date) => d.toISOString().split('T')[0]

    if (preset === 'today') {
      const todayStr = toYMD(now)
      setFromDate(todayStr)
      setToDate(todayStr)
      updateQueryParams({ datePreset: preset, fromDate: todayStr, toDate: todayStr, page: '1' })
    } else if (preset === 'month') {
      const firstDay = toYMD(new Date(now.getFullYear(), now.getMonth(), 1))
      const lastDay = toYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0))
      setFromDate(firstDay)
      setToDate(lastDay)
      updateQueryParams({ datePreset: preset, fromDate: firstDay, toDate: lastDay, page: '1' })
    } else if (preset === 'year') {
      const firstDay = toYMD(new Date(now.getFullYear(), 0, 1))
      const lastDay = toYMD(new Date(now.getFullYear(), 11, 31))
      setFromDate(firstDay)
      setToDate(lastDay)
      updateQueryParams({ datePreset: preset, fromDate: firstDay, toDate: lastDay, page: '1' })
    } else if (preset === 'custom') {
      updateQueryParams({ datePreset: preset, page: '1' })
    } else {
      setFromDate('')
      setToDate('')
      updateQueryParams({ datePreset: null, fromDate: null, toDate: null, page: '1' })
    }
  }

  const handleCustomDateChange = (from: string, to: string) => {
    setFromDate(from)
    setToDate(to)
    updateQueryParams({ datePreset: 'custom', fromDate: from || null, toDate: to || null, page: '1' })
  }

  const handleSearchChange = (query: string) => {
    setSearch(query)
    setSelectedIds(new Set())
    updateQueryParams({ search: query || null, page: '1' })
  }

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('ALL')
    setCategoryFilter('ALL')
    setConditionFilter('ALL')
    setDatePreset('all')
    setFromDate('')
    setToDate('')
    setSelectedIds(new Set())
    updateQueryParams({
      search: null,
      status: null,
      category: null,
      condition: null,
      datePreset: null,
      fromDate: null,
      toDate: null,
      page: '1'
    })
  }

  const handlePageChange = (newPage: number) => {
    setSelectedIds(new Set())
    updateQueryParams({ page: newPage.toString() })
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    localStorage.setItem('aquora_assets_page_size', newSize.toString())
    setSelectedIds(new Set())
    updateQueryParams({ limit: newSize.toString(), page: '1' })
  }

  // Selection & Bulk state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Modals & Drawer State
  const [selectedAsset, setSelectedAsset] = useState<DetailedAsset | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false)
  const [isDepreciationModalOpen, setIsDepreciationModalOpen] = useState(false)
  const [isDisposeModalOpen, setIsDisposeModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // Delete safety checks
  const [deleteBlocked, setDeleteBlocked] = useState(false)
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | undefined>(undefined)
  const [checkingHistory, setCheckingHistory] = useState(false)

  // Drawer extra details
  const [maintenanceHistory, setMaintenanceHistory] = useState<AssetMaintenanceRecord[]>([])
  const [timelineHistory, setTimelineHistory] = useState<
    Array<{ id: string; date: string; action: string; performedBy: string; remarks?: string }>
  >([])

  // Forms state
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

  // Stock valuation unit price editing modal
  const [editingPriceItem, setEditingPriceItem] = useState<{
    type: 'product' | 'rawMaterial'
    id: string
    name: string
    currentPrice: number
  } | null>(null)
  const [newUnitPriceInput, setNewUnitPriceInput] = useState<string>('')
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false)

  // Invalidation & Mutation error handler
  const refreshAssets = () => {
    queryClient.invalidateQueries({ queryKey: ['assetsList'] })
    queryClient.invalidateQueries({ queryKey: ['assetKpis'] })
  }

  const mutationError = (error: unknown) => {
    if (isAxiosError<{ code?: string; message?: string }>(error)) {
      const msg = error.response?.data?.message
      const code = error.response?.data?.code
      if (
        code === 'AssetHistoryExists' ||
        msg === 'AssetHistoryExists' ||
        msg?.toLowerCase().includes('assethistoryexists')
      ) {
        showToast(
          'This asset contains historical records and cannot be permanently deleted. Mark it as Disposed instead.',
          'warning'
        )
        return
      }
      showToast(msg || 'Unable to complete asset request. Please try again.', 'error')
      return
    }
    showToast('Unable to complete asset request. Please try again.', 'error')
  }

  // Queries
  const {
    data: pagedAssets,
    isLoading: isAssetsLoading
  } = useQuery({
    queryKey: [
      'assetsList',
      pageNumber,
      pageSize,
      search,
      categoryFilter,
      statusFilter,
      conditionFilter,
      fromDate,
      toDate
    ],
    queryFn: () =>
      assetService.getAssets(
        pageNumber,
        pageSize,
        search,
        categoryFilter,
        statusFilter,
        conditionFilter,
        undefined,
        undefined,
        fromDate || undefined,
        toDate || undefined
      )
  })

  const {
    data: fallbackKpis,
    isLoading: isKpisLoading
  } = useQuery({
    queryKey: [
      'assetKpis',
      search,
      categoryFilter,
      statusFilter,
      conditionFilter,
      fromDate,
      toDate
    ],
    queryFn: () =>
      assetService.getKpis(
        search,
        categoryFilter,
        statusFilter,
        conditionFilter,
        undefined,
        undefined,
        fromDate || undefined,
        toDate || undefined
      )
  })

  const kpis: AssetKpiSummary | undefined = pagedAssets?.summary ?? fallbackKpis

  // Finished Goods & Raw Materials for Stock Valuation
  const { data: products = [], isLoading: isProductsLoading } = useQuery({
    queryKey: ['productsListAssetPage'],
    queryFn: async () => {
      const res = await productsService.getProducts(1, 100, '')
      return res.data?.items || []
    }
  })

  const { data: rawMaterials = [], isLoading: isRawMaterialsLoading } = useQuery({
    queryKey: ['rawMaterialsListAssetPage'],
    queryFn: async () => {
      const res = await rawMaterialsService.getRawMaterials(1, 100, '')
      return res.data?.items || []
    }
  })

  // Stock Metrics for KPI row
  const stockMetrics = useMemo(() => {
    const finishedVal = products.reduce((sum, p) => {
      const price = Number(p.sellingPrice || p.costPrice || 15.0)
      return sum + (Number(p.currentStock) || 0) * price
    }, 0)

    const rawVal = rawMaterials.reduce((sum, rm) => {
      const cost = Number(rm.costPerUnit || 5.0)
      return sum + (Number(rm.currentStock) || 0) * cost
    }, 0)

    return {
      totalValue: finishedVal + rawVal,
      finishedGoodsValue: finishedVal,
      rawMaterialsValue: rawVal,
      itemsCount: products.length + rawMaterials.length,
      productsCount: products.length,
      rawMaterialsCount: rawMaterials.length
    }
  }, [products, rawMaterials])

  // Maintenance Metrics for KPI row
  const assetsList = pagedAssets?.items || []

  const maintenanceMetrics = useMemo(() => {
    const now = new Date()
    let overdueCount = 0
    let due30DaysCount = 0
    let underMaintenanceCount = 0
    let warrantyExpiringCount = 0

    assetsList.forEach((a) => {
      const nextMaint = a.nextMaintenanceDate ? new Date(a.nextMaintenanceDate) : null
      const warrantyEnd = a.warrantyEndDate ? new Date(a.warrantyEndDate) : null

      if (nextMaint && nextMaint < now) overdueCount++
      if (nextMaint && nextMaint >= now && (nextMaint.getTime() - now.getTime()) <= 30 * 86400000) due30DaysCount++
      if ((a.currentStatus || '').toLowerCase().includes('maintenance')) underMaintenanceCount++
      if (warrantyEnd && warrantyEnd >= now && (warrantyEnd.getTime() - now.getTime()) <= 60 * 86400000) warrantyExpiringCount++
    })

    return {
      overdueCount,
      due30DaysCount,
      underMaintenanceCount,
      warrantyExpiringCount
    }
  }, [assetsList])

  // Dynamic categories query from database
  const { data: dbCategories = [] } = useQuery({
    queryKey: ['assetCategories'],
    queryFn: () => assetService.getAssetCategories(false)
  })

  // Dynamic Categories list for filter bar (value = code, label = name)
  const categoriesList = useMemo(() => {
    if (dbCategories.length > 0) {
      return dbCategories.map(c => ({
        value: c.code,
        label: c.name
      }))
    }
    return [
      { value: 'Machinery', label: 'Machinery & Equipment' },
      { value: 'Vehicles', label: 'Vehicles & Transport' },
      { value: 'Computers', label: 'Computers & Laptops' },
      { value: 'Printers', label: 'Printers & Scanners' },
      { value: 'Furniture', label: 'Furniture & Fixtures' },
      { value: 'Office Equipment', label: 'Office Equipment' },
      { value: 'Buildings', label: 'Buildings & Infrastructure' },
      { value: 'Other', label: 'Other Capital Assets' }
    ]
  }, [dbCategories])

  // Mutations
  const createAssetMutation = useMutation({
    mutationFn: (data: CreateAssetInput) => assetService.createAsset(data),
    onSuccess: () => {
      refreshAssets()
      setIsAddModalOpen(false)
      showToast('Asset registered successfully', 'success')
    },
    onError: mutationError
  })

  const updateAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAssetInput }) =>
      assetService.updateAsset(id, data),
    onSuccess: (updated) => {
      refreshAssets()
      setIsEditModalOpen(false)
      if (selectedAsset?.id === updated.id) {
        setSelectedAsset(updated)
      }
      showToast('Asset updated successfully', 'success')
    },
    onError: mutationError
  })

  const assignAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignAssetInput }) =>
      assetService.assignAsset(id, data),
    onSuccess: (updated) => {
      refreshAssets()
      setIsAssignModalOpen(false)
      if (selectedAsset?.id === updated.id) {
        setSelectedAsset(updated)
      }
      showToast('Asset assignment updated', 'success')
    },
    onError: mutationError
  })

  const transferAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransferAssetInput }) =>
      assetService.transferAsset(id, data),
    onSuccess: (updated) => {
      refreshAssets()
      setIsTransferModalOpen(false)
      if (selectedAsset?.id === updated.id) {
        setSelectedAsset(updated)
      }
      showToast('Asset transfer logged successfully', 'success')
    },
    onError: mutationError
  })

  const recordMaintenanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecordMaintenanceInput }) =>
      assetService.recordMaintenance(id, data),
    onSuccess: async (_, variables) => {
      refreshAssets()
      setIsMaintenanceModalOpen(false)
      if (selectedAsset?.id === variables.id) {
        try {
          const fresh = await assetService.getAssetById(variables.id)
          setSelectedAsset(fresh)
        } catch {
          // ignore
        }
      }
      showToast('Maintenance record logged successfully', 'success')
    },
    onError: mutationError
  })

  const calculateDepreciationMutation = useMutation({
    mutationFn: ({
      id,
      data
    }: {
      id: string
      data: import('../../../services/assets').DepreciateAssetInput
    }) => assetService.calculateDepreciation(id, data),
    onSuccess: (updated) => {
      refreshAssets()
      setIsDepreciationModalOpen(false)
      if (selectedAsset?.id === updated.id) {
        setSelectedAsset(updated)
      }
      showToast('Depreciation applied', 'success')
    },
    onError: mutationError
  })

  const disposeAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DisposeAssetInput }) =>
      assetService.disposeAsset(id, data),
    onSuccess: (updated) => {
      refreshAssets()
      setIsDisposeModalOpen(false)
      if (selectedAsset?.id === updated.id) {
        setSelectedAsset(updated)
      }
      showToast('Asset marked as disposed', 'success')
    },
    onError: mutationError
  })

  const deleteAssetMutation = useMutation({
    mutationFn: (asset: DetailedAsset) => assetService.deleteAsset(asset.id, asset.version),
    onSuccess: () => {
      refreshAssets()
      setIsDeleteModalOpen(false)
      setIsDetailDrawerOpen(false)
      setSelectedAsset(null)
      showToast('Asset permanently deleted', 'success')
    },
    onError: (error: unknown) => {
      refreshAssets()
      if (isAxiosError<{ code?: string; message?: string }>(error)) {
        const errData = error.response?.data
        const code = errData?.code
        const msg = errData?.message || ''
        if (
          code === 'AssetHistoryExists' ||
          msg.includes('historical records') ||
          msg.toLowerCase().includes('assethistoryexists')
        ) {
          setDeleteBlocked(true)
          setDeleteBlockedReason(
            msg.includes('historical records')
              ? msg
              : 'This asset contains historical records and cannot be permanently deleted. Mark it as Disposed instead.'
          )
          showToast(
            'This asset contains historical records and cannot be permanently deleted. Mark it as Disposed instead.',
            'warning'
          )
          return
        }
      }
      mutationError(error)
    }
  })

  // Action Launchers
  const handleOpenDetail = async (asset: DetailedAsset) => {
    setSelectedAsset(asset)
    setIsDetailDrawerOpen(true)
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
      setMaintenanceHistory([])
      setTimelineHistory([])
    }
  }

  const handleOpenEdit = async (asset: DetailedAsset) => {
    try {
      const fresh = await assetService.getAssetById(asset.id)
      setSelectedAsset(fresh)
      const { currentStatus: _status, ...fields } = fresh
      setCreateForm({ ...fields, purchaseDate: fields.purchaseDate.slice(0, 10) })
      setIsEditModalOpen(true)
    } catch (err) {
      mutationError(err)
    }
  }

  const handleOpenAssign = async (asset: DetailedAsset) => {
    try {
      const fresh = await assetService.getAssetById(asset.id)
      setSelectedAsset(fresh)
      setAssignForm({
        expectedVersion: fresh.version,
        employeeId: fresh.assignedEmployeeId,
        employeeName: fresh.assignedEmployeeName || '',
        department: fresh.department || '',
        notes: ''
      })
      setIsAssignModalOpen(true)
    } catch (err) {
      mutationError(err)
    }
  }

  const handleOpenMaintenance = async (asset: DetailedAsset) => {
    try {
      const fresh = await assetService.getAssetById(asset.id)
      setSelectedAsset(fresh)
      setMaintenanceForm({
        expectedVersion: fresh.version,
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
    } catch (err) {
      mutationError(err)
    }
  }

  const handleOpenDepreciation = async (asset: DetailedAsset) => {
    try {
      const fresh = await assetService.getAssetById(asset.id)
      setSelectedAsset(fresh)
      setIsDepreciationModalOpen(true)
    } catch (err) {
      mutationError(err)
    }
  }

  const handleOpenDispose = async (asset: DetailedAsset) => {
    try {
      const fresh = await assetService.getAssetById(asset.id)
      setSelectedAsset(fresh)
      setDisposeForm({
        expectedVersion: fresh.version,
        disposalMethod: 'Scrapped',
        reason: '',
        saleValue: 0,
        disposalCost: 0,
        buyerParty: '',
        notes: ''
      })
      setIsDisposeModalOpen(true)
    } catch (err) {
      mutationError(err)
    }
  }

  const handleOpenDelete = async (asset: DetailedAsset) => {
    try {
      const fresh = await assetService.getAssetById(asset.id)
      setSelectedAsset(fresh)
      const alreadyDisposed =
        ['disposed', 'retired'].includes(fresh.currentStatus.toLowerCase()) ||
        Boolean(fresh.disposalDate)
      setDeleteBlocked(alreadyDisposed)
      setDeleteBlockedReason(
        alreadyDisposed
          ? 'This asset is marked as disposed and must be preserved in historical accounting records.'
          : undefined
      )
      setIsDeleteModalOpen(true)

      setCheckingHistory(true)
      try {
        const check = await assetService.checkAssetHistoryExists(fresh.id)
        setDeleteBlocked(check.hasHistory)
        if (check.reason) setDeleteBlockedReason(check.reason)
      } catch {
        // Safe fallback
      } finally {
        setCheckingHistory(false)
      }
    } catch (err) {
      mutationError(err)
    }
  }

  // Stock valuation unit price handlers
  const handleOpenPriceModal = (
    type: 'product' | 'rawMaterial',
    id: string,
    name: string,
    currentPrice: number
  ) => {
    setEditingPriceItem({ type, id, name, currentPrice })
    setNewUnitPriceInput(currentPrice > 0 ? currentPrice.toString() : '')
  }

  const handleSavePrice = async () => {
    if (!editingPriceItem) return
    const parsedPrice = parseFloat(newUnitPriceInput)
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      showToast('Enter a valid non-negative unit price.', 'error')
      return
    }

    setIsUpdatingPrice(true)
    try {
      if (editingPriceItem.type === 'product') {
        const res = await productsService.updateUnitPrice(editingPriceItem.id, parsedPrice)
        if (res.success) {
          queryClient.invalidateQueries({ queryKey: ['productsListAssetPage'] })
          showToast('Unit price updated successfully', 'success')
          setEditingPriceItem(null)
        } else {
          showToast(res.message || 'Unable to update unit price', 'error')
        }
      } else {
        const res = await rawMaterialsService.updateUnitPrice(editingPriceItem.id, parsedPrice)
        if (res.success) {
          queryClient.invalidateQueries({ queryKey: ['rawMaterialsListAssetPage'] })
          showToast('Raw material cost updated successfully', 'success')
          setEditingPriceItem(null)
        } else {
          showToast(res.message || 'Unable to update cost per unit', 'error')
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Unable to update price right now', 'error')
    } finally {
      setIsUpdatingPrice(false)
    }
  }

  // Selection handlers
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleSelectAll = () => {
    if (assetsList.length === 0) return
    const allSelected = assetsList.every((a) => selectedIds.has(a.id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(assetsList.map((a) => a.id)))
    }
  }

  // Bulk actions calculations
  const totalSelectedBookValue = useMemo(() => {
    return assetsList
      .filter((a) => selectedIds.has(a.id))
      .reduce((sum, a) => sum + (Number(a.currentValue) || 0), 0)
  }, [assetsList, selectedIds])

  const handleExportSelectedCsv = () => {
    const selected = assetsList.filter((a) => selectedIds.has(a.id))
    if (selected.length === 0) return
    exportCsv(selected, `assets-selected-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const handleExportRegisterCsv = () => {
    if (assetsList.length === 0) {
      showToast('No assets available to export', 'warning')
      return
    }
    exportCsv(assetsList, `asset-register-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const exportCsv = (items: DetailedAsset[], filename: string) => {
    const headers = [
      'Asset ID',
      'Asset Tag',
      'Asset Name',
      'Category',
      'Serial Number',
      'Model Number',
      'Location',
      'Assigned To',
      'Purchase Date',
      'Capitalized Cost',
      'Book Value',
      'Status',
      'Condition'
    ]
    const rows = items.map((a) => [
      a.assetCode,
      a.assetTag,
      `"${a.assetName.replace(/"/g, '""')}"`,
      a.assetCategory,
      a.serialNumber || '',
      a.modelNumber || '',
      a.location || '',
      a.assignedEmployeeName || 'Unassigned',
      new Date(a.purchaseDate).toLocaleDateString('en-IN'),
      a.totalCapitalizedCost,
      a.currentValue,
      a.currentStatus,
      a.condition
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Asset register exported successfully', 'success')
  }

  const hasActiveFilters =
    search.trim() !== '' ||
    statusFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    conditionFilter !== 'ALL' ||
    datePreset !== 'all' ||
    Boolean(fromDate) ||
    Boolean(toDate)

  const totalPages = Math.max(1, Math.ceil((pagedAssets?.totalCount || 0) / pageSize))

  return (
    <div className="w-full flex flex-col space-y-3 text-left h-[calc(100vh-7rem)] min-h-[500px]">
      {/* 1. Header with Title & Action Controls (Identical to Ledger page) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2.5 border-b border-slate-200 select-none shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Asset Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-normal">
            Track, manage and maintain your company's fixed assets across their lifecycle
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <EnterpriseButton
            variant="secondary"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="!h-[32px] text-xs"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Import
          </EnterpriseButton>

          <EnterpriseButton
            variant="secondary"
            size="sm"
            onClick={handleExportRegisterCsv}
            className="!h-[32px] text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Export
          </EnterpriseButton>

          {canManage && (
            <EnterpriseButton
              variant="primary"
              size="sm"
              onClick={() => {
                setCreateForm({
                  assetName: '',
                  assetCategory: 'Machinery',
                  purchasePrice: 0,
                  purchaseDate: new Date().toISOString().slice(0, 10),
                  condition: 'Good',
                  usefulLifeYears: 5,
                  residualValue: 0
                })
                setIsAddModalOpen(true)
              }}
              className="!h-[32px] text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Asset
            </EnterpriseButton>
          )}
        </div>
      </div>

      {/* 2. Tabs: Underline style with count badges & URL persistence */}
      <div className="shrink-0">
        <AssetTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          totalAssetsCount={kpis?.totalAssetsCount || 0}
          attentionCount={
            (kpis?.underMaintenanceCount || 0) + (kpis?.warrantyExpiringCount || 0)
          }
        />
      </div>

      {/* 3. Primary KPI Cards Row (Every Tab has 4 equal cards in Ledger style) */}
      <AssetLedgerKpiRow
        tab={activeTab}
        kpis={kpis}
        loading={isAssetsLoading && isKpisLoading}
        stockMetrics={stockMetrics}
        maintenanceMetrics={maintenanceMetrics}
        reportsMetrics={{
          totalCapitalCost: kpis?.totalAssetValue || 0,
          totalBookValue: kpis?.currentBookValue || 0,
          totalDepreciation: kpis?.accumulatedDepreciation || 0,
          maintenanceSpend: assetsList.reduce(
            (sum, a) => sum + (Number(a.totalMaintenanceCost) || 0),
            0
          )
        }}
      />

      {/* 4. Tab Content Area */}
      {/* TAB 1: REGISTER */}
      {activeTab === 'register' && (
        <div className="flex-1 flex flex-col min-h-0 w-full space-y-3">
          {/* Single Rounded Container Filter Bar OR Bulk Action Bar */}
          {selectedIds.size > 0 ? (
            <AssetBulkBar
              selectedCount={selectedIds.size}
              totalSelectedBookValue={totalSelectedBookValue}
              onExport={handleExportSelectedCsv}
              onClear={() => setSelectedIds(new Set())}
              canManage={canManage}
            />
          ) : (
            <AssetRegisterFilterBar
              status={statusFilter}
              category={categoryFilter}
              condition={conditionFilter}
              datePreset={datePreset}
              fromDate={fromDate}
              toDate={toDate}
              search={search}
              categories={categoriesList}
              onStatusChange={handleStatusChange}
              onCategoryChange={handleCategoryChange}
              onConditionChange={handleConditionChange}
              onDatePresetChange={handleDatePresetChange}
              onCustomDateChange={handleCustomDateChange}
              onSearchChange={handleSearchChange}
              onClearFilters={handleClearFilters}
              hasActiveFilters={hasActiveFilters}
            />
          )}

          {/* Table Shell with sticky header and Ledger pagination */}
          <AssetRegisterTable
            assets={assetsList}
            loading={isAssetsLoading}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onRowClick={handleOpenDetail}
            onView={handleOpenDetail}
            onEdit={handleOpenEdit}
            onAssign={handleOpenAssign}
            onMaintenance={handleOpenMaintenance}
            onDepreciation={handleOpenDepreciation}
            onDispose={handleOpenDispose}
            onDelete={handleOpenDelete}
            canManage={canManage}
            canDelete={canDelete}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            onAddAsset={() => {
              setCreateForm({
                assetName: '',
                assetCategory: 'Machinery',
                purchasePrice: 0,
                purchaseDate: new Date().toISOString().slice(0, 10),
                condition: 'Good',
                usefulLifeYears: 5,
                residualValue: 0
              })
              setIsAddModalOpen(true)
            }}
            page={pageNumber}
            pageSize={pageSize}
            totalCount={pagedAssets?.totalCount || 0}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            filteredCostTotal={kpis?.totalAssetValue || 0}
            filteredBookValueTotal={kpis?.currentBookValue || 0}
          />
        </div>
      )}

      {/* TAB 2: STOCK VALUATION */}
      {activeTab === 'stock' && (
        <StockValuationTab
          products={products}
          rawMaterials={rawMaterials}
          loading={isProductsLoading || isRawMaterialsLoading}
          onEditPrice={handleOpenPriceModal}
          canManage={canManage}
        />
      )}

      {/* TAB 3: MAINTENANCE AND WARRANTY */}
      {activeTab === 'maintenance' && (
        <MaintenanceWarrantyTab
          assets={assetsList}
          loading={isAssetsLoading}
          onLogMaintenance={handleOpenMaintenance}
          onViewAsset={handleOpenDetail}
          canManage={canManage}
          page={pageNumber}
          pageSize={pageSize}
          totalCount={pagedAssets?.totalCount || 0}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* TAB 4: REPORTS */}
      {activeTab === 'reports' && (
        <ReportsTab onExportRegisterCsv={handleExportRegisterCsv} />
      )}

      {/* ASSET DETAIL DRAWER */}
      <AssetDetailDrawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        asset={selectedAsset}
        assetsList={assetsList}
        onSelectAsset={(a) => handleOpenDetail(a)}
        onEdit={(a) => {
          setIsDetailDrawerOpen(false)
          handleOpenEdit(a)
        }}
        onAssign={(a) => {
          setIsDetailDrawerOpen(false)
          handleOpenAssign(a)
        }}
        onMaintenance={(a) => {
          setIsDetailDrawerOpen(false)
          handleOpenMaintenance(a)
        }}
        onDispose={(a) => {
          setIsDetailDrawerOpen(false)
          handleOpenDispose(a)
        }}
        maintenanceHistory={maintenanceHistory}
        timelineHistory={timelineHistory}
        canManage={canManage}
      />

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

      {/* 2. ASSIGN ASSET MODAL */}
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

      {/* 3. TRANSFER ASSET MODAL */}
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

      {/* 4. MAINTENANCE MODAL */}
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

      {/* 5. RECORD DEPRECIATION MODAL */}
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

      {/* 6. DISPOSE ASSET MODAL */}
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

      {/* 7. DELETE CONFIRMATION MODAL */}
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
            handleOpenDispose(selectedAsset)
          }}
        />
      )}

      {/* 8. IMPORT ASSETS MODAL */}
      <ImportAssetsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => refreshAssets()}
      />

      {/* 9. EDIT UNIT PRICE MODAL */}
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
                    {formatINR(editingPriceItem.currentPrice, true)}
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
