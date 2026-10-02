import React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'

interface TablePaginationProps {
  pageNumber: number
  pageSize: number
  totalCount: number
  onPageChange: (newPage: number) => void
  onPageSizeChange: (newPageSize: number) => void
  entityName?: string // e.g. "expenses" | "purchases"
  totalsNode?: React.ReactNode
  pageSizeOptions?: number[]
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  pageNumber,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  entityName = 'records',
  totalsNode,
  pageSizeOptions = [10, 25, 50, 100]
}) => {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const startIdx = totalCount > 0 ? (pageNumber - 1) * pageSize + 1 : 0
  const endIdx = totalCount > 0 ? Math.min(pageNumber * pageSize, totalCount) : 0

  // Keyboard navigation on pagination controls
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && pageNumber > 1) {
      e.preventDefault()
      onPageChange(pageNumber - 1)
    } else if (e.key === 'ArrowRight' && pageNumber < totalPages) {
      e.preventDefault()
      onPageChange(pageNumber + 1)
    }
  }

  // Generate numbered pages with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: (number | string)[] = []
    pages.push(1)

    if (pageNumber > 3) {
      pages.push('ellipsis-start')
    }

    const start = Math.max(2, pageNumber - 1)
    const end = Math.min(totalPages - 1, pageNumber + 1)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (pageNumber < totalPages - 2) {
      pages.push('ellipsis-end')
    }

    pages.push(totalPages)
    return pages
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="p-2.5 sm:px-4 bg-[#F8FAFC] border-t border-[#E5E9F2] text-xs text-slate-600 shrink-0 select-none outline-none focus:ring-1 focus:ring-[#1A56DB]/30 transition-all flex flex-col gap-2.5"
    >
      {/* Upper line / Narrow screen stacked line: Totals (if provided and narrow) */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-2.5 w-full">
        {/* Left: Showing range + Rows per page */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <div className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
            Showing <strong className="text-slate-900 font-semibold">{startIdx}</strong> to{' '}
            <strong className="text-slate-900 font-semibold">{endIdx}</strong> of{' '}
            <strong className="text-slate-900 font-semibold">{totalCount}</strong> {entityName}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="hidden sm:inline">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-[26px] px-1.5 text-[11px] font-semibold bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-[#1A56DB] cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Pagination Navigation Controls */}
        <div className="flex items-center justify-center gap-1 w-full lg:w-auto">
          {/* First Page */}
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => onPageChange(1)}
            aria-label="First page"
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1A56DB] cursor-pointer transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => onPageChange(pageNumber - 1)}
            aria-label="Previous page"
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1A56DB] cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Numbered Pages (Hidden on small mobile screens to keep ultra-compact) */}
          <div className="hidden sm:flex items-center gap-1">
            {getPageNumbers().map((p, idx) => {
              if (typeof p === 'string') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-5 text-center text-slate-400 font-bold select-none text-[11px]"
                  >
                    …
                  </span>
                )
              }
              const isActive = p === pageNumber
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-label={`Page ${p}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-w-[28px] h-7 px-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1A56DB] ${
                    isActive
                      ? 'bg-[#1A56DB] text-white border-[#1A56DB] shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {p}
                </button>
              )
            })}
          </div>

          {/* Compact page indicator on mobile */}
          <span className="sm:hidden px-2 text-xs font-semibold text-slate-700 font-mono">
            {pageNumber} / {totalPages}
          </span>

          {/* Next Page */}
          <button
            type="button"
            disabled={pageNumber >= totalPages}
            onClick={() => onPageChange(pageNumber + 1)}
            aria-label="Next page"
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1A56DB] cursor-pointer transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            disabled={pageNumber >= totalPages}
            onClick={() => onPageChange(totalPages)}
            aria-label="Last page"
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1A56DB] cursor-pointer transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Totals Node */}
        {totalsNode && (
          <div className="w-full lg:w-auto flex items-center justify-center lg:justify-end text-[11px] text-slate-600 font-medium">
            {totalsNode}
          </div>
        )}
      </div>
    </div>
  )
}

export default TablePagination
