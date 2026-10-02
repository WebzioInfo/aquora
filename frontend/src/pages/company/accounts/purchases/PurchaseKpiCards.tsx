import React, { useMemo } from 'react'
import { ShoppingBag, CheckCircle2, AlertCircle, Users } from 'lucide-react'
import type { Purchase, PurchaseSummaryStats } from '../../../../services/purchases'
import { formatINR, toPaise, fromPaise } from './purchaseHelpers'
import { useViewportSize } from '../../../../hooks/useViewportSize'
import KpiCard from '../../../../components/ui/KpiCard'

interface PurchaseKpiCardsProps {
  purchases: Purchase[]
  summaryStats?: PurchaseSummaryStats | null
  loading?: boolean
  totalCount?: number
}

export const PurchaseKpiCards: React.FC<PurchaseKpiCardsProps> = ({
  purchases,
  summaryStats,
  loading = false,
  totalCount
}) => {
  const { isShortScreen, isScrollKpi } = useViewportSize()

  const stats = useMemo(() => {
    // If backend returns summaryStats for the whole filtered range, prioritize it!
    if (summaryStats && summaryStats.totalPurchasesCount !== undefined) {
      const totalGross = summaryStats.totalPurchaseValue || 0
      const totalBalance = summaryStats.outstandingBalance || 0
      const totalPaid = Math.max(0, totalGross - totalBalance)
      const settledPercent = totalGross > 0 ? Math.round((totalPaid / totalGross) * 100) : 100

      return {
        totalGross,
        totalPaid,
        totalBalance,
        settledPercent,
        activePurchasesCount: summaryStats.totalPurchasesCount,
        todayCount: summaryStats.todayPurchasesCount,
        pendingCount: summaryStats.pendingPaymentsCount,
        activeVendorsCount: summaryStats.activeVendorsCount,
        vendorNames: [],
        topVendor: ''
      }
    }

    // Client-side fallback computation
    const activePurchases = purchases.filter(p => !p.isCancelled && p.paymentStatus !== 'Cancelled')

    let totalGrossPaise = 0
    let totalPaidPaise = 0
    let totalBalancePaise = 0
    const vendorCounts = new Map<string, number>()
    let pendingCount = 0

    const todayStr = new Date().toISOString().slice(0, 10)
    let todayPurchases = 0

    for (const p of activePurchases) {
      const grossPaise = toPaise(p.grandTotal)
      const paidPaise = toPaise(p.amountPaid)
      const balancePaise = toPaise(p.balanceAmount)

      totalGrossPaise += grossPaise
      totalPaidPaise += paidPaise
      totalBalancePaise += balancePaise

      if (balancePaise > 0) {
        pendingCount++
      }

      if (p.purchaseDate && p.purchaseDate.slice(0, 10) === todayStr) {
        todayPurchases++
      }

      const vName = (p.vendorName || 'Unknown Vendor').trim()
      vendorCounts.set(vName, (vendorCounts.get(vName) || 0) + 1)
    }

    const totalGross = fromPaise(totalGrossPaise)
    const totalPaid = fromPaise(totalPaidPaise)
    const totalBalance = fromPaise(totalBalancePaise)

    const settledPercent = totalGross > 0 ? Math.round((totalPaid / totalGross) * 100) : 100

    let topVendor = ''
    let topCount = 0
    for (const [v, count] of vendorCounts.entries()) {
      if (count > topCount) {
        topCount = count
        topVendor = v
      }
    }

    return {
      totalGross,
      totalPaid,
      totalBalance,
      settledPercent,
      activePurchasesCount: activePurchases.length,
      todayCount: todayPurchases,
      pendingCount,
      activeVendorsCount: vendorCounts.size,
      vendorNames: Array.from(vendorCounts.keys()),
      topVendor
    }
  }, [purchases, summaryStats])

  if (loading) {
    if (isScrollKpi) {
      return (
        <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar shrink-0 w-full">
          {[1, 2, 3, 4].map(idx => (
            <div
              key={idx}
              className="min-w-[160px] h-[56px] p-2 bg-white border border-[#E5E9F2] rounded-xl animate-pulse shrink-0"
            />
          ))}
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 w-full shrink-0">
        {[1, 2, 3, 4].map(idx => (
          <div
            key={idx}
            className={`bg-white border border-[#E5E9F2] rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] animate-pulse flex flex-col justify-between ${
              isShortScreen ? 'h-[72px] p-2.5' : 'h-[92px] p-3'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-slate-100 rounded" />
              <div className="h-5 w-5 bg-slate-100 rounded" />
            </div>
            <div className="h-5 w-28 bg-slate-100 rounded mt-1" />
          </div>
        ))}
      </div>
    )
  }

  // Active Vendors sub-label logic
  let vendorSubLabel = 'No active vendors'
  if (stats.activeVendorsCount === 1) {
    vendorSubLabel = stats.vendorNames[0] || '1 vendor'
  } else if (stats.activeVendorsCount > 1) {
    vendorSubLabel = stats.topVendor ? `Top: ${stats.topVendor}` : `${stats.activeVendorsCount} vendors`
  }

  // Viewport height <= 600px or mobile: Horizontally scrollable strip of compact chips
  if (isScrollKpi) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar shrink-0 w-full select-none">
        {/* Chip 1 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Value</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{formatINR(stats.totalGross)}</span>
          </div>
          <div className="p-1 rounded-md bg-blue-50 text-[#1A56DB]">
            <ShoppingBag className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Chip 2 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Paid</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{formatINR(stats.totalPaid)}</span>
          </div>
          <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Chip 3 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Outstanding</span>
            <span className={`text-sm font-bold font-mono ${stats.totalBalance > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatINR(stats.totalBalance)}
            </span>
          </div>
          <div className={`p-1 rounded-md ${
            stats.totalBalance > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
          }`}>
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Chip 4 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active Vendors</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{stats.activeVendorsCount}</span>
          </div>
          <div className="p-1 rounded-md bg-slate-100 text-slate-600">
            <Users className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 w-full shrink-0 select-none">
      {/* 1. Total Value */}
      <KpiCard
        label="Total Value"
        value={formatINR(stats.totalGross)}
        icon={ShoppingBag}
        iconBgColor="bg-blue-50"
        iconTextColor="text-[#1A56DB]"
        isShortScreen={isShortScreen}
        subLabel={
          <span className="text-slate-500 truncate">
            {stats.activePurchasesCount} purchases · {stats.todayCount} today
          </span>
        }
      />

      {/* 2. Paid */}
      <KpiCard
        label="Paid"
        value={formatINR(stats.totalPaid)}
        icon={CheckCircle2}
        iconBgColor="bg-emerald-50"
        iconTextColor="text-emerald-600"
        isShortScreen={isShortScreen}
        subLabel={
          <span className="text-slate-500">
            {stats.settledPercent}% settled
          </span>
        }
      />

      {/* 3. Outstanding */}
      <KpiCard
        label="Outstanding"
        value={formatINR(stats.totalBalance)}
        valueClassName={stats.totalBalance > 0 ? 'text-rose-600' : 'text-slate-900'}
        icon={AlertCircle}
        iconBgColor={stats.totalBalance > 0 ? 'bg-rose-50' : 'bg-emerald-50'}
        iconTextColor={stats.totalBalance > 0 ? 'text-rose-500' : 'text-emerald-500'}
        isShortScreen={isShortScreen}
        subLabel={
          stats.totalBalance > 0 ? (
            <span className="text-rose-600 font-medium">
              {stats.pendingCount} pending payments
            </span>
          ) : (
            <span className="text-emerald-600 font-medium">
              No pending payments
            </span>
          )
        }
      />

      {/* 4. Active Vendors */}
      <KpiCard
        label="Active Vendors"
        value={stats.activeVendorsCount}
        icon={Users}
        iconBgColor="bg-slate-100"
        iconTextColor="text-slate-600"
        isShortScreen={isShortScreen}
        subLabel={
          <span className="text-slate-500 truncate" title={vendorSubLabel}>
            {vendorSubLabel}
          </span>
        }
      />
    </div>
  )
}
