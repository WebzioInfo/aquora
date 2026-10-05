import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface PaginationProps {
  page: number
  pageCount: number
  onChange: (page: number) => void
  total: number
  pageSize: number
  className?: string
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageCount,
  onChange,
  total,
  pageSize,
  className = ''
}) => {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  const getPageNumbers = () => {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, i) => i + 1)
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', pageCount]
    }
    if (page >= pageCount - 3) {
      return [1, 'ellipsis', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
    }
    return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', pageCount]
  }

  const pages = getPageNumbers()

  return (
    <div
      className={`h-9 flex items-center justify-between px-3 bg-white border border-slate-200 rounded-xl select-none shrink-0 ${className}`}
    >
      <div className="text-xs text-slate-500 font-normal">
        Showing <span className="font-mono font-bold text-slate-900 tabular-nums">{start}</span> to{' '}
        <span className="font-mono font-bold text-slate-900 tabular-nums">{end}</span> of{' '}
        <span className="font-mono font-bold text-slate-900 tabular-nums">{total}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
          className="h-7 px-2 flex items-center gap-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        <div className="flex items-center gap-0.5">
          {pages.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span key={`ell-${idx}`} className="px-1 text-xs text-slate-400">
                  …
                </span>
              )
            }
            const num = p as number
            const isActive = num === page
            return (
              <button
                key={num}
                type="button"
                onClick={() => onChange(num)}
                aria-current={isActive ? 'page' : undefined}
                className={`h-7 min-w-[28px] px-1.5 rounded-lg text-xs font-mono tabular-nums font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {num}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          disabled={page >= pageCount || pageCount === 0}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
          className="h-7 px-2 flex items-center gap-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export default Pagination
