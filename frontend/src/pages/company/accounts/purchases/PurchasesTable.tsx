import React, { useRef, useEffect } from 'react'
import { ShoppingBag, AlertCircle, Plus, RotateCcw } from 'lucide-react'
import type { Purchase, PurchaseSummaryStats } from '../../../../services/purchases'
import { PurchaseRow } from './PurchaseRow'
import { PurchaseCardMobile } from './PurchaseCardMobile'
import { formatINR, toPaise, fromPaise } from './purchaseHelpers'
import { TablePagination } from '../../../../components/ui/TablePagination'

interface PurchasesTableProps {
  purchases: Purchase[]
  summaryStats?: PurchaseSummaryStats | null
  loading: boolean
  error?: string | null
  onRetry?: () => void
  totalCount: number
  pageNumber: number
  pageSize: number
  onPageChange: (newPage: number) => void
  onPageSizeChange: (newPageSize: number) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string, index: number, shiftKey: boolean) => void
  onToggleSelectAll: () => void
  onOpenDrawer: (purchase: Purchase) => void
  onEdit: (purchase: Purchase) => void
  onPrint: (purchase: Purchase) => void
  onDuplicate: (purchase: Purchase) => void
  onRecordPayment: (purchase: Purchase) => void
  onCancel: (purchase: Purchase) => void
  onDelete: (purchase: Purchase) => void
  canWrite: boolean
  hasFilters: boolean
  onClearFilters: () => void
  onCreatePurchase: () => void
}

export const PurchasesTable: React.FC<PurchasesTableProps> = ({
  purchases,
  summaryStats,
  loading,
  error,
  onRetry,
  totalCount,
  pageNumber,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenDrawer,
  onEdit,
  onPrint,
  onDuplicate,
  onRecordPayment,
  onCancel,
  onDelete,
  canWrite,
  hasFilters,
  onClearFilters,
  onCreatePurchase
}) => {
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll table back to top when page or pageSize changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pageNumber, pageSize])

  const isAllSelected = purchases.length > 0 && purchases.every(p => selectedIds.has(p.id))
  const isPartiallySelected = purchases.some(p => selectedIds.has(p.id)) && !isAllSelected

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartiallySelected
    }
  }, [isPartiallySelected])

  // Footer totals: prefer summaryStats for entire filtered set, fallback to visible page
  let filteredGross = 0
  let filteredPaid = 0
  let filteredBalance = 0
  let totalsLabel = 'Filtered'

  if (summaryStats && summaryStats.totalPurchaseValue !== undefined) {
    filteredGross = summaryStats.totalPurchaseValue || 0
    filteredBalance = summaryStats.outstandingBalance || 0
    filteredPaid = Math.max(0, filteredGross - filteredBalance)
    totalsLabel = 'Filtered'
  } else {
    let filteredGrossPaise = 0
    let filteredPaidPaise = 0
    let filteredBalancePaise = 0

    for (const p of purchases) {
      if (!p.isCancelled && p.paymentStatus !== 'Cancelled') {
        filteredGrossPaise += toPaise(p.grandTotal)
        filteredPaidPaise += toPaise(p.amountPaid)
        filteredBalancePaise += toPaise(p.balanceAmount)
      }
    }

    filteredGross = fromPaise(filteredGrossPaise)
    filteredPaid = fromPaise(filteredPaidPaise)
    filteredBalance = fromPaise(filteredBalancePaise)
    totalsLabel = 'Page'
  }

  // 1. Error State
  if (error) {
    return (
      <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center p-8 text-center bg-rose-50/50">
        <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
        <span className="text-sm font-semibold text-rose-900">{error}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
      {/* Scrollable Table Area: ONLY this element scrolls vertically */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto w-full [scrollbar-gutter:stable] [scrollbar-width:thin] relative"
      >
        {loading ? (
          // Skeleton loading (6 table rows)
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
        ) : purchases.length === 0 ? (
          // Empty State filling scroll area
          <div className="flex flex-col items-center justify-center h-full min-h-[220px] py-12 px-4 text-center">
            {hasFilters ? (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">No purchases match these filters</h3>
                  <p className="text-xs text-slate-500 mt-1">Try clearing filters or search query</p>
                </div>
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1A56DB] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-[#1A56DB]">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Record your first purchase</h3>
                  <p className="text-xs text-slate-500 mt-1">Track procurement, intake raw materials, and manage liabilities</p>
                </div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={onCreatePurchase}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1A56DB] hover:bg-[#1746B3] rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Create Purchase
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table (>= 640px) with Sticky Header */}
            <div className="hidden sm:block">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E5E9F2] shadow-xs select-none">
                  <tr className="text-slate-600 font-bold text-[11px] uppercase tracking-wider select-none">
                    <th className="w-10 px-3 py-2.5 text-center align-middle bg-[#F8FAFC]">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={onToggleSelectAll}
                        aria-label="Select all purchases"
                        className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-2.5 bg-[#F8FAFC]">Purchase</th>
                    <th className="px-3 py-2.5 bg-[#F8FAFC] hidden lg:table-cell">Category</th>
                    <th className="px-3 py-2.5 bg-[#F8FAFC] text-right">Gross</th>
                    <th className="px-3 py-2.5 bg-[#F8FAFC]">Payment</th>
                    <th className="w-12 px-3 py-2.5 text-right bg-[#F8FAFC]">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E9F2] bg-white">
                  {purchases.map((purchase, index) => (
                    <PurchaseRow
                      key={purchase.id}
                      purchase={purchase}
                      isSelected={selectedIds.has(purchase.id)}
                      onToggleSelect={(e) => onToggleSelect(purchase.id, index, e.shiftKey)}
                      onOpenDrawer={() => onOpenDrawer(purchase)}
                      onEdit={() => onEdit(purchase)}
                      onPrint={() => onPrint(purchase)}
                      onDuplicate={() => onDuplicate(purchase)}
                      onRecordPayment={() => onRecordPayment(purchase)}
                      onCancel={() => onCancel(purchase)}
                      onDelete={() => onDelete(purchase)}
                      canWrite={canWrite}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (< 640px) */}
            <div className="sm:hidden p-3 space-y-2.5">
              {purchases.map((purchase, index) => (
                <PurchaseCardMobile
                  key={purchase.id}
                  purchase={purchase}
                  isSelected={selectedIds.has(purchase.id)}
                  onToggleSelect={() => onToggleSelect(purchase.id, index, false)}
                  onOpenDrawer={() => onOpenDrawer(purchase)}
                  onEdit={() => onEdit(purchase)}
                  onPrint={() => onPrint(purchase)}
                  onDuplicate={() => onDuplicate(purchase)}
                  onRecordPayment={() => onRecordPayment(purchase)}
                  onCancel={() => onCancel(purchase)}
                  onDelete={() => onDelete(purchase)}
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
        entityName="purchases"
        totalsNode={
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-medium">({totalsLabel}):</span>
            <span>Gross <strong className="font-mono text-slate-900 font-semibold">{formatINR(filteredGross)}</strong></span>
            <span className="text-slate-300">·</span>
            <span>Paid <strong className="font-mono text-slate-900 font-semibold">{formatINR(filteredPaid)}</strong></span>
            <span className="text-slate-300">·</span>
            <span>
              Balance{' '}
              <strong className={`font-mono font-semibold ${filteredBalance > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatINR(filteredBalance)}
              </strong>
            </span>
          </div>
        }
      />
    </div>
  )
}
