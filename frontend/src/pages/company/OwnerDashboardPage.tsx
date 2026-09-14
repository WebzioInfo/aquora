import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Package, DollarSign, Truck, AlertTriangle, AlertCircle, RefreshCw,
  TrendingDown, ArrowUpRight, Clock, Users,
  CheckCircle2, ShieldAlert, FileText, ChevronRight,
  Activity, Factory, Info
} from 'lucide-react'
import { api } from '../../services/api'
import { twentyLService } from '../../services/twentyL'
import { simpleAccountsService } from '../../services/simpleAccounts'
import { useAuthStore } from '../../store/useAuthStore'
import PageContainer from '../../components/ui/layout/PageContainer'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'

export const OwnerDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Standard jar replacement value for capital valuation
  const JAR_REPLACEMENT_VALUE = 200

  // 1. Fetch 20L Plant & Field Balances
  const {
    data: plantBalances,
    refetch: refetchBalances
  } = useQuery({
    queryKey: ['ownerPlantBalances'],
    queryFn: twentyLService.getPlantBalances,
    staleTime: 30000
  })

  // 2. Fetch Trips for Driver Accountability
  const {
    data: tripsData = [],
    refetch: refetchTrips
  } = useQuery({
    queryKey: ['ownerTrips'],
    queryFn: async () => {
      const res = await api.get('/api/v1/20l/trips')
      return res.data?.data || []
    },
    staleTime: 30000
  })

  // 3. Fetch Distributor Accounts Summary
  const {
    data: distributorAccounts = [],
    refetch: refetchDistributors
  } = useQuery({
    queryKey: ['ownerDistributors'],
    queryFn: twentyLService.getDistributorAccounts,
    staleTime: 30000
  })

  // 4. Fetch Distributor Supplies for Today
  const {
    data: suppliesResponse,
    refetch: refetchSupplies
  } = useQuery({
    queryKey: ['ownerSuppliesToday'],
    queryFn: async () => {
      const res = await api.get('/api/v1/20l/distributor-supplies?pageSize=50')
      return res.data?.data || { items: [] }
    },
    staleTime: 30000
  })

  // 5. Fetch Active Production Batches
  const {
    data: activeBatches = [],
    refetch: refetchBatches
  } = useQuery({
    queryKey: ['ownerActiveBatches'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production/batches/active')
      return res.data?.data || []
    },
    staleTime: 30000
  })

  // 6. Fetch Accounts Dashboard Summary
  const {
    refetch: refetchAccounts
  } = useQuery({
    queryKey: ['ownerAccountsSummary'],
    queryFn: simpleAccountsService.getDashboardSummary,
    staleTime: 30000
  })

  // Refresh All Data
  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    await Promise.all([
      refetchBalances(),
      refetchTrips(),
      refetchDistributors(),
      refetchSupplies(),
      refetchBatches(),
      refetchAccounts()
    ])
    setIsRefreshing(false)
  }

  // ==========================================
  // DERIVED COMPUTATIONS
  // ==========================================

  // Today's boundaries
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const suppliesToday = useMemo(() => {
    const items = suppliesResponse?.items || []
    return items.filter((s: any) => {
      const created = (s.createdAt || s.dispatchedAt || '').slice(0, 10)
      return created === todayStr
    })
  }, [suppliesResponse, todayStr])

  const tripsToday = useMemo(() => {
    return (tripsData || []).filter((t: any) => {
      const planned = (t.plannedDate || t.createdAt || '').slice(0, 10)
      return planned === todayStr
    })
  }, [tripsData, todayStr])

  // 1. Cash Collected Today across channels
  const cashFromDistributorsToday = useMemo(() => {
    return suppliesToday.reduce((sum: number, s: any) => sum + (Number(s.amountPaid) || 0), 0)
  }, [suppliesToday])

  const cashFromDriversToday = useMemo(() => {
    return tripsToday.reduce((sum: number, t: any) => sum + (Number(t.totalCashCollected) || 0), 0)
  }, [tripsToday])

  const totalOperationalCashToday = cashFromDistributorsToday + cashFromDriversToday

  // 2. Jars Dispatched vs Returned Today
  const jarsSuppliedToday = useMemo(() => {
    return suppliesToday.reduce((sum: number, s: any) => sum + (Number(s.quantitySupplied) || 0), 0)
  }, [suppliesToday])

  const emptiesReturnedToday = useMemo(() => {
    return suppliesToday.reduce((sum: number, s: any) => sum + (Number(s.quantityEmptyReturned) || 0), 0)
  }, [suppliesToday])

  const netJarMovementToday = jarsSuppliedToday - emptiesReturnedToday

  // 3. Jars in the field
  const plantFilled = plantBalances?.plant?.filledAvailable ?? 0
  const plantEmpty = plantBalances?.plant?.emptyReusable ?? 0
  const withDistributors = plantBalances?.field?.withDistributors ?? 0
  const onVehicles = plantBalances?.field?.onVehicles ?? 0
  const withCustomers = plantBalances?.field?.withCustomers ?? 0
  const damagedQuarantine = plantBalances?.plant?.damagedQuarantined ?? 0
  const condemned = plantBalances?.plant?.condemnedScrapped ?? 0
  const totalSystemJars = plantBalances?.grandTotalSystemJars ?? 0

  const totalJarsInField = withDistributors + onVehicles + withCustomers
  const capitalFleetValue = totalSystemJars * JAR_REPLACEMENT_VALUE

  // 4. Receivables
  const totalDistributorReceivable = useMemo(() => {
    return (distributorAccounts || []).reduce((sum: number, d: any) => sum + (Number(d.commercial?.netReceivable) || 0), 0)
  }, [distributorAccounts])

  // Top 5 debtors
  const topDebtors = useMemo(() => {
    return [...(distributorAccounts || [])]
      .filter((d: any) => (d.commercial?.netReceivable || 0) > 0)
      .sort((a: any, b: any) => (b.commercial?.netReceivable || 0) - (a.commercial?.netReceivable || 0))
      .slice(0, 5)
  }, [distributorAccounts])

  // Distributor Alerts
  const distributorAlerts = useMemo(() => {
    const alerts: Array<{ name: string; issue: string; type: 'danger' | 'warning' | 'info'; id: string }> = []
    ;(distributorAccounts || []).forEach((d: any) => {
      const creditLimit = Number(d.profile?.creditLimit) || 0
      const balance = Number(d.commercial?.netReceivable) || 0
      const emptyHeld = Number(d.physical?.emptyJarsHeld) || 0
      const fullHeld = Number(d.physical?.fullJarsHeld) || 0

      if (creditLimit > 0 && balance > creditLimit) {
        alerts.push({
          name: d.customerName,
          issue: `Over credit limit: ₹${balance.toLocaleString('en-IN')} (Limit: ₹${creditLimit.toLocaleString('en-IN')})`,
          type: 'danger',
          id: d.customerId
        })
      } else if (balance > 25000) {
        alerts.push({
          name: d.customerName,
          issue: `Large unsettled balance: ₹${balance.toLocaleString('en-IN')}`,
          type: 'warning',
          id: d.customerId
        })
      }

      if (emptyHeld > 200 && fullHeld < 20) {
        alerts.push({
          name: d.customerName,
          issue: `Slow empty jar return: holding ${emptyHeld} empty jars with low refill frequency`,
          type: 'info',
          id: d.customerId
        })
      }
    })
    return alerts
  }, [distributorAccounts])

  // Driver Trip Shortage Invariant Check
  const tripDiscrepancies = useMemo(() => {
    return (tripsToday || []).filter((t: any) => {
      const loaded = Number(t.loadedFilledJars) || 0
      const delivered = Number(t.deliveredFilledJars) || 0
      const returnedFilled = Number(t.returnedFilledJars) || 0
      const damaged = Number(t.damagedJarsCount) || 0
      const lost = Number(t.lostJarsCount) || 0
      const isReconciled = t.status === 'RECONCILED' || t.status === 'COMPLETED'
      if (!isReconciled && t.status !== 'IN_TRANSIT') return false
      // Mathematical invariant: Loaded == Delivered + ReturnedFilled + Damaged + Lost
      const accounted = delivered + returnedFilled + damaged + lost
      return loaded > 0 && accounted !== loaded
    })
  }, [tripsToday])

  return (
    <PageContainer>
      {/* ── 0. OWNER EXECUTIVE HEADER ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Plant Owner Command Center
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                  Owner Executive View
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                {user?.fullName ? `Welcome back, ${user.fullName}. ` : ''}Real-time operational health, jar fleet security, and revenue tracking for Aquzio 20L Plant.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Plant Data'}</span>
            </button>
            <button
              onClick={() => navigate('/company/operations')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <span>20L Operations Hub</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Audit Disclaimer Strip */}
        <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong className="font-bold">Operational Transparency Notice:</strong> Aquzio currently tracks 20L operations independently from the General Ledger. Cash and Credit totals shown below represent driver and dispatch slips collected at the plant and are pending automated posting to the official Accounts Ledger.
          </div>
        </div>
      </div>

      {/* ── 1. TOP STRIP — TODAY AT A GLANCE (6 KPI CARDS) ───────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        
        {/* Card 1: Cash Collected Today */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Cash In Hand Today</span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              ₹{totalOperationalCashToday.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Drivers + Plant Gate</span>
            <span className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">Unposted</span>
          </div>
        </div>

        {/* Card 2: Jars Dispatched vs Returned */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Today's Jar Turnover</span>
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{jarsSuppliedToday}</span>
              <span className="text-xs font-semibold text-slate-400">out /</span>
              <span className="text-lg font-bold text-emerald-600">{emptiesReturnedToday}</span>
              <span className="text-xs font-semibold text-slate-400">in</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Net Field Movement:</span>
            <span className={`font-bold ${netJarMovementToday > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
              {netJarMovementToday > 0 ? `+${netJarMovementToday} Out` : `${netJarMovementToday} Back`}
            </span>
          </div>
        </div>

        {/* Card 3: Jars Out in Field */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Jars Floating In Market</span>
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {totalJarsInField.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Distributors + Vans</span>
            <span className="font-bold text-indigo-700">
              {totalSystemJars > 0 ? `${Math.round((totalJarsInField / totalSystemJars) * 100)}% of Fleet` : '—'}
            </span>
          </div>
        </div>

        {/* Card 4: Active Trips */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Vehicle Trips Today</span>
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {tripsToday.length}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Reconciliation:</span>
            {tripDiscrepancies.length > 0 ? (
              <span className="font-bold text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {tripDiscrepancies.length} Shortage
              </span>
            ) : (
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> All Clean
              </span>
            )}
          </div>
        </div>

        {/* Card 5: Outstanding Receivables */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Owed To Plant</span>
              <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              ₹{totalDistributorReceivable.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Distributors</span>
            <span className="text-rose-600 font-bold">{topDebtors.length} Debtors</span>
          </div>
        </div>

        {/* Card 6: Production Output */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Production Output</span>
              <div className="p-1.5 bg-cyan-50 text-cyan-600 rounded-lg">
                <Factory className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {plantFilled}
              <span className="text-xs font-semibold text-slate-400 ml-1">filled jars</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Plant Status:</span>
            <span className="font-bold text-cyan-700">{activeBatches.length} Active Batches</span>
          </div>
        </div>

      </div>

      {/* ── 2. JAR FLEET HEALTH (CAPITAL ASSET BREAKDOWN) ────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              20L Jar Fleet Capital Health
            </h2>
            <p className="text-xs text-slate-500">
              Your jars are physical money. Track where all {totalSystemJars.toLocaleString('en-IN')} containers currently reside.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-xl">
            <span className="text-xs text-blue-700 font-medium">Total Fleet Capital Asset Value:</span>
            <strong className="text-sm font-black text-blue-900">₹{capitalFleetValue.toLocaleString('en-IN')}</strong>
            <span className="text-[10px] text-blue-600">(@₹{JAR_REPLACEMENT_VALUE}/jar)</span>
          </div>
        </div>

        {/* Visual Stacked Bar representation */}
        {totalSystemJars > 0 ? (
          <div className="space-y-2">
            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${(plantFilled / totalSystemJars) * 100}%` }}
                className="bg-blue-600 transition-all"
                title={`Plant Filled: ${plantFilled}`}
              />
              <div
                style={{ width: `${(plantEmpty / totalSystemJars) * 100}%` }}
                className="bg-emerald-500 transition-all"
                title={`Plant Empty: ${plantEmpty}`}
              />
              <div
                style={{ width: `${(withDistributors / totalSystemJars) * 100}%` }}
                className="bg-purple-600 transition-all"
                title={`With Distributors: ${withDistributors}`}
              />
              <div
                style={{ width: `${(onVehicles / totalSystemJars) * 100}%` }}
                className="bg-amber-500 transition-all"
                title={`On Vehicles: ${onVehicles}`}
              />
              <div
                style={{ width: `${(damagedQuarantine / totalSystemJars) * 100}%` }}
                className="bg-rose-500 transition-all"
                title={`Damaged Quarantine: ${damagedQuarantine}`}
              />
              <div
                style={{ width: `${(condemned / totalSystemJars) * 100}%` }}
                className="bg-slate-400 transition-all"
                title={`Condemned: ${condemned}`}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Plant Filled</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Plant Empty</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> With Distributors</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> In Transit / Vehicles</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Damaged / Quarantine</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Scrapped / Condemned</span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
            <p className="text-xs font-bold text-slate-600">No baseline jar inventory initialized</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Initialize plant opening balances to view the visual fleet distribution.</p>
          </div>
        )}

        {/* Jar Breakdown 8-State Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-1">
          
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Plant Filled</span>
            <div className="text-lg font-black text-slate-900 mt-1">{plantFilled}</div>
            <span className="text-[10px] text-slate-400">Ready to dispatch</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Plant Empty</span>
            <div className="text-lg font-black text-slate-900 mt-1">{plantEmpty}</div>
            <span className="text-[10px] text-slate-400">Ready to refill</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Distributors</span>
            <div className="text-lg font-black text-slate-900 mt-1">{withDistributors}</div>
            <span className="text-[10px] text-slate-400">In depot/godowns</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">On Vehicles</span>
            <div className="text-lg font-black text-slate-900 mt-1">{onVehicles}</div>
            <span className="text-[10px] text-slate-400">Active route trips</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">With Customers</span>
            <div className="text-lg font-black text-slate-900 mt-1">{withCustomers}</div>
            <span className="text-[10px] text-slate-400">In offices/homes</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">In Quarantine</span>
            <div className="text-lg font-black text-slate-900 mt-1">{damagedQuarantine}</div>
            <span className="text-[10px] text-rose-600 font-medium">Defects / Repairs</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Condemned</span>
            <div className="text-lg font-black text-slate-900 mt-1">{condemned}</div>
            <span className="text-[10px] text-slate-400">Scrapped permanently</span>
          </div>

          {/* Honest Unaccounted Card — NOT clamped to zero */}
          <div className="bg-amber-50/60 border border-amber-300/80 rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
              Unreconciled <Info className="w-3 h-3 text-amber-600" />
            </span>
            <div className="text-sm font-bold text-amber-900 mt-1">Audit Needed</div>
            <span className="text-[10px] text-amber-700 font-medium">Physical count pending</span>
          </div>

        </div>
      </div>

      {/* ── 3 & 4. TWO-COLUMN: CASH & RECEIVABLES + DISTRIBUTORS ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* SECTION 3: Cash & Receivables Snapshot */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Cash Collections & Top Receivables
                </h2>
                <p className="text-xs text-slate-500">Operational cash in transit and debtors who owe money to the plant.</p>
              </div>
              <button
                onClick={() => navigate('/company/accounts/dashboard')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                Accounts <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Channels breakdown */}
            <div className="grid grid-cols-2 gap-3 mt-3.5">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <span className="text-[11px] font-bold text-emerald-800 block">Distributor Refill Receipts</span>
                <div className="text-lg font-black text-emerald-950 mt-0.5">₹{cashFromDistributorsToday.toLocaleString('en-IN')}</div>
                <span className="text-[10px] text-emerald-700">Collected at factory gate</span>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                <span className="text-[11px] font-bold text-blue-800 block">Driver Route Cash</span>
                <div className="text-lg font-black text-blue-950 mt-0.5">₹{cashFromDriversToday.toLocaleString('en-IN')}</div>
                <span className="text-[10px] text-blue-700">In transit with delivery vans</span>
              </div>
            </div>

            {/* Top Debtors Table */}
            <div className="mt-4 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Top 5 Outstanding Balances</span>
              
              {topDebtors.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {topDebtors.map((d: any) => (
                    <div key={d.customerId} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="font-bold text-slate-900">{d.customerName}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>{d.phone || 'No phone'}</span>
                          <span>• {d.physical?.totalJarsHeld || 0} jars held</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-rose-600">₹{Number(d.commercial?.netReceivable || 0).toLocaleString('en-IN')}</div>
                        <span className="text-[10px] text-slate-400">Credit balance</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 font-medium">
                  No active distributor receivables recorded today.
                </div>
              )}
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center justify-between">
            <span>Total Operational Debt Owed: <strong>₹{totalDistributorReceivable.toLocaleString('en-IN')}</strong></span>
            <span className="text-slate-400 font-medium">Pending invoice posting</span>
          </div>
        </div>

        {/* SECTION 4: Distributors at a Glance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Distributor Network Status
                </h2>
                <p className="text-xs text-slate-500">
                  {distributorAccounts.length} active registered wholesale supply partners.
                </p>
              </div>
              <button
                onClick={() => navigate('/company/operations')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                Distributor Hub <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Needs attention feed */}
            <div className="mt-3.5 space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Distributors Needing Attention</span>

              {distributorAlerts.length > 0 ? (
                <div className="space-y-2">
                  {distributorAlerts.slice(0, 4).map((alert, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                        alert.type === 'danger'
                          ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                          : alert.type === 'warning'
                          ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                          : 'bg-blue-50/70 border-blue-200 text-blue-900'
                      }`}
                    >
                      <div>
                        <strong className="font-bold block">{alert.name}</strong>
                        <span className="text-[11px] opacity-90">{alert.issue}</span>
                      </div>
                      <button
                        onClick={() => navigate('/company/operations')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white shadow-xs hover:shadow transition-all shrink-0 cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 font-medium flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> All distributors operating within assigned credit limits and jar tolerances.
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total Jars Held in Godowns: <strong>{withDistributors} jars</strong></span>
            <button
              onClick={() => navigate('/company/customers')}
              className="font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              Customer Directory <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>

      {/* ── 5 & 6. TWO-COLUMN: DRIVERS & TRIPS + PRODUCTION SNAPSHOT ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* SECTION 5: Drivers & Trips Today */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600" />
                Drivers & Fleet Operations Today
              </h2>
              <p className="text-xs text-slate-500">Trip accountability: Loaded = Delivered + Returned.</p>
            </div>
            <EnterpriseBadge variant={tripDiscrepancies.length > 0 ? 'danger' : 'success'}>
              {tripDiscrepancies.length > 0 ? `${tripDiscrepancies.length} Shortage Alert` : 'All Balanced'}
            </EnterpriseBadge>
          </div>

          {/* Today's active trips table / list */}
          {tripsToday.length > 0 ? (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {tripsToday.slice(0, 4).map((t: any) => {
                const loaded = Number(t.loadedFilledJars) || 0
                const delivered = Number(t.deliveredFilledJars) || 0
                const returnedEmpty = Number(t.collectedEmptyJars) || 0
                const cash = Number(t.totalCashCollected) || 0

                return (
                  <div key={t.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{t.driverName || 'Primary Driver'}</span>
                        <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{t.vehicleNumber || 'Van'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Route: {t.routeCode || 'General Delivery'} • {loaded} loaded • {delivered} delivered • {returnedEmpty} empties back
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600">₹{cash.toLocaleString('en-IN')}</div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">{t.status || 'Active'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-xl text-center">
              <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">No multi-stop vehicle trips launched today</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Drivers may be using direct plant refills or legacy queue.</p>
            </div>
          )}

          {/* Shortage callout */}
          {tripDiscrepancies.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-900">
              <span className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                Trip discrepancy detected: jars loaded do not equal jars accounted for.
              </span>
              <button
                onClick={() => navigate('/company/operations')}
                className="font-bold text-red-700 underline shrink-0 cursor-pointer"
              >
                Investigate
              </button>
            </div>
          )}
        </div>

        {/* SECTION 6: Production Snapshot */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Factory className="w-5 h-5 text-cyan-600" />
                Factory Production & Bottling
              </h2>
              <p className="text-xs text-slate-500">Live operational water treatment and bottling batches.</p>
            </div>
            <button
              onClick={() => navigate('/company/production-setup')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              Lines & Shifts <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Active batches list */}
          {activeBatches.length > 0 ? (
            <div className="space-y-2.5">
              {activeBatches.slice(0, 3).map((b: any) => (
                <div key={b.id || b.batchId} className="p-3 bg-cyan-50/40 border border-cyan-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>Batch #{b.batchNumber || b.code || 'B-ACTIVE'}</span>
                      <EnterpriseBadge variant="info">Bottling Active</EnterpriseBadge>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Line: {b.productionLineName || '20L Auto Line'} • Operator: {b.operatorName || 'Plant Operator'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-cyan-900 text-sm">{b.casesProduced || b.outputCases || 0}</span>
                    <span className="text-[10px] text-slate-500 block">Jars output</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-xl text-center">
              <Factory className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">No active bottling batches currently running</p>
              <p className="text-[11px] text-slate-400 mt-0.5">The plant floor is currently idle or shifts have concluded.</p>
            </div>
          )}

          {/* Production Disconnect Callout */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              <strong>Note on Finished Stock:</strong> Bottling output completed in Production Batches must be physically verified before dispatch until automated batch-to-stock integration is activated.
            </span>
          </div>
        </div>

      </div>

      {/* ── 7. ALERTS & IMMEDIATE ATTENTION FEED ─────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Action Required & Plant Governance Alerts
            </h2>
            <p className="text-xs text-slate-500">
              High-priority operational warnings that require owner attention today.
            </p>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            Priority Feed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          
          {/* Alert 1: Physical Stock Audit */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Physical Stock Count Overdue</span>
              </div>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                No physical jar count audit has been recorded this month. Jar shrinkage and unaccounted loss cannot be measured without a physical floor count.
              </p>
            </div>
            <button
              onClick={() => navigate('/company/operations')}
              className="self-start px-3 py-1.5 text-xs font-bold bg-white text-amber-900 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Open Jar Ledger
            </button>
          </div>

          {/* Alert 2: Unposted Cash */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-blue-800 font-bold text-xs">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <span>₹{totalOperationalCashToday.toLocaleString('en-IN')} Unposted Cash</span>
              </div>
              <p className="text-xs text-blue-900 mt-1 leading-relaxed">
                Operational cash collected from today's delivery runs and distributor gate supplies is waiting to be formally verified and debited into the company Cash Book.
              </p>
            </div>
            <button
              onClick={() => navigate('/company/accounts/dashboard')}
              className="self-start px-3 py-1.5 text-xs font-bold bg-white text-blue-900 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
            >
              Review Cash Book
            </button>
          </div>

          {/* Alert 3: Damaged Quarantine */}
          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{damagedQuarantine} Jars in Quarantine</span>
              </div>
              <p className="text-xs text-rose-900 mt-1 leading-relaxed">
                Cracked or contaminated jars are currently isolated in plant quarantine. Review whether these can be repaired or must be formally condemned as scrap.
              </p>
            </div>
            <button
              onClick={() => navigate('/company/operations')}
              className="self-start px-3 py-1.5 text-xs font-bold bg-white text-rose-900 border border-rose-300 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
            >
              Inspect Quarantine
            </button>
          </div>

        </div>
      </div>

      {/* ── 8. QUICK SHORTCUTS ROW ───────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Direct Module Shortcuts
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/company/operations')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Package className="w-3.5 h-3.5 text-blue-600" /> 20L Supplies
            </button>
            <button
              onClick={() => navigate('/company/operations')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5 text-amber-600" /> Driver Trips
            </button>
            <button
              onClick={() => navigate('/company/production-setup')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Factory className="w-3.5 h-3.5 text-cyan-600" /> Production Setup
            </button>
            <button
              onClick={() => navigate('/company/accounts/dashboard')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Accounts & Cash
            </button>
            <button
              onClick={() => navigate('/company/reports')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-purple-600" /> Business Reports
            </button>
          </div>
        </div>
      </div>

    </PageContainer>
  )
}

export default OwnerDashboardPage
