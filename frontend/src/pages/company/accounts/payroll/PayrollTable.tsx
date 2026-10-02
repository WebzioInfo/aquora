import React, { useRef } from 'react'
import { AlertCircle, Calculator, ArrowUpRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { MonthlySalaryDirectory } from '../../../../services/payroll'
import { formatINR } from './payrollHelpers'
import { TablePagination } from '../../../../components/ui/TablePagination'
import { useViewportSize } from '../../../../hooks/useViewportSize'
import PayrollRow from './PayrollRow'
import PayrollCardMobile from './PayrollCardMobile'

interface PayrollTableProps {
  records: MonthlySalaryDirectory[]
  loading?: boolean
  selectedIds: Set<string>
  onToggleSelectRow: (id: string, shiftKey: boolean) => void
  onToggleSelectAll: () => void
  onRowClick: (record: MonthlySalaryDirectory) => void
  onOpenAdvance: (record: MonthlySalaryDirectory) => void
  onOpenSettle: (record: MonthlySalaryDirectory) => void
  onOpenHistory: (record: MonthlySalaryDirectory) => void
  onOpenPayslip: (record: MonthlySalaryDirectory) => void
  onPrintPayslip: (record: MonthlySalaryDirectory) => void
  pageNumber: number
  pageSize: number
  totalCount: number
  onPageChange: (newPage: number) => void
  onPageSizeChange: (newPageSize: number) => void
  totalEarnedFiltered: number
  totalPaidFiltered: number
  totalBalanceFiltered: number
  hasActiveFilters: boolean
  onClearFilters: () => void
  onOpenCreateAdvance: () => void
  onOpenCreateSettlement: () => void
  selectedMonthLabel?: string
  monthSortOrder?: 'asc' | 'desc' | null
  onToggleMonthSort?: () => void
}

export const PayrollTable: React.FC<PayrollTableProps> = ({
  records,
  loading = false,
  selectedIds,
  onToggleSelectRow,
  onToggleSelectAll,
  onRowClick,
  onOpenAdvance,
  onOpenSettle,
  onOpenHistory,
  onOpenPayslip,
  onPrintPayslip,
  pageNumber,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  totalEarnedFiltered,
  totalPaidFiltered,
  totalBalanceFiltered,
  hasActiveFilters,
  onClearFilters,
  onOpenCreateAdvance,
  onOpenCreateSettlement,
  selectedMonthLabel,
  monthSortOrder = null,
  onToggleMonthSort
}) => {
  const { isMobile } = useViewportSize()
  const headerCheckboxRef = useRef<HTMLInputElement>(null)

  const isAllSelected = records.length > 0 && records.every(r => selectedIds.has(r.id))
  const isPartiallySelected = records.some(r => selectedIds.has(r.id)) && !isAllSelected

  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartiallySelected
    }
  }, [isPartiallySelected])

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden select-none bg-white">
      {/* Scrollable container for rows or cards */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-12 bg-slate-100/70 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            {hasActiveFilters ? (
              <>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  No salary records match your filters
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  Try adjusting the month, department, status, or search query.
                </p>
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  No payroll records for {selectedMonthLabel || 'this period'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  Get started by calculating month-end settlements or disbursing mid-month salary advances.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenCreateAdvance}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
                    Salary advance
                  </button>
                  <button
                    type="button"
                    onClick={onOpenCreateSettlement}
                    className="px-3 py-1.5 bg-[#1A56DB] hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    Salary settlement
                  </button>
                </div>
              </>
            )}
          </div>
        ) : isMobile ? (
          /* Mobile Card List */
          <div className="p-3 space-y-3">
            {records.map(r => (
              <PayrollCardMobile
                key={r.id}
                record={r}
                isSelected={selectedIds.has(r.id)}
                onToggleSelect={e => onToggleSelectRow(r.id, e.shiftKey)}
                onCardClick={() => onRowClick(r)}
                onOpenAdvance={() => onOpenAdvance(r)}
                onOpenSettle={() => onOpenSettle(r)}
                onOpenHistory={() => onOpenHistory(r)}
                onOpenPayslip={() => onOpenPayslip(r)}
                onPrintPayslip={() => onPrintPayslip(r)}
              />
            ))}
          </div>
        ) : (
          /* Desktop Real Table */
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-[#E5E9F2] text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="w-10 px-3 py-2.5 text-center">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={onToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2.5 min-w-[180px]">Employee</th>
                <th
                  className="hidden lg:table-cell px-3 py-2.5 w-[110px] cursor-pointer hover:text-slate-800 transition-colors"
                  onClick={onToggleMonthSort}
                  title="Sort by month"
                >
                  <div className="flex items-center gap-1">
                    <span>Month</span>
                    {monthSortOrder === 'desc' && <ArrowDown className="w-3 h-3 text-[#1A56DB]" />}
                    {monthSortOrder === 'asc' && <ArrowUp className="w-3 h-3 text-[#1A56DB]" />}
                    {monthSortOrder === null && <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />}
                  </div>
                </th>
                <th className="px-3 py-2.5 min-w-[130px]">Salary</th>
                <th className="px-3 py-2.5 min-w-[220px]">Payment</th>
                <th className="px-3 py-2.5 text-right w-24">Action</th>
                <th className="w-10 px-2 py-2.5 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E9F2]">
              {records.map(r => (
                <PayrollRow
                  key={r.id}
                  record={r}
                  isSelected={selectedIds.has(r.id)}
                  onToggleSelect={e => onToggleSelectRow(r.id, e.shiftKey)}
                  onRowClick={() => onRowClick(r)}
                  onOpenAdvance={() => onOpenAdvance(r)}
                  onOpenSettle={() => onOpenSettle(r)}
                  onOpenHistory={() => onOpenHistory(r)}
                  onOpenPayslip={() => onOpenPayslip(r)}
                  onPrintPayslip={() => onPrintPayslip(r)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pinned Pagination Footer */}
      <div className="shrink-0 border-t border-[#E5E9F2] bg-white">
        <TablePagination
          totalCount={totalCount}
          pageNumber={pageNumber}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          entityName="employees"
          totalsNode={
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Earned:</span>
              <span className="font-mono font-bold text-slate-800">{formatINR(totalEarnedFiltered)}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 font-medium">Paid:</span>
              <span className="font-mono font-bold text-slate-800">{formatINR(totalPaidFiltered)}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 font-medium">Balance:</span>
              <span className={`font-mono font-bold ${totalBalanceFiltered > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {formatINR(totalBalanceFiltered)}
              </span>
            </div>
          }
        />
      </div>
    </div>
  )
}

export default PayrollTable
