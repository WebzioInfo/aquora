import React from 'react'
import { MoreVertical } from 'lucide-react'
import type { DetailedAsset } from '../../../../services/assets'
import {
  formatINR,
  formatDisplayDate,
  getCategoryMeta,
  getStatusMeta
} from './assetHelpers'

interface AssetCardListProps {
  assets: DetailedAsset[]
  selectedIds: Set<string>
  onToggleSelect: (id: string, e: React.MouseEvent) => void
  onRowClick: (asset: DetailedAsset) => void
  onOpenActions: (asset: DetailedAsset) => void
  canManage: boolean
}

export const AssetCardList: React.FC<AssetCardListProps> = ({
  assets,
  selectedIds,
  onToggleSelect,
  onRowClick,
  onOpenActions,
  canManage: _canManage
}) => {
  return (
    <div className="p-3 space-y-2.5">
      {assets.map((asset) => {
        const isSelected = selectedIds.has(asset.id)
        const categoryMeta = getCategoryMeta(asset.assetCategory)
        const CategoryIcon = categoryMeta.icon
        const statusMeta = getStatusMeta(asset.currentStatus)
        const cost = Number(asset.totalCapitalizedCost) || 0
        const bookVal = Number(asset.currentValue) || 0
        const progressRatio = cost > 0 ? Math.min(100, Math.max(0, (bookVal / cost) * 100)) : 0
        const isDisposed = ['disposed', 'retired'].includes((asset.currentStatus || '').toLowerCase())

        return (
          <div
            key={asset.id}
            onClick={() => onRowClick(asset)}
            className={`p-3.5 bg-white rounded-xl border border-[#E5E9F2] shadow-2xs hover:border-slate-300 transition-all cursor-pointer relative ${
              isSelected ? 'ring-1.5 ring-[#1A56DB] bg-blue-50/20' : ''
            } ${isDisposed ? 'opacity-70' : ''}`}
          >
            {/* Top row: Checkbox, Icon, Name + Date, ⋮ */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleSelect(asset.id, e)
                  }}
                  className="pt-0.5"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-[#1A56DB]/20 focus:ring-offset-0 cursor-pointer"
                  />
                </div>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-slate-200/60 mt-0.5"
                  style={{ backgroundColor: categoryMeta.lightBg }}
                >
                  <CategoryIcon className="w-4 h-4" style={{ color: categoryMeta.hex }} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-slate-900 text-xs truncate" title={asset.assetName}>
                    {asset.assetName}
                  </h4>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {formatDisplayDate(asset.purchaseDate)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenActions(asset)
                }}
                aria-label="More actions"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            {/* Middle row: Category pill, Location/Assigned */}
            <div className="mt-2.5 flex items-center justify-between gap-2 text-xs flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${categoryMeta.bg} ${categoryMeta.text} ${categoryMeta.border}`}
              >
                {asset.assetCategory}
              </span>

              <div className="text-[11px] text-slate-500 text-right truncate">
                <span>{asset.location || 'Main Site'}</span>
                {asset.assignedEmployeeName ? (
                  <span className="text-slate-700 font-medium"> · {asset.assignedEmployeeName}</span>
                ) : (
                  <span className="italic text-slate-400"> · Unassigned</span>
                )}
              </div>
            </div>

            {/* Bottom row: Value progress & Status/Condition */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-end justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-medium text-slate-900 text-xs font-mono">
                    {formatINR(bookVal)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    of {formatINR(cost)}
                  </span>
                </div>
                <div className="w-28 h-[3px] bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-slate-500 rounded-full"
                    style={{ width: `${progressRatio}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col items-end">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusMeta.badgeClass}`}
                >
                  <span className={`w-1 h-1 rounded-full ${statusMeta.dotBg}`} />
                  {statusMeta.label}
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5 block">
                  Condition: {asset.condition || 'Good'}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default AssetCardList
