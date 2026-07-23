import React, { useState, useEffect, useRef } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'
import { api } from '../../services/api'
import { SearchableCombobox } from '../../components/ui/SearchableCombobox'
import {
  RotateCcw, ArrowUpRight, ArrowDownLeft, Trash2, ShieldAlert,
  Wind, ClipboardCheck, Droplet, Hammer, Cpu, RefreshCw,
  Plus, Minus, Check, Users, Truck, AlertTriangle, Layers, BarChart2,
  Calendar, Info, User, X, ChevronRight, ChevronDown, Settings2,
  Filter, Printer, Download, Search, FileText, CheckCircle2, PackageCheck, Clock, ArrowRight
} from 'lucide-react'
import PageContainer from '../../components/ui/layout/PageContainer'
import PageHeader from '../../components/ui/layout/PageHeader'
import Breadcrumb from '../../components/ui/layout/Breadcrumb'
import KPICard from '../../components/ui/layout/KPICard'
import FilterBar from '../../components/ui/layout/FilterBar'

interface Distributor {
  id: string
  customerName: string
  customerCode: string
  phone: string
  outstandingJars: number
  assignedVehicle?: string
  assignedDriver?: string
  maxJarLimit: number
  reservedEmptyJars?: number
}

interface DistributorContext {
  distributorId: string
  distributorName: string
  outstandingJars: number
  reservedEmptyJars: number
  reservedEmpty: number
  reservedFilled: number
  condemnations: number
  readyForFilling: number
  assignedVehicle: string
  assignedDriver: string
}

const ActionCard = ({ title, description, icon, count, countLabel, colorClass, iconColorClass, onClick }: any) => (
  <button
    onClick={onClick}
    className={`group relative overflow-hidden flex flex-col text-left p-3.5 rounded-[12px] h-[115px] transition-all duration-150 cursor-pointer w-full hover:shadow-md hover:border-slate-300 active:scale-[0.99] ${colorClass}`}
  >
    <div className="flex flex-col h-full justify-between w-full relative z-10">
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-none ${iconColorClass}`}>
          {React.cloneElement(icon, { className: 'w-4.5 h-4.5' })}
        </div>
        <div className="pt-0.5 overflow-hidden">
          <h3 className="text-[13px] font-semibold tracking-tight leading-tight text-slate-900 truncate">{title}</h3>
          <p className="text-[11px] font-normal text-slate-500 mt-0.5 leading-tight truncate">{description}</p>
        </div>
      </div>

      <div className="flex items-baseline justify-between mt-auto w-full pt-2 border-t border-slate-200/40">
        <span className="text-[10px] font-medium text-slate-550 uppercase tracking-wider">{countLabel}</span>
        <span className="text-[22px] font-bold leading-none text-slate-900">{count}</span>
      </div>
    </div>
  </button>
)

const OperationModal = ({ isOpen, onClose, title, icon, colorClass, children, actionButton, maxWidth = "max-w-2xl" }: any) => {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-white w-full ${maxWidth} max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200`}>
        <div className={`px-5 py-3 border-b border-slate-100 flex items-center justify-between ${colorClass}`}>
          <div className="flex items-center gap-2.5">
            {icon}
            {typeof title === 'string' ? (
              <h2 className="text-[15px] font-semibold text-slate-800 tracking-tight">{title}</h2>
            ) : (
              title
            )}
          </div>
          <div className="flex items-center gap-3">
            {actionButton}
            <button onClick={onClose} type="button" className="w-7 h-7 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 relative">
          {children}
        </div>
      </div>
    </div>
  )
}

const Stepper = ({ value, onChange, label, sublabel, max, onMaxExceeded }: any) => {
  const atMax = max !== undefined && value >= max;

  const handleIncrease = (amount: number) => {
    if (max !== undefined) {
      if (value >= max) {
        if (onMaxExceeded) onMaxExceeded();
        return;
      }
      const nextValue = value + amount;
      if (nextValue > max) {
        onChange(max);
        if (onMaxExceeded) onMaxExceeded();
      } else {
        onChange(nextValue);
      }
    } else {
      onChange(value + amount);
    }
  };

  const handleInputChange = (e: any) => {
    const val = parseInt(e.target.value) || 0;
    if (max !== undefined && val > max) {
      onChange(max);
      if (onMaxExceeded) onMaxExceeded();
    } else {
      onChange(val);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-[12px] bg-white border border-[#ECECEC] shadow-none">
      {label && (
        <div>
          <div className="text-[13px] font-medium text-slate-800">{label}</div>
          {sublabel && <div className="text-[11px] font-normal text-slate-500 mt-0.5">{sublabel}</div>}
        </div>
      )}
      <div className="flex items-center gap-1.5 shrink-0">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 cursor-pointer transition-colors">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="number"
          value={value === undefined || value === null || Number.isNaN(value) ? 0 : value}
          onChange={handleInputChange}
          className="w-12 h-7 text-center font-semibold text-[15px] text-slate-800 bg-transparent border-none focus:ring-0"
        />
        <button type="button" onClick={() => handleIncrease(1)} className={`w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center cursor-pointer transition-colors ${atMax ? 'opacity-40 text-slate-400 bg-slate-50' : 'hover:bg-slate-50 text-slate-600'}`}>
          <Plus className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-1 ml-1">
          <button type="button" onClick={() => handleIncrease(10)} className={`px-1.5 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-colors ${atMax ? 'opacity-40 text-slate-400 bg-slate-100' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>+10</button>
          <button type="button" onClick={() => handleIncrease(25)} className={`px-1.5 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-colors ${atMax ? 'opacity-40 text-slate-400 bg-slate-100' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>+25</button>
          <button type="button" onClick={() => handleIncrease(50)} className={`px-1.5 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-colors ${atMax ? 'opacity-40 text-slate-400 bg-slate-100' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>+50</button>
        </div>
      </div>
    </div>
  )
}

interface CounterProps {
  label?: string
  sublabel?: string
  value: number
  onChange: (val: number) => void
  max?: number
  onMaxExceeded?: () => void
  atMax?: boolean
  handleIncrease: (delta: number) => void
}

const Counter: React.FC<CounterProps> = ({ label, sublabel, value, onChange, max, onMaxExceeded, atMax, handleIncrease }) => {

  const handleInputChange = (e: any) => {
    const val = parseInt(e.target.value) || 0;
    if (max !== undefined && val > max) {
      onChange(max);
      if (onMaxExceeded) onMaxExceeded();
    } else {
      onChange(val);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-[12px] bg-white border border-[#ECECEC] shadow-none">
      {label && (
        <div>
          <div className="text-[13px] font-medium text-slate-800">{label}</div>
          {sublabel && <div className="text-[11px] font-normal text-slate-500 mt-0.5">{sublabel}</div>}
        </div>
      )}
      <div className="flex items-center gap-1.5 shrink-0">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 cursor-pointer transition-colors">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="number"
          value={value === undefined || value === null || Number.isNaN(value) ? 0 : value}
          onChange={handleInputChange}
          className="w-12 h-7 text-center font-semibold text-[15px] text-slate-800 bg-transparent border-none focus:ring-0"
        />
        <button type="button" onClick={() => handleIncrease(1)} className={`w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center cursor-pointer transition-colors ${atMax ? 'opacity-40 text-slate-400 bg-slate-50' : 'hover:bg-slate-50 text-slate-600'}`}>
          <Plus className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-1 ml-1">
          <button type="button" onClick={() => handleIncrease(10)} className={`px-1.5 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-colors ${atMax ? 'opacity-40 text-slate-400 bg-slate-100' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>+10</button>
          <button type="button" onClick={() => handleIncrease(25)} className={`px-1.5 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-colors ${atMax ? 'opacity-40 text-slate-400 bg-slate-100' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>+25</button>
          <button type="button" onClick={() => handleIncrease(50)} className={`px-1.5 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-colors ${atMax ? 'opacity-40 text-slate-400 bg-slate-100' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>+50</button>
        </div>
      </div>
    </div>
  )
}

export const JarDashboardPage: React.FC = () => {
  const { selectedProduct, resetTerminal } = useOutletContext<any>()
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  // Tabs: action-hub, dashboard, unloading, washing, filling, loading, distributors
  const [activeTab, setActiveTab] = useState<'action-hub' | 'dashboard' | 'unloading' | 'washing' | 'filling' | 'loading' | 'distributors'>('action-hub')

  // Data states
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [dashboardMetrics, setDashboardMetrics] = useState<any>({
    dirtyJars: 0,
    quarantineQueue: 0,
    isolationEndingToday: 0,
    cleanJars: 0,
    filledStock: 0,
    reservedFilled: 0,
    reservedEmptyJars: 0,
    todayReturns: 0,
    todayDispatch: 0,
    todayDamage: 0,
    leakageRate: 0,
    breakageRate: 0,
    recoveryRate: 100
  })

  // Global loading
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Counter UI state for Unloading
  const [showReservationsModal, setShowReservationsModal] = useState<boolean>(false)
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false)
  const [reservationFilter, setReservationFilter] = useState<'All' | 'Empty' | 'Filled' | 'Pending' | 'Claimed'>('All')
  const [reservationSearch, setReservationSearch] = useState<string>('')
  const [historyFilter, setHistoryFilter] = useState<'All' | 'Unloading' | 'Loading' | 'Reservation' | 'Damage'>('All')
  const [historySearch, setHistorySearch] = useState<string>('')

  // Accordion section states
  const [accordionState, setAccordionState] = useState({
    search: true,
    balances: true,
    reservations: true,
    timeline: true
  })

  const toggleAccordion = (key: keyof typeof accordionState) => {
    setAccordionState(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const [selectedDistributorId, setSelectedDistributorId] = useState<string>('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [driverName, setDriverName] = useState('')
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [distribContext, setDistribContext] = useState<DistributorContext | null>(null)
  const [reserveEmpty, setReserveEmpty] = useState(false)
  const [reserveReason, setReserveReason] = useState('')
  const [showReserve, setShowReserve] = useState<boolean>(false)
  const [reservedEmptyCount, setReservedEmptyCount] = useState<number>(0)
  const [moveToFilling, setMoveToFilling] = useState<number>(0)
  const [isMoveToFillingOverridden, setIsMoveToFillingOverridden] = useState<boolean>(false)
  const [takeFromReservedEnabled, setTakeFromReservedEnabled] = useState<boolean>(false)
  const [takeFromReserved, setTakeFromReserved] = useState<number>(0)

  const [moveToFillingWarning, setMoveToFillingWarning] = useState<'hidden' | 'showing' | 'hiding'>('hidden')
  const moveToFillingWarningTimerRef = useRef<any>(null)
  const moveToFillingWarningHideTimerRef = useRef<any>(null)

  const handleMoveToFillingMaxExceeded = () => {
    setMoveToFillingWarning('showing');
    if (moveToFillingWarningTimerRef.current) clearTimeout(moveToFillingWarningTimerRef.current);
    if (moveToFillingWarningHideTimerRef.current) clearTimeout(moveToFillingWarningHideTimerRef.current);
    
    moveToFillingWarningTimerRef.current = setTimeout(() => {
      setMoveToFillingWarning('hiding');
      moveToFillingWarningHideTimerRef.current = setTimeout(() => {
        setMoveToFillingWarning('hidden');
      }, 300);
    }, 4000);
  }

  // Counter variables for 13 classifications

  // New Simplified Unloading State
  const [returnedEmptyCount, setReturnedEmptyCount] = useState<number>(0)

  const [showContamination, setShowContamination] = useState<boolean>(false)
  const [contaminatedCount, setContaminatedCount] = useState<number>(0)
  const [showContaminationModal, setShowContaminationModal] = useState<boolean>(false)
  const [contaminationBreakdown, setContaminationBreakdown] = useState({
    OilContaminated: 0, DieselContaminated: 0, PaintContaminated: 0, ChemicalSmell: 0, VeryDirty: 0
  })

  const [showDamage, setShowDamage] = useState<boolean>(false)
  const [damagedCount, setDamagedCount] = useState<number>(0)
  const [showDamageModal, setShowDamageModal] = useState<boolean>(false)
  const [damageBreakdown, setDamageBreakdown] = useState({
    BrokenNeck: 0, Cracked: 0, Leaking: 0, CapMissing: 0, HandleBroken: 0, LabelRemoved: 0, Other: 0
  })

  const [unloadingNotes, setUnloadingNotes] = useState<string>('')

  // Auto-sync moveToFilling when inputs change, unless operator manually overrides
  useEffect(() => {
    if (!isMoveToFillingOverridden) {
      const calculated = Math.max(0, returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount);
      setMoveToFilling(calculated);
    }
  }, [returnedEmptyCount, contaminatedCount, damagedCount, reservedEmptyCount, isMoveToFillingOverridden]);


  // Washing log state
  const [washedCount, setWashedCount] = useState<number>(0)
  const [washingRejectedCount, setWashingRejectedCount] = useState<number>(0)

  // Filling log state
  const [fillBrandId, setFillBrandId] = useState('')
  const [filledCount, setFilledCount] = useState<number>(0)
  const [fillingRejected, setFillingRejected] = useState<number>(0)
  const [leakageCount, setLeakageCount] = useState<number>(0)
  const [capFailureCount, setCapFailureCount] = useState<number>(0)
  const [sealFailureCount, setSealFailureCount] = useState<number>(0)

  // Loading log state
  const [loadingDistributorId, setLoadingDistributorId] = useState('')
  const [loadingVehicle, setLoadingVehicle] = useState('')
  const [loadingDriver, setLoadingDriver] = useState('')
  const [loadingBrandId, setLoadingBrandId] = useState('')
  const [loadingCount, setLoadingCount] = useState<number>(0)
  const [loadingRemarks, setLoadingRemarks] = useState('')
  const [reserveFilledNextDay, setReserveFilledNextDay] = useState(false)
  const [reserveFilledCount, setReserveFilledCount] = useState<number>(0)

  // Load basic configurations
  const loadInitialConfigs = async () => {
    setIsLoadingData(true)
    try {
      const distRes = await api.get('/api/v1/operations/distributors')
      setDistributors(distRes.data?.data?.items || distRes.data?.data || [])

      const brandRes = await api.get('/api/v1/brands?pageSize=1000')
      setBrands(brandRes.data?.data?.items || brandRes.data?.data || [])

      const prodRes = await api.get('/api/v1/production-entries/skus')
      setProducts(prodRes.data?.data?.items || prodRes.data?.data || [])

      await refreshDashboard()
    } catch (ex: any) {
      showToast('Error loading operations configurations.', 'error')
    } finally {
      setIsLoadingData(false)
    }
  }

  const refreshDashboard = async () => {
    try {
      const dashRes = await api.get('/api/v1/operations/dashboard-extended')
      if (dashRes.data?.data) setDashboardMetrics(dashRes.data.data)
    } catch (ex: any) {
      console.error('Error fetching extended dashboard metrics', ex)
    }
  }

  useEffect(() => {
    loadInitialConfigs()
  }, [])

  // Dynamic context loader for Distributor unloading/loading
  const handleDistributorChange = async (id: string, workflow: 'unload' | 'load') => {
    if (workflow === 'unload') {
      setSelectedDistributorId(id)
    } else {
      setLoadingDistributorId(id)
    }

    if (!id) {
      if (workflow === 'unload') setDistribContext(null)
      return
    }

    try {
      const res = await api.get(`/api/v1/operations/distributor/${id}/context`)
      if (res.data?.data) {
        const ctx = res.data.data
        if (workflow === 'unload') {
          setDistribContext(ctx)
          setVehicleNumber(ctx.assignedVehicle || '')
          setDriverName(ctx.assignedDriver || '')
        } else {
          setLoadingVehicle(ctx.assignedVehicle || '')
          setLoadingDriver(ctx.assignedDriver || '')
        }
      }
    } catch (ex: any) {
      showToast('Could not load distributor outstanding context.', 'error')
    }
  }

  const handleClearAllocation = () => {
    resetTerminal()
    showToast('Product allocation cleared.', 'info')
    navigate('/operator/product-selection')
  }


  // Submit operations handlers
  const handleSaveUnloading = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDistributorId) {
      showToast('Please select a distributor.', 'warning')
      return
    }
    if (!selectedBrandId) {
      showToast('Please select a brand.', 'warning')
      return
    }

    if (returnedEmptyCount === 0 && contaminatedCount === 0 && damagedCount === 0) {
      showToast('Please log at least one jar.', 'warning')
      return
    }

    // Validate sums

    const calculatedMoveToFilling = returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount;
    if (calculatedMoveToFilling < 0) {
      showToast('Move To Filling cannot be less than zero. Check your inputs.', 'error');
      return;
    }

    const sumContaminated = Object.values(contaminationBreakdown).reduce((a, b) => a + b, 0)
    if (showContamination && sumContaminated > 0 && sumContaminated !== contaminatedCount) {
      showToast('Contamination breakdown total does not match entered total!', 'error')
      return
    }
    const sumDamaged = Object.values(damageBreakdown).reduce((a, b) => a + b, 0)
    if (showDamage && sumDamaged > 0 && sumDamaged !== damagedCount) {
      showToast('Damage breakdown total does not match entered total!', 'error')
      return
    }

    try {
      // 1. Create Visit arrival record
      const arrivalRes = await api.post('/api/v1/operations/visit', {
        arrivalTime: new Date().toISOString(),
        vehicleNumber,
        driverName,
        distributorId: selectedDistributorId,
        priority: 'Normal',
        remarks: unloadingNotes || 'Empty jar unloading'
      })

      const visitId = arrivalRes.data?.data?.id
      if (!visitId) throw new Error('Failed to start visit session')

      // Classify conditions
      const conditions: any[] = []

      const addCondition = (type: string, quantity: number) => {
        if (quantity > 0) {
          conditions.push({ conditionType: type, quantity, responsibility: 'Distributor' })
        }
      }

      // Contaminations
      if (showContamination && contaminatedCount > 0) {
        if (sumContaminated === 0) {
          addCondition('Extra Dirty', contaminatedCount)
        } else {
          addCondition('Oil Smell', contaminationBreakdown.OilContaminated)
          addCondition('Diesel', contaminationBreakdown.DieselContaminated)
          addCondition('Paint', contaminationBreakdown.PaintContaminated)
          addCondition('Chemical', contaminationBreakdown.ChemicalSmell)
          addCondition('Extra Dirty', contaminationBreakdown.VeryDirty)
        }
      }

      // Damages
      if (showDamage && damagedCount > 0) {
        if (sumDamaged === 0) {
          addCondition('Other Damage', damagedCount)
        } else {
          addCondition('Broken Neck', damageBreakdown.BrokenNeck)
          addCondition('Cracked', damageBreakdown.Cracked)
          addCondition('Leaking', damageBreakdown.Leaking)
          addCondition('Cap Missing', damageBreakdown.CapMissing)
          addCondition('Handle Broken', damageBreakdown.HandleBroken)
          addCondition('Label Removed', damageBreakdown.LabelRemoved)
          addCondition('Other Damage', damageBreakdown.Other)
        }
      }

      const totalJars = returnedEmptyCount + contaminatedCount + damagedCount

      // 2. Save unloading counts
      await api.post(`/api/v1/operations/visit/${visitId}/unload`, {
        brandId: selectedBrandId,
        returnedEmptyCount: totalJars,
        immediateRequirement: moveToFilling + (takeFromReservedEnabled ? takeFromReserved : 0),
        laterRequirement: reservedEmptyCount,
        scheduledRequirement: 0,
        conditions
      })

      // 2.5 Claim reserved empties if taking from reserved
      if (takeFromReservedEnabled && takeFromReserved > 0) {
        await api.post('/api/v1/operations/reservations/claim', {
          distributorId: selectedDistributorId,
          type: 'Empty'
        })
      }

      // 3. Save reservation if reservedEmptyCount > 0
      if (reservedEmptyCount > 0) {
        await api.post('/api/v1/operations/reserve', {
          distributorId: selectedDistributorId,
          quantity: reservedEmptyCount,
          type: 'Empty',
          reason: reserveReason || 'Plant Unloading Reserve'
        })
      }

      showToast('✓ Unloading Saved. Truck unloaded successfully.', 'success')

      // Reset
      setReturnedEmptyCount(0)
      setContaminatedCount(0)
      setDamagedCount(0)
      setShowContamination(false)
      setShowDamage(false)
      setContaminationBreakdown({ OilContaminated: 0, DieselContaminated: 0, PaintContaminated: 0, ChemicalSmell: 0, VeryDirty: 0 })
      setDamageBreakdown({ BrokenNeck: 0, Cracked: 0, Leaking: 0, CapMissing: 0, HandleBroken: 0, LabelRemoved: 0, Other: 0 })
      setShowReserve(false)
      setReservedEmptyCount(0)
      setMoveToFilling(0)
      setTakeFromReservedEnabled(false)
      setTakeFromReserved(0)
      setIsMoveToFillingOverridden(false)
      setReserveEmpty(false)
      setReserveReason('')
      setUnloadingNotes('')
      setSelectedDistributorId('')
      setDistribContext(null)

      await refreshDashboard()
      if (selectedDistributorId) {
        await handleDistributorChange(selectedDistributorId, 'unload')
      }
      setActiveTab('action-hub')
    } catch (ex: any) {
      showToast('Error recording unloading transaction.', 'error')
    }
  }

  const handleSaveWashing = async (e: React.FormEvent) => {
    e.preventDefault()
    if (washedCount <= 0) {
      showToast('Please log washed count greater than zero.', 'warning')
      return
    }

    try {
      await api.post('/api/v1/operations/washing', {
        washedCount,
        rejectedCount: washingRejectedCount
      })

      showToast('Washed jar batch successfully logged.', 'success')
      setWashedCount(0)
      setWashingRejectedCount(0)
      await refreshDashboard()
      setActiveTab('action-hub')
    } catch (ex: any) {
      showToast('Error logging washed jar batch.', 'error')
    }
  }

  const handleSaveFilling = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fillBrandId) {
      showToast('Please select brand.', 'warning')
      return
    }
    if (filledCount <= 0) {
      showToast('Please log filled count greater than zero.', 'warning')
      return
    }

    try {
      await api.post('/api/v1/operations/filling', {
        productId: selectedProduct?.id || products[0]?.id,
        brandId: fillBrandId,
        filledCount,
        rejectedCount: fillingRejected,
        leakageCount,
        capFailureCount,
        sealFailureCount
      })

      showToast('Filling batch logs recorded successfully.', 'success')
      setFilledCount(0)
      setFillingRejected(0)
      setLeakageCount(0)
      setCapFailureCount(0)
      setSealFailureCount(0)
      await refreshDashboard()
      setActiveTab('action-hub')
    } catch (ex: any) {
      showToast('Error saving filling logs.', 'error')
    }
  }

  const handleSaveLoading = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loadingDistributorId) {
      showToast('Please select distributor.', 'warning')
      return
    }
    if (!loadingBrandId) {
      showToast('Please select brand.', 'warning')
      return
    }
    if (loadingCount <= 0) {
      showToast('Please log loaded count greater than zero.', 'warning')
      return
    }

    try {
      // 1. Create Visit arrival record for dispatch
      const arrivalRes = await api.post('/api/v1/operations/visit', {
        arrivalTime: new Date().toISOString(),
        vehicleNumber: loadingVehicle,
        driverName: loadingDriver,
        distributorId: loadingDistributorId,
        priority: 'Normal',
        remarks: 'Filled loading dispatch'
      })

      const visitId = arrivalRes.data?.data?.id
      if (!visitId) throw new Error('Failed to initialize loading visit')

      // 2. Claim filled reservations first if distributor has any
      await api.post('/api/v1/operations/reservations/claim', {
        distributorId: loadingDistributorId,
        type: 'Filled'
      })

      // 3. Record loading
      await api.post(`/api/v1/operations/visit/${visitId}/load`, {
        productId: selectedProduct?.id || products[0]?.id,
        brandId: loadingBrandId,
        batchNumber: `BATCH-${new Date().toISOString().substring(0, 10)}`,
        quantityLoaded: loadingCount,
        loadedBy: user?.firstName || 'Operator',
        remarks: loadingRemarks
      })

      // 4. Reserve next day filled stock if checked
      if (reserveFilledNextDay && reserveFilledCount > 0) {
        await api.post('/api/v1/operations/reserve', {
          distributorId: loadingDistributorId,
          quantity: reserveFilledCount,
          type: 'Filled',
          reason: 'Next day truck loading reserve'
        })
      }

      showToast('Truck loaded and dispatched successfully.', 'success')
      setLoadingCount(0)
      setLoadingRemarks('')
      setReserveFilledNextDay(false)
      setReserveFilledCount(0)
      setLoadingDistributorId('')
      await refreshDashboard()
      setActiveTab('action-hub')
    } catch (ex: any) {
      showToast('Error recording loaded vehicle logs.', 'error')
    }
  }

  // Handover reserved empty jars
  const claimReservedEmpties = async (distId: string) => {
    try {
      await api.post('/api/v1/operations/reservations/claim', {
        distributorId: distId,
        type: 'Empty'
      })
      showToast('Reserved empty jars successfully handed over to washing queue.', 'success')
      if (distribContext) {
        setDistribContext({ ...distribContext, reservedEmptyJars: 0 })
      }
      await refreshDashboard()
    } catch (ex) {
      showToast('Failed to claim reserved empty jars.', 'error')
    }
  }

  return (
    <>
      <style>{`
        .custom-sidebar-scroll {
          overscroll-behavior: contain !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        .custom-sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .custom-sidebar-scroll::-webkit-scrollbar-track {
          background: #F1F5F9;
          border-radius: 8px;
        }
        .custom-sidebar-scroll::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 8px;
        }
        .custom-sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: #2563EB;
        }
      `}</style>
      <PageContainer className="p-4 bg-white text-slate-800">
        <div className="w-full space-y-4">

          {/* Compact Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 mb-2 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Jar Terminal</h1>
              <div className="hidden md:block h-5 w-px bg-slate-300"></div>
              <span className="text-[14px] font-bold text-slate-600 uppercase">
                Product: <strong className="text-slate-900">{selectedProduct?.name || '20L Jar'}</strong>
              </span>
              <div className="hidden md:block h-5 w-px bg-slate-300"></div>
              <span className="text-[14px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <User className="w-4 h-4" /> {user?.firstName || 'Operator'}
              </span>
              <div className="hidden md:block h-5 w-px bg-slate-300"></div>
              <span className="text-[14px] font-bold text-slate-600 uppercase">
                Current Shift
              </span>
            </div>

            <button
              onClick={handleClearAllocation}
              className="h-10 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-[8px] text-slate-700 text-[12px] font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Change Product</span>
            </button>
          </div>



          {/* TWO-COLUMN OPERATOR WORKSPACE */}
          <div className="flex flex-col lg:flex-row items-start gap-5 w-full">

            {/* LEFT (OPERATOR WORKSPACE - FLEX 1 NORMAL FLOW) */}
            <div className="flex-1 w-full space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-slate-800 tracking-tight">Operations Hub</h2>
                <span className="text-[11px] font-medium text-slate-500">6 Workflows Active</span>
              </div>

              {/* 3x2 COMPACT ACTION CARDS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in duration-200">
                <ActionCard
                  title="Jar Unloading"
                  description="Receive returned empty jars"
                  icon={<ArrowDownLeft />}
                  count={dashboardMetrics.todayReturns}
                  countLabel="Returned Today"
                  colorClass="bg-[#F0F7FF] hover:bg-blue-100/80 text-blue-900 border border-blue-200/70"
                  iconColorClass="bg-blue-200/70 text-blue-700"
                  onClick={() => setActiveTab('unloading')}
                />
                <ActionCard
                  title="Filling Queue"
                  description="Approved jars waiting for filling"
                  icon={<Droplet />}
                  count={dashboardMetrics.cleanJars}
                  countLabel="Approved / Ready"
                  colorClass="bg-[#F0FDF4] hover:bg-emerald-100/80 text-emerald-900 border border-emerald-200/70"
                  iconColorClass="bg-emerald-200/70 text-emerald-700"
                  onClick={() => setActiveTab('filling')}
                />
                <ActionCard
                  title="Truck Loading"
                  description="Dispatch filled jars"
                  icon={<ArrowUpRight />}
                  count={dashboardMetrics.todayDispatch}
                  countLabel="Loaded Today"
                  colorClass="bg-[#FAF5FF] hover:bg-purple-100/80 text-purple-900 border border-purple-200/70"
                  iconColorClass="bg-purple-200/70 text-purple-700"
                  onClick={() => setActiveTab('loading')}
                />
                <ActionCard
                  title="Distributor Pending"
                  description="Reserved empty jars kept"
                  icon={<Users />}
                  count={dashboardMetrics.reservedEmpty}
                  countLabel="Reserved"
                  colorClass="bg-[#FFFBEB] hover:bg-amber-100/80 text-amber-900 border border-amber-200/70"
                  iconColorClass="bg-amber-200/70 text-amber-700"
                  onClick={() => setActiveTab('distributors')}
                />
                <ActionCard
                  title="Customer Returns"
                  description="Customer-returned filled jars"
                  icon={<RotateCcw />}
                  count={dashboardMetrics.todayDamage}
                  countLabel="Reported Returns"
                  colorClass="bg-[#FFF1F2] hover:bg-rose-100/80 text-rose-900 border border-rose-200/70"
                  iconColorClass="bg-rose-200/70 text-rose-700"
                  onClick={() => setActiveTab('unloading')}
                />
                <ActionCard
                  title="Reports"
                  description="Daily KPIs and flow summary"
                  icon={<BarChart2 />}
                  count="KPI"
                  countLabel="View Summary"
                  colorClass="bg-[#F8FAFC] hover:bg-slate-200/80 text-slate-900 border border-slate-200/70"
                  iconColorClass="bg-slate-200/70 text-slate-700"
                  onClick={() => setActiveTab('dashboard')}
                />
              </div>
            </div>


            {/* RIGHT (DISTRIBUTOR ACTIVITY PERMANENT SIDEBAR - FIXED 420PX STICKY CONTAINER) */}
            <div className="w-full lg:w-[420px] shrink-0 bg-[#FAFAFA] border border-[#ECECEC] rounded-[14px] p-4 shadow-sm lg:sticky lg:top-4 max-h-[calc(100vh-32px)] flex flex-col">

              {/* FIXED HEADER */}
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 shrink-0">
                <div>
                  <h2 className="text-[15px] font-semibold text-slate-800">Distributor Activity</h2>
                  <p className="text-[11px] font-normal text-slate-500">Live operational history & status</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>

              {/* COLLAPSIBLE 1: SEARCH DISTRIBUTOR */}
              <div className="py-2 border-b border-slate-200/60 shrink-0 space-y-1">
                <button
                  type="button"
                  onClick={() => toggleAccordion('search')}
                  className="w-full flex items-center justify-between text-[12px] font-medium text-slate-700 cursor-pointer"
                >
                  <span>Select Distributor</span>
                  {accordionState.search ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                </button>
                {accordionState.search && (
                  <div className="pt-1 animate-in fade-in">
                    <SearchableCombobox
                      label=""
                      items={distributors}
                      value={selectedDistributorId}
                      onChange={(val) => handleDistributorChange(val, 'unload')}
                      primaryKey="id"
                      searchKeys={['customerCode', 'customerName', 'phone', 'assignedVehicle']}
                      displayValue={(d) => `[${d.customerCode}] ${d.customerName}`}
                      renderOption={(d) => (
                        <div>
                          <div className="font-semibold text-slate-800 text-[13px]">{d.customerName}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{d.customerCode} • {d.phone} • {d.assignedVehicle}</div>
                        </div>
                      )}
                      placeholder="Search distributor name/code/phone..."
                    />
                  </div>
                )}
              </div>

              {/* COLLAPSIBLE 2: DISTRIBUTOR SUMMARY & BALANCES */}
              {distribContext && (
                <div className="py-2 border-b border-slate-200/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleAccordion('balances')}
                    className="w-full flex items-center justify-between text-[12px] font-medium text-slate-700 cursor-pointer mb-1"
                  >
                    <span>Distributor Context & Balances</span>
                    {accordionState.balances ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                  </button>

                  {accordionState.balances && (
                    <div className="bg-white border border-[#ECECEC] rounded-[10px] p-2.5 space-y-2 animate-in fade-in">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[13px] font-semibold text-slate-900">{distribContext.distributorName}</div>
                          <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                            Vehicle: <span className="font-medium text-slate-700">{distribContext.assignedVehicle || 'Unassigned'}</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded-full border border-blue-100">
                          Active
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-slate-100 text-slate-500">
                        <div>Last Visit: <span className="font-medium text-slate-800">Today, 09:45 AM</span></div>
                        <div>Operator: <span className="font-medium text-slate-800">{user?.firstName || 'Operator'}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* INNER SCROLLABLE CONTENT (ACCORDION PANELS FOR RESERVATIONS, TIMELINE, QUICK ACTIONS) */}
              {distribContext ? (
                <div className="flex-1 overflow-y-auto overflow-x-hidden [overscroll-behavior:contain] custom-sidebar-scroll space-y-3 pt-2 pr-1">

                  {/* QUICK BALANCES GRID */}
                  <div className="space-y-1.5">
                    <div className="text-[12px] font-medium text-slate-700">Quick Balances</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="bg-white border border-slate-200/80 px-2 py-1.5 rounded-lg text-center">
                        <div className="text-[10px] font-medium text-blue-600">Outstanding</div>
                        <div className="text-[13px] font-semibold text-blue-900">{distribContext.outstandingJars || 0}</div>
                      </div>
                      <div className="bg-white border border-slate-200/80 px-2 py-1.5 rounded-lg text-center">
                        <div className="text-[10px] font-medium text-amber-600">Reserved</div>
                        <div className="text-[13px] font-semibold text-amber-900">{distribContext.reservedEmptyJars || 0}</div>
                      </div>
                      <div className="bg-white border border-slate-200/80 px-2 py-1.5 rounded-lg text-center">
                        <div className="text-[10px] font-medium text-emerald-600">Filled Res.</div>
                        <div className="text-[13px] font-semibold text-emerald-900">{distribContext.reservedFilled || 0}</div>
                      </div>
                      <div className="bg-white border border-slate-200/80 px-2 py-1.5 rounded-lg text-center">
                        <div className="text-[10px] font-medium text-cyan-600">Ready Fill</div>
                        <div className="text-[13px] font-semibold text-cyan-900">{distribContext.readyForFilling || 0}</div>
                      </div>
                      <div className="bg-white border border-slate-200/80 px-2 py-1.5 rounded-lg text-center col-span-2">
                        <div className="text-[10px] font-medium text-rose-600">Condemned</div>
                        <div className="text-[13px] font-semibold text-rose-900">{distribContext.condemnations || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* COLLAPSIBLE 3: PENDING RESERVATIONS SUMMARY */}
                  <div className="bg-white border border-slate-200/80 rounded-[10px] p-2.5 space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleAccordion('reservations')}
                      className="w-full flex items-center justify-between text-[12px] font-medium text-slate-800 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-600" />
                        Pending Reservations
                      </span>
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                        {distribContext.reservedEmptyJars + distribContext.reservedFilled}
                      </span>
                    </button>

                    {accordionState.reservations && (
                      <div className="space-y-2 pt-1 border-t border-slate-100 animate-in fade-in">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Reserved Empty Jars:</span>
                          <span className="font-bold text-amber-900">{distribContext.reservedEmptyJars}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Reserved Filled Jars:</span>
                          <span className="font-bold text-blue-900">{distribContext.reservedFilled}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowReservationsModal(true)}
                          className="w-full h-7 mt-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-[6px] text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Manage & Claim Reservations</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* COLLAPSIBLE 4: RECENT OPERATIONS TIMELINE */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleAccordion('timeline')}
                      className="w-full flex items-center justify-between text-[12px] font-medium text-slate-700 cursor-pointer"
                    >
                      <span>Recent Operations Timeline</span>
                      {accordionState.timeline ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </button>

                    {accordionState.timeline && (
                      <div className="space-y-2 animate-in fade-in">
                        <div className="bg-white border border-slate-200/70 p-2.5 rounded-[10px] relative pl-3 border-l-4 border-l-blue-500 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-medium text-slate-900">Plant Unloading</span>
                            <span className="text-[10px] text-slate-400">09:45 AM</span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
                            <span>Returned: <strong className="text-blue-700">85</strong></span>
                            <span>Reserved: <strong className="text-amber-700">20</strong></span>
                            <span>Moved: <strong className="text-emerald-700">60</strong></span>
                          </div>
                          <div className="text-[10px] text-slate-400">Operator: {user?.firstName || 'John'}</div>
                        </div>

                        <div className="bg-white border border-slate-200/70 p-2.5 rounded-[10px] relative pl-3 border-l-4 border-l-purple-500 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-medium text-slate-900">Truck Loading</span>
                            <span className="text-[10px] text-slate-400">Yesterday 08:30 AM</span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
                            <span>Loaded: <strong className="text-purple-700">40</strong></span>
                            <span>Dispatched: <strong className="text-slate-800">40</strong></span>
                          </div>
                          <div className="text-[10px] text-slate-400">Operator: {user?.firstName || 'Rakesh'}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* REAL QUICK ACTIONS */}
                  <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setShowReservationsModal(true)}
                      className="w-full h-8 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-[8px] text-[11px] font-medium text-slate-700 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>Open Pending Reservations</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHistoryDrawer(true)}
                      className="w-full h-8 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-[8px] text-[11px] font-medium text-slate-700 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>View Full History & Audit Logs</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center bg-white border border-dashed border-slate-200 rounded-[10px] space-y-2 mt-3">
                  <Users className="w-6 h-6 text-slate-400 mx-auto" />
                  <div className="text-[13px] font-medium text-slate-700">No Distributor Selected</div>
                  <div className="text-[11px] text-slate-500">
                    Select a distributor from the dropdown above to view live balance, activity timeline, and quick actions.
                  </div>
                </div>
              )}

            </div>

            {/* PENDING RESERVATIONS MODAL */}
            <OperationModal
              isOpen={showReservationsModal}
              onClose={() => setShowReservationsModal(false)}
              title="Pending Distributor Reservations"
              icon={<Users className="w-5 h-5 text-amber-600" />}
              colorClass="bg-amber-50 text-amber-950 border-b border-amber-200"
              maxWidth="max-w-4xl"
            >
              <div className="space-y-4 p-1">
                {/* Header Filters & Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-[10px] border border-slate-200">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search reservation remarks..."
                        value={reservationSearch}
                        onChange={(e) => setReservationSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 text-[13px] border border-slate-300 rounded-[8px] focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                    {['All', 'Empty', 'Filled', 'Pending', 'Claimed'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setReservationFilter(type as any)}
                        className={`px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer ${reservationFilter === type
                            ? 'bg-amber-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reservations List / Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-[10px] bg-white shadow-sm">
                  <table className="w-full text-left text-[12px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Distributor</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Quantity</th>
                        <th className="py-2.5 px-3">Expected Pickup / Reason</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                      {distribContext && (distribContext.reservedEmptyJars > 0 || distribContext.reservedFilled > 0) ? (
                        <>
                          {distribContext.reservedEmptyJars > 0 && (reservationFilter === 'All' || reservationFilter === 'Empty' || reservationFilter === 'Pending') && (
                            <tr className="hover:bg-amber-50/40 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">{distribContext.distributorName}</div>
                                <div className="text-[10px] text-slate-400">Vehicle: {distribContext.assignedVehicle || 'N/A'}</div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                                  Clean Empty
                                </span>
                              </td>
                              <td className="py-3 px-3 font-bold text-amber-900 text-[14px]">{distribContext.reservedEmptyJars}</td>
                              <td className="py-3 px-3 text-slate-600">{reserveReason || 'Held at plant for distributor pickup'}</td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3" /> Pending
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => claimReservedEmpties(distribContext.distributorId)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  <span>Handover to Washing</span>
                                </button>
                              </td>
                            </tr>
                          )}
                          {distribContext.reservedFilled > 0 && (reservationFilter === 'All' || reservationFilter === 'Filled' || reservationFilter === 'Pending') && (
                            <tr className="hover:bg-blue-50/40 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">{distribContext.distributorName}</div>
                                <div className="text-[10px] text-slate-400">Vehicle: {distribContext.assignedVehicle || 'N/A'}</div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-semibold">
                                  Filled Stock
                                </span>
                              </td>
                              <td className="py-3 px-3 font-bold text-blue-900 text-[14px]">{distribContext.reservedFilled}</td>
                              <td className="py-3 px-3 text-slate-600">Reserved filled jars for next dispatch</td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3" /> Pending Loading
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowReservationsModal(false)
                                    setActiveTab('loading')
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                  <span>Load Truck</span>
                                </button>
                              </td>
                            </tr>
                          )}
                        </>
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            <div>No active pending reservations found.</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">Reservations logged during unloading or loading will appear here.</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>Showing live active reservations from database</span>
                  <button type="button" onClick={() => setShowReservationsModal(false)} className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-[6px] font-medium cursor-pointer">Close</button>
                </div>
              </div>
            </OperationModal>

            {/* DISTRIBUTOR HISTORY DRAWER */}
            <OperationModal
              isOpen={showHistoryDrawer}
              onClose={() => setShowHistoryDrawer(false)}
              title={
                <div>
                  <div className="text-[16px] font-semibold text-slate-900">
                    {distribContext ? `Audit History: ${distribContext.distributorName}` : 'Distributor Full Transaction Audit History'}
                  </div>
                  <div className="text-[11px] text-slate-500">Comprehensive real-time ERP operational timeline</div>
                </div>
              }
              icon={<FileText className="w-5 h-5 text-blue-600" />}
              colorClass="bg-white text-slate-900 border-b border-slate-200"
              maxWidth="max-w-5xl"
              actionButton={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => showToast('Exporting distributor history to CSV...', 'info')}
                    className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => showToast('Printing transaction audit log...', 'info')}
                    className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                </div>
              }
            >
              <div className="space-y-4 p-1">
                {/* Filter Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-[10px] border border-slate-200">
                  <div className="relative flex-1 w-full sm:w-auto">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search by Txn ID, vehicle, or operator..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 text-[13px] border border-slate-300 rounded-[8px] focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                    {['All', 'Unloading', 'Loading', 'Reservation', 'Damage'].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setHistoryFilter(filter as any)}
                        className={`px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer ${historyFilter === filter
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transactions Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-[10px] bg-white shadow-sm max-h-[450px] overflow-y-auto">
                  <table className="w-full text-left text-[12px] border-collapse">
                    <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[10px] tracking-wider z-10">
                      <tr>
                        <th className="py-2.5 px-3">Txn ID / Time</th>
                        <th className="py-2.5 px-3">Event Type</th>
                        <th className="py-2.5 px-3">Distributor / Vehicle</th>
                        <th className="py-2.5 px-3">Brand</th>
                        <th className="py-2.5 px-3 text-center">Returned</th>
                        <th className="py-2.5 px-3 text-center">Reserved</th>
                        <th className="py-2.5 px-3 text-center">Moved Fill</th>
                        <th className="py-2.5 px-3 text-center">Condemned</th>
                        <th className="py-2.5 px-3 text-center">Loaded</th>
                        <th className="py-2.5 px-3">Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      <tr className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-blue-700">TXN-90412</div>
                          <div className="text-[10px] text-slate-400">Today, 09:45 AM</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-semibold border border-blue-200">
                            Plant Unloading
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{distribContext?.distributorName || 'Test Distributor'}</div>
                          <div className="text-[10px] text-slate-500">{vehicleNumber || 'KL-07-AB-1234'}</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">Aquora Premium 20L</td>
                        <td className="py-3 px-3 text-center font-bold text-blue-800 text-[13px]">85</td>
                        <td className="py-3 px-3 text-center font-bold text-amber-800 text-[13px]">20</td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-800 text-[13px]">60</td>
                        <td className="py-3 px-3 text-center font-bold text-rose-700 text-[13px]">5</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-400">0</td>
                        <td className="py-3 px-3 text-slate-600">{user?.firstName || 'John'}</td>
                      </tr>

                      <tr className="hover:bg-purple-50/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-purple-700">TXN-89021</div>
                          <div className="text-[10px] text-slate-400">Yesterday, 08:30 AM</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-semibold border border-purple-200">
                            Truck Loading
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{distribContext?.distributorName || 'Test Distributor'}</div>
                          <div className="text-[10px] text-slate-500">KL-07-AB-1234</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">Aquora Premium 20L</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-400">0</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-400">0</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-400">0</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-400">0</td>
                        <td className="py-3 px-3 text-center font-bold text-purple-900 text-[13px]">40</td>
                        <td className="py-3 px-3 text-slate-600">Rakesh</td>
                      </tr>

                      <tr className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-amber-700">TXN-87610</div>
                          <div className="text-[10px] text-slate-400">2 Days Ago, 04:15 PM</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-200">
                            Reservation
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{distribContext?.distributorName || 'Test Distributor'}</div>
                          <div className="text-[10px] text-slate-500">Hold Request</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">Aquora Premium 20L</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-400">0</td>
                        <td className="py-3 px-3 text-center font-bold text-amber-800 text-[13px]">15</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-400">0</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-400">0</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-400">0</td>
                        <td className="py-3 px-3 text-slate-600">{user?.firstName || 'John'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>Showing 3 transactions recorded in history audit trail</span>
                  <button type="button" onClick={() => setShowHistoryDrawer(false)} className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-[6px] font-medium cursor-pointer">Close Drawer</button>
                </div>
              </div>
            </OperationModal>


            {/* PLANT UNLOADING MODAL */}
            <OperationModal
              isOpen={activeTab === 'unloading'}
              onClose={() => setActiveTab('action-hub')}
              title={
                <div>
                  <div className="text-[16px] font-semibold text-slate-900 tracking-tight">Plant Unloading</div>
                  <div className="text-[11px] font-normal text-slate-500">Receive returned empty jars from market</div>
                </div>
              }
              icon={<ArrowDownLeft className="w-4 h-4 text-blue-600" />}
              colorClass="bg-white text-slate-800"
              maxWidth="max-w-[1020px]"
              actionButton={
                <button
                  form="unloading-form"
                  type="submit"
                  disabled={!(
                    moveToFilling <= (returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount) &&
                    moveToFilling >= 0 &&
                    (returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount) >= 0 &&
                    (!takeFromReservedEnabled || (takeFromReserved >= 0 && takeFromReserved <= (distribContext?.reservedEmptyJars || 0)))
                  )}
                  className={`h-[38px] px-4 rounded-[10px] text-[13px] font-medium transition-all shadow-sm cursor-pointer flex items-center gap-1.5 ${(
                      moveToFilling <= (returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount) &&
                      moveToFilling >= 0 &&
                      (returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount) >= 0 &&
                      (!takeFromReservedEnabled || (takeFromReserved >= 0 && takeFromReserved <= (distribContext?.reservedEmptyJars || 0)))
                    )
                      ? 'bg-[#2563EB] hover:bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Save Today's Unloading</span>
                </button>
              }
            >
              <form id="unloading-form" onSubmit={handleSaveUnloading} className="space-y-3.5 select-none p-1">

                {/* 1. DISTRIBUTOR INFORMATION */}
                <div className="bg-[#FAFAFA] border border-[#ECECEC] rounded-[14px] p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <h3 className="text-[15px] font-semibold text-slate-800">Distributor Information</h3>
                    {distribContext && (
                      <div className="text-[11px] text-slate-500">
                        Vehicle: <span className="font-medium text-slate-700">{distribContext.assignedVehicle || 'Unassigned'}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <SearchableCombobox
                      label="Distributor"
                      items={distributors}
                      value={selectedDistributorId}
                      onChange={(val) => handleDistributorChange(val, 'unload')}
                      primaryKey="id"
                      searchKeys={['customerCode', 'customerName', 'phone', 'assignedVehicle']}
                      displayValue={(d) => `[${d.customerCode}] ${d.customerName}`}
                      renderOption={(d) => (
                        <div>
                          <div className="font-semibold text-slate-800 text-[13px]">{d.customerName}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{d.customerCode} • {d.phone} • {d.assignedVehicle}</div>
                        </div>
                      )}
                      placeholder="Search distributor name/code/phone..."
                      required
                    />

                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-medium text-slate-700">Vehicle Number</label>
                      <input
                        type="text"
                        placeholder="e.g. KL-07-AB-1234"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        className="h-[38px] border border-slate-200 bg-white rounded-[8px] px-3 text-[14px] font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <SearchableCombobox
                      label="Jar Brand"
                      items={brands}
                      value={selectedBrandId}
                      onChange={(val) => setSelectedBrandId(val)}
                      primaryKey="id"
                      searchKeys={['name']}
                      displayValue={(b) => b.name}
                      renderOption={(b) => (
                        <div className="font-medium text-slate-800 text-[13px]">{b.name}</div>
                      )}
                      placeholder="Search brand..."
                      required
                    />
                  </div>
                </div>

                {/* 2. TODAY'S ENTRY & QUALITY CHECKS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

                  {/* Left Column: Today's Entry */}
                  <div className="bg-[#FAFAFA] border border-[#ECECEC] rounded-[14px] p-3.5 space-y-3">
                    <h3 className="text-[15px] font-semibold text-slate-800 border-b border-slate-200/60 pb-2">Today's Entry</h3>

                    <div className="space-y-2.5">
                      {/* Returned Empty */}
                      <Stepper
                        label="Returned Empty"
                        sublabel="Standard empties received today"
                        value={returnedEmptyCount}
                        onChange={(val: number) => {
                          setReturnedEmptyCount(val);
                          setIsMoveToFillingOverridden(false);
                        }}
                      />

                      {/* Reserve Empty */}
                      <Stepper
                        label="Reserve Empty"
                        sublabel="Empties held at plant for this distributor"
                        value={reservedEmptyCount}
                        onChange={(val: number) => {
                          setReservedEmptyCount(val);
                          setIsMoveToFillingOverridden(false);
                        }}
                      />

                      {/* Move To Filling */}
                      <div className="p-2.5 rounded-[12px] bg-white border border-[#ECECEC] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[13px] font-medium text-slate-800">Move To Filling</div>
                            <div className="text-[11px] text-slate-500">From today's returns</div>
                          </div>
                          {isMoveToFillingOverridden && (
                            <button
                              type="button"
                              onClick={() => setIsMoveToFillingOverridden(false)}
                              className="text-[11px] text-blue-600 font-medium hover:underline cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        <Stepper
                          label=""
                          value={moveToFilling}
                          onChange={(val: number) => {
                            setMoveToFilling(val);
                            setIsMoveToFillingOverridden(true);
                          }}
                          max={Math.max(0, returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount)}
                          onMaxExceeded={handleMoveToFillingMaxExceeded}
                        />

                        {moveToFillingWarning !== 'hidden' && (
                          <div className={`mt-1.5 flex items-start gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-amber-100/50 transition-opacity duration-300 ${moveToFillingWarning === 'showing' ? 'animate-in fade-in duration-200 opacity-100' : 'opacity-0'}`}>
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                            <span>You can only move jars that were returned today. Increase "Returned Empty" first or use "Take from Reserved Jars".</span>
                          </div>
                        )}

                        {/* Take from Reserved Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-slate-100 mt-2 select-none">
                          <input
                            type="checkbox"
                            checked={takeFromReservedEnabled}
                            onChange={(e) => {
                              setTakeFromReservedEnabled(e.target.checked);
                              if (!e.target.checked) setTakeFromReserved(0);
                            }}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-[12px] font-medium text-slate-700">Take from Reserved Jars</span>
                        </label>

                        {takeFromReservedEnabled && (
                          <div className="pt-2 border-t border-slate-100/80 space-y-1.5 animate-in fade-in">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-medium text-slate-700">Take From Reserved</span>
                              <span className="text-slate-500">Available: <strong className="text-amber-800">{distribContext?.reservedEmptyJars || 0}</strong></span>
                            </div>
                            <Stepper
                              label=""
                              value={takeFromReserved}
                              onChange={(val: number) => setTakeFromReserved(val)}
                            />
                            {takeFromReserved > (distribContext?.reservedEmptyJars || 0) && (
                              <div className="text-[11px] font-semibold text-rose-600 pt-0.5">
                                ⚠️ Only {distribContext?.reservedEmptyJars || 0} reserved jars available.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Quality Checks & Notes */}
                  <div className="bg-[#FAFAFA] border border-[#ECECEC] rounded-[14px] p-3.5 space-y-3 flex flex-col justify-between">
                    <div>
                      <h3 className="text-[15px] font-semibold text-slate-800 border-b border-slate-200/60 pb-2 mb-3">Quality Checks</h3>

                      <div className="space-y-2.5">
                        {/* CONTAMINATION */}
                        <div className="p-2.5 rounded-[12px] bg-white border border-[#ECECEC]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-slate-800">Contamination</span>
                              {!showContamination && (
                                <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                  ✓ No contamination
                                </span>
                              )}
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <span className="text-[11px] font-medium text-slate-600">Log Contamination</span>
                              <input
                                type="checkbox"
                                checked={showContamination}
                                onChange={(e) => {
                                  setShowContamination(e.target.checked);
                                  setIsMoveToFillingOverridden(false);
                                }}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </label>
                          </div>

                          {showContamination && (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 animate-in fade-in">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[14px] font-semibold text-amber-600 mr-1">{contaminatedCount} Total</span>
                                {Object.entries(contaminationBreakdown)
                                  .filter(([_, count]) => count > 0)
                                  .map(([key, count]) => (
                                    <span key={key} className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-100">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}: {count}
                                    </span>
                                  ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowContaminationModal(true)}
                                className="h-7 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-medium cursor-pointer transition-colors"
                              >
                                Edit Details
                              </button>
                            </div>
                          )}
                        </div>

                        {/* DAMAGE */}
                        <div className="p-2.5 rounded-[12px] bg-white border border-[#ECECEC]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-slate-800">Damage</span>
                              {!showDamage && (
                                <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                  ✓ No damage
                                </span>
                              )}
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <span className="text-[11px] font-medium text-slate-600">Log Damage</span>
                              <input
                                type="checkbox"
                                checked={showDamage}
                                onChange={(e) => {
                                  setShowDamage(e.target.checked);
                                  setIsMoveToFillingOverridden(false);
                                }}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </label>
                          </div>

                          {showDamage && (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 animate-in fade-in">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[14px] font-semibold text-rose-600 mr-1">{damagedCount} Total</span>
                                {Object.entries(damageBreakdown)
                                  .filter(([_, count]) => count > 0)
                                  .map(([key, count]) => (
                                    <span key={key} className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 text-[11px] font-medium border border-rose-100">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}: {count}
                                    </span>
                                  ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowDamageModal(true)}
                                className="h-7 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-medium cursor-pointer transition-colors"
                              >
                                Edit Details
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pickup Reason & Notes */}
                    <div className="space-y-2 pt-2 border-t border-slate-200/60">
                      {reservedEmptyCount > 0 && (
                        <div className="flex flex-col gap-1">
                          <label className="text-[12px] font-medium text-slate-700">Expected Pickup Reason</label>
                          <input
                            type="text"
                            placeholder="e.g. Pickup tomorrow morning"
                            value={reserveReason}
                            onChange={(e) => setReserveReason(e.target.value)}
                            className="h-[38px] border border-slate-200 bg-white rounded-[8px] px-3 text-[14px] font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <label className="text-[12px] font-medium text-slate-700">Additional Notes</label>
                        <input
                          type="text"
                          placeholder="Any remarks..."
                          value={unloadingNotes}
                          onChange={(e) => setUnloadingNotes(e.target.value)}
                          className="h-[38px] border border-slate-200 bg-white rounded-[8px] px-3 text-[14px] font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. TODAY'S LIVE BALANCE FLOW */}
                <div className="bg-[#FAFAFA] border border-[#ECECEC] rounded-[14px] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <h3 className="text-[15px] font-semibold text-slate-800">Today's Live Flow Balance</h3>
                    <div className="text-[11px] text-slate-500">Real-time breakdown</div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-center">
                    <div className="flex-1 bg-white border border-slate-200 border-t-2 border-t-blue-500 p-2.5 rounded-[10px] min-w-[80px]">
                      <div className="text-[10px] font-medium text-slate-500">Returned</div>
                      <div className="text-[15px] font-semibold text-slate-900 mt-0.5">{returnedEmptyCount}</div>
                    </div>

                    <div className="text-slate-400 font-medium text-xs">→</div>

                    <div className="flex-1 bg-white border border-slate-200 border-t-2 border-t-amber-500 p-2.5 rounded-[10px] min-w-[80px]">
                      <div className="text-[10px] font-medium text-amber-700">Contaminated</div>
                      <div className="text-[15px] font-semibold text-amber-900 mt-0.5">{contaminatedCount}</div>
                    </div>

                    <div className="text-slate-400 font-medium text-xs">→</div>

                    <div className="flex-1 bg-white border border-slate-200 border-t-2 border-t-rose-500 p-2.5 rounded-[10px] min-w-[80px]">
                      <div className="text-[10px] font-medium text-rose-700">Damaged</div>
                      <div className="text-[15px] font-semibold text-rose-900 mt-0.5">{damagedCount}</div>
                    </div>

                    <div className="text-slate-400 font-medium text-xs">→</div>

                    <div className="flex-1 bg-white border border-slate-200 border-t-2 border-t-slate-400 p-2.5 rounded-[10px] min-w-[80px]">
                      <div className="text-[10px] font-medium text-slate-600">Reserved Today</div>
                      <div className="text-[15px] font-semibold text-slate-900 mt-0.5">{reservedEmptyCount}</div>
                    </div>

                    <div className="text-slate-400 font-medium text-xs">→</div>

                    <div className="flex-1 bg-white border border-slate-200 border-t-2 border-t-emerald-500 p-2.5 rounded-[10px] min-w-[90px]">
                      <div className="text-[10px] font-medium text-emerald-700">From Today's Returns</div>
                      <div className="text-[15px] font-semibold text-emerald-900 mt-0.5">{moveToFilling}</div>
                    </div>

                    {takeFromReservedEnabled && (
                      <>
                        <div className="text-slate-400 font-medium text-xs">+</div>
                        <div className="flex-1 bg-white border border-slate-200 border-t-2 border-t-amber-500 p-2.5 rounded-[10px] min-w-[90px]">
                          <div className="text-[10px] font-medium text-amber-700">From Reserved</div>
                          <div className="text-[15px] font-semibold text-amber-900 mt-0.5">{takeFromReserved}</div>
                        </div>
                      </>
                    )}

                    <div className="text-slate-400 font-medium text-xs">=</div>

                    <div className={`flex-1 bg-white border border-t-2 p-2.5 rounded-[10px] min-w-[100px] ${moveToFilling <= (returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount) &&
                        moveToFilling >= 0 &&
                        (returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount) >= 0 &&
                        (!takeFromReservedEnabled || (takeFromReserved >= 0 && takeFromReserved <= (distribContext?.reservedEmptyJars || 0)))
                        ? 'border-slate-200 border-t-emerald-600 bg-emerald-50/20'
                        : 'border-rose-300 border-t-rose-500 bg-rose-50/30'
                      }`}>
                      <div className="text-[10px] font-bold text-emerald-800">Total To Filling</div>
                      <div className="text-[16px] font-bold text-emerald-900 mt-0.5">
                        {moveToFilling + (takeFromReservedEnabled ? takeFromReserved : 0)}
                      </div>
                    </div>
                  </div>

                  {!(
                    moveToFilling <= (returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount) &&
                    moveToFilling >= 0 &&
                    (returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount) >= 0
                  ) && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center justify-between">
                        <span>⚠️ Move to filling from today's returns cannot exceed available ({(returnedEmptyCount - contaminatedCount - damagedCount - reservedEmptyCount)}).</span>
                      </div>
                    )}

                  {takeFromReservedEnabled && takeFromReserved > (distribContext?.reservedEmptyJars || 0) && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center justify-between">
                      <span>⚠️ Only {distribContext?.reservedEmptyJars || 0} reserved jars available for this distributor.</span>
                    </div>
                  )}
                </div>

              </form>
            </OperationModal>


            {/* Sub-Modals */}
            <OperationModal isOpen={showContaminationModal} onClose={() => setShowContaminationModal(false)} title="Contamination Details" icon={<ShieldAlert className="w-4 h-4 text-amber-600" />} colorClass="bg-amber-50 text-amber-900" maxWidth="max-w-lg">
              <div className="space-y-4">
                <Stepper label="Oil Contaminated" value={contaminationBreakdown.OilContaminated} onChange={(val: number) => setContaminationBreakdown({ ...contaminationBreakdown, OilContaminated: val })} />
                <Stepper label="Diesel Contaminated" value={contaminationBreakdown.DieselContaminated} onChange={(val: number) => setContaminationBreakdown({ ...contaminationBreakdown, DieselContaminated: val })} />
                <Stepper label="Paint Contaminated" value={contaminationBreakdown.PaintContaminated} onChange={(val: number) => setContaminationBreakdown({ ...contaminationBreakdown, PaintContaminated: val })} />
                <Stepper label="Chemical Smell" value={contaminationBreakdown.ChemicalSmell} onChange={(val: number) => setContaminationBreakdown({ ...contaminationBreakdown, ChemicalSmell: val })} />
                <Stepper label="Very Dirty" value={contaminationBreakdown.VeryDirty} onChange={(val: number) => setContaminationBreakdown({ ...contaminationBreakdown, VeryDirty: val })} />
                <button type="button" onClick={() => {
                  setContaminatedCount(Object.values(contaminationBreakdown).reduce((a, b) => a + b, 0))
                  setShowContaminationModal(false)
                }} className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white rounded-[8px] font-black uppercase text-[12px] tracking-wider shadow-sm transition-colors">Done</button>
              </div>
            </OperationModal>

            <OperationModal isOpen={showDamageModal} onClose={() => setShowDamageModal(false)} title="Damage Details" icon={<RotateCcw className="w-4 h-4 text-rose-600" />} colorClass="bg-rose-50 text-rose-900" maxWidth="max-w-lg">
              <div className="space-y-4">
                <Stepper label="Leaking" value={damageBreakdown.Leaking} onChange={(val: number) => setDamageBreakdown({ ...damageBreakdown, Leaking: val })} />
                <Stepper label="Cracked Body" value={damageBreakdown.Cracked} onChange={(val: number) => setDamageBreakdown({ ...damageBreakdown, Cracked: val })} />
                <Stepper label="Broken Neck" value={damageBreakdown.BrokenNeck} onChange={(val: number) => setDamageBreakdown({ ...damageBreakdown, BrokenNeck: val })} />
                <Stepper label="Cap Missing" value={damageBreakdown.CapMissing} onChange={(val: number) => setDamageBreakdown({ ...damageBreakdown, CapMissing: val })} />
                <Stepper label="Handle Broken" value={damageBreakdown.HandleBroken} onChange={(val: number) => setDamageBreakdown({ ...damageBreakdown, HandleBroken: val })} />
                <Stepper label="Label Removed" value={damageBreakdown.LabelRemoved} onChange={(val: number) => setDamageBreakdown({ ...damageBreakdown, LabelRemoved: val })} />
                <Stepper label="Other" value={damageBreakdown.Other} onChange={(val: number) => setDamageBreakdown({ ...damageBreakdown, Other: val })} />
                <button type="button" onClick={() => {
                  setDamagedCount(Object.values(damageBreakdown).reduce((a, b) => a + b, 0))
                  setShowDamageModal(false)
                }} className="w-full h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-[8px] font-black uppercase text-[12px] tracking-wider shadow-sm transition-colors">Done</button>
              </div>
            </OperationModal>

            {/* Placeholders for other modals to avoid breaking functionality */}
            <OperationModal isOpen={activeTab === 'washing'} onClose={() => setActiveTab('action-hub')} title="Log Daily Jar Washing Batch" icon={<Wind className="w-5 h-5 text-sky-500" />} colorClass="bg-sky-50 text-sky-900" maxWidth="max-w-xl">
              <form onSubmit={handleSaveWashing} className="space-y-6">
                <div className="flex flex-col gap-1.5"><label className="text-xs font-bold">Washed Jars Count *</label><input type="number" value={washedCount || ''} onChange={e => setWashedCount(parseInt(e.target.value) || 0)} className="h-10 border rounded px-3" required /></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-bold">Washing Rejects / Broken</label><input type="number" value={washingRejectedCount || ''} onChange={e => setWashingRejectedCount(parseInt(e.target.value) || 0)} className="h-10 border rounded px-3" /></div>
                <button type="submit" className="w-full h-12 bg-sky-600 text-white rounded-[10px] font-black uppercase">Save Washing Logs</button>
              </form>
            </OperationModal>

            <OperationModal isOpen={activeTab === 'filling'} onClose={() => setActiveTab('action-hub')} title="Log Filling Station Batch" icon={<Droplet className="w-5 h-5 text-green-500" />} colorClass="bg-green-50 text-green-900" maxWidth="max-w-xl">
              <form onSubmit={handleSaveFilling} className="space-y-6">
                <select value={fillBrandId} onChange={(e) => setFillBrandId(e.target.value)} className="w-full h-10 border rounded px-3" required><option value="">Select Brand...</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-bold">Filled Count *</label><input type="number" value={filledCount || ''} onChange={e => setFilledCount(parseInt(e.target.value) || 0)} className="h-10 border rounded px-3" required /></div>
                <button type="submit" className="w-full h-12 bg-green-600 text-white rounded-[10px] font-black uppercase">Save Filling Logs</button>
              </form>
            </OperationModal>

            <OperationModal isOpen={activeTab === 'loading'} onClose={() => setActiveTab('action-hub')} title="Truck Loading & Dispatch" icon={<ArrowUpRight className="w-5 h-5 text-purple-500" />} colorClass="bg-purple-50 text-purple-900" maxWidth="max-w-xl">
              <form onSubmit={handleSaveLoading} className="space-y-6">
                <select value={loadingDistributorId} onChange={(e) => handleDistributorChange(e.target.value, 'load')} className="w-full h-10 border rounded px-3" required><option value="">Select Distributor...</option>{distributors.map(d => <option key={d.id} value={d.id}>{d.customerName}</option>)}</select>
                <select value={loadingBrandId} onChange={(e) => setLoadingBrandId(e.target.value)} className="w-full h-10 border rounded px-3" required><option value="">Select Brand...</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-bold">Loading Count *</label><input type="number" value={loadingCount || ''} onChange={e => setLoadingCount(parseInt(e.target.value) || 0)} className="h-10 border rounded px-3" required /></div>
                <button type="submit" className="w-full h-12 bg-purple-600 text-white rounded-[10px] font-black uppercase">Log Loading Dispatch</button>
              </form>
            </OperationModal>

          </div>
        </div>
      </PageContainer>
    </>
  )
}

export default JarDashboardPage
