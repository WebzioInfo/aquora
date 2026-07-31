import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  CreditCard, Plus, Search, Filter, RefreshCw, Eye, Edit3, Copy, Archive, 
  Trash2, CheckCircle2, AlertTriangle, Check, Layers, Zap, Users, Shield, 
  ArrowUpRight, Clock, DollarSign, Database, Sparkles, Sliders, ChevronRight, X, History, Building2
} from 'lucide-react'
import { api } from '../../../services/api'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'

export interface SubscriptionPlan {
  id: string
  name: string
  code: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  offerPrice?: number | null
  discountPercent?: number | null
  currency: string
  billingCycle: string
  trialDays: number
  durationDays: number
  displayOrder: number
  isPopular: boolean
  isRecommended: boolean
  color: string
  status: 'Draft' | 'Published' | 'Archived' | 'Inactive' | 'Expired' | 'Hidden'
  taxType: string
  autoActivateTrial: boolean
  companiesUsingCount: number
  features: SubscriptionFeature[]
  limits: SubscriptionPlanLimits
  createdAt: string
  updatedAt?: string | null
}

export interface SubscriptionFeature {
  id?: string
  planId?: string
  featureName: string
  featureDescription?: string
  featureCategory: string
  featureValue: string
  featureUnit?: string
  displayOrder: number
  isHighlighted: boolean
  isUnlimited: boolean
}

export interface SubscriptionPlanLimits {
  id?: string
  planId?: string
  productionLines: number
  machines: number
  employees: number
  customers: number
  suppliers: number
  warehouses: number
  productionBatches: number
  products: number
  rawMaterials: number
  storageGB: number
  apiRequestsPerMin: number
  fileUploadSizeMB: number
  dailyExports: number
  concurrentUsers: number
  smsLimit: number
  emailLimit: number
}

export interface SubscriptionKpi {
  totalPlans: number
  publishedPlans: number
  activeSubscriptions: number
  expiringSoonSubscriptions: number
  trialPlans: number
  totalRevenue: number
}

const DEFAULT_LIMITS: SubscriptionPlanLimits = {
  productionLines: 3,
  machines: 10,
  employees: 25,
  customers: 100,
  suppliers: 50,
  warehouses: 2,
  productionBatches: 500,
  products: 100,
  rawMaterials: 200,
  storageGB: 50,
  apiRequestsPerMin: 1000,
  fileUploadSizeMB: 25,
  dailyExports: 50,
  concurrentUsers: 10,
  smsLimit: 100,
  emailLimit: 1000
}

export const SubscriptionManagementTab: React.FC = () => {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [billingFilter, setBillingFilter] = useState('All')
  const [badgeFilter, setBadgeFilter] = useState<'All' | 'Popular' | 'Recommended'>('All')

  // Modals & Drawers State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'pricing' | 'limits' | 'features'>('general')

  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false)
  const [newFeature, setNewFeature] = useState<SubscriptionFeature>({
    featureName: '',
    featureDescription: '',
    featureCategory: 'Core Modules',
    featureValue: 'Yes',
    featureUnit: '',
    displayOrder: 1,
    isHighlighted: false,
    isUnlimited: false
  })

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignForm, setAssignForm] = useState({
    tenantId: '',
    planId: '',
    billingCycle: 'Monthly',
    customPrice: '',
    durationDays: '30',
    autoRenew: true,
    startTrial: false
  })

  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false)
  const [selectedPlanForView, setSelectedPlanForView] = useState<SubscriptionPlan | null>(null)

  // Plan Form State
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({
    name: '',
    code: '',
    description: '',
    monthlyPrice: 199,
    yearlyPrice: 1990,
    offerPrice: null,
    discountPercent: null,
    currency: 'USD',
    billingCycle: 'Monthly',
    trialDays: 14,
    durationDays: 30,
    displayOrder: 1,
    isPopular: false,
    isRecommended: false,
    color: '#3B82F6',
    status: 'Published',
    taxType: 'Tax Exclusive',
    autoActivateTrial: true,
    features: [],
    limits: { ...DEFAULT_LIMITS }
  })

  // Queries
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['subscriptionPlans', search, statusFilter, billingFilter, badgeFilter],
    queryFn: async () => {
      const res = await api.get('/api/v1/subscriptions/plans', {
        params: {
          search: search || undefined,
          statusFilter: statusFilter !== 'All' ? statusFilter : undefined,
          billingCycleFilter: billingFilter !== 'All' ? billingFilter : undefined,
          isPopularFilter: badgeFilter === 'Popular' ? true : undefined,
          isRecommendedFilter: badgeFilter === 'Recommended' ? true : undefined,
          pageSize: 50
        }
      })
      return res.data?.data?.items || []
    }
  })

  const { data: kpis } = useQuery<SubscriptionKpi>({
    queryKey: ['subscriptionKpis'],
    queryFn: async () => {
      const res = await api.get('/api/v1/subscriptions/kpis')
      return res.data?.data || {
        totalPlans: 0,
        publishedPlans: 0,
        activeSubscriptions: 0,
        expiringSoonSubscriptions: 0,
        trialPlans: 0,
        totalRevenue: 0
      }
    }
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['subscriptionAuditLogs'],
    queryFn: async () => {
      const res = await api.get('/api/v1/subscriptions/audit-logs')
      return res.data?.data || []
    },
    enabled: isAuditDrawerOpen
  })

  const { data: tenantsList = [] } = useQuery({
    queryKey: ['tenantsDropdownList'],
    queryFn: async () => {
      const res = await api.get('/api/v1/platform/tenants', { params: { pageSize: 100 } })
      return res.data?.data?.items || []
    },
    enabled: isAssignModalOpen
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => api.post('/api/v1/subscriptions/plans', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptionKpis'] })
      setIsPlanModalOpen(false)
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => api.put(`/api/v1/subscriptions/plans/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptionKpis'] })
      setIsPlanModalOpen(false)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/v1/subscriptions/plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptionKpis'] })
    }
  })

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/api/v1/subscriptions/plans/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptionKpis'] })
    }
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.patch(`/api/v1/subscriptions/plans/${id}/status`, null, { params: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptionKpis'] })
    }
  })

  const assignMutation = useMutation({
    mutationFn: async (payload: any) => api.post('/api/v1/subscriptions/assign', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionKpis'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] })
      setIsAssignModalOpen(false)
    }
  })

  // Handlers
  const handleOpenCreateModal = () => {
    setEditingPlan(null)
    setFormData({
      name: '',
      code: '',
      description: '',
      monthlyPrice: 199,
      yearlyPrice: 1990,
      offerPrice: null,
      discountPercent: null,
      currency: 'USD',
      billingCycle: 'Monthly',
      trialDays: 14,
      durationDays: 30,
      displayOrder: 1,
      isPopular: false,
      isRecommended: false,
      color: '#3B82F6',
      status: 'Published',
      taxType: 'Tax Exclusive',
      autoActivateTrial: true,
      features: [],
      limits: { ...DEFAULT_LIMITS }
    })
    setActiveTab('general')
    setIsPlanModalOpen(true)
  }

  const handleOpenEditModal = (plan: SubscriptionPlan) => {
    setEditingPlan(plan)
    setFormData({
      ...plan,
      features: [...(plan.features || [])],
      limits: plan.limits ? { ...plan.limits } : { ...DEFAULT_LIMITS }
    })
    setActiveTab('general')
    setIsPlanModalOpen(true)
  }

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return

    const payload = {
      ...formData,
      code: formData.code || formData.name.toUpperCase().replace(/\s+/g, '_'),
      features: formData.features || [],
      limits: formData.limits || DEFAULT_LIMITS
    }

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleAddFeatureSubmit = () => {
    if (!newFeature.featureName) return
    const updatedFeatures = [...(formData.features || []), { ...newFeature, displayOrder: (formData.features?.length || 0) + 1 }]
    setFormData({ ...formData, features: updatedFeatures })
    setNewFeature({
      featureName: '',
      featureDescription: '',
      featureCategory: 'Core Modules',
      featureValue: 'Yes',
      featureUnit: '',
      displayOrder: 1,
      isHighlighted: false,
      isUnlimited: false
    })
    setIsFeatureModalOpen(false)
  }

  const handleRemoveFeature = (idx: number) => {
    const updated = (formData.features || []).filter((_, i) => i !== idx)
    setFormData({ ...formData, features: updated })
  }

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignForm.tenantId || !assignForm.planId) return
    assignMutation.mutate({
      tenantId: assignForm.tenantId,
      planId: assignForm.planId,
      billingCycle: assignForm.billingCycle,
      customPrice: assignForm.customPrice ? parseFloat(assignForm.customPrice) : null,
      durationDays: parseInt(assignForm.durationDays || '30'),
      autoRenew: assignForm.autoRenew,
      startTrial: assignForm.startTrial
    })
  }

  const plans: SubscriptionPlan[] = plansData || []

  return (
    <div className="flex flex-col gap-6 select-none bg-[#F8FAFC] min-h-screen -m-6 p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Subscription Management & Pricing Engine</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">Configure multi-tenant SaaS tiers, dynamic feature flags, resource quotas, and billing terms.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setIsAuditDrawerOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-2 border border-slate-200"
          >
            <History className="w-4 h-4 text-slate-600" /> Audit Log
          </button>
          
          <button 
            onClick={() => setIsAssignModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 text-xs font-semibold rounded-xl transition flex items-center gap-2 border border-emerald-200"
          >
            <Building2 className="w-4 h-4 text-emerald-600" /> Assign Company Plan
          </button>

          <button 
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Create New Tier Plan
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Tiers</span>
          <span className="text-2xl font-bold text-slate-900 mt-1">{kpis?.totalPlans ?? 0}</span>
          <span className="text-[10px] text-slate-400 mt-1">Configured in DB</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Published</span>
          <span className="text-2xl font-bold text-emerald-600 mt-1">{kpis?.publishedPlans ?? 0}</span>
          <span className="text-[10px] text-emerald-600/80 mt-1">Available for tenants</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Active Tenants</span>
          <span className="text-2xl font-bold text-blue-600 mt-1">{kpis?.activeSubscriptions ?? 0}</span>
          <span className="text-[10px] text-blue-500 mt-1">Subscribed companies</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Expiring Soon</span>
          <span className="text-2xl font-bold text-amber-600 mt-1">{kpis?.expiringSoonSubscriptions ?? 0}</span>
          <span className="text-[10px] text-amber-600/80 mt-1">&lt; 7 Days Remaining</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">Trial Users</span>
          <span className="text-2xl font-bold text-purple-600 mt-1">{kpis?.trialPlans ?? 0}</span>
          <span className="text-[10px] text-purple-500 mt-1">Free 14-day trials</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs flex flex-col justify-between bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
          <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Total Revenue</span>
          <span className="text-2xl font-bold text-slate-900 mt-1">${kpis?.totalRevenue?.toLocaleString() ?? 0}</span>
          <span className="text-[10px] text-emerald-600 font-medium mt-1">Active MRR</span>
        </div>
      </div>

      {/* Search & Controls Toolbar */}
      <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plan name, code, feature..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-medium focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">All Statuses</option>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
              <option value="Archived">Archived</option>
              <option value="Inactive">Inactive</option>
            </select>

            <select
              value={billingFilter}
              onChange={(e) => setBillingFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-medium focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">All Billing Cycles</option>
              <option value="Monthly">Monthly</option>
              <option value="Yearly">Yearly</option>
              <option value="Lifetime">Lifetime</option>
            </select>

            <select
              value={badgeFilter}
              onChange={(e) => setBadgeFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-medium focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">All Badges</option>
              <option value="Popular">Popular Only</option>
              <option value="Recommended">Recommended Only</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Tier Cards View
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Data Table View
          </button>
        </div>
      </div>

      {/* Main View Display */}
      {plansLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-2" />
          <span className="text-xs text-slate-500 font-medium">Loading enterprise subscription tiers from database...</span>
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl text-center">
          <CreditCard className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Subscription Plans Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">No plans matched your criteria. Create a new subscription tier to get started.</p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-xs hover:bg-blue-700 transition"
          >
            + Create Subscription Plan
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID TIER CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const limits = plan.limits || DEFAULT_LIMITS
            return (
              <div 
                key={plan.id}
                className={`bg-white rounded-2xl border p-6 flex flex-col justify-between relative shadow-xs hover:shadow-md transition group ${
                  plan.isPopular ? 'border-2 border-blue-600' : 'border-slate-200'
                }`}
              >
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1.5 absolute top-3 right-3">
                  {plan.isPopular && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Popular
                    </span>
                  )}
                  {plan.isRecommended && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Recommended
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color || '#3B82F6' }} />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{plan.name}</span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                      ${plan.monthlyPrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">/ {plan.billingCycle.toLowerCase()}</span>
                  </div>

                  {plan.yearlyPrice > 0 && (
                    <p className="text-[11px] text-slate-400 mt-0.5">Or ${plan.yearlyPrice.toLocaleString()} billed yearly</p>
                  )}

                  <p className="text-xs text-slate-600 leading-relaxed mt-3 line-clamp-2">{plan.description}</p>

                  <div className="my-4 pt-4 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="font-medium text-slate-500">Production Lines:</span>
                      <span className="font-bold">{limits.productionLines === -1 ? 'Unlimited' : limits.productionLines}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="font-medium text-slate-500">Active Machines:</span>
                      <span className="font-bold">{limits.machines === -1 ? 'Unlimited' : limits.machines}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="font-medium text-slate-500">Employee Accounts:</span>
                      <span className="font-bold">{limits.employees === -1 ? 'Unlimited' : limits.employees}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="font-medium text-slate-500">Storage Quota:</span>
                      <span className="font-bold">{limits.storageGB === -1 ? 'Unlimited' : `${limits.storageGB} GB`}</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Included Features</span>
                    {(plan.features || []).slice(0, 5).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className={feat.isHighlighted ? 'font-bold text-slate-900' : ''}>
                          {feat.featureName} {feat.featureValue !== 'Yes' ? `(${feat.featureValue})` : ''}
                        </span>
                      </div>
                    ))}
                    {(plan.features?.length || 0) > 5 && (
                      <span className="text-[11px] font-semibold text-blue-600 block pt-1">+ {(plan.features?.length || 0) - 5} more features</span>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 mt-6 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <EnterpriseBadge variant={plan.status === 'Published' ? 'success' : plan.status === 'Draft' ? 'gray' : 'warning'}>
                      {plan.status}
                    </EnterpriseBadge>

                    <span className="text-[11px] font-medium text-slate-500">
                      {plan.companiesUsingCount} Companies
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    <button
                      onClick={() => handleOpenEditModal(plan)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>

                    <button
                      onClick={() => duplicateMutation.mutate(plan.id)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> Clone
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete or archive '${plan.name}'?`)) {
                          deleteMutation.mutate(plan.id)
                        }
                      }}
                      className="py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* DATA TABLE VIEW */
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Plan Name &amp; Code</th>
                <th className="py-3.5 px-4">Price &amp; Billing</th>
                <th className="py-3.5 px-4">Duration &amp; Trial</th>
                <th className="py-3.5 px-4 text-center">Resource Limits</th>
                <th className="py-3.5 px-4 text-center">Active Tenants</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.map((p) => {
                const limits = p.limits || DEFAULT_LIMITS
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color || '#3B82F6' }} />
                        <div>
                          <span className="font-bold text-slate-900 block text-xs">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{p.code}</span>
                        </div>
                        {p.isPopular && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">POPULAR</span>}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-slate-900 block">${p.monthlyPrice} / mo</span>
                      <span className="text-[10px] text-slate-400">Yearly: ${p.yearlyPrice}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-700 block">{p.durationDays} Days</span>
                      <span className="text-[10px] text-slate-400">{p.trialDays} Days Free Trial</span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                        <span>{limits.productionLines === -1 ? '∞' : limits.productionLines} Lines</span> • 
                        <span>{limits.machines === -1 ? '∞' : limits.machines} Machines</span> • 
                        <span>{limits.employees === -1 ? '∞' : limits.employees} Emps</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                      {p.companiesUsingCount} Companies
                    </td>

                    <td className="py-3.5 px-4">
                      <EnterpriseBadge variant={p.status === 'Published' ? 'success' : p.status === 'Draft' ? 'gray' : 'warning'}>
                        {p.status}
                      </EnterpriseBadge>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition"
                          title="Edit Plan"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => duplicateMutation.mutate(p.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition"
                          title="Duplicate Plan"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => statusMutation.mutate({ id: p.id, status: p.status === 'Published' ? 'Archived' : 'Published' })}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition"
                          title={p.status === 'Published' ? 'Archive Plan' : 'Publish Plan'}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete plan '${p.name}'?`)) deleteMutation.mutate(p.id)
                          }}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 hover:text-red-700 transition"
                          title="Delete Plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MULTI-TAB PLAN CREATE/EDIT MODAL */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingPlan ? `Edit Subscription Plan: ${editingPlan.name}` : 'Create Subscription Plan'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure billing, pricing, resource limits, and tier features.</p>
              </div>
              <button 
                onClick={() => setIsPlanModalOpen(false)}
                className="p-1.5 hover:bg-slate-200/70 rounded-lg text-slate-500 hover:text-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs Bar */}
            <div className="flex items-center gap-2 px-5 border-b border-slate-200 bg-white">
              <button
                onClick={() => setActiveTab('general')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                General Details
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${activeTab === 'pricing' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                Pricing &amp; Billing
              </button>
              <button
                onClick={() => setActiveTab('limits')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${activeTab === 'limits' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                Resource Quotas &amp; Limits
              </button>
              <button
                onClick={() => setActiveTab('features')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${activeTab === 'features' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                Feature Checklist ({formData.features?.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePlan} className="p-6 overflow-y-auto flex-1 space-y-5">
              {activeTab === 'general' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Plan Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Professional"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Plan Unique Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. PRO_TIER"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900 focus:ring-2 focus:ring-blue-500/20 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe the plan benefits for customers..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                    <select
                      value={formData.status || 'Published'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900"
                    >
                      <option value="Published">Published</option>
                      <option value="Draft">Draft</option>
                      <option value="Archived">Archived</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Brand Color Accent</label>
                    <input
                      type="color"
                      value={formData.color || '#3B82F6'}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full h-9 p-1 border border-slate-200 rounded-xl bg-white cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-6 pt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isPopular || false}
                        onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Mark as Popular Tier
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isRecommended || false}
                        onChange={(e) => setFormData({ ...formData, isRecommended: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Mark as Recommended
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'pricing' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.monthlyPrice ?? 0}
                      onChange={(e) => setFormData({ ...formData, monthlyPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Yearly Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.yearlyPrice ?? 0}
                      onChange={(e) => setFormData({ ...formData, yearlyPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Billing Cycle</label>
                    <select
                      value={formData.billingCycle || 'Monthly'}
                      onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Yearly">Yearly</option>
                      <option value="Lifetime">Lifetime</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Trial Period (Days)</label>
                    <input
                      type="number"
                      value={formData.trialDays ?? 14}
                      onChange={(e) => setFormData({ ...formData, trialDays: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Plan Duration (Days)</label>
                    <input
                      type="number"
                      value={formData.durationDays ?? 30}
                      onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tax Configuration</label>
                    <select
                      value={formData.taxType || 'Tax Exclusive'}
                      onChange={(e) => setFormData({ ...formData, taxType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                    >
                      <option value="Tax Exclusive">Tax Exclusive</option>
                      <option value="Tax Included">Tax Included</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'limits' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Production Lines (-1 = ∞)</label>
                    <input
                      type="number"
                      value={formData.limits?.productionLines ?? 3}
                      onChange={(e) => setFormData({ ...formData, limits: { ...formData.limits!, productionLines: parseInt(e.target.value) || 0 } })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Active Machines</label>
                    <input
                      type="number"
                      value={formData.limits?.machines ?? 10}
                      onChange={(e) => setFormData({ ...formData, limits: { ...formData.limits!, machines: parseInt(e.target.value) || 0 } })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Employee Accounts</label>
                    <input
                      type="number"
                      value={formData.limits?.employees ?? 25}
                      onChange={(e) => setFormData({ ...formData, limits: { ...formData.limits!, employees: parseInt(e.target.value) || 0 } })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Storage Quota (GB)</label>
                    <input
                      type="number"
                      value={formData.limits?.storageGB ?? 50}
                      onChange={(e) => setFormData({ ...formData, limits: { ...formData.limits!, storageGB: parseInt(e.target.value) || 0 } })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">API Requests / min</label>
                    <input
                      type="number"
                      value={formData.limits?.apiRequestsPerMin ?? 1000}
                      onChange={(e) => setFormData({ ...formData, limits: { ...formData.limits!, apiRequestsPerMin: parseInt(e.target.value) || 0 } })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Concurrent Users</label>
                    <input
                      type="number"
                      value={formData.limits?.concurrentUsers ?? 10}
                      onChange={(e) => setFormData({ ...formData, limits: { ...formData.limits!, concurrentUsers: parseInt(e.target.value) || 0 } })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'features' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Features Included in Tier</span>
                    <button
                      type="button"
                      onClick={() => setIsFeatureModalOpen(true)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold rounded-lg transition flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Feature
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                    {(formData.features || []).length === 0 ? (
                      <p className="p-4 text-xs text-slate-400 text-center">No custom features added yet.</p>
                    ) : (
                      formData.features?.map((feat, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{feat.featureName}</span>
                            <span className="text-[10px] text-slate-400">{feat.featureCategory} • Value: {feat.featureValue}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {feat.isHighlighted && <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">HIGHLIGHT</span>}
                            <button
                              type="button"
                              onClick={() => handleRemoveFeature(idx)}
                              className="p-1 text-red-500 hover:text-red-700 transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Subscription Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FEATURE BUILDER MODAL */}
      {isFeatureModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">Add Feature to Tier</h4>
              <button onClick={() => setIsFeatureModalOpen(false)}><X className="w-4 h-4 text-slate-500" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Feature Name *</label>
                <input
                  type="text"
                  value={newFeature.featureName}
                  onChange={(e) => setNewFeature({ ...newFeature, featureName: e.target.value })}
                  placeholder="e.g. Automated Shift Reports"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={newFeature.featureCategory}
                  onChange={(e) => setNewFeature({ ...newFeature, featureCategory: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="Core Modules">Core Modules</option>
                  <option value="Analytics & Reports">Analytics &amp; Reports</option>
                  <option value="Security & Support">Security &amp; Support</option>
                  <option value="Integrations">Integrations</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Feature Value / Limit</label>
                <input
                  type="text"
                  value={newFeature.featureValue}
                  onChange={(e) => setNewFeature({ ...newFeature, featureValue: e.target.value })}
                  placeholder="e.g. Yes, 500 GB, Unlimited"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFeature.isHighlighted}
                    onChange={(e) => setNewFeature({ ...newFeature, isHighlighted: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  Highlight Feature
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFeatureModalOpen(false)}
                className="px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFeatureSubmit}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg"
              >
                Add Feature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN PLAN TO COMPANY MODAL */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Assign Subscription Plan to Company</h3>
              <button onClick={() => setIsAssignModalOpen(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Company *</label>
                <select
                  required
                  value={assignForm.tenantId}
                  onChange={(e) => setAssignForm({ ...assignForm, tenantId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium"
                >
                  <option value="">-- Select Tenant Company --</option>
                  {tenantsList.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subscription Tier Plan *</label>
                <select
                  required
                  value={assignForm.planId}
                  onChange={(e) => setAssignForm({ ...assignForm, planId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium"
                >
                  <option value="">-- Select Subscription Tier --</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (${p.monthlyPrice}/mo)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Billing Cycle</label>
                  <select
                    value={assignForm.billingCycle}
                    onChange={(e) => setAssignForm({ ...assignForm, billingCycle: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    value={assignForm.durationDays}
                    onChange={(e) => setAssignForm({ ...assignForm, durationDays: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition"
                >
                  {assignMutation.isPending ? 'Assigning...' : 'Assign Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT LOG DRAWER */}
      {isAuditDrawerOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 flex flex-col space-y-4 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Subscription Audit Trail</h3>
                <p className="text-xs text-slate-500">Real-time log of plan edits, price updates, &amp; assignments.</p>
              </div>
              <button onClick={() => setIsAuditDrawerOpen(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 divide-y divide-slate-100">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center pt-8">No audit logs recorded yet.</p>
              ) : (
                auditLogs.map((log: any) => (
                  <div key={log.id} className="pt-3 first:pt-0 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span className="text-blue-600">{log.action}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700">{log.reason}</p>
                    <span className="text-[10px] text-slate-400 block">By: {log.performerUserEmail}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default SubscriptionManagementTab
