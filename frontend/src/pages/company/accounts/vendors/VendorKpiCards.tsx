import React, { useMemo } from 'react'
import { CreditCard, ShoppingBag, Users, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Vendor } from '../../../../services/vendors'
import { formatINR, toPaise, fromPaise } from './vendorHelpers'
import { useViewportSize } from '../../../../hooks/useViewportSize'
import KpiCard from '../../../../components/ui/KpiCard'

interface VendorKpiCardsProps {
  vendors: Vendor[]
  loading?: boolean
  totalFilteredCount?: number
}

export const VendorKpiCards: React.FC<VendorKpiCardsProps> = ({
  vendors,
  loading = false,
  totalFilteredCount
}) => {
  const { isShortScreen, isScrollKpi } = useViewportSize()

  const stats = useMemo(() => {
    let payablePaise = 0
    let purchasedPaise = 0
    let vendorsWithBalance = 0
    let activeCount = 0
    let latestDate: Date | null = null
    let latestVendorName = ''
    let latestAmount = 0

    for (const v of vendors) {
      const balPaise = toPaise(v.currentBalance)
      const purchPaise = toPaise(v.totalPurchaseValue)

      payablePaise += balPaise
      purchasedPaise += purchPaise

      if (v.currentBalance > 0) {
        vendorsWithBalance++
      }

      if (v.isActive) {
        activeCount++
      }

      if (v.lastPurchaseDate) {
        const d = new Date(v.lastPurchaseDate)
        if (!latestDate || d > latestDate) {
          latestDate = d
          latestVendorName = v.name
          latestAmount = v.totalPurchaseValue || 0
        }
      }
    }

    const totalPayable = fromPaise(payablePaise)
    const totalPurchased = fromPaise(purchasedPaise)
    const totalPurchasesCount = vendors.reduce((acc, v) => acc + (v.totalPurchasesCount || 0), 0)

    let lastPurchaseFormatted = 'No purchases'
    let lastPurchaseSubLabel = '—'
    if (latestDate) {
      lastPurchaseFormatted = latestDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
      })
      lastPurchaseSubLabel = `${latestVendorName} · ₹${Math.round(latestAmount).toLocaleString('en-IN')}`
    }

    return {
      totalPayable,
      totalPurchased,
      totalPurchasesCount,
      vendorsWithBalance,
      activeCount,
      totalVendors: totalFilteredCount !== undefined ? totalFilteredCount : vendors.length,
      lastPurchaseFormatted,
      lastPurchaseSubLabel
    }
  }, [vendors, totalFilteredCount])

  // Skeleton loading
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

  // Viewport height <= 600px or mobile: Horizontal scrollable strip of compact chips
  if (isScrollKpi) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar shrink-0 w-full select-none">
        {/* Chip 1 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Payable</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{formatINR(stats.totalPayable)}</span>
          </div>
          <div className="p-1 rounded-md bg-blue-50 text-[#1A56DB]">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Chip 2 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Purchased</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{formatINR(stats.totalPurchased)}</span>
          </div>
          <div className="p-1 rounded-md bg-slate-100 text-slate-600">
            <ShoppingBag className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Chip 3 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active Vendors</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{stats.activeCount}</span>
          </div>
          <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
            <Users className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Chip 4 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Last Purchase</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{stats.lastPurchaseFormatted}</span>
          </div>
          <div className="p-1 rounded-md bg-indigo-50 text-indigo-600">
            <Calendar className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 w-full shrink-0 select-none">
      {/* 1. Total Payable */}
      <KpiCard
        label="Total Payable"
        value={formatINR(stats.totalPayable)}
        icon={CreditCard}
        iconBgColor="bg-blue-50"
        iconTextColor="text-[#1A56DB]"
        isShortScreen={isShortScreen}
        subLabel={
          stats.vendorsWithBalance > 0 ? (
            <span className="text-rose-600 font-medium">
              {stats.vendorsWithBalance} {stats.vendorsWithBalance === 1 ? 'vendor' : 'vendors'} with balance
            </span>
          ) : (
            <span className="text-emerald-600 font-medium">
              All settled
            </span>
          )
        }
      />

      {/* 2. Total Purchased */}
      <KpiCard
        label="Total Purchased"
        value={formatINR(stats.totalPurchased)}
        icon={ShoppingBag}
        iconBgColor="bg-slate-100"
        iconTextColor="text-slate-600"
        isShortScreen={isShortScreen}
        subLabel={
          <span className="text-slate-500 truncate">
            {stats.totalPurchasesCount} {stats.totalPurchasesCount === 1 ? 'purchase' : 'purchases'}
          </span>
        }
      />

      {/* 3. Active Vendors */}
      <KpiCard
        label="Active Vendors"
        value={stats.activeCount}
        icon={Users}
        iconBgColor="bg-emerald-50"
        iconTextColor="text-emerald-600"
        isShortScreen={isShortScreen}
        subLabel={
          <span className="text-slate-500 truncate">
            of {stats.totalVendors} total
          </span>
        }
      />

      {/* 4. Last Purchase */}
      <KpiCard
        label="Last Purchase"
        value={stats.lastPurchaseFormatted}
        icon={Calendar}
        iconBgColor="bg-indigo-50"
        iconTextColor="text-indigo-600"
        isShortScreen={isShortScreen}
        subLabel={
          <span className="text-slate-500 truncate" title={stats.lastPurchaseSubLabel}>
            {stats.lastPurchaseSubLabel}
          </span>
        }
      />
    </div>
  )
}

export default VendorKpiCards
