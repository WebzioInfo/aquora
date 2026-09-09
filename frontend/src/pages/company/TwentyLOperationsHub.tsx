import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Truck, Package, Layers, RefreshCw, CheckCircle, AlertCircle, Plus,
  DollarSign, Shield, ChevronRight, X, FileText, Search,
  ArrowRight, Check, Activity, Box,
  Clock, Settings, AlertTriangle, Play, Wrench, ShieldAlert,
  ArrowUpRight, ArrowDownLeft, RotateCcw, MapPin, Phone,
  Building2, Store, Smartphone, Route, Users, TrendingUp, Edit3, Trash2,
  CheckSquare, Calendar, Navigation
} from 'lucide-react'
import { twentyLService } from '../../services/twentyL'
import type {
  DistributorSupply, DistributorRoute, DistributorVehicle,
  DistributorDriver, DistributorCustomer, DistributorDelivery,
  RateRule, TwentyLDeliveryItem
} from '../../services/twentyL'
import { api } from '../../services/api'
import { useNotificationStore } from '../../store/useNotificationStore'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseButton from '../../components/ui/EnterpriseButton'
import EnterpriseModal from '../../components/ui/EnterpriseModal'

export const TwentyLOperationsHub: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()

  // 1. Primary Hub Tier Switcher
  const [activeTier, setActiveTier] = useState<
    'COMPANY_SUPPLY' | 'DISTRIBUTOR_PORTAL' | 'DRIVER_TERMINAL' | 'TRIPS_OPERATIONS' | 'LEDGER_AUDIT'
  >('COMPANY_SUPPLY')

  // Sub-tabs for Distributor Portal
  const [distributorSubTab, setDistributorSubTab] = useState<'CUSTOMERS' | 'ROUTES_FLEET' | 'DELIVERIES' | 'SETTLEMENTS'>('CUSTOMERS')

  // Sub-tabs for Trips & Operations
  const [opsSubTab, setOpsSubTab] = useState<'TRIPS' | 'DELIVERIES' | 'QUALITY' | 'RATE_RULES'>('TRIPS')

  // Selected Distributor for Portal & Driver views
  const [selectedDistributorId, setSelectedDistributorId] = useState<string>('')

  // Modals for Upstream Company & Distributor Downstream Workflows
  const [isDistributorSupplyModalOpen, setIsDistributorSupplyModalOpen] = useState(false)
  const [isDistributorCustomerModalOpen, setIsDistributorCustomerModalOpen] = useState(false)
  const [isDistributorRouteModalOpen, setIsDistributorRouteModalOpen] = useState(false)
  const [isDistributorVehicleModalOpen, setIsDistributorVehicleModalOpen] = useState(false)
  const [isDistributorDriverModalOpen, setIsDistributorDriverModalOpen] = useState(false)
  const [isDistributorDeliveryModalOpen, setIsDistributorDeliveryModalOpen] = useState(false)
  const [isDriverDeliverModalOpen, setIsDriverDeliverModalOpen] = useState(false)
  const [selectedDriverStop, setSelectedDriverStop] = useState<any | null>(null)

  // Modals for Trips & Quality
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false)
  const [isLoadingTripModalOpen, setIsLoadingTripModalOpen] = useState(false)
  const [isDeliverStopModalOpen, setIsDeliverStopModalOpen] = useState(false)
  const [isReturnTripModalOpen, setIsReturnTripModalOpen] = useState(false)
  const [isAllAtOnceModalOpen, setIsAllAtOnceModalOpen] = useState(false)
  const [isQuickOpsModalOpen, setIsQuickOpsModalOpen] = useState(false)
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false)
  const [isNewRateRuleModalOpen, setIsNewRateRuleModalOpen] = useState(false)

  // Selected Entities
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null)
  const [selectedTripStop, setSelectedTripStop] = useState<any | null>(null)

  // Master Data
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          api.get('/api/v1/customers?pageSize=1000'),
          api.get('/api/v1/products?pageSize=1000')
        ])
        const custList = cRes.data?.data?.items || []
        setCustomers(custList)
        setProducts(pRes.data?.data?.items || [])

        if (custList.length > 0 && !selectedDistributorId) {
          setSelectedDistributorId(custList[0].id)
        }
      } catch (err) {
        console.error('Failed to load customers/products', err)
      }
    }
    fetchMasters()
  }, [])

  // ==========================================
  // QUERIES
  // ==========================================

  // 1. Plant Network Stock Balances
  const { data: plantBalances, refetch: refetchPlantBalances } = useQuery({
    queryKey: ['20lPlantBalances'],
    queryFn: twentyLService.getPlantBalances,
    refetchInterval: 15000
  })

  // 2. Upstream Company -> Distributor Supplies
  const { data: suppliesData, isLoading: isSuppliesLoading, refetch: refetchSupplies } = useQuery({
    queryKey: ['20lDistributorSupplies'],
    queryFn: () => twentyLService.getDistributorSupplies({ pageSize: 50 }),
    enabled: activeTier === 'COMPANY_SUPPLY'
  })

  // 3. Distributor Downstream Dashboard
  const { data: distributorDashboard, isLoading: isDistributorDashboardLoading, refetch: refetchDistributorDashboard } = useQuery({
    queryKey: ['20lDistributorDashboard', selectedDistributorId],
    queryFn: () => twentyLService.getDistributorDashboard(selectedDistributorId),
    enabled: !!selectedDistributorId && activeTier === 'DISTRIBUTOR_PORTAL'
  })

  // 4. Distributor Customers
  const { data: distCustomers, refetch: refetchDistCustomers } = useQuery({
    queryKey: ['20lDistCustomers', selectedDistributorId],
    queryFn: () => twentyLService.getDistributorCustomers(selectedDistributorId),
    enabled: !!selectedDistributorId && activeTier === 'DISTRIBUTOR_PORTAL'
  })

  // 5. Distributor Routes
  const { data: distRoutes, refetch: refetchDistRoutes } = useQuery({
    queryKey: ['20lDistRoutes', selectedDistributorId],
    queryFn: () => twentyLService.getDistributorRoutes(selectedDistributorId),
    enabled: !!selectedDistributorId && activeTier === 'DISTRIBUTOR_PORTAL'
  })

  // 6. Distributor Vehicles
  const { data: distVehicles, refetch: refetchDistVehicles } = useQuery({
    queryKey: ['20lDistVehicles', selectedDistributorId],
    queryFn: () => twentyLService.getDistributorVehicles(selectedDistributorId),
    enabled: !!selectedDistributorId && activeTier === 'DISTRIBUTOR_PORTAL'
  })

  // 7. Distributor Drivers
  const { data: distDrivers, refetch: refetchDistDrivers } = useQuery({
    queryKey: ['20lDistDrivers', selectedDistributorId],
    queryFn: () => twentyLService.getDistributorDrivers(selectedDistributorId),
    enabled: !!selectedDistributorId && activeTier === 'DISTRIBUTOR_PORTAL'
  })

  // 8. Distributor Deliveries
  const { data: distDeliveriesData, refetch: refetchDistDeliveries } = useQuery({
    queryKey: ['20lDistDeliveries', selectedDistributorId],
    queryFn: () => twentyLService.getDistributorDeliveries(selectedDistributorId),
    enabled: !!selectedDistributorId && activeTier === 'DISTRIBUTOR_PORTAL'
  })

  // 9. Driver Mobile Portal Query
  const { data: driverPortalData, refetch: refetchDriverPortal } = useQuery({
    queryKey: ['20lDriverPortal', selectedDistributorId],
    queryFn: () => twentyLService.getDriverPortalToday({ distributorId: selectedDistributorId }),
    enabled: activeTier === 'DRIVER_TERMINAL'
  })

  // 10. Trips Query (Operations)
  const { data: tripsData, isLoading: isTripsLoading, refetch: refetchTrips } = useQuery({
    queryKey: ['20lTrips'],
    queryFn: () => twentyLService.getTrips({ pageSize: 50 }),
    enabled: activeTier === 'TRIPS_OPERATIONS'
  })

  // 11. Rate Rules Query
  const { data: rateRulesData, refetch: refetchRateRules } = useQuery({
    queryKey: ['20lRateRules'],
    queryFn: () => twentyLService.getRateRules({}),
    enabled: activeTier === 'TRIPS_OPERATIONS' || activeTier === 'COMPANY_SUPPLY'
  })

  // 12. Quality Inspections Query
  const { data: inspectionsData, refetch: refetchInspections } = useQuery({
    queryKey: ['20lInspections'],
    queryFn: () => twentyLService.getInspections({ pageSize: 50 }),
    enabled: activeTier === 'TRIPS_OPERATIONS' || activeTier === 'LEDGER_AUDIT'
  })

  // 13. Ledger Movements Query
  const { data: movementsData, refetch: refetchMovements } = useQuery({
    queryKey: ['20lMovements'],
    queryFn: () => twentyLService.getMovements({ pageSize: 100 }),
    enabled: activeTier === 'LEDGER_AUDIT'
  })

  // 14. Reconciliation Audit Query
  const { data: reconcileData, refetch: refetchReconciliation } = useQuery({
    queryKey: ['20lReconciliation'],
    queryFn: twentyLService.reconcile,
    enabled: activeTier === 'LEDGER_AUDIT'
  })

  const refreshAll = () => {
    refetchPlantBalances()
    refetchSupplies()
    refetchDistributorDashboard()
    refetchDistCustomers()
    refetchDistRoutes()
    refetchDistVehicles()
    refetchDistDrivers()
    refetchDistDeliveries()
    refetchDriverPortal()
    refetchTrips()
    refetchRateRules()
    refetchInspections()
    refetchMovements()
    refetchReconciliation()
  }

  // ==========================================
  // FORM STATES
  // ==========================================

  // Company -> Distributor Supply Form
  const [supplyForm, setSupplyForm] = useState({
    distributorId: '',
    productId: '',
    quantityRequested: 100,
    quantitySupplied: 100,
    quantityEmptyReturned: 20,
    quantityDamaged: 0,
    appliedRate: 25,
    amountPaid: 2500,
    paymentMode: 'CASH',
    vehicleNumber: 'KL-07-BW-4040',
    driverName: 'Ramesh Driver',
    dispatcherNotes: 'Factory dispatch'
  })

  // Distributor Customer Form
  const [customerForm, setCustomerForm] = useState({
    customerName: '',
    phone: '',
    address: '',
    area: 'Town Center',
    routeId: '',
    deliveryFrequency: 'DAILY',
    defaultRate: 40,
    assignedDriverName: '',
    assignedVehicleNumber: '',
    openingFilledJars: 2,
    openingEmptyJars: 1,
    securityDeposit: 500,
    openingBalance: 0
  })

  // Distributor Route Form
  const [routeForm, setRouteForm] = useState({
    routeCode: 'RT-01',
    routeName: 'Town Area North',
    areaDescription: 'Commercial Main Road',
    defaultDriverName: 'Suresh Driver',
    defaultVehicleNumber: 'KL-07-CW-5050',
    scheduleDays: 'DAILY'
  })

  // Distributor Vehicle Form
  const [vehicleForm, setVehicleForm] = useState({
    registrationNumber: 'KL-07-EX-1010',
    vehicleType: 'MINI_TRUCK',
    capacityJars: 60,
    assignedDriverName: 'Ramesh Driver'
  })

  // Distributor Driver Form
  const [driverForm, setDriverForm] = useState({
    driverName: '',
    phone: '',
    licenseNumber: '',
    assignedVehicleNumber: ''
  })

  // Distributor Customer Delivery Form
  const [distDeliveryForm, setDistDeliveryForm] = useState({
    distributorCustomerId: '',
    quantityFilledDelivered: 5,
    quantityEmptyCollected: 4,
    quantityDamaged: 0,
    sellingRate: 40,
    amountCollected: 200,
    paymentMode: 'CASH',
    driverName: '',
    vehicleNumber: '',
    notes: 'Morning drop'
  })

  // Driver 1-Tap Delivery Form
  const [driverActionForm, setDriverActionForm] = useState({
    quantityFilledDelivered: 5,
    quantityEmptyCollected: 4,
    quantityDamaged: 0,
    sellingRate: 40,
    amountCollected: 200,
    paymentMode: 'CASH',
    notes: ''
  })

  // Trip Form States
  const [tripForm, setTripForm] = useState({
    driverName: '',
    vehicleNumber: '',
    routeCode: '',
    plannedDate: new Date().toISOString().split('T')[0],
    stops: [{ customerId: '', plannedFilledJars: 20, unitRate: 35, paymentMode: 'CREDIT' }]
  })

  const [loadTripForm, setLoadTripForm] = useState({ filledQuantity: 100, emptyQuantity: 20, notes: '' })
  const [stopDeliveryForm, setStopDeliveryForm] = useState({ deliveredFilledJars: 20, collectedEmptyJars: 18, damagedEmptyJars: 0, lostJars: 0, manualUnitRate: 35, amountCollected: 700, paymentMode: 'CASH', notes: '' })
  const [returnTripForm, setReturnTripForm] = useState({ returnedFilledJars: 0, returnedEmptyJars: 0, damagedJarsCount: 0, lostJarsCount: 0, damageReason: '', notes: '' })

  const [isSubmitting, setIsSubmitting] = useState(false)

  // ==========================================
  // HANDLERS
  // ==========================================

  // 1. Create Distributor Supply (Company -> Distributor)
  const handleCreateDistributorSupply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplyForm.distributorId) {
      showToast('Please select a distributor.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await twentyLService.createDistributorSupply({
        distributorId: supplyForm.distributorId,
        productId: supplyForm.productId || (products[0]?.id || ''),
        quantityRequested: Number(supplyForm.quantityRequested),
        quantitySupplied: Number(supplyForm.quantitySupplied),
        quantityEmptyReturned: Number(supplyForm.quantityEmptyReturned),
        quantityDamaged: Number(supplyForm.quantityDamaged),
        appliedRate: Number(supplyForm.appliedRate),
        amountPaid: Number(supplyForm.amountPaid),
        paymentMode: supplyForm.paymentMode,
        vehicleNumber: supplyForm.vehicleNumber,
        driverName: supplyForm.driverName,
        dispatcherNotes: supplyForm.dispatcherNotes
      })
      showToast('Distributor supply dispatched! Plant inventory decremented & distributor depot stocked.', 'success')
      setIsDistributorSupplyModalOpen(false)
      refreshAll()
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Supply dispatch failed', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 2. Create Distributor Customer
  const handleCreateDistCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerForm.customerName) {
      showToast('Customer Name is required.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await twentyLService.createDistributorCustomer(selectedDistributorId, customerForm)
      showToast('Downstream distributor customer created successfully.', 'success')
      setIsDistributorCustomerModalOpen(false)
      refetchDistCustomers()
      refetchDistributorDashboard()
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Customer creation failed', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. Create Distributor Route
  const handleCreateDistRoute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!routeForm.routeName) {
      showToast('Route Name is required.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await twentyLService.createDistributorRoute(selectedDistributorId, routeForm)
      showToast('Distributor route created.', 'success')
      setIsDistributorRouteModalOpen(false)
      refetchDistRoutes()
      refetchDistributorDashboard()
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Route creation failed', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 4. Create Distributor Vehicle
  const handleCreateDistVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicleForm.registrationNumber) {
      showToast('Registration Number is required.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await twentyLService.createDistributorVehicle(selectedDistributorId, vehicleForm)
      showToast('Vehicle added to distributor fleet.', 'success')
      setIsDistributorVehicleModalOpen(false)
      refetchDistVehicles()
      refetchDistributorDashboard()
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Vehicle addition failed', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 5. Create Distributor Driver
  const handleCreateDistDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!driverForm.driverName) {
      showToast('Driver Name is required.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await twentyLService.createDistributorDriver(selectedDistributorId, driverForm)
      showToast('Driver added to distributor team.', 'success')
      setIsDistributorDriverModalOpen(false)
      refetchDistDrivers()
      refetchDistributorDashboard()
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Driver addition failed', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 6. Record Customer Delivery (Distributor -> Customer)
  const handleCreateDistDelivery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!distDeliveryForm.distributorCustomerId) {
      showToast('Please select a customer.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await twentyLService.createDistributorDelivery(selectedDistributorId, {
        ...distDeliveryForm,
        quantityFilledDelivered: Number(distDeliveryForm.quantityFilledDelivered),
        quantityEmptyCollected: Number(distDeliveryForm.quantityEmptyCollected),
        quantityDamaged: Number(distDeliveryForm.quantityDamaged),
        sellingRate: Number(distDeliveryForm.sellingRate),
        amountCollected: Number(distDeliveryForm.amountCollected)
      })
      showToast('Customer delivery recorded! Downstream margin computed and jar holdings updated.', 'success')
      setIsDistributorDeliveryModalOpen(false)
      refreshAll()
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Customer delivery failed', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 7. Driver 1-Tap Deliver Stop
  const handleDriverActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDriverStop) return
    setIsSubmitting(true)
    try {
      await twentyLService.driverDeliverStop({
        distributorId: selectedDistributorId,
        customerId: selectedDriverStop.customerId,
        quantityFilledDelivered: Number(driverActionForm.quantityFilledDelivered),
        quantityEmptyCollected: Number(driverActionForm.quantityEmptyCollected),
        quantityDamaged: Number(driverActionForm.quantityDamaged),
        sellingRate: Number(driverActionForm.sellingRate),
        amountCollected: Number(driverActionForm.amountCollected),
        paymentMode: driverActionForm.paymentMode,
        notes: driverActionForm.notes
      })
      showToast(`Stop ${selectedDriverStop.stopNumber} delivered and empties recorded!`, 'success')
      setIsDriverDeliverModalOpen(false)
      setSelectedDriverStop(null)
      refreshAll()
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Delivery confirmation failed', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">AQUZIO 20L ERP</h1>
              <EnterpriseBadge variant="info">Two-Tier Business Engine</EnterpriseBadge>
            </div>
            <p className="text-sm font-medium text-slate-500">
              Upstream Plant Supply & Downstream Distributor Logistics Management
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <EnterpriseButton
            variant="secondary"
            onClick={refreshAll}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Ledger
          </EnterpriseButton>
        </div>
      </div>

      {/* Main Tier Navigation Switcher */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-slate-200/70 p-1.5 rounded-2xl border border-slate-300/60">
        <button
          onClick={() => setActiveTier('COMPANY_SUPPLY')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-sm transition-all ${
            activeTier === 'COMPANY_SUPPLY'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Plant Supply (Upstream)</span>
        </button>

        <button
          onClick={() => setActiveTier('DISTRIBUTOR_PORTAL')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-sm transition-all ${
            activeTier === 'DISTRIBUTOR_PORTAL'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Distributor Business</span>
        </button>

        <button
          onClick={() => setActiveTier('DRIVER_TERMINAL')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-sm transition-all ${
            activeTier === 'DRIVER_TERMINAL'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Driver Terminal</span>
        </button>

        <button
          onClick={() => setActiveTier('TRIPS_OPERATIONS')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-sm transition-all ${
            activeTier === 'TRIPS_OPERATIONS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Trips & Operations</span>
        </button>

        <button
          onClick={() => setActiveTier('LEDGER_AUDIT')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-sm transition-all ${
            activeTier === 'LEDGER_AUDIT'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Authoritative Ledger</span>
        </button>
      </div>

      {/* ========================================================
          TIER 1: COMPANY / PLANT HUB (UPSTREAM SUPPLY)
          ======================================================== */}
      {activeTier === 'COMPANY_SUPPLY' && (
        <div className="space-y-6">
          {/* Plant Stock KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm">
              <div className="flex items-center justify-between text-blue-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Plant Filled</span>
                <Package className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-slate-900">{plantBalances?.plant?.filledAvailable ?? 0}</div>
              <p className="text-xs text-slate-500 mt-1">Ready for supply</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
              <div className="flex items-center justify-between text-emerald-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Plant Empty</span>
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-slate-900">{plantBalances?.plant?.emptyReusable ?? 0}</div>
              <p className="text-xs text-slate-500 mt-1">Ready to refill</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
              <div className="flex items-center justify-between text-amber-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Damaged</span>
                <Wrench className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-slate-900">{plantBalances?.plant?.damagedQuarantined ?? 0}</div>
              <p className="text-xs text-slate-500 mt-1">In quarantine</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm">
              <div className="flex items-center justify-between text-red-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Condemned</span>
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-slate-900">{plantBalances?.plant?.condemnedScrapped ?? 0}</div>
              <p className="text-xs text-slate-500 mt-1">Permanently removed</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm">
              <div className="flex items-center justify-between text-purple-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">With Distributors</span>
                <Store className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-slate-900">{plantBalances?.field?.withDistributors ?? 0}</div>
              <p className="text-xs text-slate-500 mt-1">Held in depot/fleet</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm">
              <div className="flex items-center justify-between text-indigo-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Grand Total Jars</span>
                <Box className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-slate-900">{plantBalances?.grandTotalSystemJars ?? 0}</div>
              <p className="text-xs text-emerald-600 font-semibold mt-1">100% Conserved</p>
            </div>
          </div>

          {/* Upstream Supplies Action & List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Company Supplies to Distributors (Upstream Refill Runs)
                </h2>
                <p className="text-xs text-slate-500">
                  Supply 20L jars to independent distributors at configured company refill rates (₹X).
                </p>
              </div>

              <EnterpriseButton
                variant="primary"
                onClick={() => {
                  setSupplyForm(prev => ({
                    ...prev,
                    distributorId: customers[0]?.id || '',
                    productId: products[0]?.id || ''
                  }))
                  setIsDistributorSupplyModalOpen(true)
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" />
                New Distributor Supply
              </EnterpriseButton>
            </div>

            {/* Supplies Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Supply #</th>
                    <th className="py-3 px-4">Distributor</th>
                    <th className="py-3 px-4">Filled Supplied</th>
                    <th className="py-3 px-4">Empties Returned</th>
                    <th className="py-3 px-4">Company Rate (₹X)</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4">Driver / Vehicle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {suppliesData?.items?.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No distributor supply runs recorded yet. Click 'New Distributor Supply' above.
                      </td>
                    </tr>
                  )}
                  {suppliesData?.items?.map((item: DistributorSupply) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{item.supplyNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.distributorName}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-emerald-700">+{item.quantitySupplied}</span> filled
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-blue-700">+{item.quantityEmptyReturned}</span> empty
                        {item.quantityDamaged > 0 && (
                          <span className="text-xs text-red-600 block">({item.quantityDamaged} damaged)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">₹{item.appliedRate}</td>
                      <td className="py-3 px-4 font-black text-slate-900">₹{item.totalAmount}</td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge
                          variant={item.paymentStatus === 'PAID' ? 'success' : (item.paymentStatus === 'PARTIAL' ? 'warning' : 'danger')}
                        >
                          {item.paymentStatus} (₹{item.amountPaid})
                        </EnterpriseBadge>
                      </td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge variant={item.stage === 'COMPLETED' ? 'success' : 'info'}>
                          {item.stage}
                        </EnterpriseBadge>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <div>{item.driverName || 'N/A'}</div>
                        <div className="font-mono text-slate-500">{item.vehicleNumber || ''}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TIER 2: DISTRIBUTOR PORTAL (DOWNSTREAM MINI-BUSINESS)
          ======================================================== */}
      {activeTier === 'DISTRIBUTOR_PORTAL' && (
        <div className="space-y-6">
          {/* Distributor Switcher Bar */}
          <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-emerald-700 tracking-wider">Active Distribution Business</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <select
                    value={selectedDistributorId}
                    onChange={(e) => setSelectedDistributorId(e.target.value)}
                    className="bg-slate-100 border border-slate-300 font-bold text-slate-900 py-1 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customerName} ({c.phone || 'Distributor'})
                      </option>
                    ))}
                  </select>
                  <EnterpriseBadge variant="success">Independent Operations</EnterpriseBadge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <EnterpriseButton
                variant="primary"
                onClick={() => {
                  setDistDeliveryForm(prev => ({
                    ...prev,
                    distributorCustomerId: distCustomers?.[0]?.id || ''
                  }))
                  setIsDistributorDeliveryModalOpen(true)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Record Customer Delivery
              </EnterpriseButton>
            </div>
          </div>

          {/* Distributor Financial & Jar KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <span className="text-xs font-bold uppercase">Upstream Plant Purchases</span>
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                ₹{distributorDashboard?.upstreamCompanyRelationship?.totalSupplyPurchases ?? 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {distributorDashboard?.upstreamCompanyRelationship?.totalFilledJarsSupplied ?? 0} filled jars supplied
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <span className="text-xs font-bold uppercase">Customer Sales Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                ₹{distributorDashboard?.downstreamCustomerBusiness?.totalRevenue ?? 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {distributorDashboard?.downstreamCustomerBusiness?.totalFilledDelivered ?? 0} jars delivered to customers
              </p>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-300 shadow-sm">
              <div className="flex items-center justify-between text-emerald-800 mb-1">
                <span className="text-xs font-black uppercase">Gross Margin Earned</span>
                <TrendingUp className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-2xl font-black text-emerald-900">
                ₹{distributorDashboard?.downstreamCustomerBusiness?.totalGrossMarginEarned ?? 0}
              </div>
              <p className="text-xs text-emerald-700 font-semibold mt-1">
                Net Distributor Profit (₹Y - ₹X)
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <span className="text-xs font-bold uppercase">Distributor Physical Jars</span>
                <Package className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-purple-900">
                {distributorDashboard?.jarInventoryPosition?.totalPhysicalJarsInNetwork ?? 0}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex justify-between">
                <span>Depot: {distributorDashboard?.jarInventoryPosition?.filledJarsAtDepot ?? 0}F / {distributorDashboard?.jarInventoryPosition?.emptyJarsAtDepot ?? 0}E</span>
                <span>Cust: {distributorDashboard?.jarInventoryPosition?.filledWithCustomers ?? 0}F</span>
              </div>
            </div>
          </div>

          {/* Distributor Sub-Navigation Tabs */}
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setDistributorSubTab('CUSTOMERS')}
              className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                distributorSubTab === 'CUSTOMERS'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Customers ({distCustomers?.length || 0})</span>
            </button>

            <button
              onClick={() => setDistributorSubTab('ROUTES_FLEET')}
              className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                distributorSubTab === 'ROUTES_FLEET'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Route className="w-4 h-4" />
              <span>Routes & Fleet</span>
            </button>

            <button
              onClick={() => setDistributorSubTab('DELIVERIES')}
              className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                distributorSubTab === 'DELIVERIES'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Customer Deliveries</span>
            </button>
          </div>

          {/* Sub Tab: Customers */}
          {distributorSubTab === 'CUSTOMERS' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Distributor Customers</h3>
                  <p className="text-xs text-slate-500">Customers belonging exclusively to this distributor's route network.</p>
                </div>
                <EnterpriseButton
                  variant="primary"
                  onClick={() => setIsDistributorCustomerModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add Customer
                </EnterpriseButton>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase">
                    <tr>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Area / Route</th>
                      <th className="py-3 px-4">Selling Rate (₹Y)</th>
                      <th className="py-3 px-4">Filled Held</th>
                      <th className="py-3 px-4">Empty Held</th>
                      <th className="py-3 px-4">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {distCustomers?.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No downstream customers created yet. Click 'Add Customer' above.
                        </td>
                      </tr>
                    )}
                    {distCustomers?.map((c: DistributorCustomer) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{c.customerName}</td>
                        <td className="py-3 px-4">{c.phone || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">{c.area || 'General Area'}</span>
                          {c.routeName && <span className="text-xs text-slate-500 block">({c.routeName})</span>}
                        </td>
                        <td className="py-3 px-4 font-black text-emerald-700">₹{c.defaultRate}</td>
                        <td className="py-3 px-4 font-bold text-blue-700">{c.filledJarsHeld} jars</td>
                        <td className="py-3 px-4 font-bold text-slate-600">{c.emptyJarsHeld} jars</td>
                        <td className="py-3 px-4 font-black text-slate-900">₹{c.outstandingBalance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub Tab: Routes & Fleet */}
          {distributorSubTab === 'ROUTES_FLEET' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Routes */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Route className="w-4 h-4 text-emerald-600" />
                    Delivery Routes ({distRoutes?.length || 0})
                  </h4>
                  <EnterpriseButton variant="secondary" onClick={() => setIsDistributorRouteModalOpen(true)} className="py-1 px-2 text-xs">
                    + Add Route
                  </EnterpriseButton>
                </div>
                <div className="space-y-2">
                  {distRoutes?.map((r: DistributorRoute) => (
                    <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="font-bold text-slate-900 text-sm">{r.routeName}</div>
                      <div className="text-xs text-slate-500">{r.areaDescription || 'Town Sector'} • {r.scheduleDays}</div>
                      <div className="text-xs font-medium text-emerald-700 mt-1">Driver: {r.defaultDriverName || 'Unassigned'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vehicles */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-600" />
                    Fleet Vehicles ({distVehicles?.length || 0})
                  </h4>
                  <EnterpriseButton variant="secondary" onClick={() => setIsDistributorVehicleModalOpen(true)} className="py-1 px-2 text-xs">
                    + Add Vehicle
                  </EnterpriseButton>
                </div>
                <div className="space-y-2">
                  {distVehicles?.map((v: DistributorVehicle) => (
                    <div key={v.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="font-bold text-slate-900 text-sm font-mono">{v.registrationNumber}</div>
                      <div className="text-xs text-slate-500">{v.vehicleType} • Cap: {v.capacityJars} jars</div>
                      <div className="text-xs font-medium text-blue-700 mt-1">Driver: {v.assignedDriverName || 'Primary'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drivers */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-600" />
                    Delivery Partners ({distDrivers?.length || 0})
                  </h4>
                  <EnterpriseButton variant="secondary" onClick={() => setIsDistributorDriverModalOpen(true)} className="py-1 px-2 text-xs">
                    + Add Driver
                  </EnterpriseButton>
                </div>
                <div className="space-y-2">
                  {distDrivers?.map((d: DistributorDriver) => (
                    <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="font-bold text-slate-900 text-sm">{d.driverName}</div>
                      <div className="text-xs text-slate-500">Phone: {d.phone || 'N/A'}</div>
                      <div className="text-xs font-medium text-purple-700 mt-1">Vehicle: {d.assignedVehicleNumber || 'KL-07'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sub Tab: Deliveries */}
          {distributorSubTab === 'DELIVERIES' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Downstream Customer Deliveries</h3>
                  <p className="text-xs text-slate-500">Deliveries made by this distributor to their downstream customers.</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase">
                    <tr>
                      <th className="py-3 px-4">Delivery #</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Filled Delivered</th>
                      <th className="py-3 px-4">Empty Collected</th>
                      <th className="py-3 px-4">Selling Rate (₹Y)</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Gross Margin (Profit)</th>
                      <th className="py-3 px-4">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {distDeliveriesData?.items?.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No deliveries recorded yet.
                        </td>
                      </tr>
                    )}
                    {distDeliveriesData?.items?.map((d: DistributorDelivery) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700">{d.deliveryNumber}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{d.customerName}</td>
                        <td className="py-3 px-4 font-bold text-emerald-700">+{d.quantityFilledDelivered}</td>
                        <td className="py-3 px-4 font-bold text-blue-700">+{d.quantityEmptyCollected}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">₹{d.sellingRate}</td>
                        <td className="py-3 px-4 font-black text-slate-900">₹{d.totalAmount}</td>
                        <td className="py-3 px-4 font-black text-emerald-700 bg-emerald-50/50">
                          +₹{d.grossMargin}
                        </td>
                        <td className="py-3 px-4">
                          <EnterpriseBadge variant="success">{d.paymentStatus} (₹{d.amountCollected})</EnterpriseBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TIER 3: DRIVER MOBILE TERMINAL
          ======================================================== */}
      {activeTier === 'DRIVER_TERMINAL' && (
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Driver Status Card */}
          <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl font-black">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">{driverPortalData?.driverName || 'Primary Route Driver'}</h2>
                  <div className="flex items-center gap-2 text-xs text-amber-300 font-mono">
                    <Truck className="w-3.5 h-3.5" />
                    <span>{driverPortalData?.vehicleNumber || 'KL-07-AW-2020'}</span>
                    <span>• {driverPortalData?.date}</span>
                  </div>
                </div>
              </div>
              <EnterpriseBadge variant="warning">On Route</EnterpriseBadge>
            </div>

            {/* In-Hand Jar Tracker */}
            <div className="grid grid-cols-3 gap-2 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Remaining Filled</span>
                <div className="text-xl font-black text-emerald-400">{driverPortalData?.driverJarPosition?.remainingFilledInVehicle ?? 0}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Delivered</span>
                <div className="text-xl font-black text-blue-400">{driverPortalData?.driverJarPosition?.deliveredFilled ?? 0}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Empties in Van</span>
                <div className="text-xl font-black text-amber-400">{driverPortalData?.driverJarPosition?.emptyCollectedInVehicle ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Stops List */}
          <div className="space-y-3">
            <h3 className="font-black text-slate-900 text-base px-1">Today's Delivery Stops</h3>

            {driverPortalData?.stops?.map((stop: any) => (
              <div
                key={stop.customerId}
                className={`p-4 rounded-2xl border transition-all ${
                  stop.isDeliveredToday
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-white border-slate-200 shadow-sm hover:border-amber-400'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                      stop.isDeliveredToday ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
                    }`}>
                      {stop.stopNumber}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{stop.customerName}</h4>
                      <p className="text-xs text-slate-500">{stop.address || stop.area || 'Route customer'}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-slate-900 text-sm">₹{stop.defaultRate} / jar</span>
                    <div className="text-xs text-slate-500">Holds {stop.filledHeld}F / {stop.emptyHeld}E</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 gap-2">
                  {stop.phone && (
                    <a
                      href={`tel:${stop.phone}`}
                      className="py-2 px-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-slate-200"
                    >
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      Call
                    </a>
                  )}

                  {stop.isDeliveredToday ? (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Delivered Today
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedDriverStop(stop)
                        setDriverActionForm({
                          quantityFilledDelivered: 5,
                          quantityEmptyCollected: 5,
                          quantityDamaged: 0,
                          sellingRate: stop.defaultRate || 40,
                          amountCollected: 5 * (stop.defaultRate || 40),
                          paymentMode: 'CASH',
                          notes: ''
                        })
                        setIsDriverDeliverModalOpen(true)
                      }}
                      className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 font-black text-slate-950 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                    >
                      <CheckSquare className="w-4 h-4" />
                      1-TAP DELIVER & COLLECT
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          TIER 4: TRIPS & OPERATIONS
          ======================================================== */}
      {activeTier === 'TRIPS_OPERATIONS' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-600" />
                  Route Trips & Dispatch Management
                </h2>
                <p className="text-xs text-slate-500">Multi-stop scheduled trips with strict vehicle jar accountability.</p>
              </div>

              <div className="flex items-center gap-2">
                <EnterpriseButton
                  variant="primary"
                  onClick={() => setIsNewTripModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  New Route Trip
                </EnterpriseButton>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase">
                  <tr>
                    <th className="py-3 px-4">Trip #</th>
                    <th className="py-3 px-4">Driver / Vehicle</th>
                    <th className="py-3 px-4">Route</th>
                    <th className="py-3 px-4">Loaded</th>
                    <th className="py-3 px-4">Delivered</th>
                    <th className="py-3 px-4">Collected</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {tripsData?.items?.map((trip: any) => (
                    <tr key={trip.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">{trip.tripNumber}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{trip.driverName}</div>
                        <div className="text-xs text-slate-500 font-mono">{trip.vehicleNumber}</div>
                      </td>
                      <td className="py-3 px-4 font-bold">{trip.routeCode || 'General'}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">{trip.loadedFilledJars}F / {trip.loadedEmptyJars}E</td>
                      <td className="py-3 px-4 font-bold text-blue-700">{trip.deliveredFilledJars}F</td>
                      <td className="py-3 px-4 font-bold text-purple-700">{trip.collectedEmptyJars}E</td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge variant={trip.status === 'COMPLETED' ? 'success' : 'info'}>
                          {trip.status}
                        </EnterpriseBadge>
                      </td>
                      <td className="py-3 px-4">
                        <EnterpriseButton variant="secondary" className="py-1 px-2 text-xs">
                          Details
                        </EnterpriseButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TIER 5: AUTHORITATIVE LEDGER & QUALITY
          ======================================================== */}
      {activeTier === 'LEDGER_AUDIT' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-600" />
                  Immutable 20L Container Ledger Movements
                </h2>
                <p className="text-xs text-slate-500">Authoritative append-only movement log with distinct Owner, Holder, and Location.</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Movement Type</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Owner Type</th>
                    <th className="py-3 px-4">From Location</th>
                    <th className="py-3 px-4">To Location</th>
                    <th className="py-3 px-4">Container Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {movementsData?.items?.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-xs font-mono">{new Date(m.occurredAt).toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono font-bold text-purple-700">{m.movementType}</td>
                      <td className="py-3 px-4 font-black text-slate-900">{m.quantity}</td>
                      <td className="py-3 px-4">{m.ownerType}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{m.fromLocationType}</td>
                      <td className="py-3 px-4 text-xs font-bold text-emerald-700">{m.toLocationType}</td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge variant="info">{m.containerStatus}</EnterpriseBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODALS
          ======================================================== */}

      {/* 1. Modal: New Distributor Supply (Company -> Distributor) */}
      <EnterpriseModal
        isOpen={isDistributorSupplyModalOpen}
        onClose={() => setIsDistributorSupplyModalOpen(false)}
        title="New Distributor Supply / Refill Run"
      >
        <form onSubmit={handleCreateDistributorSupply} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Distributor *</label>
            <select
              value={supplyForm.distributorId}
              onChange={(e) => setSupplyForm({ ...supplyForm, distributorId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Choose Distributor --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.customerName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Filled Jars Supplied *</label>
              <input
                type="number"
                value={supplyForm.quantitySupplied}
                onChange={(e) => setSupplyForm({ ...supplyForm, quantitySupplied: Number(e.target.value), quantityRequested: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Empties Returned to Plant</label>
              <input
                type="number"
                value={supplyForm.quantityEmptyReturned}
                onChange={(e) => setSupplyForm({ ...supplyForm, quantityEmptyReturned: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Company Refill Rate (₹X)</label>
              <input
                type="number"
                value={supplyForm.appliedRate}
                onChange={(e) => {
                  const rate = Number(e.target.value)
                  setSupplyForm({
                    ...supplyForm,
                    appliedRate: rate,
                    amountPaid: rate * supplyForm.quantitySupplied
                  })
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold text-blue-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Amount Collected</label>
              <input
                type="number"
                value={supplyForm.amountPaid}
                onChange={(e) => setSupplyForm({ ...supplyForm, amountPaid: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vehicle Number</label>
              <input
                type="text"
                value={supplyForm.vehicleNumber}
                onChange={(e) => setSupplyForm({ ...supplyForm, vehicleNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Driver Name</label>
              <input
                type="text"
                value={supplyForm.driverName}
                onChange={(e) => setSupplyForm({ ...supplyForm, driverName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm"
              />
            </div>
          </div>

          {/* Stock Impact Preview */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1 text-blue-900">
            <span className="font-bold">Stock Impact:</span>
            <div className="flex justify-between">
              <span>Plant Stock: -{supplyForm.quantitySupplied} filled, +{supplyForm.quantityEmptyReturned} empty</span>
              <span className="font-bold">Total: ₹{supplyForm.quantitySupplied * supplyForm.appliedRate}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <EnterpriseButton variant="secondary" onClick={() => setIsDistributorSupplyModalOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton variant="primary" type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              Confirm Dispatch
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {/* 2. Modal: Add Distributor Customer */}
      <EnterpriseModal
        isOpen={isDistributorCustomerModalOpen}
        onClose={() => setIsDistributorCustomerModalOpen(false)}
        title="Add Downstream Customer"
      >
        <form onSubmit={handleCreateDistCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Customer Full Name *</label>
            <input
              type="text"
              value={customerForm.customerName}
              onChange={(e) => setCustomerForm({ ...customerForm, customerName: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold"
              placeholder="e.g. Grand Plaza Hotel"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number</label>
              <input
                type="text"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono"
                placeholder="9876543210"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Area / Sector</label>
              <input
                type="text"
                value={customerForm.area}
                onChange={(e) => setCustomerForm({ ...customerForm, area: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Selling Rate (₹Y) *</label>
              <input
                type="number"
                value={customerForm.defaultRate}
                onChange={(e) => setCustomerForm({ ...customerForm, defaultRate: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-black text-emerald-700"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Delivery Frequency</label>
              <select
                value={customerForm.deliveryFrequency}
                onChange={(e) => setCustomerForm({ ...customerForm, deliveryFrequency: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-semibold"
              >
                <option value="DAILY">Daily</option>
                <option value="ALTERNATE_DAYS">Alternate Days</option>
                <option value="WEEKLY">Weekly</option>
                <option value="ON_DEMAND">On Demand</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <EnterpriseButton variant="secondary" onClick={() => setIsDistributorCustomerModalOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton variant="primary" type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Create Customer
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {/* 3. Modal: Record Downstream Customer Delivery */}
      <EnterpriseModal
        isOpen={isDistributorDeliveryModalOpen}
        onClose={() => setIsDistributorDeliveryModalOpen(false)}
        title="Record Distributor Customer Delivery"
      >
        <form onSubmit={handleCreateDistDelivery} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Customer *</label>
            <select
              value={distDeliveryForm.distributorCustomerId}
              onChange={(e) => {
                const cust = distCustomers?.find(c => c.id === e.target.value)
                setDistDeliveryForm({
                  ...distDeliveryForm,
                  distributorCustomerId: e.target.value,
                  sellingRate: cust?.defaultRate || 40,
                  amountCollected: (cust?.defaultRate || 40) * distDeliveryForm.quantityFilledDelivered
                })
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-semibold"
              required
            >
              <option value="">-- Choose Customer --</option>
              {distCustomers?.map((c) => (
                <option key={c.id} value={c.id}>{c.customerName} (₹{c.defaultRate}/jar)</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Filled Delivered *</label>
              <input
                type="number"
                value={distDeliveryForm.quantityFilledDelivered}
                onChange={(e) => {
                  const qty = Number(e.target.value)
                  setDistDeliveryForm({
                    ...distDeliveryForm,
                    quantityFilledDelivered: qty,
                    amountCollected: qty * distDeliveryForm.sellingRate
                  })
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold text-emerald-700"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Empties Collected</label>
              <input
                type="number"
                value={distDeliveryForm.quantityEmptyCollected}
                onChange={(e) => setDistDeliveryForm({ ...distDeliveryForm, quantityEmptyCollected: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold text-blue-700"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Customer Selling Rate (₹Y)</label>
              <input
                type="number"
                value={distDeliveryForm.sellingRate}
                onChange={(e) => setDistDeliveryForm({ ...distDeliveryForm, sellingRate: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Amount Collected</label>
              <input
                type="number"
                value={distDeliveryForm.amountCollected}
                onChange={(e) => setDistDeliveryForm({ ...distDeliveryForm, amountCollected: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold"
              />
            </div>
          </div>

          {/* Margin Calculation Preview */}
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs space-y-1 text-emerald-950">
            <div className="flex justify-between font-bold">
              <span>Customer Total: ₹{distDeliveryForm.quantityFilledDelivered * distDeliveryForm.sellingRate}</span>
              <span className="text-emerald-700 font-black">
                Estimated Gross Margin: +₹{distDeliveryForm.quantityFilledDelivered * (distDeliveryForm.sellingRate - 25)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <EnterpriseButton variant="secondary" onClick={() => setIsDistributorDeliveryModalOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton variant="primary" type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Save Delivery
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {/* 4. Modal: Driver 1-Tap Quick Action */}
      <EnterpriseModal
        isOpen={isDriverDeliverModalOpen}
        onClose={() => setIsDriverDeliverModalOpen(false)}
        title={`Deliver Stop: ${selectedDriverStop?.customerName || ''}`}
      >
        <form onSubmit={handleDriverActionSubmit} className="space-y-4">
          <div className="p-3 bg-slate-100 rounded-xl text-xs flex justify-between font-semibold">
            <span>Current Holding: {selectedDriverStop?.filledHeld} Filled / {selectedDriverStop?.emptyHeld} Empty</span>
            <span className="text-blue-700 font-bold">Rate: ₹{driverActionForm.sellingRate}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Delivered Filled *</label>
              <input
                type="number"
                value={driverActionForm.quantityFilledDelivered}
                onChange={(e) => setDriverActionForm({ ...driverActionForm, quantityFilledDelivered: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-lg font-black text-emerald-700 text-center"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Collected Empty</label>
              <input
                type="number"
                value={driverActionForm.quantityEmptyCollected}
                onChange={(e) => setDriverActionForm({ ...driverActionForm, quantityEmptyCollected: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-lg font-black text-blue-700 text-center"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cash Collected (₹)</label>
              <input
                type="number"
                value={driverActionForm.amountCollected}
                onChange={(e) => setDriverActionForm({ ...driverActionForm, amountCollected: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Mode</label>
              <select
                value={driverActionForm.paymentMode}
                onChange={(e) => setDriverActionForm({ ...driverActionForm, paymentMode: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / QR</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <EnterpriseButton variant="secondary" onClick={() => setIsDriverDeliverModalOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton variant="primary" type="submit" disabled={isSubmitting} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black">
              Confirm & Complete Stop
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {/* 5. Modal: Add Distributor Route */}
      <EnterpriseModal
        isOpen={isDistributorRouteModalOpen}
        onClose={() => setIsDistributorRouteModalOpen(false)}
        title="Add Delivery Route"
      >
        <form onSubmit={handleCreateDistRoute} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Route Name *</label>
            <input
              type="text"
              value={routeForm.routeName}
              onChange={(e) => setRouteForm({ ...routeForm, routeName: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold"
              placeholder="e.g. Market Sector Route"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Route Code</label>
              <input
                type="text"
                value={routeForm.routeCode}
                onChange={(e) => setRouteForm({ ...routeForm, routeCode: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Schedule Days</label>
              <input
                type="text"
                value={routeForm.scheduleDays}
                onChange={(e) => setRouteForm({ ...routeForm, scheduleDays: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <EnterpriseButton variant="secondary" onClick={() => setIsDistributorRouteModalOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton variant="primary" type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Create Route
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {/* 6. Modal: Add Distributor Vehicle */}
      <EnterpriseModal
        isOpen={isDistributorVehicleModalOpen}
        onClose={() => setIsDistributorVehicleModalOpen(false)}
        title="Add Fleet Vehicle"
      >
        <form onSubmit={handleCreateDistVehicle} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Registration Number *</label>
            <input
              type="text"
              value={vehicleForm.registrationNumber}
              onChange={(e) => setVehicleForm({ ...vehicleForm, registrationNumber: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono font-bold uppercase"
              placeholder="KL-07-BW-1234"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vehicle Type</label>
              <select
                value={vehicleForm.vehicleType}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleType: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-semibold"
              >
                <option value="MINI_TRUCK">Mini Truck (Tata Ace / Mahindra)</option>
                <option value="AUTO_RICKSHAW">Auto Rickshaw / 3-Wheeler</option>
                <option value="VAN">Delivery Van</option>
                <option value="PICKUP">Heavy Pickup</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Capacity (Jars)</label>
              <input
                type="number"
                value={vehicleForm.capacityJars}
                onChange={(e) => setVehicleForm({ ...vehicleForm, capacityJars: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold"
                min="10"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <EnterpriseButton variant="secondary" onClick={() => setIsDistributorVehicleModalOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton variant="primary" type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              Add Vehicle
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {/* 7. Modal: Add Distributor Driver */}
      <EnterpriseModal
        isOpen={isDistributorDriverModalOpen}
        onClose={() => setIsDistributorDriverModalOpen(false)}
        title="Add Delivery Partner / Driver"
      >
        <form onSubmit={handleCreateDistDriver} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Driver Full Name *</label>
            <input
              type="text"
              value={driverForm.driverName}
              onChange={(e) => setDriverForm({ ...driverForm, driverName: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold"
              placeholder="e.g. Suresh Kumar"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone</label>
              <input
                type="text"
                value={driverForm.phone}
                onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">License #</label>
              <input
                type="text"
                value={driverForm.licenseNumber}
                onChange={(e) => setDriverForm({ ...driverForm, licenseNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <EnterpriseButton variant="secondary" onClick={() => setIsDistributorDriverModalOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton variant="primary" type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white">
              Add Driver
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}
export default TwentyLOperationsHub
