import React, { useRef } from 'react'
import { Plus, SearchX, Users } from 'lucide-react'
import type { Owner } from '../../../../services/simpleAccounts'
import { formatINR } from './ownerHelpers'
import { TablePagination } from '../../../../components/ui/TablePagination'
import { useViewportSize } from '../../../../hooks/useViewportSize'
import OwnerRow from './OwnerRow'
import OwnerCardMobile from './OwnerCardMobile'

interface OwnersTableProps {
  owners: Owner[]
  loading?: boolean
  onRowClick: (owner: Owner) => void
  onOpenTransact: (owner: Owner) => void
  onOpenEdit: (owner: Owner) => void
  onDelete: (owner: Owner) => void
  pageNumber: number
  pageSize: number
  totalCount: number
  onPageChange: (newPage: number) => void
  onPageSizeChange: (newPageSize: number) => void
  totalCurrentInvestment: number
  totalOwnershipPercentage: number
  isFiltered: boolean
  onClearFilters: () => void
  onOpenCreate: () => void
  hoveredOwnerId?: string | null
}

export const OwnersTable: React.FC<OwnersTableProps> = ({
  owners,
  loading = false,
  onRowClick,
  onOpenTransact,
  onOpenEdit,
  onDelete,
  pageNumber,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  totalCurrentInvestment,
  totalOwnershipPercentage,
  isFiltered,
  onClearFilters,
  onOpenCreate,
  hoveredOwnerId = null
}) => {
  const { isMobile } = useViewportSize()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Totals node for TablePagination right-side
  const totalsNode = (
    <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
      {isFiltered && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
          Filtered
        </span>
      )}
      <span>
        Current investment{' '}
        <strong className="font-mono text-slate-900 font-semibold">
          {formatINR(totalCurrentInvestment)}
        </strong>
      </span>
      <span className="text-slate-300">·</span>
      <span>
        Ownership{' '}
        <strong className="font-mono text-slate-900 font-semibold">
          {totalOwnershipPercentage}%
        </strong>
      </span>
    </div>
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* Scrollable Rows Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative divide-y divide-slate-100"
      >
        {loading ? (
          /* Skeletons */
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(idx => (
              <div
                key={idx}
                className="h-12 bg-slate-100/70 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : totalCount === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[220px]">
            {isFiltered ? (
              <>
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <SearchX className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  No owners match your search
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  Check your search query or clear filters to see all equity owners.
                </p>
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-[#1A56DB]" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  Add your first owner
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  Track equity partners, initial investments, additional capital contributions, and withdrawals.
                </p>
                <button
                  type="button"
                  onClick={onOpenCreate}
                  className="px-3.5 py-1.5 bg-[#1A56DB] hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Owner</span>
                </button>
              </>
            )}
          </div>
        ) : isMobile ? (
          /* Mobile Cards */
          <div className="p-3 space-y-2.5">
            {owners.map(owner => (
              <OwnerCardMobile
                key={owner.id}
                owner={owner}
                onCardClick={onRowClick}
                onOpenTransact={onOpenTransact}
                onOpenEdit={onOpenEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          /* Desktop Real Table */
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-[#E5E9F2] text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5 min-w-[200px]">Owner</th>
                <th className="px-3 py-2.5 min-w-[140px]">Ownership</th>
                <th className="hidden lg:table-cell px-3 py-2.5 min-w-[120px]">Initial</th>
                <th className="px-3 py-2.5 min-w-[180px]">Current investment</th>
                <th className="px-3 py-2.5 text-right w-24">Action</th>
                <th className="w-10 px-2 py-2.5 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E9F2]">
              {owners.map(owner => (
                <OwnerRow
                  key={owner.id}
                  owner={owner}
                  isHighlighted={hoveredOwnerId === owner.id}
                  onRowClick={onRowClick}
                  onOpenTransact={onOpenTransact}
                  onOpenEdit={onOpenEdit}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pinned Pagination Footer */}
      <TablePagination
        pageNumber={pageNumber}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        entityName="owners"
        totalsNode={totalsNode}
        pageSizeOptions={[10, 25, 50, 100]}
      />
    </div>
  )
}

export default OwnersTable
