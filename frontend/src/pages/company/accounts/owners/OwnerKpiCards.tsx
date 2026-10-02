import React from 'react'
import { Landmark, TrendingUp, TrendingDown, PieChart } from 'lucide-react'
import type { Owner } from '../../../../services/simpleAccounts'
import KpiCard from '../../../../components/ui/KpiCard'
import { formatINR, calculateOwnersMetrics } from './ownerHelpers'

interface OwnerKpiCardsProps {
  owners: Owner[]
  loading?: boolean
  isShortScreen?: boolean
  isScrollKpi?: boolean
}

export const OwnerKpiCards: React.FC<OwnerKpiCardsProps> = ({
  owners,
  loading = false,
  isShortScreen = false,
  isScrollKpi = false
}) => {
  const metrics = React.useMemo(() => calculateOwnersMetrics(owners), [owners])

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

  // 4th card sub-label based on allocation status
  let ownershipSubLabel: React.ReactNode = null
  if (metrics.totalOwnership < 100) {
    ownershipSubLabel = (
      <span className="text-amber-600 font-medium">
        {metrics.unallocatedOwnership}% unallocated
      </span>
    )
  } else if (metrics.totalOwnership === 100) {
    ownershipSubLabel = (
      <span className="text-emerald-600 font-medium">
        Fully allocated
      </span>
    )
  } else {
    ownershipSubLabel = (
      <span className="text-rose-600 font-medium">
        Over-allocated by {metrics.overAllocatedOwnership}%
      </span>
    )
  }

  const containerClasses = isScrollKpi
    ? 'flex overflow-x-auto pb-1 gap-2.5 snap-x no-scrollbar shrink-0 select-none'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0 select-none'

  const cardWrapperClasses = isScrollKpi ? 'min-w-[220px] flex-1 snap-start' : ''

  return (
    <div className={containerClasses}>
      {/* 1. Current Investment */}
      <div className={cardWrapperClasses}>
        <KpiCard
          label="Current investment"
          value={formatINR(metrics.totalCurrentInvestment)}
          icon={Landmark}
          iconBgColor="bg-slate-100"
          iconTextColor="text-slate-600"
          isShortScreen={isShortScreen}
          valueClassName="text-slate-900"
          subLabel={
            <span className="text-slate-500">
              {metrics.totalOwnersCount} {metrics.totalOwnersCount === 1 ? 'owner' : 'owners'}
            </span>
          }
        />
      </div>

      {/* 2. Initial Investment */}
      <div className={cardWrapperClasses}>
        <KpiCard
          label="Initial investment"
          value={formatINR(metrics.totalInitialInvestment)}
          icon={TrendingUp}
          iconBgColor="bg-slate-100"
          iconTextColor="text-slate-600"
          isShortScreen={isShortScreen}
          valueClassName="text-slate-900"
          subLabel={
            <span className="text-slate-500">
              {metrics.totalAdditionalInvested > 0
                ? `Additional +${formatINR(metrics.totalAdditionalInvested)}`
                : 'No additional invested'}
            </span>
          }
        />
      </div>

      {/* 3. Total Withdrawn */}
      <div className={cardWrapperClasses}>
        <KpiCard
          label="Total withdrawn"
          value={formatINR(metrics.totalWithdrawn)}
          icon={TrendingDown}
          iconBgColor="bg-slate-100"
          iconTextColor="text-slate-600"
          isShortScreen={isShortScreen}
          valueClassName="text-slate-900"
          subLabel={
            <span className="text-slate-500">
              {metrics.totalWithdrawn > 0
                ? `${formatINR(metrics.totalWithdrawn)} withdrawn`
                : 'No withdrawals'}
            </span>
          }
        />
      </div>

      {/* 4. Ownership Allocated */}
      <div className={cardWrapperClasses}>
        <KpiCard
          label="Ownership allocated"
          value={`${metrics.totalOwnership}%`}
          icon={PieChart}
          iconBgColor="bg-slate-100"
          iconTextColor="text-slate-600"
          isShortScreen={isShortScreen}
          valueClassName="text-slate-900"
          subLabel={ownershipSubLabel}
        />
      </div>
    </div>
  )
}

export default OwnerKpiCards
