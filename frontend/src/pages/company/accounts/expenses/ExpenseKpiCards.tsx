import React from 'react'
import { Landmark, Wallet, Layers, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react'
import type { SimpleExpense } from '../../../../services/simpleAccounts'
import { useViewportSize } from '../../../../hooks/useViewportSize'
import KpiCard from '../../../../components/ui/KpiCard'

interface ExpenseKpiCardsProps {
  expenses: SimpleExpense[]
  loading?: boolean
  totalCount?: number
}

export const ExpenseKpiCards: React.FC<ExpenseKpiCardsProps> = ({
  expenses,
  loading = false,
  totalCount
}) => {
  const { isShortScreen, isScrollKpi } = useViewportSize()

  const formatCurrency = (val: number) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`
  }

  // Skeletons
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

  // 1. Total this month / period
  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)

  // Monthly comparison
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.expenseDate)
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth
  })
  const prevMonthExpenses = expenses.filter(e => {
    const d = new Date(e.expenseDate)
    const targetMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const targetYear = currentMonth === 0 ? currentYear - 1 : currentYear
    return d.getFullYear() === targetYear && d.getMonth() === targetMonth
  })

  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const prevMonthTotal = prevMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

  let percentChange: number | null = null
  if (prevMonthTotal > 0) {
    percentChange = ((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100
  }

  // 2. Paid from Bank
  const bankExpenses = expenses.filter(e => e.paymentMethod?.toLowerCase() === 'bank')
  const bankTotal = bankExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const uniqueBankAccounts = Array.from(
    new Set(bankExpenses.map(e => e.paidFrom || e.bankAccountName || 'Bank').filter(Boolean))
  )
  const bankSubLabel =
    uniqueBankAccounts.length === 0
      ? 'No bank deductions'
      : uniqueBankAccounts.length === 1
      ? uniqueBankAccounts[0]
      : `${uniqueBankAccounts.length} accounts`

  // 3. Paid from Cash
  const cashExpenses = expenses.filter(e => e.paymentMethod?.toLowerCase() === 'cash')
  const cashTotal = cashExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const uniqueCashBooks = Array.from(
    new Set(cashExpenses.map(e => e.paidFrom || e.cashBookName || 'Cash').filter(Boolean))
  )
  const cashSubLabel =
    uniqueCashBooks.length === 0
      ? 'No cash deductions'
      : uniqueCashBooks.length === 1
      ? uniqueCashBooks[0]
      : `${uniqueCashBooks.length} cashbooks`

  // 4. Entries & Largest expense
  const count = totalCount !== undefined ? totalCount : expenses.length
  const largestAmount = expenses.reduce((max, e) => Math.max(max, e.amount || 0), 0)
  const largestSubLabel = largestAmount > 0 ? `Max: ${formatCurrency(largestAmount)}` : 'No expenses'

  // Viewport height <= 600px or mobile: Single horizontally scrollable strip of compact chips
  if (isScrollKpi) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar shrink-0 w-full select-none">
        {/* Chip 1 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Spend</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="p-1 rounded-md bg-blue-50 text-[#1A56DB]">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Chip 2 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Bank</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{formatCurrency(bankTotal)}</span>
          </div>
          <div className="p-1 rounded-md bg-indigo-50 text-indigo-600">
            <Landmark className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Chip 3 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Cash</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{formatCurrency(cashTotal)}</span>
          </div>
          <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
            <Wallet className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Chip 4 */}
        <div className="min-w-[170px] h-[58px] p-2 bg-white border border-[#E5E9F2] rounded-xl shadow-xs flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Entries</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{count}</span>
          </div>
          <div className="p-1 rounded-md bg-slate-100 text-slate-600">
            <Layers className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 w-full shrink-0 select-none">
      {/* 1. Total Spend */}
      <KpiCard
        label="Total Spend"
        value={formatCurrency(totalAmount)}
        icon={TrendingUp}
        iconBgColor="bg-blue-50"
        iconTextColor="text-[#1A56DB]"
        isShortScreen={isShortScreen}
        subLabel={
          <>
            <span className="text-slate-500">This Month: {formatCurrency(thisMonthTotal)}</span>
            {percentChange !== null && (
              <span
                className={`flex items-center font-bold ${
                  percentChange > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {percentChange > 0 ? (
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                )}
                {Math.abs(Math.round(percentChange))}% vs last mo
              </span>
            )}
          </>
        }
      />

      {/* 2. Paid from Bank */}
      <KpiCard
        label="Paid From Bank"
        value={formatCurrency(bankTotal)}
        icon={Landmark}
        iconBgColor="bg-indigo-50"
        iconTextColor="text-indigo-600"
        isShortScreen={isShortScreen}
        subLabel={
          <span className="text-slate-500 truncate" title={bankSubLabel}>
            {bankSubLabel}
          </span>
        }
      />

      {/* 3. Paid from Cash */}
      <KpiCard
        label="Paid From Cash"
        value={formatCurrency(cashTotal)}
        icon={Wallet}
        iconBgColor="bg-emerald-50"
        iconTextColor="text-emerald-600"
        isShortScreen={isShortScreen}
        subLabel={
          <span className="text-slate-500 truncate" title={cashSubLabel}>
            {cashSubLabel}
          </span>
        }
      />

      {/* 4. Entries */}
      <KpiCard
        label="Entries"
        value={count}
        icon={Layers}
        iconBgColor="bg-slate-100"
        iconTextColor="text-slate-600"
        isShortScreen={isShortScreen}
        subLabel={
          <span className="text-slate-500 truncate">
            {largestSubLabel}
          </span>
        }
      />
    </div>
  )
}
