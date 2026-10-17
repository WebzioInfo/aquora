import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { productionShiftsService, type ProductionShift, calculateShiftDuration } from '../../services/productionShifts'
import { caseConfigurationsService, type CaseConfiguration } from '../../services/caseConfigurations'
import { productsService } from '../../services/products'
import { brandService, type BrandDto } from '../../services/brands'
import { getFriendlyError } from '../../utils/getFriendlyError'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'
import { isOwnerUser } from '../../utils/permissions'
import { PageContainer, PageHeader } from '../../components/ui/layout'
import EnterpriseModal from '../../components/ui/EnterpriseModal'
import EnterpriseInput from '../../components/ui/EnterpriseInput'
import EnterpriseButton from '../../components/ui/EnterpriseButton'
import EnterpriseLoading from '../../components/ui/EnterpriseLoading'
import EnterpriseNumberInput from '../../components/ui/EnterpriseNumberInput'
import { EnterpriseTimePicker } from '../../components/ui/EnterpriseTimePicker'
import { Sliders, Workflow, Clock, Plus, Edit2, Trash2, Power, Search, Package, Tag, RotateCw, AlertCircle } from 'lucide-react'

export const ProductionSetupPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()

  // Owner access guard
  useEffect(() => {
    if (isOwnerUser(user)) {
      navigate('/company/dashboard', { replace: true })
    }
  }, [user, navigate])

  // Tab State: 'lines' | 'shifts' | 'cases' | 'brands'
  const tabParam = searchParams.get('tab')
  const activeTab = (
    tabParam === 'shifts' ? 'shifts' :
    tabParam === 'cases' ? 'cases' :
    tabParam === 'brands' ? 'brands' : 'lines'
  ) as 'lines' | 'shifts' | 'cases' | 'brands'

  const setActiveTab = (tab: 'lines' | 'shifts' | 'cases' | 'brands') => {
    setSearchParams({ tab })
  }

  useEffect(() => {
    if (activeTab === 'brands') {
      document.title = 'Brands · Production Setup · Aquzio'
    } else {
      document.title = 'Production Setup · Aquzio'
    }
  }, [activeTab])

  // User Role Check
  const userRoles = (user?.roles || []).map((r: string) => r.toLowerCase().replace(/[\s_]/g, ''))
  const primaryRole = (user?.roleName || '').toLowerCase().replace(/[\s_]/g, '')
  const isOwner = isOwnerUser(user)
  const canManage = !isOwner && (
    !!user?.isPlatformAdmin ||
    userRoles.some((r: string) => ['companyadmin', 'accountant', 'admin', 'superadmin', 'platformadmin'].includes(r)) ||
    ['companyadmin', 'accountant', 'admin', 'superadmin', 'platformadmin'].includes(primaryRole)
  )

  // ─── TAB 1: PRODUCTION LINES DATA & MUTATIONS ────────────────────────────────
  const [lineSearch, setLineSearch] = useState('')
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false)
  const [isEditLineModalOpen, setIsEditLineModalOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<any | null>(null)

  const [lineName, setLineName] = useState('')
  const [lineCode, setLineCode] = useState('')
  const [lineIsActive, setLineIsActive] = useState(true)
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})

  // Queries
  const { data: productionLines = [], isLoading: linesLoading } = useQuery<any[]>({
    queryKey: ['productionLinesList'],
    queryFn: async () => (await api.get('/api/v1/production/lines?includeInactive=true')).data?.data || [],
    enabled: activeTab === 'lines'
  })

  // Line Mutations
  const createLineMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; isActive: boolean }) =>
      (await api.post('/api/v1/production/lines', data)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Line created successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionLinesList'] })
        setIsAddLineModalOpen(false)
        resetLineForm()
      } else {
        showToast(res.message || 'Failed to create Production Line.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to create Production Line.', 'error')
    }
  })

  const updateLineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; code: string; isActive: boolean } }) =>
      (await api.put(`/api/v1/production/lines/${id}`, data)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Line updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionLinesList'] })
        setIsEditLineModalOpen(false)
        setEditingLine(null)
        resetLineForm()
      } else {
        showToast(res.message || 'Failed to update Production Line.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update Production Line.', 'error')
    }
  })

  const deleteLineMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/v1/production/lines/${id}`)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Line deleted successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionLinesList'] })
      } else {
        showToast(res.message || 'Failed to delete Production Line.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to delete Production Line.', 'error')
    }
  })

  const resetLineForm = () => {
    setLineName('')
    setLineCode('')
    setLineIsActive(true)
    setLineErrors({})
  }

  const handleOpenAddLine = () => {
    resetLineForm()
    const nextNum = (productionLines.length || 0) + 1
    setLineName(`Line ${nextNum}`)
    setLineCode(`L${String(nextNum).padStart(3, '0')}`)
    setIsAddLineModalOpen(true)
  }

  const handleOpenEditLine = (line: any) => {
    setEditingLine(line)
    setLineName(line.name || '')
    setLineCode(line.code || '')
    setLineIsActive(line.isActive ?? true)
    setLineErrors({})
    setIsEditLineModalOpen(true)
  }

  const handleSaveLine = () => {
    const errs: Record<string, string> = {}
    if (!lineName.trim()) errs.name = 'Line Name is required.'
    if (!lineCode.trim()) errs.code = 'Line Code is required.'
    if (Object.keys(errs).length > 0) {
      setLineErrors(errs)
      return
    }

    if (editingLine) {
      updateLineMutation.mutate({
        id: editingLine.id || editingLine.lineId,
        data: { name: lineName.trim(), code: lineCode.trim(), isActive: lineIsActive }
      })
    } else {
      createLineMutation.mutate({
        name: lineName.trim(),
        code: lineCode.trim(),
        isActive: lineIsActive
      })
    }
  }

  const handleToggleLineStatus = (line: any) => {
    const lineId = line.id || line.lineId
    updateLineMutation.mutate({
      id: lineId,
      data: { name: line.name, code: line.code, isActive: !line.isActive }
    })
  }

  // ─── TAB 2: PRODUCTION SHIFTS DATA & MUTATIONS ───────────────────────────────
  const [shiftSearch, setShiftSearch] = useState('')
  const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false)
  const [isEditShiftModalOpen, setIsEditShiftModalOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<ProductionShift | null>(null)

  const [shiftName, setShiftName] = useState('')
  const [shiftStartTime, setShiftStartTime] = useState('06:00 AM')
  const [shiftEndTime, setShiftEndTime] = useState('02:00 PM')
  const [shiftDescription, setShiftDescription] = useState('')
  const [shiftIsActive, setShiftIsActive] = useState(true)
  const [shiftErrors, setShiftErrors] = useState<Record<string, string>>({})

  // Queries
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<ProductionShift[]>({
    queryKey: ['productionShifts'],
    queryFn: async () => {
      const res = await productionShiftsService.getAll()
      return res.data?.data || []
    },
    enabled: activeTab === 'shifts'
  })

  // Shift Mutations
  const createShiftMutation = useMutation({
    mutationFn: async (data: any) => (await productionShiftsService.create(data)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Shift created successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionShifts'] })
        setIsAddShiftModalOpen(false)
        resetShiftForm()
      } else {
        showToast(res.message || 'Failed to create Production Shift.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to create Production Shift.', 'error')
    }
  })

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      (await productionShiftsService.update(id, data)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Shift updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionShifts'] })
        setIsEditShiftModalOpen(false)
        setEditingShift(null)
        resetShiftForm()
      } else {
        showToast(res.message || 'Failed to update Production Shift.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update Production Shift.', 'error')
    }
  })

  const toggleShiftStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await productionShiftsService.patchStatus(id, isActive)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Shift status updated.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionShifts'] })
      } else {
        showToast(res.message || 'Failed to update shift status.', 'error')
      }
    }
  })

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => (await productionShiftsService.delete(id)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Shift deleted successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionShifts'] })
      } else {
        showToast(res.message || 'Failed to delete shift.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to delete shift.', 'error')
    }
  })

  const resetShiftForm = () => {
    setShiftName('')
    setShiftStartTime('06:00 AM')
    setShiftEndTime('02:00 PM')
    setShiftDescription('')
    setShiftIsActive(true)
    setShiftErrors({})
  }

  const handleOpenAddShift = () => {
    resetShiftForm()
    setIsAddShiftModalOpen(true)
  }

  const handleOpenEditShift = (shift: ProductionShift) => {
    setEditingShift(shift)
    setShiftName(shift.name)
    setShiftStartTime(shift.startTime)
    setShiftEndTime(shift.endTime)
    setShiftDescription(shift.description || '')
    setShiftIsActive(shift.isActive)
    setShiftErrors({})
    setIsEditShiftModalOpen(true)
  }

  const handleSaveShift = () => {
    const errs: Record<string, string> = {}
    if (!shiftName.trim()) errs.name = 'Shift Name is required.'
    if (!shiftStartTime.trim()) errs.startTime = 'Start Time is required.'
    if (!shiftEndTime.trim()) errs.endTime = 'End Time is required.'
    if (shiftStartTime === shiftEndTime) errs.endTime = 'End Time cannot equal Start Time.'

    if (Object.keys(errs).length > 0) {
      setShiftErrors(errs)
      return
    }

    const payload = {
      name: shiftName.trim(),
      startTime: shiftStartTime,
      endTime: shiftEndTime,
      description: shiftDescription.trim(),
      isActive: shiftIsActive
    }

    if (editingShift) {
      updateShiftMutation.mutate({ id: editingShift.id, data: payload })
    } else {
      createShiftMutation.mutate(payload)
    }
  }

  // Filtered Lists
  const filteredLines = productionLines.filter((l: any) =>
    (l.name || '').toLowerCase().includes(lineSearch.toLowerCase()) ||
    (l.code || '').toLowerCase().includes(lineSearch.toLowerCase())
  )

  const filteredShifts = shifts.filter((s: ProductionShift) =>
    (s.name || '').toLowerCase().includes(shiftSearch.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(shiftSearch.toLowerCase())
  )

  // ─── TAB 3: CASE CONFIGURATION DATA & MUTATIONS ─────────────────────────────
  const [caseConfigSearch, setCaseConfigSearch] = useState('')
  const [isAddCaseConfigModalOpen, setIsAddCaseConfigModalOpen] = useState(false)
  const [isEditCaseConfigModalOpen, setIsEditCaseConfigModalOpen] = useState(false)
  const [editingCaseConfig, setEditingCaseConfig] = useState<CaseConfiguration | null>(null)

  const [caseConfigProductId, setCaseConfigProductId] = useState('')
  const [caseConfigUnitsPerCase, setCaseConfigUnitsPerCase] = useState('24')
  const [caseConfigIsActive, setCaseConfigIsActive] = useState(true)
  const [caseConfigErrors, setCaseConfigErrors] = useState<Record<string, string>>({})

  // Queries
  const { data: caseConfigs = [], isLoading: caseConfigsLoading } = useQuery<CaseConfiguration[]>({
    queryKey: ['caseConfigurations'],
    queryFn: async () => {
      const res = await caseConfigurationsService.getAll()
      return res.data || []
    },
    enabled: activeTab === 'cases'
  })

  const { data: productsData } = useQuery({
    queryKey: ['productsForCaseConfig'],
    queryFn: async () => {
      const res = await productsService.getProducts(1, 200)
      return res.data?.items || []
    },
    enabled: isAddCaseConfigModalOpen || isEditCaseConfigModalOpen
  })
  const availableProducts = productsData || []

  // Case Config Mutations
  const createCaseConfigMutation = useMutation({
    mutationFn: async (data: { productId: string; unitsPerCase: number }) =>
      await caseConfigurationsService.create(data),
    onSuccess: (res) => {
      if (res.success) {
        showToast('Case Configuration created successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['caseConfigurations'] })
        setIsAddCaseConfigModalOpen(false)
        resetCaseConfigForm()
      } else {
        showToast(res.message || 'Failed to create Case Configuration.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to create Case Configuration.', 'error')
    }
  })

  const updateCaseConfigMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { productId?: string; unitsPerCase: number; isActive?: boolean } }) =>
      await caseConfigurationsService.update(id, data),
    onSuccess: (res) => {
      if (res.success) {
        showToast('Case Configuration updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['caseConfigurations'] })
        setIsEditCaseConfigModalOpen(false)
        setEditingCaseConfig(null)
        resetCaseConfigForm()
      } else {
        showToast(res.message || 'Failed to update Case Configuration.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update Case Configuration.', 'error')
    }
  })

  const deleteCaseConfigMutation = useMutation({
    mutationFn: async (id: string) => await caseConfigurationsService.delete(id),
    onSuccess: (res) => {
      if (res.success) {
        showToast('Case Configuration deactivated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['caseConfigurations'] })
      } else {
        showToast(res.message || 'Failed to deactivate Case Configuration.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to deactivate Case Configuration.', 'error')
    }
  })

  const resetCaseConfigForm = () => {
    setCaseConfigProductId('')
    setCaseConfigUnitsPerCase('24')
    setCaseConfigIsActive(true)
    setCaseConfigErrors({})
  }

  const handleOpenAddCaseConfig = () => {
    resetCaseConfigForm()
    setIsAddCaseConfigModalOpen(true)
  }

  const handleOpenEditCaseConfig = (config: CaseConfiguration) => {
    setEditingCaseConfig(config)
    setCaseConfigProductId(config.productId)
    setCaseConfigUnitsPerCase(config.unitsPerCase.toString())
    setCaseConfigIsActive(config.isActive)
    setCaseConfigErrors({})
    setIsEditCaseConfigModalOpen(true)
  }

  const handleSaveCaseConfig = () => {
    const errs: Record<string, string> = {}
    if (!caseConfigProductId && !editingCaseConfig) errs.productId = 'Product is required.'
    const units = parseInt(caseConfigUnitsPerCase, 10)
    if (isNaN(units) || units <= 0) errs.unitsPerCase = 'Units per case must be a positive integer greater than zero.'

    if (Object.keys(errs).length > 0) {
      setCaseConfigErrors(errs)
      return
    }

    if (editingCaseConfig) {
      updateCaseConfigMutation.mutate({
        id: editingCaseConfig.id,
        data: { unitsPerCase: units, isActive: caseConfigIsActive }
      })
    } else {
      createCaseConfigMutation.mutate({
        productId: caseConfigProductId,
        unitsPerCase: units
      })
    }
  }

  const filteredCaseConfigs = caseConfigs.filter((c: CaseConfiguration) =>
    (c.productName || '').toLowerCase().includes(caseConfigSearch.toLowerCase()) ||
    (c.productSku || '').toLowerCase().includes(caseConfigSearch.toLowerCase())
  )

  // ─── TAB 4: BRANDS DATA & MUTATIONS ──────────────────────────────────────
  const [brandsSearch, setBrandsSearch] = useState('')
  const [brandsPage, setBrandsPage] = useState(1)
  const [isAddBrandModalOpen, setIsAddBrandModalOpen] = useState(false)
  const [isEditBrandModalOpen, setIsEditBrandModalOpen] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<BrandDto | null>(null)

  const [brandFormName, setBrandFormName] = useState('')
  const [brandFormCode, setBrandFormCode] = useState('')
  const [brandFormDescription, setBrandFormDescription] = useState('')
  const [brandFormIsActive, setBrandFormIsActive] = useState(true)
  const [brandFormErrors, setBrandFormErrors] = useState<Record<string, string>>({})

  // Queries
  const {
    data: paginatedBrandsData,
    isLoading: brandsLoading,
    isError: brandsIsError,
    error: brandsError,
    refetch: refetchBrands
  } = useQuery({
    queryKey: ['brandsPaginated', brandsPage, brandsSearch],
    queryFn: async () => (await brandService.getBrands(brandsPage, 10, brandsSearch)).data,
    enabled: activeTab === 'brands'
  })

  // Fast count query for tab badge
  const { data: allBrandsCountData } = useQuery({
    queryKey: ['allBrandsCount'],
    queryFn: async () => (await brandService.getBrands(1, 1)).data?.totalCount ?? 0,
    staleTime: 30000
  })

  const totalBrandsCount = paginatedBrandsData?.totalCount ?? allBrandsCountData ?? 0

  // Mutations
  const createBrandMutation = useMutation({
    mutationFn: brandService.createBrand,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Brand created successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['brandsPaginated'] })
        queryClient.invalidateQueries({ queryKey: ['brandsDropdown'] })
        queryClient.invalidateQueries({ queryKey: ['allBrandsCount'] })
        queryClient.invalidateQueries({ queryKey: ['brands'] })
        setIsAddBrandModalOpen(false)
        resetBrandForm()
      } else {
        showToast(res.message || 'Failed to create brand.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(getFriendlyError(err).message, 'error')
    }
  })

  const updateBrandMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => brandService.updateBrand(id, data),
    onSuccess: (res) => {
      if (res.success) {
        showToast('Brand updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['brandsPaginated'] })
        queryClient.invalidateQueries({ queryKey: ['brandsDropdown'] })
        queryClient.invalidateQueries({ queryKey: ['brands'] })
        setIsEditBrandModalOpen(false)
        setSelectedBrand(null)
        resetBrandForm()
      } else {
        showToast(res.message || 'Failed to update brand.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(getFriendlyError(err).message, 'error')
    }
  })

  const deleteBrandMutation = useMutation({
    mutationFn: brandService.deleteBrand,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Brand deleted successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['brandsPaginated'] })
        queryClient.invalidateQueries({ queryKey: ['brandsDropdown'] })
        queryClient.invalidateQueries({ queryKey: ['allBrandsCount'] })
        queryClient.invalidateQueries({ queryKey: ['brands'] })
      } else {
        showToast(res.message || 'Failed to delete brand.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(getFriendlyError(err).message, 'error')
    }
  })

  const resetBrandForm = () => {
    setBrandFormName('')
    setBrandFormCode('')
    setBrandFormDescription('')
    setBrandFormIsActive(true)
    setBrandFormErrors({})
    setSelectedBrand(null)
  }

  const handleOpenAddBrand = () => {
    resetBrandForm()
    setIsAddBrandModalOpen(true)
  }

  const handleOpenEditBrand = (brand: BrandDto) => {
    setSelectedBrand(brand)
    setBrandFormName(brand.name)
    setBrandFormCode(brand.code || '')
    setBrandFormDescription(brand.description || '')
    setBrandFormIsActive(brand.isActive)
    setBrandFormErrors({})
    setIsEditBrandModalOpen(true)
  }

  const handleDeleteBrand = (brand: BrandDto) => {
    if (window.confirm(`Are you sure you want to delete brand "${brand.name}"?`)) {
      deleteBrandMutation.mutate(brand.id)
    }
  }

  const handleSaveBrand = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = brandFormName.trim()
    if (!trimmedName) {
      setBrandFormErrors({ name: 'Brand Name is required.' })
      return
    }

    if (selectedBrand) {
      updateBrandMutation.mutate({
        id: selectedBrand.id,
        data: {
          name: trimmedName,
          code: brandFormCode.trim() || undefined,
          description: brandFormDescription.trim() || undefined,
          isActive: brandFormIsActive
        }
      })
    } else {
      createBrandMutation.mutate({
        name: trimmedName,
        code: brandFormCode.trim() || undefined,
        description: brandFormDescription.trim() || undefined,
        isActive: brandFormIsActive
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <PageContainer>
      {/* ══ PAGE HEADER ═════════════════════════════════════════════════════════ */}
      <PageHeader
        title={activeTab === 'brands' ? 'Brands' : 'Production Setup'}
        badge={
          activeTab === 'brands' ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E6F6F4] text-[#0B7A70] border border-[#B8E6E0]">
              {totalBrandsCount} {totalBrandsCount === 1 ? 'brand' : 'brands'}
            </span>
          ) : undefined
        }
        description={
          activeTab === 'brands'
            ? 'Manage product brand registrations and codes.'
            : 'Manage production lines, operating shifts, and line status schedules.'
        }
        actions={
          canManage && (
            activeTab === 'lines' ? (
              <button
                type="button"
                onClick={handleOpenAddLine}
                className="h-9 px-4 bg-[#05303B] hover:bg-[#0A4352] active:bg-[#031F27] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Production Line</span>
              </button>
            ) : activeTab === 'shifts' ? (
              <button
                type="button"
                onClick={handleOpenAddShift}
                className="h-9 px-4 bg-[#05303B] hover:bg-[#0A4352] active:bg-[#031F27] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Production Shift</span>
              </button>
            ) : activeTab === 'cases' ? (
              <button
                type="button"
                onClick={handleOpenAddCaseConfig}
                className="h-9 px-4 bg-[#05303B] hover:bg-[#0A4352] active:bg-[#031F27] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Case Configuration</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAddBrand}
                className="h-9 px-4 bg-[#05303B] hover:bg-[#0A4352] active:bg-[#031F27] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Brand</span>
              </button>
            )
          )
        }
      />

      {/* ══ TAB SWITCHER & SEARCH BAR ════════════════════════════════════════ */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-2.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-md w-full sm:w-auto overflow-x-auto scrollbar-none" role="tablist">
          <button
            onClick={() => setActiveTab('lines')}
            role="tab"
            aria-selected={activeTab === 'lines'}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'lines'
                ? 'bg-white text-[#05303B] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>Production Lines</span>
            <span className="ml-1 text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full text-slate-700 font-extrabold">
              {productionLines.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('shifts')}
            role="tab"
            aria-selected={activeTab === 'shifts'}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'shifts'
                ? 'bg-white text-[#05303B] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Production Shifts</span>
            <span className="ml-1 text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full text-slate-700 font-extrabold">
              {shifts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cases')}
            role="tab"
            aria-selected={activeTab === 'cases'}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cases'
                ? 'bg-white text-[#05303B] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Case Configuration</span>
            <span className="ml-1 text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full text-slate-700 font-extrabold">
              {caseConfigs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('brands')}
            role="tab"
            aria-selected={activeTab === 'brands'}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'brands'
                ? 'bg-white text-[#05303B] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Brands</span>
            <span className="ml-1 text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full text-slate-700 font-extrabold">
              {totalBrandsCount}
            </span>
          </button>
        </div>

        {/* Search Filter & Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                activeTab === 'lines' ? "Search lines..." :
                activeTab === 'shifts' ? "Search shifts..." :
                activeTab === 'cases' ? "Search product / SKU..." :
                "Search brands..."
              }
              value={
                activeTab === 'lines' ? lineSearch :
                activeTab === 'shifts' ? shiftSearch :
                activeTab === 'cases' ? caseConfigSearch :
                brandsSearch
              }
              onChange={(e) => {
                const v = e.target.value
                if (activeTab === 'lines') setLineSearch(v)
                else if (activeTab === 'shifts') setShiftSearch(v)
                else if (activeTab === 'cases') setCaseConfigSearch(v)
                else {
                  setBrandsSearch(v)
                  setBrandsPage(1)
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#12A89A]"
            />
          </div>
          {activeTab === 'brands' && (
            <button
              type="button"
              onClick={() => refetchBrands()}
              title="Refresh brands list"
              className="h-[30px] px-2.5 text-xs font-semibold text-slate-600 hover:text-[#05303B] hover:bg-slate-100 rounded-md border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <RotateCw className={`w-3.5 h-3.5 ${brandsLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>

        {/* ══ TAB CONTENT AREA (SINGLE VIEW SCROLL-OPTIMIZED) ═══════════════════ */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-230px)]">

          {/* ────────────── TAB 1: PRODUCTION LINES ────────────── */}
          {activeTab === 'lines' && (
            linesLoading ? (
              <div className="p-8">
                <EnterpriseLoading label="Loading production lines..." />
              </div>
            ) : filteredLines.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Workflow className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No production lines found.</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {lineSearch ? "No lines match your search filter." : "Get started by adding your first production line to the system."}
                </p>
                {canManage && !lineSearch && (
                  <button
                    onClick={handleOpenAddLine}
                    className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Production Line
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 select-none">
                    <tr>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Line Name</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Code</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Status</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Current Batch</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Operator</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLines.map((line: any) => {
                      const lineId = line.id || line.lineId
                      const isActive = line.isActive ?? true
                      const activeBatch = line.activeBatch

                      return (
                        <tr key={lineId} className="hover:bg-slate-50/70 transition-colors">
                          {/* Line Name */}
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {line.name}
                          </td>

                          {/* Code */}
                          <td className="py-2.5 px-4">
                            <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {line.code || 'L001'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Current Batch */}
                          <td className="py-2.5 px-4">
                            {activeBatch ? (
                              <button
                                onClick={() => navigate(`/company/production/batches/${activeBatch.batchId || activeBatch.id}`)}
                                className="text-left group cursor-pointer"
                              >
                                <span className="font-bold text-blue-600 group-hover:underline block leading-tight">
                                  {activeBatch.batchNumber}
                                </span>
                                <span className="text-[10px] text-slate-500 block truncate">
                                  {activeBatch.product || 'Active Run'}
                                </span>
                              </button>
                            ) : (
                              <span className="text-slate-400 font-medium text-[11px]">Idle (No active batch)</span>
                            )}
                          </td>

                          {/* Operator */}
                          <td className="py-2.5 px-4 font-medium text-slate-700">
                            {activeBatch?.operatorName || '—'}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-right">
                            {canManage ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEditLine(line)}
                                  title="Edit Line"
                                  className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleToggleLineStatus(line)}
                                  title={isActive ? "Deactivate Line" : "Activate Line"}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    isActive
                                      ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                      : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete '${line.name}'?`)) {
                                      deleteLineMutation.mutate(lineId)
                                    }
                                  }}
                                  title="Delete Line"
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Read-only</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ────────────── TAB 2: PRODUCTION SHIFTS ────────────── */}
          {activeTab === 'shifts' && (
            shiftsLoading ? (
              <div className="p-8">
                <EnterpriseLoading label="Loading production shifts..." />
              </div>
            ) : filteredShifts.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Clock className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No production shifts found.</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {shiftSearch ? "No shifts match your search filter." : "Get started by adding operating shifts for your facility."}
                </p>
                {canManage && !shiftSearch && (
                  <button
                    onClick={handleOpenAddShift}
                    className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Production Shift
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 select-none">
                    <tr>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Shift Name</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Schedule / Timing</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Duration</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Status</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredShifts.map((shift: ProductionShift) => {
                      const duration = calculateShiftDuration(shift.startTime, shift.endTime)

                      return (
                        <tr key={shift.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Shift Name */}
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-slate-900 block leading-tight">{shift.name}</span>
                            {shift.description && (
                              <span className="text-[10px] text-slate-500 block truncate max-w-xs mt-0.5">{shift.description}</span>
                            )}
                          </td>

                          {/* Schedule */}
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                            {shift.startTime} – {shift.endTime}
                          </td>

                          {/* Duration */}
                          <td className="py-2.5 px-4">
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {duration}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                shift.isActive
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${shift.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                              {shift.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-right">
                            {canManage ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEditShift(shift)}
                                  title="Edit Shift"
                                  className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => toggleShiftStatusMutation.mutate({ id: shift.id, isActive: !shift.isActive })}
                                  title={shift.isActive ? "Deactivate Shift" : "Activate Shift"}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    shift.isActive
                                      ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                      : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete '${shift.name}'?`)) {
                                      deleteShiftMutation.mutate(shift.id)
                                    }
                                  }}
                                  title="Delete Shift"
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Read-only</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ────────────── TAB 3: CASE CONFIGURATION ────────────── */}
          {activeTab === 'cases' && (
            caseConfigsLoading ? (
              <div className="p-8">
                <EnterpriseLoading label="Loading case configurations..." />
              </div>
            ) : filteredCaseConfigs.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Package className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No case configurations defined.</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {caseConfigSearch ? "No configurations match your search filter." : "Define how many units are contained in each product case."}
                </p>
                {canManage && !caseConfigSearch && (
                  <button
                    onClick={handleOpenAddCaseConfig}
                    className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Case Configuration
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 select-none">
                    <tr>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Product</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px] text-right">Units Per Case</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Status</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Last Updated</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCaseConfigs.map((config: CaseConfiguration) => (
                      <tr key={config.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Product */}
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-slate-900 block leading-tight">{config.productName}</span>
                          {config.productSku && (
                            <span className="font-mono text-[10px] text-slate-500 block mt-0.5">SKU: {config.productSku}</span>
                          )}
                        </td>

                        {/* Units Per Case */}
                        <td className="py-2.5 px-4 text-right">
                          <span className="font-black text-slate-900 text-sm tabular-nums bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 inline-block">
                            {config.unitsPerCase} <span className="text-xs font-normal text-slate-500">Units/Case</span>
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              config.isActive
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${config.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            {config.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Last Updated */}
                        <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                          {config.updatedAt || config.createdAt ? new Date(config.updatedAt || config.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-4 text-right">
                          {canManage ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditCaseConfig(config)}
                                title="Edit Configuration"
                                className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  if (window.confirm(`Deactivate case configuration for '${config.productName}'?`)) {
                                    deleteCaseConfigMutation.mutate(config.id)
                                  }
                                }}
                                title="Deactivate Configuration"
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Read-only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ────────────── TAB 4: BRANDS ────────────── */}
          {activeTab === 'brands' && (
            brandsLoading ? (
              <div className="p-8">
                <EnterpriseLoading label="Loading brands..." />
              </div>
            ) : brandsIsError ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
                <p className="text-sm font-bold text-slate-800">Failed to load brands</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {getFriendlyError(brandsError).message}
                </p>
                <button
                  type="button"
                  onClick={() => refetchBrands()}
                  className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-[#05303B] hover:bg-[#0A4352] text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            ) : !paginatedBrandsData?.items || paginatedBrandsData.items.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Tag className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No brands yet.</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {brandsSearch ? "No brands match your search filter." : "No brands yet. Add your first brand to start creating products."}
                </p>
                {canManage && !brandsSearch && (
                  <button
                    type="button"
                    onClick={handleOpenAddBrand}
                    className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-[#05303B] hover:bg-[#0A4352] text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Brand
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="overflow-x-auto overflow-y-auto flex-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 select-none">
                      <tr>
                        <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Brand Name</th>
                        <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Code</th>
                        <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Description</th>
                        <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Status</th>
                        <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Created</th>
                        {canManage && (
                          <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px] text-right">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedBrandsData.items.map((brand: BrandDto) => (
                        <tr key={brand.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{brand.name}</td>
                          <td className="py-2.5 px-4">
                            <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {brand.code || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 max-w-[240px] truncate">
                            {brand.description || '—'}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                brand.isActive
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${brand.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                              {brand.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-medium text-[11px]">
                            {brand.createdAt ? new Date(brand.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                          </td>
                          {canManage && (
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditBrand(brand)}
                                  title="Edit Brand"
                                  className="p-1 rounded text-slate-500 hover:text-[#0B7A70] hover:bg-[#E6F6F4] transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBrand(brand)}
                                  title="Delete Brand"
                                  className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {paginatedBrandsData.totalPages > 1 && (
                  <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between select-none bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 font-semibold">
                      Page {brandsPage} of {paginatedBrandsData.totalPages} ({paginatedBrandsData.totalCount} total)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!paginatedBrandsData.hasPreviousPage}
                        onClick={() => setBrandsPage(p => p - 1)}
                        className="h-[26px] px-3 text-[11px] font-bold text-slate-600 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={!paginatedBrandsData.hasNextPage}
                        onClick={() => setBrandsPage(p => p + 1)}
                        className="h-[26px] px-3 text-[11px] font-bold text-slate-600 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

        </div>

      {/* ══ MODALS: ADD / EDIT PRODUCTION LINE ══════════════════════════════════ */}
      <EnterpriseModal
        isOpen={isAddLineModalOpen || isEditLineModalOpen}
        onClose={() => { setIsAddLineModalOpen(false); setIsEditLineModalOpen(false); resetLineForm(); }}
        title={isEditLineModalOpen ? "Edit Production Line" : "Add Production Line"}
        maxWidth="sm"
      >
        <div className="flex flex-col gap-3">
          <EnterpriseInput
            label="Line Name *"
            placeholder="e.g. Line 1"
            value={lineName}
            onChange={(e) => setLineName(e.target.value)}
            error={lineErrors.name}
            required
          />

          <EnterpriseInput
            label="Line Code *"
            placeholder="e.g. L001"
            value={lineCode}
            onChange={(e) => setLineCode(e.target.value)}
            error={lineErrors.code}
            required
          />

          <div className="flex items-center gap-2 pt-1 select-none">
            <input
              type="checkbox"
              id="lineActiveCheck"
              checked={lineIsActive}
              onChange={(e) => setLineIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="lineActiveCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
              Active Line (Available for production assignment)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setIsAddLineModalOpen(false); setIsEditLineModalOpen(false); resetLineForm(); }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <EnterpriseButton
              onClick={handleSaveLine}
              loading={createLineMutation.isPending || updateLineMutation.isPending}
            >
              {isEditLineModalOpen ? 'Save Changes' : 'Create Line'}
            </EnterpriseButton>
          </div>
        </div>
      </EnterpriseModal>

      {/* ══ MODALS: ADD / EDIT PRODUCTION SHIFT ═════════════════════════════════ */}
      <EnterpriseModal
        isOpen={isAddShiftModalOpen || isEditShiftModalOpen}
        onClose={() => { setIsAddShiftModalOpen(false); setIsEditShiftModalOpen(false); resetShiftForm(); }}
        title={isEditShiftModalOpen ? "Edit Production Shift" : "Add Production Shift"}
        maxWidth="md"
      >
        <div className="flex flex-col gap-3">
          <EnterpriseInput
            label="Shift Name *"
            placeholder="e.g. Morning Shift"
            value={shiftName}
            onChange={(e) => setShiftName(e.target.value)}
            error={shiftErrors.name}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Start Time *</label>
              <EnterpriseTimePicker
                value={shiftStartTime}
                onChange={setShiftStartTime}
                error={shiftErrors.startTime}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">End Time *</label>
              <EnterpriseTimePicker
                value={shiftEndTime}
                onChange={setShiftEndTime}
                error={shiftErrors.endTime}
              />
            </div>
          </div>

          {/* Calculated Duration Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-2 flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-500">Calculated Shift Duration:</span>
            <span className="font-bold text-blue-700">{calculateShiftDuration(shiftStartTime, shiftEndTime)}</span>
          </div>

          <EnterpriseInput
            label="Description (Optional)"
            placeholder="e.g. Standard morning production operating window"
            value={shiftDescription}
            onChange={(e) => setShiftDescription(e.target.value)}
          />

          <div className="flex items-center gap-2 pt-1 select-none">
            <input
              type="checkbox"
              id="shiftActiveCheck"
              checked={shiftIsActive}
              onChange={(e) => setShiftIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="shiftActiveCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
              Active Shift
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setIsAddShiftModalOpen(false); setIsEditShiftModalOpen(false); resetShiftForm(); }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <EnterpriseButton
              onClick={handleSaveShift}
              loading={createShiftMutation.isPending || updateShiftMutation.isPending}
            >
              {isEditShiftModalOpen ? 'Save Changes' : 'Create Shift'}
            </EnterpriseButton>
          </div>
        </div>
      </EnterpriseModal>

      {/* ══ MODALS: ADD / EDIT CASE CONFIGURATION ═══════════════════════════════ */}
      <EnterpriseModal
        isOpen={isAddCaseConfigModalOpen || isEditCaseConfigModalOpen}
        onClose={() => { setIsAddCaseConfigModalOpen(false); setIsEditCaseConfigModalOpen(false); resetCaseConfigForm(); }}
        title={isEditCaseConfigModalOpen ? "Edit Case Configuration" : "Create Case Configuration"}
        maxWidth="md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500 font-medium">
            Define how many units are packed in each case for the selected product.
          </p>

          {/* Product Dropdown Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Product <span className="text-red-500">*</span>
            </label>
            {isEditCaseConfigModalOpen ? (
              <input
                type="text"
                disabled
                value={editingCaseConfig?.productName || ''}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 cursor-not-allowed"
              />
            ) : (
              <select
                value={caseConfigProductId}
                onChange={(e) => {
                  setCaseConfigProductId(e.target.value)
                  if (caseConfigErrors.productId) {
                    setCaseConfigErrors((prev) => ({ ...prev, productId: '' }))
                  }
                }}
                className={`w-full bg-white border rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                  caseConfigErrors.productId ? 'border-red-500' : 'border-slate-200'
                }`}
              >
                <option value="">Select Product...</option>
                {availableProducts.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ''}
                  </option>
                ))}
              </select>
            )}
            {caseConfigErrors.productId && (
              <p className="text-[11px] font-bold text-red-500 mt-1">{caseConfigErrors.productId}</p>
            )}
          </div>

          {/* Units Per Case Input */}
          <div>
            <EnterpriseNumberInput
              label="Units Per Case *"
              placeholder="24"
              value={caseConfigUnitsPerCase}
              onChange={(e) => {
                setCaseConfigUnitsPerCase(e.target.value)
                if (caseConfigErrors.unitsPerCase) {
                  setCaseConfigErrors((prev) => ({ ...prev, unitsPerCase: '' }))
                }
              }}
              allowDecimals={false}
              error={caseConfigErrors.unitsPerCase}
            />
            <p className="text-[11px] text-slate-500 font-semibold mt-1">
              Example: 24 means 1 Case = 24 units of this product.
            </p>
          </div>

          {/* Active Checkbox (Edit mode) */}
          {isEditCaseConfigModalOpen && (
            <div className="flex items-center gap-2 pt-1 select-none">
              <input
                type="checkbox"
                id="caseConfigActiveCheck"
                checked={caseConfigIsActive}
                onChange={(e) => setCaseConfigIsActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="caseConfigActiveCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                Active Configuration
              </label>
            </div>
          )}

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setIsAddCaseConfigModalOpen(false); setIsEditCaseConfigModalOpen(false); resetCaseConfigForm(); }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <EnterpriseButton
              onClick={handleSaveCaseConfig}
              loading={createCaseConfigMutation.isPending || updateCaseConfigMutation.isPending}
            >
              {isEditCaseConfigModalOpen ? 'Save Changes' : 'Create Configuration'}
            </EnterpriseButton>
          </div>
        </div>
      </EnterpriseModal>

      {/* ══ MODAL: ADD / EDIT BRAND ══════════════════════════════════════════ */}
      <EnterpriseModal
        isOpen={isAddBrandModalOpen || isEditBrandModalOpen}
        onClose={() => {
          setIsAddBrandModalOpen(false)
          setIsEditBrandModalOpen(false)
          resetBrandForm()
        }}
        title={isEditBrandModalOpen ? "Edit Brand" : "Add New Brand"}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveBrand} className="flex flex-col gap-4">
          <EnterpriseInput
            label="Brand Name *"
            placeholder="E.g., Aquzio"
            value={brandFormName}
            onChange={e => {
              setBrandFormName(e.target.value)
              if (brandFormErrors.name) setBrandFormErrors(p => ({ ...p, name: '' }))
            }}
            error={brandFormErrors.name}
            required
          />
          <EnterpriseInput
            label="Brand Code (Optional)"
            placeholder="E.g., AQR"
            value={brandFormCode}
            onChange={e => setBrandFormCode(e.target.value)}
          />
          <EnterpriseInput
            label="Description (Optional)"
            placeholder="Brand details or region..."
            value={brandFormDescription}
            onChange={e => setBrandFormDescription(e.target.value)}
          />
          <div className="flex items-center gap-2 pt-1 select-none">
            <input
              type="checkbox"
              id="brandActiveCheck"
              checked={brandFormIsActive}
              onChange={e => setBrandFormIsActive(e.target.checked)}
              className="w-4 h-4 text-[#0B7A70] rounded border-slate-300 focus:ring-[#12A89A] cursor-pointer"
            />
            <label htmlFor="brandActiveCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
              Active Brand
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsAddBrandModalOpen(false)
                setIsEditBrandModalOpen(false)
                resetBrandForm()
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <EnterpriseButton
              type="submit"
              variant="primary"
              loading={createBrandMutation.isPending || updateBrandMutation.isPending}
            >
              {isEditBrandModalOpen ? 'Save Changes' : 'Create Brand'}
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

    </PageContainer>
  )
}

export default ProductionSetupPage
