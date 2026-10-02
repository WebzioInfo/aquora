import React, { useRef, useEffect } from 'react'
import { Building2, SearchX, Plus, RefreshCw } from 'lucide-react'
import type { Vendor } from '../../../../services/vendors'
import { VendorRow } from './VendorRow'
import { VendorCardGrid } from './VendorCardGrid'
import type { VendorViewMode } from './VendorFilters'
import TablePagination from '../../../../components/ui/TablePagination'
import { formatINR } from './vendorHelpers'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'

interface VendorsTableProps {
  vendors: Vendor[]
  loading?: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string, e: React.MouseEvent) => void
  onToggleSelectAll: () => void
  onRowClick: (vendor: Vendor) => void
  onOpenEdit: (vendor: Vendor) => void
  onOpenPayment: (vendor: Vendor) => void
  onPrintStatement: (vendor: Vendor) => void
  onToggleStatus: (vendor: Vendor) => void
  onDelete: (vendor: Vendor) => void
  totalPayableFiltered: number
  totalCount: number
  pageNumber: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  viewMode: VendorViewMode
  hasActiveFilters: boolean
  onClearFilters: () => void
  onOpenCreate: () => void
  canWrite?: boolean
}

export const VendorsTable: React.FC<VendorsTableProps> = ({
  vendors,
  loading = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  onOpenEdit,
  onOpenPayment,
  onPrintStatement,
  onToggleStatus,
  onDelete,
  totalPayableFiltered,
  totalCount,
  pageNumber,
  pageSize,
  onPageChange,
  onPageSizeChange,
  viewMode,
  hasActiveFilters,
  onClearFilters,
  onOpenCreate,
  canWrite = true
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to top when page changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [pageNumber, pageSize])

  const isAllSelected = vendors.length > 0 && vendors.every(v => selectedIds.has(v.id))
  const isPartialSelected = vendors.some(v => selectedIds.has(v.id)) && !isAllSelected

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white select-none">
      {/* Scrollable table / card area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative"
      >
        {loading ? (
          /* Skeletons */
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-12 bg-slate-50 border border-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : vendors.length === 0 ? (
          /* Empty States */
          <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[220px]">
            {hasActiveFilters ? (
              <div className="space-y-3 max-w-sm">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <SearchX className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 text-sm">No matching vendors</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    No vendor records match your search or status filter.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="inline-flex items-center text-xs font-semibold text-[#1A56DB] hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-w-sm">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-[#1A56DB]">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Add your first vendor</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Keep track of suppliers, procurement balances, and ledgers in one place.
                  </p>
                </div>
                {canWrite && (
                  <EnterpriseButton
                    variant="primary"
                    size="sm"
                    onClick={onOpenCreate}
                    className="!h-[32px] text-xs font-semibold shadow-xs mx-auto"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add New Vendor
                  </EnterpriseButton>
                )}
              </div>
            )}
          </div>
        ) : viewMode === 'cards' ? (
          /* Card View */
          <VendorCardGrid
            vendors={vendors}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onCardClick={onRowClick}
            onOpenEdit={onOpenEdit}
            onOpenPayment={onOpenPayment}
            onPrintStatement={onPrintStatement}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
            totalPayableAll={totalPayableFiltered}
            canWrite={canWrite}
          />
        ) : (
          /* Table View */
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E5E9F2] z-10 select-none shadow-2xs">
              <tr className="text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="w-10 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={el => {
                      if (el) el.indeterminate = isPartialSelected
                    }}
                    onChange={onToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2.5">Vendor</th>
                <th className="px-3 py-2.5 hidden lg:table-cell">Contact</th>
                <th className="px-3 py-2.5 text-right">Purchases</th>
                <th className="px-3 py-2.5 text-right">Outstanding</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="w-10 px-2 py-2.5 text-center">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E9F2]">
              {vendors.map(vendor => (
                <VendorRow
                  key={vendor.id}
                  vendor={vendor}
                  isSelected={selectedIds.has(vendor.id)}
                  onToggleSelect={onToggleSelect}
                  onRowClick={onRowClick}
                  onOpenEdit={onOpenEdit}
                  onOpenPayment={onOpenPayment}
                  onPrintStatement={onPrintStatement}
                  onToggleStatus={onToggleStatus}
                  onDelete={onDelete}
                  totalPayableAll={totalPayableFiltered}
                  canWrite={canWrite}
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
          entityName="vendors"
          totalsNode={
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Total payable:</span>
              <span className="font-mono font-bold text-rose-600">{formatINR(totalPayableFiltered)}</span>
            </div>
          }
        />
      </div>
    </div>
  )
}

export default VendorsTable
