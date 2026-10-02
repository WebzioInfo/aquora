import React from 'react'
import { Cpu, DollarSign, TrendingDown, AlertTriangle, ShieldCheck } from 'lucide-react'
import type { AssetKpiSummary } from '../../../../services/assets'
import KpiCard from '../../../../components/ui/KpiCard'
import { formatINR } from './assetHelpers'

interface AssetKpiCardsProps {
  kpis?: AssetKpiSummary
  loading?: boolean
  isShortScreen?: boolean
  isScrollKpi?: boolean
}

export const AssetKpiCards: React.FC<AssetKpiCardsProps> = ({
  kpis,
  loading = false,
  isShortScreen = false,
  isScrollKpi = false
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0 select-none">
        {[1, 2, 3, 4].map(idx => (
          <div
            key={idx}
            className={`bg-white border border-[#E5E9F2] rounded-[12px] animate-pulse ${
              isShortScreen ? 'h-[76px]' : 'h-[94px]'
            }`}
          />
        ))}
      </div>
    )
  }

  const totalCount = kpis?.totalAssetsCount || 0
  const activeCount = kpis?.activeAssetsCount || 0
  const totalCost = kpis?.totalAssetValue || 0
  const bookValue = kpis?.currentBookValue || 0
  const accumulatedDep = kpis?.accumulatedDepreciation || 0
  const underMaintenance = kpis?.underMaintenanceCount || 0
  const warrantyExpiring = kpis?.warrantyExpiringCount || 0
  const needsAttention = underMaintenance + warrantyExpiring

  // Needs attention sub-label
  let attentionSubLabel: React.ReactNode = null
  if (needsAttention === 0) {
    attentionSubLabel = (
      <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
        <ShieldCheck className="w-3 h-3 text-emerald-500" />
        All clear
      </span>
    )
  } else {
    attentionSubLabel = (
      <span className="text-amber-600 font-medium">
        {underMaintenance} maintenance · {warrantyExpiring} warranty due
      </span>
    )
  }

  const containerClasses = isScrollKpi
    ? 'flex overflow-x-auto pb-1 gap-2.5 snap-x no-scrollbar shrink-0 select-none'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0 select-none'

  const cardWrapperClasses = isScrollKpi ? 'min-w-[220px] flex-1 snap-start' : ''

  return (
    <div className={containerClasses}>
      {/* 1. Total Assets */}
      <div className={cardWrapperClasses}>
        <KpiCard
          label="Total assets"
          value={totalCount}
          icon={Cpu}
          iconBgColor="bg-slate-100"
          iconTextColor="text-slate-600"
          isShortScreen={isShortScreen}
          valueClassName="text-slate-900"
          subLabel={
            <span className="text-slate-500">
              {activeCount} active
            </span>
          }
        />
      </div>

      {/* 2. Capitalized Cost */}
      <div className={cardWrapperClasses}>
        <KpiCard
          label="Capitalized cost"
          value={formatINR(totalCost)}
          icon={DollarSign}
          iconBgColor="bg-slate-100"
          iconTextColor="text-slate-600"
          isShortScreen={isShortScreen}
          valueClassName="text-slate-900"
          subLabel={
            <span className="text-slate-500">
              Purchase value
            </span>
          }
        />
      </div>

      {/* 3. Current Book Value */}
      <div className={cardWrapperClasses}>
        <KpiCard
          label="Current book value"
          value={formatINR(bookValue)}
          icon={TrendingDown}
          iconBgColor="bg-slate-100"
          iconTextColor="text-slate-600"
          isShortScreen={isShortScreen}
          valueClassName="text-slate-900"
          subLabel={
            <span className="text-slate-500">
              Depreciation {formatINR(accumulatedDep)}
            </span>
          }
        />
      </div>

      {/* 4. Needs Attention */}
      <div className={cardWrapperClasses}>
        <KpiCard
          label="Needs attention"
          value={needsAttention}
          icon={AlertTriangle}
          iconBgColor={needsAttention > 0 ? 'bg-amber-50' : 'bg-slate-100'}
          iconTextColor={needsAttention > 0 ? 'text-amber-600' : 'text-slate-600'}
          isShortScreen={isShortScreen}
          valueClassName={needsAttention > 0 ? 'text-amber-700' : 'text-slate-900'}
          subLabel={attentionSubLabel}
        />
      </div>
    </div>
  )
}

export default AssetKpiCards
