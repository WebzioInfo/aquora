import React, { useMemo } from 'react'
import { Receipt, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { MonthlySalaryDirectory, PayrollMetrics } from '../../../../services/payroll'
import { formatINR, formatShortMonth } from './payrollHelpers'
import { useViewportSize } from '../../../../hooks/useViewportSize'
import KpiCard from '../../../../components/ui/KpiCard'

interface PayrollKpiCardsProps {
  records: MonthlySalaryDirectory[]
  loading?: boolean
  selectedMonth?: string
  totalFilteredCount?: number
  metrics?: PayrollMetrics | null
}

export const PayrollKpiCards: React.FC<PayrollKpiCardsProps> = ({
  records,
  loading = false,
  selectedMonth,
  totalFilteredCount,
  metrics
}) => {
  const { isShortScreen, isScrollKpi } = useViewportSize()

  const stats = useMemo(() => {
    let earnedTotal = 0
    let paidTotal = 0
    let balanceTotal = 0
    let unpaidCount = 0
    let partialCount = 0
    let fullyPaidCount = 0
    const totalCount = records.length

    for (const r of records) {
      const earned = Number(r.earnedSalary ?? r.netSalaryEntitlement ?? r.baseSalary ?? 0)
      const paid = Number(r.totalPaid ?? 0)
      const bal = Number(r.remainingBalance ?? 0)

      earnedTotal += earned
      paidTotal += paid
      balanceTotal += bal

      const statusLower = (r.status || '').toLowerCase()
      if (r.isFinalized || statusLower === 'paid' || statusLower === 'fully paid' || (earned > 0 && bal <= 0.01)) {
        fullyPaidCount++
      } else if (statusLower === 'partially paid' || (paid > 0 && bal > 0.01)) {
        partialCount++
      } else {
        unpaidCount++
      }
    }

    // Percentage disbursed
    const pct = earnedTotal > 0 ? Math.min(100, Math.round((paidTotal / earnedTotal) * 100)) : (paidTotal > 0 ? 100 : 0)

    // Bank and cash disbursements from metrics (or fallbacks)
    const bankDisbursed = metrics?.paidViaBankThisMonth
    const cashDisbursed = metrics?.paidViaCashThisMonth

    return {
      earnedTotal,
      paidTotal,
      balanceTotal,
      unpaidCount,
      partialCount,
      fullyPaidCount,
      totalCount,
      pct,
      bankDisbursed,
      cashDisbursed
    }
  }, [records, metrics])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[1, 2, 3, 4].map(idx => (
          <div
            key={idx}
            className="bg-white border border-[#E5E9F2] rounded-[12px] p-3.5 h-[94px] animate-pulse flex flex-col justify-between"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="w-6 h-6 bg-slate-100 rounded-md" />
            </div>
            <div className="h-6 w-32 bg-slate-200 rounded mt-1" />
            <div className="h-2.5 w-24 bg-slate-100 rounded pt-1" />
          </div>
        ))}
      </div>
    )
  }

  const monthLabel = selectedMonth ? formatShortMonth(selectedMonth) : 'All periods'
  const countLabel = totalFilteredCount !== undefined ? totalFilteredCount : stats.totalCount

  const cardsContainerClass = isScrollKpi
    ? 'flex overflow-x-auto pb-1 gap-2.5 no-scrollbar snap-x'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5'

  const cardItemClass = isScrollKpi ? 'min-w-[240px] shrink-0 snap-start' : ''

  return (
    <div className={cardsContainerClass}>
      {/* 1. Payroll Card */}
      <KpiCard
        className={cardItemClass}
        label="Payroll"
        value={formatINR(stats.earnedTotal)}
        icon={Receipt}
        iconBgColor="bg-slate-100"
        iconTextColor="text-slate-600"
        isShortScreen={isShortScreen}
        valueClassName="text-slate-900"
        subLabel={
          <span className="text-slate-500 truncate">
            {countLabel} {countLabel === 1 ? 'employee' : 'employees'} · {monthLabel}
          </span>
        }
      />

      {/* 2. Disbursed Card */}
      <KpiCard
        className={cardItemClass}
        label="Disbursed"
        value={formatINR(stats.paidTotal)}
        icon={Wallet}
        iconBgColor="bg-slate-100"
        iconTextColor="text-slate-600"
        isShortScreen={isShortScreen}
        valueClassName="text-slate-900"
        subLabel={
          <div className="w-full flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-emerald-700">{stats.pct}% of payroll</span>
              {stats.bankDisbursed !== undefined && stats.cashDisbursed !== undefined && (
                <span className="text-slate-400 font-mono text-[9px]">
                  B: {formatINR(stats.bankDisbursed)} · C: {formatINR(stats.cashDisbursed)}
                </span>
              )}
            </div>
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
          </div>
        }
      />

      {/* 3. Pending Balance Card */}
      <KpiCard
        className={cardItemClass}
        label="Pending Balance"
        value={formatINR(stats.balanceTotal)}
        icon={AlertCircle}
        iconBgColor="bg-slate-100"
        iconTextColor="text-slate-600"
        isShortScreen={isShortScreen}
        valueClassName="text-slate-900"
        subLabel={
          stats.balanceTotal > 0 ? (
            <span className="text-rose-600 font-medium truncate">
              {stats.unpaidCount} unpaid · {stats.partialCount} partial
            </span>
          ) : (
            <span className="text-emerald-600 font-medium">All settled</span>
          )
        }
      />

      {/* 4. Settled Card */}
      <KpiCard
        className={cardItemClass}
        label="Settled"
        value={`${stats.fullyPaidCount} of ${stats.totalCount}`}
        icon={CheckCircle2}
        iconBgColor="bg-slate-100"
        iconTextColor="text-slate-600"
        isShortScreen={isShortScreen}
        valueClassName="text-slate-900"
        subLabel={
          <span className="text-slate-500 truncate">
            employees fully paid
          </span>
        }
      />
    </div>
  )
}

export default PayrollKpiCards
