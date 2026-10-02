import React, { useRef, useEffect } from 'react'
import { Plus, Receipt } from 'lucide-react'
import type { SimpleExpense } from '../../../../services/simpleAccounts'
import { ExpenseRow } from './ExpenseRow'
import { ExpenseCardMobile } from './ExpenseCardMobile'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import { TablePagination } from '../../../../components/ui/TablePagination'

interface ExpensesTableProps {
  expenses: SimpleExpense[]
  loading: boolean
  selectedIds: Set<string>
  onToggleSelect: (e: React.SyntheticEvent, id: string) => void
  onToggleSelectAll: () => void
  onRowClick: (expense: SimpleExpense) => void
  onEdit: (expense: SimpleExpense) => void
  onPrint: (expense: SimpleExpense) => void
  onDelete: (expense: SimpleExpense) => void
  canWrite: boolean
  hasActiveFilters: boolean
  onClearFilters: () => void
  onAddExpense: () => void
  // Pagination props
  pageNumber: number
  totalCount: number
  pageSize: number
  onPageChange: (newPage: number) => void
  onPageSizeChange: (newPageSize: number) => void
}

export const ExpensesTable: React.FC<ExpensesTableProps> = ({
  expenses,
  loading,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  onEdit,
  onPrint,
  onDelete,
  canWrite,
  hasActiveFilters,
  onClearFilters,
  onAddExpense,
  pageNumber,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange
}) => {
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll table area to top when page or pageSize changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pageNumber, pageSize])

  // Indeterminate state for select-all checkbox
  const isAllSelected = expenses.length > 0 && expenses.every(e => selectedIds.has(e.id))
  const isPartiallySelected =
    expenses.length > 0 &&
    expenses.some(e => selectedIds.has(e.id)) &&
    !isAllSelected

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartiallySelected
    }
  }, [isPartiallySelected])

  // Total amount of currently visible rows on this page
  const visibleTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
      {/* Scrollable Table Area: ONLY this element scrolls vertically */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto w-full [scrollbar-gutter:stable] [scrollbar-width:thin] relative"
      >
        {loading ? (
          // Skeleton loading inside the scroll area
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6].map(idx => (
              <div
                key={idx}
                className="h-11 w-full bg-slate-50 border border-slate-100 rounded-lg animate-pulse flex items-center justify-between px-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-slate-200 rounded" />
                  <div className="space-y-1.5">
                    <div className="w-36 h-3 bg-slate-200 rounded" />
                    <div className="w-24 h-2 bg-slate-200 rounded" />
                  </div>
                </div>
                <div className="w-20 h-4 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : expenses.length === 0 ? (
          // Empty State filling scroll area
          <div className="flex flex-col items-center justify-center h-full min-h-[220px] py-12 px-4 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3 text-slate-400">
              <Receipt className="w-6 h-6" />
            </div>
            {hasActiveFilters ? (
              <>
                <h3 className="text-sm font-bold text-slate-800">
                  No expenses match these filters
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Try adjusting your search keywords, payment method, category, or date range.
                </p>
                <div className="mt-3">
                  <EnterpriseButton
                    variant="secondary"
                    size="sm"
                    onClick={onClearFilters}
                  >
                    Clear filters
                  </EnterpriseButton>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-bold text-slate-800">
                  Record your first expense
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Track operational costs, categorize purchases, and keep balances automatically updated.
                </p>
                {canWrite && (
                  <div className="mt-3">
                    <EnterpriseButton
                      variant="primary"
                      size="sm"
                      onClick={onAddExpense}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Add expense
                    </EnterpriseButton>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table (>= 640px) with Sticky thead */}
            <div className="hidden sm:block">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E5E9F2] shadow-xs select-none">
                  <tr className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    {/* Checkbox column */}
                    <th className="w-10 px-3.5 py-2.5 text-center bg-[#F8FAFC]">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={onToggleSelectAll}
                        aria-label="Select all rows"
                        className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-[#1A56DB] cursor-pointer"
                      />
                    </th>
                    {/* Expense description & metadata */}
                    <th className="px-3.5 py-2.5 bg-[#F8FAFC] min-w-[220px]">
                      Expense
                    </th>
                    {/* Category (hidden on 640-1023px) */}
                    <th className="hidden lg:table-cell px-3.5 py-2.5 bg-[#F8FAFC] w-36">
                      Category
                    </th>
                    {/* Paid From */}
                    <th className="px-3.5 py-2.5 bg-[#F8FAFC] w-44">
                      Paid from
                    </th>
                    {/* Amount */}
                    <th className="px-3.5 py-2.5 text-right bg-[#F8FAFC] w-32">
                      Amount
                    </th>
                    {/* Actions menu */}
                    <th className="w-10 px-3.5 py-2.5 text-center bg-[#F8FAFC]">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {expenses.map(exp => (
                    <ExpenseRow
                      key={exp.id}
                      expense={exp}
                      isSelected={selectedIds.has(exp.id)}
                      onToggleSelect={onToggleSelect}
                      onRowClick={onRowClick}
                      onEdit={onEdit}
                      onPrint={onPrint}
                      onDelete={onDelete}
                      canWrite={canWrite}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (< 640px) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {expenses.map(exp => (
                <ExpenseCardMobile
                  key={exp.id}
                  expense={exp}
                  isSelected={selectedIds.has(exp.id)}
                  onToggleSelect={onToggleSelect}
                  onRowClick={onRowClick}
                  onEdit={onEdit}
                  onPrint={onPrint}
                  onDelete={onDelete}
                  canWrite={canWrite}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Reusable Fixed Footer with Pagination */}
      <TablePagination
        pageNumber={pageNumber}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        entityName="expenses"
        totalsNode={
          <div className="flex items-center gap-1.5">
            <span>Page Total:</span>
            <strong className="font-mono text-slate-900 font-semibold">
              ₹{Math.round(visibleTotal).toLocaleString('en-IN')}
            </strong>
          </div>
        }
      />
    </div>
  )
}
