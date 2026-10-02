import React from 'react'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'

export interface LedgerPaginationProps {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (newPage: number) => void
  onPageSizeChange: (newPageSize: number) => void
  entityName?: string
  summaryNode?: React.ReactNode
}

export const LedgerPagination: React.FC<LedgerPaginationProps> = ({
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  entityName = 'records',
  summaryNode
}) => {
  if (totalCount === 0) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3.5 py-2 bg-slate-50/90 border-t border-slate-200/90 text-xs text-slate-600 shrink-0 select-none">
      <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
        <span>Showing</span>
        <span className="font-bold text-slate-900">
          {Math.min((page - 1) * pageSize + 1, totalCount)}
        </span>
        <span>–</span>
        <span className="font-bold text-slate-900">
          {Math.min(page * pageSize, totalCount)}
        </span>
        <span>of</span>
        <span className="font-bold text-slate-900">{totalCount}</span>
        <span>{entityName}</span>
        {summaryNode && (
          <>
            <span className="text-slate-300 mx-1">•</span>
            {summaryNode}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-500 font-medium">Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-6 px-1.5 border border-slate-200 rounded bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <EnterpriseButton
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="!h-[28px] !py-0 !px-2.5 text-xs"
          >
            Previous
          </EnterpriseButton>
          <span className="px-2 font-semibold text-slate-700 text-xs">
            Page {page} of {Math.max(1, totalPages)}
          </span>
          <EnterpriseButton
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="!h-[28px] !py-0 !px-2.5 text-xs"
          >
            Next
          </EnterpriseButton>
        </div>
      </div>
    </div>
  )
}

export default LedgerPagination
