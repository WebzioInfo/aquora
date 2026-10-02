import React, { useRef, useEffect } from 'react'
import { Plus, Cpu } from 'lucide-react'
import type { DetailedAsset } from '../../../../services/assets'
import { AssetRow } from './AssetRow'
import { AssetCardList } from './AssetCardList'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import { TablePagination } from '../../../../components/ui/TablePagination'
import { formatINR } from './assetHelpers'

interface AssetsTableProps {
  assets: DetailedAsset[]
  loading: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string, e: React.MouseEvent) => void
  onToggleSelectAll: () => void
  onRowClick: (asset: DetailedAsset) => void
  onView: (asset: DetailedAsset) => void
  onEdit: (asset: DetailedAsset) => void
  onAssign: (asset: DetailedAsset) => void
  onMaintenance: (asset: DetailedAsset) => void
  onDepreciation: (asset: DetailedAsset) => void
  onDispose: (asset: DetailedAsset) => void
  onDelete: (asset: DetailedAsset) => void
  canManage: boolean
  canDelete: boolean
  hasActiveFilters: boolean
  onClearFilters: () => void
  onAddAsset: () => void
  onImportAssets: () => void
  // Pagination & totals
  pageNumber: number
  totalCount: number
  pageSize: number
  onPageChange: (newPage: number) => void
  onPageSizeChange: (newPageSize: number) => void
  filteredCostTotal: number
  filteredBookValueTotal: number
}

export const AssetsTable: React.FC<AssetsTableProps> = ({
  assets,
  loading,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  onView,
  onEdit,
  onAssign,
  onMaintenance,
  onDepreciation,
  onDispose,
  onDelete,
  canManage,
  canDelete,
  hasActiveFilters,
  onClearFilters,
  onAddAsset,
  onImportAssets,
  pageNumber,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  filteredCostTotal,
  filteredBookValueTotal
}) => {
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to top when page changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pageNumber, pageSize])

  const isAllSelected = assets.length > 0 && assets.every((a) => selectedIds.has(a.id))
  const isPartiallySelected =
    assets.length > 0 && assets.some((a) => selectedIds.has(a.id)) && !isAllSelected

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartiallySelected
    }
  }, [isPartiallySelected])

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden bg-white">
      {/* Scrollable Table Area: ONLY this element scrolls vertically */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto w-full [scrollbar-gutter:stable] [scrollbar-width:thin] relative"
      >
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="h-12 w-full bg-slate-50 border border-slate-100 rounded-lg animate-pulse flex items-center justify-between px-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-slate-200 rounded" />
                  <div className="w-8 h-8 bg-slate-200 rounded-lg" />
                  <div className="space-y-1.5">
                    <div className="w-36 h-3.5 bg-slate-200 rounded" />
                    <div className="w-20 h-2.5 bg-slate-200 rounded" />
                  </div>
                </div>
                <div className="w-24 h-4 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[220px] py-12 px-4 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3 text-slate-400">
              <Cpu className="w-6 h-6" />
            </div>
            {hasActiveFilters ? (
              <>
                <h3 className="text-sm font-bold text-slate-800">
                  No assets match these filters
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Try adjusting your search keywords, status, category, condition, or date range.
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
                  Add your first asset
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Track company machinery, vehicles, computing devices, and monitor book value depreciation across lifecycle.
                </p>
                {canManage && (
                  <div className="mt-4 flex items-center gap-2">
                    <EnterpriseButton
                      variant="primary"
                      size="sm"
                      onClick={onAddAsset}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Add asset
                    </EnterpriseButton>
                    <EnterpriseButton
                      variant="secondary"
                      size="sm"
                      onClick={onImportAssets}
                    >
                      Import assets
                    </EnterpriseButton>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table (>= 640px) with Sticky header */}
            <div className="hidden sm:block">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E5E9F2] shadow-2xs select-none">
                  <tr className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    {/* Checkbox */}
                    <th className="w-10 px-3 py-2.5 text-center bg-[#F8FAFC]">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={onToggleSelectAll}
                        aria-label="Select all rows"
                        className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-[#1A56DB] cursor-pointer"
                      />
                    </th>
                    {/* Asset (Name + Date) */}
                    <th className="px-3 py-2.5 bg-[#F8FAFC] min-w-[200px]">
                      Asset
                    </th>
                    {/* Category */}
                    <th className="hidden lg:table-cell px-3 py-2.5 bg-[#F8FAFC] w-36">
                      Category
                    </th>
                    {/* Location & Assigned */}
                    <th className="px-3 py-2.5 bg-[#F8FAFC] min-w-[160px]">
                      Location
                    </th>
                    {/* Value */}
                    <th className="px-3 py-2.5 text-right bg-[#F8FAFC] w-36">
                      Value
                    </th>
                    {/* Status & Condition */}
                    <th className="px-3 py-2.5 text-center bg-[#F8FAFC] w-36">
                      Status
                    </th>
                    {/* Actions menu */}
                    <th className="w-12 px-3 py-2.5 text-right bg-[#F8FAFC]">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {assets.map((asset) => (
                    <AssetRow
                      key={asset.id}
                      asset={asset}
                      isSelected={selectedIds.has(asset.id)}
                      onToggleSelect={(e) => onToggleSelect(asset.id, e)}
                      onRowClick={() => onRowClick(asset)}
                      onView={() => onView(asset)}
                      onEdit={() => onEdit(asset)}
                      onAssign={() => onAssign(asset)}
                      onMaintenance={() => onMaintenance(asset)}
                      onDepreciation={() => onDepreciation(asset)}
                      onDispose={() => onDispose(asset)}
                      onDelete={() => onDelete(asset)}
                      canManage={canManage}
                      canDelete={canDelete}
                      isHistorical={['disposed', 'retired'].includes(
                        (asset.currentStatus || '').toLowerCase()
                      )}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (< 640px) */}
            <div className="sm:hidden">
              <AssetCardList
                assets={assets}
                selectedIds={selectedIds}
                onToggleSelect={(id, e) => onToggleSelect(id, e)}
                onRowClick={onRowClick}
                onOpenActions={onView}
                canManage={canManage}
              />
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
        entityName="assets"
        totalsNode={
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Cost:</span>
            <strong className="font-mono text-slate-800 font-medium">
              {formatINR(filteredCostTotal)}
            </strong>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium">Book:</span>
            <strong className="font-mono text-slate-800 font-medium">
              {formatINR(filteredBookValueTotal)}
            </strong>
          </div>
        }
      />
    </div>
  )
}

export default AssetsTable
