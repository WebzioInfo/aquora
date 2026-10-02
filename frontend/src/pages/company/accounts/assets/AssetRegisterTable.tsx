import React from 'react'
import { Plus, Cpu } from 'lucide-react'
import type { DetailedAsset } from '../../../../services/assets'
import { AssetRegisterRow } from './AssetRegisterRow'
import { LedgerPagination } from '../../../../components/accounts/ui/LedgerPagination'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import EnterpriseLoading from '../../../../components/ui/EnterpriseLoading'
import { formatINR } from './assetHelpers'

interface AssetRegisterTableProps {
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
  // Pagination
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (newPage: number) => void
  onPageSizeChange: (newPageSize: number) => void
  filteredCostTotal: number
  filteredBookValueTotal: number
}

export const AssetRegisterTable: React.FC<AssetRegisterTableProps> = ({
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
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  filteredCostTotal,
  filteredBookValueTotal
}) => {
  const isAllSelected = assets.length > 0 && assets.every((a) => selectedIds.has(a.id))

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden w-full flex-1 flex flex-col min-h-0">
      {loading ? (
        <div className="flex-1 flex items-center justify-center p-12">
          <EnterpriseLoading label="Loading asset register..." />
        </div>
      ) : assets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-2.5 text-slate-400">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {hasActiveFilters ? 'No assets match these filters' : 'No assets found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your search keywords, status, category, condition, or date range.'
              : 'Add your first fixed asset to start tracking depreciation, ownership, and maintenance schedules.'}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {hasActiveFilters ? (
              <EnterpriseButton
                variant="secondary"
                size="sm"
                onClick={onClearFilters}
                className="!h-[30px] !py-0 text-xs"
              >
                Clear All Filters
              </EnterpriseButton>
            ) : canManage ? (
              <EnterpriseButton
                variant="primary"
                size="sm"
                onClick={onAddAsset}
                className="!h-[30px] !py-0 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Asset
              </EnterpriseButton>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {/* Scrollable table container */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs min-w-[920px]">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] select-none">
                <tr className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3.5 w-10 text-center whitespace-nowrap bg-slate-50">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={onToggleSelectAll}
                      aria-label="Select all assets"
                      className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-[#1A56DB] cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3.5 min-w-[220px] whitespace-nowrap bg-slate-50">
                    Asset
                  </th>
                  <th className="py-2.5 px-3.5 w-[140px] whitespace-nowrap bg-slate-50">
                    Category
                  </th>
                  <th className="py-2.5 px-3.5 min-w-[170px] whitespace-nowrap bg-slate-50">
                    Location
                  </th>
                  <th className="py-2.5 px-3.5 w-[130px] text-right whitespace-nowrap bg-slate-50">
                    Purchase Cost
                  </th>
                  <th className="py-2.5 px-3.5 w-[140px] text-right whitespace-nowrap bg-slate-50">
                    Book Value
                  </th>
                  <th className="py-2.5 px-3.5 w-[120px] text-center whitespace-nowrap bg-slate-50">
                    Status
                  </th>
                  <th className="py-2.5 px-3.5 w-[90px] text-center whitespace-nowrap bg-slate-50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {assets.map((asset) => (
                  <AssetRegisterRow
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

          {/* Ledger-style Pagination Footer with Totals summary */}
          <LedgerPagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            entityName="assets"
            summaryNode={
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                <span>Cost:</span>
                <strong className="font-bold text-slate-800">{formatINR(filteredCostTotal)}</strong>
                <span>•</span>
                <span>Book:</span>
                <strong className="font-bold text-slate-800">{formatINR(filteredBookValueTotal)}</strong>
              </div>
            }
          />
        </>
      )}
    </div>
  )
}

export default AssetRegisterTable
