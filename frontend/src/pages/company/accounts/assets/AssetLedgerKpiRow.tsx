import React from 'react'
import {
  Cpu,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  Package,
  Boxes,
  Calendar,
  ShieldAlert,
  FileSpreadsheet,
  Wrench
} from 'lucide-react'
import type { AssetKpiSummary } from '../../../../services/assets'
import { LedgerKpiCard } from '../../../../components/accounts/ui/LedgerKpiCard'
import { formatINR } from './assetHelpers'

interface AssetLedgerKpiRowProps {
  tab: 'register' | 'stock' | 'maintenance' | 'reports'
  kpis?: AssetKpiSummary
  loading?: boolean
  // Extra metrics for other tabs
  stockMetrics?: {
    totalValue: number
    finishedGoodsValue: number
    rawMaterialsValue: number
    itemsCount: number
    productsCount: number
    rawMaterialsCount: number
  }
  maintenanceMetrics?: {
    overdueCount: number
    due30DaysCount: number
    underMaintenanceCount: number
    warrantyExpiringCount: number
  }
  reportsMetrics?: {
    totalCapitalCost: number
    totalBookValue: number
    totalDepreciation: number
    maintenanceSpend: number
  }
}

export const AssetLedgerKpiRow: React.FC<AssetLedgerKpiRowProps> = ({
  tab,
  kpis,
  loading = false,
  stockMetrics,
  maintenanceMetrics,
  reportsMetrics
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full shrink-0 select-none">
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="h-[92px] sm:h-[96px] bg-white border border-slate-200/80 rounded-xl animate-pulse"
          />
        ))}
      </div>
    )
  }

  // TAB 1: REGISTER
  if (tab === 'register') {
    const totalCount = kpis?.totalAssetsCount || 0
    const activeCount = kpis?.activeAssetsCount || 0
    const totalCost = kpis?.totalAssetValue || 0
    const bookValue = kpis?.currentBookValue || 0
    const accumulatedDep = kpis?.accumulatedDepreciation || 0
    const underMaintenance = kpis?.underMaintenanceCount || 0
    const warrantyExpiring = kpis?.warrantyExpiringCount || 0
    const needsAttention = underMaintenance + warrantyExpiring

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full shrink-0">
        <LedgerKpiCard
          label="Total Assets"
          value={totalCount}
          icon={Cpu}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          subLabel={<span>{activeCount} active assets registered</span>}
        />
        <LedgerKpiCard
          label="Capitalized Cost"
          value={formatINR(totalCost)}
          icon={DollarSign}
          iconBgColor="bg-slate-100"
          iconTextColor="text-slate-600"
          subLabel={<span>Total acquisition purchase value</span>}
        />
        <LedgerKpiCard
          label="Current Book Value"
          value={formatINR(bookValue)}
          icon={TrendingDown}
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
          subLabel={
            accumulatedDep > 0 ? (
              <span className="text-amber-700 font-medium">
                Depreciation -{formatINR(accumulatedDep)}
              </span>
            ) : (
              <span>Zero accumulated depreciation</span>
            )
          }
        />
        <LedgerKpiCard
          label="Needs Attention"
          value={needsAttention}
          icon={AlertTriangle}
          iconBgColor={needsAttention > 0 ? 'bg-amber-50' : 'bg-emerald-50'}
          iconTextColor={needsAttention > 0 ? 'text-amber-600' : 'text-emerald-600'}
          valueClassName={needsAttention > 0 ? 'text-amber-600' : 'text-slate-900'}
          subLabel={
            needsAttention === 0 ? (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> All clear
              </span>
            ) : (
              <span className="text-amber-600 font-medium">
                {underMaintenance} maintenance · {warrantyExpiring} warranty due
              </span>
            )
          }
        />
      </div>
    )
  }

  // TAB 2: STOCK VALUATION
  if (tab === 'stock') {
    const sm = stockMetrics || {
      totalValue: 0,
      finishedGoodsValue: 0,
      rawMaterialsValue: 0,
      itemsCount: 0,
      productsCount: 0,
      rawMaterialsCount: 0
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full shrink-0">
        <LedgerKpiCard
          label="Total Stock Value"
          value={formatINR(sm.totalValue)}
          icon={Package}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          subLabel={<span>Combined catalog & raw stock value</span>}
        />
        <LedgerKpiCard
          label="Finished Goods Value"
          value={formatINR(sm.finishedGoodsValue)}
          icon={Package}
          iconBgColor="bg-indigo-50"
          iconTextColor="text-indigo-600"
          subLabel={<span>{sm.productsCount} finished products on catalog</span>}
        />
        <LedgerKpiCard
          label="Raw Materials Value"
          value={formatINR(sm.rawMaterialsValue)}
          icon={Boxes}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          subLabel={<span>{sm.rawMaterialsCount} raw material inventory lines</span>}
        />
        <LedgerKpiCard
          label="Inventory Items"
          value={sm.itemsCount}
          icon={Package}
          iconBgColor="bg-slate-100"
          iconTextColor="text-slate-600"
          subLabel={<span>Separated inventory items tracked</span>}
        />
      </div>
    )
  }

  // TAB 3: MAINTENANCE AND WARRANTY
  if (tab === 'maintenance') {
    const mm = maintenanceMetrics || {
      overdueCount: 0,
      due30DaysCount: 0,
      underMaintenanceCount: 0,
      warrantyExpiringCount: 0
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full shrink-0">
        <LedgerKpiCard
          label="Overdue Maintenance"
          value={mm.overdueCount}
          icon={AlertTriangle}
          iconBgColor={mm.overdueCount > 0 ? 'bg-rose-50' : 'bg-slate-100'}
          iconTextColor={mm.overdueCount > 0 ? 'text-rose-600' : 'text-slate-600'}
          valueClassName={mm.overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'}
          subLabel={
            mm.overdueCount > 0 ? (
              <span className="text-rose-600 font-semibold">Immediate service required</span>
            ) : (
              <span>All maintenance up to date</span>
            )
          }
        />
        <LedgerKpiCard
          label="Due in 30 Days"
          value={mm.due30DaysCount}
          icon={Calendar}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          valueClassName={mm.due30DaysCount > 0 ? 'text-amber-600' : 'text-slate-900'}
          subLabel={<span>Upcoming preventive schedule</span>}
        />
        <LedgerKpiCard
          label="Under Maintenance"
          value={mm.underMaintenanceCount}
          icon={Wrench}
          iconBgColor="bg-indigo-50"
          iconTextColor="text-indigo-600"
          subLabel={<span>Currently offline or under service</span>}
        />
        <LedgerKpiCard
          label="Warranty Expiring (60D)"
          value={mm.warrantyExpiringCount}
          icon={ShieldAlert}
          iconBgColor={mm.warrantyExpiringCount > 0 ? 'bg-amber-50' : 'bg-slate-100'}
          iconTextColor={mm.warrantyExpiringCount > 0 ? 'text-amber-600' : 'text-slate-600'}
          subLabel={<span>Coverage renewals pending</span>}
        />
      </div>
    )
  }

  // TAB 4: REPORTS
  const rm = reportsMetrics || {
    totalCapitalCost: kpis?.totalAssetValue || 0,
    totalBookValue: kpis?.currentBookValue || 0,
    totalDepreciation: kpis?.accumulatedDepreciation || 0,
    maintenanceSpend: 0
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full shrink-0">
      <LedgerKpiCard
        label="Capitalized Cost"
        value={formatINR(rm.totalCapitalCost)}
        icon={DollarSign}
        iconBgColor="bg-blue-50"
        iconTextColor="text-blue-600"
        subLabel={<span>Gross capital base value</span>}
      />
      <LedgerKpiCard
        label="Current Book Value"
        value={formatINR(rm.totalBookValue)}
        icon={TrendingDown}
        iconBgColor="bg-purple-50"
        iconTextColor="text-purple-600"
        subLabel={<span>Net ledger book value</span>}
      />
      <LedgerKpiCard
        label="Total Depreciation"
        value={formatINR(rm.totalDepreciation)}
        icon={TrendingDown}
        iconBgColor="bg-rose-50"
        iconTextColor="text-rose-600"
        valueClassName="text-rose-600"
        subLabel={<span>Total write-down recorded</span>}
      />
      <LedgerKpiCard
        label="Maintenance Spend"
        value={formatINR(rm.maintenanceSpend)}
        icon={FileSpreadsheet}
        iconBgColor="bg-amber-50"
        iconTextColor="text-amber-600"
        subLabel={<span>Cumulative service expenses</span>}
      />
    </div>
  )
}

export default AssetLedgerKpiRow
