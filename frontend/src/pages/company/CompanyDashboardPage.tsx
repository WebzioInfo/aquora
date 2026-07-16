import React, { useState } from 'react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'
import { authService } from '../../services/auth'
import { productsService } from '../../services/products'
import { rawMaterialsService } from '../../services/rawMaterials'
import { brandService } from '../../services/brands'
import { RAW_MATERIAL_CATEGORIES } from '../../utils/rawMaterialCategories'
import {
  Factory, ShieldCheck, Wrench, CheckCircle,
  ArrowUpRight, CloudSun, Play, Search, Plus, Eye, Key, Trash2, Edit2, ToggleLeft, ToggleRight,
  Pause, ExternalLink, Clock, Users, TrendingUp, Package, Settings
} from 'lucide-react'
import EnterpriseHeader from '../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../components/ui/EnterpriseCard'
import EnterpriseTable from '../../components/ui/EnterpriseTable'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseModal from '../../components/ui/EnterpriseModal'
import EnterpriseInput from '../../components/ui/EnterpriseInput'
import EnterpriseSelect from '../../components/ui/EnterpriseSelect'
import EnterpriseEmptyState from '../../components/ui/EnterpriseEmptyState'
import EnterpriseLoading from '../../components/ui/EnterpriseLoading'
import EnterpriseButton from '../../components/ui/EnterpriseButton'
import { InventoryPage } from './InventoryPage'
import { CustomersPage } from './CustomersPage'
import { SalesPage } from './SalesPage'

export const CompanyDashboardPage: React.FC = () => {
  const location = useLocation()
  const path = location.pathname
  const isDashboardView = path === '/company' || path === '/company/' || path === '/company/dashboard'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()

  // --- DASHBOARD QUICK ACTION STATES & HANDLERS ---
  const [isDashboardAddInventoryOpen, setIsDashboardAddInventoryOpen] = useState(false)
  const [dashboardAdjustMatId, setDashboardAdjustMatId] = useState('')
  const [dashboardAdjustQty, setDashboardAdjustQty] = useState('')
  const [dashboardAdjustNotes, setDashboardAdjustNotes] = useState('Admin Dashboard Adjustment')

  const [isDashboardSalesOrderOpen, setIsDashboardSalesOrderOpen] = useState(false)
  const [dashboardSalesClient, setDashboardSalesClient] = useState('Apex Distributors')
  const [dashboardSalesProduct, setDashboardSalesProduct] = useState('')
  const [dashboardSalesQty, setDashboardSalesQty] = useState('')
  const [dashboardSalesAmount, setDashboardSalesAmount] = useState('')

  const adjustStockMutation = useMutation({
    mutationFn: async ({ id, quantity, notes }: { id: string; quantity: number; notes?: string }) => {
      const res = await rawMaterialsService.addStock(id, { quantity, notes })
      return res.data
    },
    onSuccess: (data) => {
      showToast('Stock adjusted successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['dashboardRawMaterials'] })
      setIsDashboardAddInventoryOpen(false)
      setDashboardAdjustMatId('')
      setDashboardAdjustQty('')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to adjust stock.'
      showToast(msg, 'error')
    }
  })

  // Live clock state
  const [currentTime, setCurrentTime] = useState(new Date())
  useEffect(() => {
    if (!isDashboardView) return
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [isDashboardView])

  // Onboarding polling state
  const [onboarding, setOnboarding] = useState({
    progress: user?.onboardingProgress ?? 10,
    step: user?.onboardingStep ?? 'Queueing provisioning',
    status: user?.tenantStatus ?? 'Provisioning',
    failureReason: user?.onboardingFailureReason ?? ''
  })

  useEffect(() => {
    if (user?.tenantStatus !== 'Provisioning') return

    const intervalId = setInterval(async () => {
      try {
        const res = await authService.getSession()
        if (res.success && res.data) {
          const data = res.data
          setOnboarding({
            progress: data.onboardingProgress,
            step: data.onboardingStep || 'Provisioning workspace',
            status: data.tenantStatus,
            failureReason: data.onboardingFailureReason || ''
          })

          if (data.tenantStatus === 'Ready' || data.tenantStatus === 'Completed' || data.isTenantInitialized) {
            useAuthStore.getState().updateUser({
              tenantStatus: 'Ready',
              isTenantInitialized: true,
              roles: data.roles,
              permissions: data.permissions
            })
            clearInterval(intervalId)
            showToast('Workspace provisioned successfully! Welcome to Aquora.', 'success')
          } else if (data.tenantStatus === 'Failed') {
            clearInterval(intervalId)
            showToast('Provisioning failed. Please check details.', 'error')
          }
        }
      } catch (err) {
        console.error('Error polling onboarding status:', err)
      }
    }, 2000)

    return () => clearInterval(intervalId)
  }, [user?.tenantStatus, showToast])



  // Search & Filter state for Employee List
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

  // Modal toggle states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [selectedEmployeeForView, setSelectedEmployeeForView] = useState<any | null>(null)

  // Add Employee Form States
  const [addFullName, setAddFullName] = useState('')
  const [addUsername, setAddUsername] = useState('')
  const [addRoleCode, setAddRoleCode] = useState('')
  const [addPasswordOrPin, setAddPasswordOrPin] = useState('')
  const [addDepartment, setAddDepartment] = useState('Operations')

  // Edit Employee Form States
  const [editEmployeeId, setEditEmployeeId] = useState('')
  const [editFullName, setEditFullName] = useState('')
  const [editRoleCode, setEditRoleCode] = useState('')
  const [editDepartment, setEditDepartment] = useState('Operations')
  const [editIsActive, setEditIsActive] = useState(true)

  // Reset Password Form States
  const [resetEmployeeId, setResetEmployeeId] = useState('')
  const [resetEmployeeName, setResetEmployeeName] = useState('')
  const [resetPasswordOrPin, setResetPasswordOrPin] = useState('')

  // Production lines state
  const [productionTab, setProductionTab] = useState<'batches' | 'lines'>('batches')
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false)
  const [isEditLineModalOpen, setIsEditLineModalOpen] = useState(false)

  // Add Production Line Form
  const [addLineName, setAddLineName] = useState('')
  const [addLineCode, setAddLineCode] = useState('')
  const [addLineIsActive, setAddLineIsActive] = useState(true)

  // Edit Production Line Form
  const [editLineId, setEditLineId] = useState('')
  const [editLineName, setEditLineName] = useState('')
  const [editLineCode, setEditLineCode] = useState('')
  const [editLineIsActive, setEditLineIsActive] = useState(true)

  // Active batches control states
  const [isStartBatchModalOpen, setIsStartBatchModalOpen] = useState(false)
  const [startBatchLineId, setStartBatchLineId] = useState('')
  const [startBatchNumber, setStartBatchNumber] = useState('')
  const [startBatchProduct, setStartBatchProduct] = useState('')
  const [startBatchShift, setStartBatchShift] = useState('Day')
  const [startBatchTargetQty, setStartBatchTargetQty] = useState<string | number>('')
  const [batchSearch, setBatchSearch] = useState('')
  const [batchLineFilter, setBatchLineFilter] = useState('')
  const [batchStatusFilter, setBatchStatusFilter] = useState('All')
  const [batchDateFilter, setBatchDateFilter] = useState('')
  const [selectedBatchForView, setSelectedBatchForView] = useState<any | null>(null)
  const [isViewBatchModalOpen, setIsViewBatchModalOpen] = useState(false)

  // Master data tabs state
  const [inventoryTab, setInventoryTab] = useState<'products' | 'raw_materials' | 'brands'>('products')

  // Products state
  const [productsPage, setProductsPage] = useState(1)
  const [productsSearch, setProductsSearch] = useState('')
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false)
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [productFormName, setProductFormName] = useState('')
  const [productFormBrandId, setProductFormBrandId] = useState('')
  const [productFormSKU, setProductFormSKU] = useState('')
  const [productFormIsActive, setProductFormIsActive] = useState(true)

  // Brands state
  const [brandsPage, setBrandsPage] = useState(1)
  const [brandsSearch, setBrandsSearch] = useState('')
  const [isAddBrandModalOpen, setIsAddBrandModalOpen] = useState(false)
  const [isEditBrandModalOpen, setIsEditBrandModalOpen] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<any | null>(null)
  const [brandFormName, setBrandFormName] = useState('')
  const [brandFormCode, setBrandFormCode] = useState('')
  const [brandFormDescription, setBrandFormDescription] = useState('')
  const [brandFormIsActive, setBrandFormIsActive] = useState(true)

  // Raw Materials state
  const [rawMaterialsPage, setRawMaterialsPage] = useState(1)
  const [rawMaterialsSearch, setRawMaterialsSearch] = useState('')
  const [isAddRawMaterialModalOpen, setIsAddRawMaterialModalOpen] = useState(false)
  const [isEditRawMaterialModalOpen, setIsEditRawMaterialModalOpen] = useState(false)
  const [selectedRawMaterial, setSelectedRawMaterial] = useState<any | null>(null)
  const [rawMaterialFormName, setRawMaterialFormName] = useState('')
  const [rawMaterialFormCategory, setRawMaterialFormCategory] = useState('PREFORM')
  const [rawMaterialFormUnit, setRawMaterialFormUnit] = useState('PIECE')
  const [rawMaterialFormIsActive, setRawMaterialFormIsActive] = useState(true)
  const [rawMaterialFormCurrentStock, setRawMaterialFormCurrentStock] = useState('0')
  const [rawMaterialFormStockAdjustment, setRawMaterialFormStockAdjustment] = useState('0')


  const canWrite = user?.roles?.some((role: string) =>
    ['CompanyAdmin', 'Admin', 'Manager', 'Accountant'].includes(role)
  ) ?? false

  // Fetch Products List
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['productsList', productsPage, productsSearch],
    queryFn: async () => {
      const res = await productsService.getProducts(productsPage, 5, productsSearch)
      return res.data
    },
    enabled: path.includes('/inventory') && inventoryTab === 'products'
  })

  // Fetch Paginated Brands List for Brands Tab
  const { data: paginatedBrandsData, isLoading: brandsLoading } = useQuery({
    queryKey: ['brandsPaginated', brandsPage, brandsSearch],
    queryFn: async () => {
      const res = await brandService.getBrands(brandsPage, 5, brandsSearch)
      return res.data
    },
    enabled: path.includes('/inventory') && inventoryTab === 'brands'
  })

  // Fetch Brands List for dropdown
  const { data: brands = [] } = useQuery({
    queryKey: ['brandsDropdown'],
    queryFn: async () => {
      const res = await brandService.getBrands(1, 1000)
      return res.data?.items || []
    },
    enabled: path.includes('/inventory')
  })

  // Create Brand Mutation
  const createBrandMutation = useMutation({
    mutationFn: brandService.createBrand,
    onSuccess: (data) => {
      if (data.success) {
        showToast('Brand created successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['brandsPaginated'] })
        queryClient.invalidateQueries({ queryKey: ['brandsDropdown'] })
        setIsAddBrandModalOpen(false)
        setBrandFormName('')
        setBrandFormCode('')
        setBrandFormDescription('')
        setBrandFormIsActive(true)
      } else {
        showToast(data.message || 'Failed to create brand.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Update Brand Mutation
  const updateBrandMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => brandService.updateBrand(id, data),
    onSuccess: (data) => {
      if (data.success) {
        showToast('Brand updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['brandsPaginated'] })
        queryClient.invalidateQueries({ queryKey: ['brandsDropdown'] })
        setIsEditBrandModalOpen(false)
      } else {
        showToast(data.message || 'Failed to update brand.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Delete Brand Mutation
  const deleteBrandMutation = useMutation({
    mutationFn: brandService.deleteBrand,
    onSuccess: (data) => {
      if (data.success) {
        showToast('Brand deleted successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['brandsPaginated'] })
        queryClient.invalidateQueries({ queryKey: ['brandsDropdown'] })
      } else {
        showToast(data.message || 'Failed to delete brand.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })


  // Fetch Raw Materials List
  const { data: rawMaterialsData, isLoading: rawMaterialsLoading } = useQuery({
    queryKey: ['rawMaterialsList', rawMaterialsPage, rawMaterialsSearch],
    queryFn: async () => {
      const res = await rawMaterialsService.getRawMaterials(rawMaterialsPage, 5, rawMaterialsSearch)
      return res.data
    },
    enabled: path.includes('/inventory') && inventoryTab === 'raw_materials'
  })

  // --- INVENTORY SETTINGS FOR DEFAULT INK/MAKEUP ---
  const [defaultInkId, setDefaultInkId] = useState('')
  const [defaultMakeupId, setDefaultMakeupId] = useState('')

  const { data: inventorySettings } = useQuery<any>({
    queryKey: ['inventorySettingsAdmin'],
    queryFn: async () => {
      const res = await api.get('/api/v1/rawmaterials/settings')
      return res.data?.data || null
    },
    enabled: path.includes('/settings')
  })

  const { data: allMaterials = [] } = useQuery<any[]>({
    queryKey: ['allRawMaterialsForDropdowns'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production-entries/materials')
      return res.data?.data || []
    },
    enabled: path.includes('/settings')
  })

  // --- PRODUCTION STATIONS CONFIGURATION ---
  const [stationStates, setStationStates] = useState<Record<string, boolean>>({
    Blowing: true,
    Filling: true,
    Labeling: true,
    Packing: true
  })

  const { data: stationConfigs, refetch: refetchStations } = useQuery<any[]>({
    queryKey: ['productionStationConfigs'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production-configuration/all')
      return res.data?.data || []
    },
    enabled: path.includes('/settings')
  })

  useEffect(() => {
    if (stationConfigs) {
      const state: Record<string, boolean> = {}
      stationConfigs.forEach((c: any) => {
        state[c.stationName] = c.isEnabled
      })
      setStationStates(state)
    }
  }, [stationConfigs])

  const saveStationsMutation = useMutation({
    mutationFn: async (payload: any[]) => {
      const res = await api.post('/api/v1/production-configuration', payload)
      return res.data
    },
    onSuccess: () => {
      showToast('Production stations configuration updated successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['productionStationConfigs'] })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to update production stations.'
      showToast(msg, 'error')
    }
  })

  const handleSaveStations = () => {
    const payload = Object.keys(stationStates).map(name => ({
      stationName: name,
      isEnabled: stationStates[name]
    }))
    saveStationsMutation.mutate(payload)
  }

  const canConfigureStations = user?.roles?.some((role: string) =>
    ['CompanyAdmin', 'SuperAdmin', 'PlatformAdmin'].includes(role)
  ) ?? false

  useEffect(() => {
    if (inventorySettings) {
      setDefaultInkId(inventorySettings.defaultInkMaterialId || '')
      setDefaultMakeupId(inventorySettings.defaultMakeupMaterialId || '')
    }
  }, [inventorySettings])

  const saveInventorySettingsMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/api/v1/rawmaterials/settings', payload)
      return res.data
    },
    onSuccess: () => {
      showToast('Inventory settings updated successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['inventorySettingsAdmin'] })
      queryClient.invalidateQueries({ queryKey: ['inventorySettings'] })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to update inventory settings.'
      showToast(msg, 'error')
    }
  })

  const handleSaveInventorySettings = () => {
    saveInventorySettingsMutation.mutate({
      defaultInkMaterialId: defaultInkId || null,
      defaultMakeupMaterialId: defaultMakeupId || null
    })
  }

  // Create Product Mutation
  const createProductMutation = useMutation({
    mutationFn: productsService.createProduct,
    onSuccess: (data) => {
      if (data.success) {
        showToast('Product created successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productsList'] })
        setIsAddProductModalOpen(false)
        setProductFormName('')
        setProductFormBrandId('')
        setProductFormSKU('')
        setProductFormIsActive(true)
      } else {
        showToast(data.message || 'Failed to create product.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Update Product Mutation
  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsService.updateProduct(id, data),
    onSuccess: (data) => {
      if (data.success) {
        showToast('Product updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productsList'] })
        setIsEditProductModalOpen(false)
      } else {
        showToast(data.message || 'Failed to update product.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Delete Product Mutation
  const deleteProductMutation = useMutation({
    mutationFn: productsService.deleteProduct,
    onSuccess: (data) => {
      if (data.success) {
        showToast('Product deleted successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productsList'] })
      } else {
        showToast(data.message || 'Failed to delete product.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Create Raw Material Mutation
  const createRawMaterialMutation = useMutation({
    mutationFn: rawMaterialsService.createRawMaterial,
    onSuccess: (data) => {
      if (data.success) {
        showToast('Raw material created successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['rawMaterialsList'] })
        queryClient.invalidateQueries({ queryKey: ['rawMaterials'] })
        setIsAddRawMaterialModalOpen(false)
        setRawMaterialFormName('')
        setRawMaterialFormCategory('PREFORM')
        setRawMaterialFormUnit('PIECE')
        setRawMaterialFormIsActive(true)
        setRawMaterialFormCurrentStock('0')
        setRawMaterialFormStockAdjustment('0')
      } else {
        showToast(data.message || 'Failed to create raw material.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Update Raw Material Mutation
  const updateRawMaterialMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => rawMaterialsService.updateRawMaterial(id, data),
    onSuccess: (data) => {
      if (data.success) {
        showToast('Raw material updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['rawMaterialsList'] })
        queryClient.invalidateQueries({ queryKey: ['rawMaterials'] })
        setIsEditRawMaterialModalOpen(false)
      } else {
        showToast(data.message || 'Failed to update raw material.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Delete Raw Material Mutation
  const deleteRawMaterialMutation = useMutation({
    mutationFn: rawMaterialsService.deleteRawMaterial,
    onSuccess: (data) => {
      if (data.success) {
        showToast('Raw material deleted successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['rawMaterialsList'] })
        queryClient.invalidateQueries({ queryKey: ['rawMaterials'] })
      } else {
        showToast(data.message || 'Failed to delete raw material.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Brand Handlers
  const handleCreateBrandSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!brandFormName.trim()) {
      showToast('Brand Name is required.', 'warning')
      return
    }
    createBrandMutation.mutate({
      name: brandFormName.trim(),
      code: brandFormCode.trim() || undefined,
      description: brandFormDescription.trim() || undefined,
      isActive: brandFormIsActive
    })
  }

  const handleEditBrandSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBrand) return
    if (!brandFormName.trim()) {
      showToast('Brand Name is required.', 'warning')
      return
    }
    updateBrandMutation.mutate({
      id: selectedBrand.id,
      data: {
        name: brandFormName.trim(),
        code: brandFormCode.trim() || undefined,
        description: brandFormDescription.trim() || undefined,
        isActive: brandFormIsActive
      }
    })
  }

  const openEditBrand = (brand: any) => {
    setSelectedBrand(brand)
    setBrandFormName(brand.name)
    setBrandFormCode(brand.code || '')
    setBrandFormDescription(brand.description || '')
    setBrandFormIsActive(brand.isActive)
    setIsEditBrandModalOpen(true)
  }

  const triggerDeleteBrand = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete brand "${name}"?`)) {
      deleteBrandMutation.mutate(id)
    }
  }

  // Product Handlers
  const handleCreateProductSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!productFormName.trim()) {
      showToast('Product Name is required.', 'warning')
      return
    }
    if (!productFormBrandId) {
      showToast('Brand is required.', 'warning')
      return
    }
    createProductMutation.mutate({
      name: productFormName.trim(),
      brandId: productFormBrandId,
      sku: productFormSKU.trim() || undefined,
      isActive: productFormIsActive
    })
  }

  const handleEditProductSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return
    if (!productFormName.trim()) {
      showToast('Product Name is required.', 'warning')
      return
    }
    if (!productFormBrandId) {
      showToast('Brand is required.', 'warning')
      return
    }
    updateProductMutation.mutate({
      id: selectedProduct.id,
      data: {
        name: productFormName.trim(),
        brandId: productFormBrandId,
        sku: productFormSKU.trim() || undefined,
        isActive: productFormIsActive
      }
    })
  }

  const openEditProduct = (prod: any) => {
    setSelectedProduct(prod)
    setProductFormName(prod.name)
    setProductFormBrandId(prod.brandId)
    setProductFormSKU(prod.sku || '')
    setProductFormIsActive(prod.isActive)
    setIsEditProductModalOpen(true)
  }

  const triggerDeleteProduct = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete product "${name}"?`)) {
      deleteProductMutation.mutate(id)
    }
  }

  // Raw Material Handlers
  const handleCreateRawMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rawMaterialFormName.trim()) {
      showToast('Material Name is required.', 'warning')
      return
    }
    if (!rawMaterialFormCategory) {
      showToast('Category is required.', 'warning')
      return
    }
    if (!rawMaterialFormUnit) {
      showToast('Unit is required.', 'warning')
      return
    }
    createRawMaterialMutation.mutate({
      name: rawMaterialFormName.trim(),
      category: rawMaterialFormCategory,
      unit: rawMaterialFormUnit,
      isActive: rawMaterialFormIsActive,
      currentStock: parseFloat(rawMaterialFormCurrentStock) || 0
    })
  }

  const handleEditRawMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRawMaterial) return
    if (!rawMaterialFormName.trim()) {
      showToast('Material Name is required.', 'warning')
      return
    }
    if (!rawMaterialFormCategory) {
      showToast('Category is required.', 'warning')
      return
    }
    if (!rawMaterialFormUnit) {
      showToast('Unit is required.', 'warning')
      return
    }
    updateRawMaterialMutation.mutate({
      id: selectedRawMaterial.id,
      data: {
        name: rawMaterialFormName.trim(),
        category: rawMaterialFormCategory,
        unit: rawMaterialFormUnit,
        isActive: rawMaterialFormIsActive,
        currentStock: parseFloat(rawMaterialFormCurrentStock) || 0,
        stockAdjustment: parseFloat(rawMaterialFormStockAdjustment) || 0
      }
    })
  }

  const openEditRawMaterial = (mat: any) => {
    setSelectedRawMaterial(mat)
    setRawMaterialFormName(mat.name)
    setRawMaterialFormCategory(mat.category.toUpperCase())
    setRawMaterialFormUnit(mat.unit.toUpperCase())
    setRawMaterialFormIsActive(mat.isActive)
    setRawMaterialFormCurrentStock(mat.currentStock?.toString() || '0')
    setRawMaterialFormStockAdjustment('0')
    setIsEditRawMaterialModalOpen(true)
  }

  const triggerDeleteRawMaterial = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete raw material "${name}"?`)) {
      deleteRawMaterialMutation.mutate(id)
    }
  }

  // Render content depending on active routing path
  const isProductionView = path.includes('/production')
  const isInventoryView = path.includes('/inventory')
  const isEmployeesView = path.includes('/employees')
  const isSettingsView = path.includes('/settings')
  const isCustomersView = path.includes('/customers')
  const isSalesView = path.includes('/sales')

  // Fetch Employees List
  const { data: employees = [], isLoading: employeesLoading } = useQuery<any[]>({
    queryKey: ['employeesList'],
    queryFn: async () => {
      const res = await api.get('/api/v1/employees')
      return res.data?.data || []
    },
    enabled: isEmployeesView
  })

  // Fetch Roles
  const { data: roles = [] } = useQuery<any[]>({
    queryKey: ['employeesRoles'],
    queryFn: async () => {
      const res = await api.get('/api/v1/employees/roles')
      return res.data?.data || []
    },
    enabled: isEmployeesView
  })

  // Fetch Departments
  const { data: departments = [] } = useQuery<string[]>({
    queryKey: ['employeesDepts'],
    queryFn: async () => {
      const res = await api.get('/api/v1/employees/departments')
      return res.data?.data || []
    },
    enabled: isEmployeesView
  })

  // Create Employee Mutation
  const createEmployeeMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/api/v1/employees', payload)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Employee created successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['employeesList'] })
        setIsAddModalOpen(false)
        setAddFullName('')
        setAddUsername('')
        setAddRoleCode('')
        setAddPasswordOrPin('')
        setAddDepartment('Operations')
      } else {
        showToast(data.message || 'Failed to create employee.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Update Employee Mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: async (payload: { id: string; data: any }) => {
      const res = await api.put(`/api/v1/employees/${payload.id}`, payload.data)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Employee updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['employeesList'] })
        setIsEditModalOpen(false)
      } else {
        showToast(data.message || 'Failed to update employee.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put('/api/v1/employees/reset-password', payload)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Password/PIN reset successfully.', 'success')
        setIsResetModalOpen(false)
        setResetPasswordOrPin('')
      } else {
        showToast(data.message || 'Failed to reset password.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Delete Employee Mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/v1/employees/${id}`)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Employee deleted successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['employeesList'] })
      } else {
        showToast(data.message || 'Failed to delete employee.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Fetch Production Lines
  const { data: productionLines = [], isLoading: linesLoading } = useQuery<any[]>({
    queryKey: ['productionLinesList'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production/lines?includeInactive=true')
      return res.data?.data || []
    },
    enabled: isProductionView || isDashboardView
  })

  // Fetch all catalog products for batch starting dropdown
  const { data: allCatalogProducts = [] } = useQuery<any[]>({
    queryKey: ['allCatalogProductsList'],
    queryFn: async () => {
      const res = await productsService.getProducts(1, 100, '')
      return res.data?.items || []
    },
    enabled: isProductionView || isDashboardView
  })

  // Fetch active production batches
  const { data: activeBatches = [], isLoading: batchesLoading } = useQuery<any[]>({
    queryKey: ['activeBatchesList'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production/batches/active')
      return res.data?.data || []
    },
    enabled: isProductionView || isDashboardView,
    refetchInterval: 2000
  })

  // Fetch Raw Materials for Dashboard Inventory Health
  const { data: dashboardRawMaterials = [] } = useQuery<any[]>({
    queryKey: ['dashboardRawMaterials'],
    queryFn: async () => {
      const res = await rawMaterialsService.getRawMaterials(1, 100)
      return res.data?.items || []
    },
    enabled: isDashboardView
  })

  // Fetch Products for Dashboard Finished Goods Stock
  const { data: dashboardProducts = [] } = useQuery<any[]>({
    queryKey: ['dashboardProducts'],
    queryFn: async () => {
      const res = await productsService.getProducts(1, 100)
      return res.data?.items || []
    },
    enabled: isDashboardView
  })

  // Fetch Sales Dashboard Metrics
  const { data: salesDashboard } = useQuery({
    queryKey: ['salesDashboard'],
    queryFn: async () => {
      const res = await api.get('/api/v1/sales/dashboard')
      return res.data?.data || {
        todaySalesCases: 0,
        todayReturns: 0,
        todayDamage: 0,
        totalDispatch: 0,
        monthlyDispatch: 0
      }
    },
    enabled: isDashboardView
  })

  // Start Batch Mutation
  const startBatchMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/api/v1/production/batch/start', payload)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Production batch started successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['activeBatchesList'] })
        setIsStartBatchModalOpen(false)
        setStartBatchNumber('')
        setStartBatchTargetQty('')
      } else {
        showToast(data.message || 'Failed to start batch.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Pause Batch Mutation
  const pauseBatchMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/api/v1/production/batch/${id}/pause`)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Production batch paused.', 'success')
        queryClient.invalidateQueries({ queryKey: ['activeBatchesList'] })
      } else {
        showToast(data.message || 'Failed to pause batch.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Resume Batch Mutation
  const resumeBatchMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/api/v1/production/batch/${id}/resume`)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Production batch resumed.', 'success')
        queryClient.invalidateQueries({ queryKey: ['activeBatchesList'] })
      } else {
        showToast(data.message || 'Failed to resume batch.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Complete Batch Mutation
  const completeBatchMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/api/v1/production/batch/${id}/complete`)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Production batch completed successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['activeBatchesList'] })
      } else {
        showToast(data.message || 'Failed to complete batch.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Create Line Mutation
  const createLineMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/api/v1/production/lines', payload)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Production line created successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionLinesList'] })
        setIsAddLineModalOpen(false)
        setAddLineName('')
        setAddLineCode('')
        setAddLineIsActive(true)
      } else {
        showToast(data.message || 'Failed to create production line.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Update Line Mutation
  const updateLineMutation = useMutation({
    mutationFn: async (payload: { id: string; data: any }) => {
      const res = await api.put(`/api/v1/production/lines/${payload.id}`, payload.data)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Production line updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionLinesList'] })
        setIsEditLineModalOpen(false)
      } else {
        showToast(data.message || 'Failed to update production line.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  // Delete Line Mutation
  const deleteLineMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/v1/production/lines/${id}`)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Production line deleted successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionLinesList'] })
      } else {
        showToast(data.message || 'Failed to delete production line.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred.'
      showToast(msg, 'error')
    }
  })

  const handleAddLineSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addLineName.trim()) {
      showToast('Line Name is required.', 'warning')
      return
    }
    if (!addLineCode.trim()) {
      showToast('Line Code is required.', 'warning')
      return
    }
    createLineMutation.mutate({
      name: addLineName.trim(),
      code: addLineCode.trim().toUpperCase(),
      isActive: addLineIsActive
    })
  }

  const handleEditLineSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editLineName.trim()) {
      showToast('Line Name is required.', 'warning')
      return
    }
    if (!editLineCode.trim()) {
      showToast('Line Code is required.', 'warning')
      return
    }
    updateLineMutation.mutate({
      id: editLineId,
      data: {
        name: editLineName.trim(),
        code: editLineCode.trim().toUpperCase(),
        isActive: editLineIsActive
      }
    })
  }

  const handleToggleLineStatus = (line: any) => {
    updateLineMutation.mutate({
      id: line.lineId,
      data: {
        isActive: !line.isActive
      }
    })
  }

  const triggerDeleteLine = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete production line "${name}"? This soft-deletes the line.`)) {
      deleteLineMutation.mutate(id)
    }
  }

  const openEditLineModal = (line: any) => {
    setEditLineId(line.lineId)
    setEditLineName(line.name)
    setEditLineCode(line.code)
    setEditLineIsActive(line.isActive)
    setIsEditLineModalOpen(true)
  }

  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addFullName.trim()) {
      showToast('Full Name is required.', 'warning')
      return
    }
    if (!addUsername.trim() || addUsername.length < 3) {
      showToast('Username must be at least 3 characters.', 'warning')
      return
    }
    if (!addRoleCode) {
      showToast('Role is required.', 'warning')
      return
    }
    if (!addPasswordOrPin || addPasswordOrPin.length < 4) {
      showToast('Password or PIN must be at least 4 characters.', 'warning')
      return
    }

    createEmployeeMutation.mutate({
      fullName: addFullName.trim(),
      username: addUsername.trim(),
      roleCode: addRoleCode,
      passwordOrPin: addPasswordOrPin,
      department: addDepartment
    })
  }

  const handleEditEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editFullName.trim()) {
      showToast('Full Name is required.', 'warning')
      return
    }
    if (!editRoleCode) {
      showToast('Role is required.', 'warning')
      return
    }

    updateEmployeeMutation.mutate({
      id: editEmployeeId,
      data: {
        fullName: editFullName.trim(),
        roleCode: editRoleCode,
        department: editDepartment,
        isActive: editIsActive
      }
    })
  }

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordOrPin || resetPasswordOrPin.length < 4) {
      showToast('Password or PIN must be at least 4 characters.', 'warning')
      return
    }

    resetPasswordMutation.mutate({
      employeeId: resetEmployeeId,
      passwordOrPin: resetPasswordOrPin
    })
  }

  const triggerToggleStatus = (employee: any) => {
    updateEmployeeMutation.mutate({
      id: employee.id,
      data: {
        fullName: employee.fullName,
        roleCode: employee.roleCode,
        department: employee.department,
        isActive: !employee.isActive
      }
    })
  }

  const triggerDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete employee "${name}"? This soft-deletes the user record.`)) {
      deleteEmployeeMutation.mutate(id)
    }
  }

  const openEditModal = (employee: any) => {
    setEditEmployeeId(employee.id)
    setEditFullName(employee.fullName)
    setEditRoleCode(employee.roleCode)
    setEditDepartment(employee.department)
    setEditIsActive(employee.isActive)
    setIsEditModalOpen(true)
  }

  const openResetModal = (employee: any) => {
    setResetEmployeeId(employee.id)
    setResetEmployeeName(employee.fullName)
    setResetPasswordOrPin('')
    setIsResetModalOpen(true)
  }

  // Filters calculation
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter ? emp.roleCode.toUpperCase() === roleFilter.toUpperCase() : true
    const matchesStatus = statusFilter ? (statusFilter === 'active' ? emp.isActive : !emp.isActive) : true
    return matchesSearch && matchesRole && matchesStatus
  })

  // Pagination calculation
  const totalPages = Math.ceil(filteredEmployees.length / pageSize)
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const getRoleBadgeVariant = (code: string) => {
    switch (code.toUpperCase()) {
      case 'SUPERADMIN':
      case 'PLATFORMADMIN':
        return 'danger'
      case 'COMPANYADMIN':
        return 'primary'
      case 'MANAGER':
        return 'info'
      case 'SUPERVISOR':
        return 'warning'
      case 'OPERATOR':
        return 'warning'
      case 'QUALITY_CONTROLLER':
        return 'success'
      case 'MAINTENANCE':
        return 'gray'
      default:
        return 'gray'
    }
  }

  // Onboarding progress view
  if (user?.tenantStatus === 'Provisioning' || onboarding.status === 'Provisioning') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg relative">
                <Factory className="w-8 h-8 text-white animate-bounce" />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-100 font-display">Setting up your Workspace</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Please wait while we initialize your secure tenant database and seed roles/permissions.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-[11px] font-semibold text-slate-400 px-1">
              <span>{onboarding.step}</span>
              <span>{onboarding.progress}%</span>
            </div>
            <div className="w-full bg-slate-850 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-850">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out shadow-inner"
                style={{ width: `${onboarding.progress}%` }}
              ></div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 tracking-wider uppercase font-mono">
            Status: <span className="text-blue-400 font-semibold">{onboarding.status}</span>
          </div>
        </div>
      </div>
    )
  }

  // Onboarding failure view
  if (onboarding.status === 'Failed') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-red-900/30 border border-red-500/30 rounded-2xl flex items-center justify-center shadow-lg mx-auto">
            <Wrench className="w-8 h-8 text-red-500" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-red-400 font-display">Setup Failed</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              An error occurred while provisioning your workspace.
            </p>
          </div>

          <div className="bg-red-950/40 border border-red-900/50 rounded-lg p-3 text-xs text-red-300 text-left font-mono max-h-40 overflow-y-auto break-all">
            {onboarding.failureReason || 'Unknown error code.'}
          </div>

          <EnterpriseButton 
            variant="primary" 
            className="w-full bg-red-650 hover:bg-red-700 text-white"
            onClick={() => window.location.reload()}
          >
            Retry Provisioning
          </EnterpriseButton>
        </div>
      </div>
    )
  }

  if (isSettingsView) {
    return (
      <div className="flex flex-col gap-6">
        <EnterpriseHeader
          title="Company Profile Settings"
          description="Manage configuration parameters for the current company tenant database schema."
        />
        <EnterpriseCard title="Tenant Setup Preferences">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <EnterpriseInput label="Tenant Name" defaultValue="Aquaflow Ltd" />
            <EnterpriseInput label="Subdomain PREFIX" defaultValue="aquaflow" disabled className="bg-slate-50 dark:bg-slate-800" />
            <EnterpriseInput label="Primary Admin Email" defaultValue="admin@aquaflow.industrial" />
          </div>
          <EnterpriseButton>Save Preferences</EnterpriseButton>
        </EnterpriseCard>

        <EnterpriseCard title="Inventory settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <EnterpriseSelect
              label="Default Ink Material"
              value={defaultInkId}
              onChange={(e) => setDefaultInkId(e.target.value)}
            >
              <option value="">-- Use First Active Ink Material --</option>
              {allMaterials.filter(m => m.category === 'INK').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </EnterpriseSelect>
            <EnterpriseSelect
              label="Default Makeup Material"
              value={defaultMakeupId}
              onChange={(e) => setDefaultMakeupId(e.target.value)}
            >
              <option value="">-- Use First Active Makeup Material --</option>
              {allMaterials.filter(m => m.category === 'MAKEUP').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </EnterpriseSelect>
          </div>
          <EnterpriseButton onClick={handleSaveInventorySettings} loading={saveInventorySettingsMutation.isPending}>
            Save Inventory Settings
          </EnterpriseButton>
        </EnterpriseCard>

        <EnterpriseCard title="Production Stations Configuration">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-4 select-none">
            Toggle production lines active stations ({!canConfigureStations ? 'Read-only' : 'Tenant Administrator'})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {Object.keys(stationStates).map((stationName) => {
              const isEnabled = stationStates[stationName]
              return (
                <div key={stationName} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800 rounded-[8px]">
                  <div className="text-left select-none">
                    <span className="text-xs font-bold text-slate-800 dark:text-white block">{stationName} Station</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {stationName === 'Blowing' && 'Preform usage/wastage logging & stock movement.'}
                      {stationName === 'Filling' && 'Cap usage/wastage, bottle & water filling.'}
                      {stationName === 'Labeling' && 'Label usage/wastage logging & stock movement.'}
                      {stationName === 'Packing' && 'Shrink film, glue, ink, and makeup logs.'}
                    </span>
                  </div>
                  <label className={`relative inline-flex items-center cursor-pointer select-none ${!canConfigureStations ? 'pointer-events-none opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      disabled={!canConfigureStations}
                      onChange={(e) => setStationStates(prev => ({ ...prev, [stationName]: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              )
            })}
          </div>
          {canConfigureStations && (
            <EnterpriseButton onClick={handleSaveStations} loading={saveStationsMutation.isPending}>
              Save Production Stations
            </EnterpriseButton>
          )}
        </EnterpriseCard>
      </div>
    )
  }

  // Live ticking duration component for manufacturing batches
  const RunningDurationCell: React.FC<{ startedAt: string }> = ({ startedAt }) => {
    const [duration, setDuration] = useState('00:00:00')

    useEffect(() => {
      const update = () => {
        const diff = Math.max(0, Date.now() - new Date(startedAt).getTime())
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const mins = Math.floor((diff / (1000 * 60)) % 60)
        const secs = Math.floor((diff / 1000) % 60)
        setDuration(
          `${hours.toString().padStart(2, '0')}:${mins
            .toString()
            .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        )
      }
      update()
      const interval = setInterval(update, 1000)
      return () => clearInterval(interval)
    }, [startedAt])

    return <span className="font-mono font-semibold text-xs tracking-wider text-slate-600 dark:text-slate-300">{duration}</span>
  }

    if (isProductionView) {
    // Actions and Form Handlers
    const handleStartBatchSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (!startBatchLineId) {
        showToast('Production line is required.', 'warning')
        return
      }
      if (!startBatchNumber.trim()) {
        showToast('Batch number is required.', 'warning')
        return
      }
      if (!startBatchProduct) {
        showToast('Product selection is required.', 'warning')
        return
      }
      if (!startBatchTargetQty || Number(startBatchTargetQty) <= 0) {
        showToast('Target quantity must be greater than zero.', 'warning')
        return
      }

      startBatchMutation.mutate({
        productionLineId: startBatchLineId,
        batchNumber: startBatchNumber.trim(),
        product: startBatchProduct,
        shift: startBatchShift,
        targetQuantity: Number(startBatchTargetQty)
      })
    }

    const handleOpenOperatorSession = (row: any) => {
      const lineObj = {
        lineId: row.productionLineId,
        name: row.productionLineName,
        code: row.productionLineCode,
        isActive: true
      }
      localStorage.setItem('mes_selected_line', JSON.stringify(lineObj))
      localStorage.setItem('mes_selected_shift', row.shift)
      window.open('/operator', '_blank')
    }

    const handlePauseBatch = (id: string) => { pauseBatchMutation.mutate(id) }
    const handleResumeBatch = (id: string) => { resumeBatchMutation.mutate(id) }
    const handleCompleteBatch = (id: string) => {
      if (confirm('Are you sure you want to complete and lock this active production batch?')) {
        completeBatchMutation.mutate(id)
      }
    }

    // Local filtering logic
    const filteredBatches = activeBatches.filter((batch: any) => {
      const matchesSearch =
        batch.batchNumber.toLowerCase().includes(batchSearch.toLowerCase()) ||
        batch.product.toLowerCase().includes(batchSearch.toLowerCase()) ||
        batch.operatorName.toLowerCase().includes(batchSearch.toLowerCase())
      const matchesLine = batchLineFilter === '' || batch.productionLineId === batchLineFilter
      const matchesStatus =
        batchStatusFilter === 'All' ||
        (batchStatusFilter === 'Active' && batch.status === 'Active') ||
        (batchStatusFilter === 'Paused' && batch.status === 'Paused')
      const matchesDate = !batchDateFilter || new Date(batch.startedAt).toISOString().slice(0, 10) === batchDateFilter
      return matchesSearch && matchesLine && matchesStatus && matchesDate
    })

    // Derived stats
    const totalActiveBatchesCount = activeBatches.length
    const runningLinesCount = activeBatches.filter((b: any) => b.status === 'Active').length
    const pausedBatchesCount = activeBatches.filter((b: any) => b.status === 'Paused').length
    const todayCasesCount = activeBatches.reduce((acc: number, curr: any) => acc + (curr.producedQuantity || 0), 0)
    const runningOperatorsCount = new Set(activeBatches.map((b: any) => b.operatorName).filter(Boolean)).size
    const currentShiftVal = activeBatches[0]?.shift || 'Morning'

    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'Active':
          return { label: 'Running', cls: 'bg-green-50 border-green-200 text-green-700' }
        case 'Paused':
          return { label: 'Paused', cls: 'bg-orange-50 border-orange-200 text-orange-700' }
        case 'Completed':
          return { label: 'Completed', cls: 'bg-blue-50 border-blue-200 text-blue-700' }
        case 'Cancelled':
          return { label: 'Cancelled', cls: 'bg-red-50 border-red-200 text-red-700' }
        default:
          return { label: status, cls: 'bg-slate-50 border-slate-200 text-slate-600' }
      }
    }

    return (
      <div className="flex flex-col gap-3 font-sans text-slate-800 bg-[#F8FAFC] min-h-screen p-4">

        {/* Compact Page Header */}
        <div className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-xl px-4 py-2.5 shadow-sm">
          <div>
            <h1 className="text-[15px] font-bold text-slate-900 leading-tight">Production Console</h1>
            <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">Batch queue Ã¢â‚¬â€ monitor, filter, and manage active production runs</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-slate-500 select-none">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} &bull; {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={() => {
                if (productionLines.length > 0) setStartBatchLineId(productionLines[0].lineId)
                if (allCatalogProducts.length > 0) setStartBatchProduct(allCatalogProducts[0].name)
                setIsStartBatchModalOpen(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-sm cursor-pointer transition-all active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Batch</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-0 border-b border-[#E5E7EB] select-none bg-white rounded-t-lg px-4 shadow-sm border border-[#E5E7EB]">
          <button
            onClick={() => setProductionTab('batches')}
            className={`py-2 px-4 text-[12px] font-bold border-b-2 transition-all cursor-pointer ${
              productionTab === 'batches'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Batch Queue
          </button>
          <button
            onClick={() => setProductionTab('lines')}
            className={`py-2 px-4 text-[12px] font-bold border-b-2 transition-all cursor-pointer ${
              productionTab === 'lines'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Production Lines
          </button>
        </div>

        {productionTab === 'batches' ? (
          <>
            {/* Compact KPI Strip */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 select-none">
              {[
                { value: totalActiveBatchesCount, label: 'Active Batches' },
                { value: runningLinesCount, label: 'Running Lines' },
                { value: pausedBatchesCount, label: 'Paused' },
                { value: todayCasesCount.toLocaleString(), label: "Today's Cases" },
                { value: runningOperatorsCount, label: 'Operators' },
                { value: currentShiftVal, label: 'Current Shift' },
              ].map((kpi, i) => (
                <div key={i} className="bg-white border border-[#E5E7EB] rounded-lg py-2 px-3 shadow-sm text-center">
                  <div className="text-[18px] font-black text-slate-900 leading-tight">{kpi.value}</div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Filter Toolbar Ã¢â‚¬â€ 40px height */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-[#E5E7EB] rounded-xl px-3 shadow-sm" style={{ minHeight: '40px' }}>
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                {/* Search */}
                <div className="relative w-full sm:w-[190px]">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search batches..."
                    value={batchSearch}
                    onChange={(e) => setBatchSearch(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 text-[11px] border border-[#E5E7EB] rounded-md bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-700 h-[30px]"
                  />
                </div>

                {/* Production Line dropdown */}
                <select
                  value={batchLineFilter}
                  onChange={(e) => setBatchLineFilter(e.target.value)}
                  className="px-2.5 py-1 text-[11px] border border-[#E5E7EB] rounded-md bg-white focus:outline-none focus:border-blue-500 font-semibold text-slate-700 h-[30px] cursor-pointer"
                >
                  <option value="">All Lines</option>
                  {productionLines.map((line: any) => (
                    <option key={line.lineId} value={line.lineId}>{line.name}</option>
                  ))}
                </select>

                {/* Status dropdown */}
                <select
                  value={batchStatusFilter}
                  onChange={(e) => setBatchStatusFilter(e.target.value)}
                  className="px-2.5 py-1 text-[11px] border border-[#E5E7EB] rounded-md bg-white focus:outline-none focus:border-blue-500 font-semibold text-slate-700 h-[30px] cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Running</option>
                  <option value="Paused">Paused</option>
                </select>

                {/* Date filter */}
                <input
                  type="date"
                  value={batchDateFilter}
                  onChange={(e) => setBatchDateFilter(e.target.value)}
                  className="px-2.5 py-1 text-[11px] border border-[#E5E7EB] rounded-md bg-white focus:outline-none focus:border-blue-500 font-semibold text-slate-700 h-[30px]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['activeBatchesList'] })}
                  className="px-2.5 h-[30px] text-[11px] font-bold text-slate-600 border border-[#E5E7EB] rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Refresh
                </button>
                <button
                  onClick={() => {
                    setBatchSearch('')
                    setBatchLineFilter('')
                    setBatchStatusFilter('All')
                    setBatchDateFilter('')
                  }}
                  className="px-2.5 h-[30px] text-[11px] font-bold text-slate-500 border border-[#E5E7EB] rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Batch Queue Grid */}
            {batchesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <div key={n} className="bg-white border border-[#E5E7EB] rounded-lg p-3 shadow-sm animate-pulse space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                    <div className="h-2.5 bg-slate-100 rounded w-1/3 ml-auto"></div>
                  </div>
                ))}
              </div>
            ) : filteredBatches.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {filteredBatches.map((batch: any) => {
                  const { label, cls } = getStatusBadge(batch.status)
                  return (
                    <div
                      key={batch.id}
                      onClick={() => navigate(`/company/production/batches/${batch.id}`)}
                      className="bg-white border border-[#E5E7EB] rounded-xl p-3 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-150 cursor-pointer flex flex-col justify-between gap-2 group"
                      title={`Open ${batch.batchNumber}`}
                    >
                      {/* Batch Number */}
                      <span className="text-[12px] font-black text-slate-900 tracking-tight truncate">
                        {batch.batchNumber}
                      </span>

                      {/* Status Badge */}
                      <span className={`self-start text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${cls}`}>
                        {label}
                      </span>

                      {/* View Indicator */}
                      <div className="flex justify-end">
                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors">
                          View Ã¢â€ â€™
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-10 text-center shadow-sm">
                <p className="text-[13px] font-semibold text-slate-500">
                  {batchSearch || batchLineFilter || batchStatusFilter !== 'All'
                    ? 'No batches match your filters. Try adjusting your search.'
                    : 'No active production batches found. Create a batch to get started.'}
                </p>
                {!batchSearch && !batchLineFilter && batchStatusFilter === 'All' && (
                  <button
                    onClick={() => {
                      if (productionLines.length > 0) setStartBatchLineId(productionLines[0].lineId)
                      if (allCatalogProducts.length > 0) setStartBatchProduct(allCatalogProducts[0].name)
                      setIsStartBatchModalOpen(true)
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg shadow-sm cursor-pointer transition-all"
                  >
                    Create Production Batch
                  </button>
                )}
              </div>
            )}

            {/* Result count */}
            {!batchesLoading && filteredBatches.length > 0 && (
              <div className="text-[11px] text-slate-400 font-medium select-none px-1">
                Showing {filteredBatches.length} of {activeBatches.length} batches
              </div>
            )}
          </>
        ) : (
          <>
            {/* Production Lines Table */}
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-[12px] font-bold text-slate-700">Production Lines</span>
              <button
                onClick={() => setIsAddLineModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-all"
              >
                <Plus className="w-3 h-3" /> Add Line
              </button>
            </div>
            {linesLoading ? (
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 text-center text-[12px] text-slate-400 shadow-sm">
                Loading production lines...
              </div>
            ) : productionLines.length > 0 ? (
              <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px] border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-slate-600 font-bold select-none h-[36px]">
                        <th className="py-2 px-4">Line Code</th>
                        <th className="py-2 px-4">Line Name</th>
                        <th className="py-2 px-4">Status</th>
                        <th className="py-2 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {productionLines.map((row: any) => (
                        <tr key={row.lineId} className="hover:bg-[#F8FAFC] h-[38px] transition-colors">
                          <td className="py-2 px-4 font-mono font-bold text-blue-600">{row.code}</td>
                          <td className="py-2 px-4 font-semibold text-slate-900">{row.name}</td>
                          <td className="py-2 px-4">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${row.isActive ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                              {row.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => openEditLineModal(row)}
                                className="p-1 border border-[#E5E7EB] hover:bg-slate-50 text-slate-500 rounded"
                                title="Edit Line"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => triggerDeleteLine(row.lineId, row.name)}
                                className="p-1 border border-red-200 hover:bg-red-50 text-red-600 rounded"
                                title="Delete Line"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-10 text-center shadow-sm">
                <p className="text-[13px] font-semibold text-slate-500">No production lines found. Create your first line to get started.</p>
                <button
                  onClick={() => setIsAddLineModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  Add Production Line
                </button>
              </div>
            )}
          </>
        )}

        {/* Add Production Line Modal */}
        <EnterpriseModal isOpen={isAddLineModalOpen} onClose={() => setIsAddLineModalOpen(false)} title="Create Production Line">
          <form onSubmit={handleAddLineSubmit} className="flex flex-col gap-4">
            <EnterpriseInput label="Line Name *" value={addLineName} onChange={(e) => setAddLineName(e.target.value)} placeholder="e.g. Bottling Line C" required />
            <EnterpriseInput label="Line Code *" value={addLineCode} onChange={(e) => setAddLineCode(e.target.value)} placeholder="e.g. LINE_C" required />
            <div className="flex items-center gap-3 mt-2 select-none">
              <button type="button" onClick={() => setAddLineIsActive(!addLineIsActive)} className="cursor-pointer">
                {addLineIsActive ? <ToggleRight className="w-9 h-9 text-green-500" /> : <ToggleLeft className="w-9 h-9 text-slate-400" />}
              </button>
              <span className="text-xs font-semibold text-slate-800">Active Status</span>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <EnterpriseButton type="button" onClick={() => setIsAddLineModalOpen(false)} variant="secondary">Cancel</EnterpriseButton>
              <EnterpriseButton type="submit" loading={createLineMutation.isPending}>Create Line</EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>

        {/* Edit Production Line Modal */}
        <EnterpriseModal isOpen={isEditLineModalOpen} onClose={() => setIsEditLineModalOpen(false)} title="Modify Production Line">
          <form onSubmit={handleEditLineSubmit} className="flex flex-col gap-4">
            <EnterpriseInput label="Line Name *" value={editLineName} onChange={(e) => setEditLineName(e.target.value)} required />
            <EnterpriseInput label="Line Code *" value={editLineCode} onChange={(e) => setEditLineCode(e.target.value)} required />
            <div className="flex items-center gap-3 mt-2 select-none">
              <button type="button" onClick={() => setEditLineIsActive(!editLineIsActive)} className="cursor-pointer">
                {editLineIsActive ? <ToggleRight className="w-9 h-9 text-green-500" /> : <ToggleLeft className="w-9 h-9 text-slate-400" />}
              </button>
              <span className="text-xs font-semibold text-slate-800">Active Status</span>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <EnterpriseButton type="button" onClick={() => setIsEditLineModalOpen(false)} variant="secondary">Cancel</EnterpriseButton>
              <EnterpriseButton type="submit" loading={updateLineMutation.isPending}>Save Changes</EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>

        {/* Create Production Batch Modal */}
        <EnterpriseModal isOpen={isStartBatchModalOpen} onClose={() => setIsStartBatchModalOpen(false)} title="Create Production Batch">
          <form onSubmit={handleStartBatchSubmit} className="flex flex-col gap-4">
            <EnterpriseSelect label="Production Line *" value={startBatchLineId} onChange={(e) => setStartBatchLineId(e.target.value)} required>
              {productionLines.map((line: any) => (
                <option key={line.lineId} value={line.lineId}>{line.name} ({line.code})</option>
              ))}
            </EnterpriseSelect>
            <EnterpriseInput label="Batch Number / Code *" value={startBatchNumber} onChange={(e) => setStartBatchNumber(e.target.value)} placeholder="e.g. LOT-001, B-RUN-12" required />
            <EnterpriseSelect label="Product *" value={startBatchProduct} onChange={(e) => setStartBatchProduct(e.target.value)} required>
              {allCatalogProducts.map((prod: any) => (
                <option key={prod.id} value={prod.name}>{prod.name} {prod.sku ? `(${prod.sku})` : ''}</option>
              ))}
            </EnterpriseSelect>
            <EnterpriseSelect label="Shift *" value={startBatchShift} onChange={(e) => setStartBatchShift(e.target.value)} required>
              <option value="Day">Day Shift</option>
              <option value="Night">Night Shift</option>
              <option value="Evening">Evening Shift</option>
            </EnterpriseSelect>
            <EnterpriseInput label="Target Quantity (Cases) *" type="number" value={startBatchTargetQty} onChange={(e) => setStartBatchTargetQty(e.target.value)} placeholder="e.g. 1000" required />
            <div className="flex gap-2 justify-end mt-4">
              <EnterpriseButton type="button" onClick={() => setIsStartBatchModalOpen(false)} variant="secondary">Cancel</EnterpriseButton>
              <EnterpriseButton type="submit" loading={startBatchMutation.isPending}>Start Batch</EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      </div>
    )
  }

  if (isSalesView) {
    return (
      <SalesPage canWrite={canWrite} showToast={showToast} />
    )
  }

  if (isCustomersView) {
    return (
      <CustomersPage />
    )
  }

  if (isInventoryView) {
    return (
      <InventoryPage canWrite={canWrite} showToast={showToast} />
    )
  }

  if (isEmployeesView) {
    const employeeColumns = [
      {
        key: 'fullName',
        title: 'Employee',
        render: (row: any) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-hydro-navy/10 text-hydro-navy dark:text-hydro-azure font-extrabold flex items-center justify-center uppercase text-xs">
              {row.fullName.charAt(0)}
            </div>
            <span className="font-semibold">{row.fullName}</span>
          </div>
        )
      },
      {
        key: 'username',
        title: 'Username',
        render: (row: any) => <span className="font-mono text-slate-500 dark:text-slate-400">{row.username}</span>
      },
      {
        key: 'roleName',
        title: 'Role',
        render: (row: any) => (
          <EnterpriseBadge variant={getRoleBadgeVariant(row.roleCode)}>
            {row.roleName}
          </EnterpriseBadge>
        )
      },
      {
        key: 'department',
        title: 'Department',
        className: 'font-medium text-slate-600 dark:text-slate-300'
      },
      {
        key: 'isActive',
        title: 'Status',
        render: (row: any) => (
          <button
            onClick={() => triggerToggleStatus(row)}
            className="flex items-center gap-1 hover:opacity-80 cursor-pointer"
            title="Toggle Account active state"
          >
            <EnterpriseBadge variant={row.isActive ? 'success' : 'danger'}>
              {row.isActive ? 'Active' : 'Inactive'}
            </EnterpriseBadge>
          </button>
        )
      },
      {
        key: 'createdAt',
        title: 'Created Date',
        render: (row: any) => new Date(row.createdAt).toLocaleDateString()
      },
      {
        key: 'lastLogin',
        title: 'Last Login',
        render: (row: any) => row.lastLogin ? new Date(row.lastLogin).toLocaleDateString() : 'Never'
      },
      {
        key: 'actions',
        title: 'Actions',
        className: 'text-right',
        render: (row: any) => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => setSelectedEmployeeForView(row)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-hydro-navy dark:hover:text-white rounded-sm cursor-pointer" title="View details"><Eye className="w-3.5 h-3.5" /></button>
            <button onClick={() => openEditModal(row)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-hydro-navy dark:hover:text-white rounded-sm cursor-pointer" title="Edit Profile"><Edit2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => openResetModal(row)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-500 rounded-sm cursor-pointer" title="Reset Password/PIN"><Key className="w-3.5 h-3.5" /></button>
            <button onClick={() => triggerDelete(row.id, row.fullName)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-error rounded-sm cursor-pointer" title="Delete User"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )
      }
    ]

    return (
      <div className="flex flex-col gap-6">
        <EnterpriseHeader
          title="User Directory & Employees"
          description="Provision operator credentials and configure RBAC authorization roles."
          actions={
            <EnterpriseButton onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Add Employee</span>
            </EnterpriseButton>
          }
        />

        {/* Filters and Search Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 flex flex-col md:flex-row gap-4 select-none">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by name, username, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 bg-transparent text-xs pl-9 pr-4 py-2.5 rounded-sm focus:outline-none focus:border-hydro-navy"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          </div>

          <div className="flex gap-3">
            <EnterpriseSelect
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
              className="!py-2"
            >
              <option value="">All Roles</option>
              {roles.map((r: any) => (
                <option key={r.id} value={r.code}>{r.name}</option>
              ))}
            </EnterpriseSelect>

            <EnterpriseSelect
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="!py-2"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </EnterpriseSelect>
          </div>
        </div>

        {/* Table Grid list */}
        {employeesLoading ? (
          <EnterpriseLoading label="Fetching employee listings..." />
        ) : filteredEmployees.length > 0 ? (
          <div className="flex flex-col gap-4">
            <EnterpriseTable
              columns={employeeColumns}
              data={paginatedEmployees}
              emptyMessage="No employees matched your criteria."
            />
            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div className="p-4 border border-slate-200 dark:border-slate-855 bg-white dark:bg-slate-900 rounded-sm flex justify-between items-center text-xs select-none">
                <span className="text-slate-400 font-semibold">Page {currentPage} of {totalPages}</span>
                <div className="flex gap-2">
                  <EnterpriseButton
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    variant="secondary"
                    className="py-1 px-3 text-xs"
                  >
                    Prev
                  </EnterpriseButton>
                  <EnterpriseButton
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    variant="secondary"
                    className="py-1 px-3 text-xs"
                  >
                    Next
                  </EnterpriseButton>
                </div>
              </div>
            )}
          </div>
        ) : (
          <EnterpriseEmptyState
            title="No Employees Found"
            description="Clear your filter criteria or register a new employee to get started."
            actionLabel="Add Employee"
            onAction={() => setIsAddModalOpen(true)}
          />
        )}

        {/* 1. View Employee Modal card */}
        {selectedEmployeeForView && (
          <EnterpriseModal
            isOpen={!!selectedEmployeeForView}
            onClose={() => setSelectedEmployeeForView(null)}
            title="Employee Profile Details"
            maxWidth="sm"
          >
            <div className="flex flex-col gap-4 select-none">
              <div className="flex items-center gap-4 mt-2">
                <div className="w-12 h-12 rounded bg-hydro-navy text-white flex items-center justify-center font-bold text-lg uppercase shrink-0">
                  {selectedEmployeeForView.fullName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-850 dark:text-white leading-tight">{selectedEmployeeForView.fullName}</h4>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-1">{selectedEmployeeForView.department}</span>
                </div>
              </div>

              <div className="text-xs space-y-3.5 mt-3">
                <div className="flex justify-between border-b border-slate-105 dark:border-slate-850 pb-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Username</span>
                  <span className="font-mono">{selectedEmployeeForView.username}</span>
                </div>
                <div className="flex justify-between border-b border-slate-105 dark:border-slate-850 pb-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Authorization Role</span>
                  <span className="font-bold text-hydro-navy dark:text-hydro-azure">{selectedEmployeeForView.roleName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-105 dark:border-slate-850 pb-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Account Status</span>
                  <span className={selectedEmployeeForView.isActive ? 'text-green-600 font-bold' : 'text-error font-bold'}>
                    {selectedEmployeeForView.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-105 dark:border-slate-850 pb-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Record GUID</span>
                  <span className="font-mono text-[10px] text-slate-400 truncate max-w-[150px]">{selectedEmployeeForView.id}</span>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <EnterpriseButton
                  onClick={() => setSelectedEmployeeForView(null)}
                  variant="secondary"
                >
                  Close
                </EnterpriseButton>
              </div>
            </div>
          </EnterpriseModal>
        )}

        {/* 2. Add Employee dialog */}
        <EnterpriseModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Register New Employee"
        >
          <form onSubmit={handleAddEmployeeSubmit} className="flex flex-col gap-4">
            <EnterpriseInput
              label="Full Name *"
              value={addFullName}
              onChange={(e) => setAddFullName(e.target.value)}
              placeholder="e.g. John Doe"
              required
            />
            <EnterpriseInput
              label="Username *"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              placeholder="e.g. john_doe"
              required
            />
            <EnterpriseSelect
              label="Role *"
              value={addRoleCode}
              onChange={(e) => setAddRoleCode(e.target.value)}
              required
            >
              <option value="">Select Role</option>
              {roles.map((r: any) => (
                <option key={r.id} value={r.code}>{r.name}</option>
              ))}
            </EnterpriseSelect>

            <EnterpriseInput
              label="Password or PIN *"
              type="password"
              placeholder="Enter Password or PIN"
              value={addPasswordOrPin}
              onChange={(e) => setAddPasswordOrPin(e.target.value)}
              required
            />

            <EnterpriseSelect
              label="Department"
              value={addDepartment}
              onChange={(e) => setAddDepartment(e.target.value)}
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </EnterpriseSelect>

            <div className="flex gap-2 justify-end mt-4">
              <EnterpriseButton type="button" onClick={() => setIsAddModalOpen(false)} variant="secondary">
                Cancel
              </EnterpriseButton>
              <EnterpriseButton type="submit" loading={createEmployeeMutation.isPending}>
                Create User
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>

        {/* 3. Edit Employee dialog */}
        <EnterpriseModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Modify Employee Account"
        >
          <form onSubmit={handleEditEmployeeSubmit} className="flex flex-col gap-4">
            <EnterpriseInput
              label="Full Name *"
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              required
            />
            <EnterpriseSelect
              label="Role *"
              value={editRoleCode}
              onChange={(e) => setEditRoleCode(e.target.value)}
              required
            >
              {roles.map((r: any) => (
                <option key={r.id} value={r.code}>{r.name}</option>
              ))}
            </EnterpriseSelect>

            <EnterpriseSelect
              label="Department"
              value={editDepartment}
              onChange={(e) => setEditDepartment(e.target.value)}
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </EnterpriseSelect>

            <div className="flex items-center gap-3 mt-2 select-none">
              <button
                type="button"
                onClick={() => setEditIsActive(!editIsActive)}
                className="text-hydro-navy cursor-pointer"
              >
                {editIsActive ? (
                  <ToggleRight className="w-9 h-9 text-green-500 fill-green-50" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-slate-400 fill-slate-50" />
                )}
              </button>
              <span className="text-xs font-semibold text-slate-800 dark:text-white">Account Active Status</span>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <EnterpriseButton type="button" onClick={() => setIsEditModalOpen(false)} variant="secondary">
                Cancel
              </EnterpriseButton>
              <EnterpriseButton type="submit" loading={updateEmployeeMutation.isPending}>
                Save Changes
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>

        {/* 4. Reset Credentials dialog */}
        <EnterpriseModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          title="Reset Credentials"
        >
          <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4">
            <p className="text-[11px] text-slate-400 select-none">Resetting access credentials for: <strong>{resetEmployeeName}</strong>.</p>
            <EnterpriseInput
              label="New Password or PIN *"
              type="password"
              placeholder="Enter Password or PIN"
              value={resetPasswordOrPin}
              onChange={(e) => setResetPasswordOrPin(e.target.value)}
              required
            />
            <div className="flex gap-2 justify-end mt-4">
              <EnterpriseButton type="button" onClick={() => setIsResetModalOpen(false)} variant="secondary">
                Cancel
              </EnterpriseButton>
              <EnterpriseButton type="submit" loading={resetPasswordMutation.isPending}>
                Save Hash
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      </div>
    )
  }





  const handleAdjustStockSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!dashboardAdjustMatId) {
      showToast('Please select a material.', 'warning')
      return
    }
    const qty = parseFloat(dashboardAdjustQty)
    if (isNaN(qty) || qty === 0) {
      showToast('Please enter a valid quantity.', 'warning')
      return
    }
    adjustStockMutation.mutate({
      id: dashboardAdjustMatId,
      quantity: qty,
      notes: dashboardAdjustNotes
    })
  }





  const handleSalesOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    showToast(`Sales order created for ${dashboardSalesClient} (Amount: $${dashboardSalesAmount || '0'}).`, 'success')
    setIsDashboardSalesOrderOpen(false)
    setDashboardSalesQty('')
    setDashboardSalesAmount('')
  }



  const getShiftName = (date: Date) => {
    const hour = date.getHours()
    if (hour >= 6 && hour < 14) return 'Morning Shift (06:00 - 14:00)'
    if (hour >= 14 && hour < 22) return 'Evening Shift (14:00 - 22:00)'
    return 'Night Shift (22:00 - 06:00)'
  }

  // Fallbacks for display to avoid blank dashboards
  const displayLines = productionLines.length > 0 ? productionLines : [
    { lineId: '1', code: 'LINE_A', name: 'Bottling Line A', isActive: true },
    { lineId: '2', code: 'LINE_B', name: 'Bottling Line B', isActive: true },
    { lineId: '3', code: 'LINE_C', name: 'Bottling Line C', isActive: false }
  ]

  const displayBatches = activeBatches.length > 0 ? activeBatches : [
    {
      id: 'mock-b1',
      batchNumber: 'LOT-2026-A1',
      productionLineId: '1',
      productionLineName: 'Bottling Line A',
      productionLineCode: 'LINE_A',
      product: 'Premium Sparkling Water 500ml',
      shift: 'Morning',
      targetQuantity: 5000,
      producedQuantity: 4250,
      operatorName: 'Vance R.',
      status: 'Active',
      startedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
    },
    {
      id: 'mock-b2',
      batchNumber: 'LOT-2026-B4',
      productionLineId: '2',
      productionLineName: 'Bottling Line B',
      productionLineCode: 'LINE_B',
      product: 'Still Pure Water 1.5L',
      shift: 'Morning',
      targetQuantity: 3000,
      producedQuantity: 1200,
      operatorName: 'Marcus T.',
      status: 'Paused',
      startedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    }
  ]

  // Inventory logic using actual database stats + safe fallback levels
  const getMaterialStock = (category: string, fallback: number) => {
    const mat = dashboardRawMaterials.find(m => m.category === category)
    return mat ? mat.currentStock : fallback
  }

  const getProductStockSum = (fallback: number) => {
    const total = dashboardProducts.reduce((sum, p) => sum + (p.currentStock || 0), 0)
    return total > 0 ? total : fallback
  }

  const stockPreforms = getMaterialStock('PREFORM', 42500)
  const stockCaps = getMaterialStock('CAP', 112000)
  const stockLabels = getMaterialStock('LABEL', 18500)
  const stockShrinkRolls = getMaterialStock('SHRINK_FILM', 6400)
  const stockFinishedGoods = getProductStockSum(15400)

  const getStockStatus = (current: number, safe: number) => {
    if (current <= safe * 0.4) {
      return { label: 'Critical', color: 'text-red-600', barColor: 'bg-red-500' }
    }
    if (current < safe) {
      return { label: 'Low', color: 'text-amber-600', barColor: 'bg-amber-500' }
    }
    return { label: 'Healthy', color: 'text-green-600', barColor: 'bg-green-500' }
  }

  const getFactoryStatus = () => {
    const active = displayBatches.filter((b: any) => b.status === 'Active')
    const paused = displayBatches.filter((b: any) => b.status === 'Paused')
    
    if (active.length > 0) {
      return {
        label: 'PRODUCTION RUNNING',
        variant: 'success' as const,
        description: `${active.length} of ${displayLines.filter(l => l.isActive).length} lines running`
      }
    } else if (paused.length > 0) {
      return {
        label: 'PRODUCTION PAUSED',
        variant: 'warning' as const,
        description: 'All active batches are currently paused'
      }
    } else {
      return {
        label: 'FACILITY IDLE',
        variant: 'gray' as const,
        description: 'No active production batches'
      }
    }
  }

  // Aggregated KPIs
  const totalAchieved = displayBatches.reduce((acc, b) => acc + (b.producedQuantity || 0), 0)
  const totalTarget = displayBatches.reduce((acc, b) => acc + (b.targetQuantity || 1), 0)
  const todayProgressPercent = Math.min(100, Math.round((totalAchieved / totalTarget) * 100))

  const activeAlertsCount = (stockLabels < 40000 ? 1 : 0) + (stockPreforms < 50000 ? 1 : 0)

  const factoryStatus = getFactoryStatus()
  // Greeting based on time of day
  const getGreeting = () => {
    const h = currentTime.getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  // DEFAULT VIEW â€” Clean Executive Dashboard
  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-10">

        {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-gray-100">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-gray-900">
              {getGreeting()}, {user?.fullName?.split(' ')[0] || 'Sinan'} ðŸ‘‹
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {user?.tenantName || 'Aquaflow Ltd'} &bull; Plant A &bull; {getShiftName(currentTime).split('(')[0].trim()} &bull; {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-gray-500 tabular-nums">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className={`w-2 h-2 rounded-full ${factoryStatus.variant === 'success' ? 'bg-green-500' : factoryStatus.variant === 'warning' ? 'bg-amber-500' : 'bg-gray-400'}`} />
              <span className="text-gray-700">{factoryStatus.variant === 'success' ? 'Production Running' : factoryStatus.variant === 'warning' ? 'Production Paused' : 'Idle'}</span>
            </div>
          </div>
        </header>

        {/* â”€â”€ Today's KPIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-6">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Today's Production</p>
            <p className="text-[32px] font-semibold tracking-tight text-gray-900 leading-tight tabular-nums mt-1">
              {totalAchieved > 0 ? totalAchieved.toLocaleString() : 'â€”'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">cases produced</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Target</p>
            <p className="text-[32px] font-semibold tracking-tight text-gray-900 leading-tight tabular-nums mt-1">
              {totalTarget > 1 ? totalTarget.toLocaleString() : 'â€”'}
            </p>
            <p className="text-xs mt-0.5">
              <span className={`font-medium ${todayProgressPercent >= 80 ? 'text-green-600' : todayProgressPercent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {todayProgressPercent}% achieved
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">This Week</p>
            <p className="text-[32px] font-semibold tracking-tight text-gray-900 leading-tight tabular-nums mt-1">
              {totalAchieved > 0 ? Math.round(totalAchieved * 5.2).toLocaleString() : 'â€”'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">cases</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">This Month</p>
            <p className="text-[32px] font-semibold tracking-tight text-gray-900 leading-tight tabular-nums mt-1">
              {totalAchieved > 0 ? Math.round(totalAchieved * 22).toLocaleString() : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">cases</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Today's Sales</p>
            <p className="text-[32px] font-semibold tracking-tight text-gray-900 leading-tight tabular-nums mt-1">
              ₹{totalAchieved > 0 ? ((totalAchieved * 12.5 * 83) / 100000).toFixed(1) : '0'}L
            </p>
            <p className="text-xs text-gray-400 mt-0.5">estimated revenue</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Pending Dispatch</p>
            <p className="text-[32px] font-semibold tracking-tight text-gray-900 leading-tight tabular-nums mt-1">
              18
            </p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">2 high priority</p>
          </div>
        </section>

        {/* Sales & Dispatch Metrics Section */}
        <section className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-5">Sales & Dispatch Ledger</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-6">
            <div>
              <p className="text-xs font-medium text-gray-550">Today's Dispatched Cases</p>
              <p className="text-[28px] font-black tracking-tight text-slate-800 leading-tight tabular-nums mt-1.5">
                {(salesDashboard?.todaySalesCases || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-blue-600 font-semibold mt-0.5">Finished Goods Released</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-550">Today's Returns</p>
              <p className="text-[28px] font-black tracking-tight text-emerald-600 leading-tight tabular-nums mt-1.5">
                {(salesDashboard?.todayReturns || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Stock Restored</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-550">Today's Damages</p>
              <p className="text-[28px] font-black tracking-tight text-rose-500 leading-tight tabular-nums mt-1.5">
                {(salesDashboard?.todayDamage || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">Inventory Deducted</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-550">Month-to-Date Releases</p>
              <p className="text-[28px] font-black tracking-tight text-slate-800 leading-tight tabular-nums mt-1.5">
                {(salesDashboard?.monthlyDispatch || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Cases Dispatched</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-550">Total Releases (All-Time)</p>
              <p className="text-[28px] font-black tracking-tight text-slate-800 leading-tight tabular-nums mt-1.5">
                {(salesDashboard?.totalDispatch || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-405 mt-0.5">Log Release Aggregate</p>
            </div>
          </div>
        </section>

        {/* â”€â”€ Main Grid: Left (2/3) + Right (1/3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Left Column */}
          <div className="lg:col-span-2 space-y-10">

            {/* â”€â”€ Production Lines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-5">Production Lines</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayLines.map((line: any) => {
                  const batch = displayBatches.find((b: any) => b.productionLineId === line.lineId)
                  const isRunning = line.isActive && batch?.status === 'Active'
                  const isPaused = line.isActive && batch?.status === 'Paused'
                  const statusDot = isRunning ? 'bg-green-500' : isPaused ? 'bg-amber-500' : 'bg-gray-300'
                  const statusText = isRunning ? 'Running' : isPaused ? 'Paused' : 'Idle'
                  const produced = batch?.producedQuantity || 0
                  const target = batch?.targetQuantity || 0
                  const pct = target > 0 ? Math.round((produced / target) * 100) : 0

                  return (
                    <div key={line.lineId} className="border border-gray-100 rounded-xl p-4 space-y-3 hover:border-gray-200 transition-colors">
                      {/* Line header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                          <span className="text-sm font-semibold text-gray-900">{line.name}</span>
                        </div>
                        <span className="text-[11px] font-medium text-gray-400">{statusText}</span>
                      </div>

                      {batch ? (
                        <>
                          {/* Batch details */}
                          <div className="grid grid-cols-2 gap-y-2 text-[12px]">
                            <div>
                              <span className="text-gray-400">Batch</span>
                              <p className="font-mono font-semibold text-gray-800">{batch.batchNumber}</p>
                            </div>
                            <div>
                              <span className="text-gray-400">Operator</span>
                              <p className="font-medium text-gray-800">{batch.operatorName || 'â€”'}</p>
                            </div>
                            <div>
                              <span className="text-gray-400">Product</span>
                              <p className="font-medium text-gray-800 truncate pr-2">{batch.product || 'â€”'}</p>
                            </div>
                            <div>
                              <span className="text-gray-400">ETA</span>
                              <p className="font-medium text-gray-800">{isRunning ? '~2h' : 'â€”'}</p>
                            </div>
                          </div>
                          {/* Progress */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-gray-500 tabular-nums">{produced.toLocaleString()} / {target.toLocaleString()} cases</span>
                              <span className="font-semibold text-gray-700 tabular-nums">{pct}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${isRunning ? 'bg-blue-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400 py-3">No active batch</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* â”€â”€ Today's Batches â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-5">Today's Batches</h2>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      <th className="py-3 px-4">Batch</th>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Line</th>
                      <th className="py-3 px-4">Started</th>
                      <th className="py-3 px-4">Progress</th>
                      <th className="py-3 px-4">Operator</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {displayBatches.map((batch: any) => {
                      const pct = Math.round((batch.producedQuantity / batch.targetQuantity) * 100)
                      return (
                        <tr key={batch.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-gray-900">{batch.batchNumber}</td>
                          <td className="py-3 px-4 text-gray-600 truncate max-w-[160px]">{batch.product}</td>
                          <td className="py-3 px-4 text-gray-600">{batch.productionLineName}</td>
                          <td className="py-3 px-4 font-mono text-gray-500 text-[12px]">
                            {new Date(batch.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="font-mono text-[11px] font-semibold text-gray-500 tabular-nums">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{batch.operatorName || 'â€”'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                              batch.status === 'Active'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}>
                              {batch.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* â”€â”€ Quick Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quick Actions</h2>
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
                <button
                  onClick={() => {
                    if (productionLines.length > 0) setStartBatchLineId(productionLines[0].lineId)
                    if (allCatalogProducts.length > 0) setStartBatchProduct(allCatalogProducts[0].name)
                    setIsStartBatchModalOpen(true)
                  }}
                  className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer px-1"
                >
                  Start Batch
                </button>
                <span className="text-gray-300">&middot;</span>
                <button
                  onClick={() => {
                    if (dashboardRawMaterials.length > 0) setDashboardAdjustMatId(dashboardRawMaterials[0].id)
                    setIsDashboardAddInventoryOpen(true)
                  }}
                  className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer px-1"
                >
                  Add Inventory
                </button>
                <span className="text-gray-300">&middot;</span>
                <button onClick={() => setIsDashboardSalesOrderOpen(true)} className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer px-1">
                  Sales Order
                </button>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-10">

            {/* â”€â”€ Alerts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeAlertsCount > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Alerts <span className="text-red-500 font-bold">{activeAlertsCount}</span>
                </h2>
                <div className="space-y-3">
                  {stockLabels < 40000 && (
                    <div className="flex gap-3 items-start text-[13px]">
                      <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Labels stock low</p>
                        <p className="text-gray-500 text-xs mt-0.5">{stockLabels.toLocaleString()} units &bull; Below safe level</p>
                      </div>
                    </div>
                  )}
                  {stockPreforms < 50000 && (
                    <div className="flex gap-3 items-start text-[13px]">
                      <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Preforms stock low</p>
                        <p className="text-gray-500 text-xs mt-0.5">{stockPreforms.toLocaleString()} units &bull; Below safe level</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* â”€â”€ Inventory Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Raw Material Health</h2>
              <div className="space-y-4">
                {[
                  { name: 'Preforms', current: stockPreforms, safe: 50000 },
                  { name: 'Caps', current: stockCaps, safe: 100000 },
                  { name: 'Labels', current: stockLabels, safe: 40000 },
                  { name: 'Shrink Film', current: stockShrinkRolls, safe: 5000 },
                  { name: 'Finished Goods', current: stockFinishedGoods, safe: 10000 }
                ].map(item => {
                  const pct = Math.min(100, Math.round((item.current / item.safe) * 100))
                  const status = getStockStatus(item.current, item.safe)
                  return (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex justify-between items-baseline text-[13px]">
                        <span className="font-medium text-gray-800">{item.name}</span>
                        <span className={`text-[11px] font-semibold ${status.color}`}>{status.label}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`${status.barColor} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400 tabular-nums">
                        <span>{item.current.toLocaleString()}</span>
                        <span>/ {item.safe.toLocaleString()}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* â”€â”€ Pending Work â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Pending Work</h2>
              <div className="space-y-2.5">
                {[
                  { task: '18 orders awaiting dispatch', type: 'Dispatch' }
                ].map(item => (
                  <label key={item.task} className="flex gap-3 items-start cursor-pointer group py-0.5">
                    <input type="checkbox" className="mt-1 h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    <div>
                      <p className="text-[13px] font-medium text-gray-700 group-hover:text-gray-900 leading-snug">{item.task}</p>
                      <p className="text-[11px] text-gray-400 font-medium">{item.type}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {/* â”€â”€ Recent Activity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {[
                  { time: '09:22', text: 'Production started â€” Batch B-2026-A1' },
                  { time: '09:10', text: 'Purchase order received â€” PET Preforms' },
                  { time: '08:45', text: 'Maintenance completed â€” Labeler-B' },
                  { time: '08:20', text: 'Inventory updated â€” Caps restocked' },
                  { time: '08:00', text: 'Quality approved â€” Batch B-2025-C3' },
                  { time: '07:30', text: 'Dispatch completed â€” 1,200 cases to Apex' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 items-baseline text-[13px]">
                    <span className="text-[11px] font-mono text-gray-400 tabular-nums w-10 shrink-0">{item.time}</span>
                    <span className="text-gray-600">{item.text}</span>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* â”€â”€ Modals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}

      {/* Add Inventory */}
      <EnterpriseModal isOpen={isDashboardAddInventoryOpen} onClose={() => setIsDashboardAddInventoryOpen(false)} title="Add Inventory Stock">
        <form onSubmit={handleAdjustStockSubmit} className="flex flex-col gap-4">
          <EnterpriseSelect label="Raw Material *" value={dashboardAdjustMatId} onChange={(e) => setDashboardAdjustMatId(e.target.value)} required>
            {dashboardRawMaterials.map((mat: any) => (
              <option key={mat.id} value={mat.id}>{mat.name} ({mat.category})</option>
            ))}
          </EnterpriseSelect>
          <EnterpriseInput label="Quantity *" type="number" placeholder="e.g. 5000" value={dashboardAdjustQty} onChange={(e) => setDashboardAdjustQty(e.target.value)} required />
          <EnterpriseInput label="Notes" placeholder="Reason for adjustment" value={dashboardAdjustNotes} onChange={(e) => setDashboardAdjustNotes(e.target.value)} />
          <div className="flex gap-2 justify-end mt-2">
            <EnterpriseButton type="button" onClick={() => setIsDashboardAddInventoryOpen(false)} variant="secondary">Cancel</EnterpriseButton>
            <EnterpriseButton type="submit" loading={adjustStockMutation.isPending}>Update Stock</EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>




      {/* Sales Order */}
      <EnterpriseModal isOpen={isDashboardSalesOrderOpen} onClose={() => setIsDashboardSalesOrderOpen(false)} title="Create Sales Order">
        <form onSubmit={handleSalesOrderSubmit} className="flex flex-col gap-4">
          <EnterpriseInput label="Buyer *" value={dashboardSalesClient} onChange={(e) => setDashboardSalesClient(e.target.value)} required />
          <EnterpriseSelect label="Product *" value={dashboardSalesProduct} onChange={(e) => setDashboardSalesProduct(e.target.value)} required>
            {allCatalogProducts.map((prod: any) => (
              <option key={prod.id} value={prod.name}>{prod.name}</option>
            ))}
          </EnterpriseSelect>
          <div className="grid grid-cols-2 gap-4">
            <EnterpriseInput label="Quantity (Cases) *" type="number" placeholder="500" value={dashboardSalesQty} onChange={(e) => setDashboardSalesQty(e.target.value)} required />
            <EnterpriseInput label="Amount ($) *" type="number" placeholder="6000" value={dashboardSalesAmount} onChange={(e) => setDashboardSalesAmount(e.target.value)} required />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <EnterpriseButton type="button" onClick={() => setIsDashboardSalesOrderOpen(false)} variant="secondary">Cancel</EnterpriseButton>
            <EnterpriseButton type="submit">Create Order</EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

    </div>
  )
}
export default CompanyDashboardPage
