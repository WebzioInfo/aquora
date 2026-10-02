import React, { useState, useRef, useEffect } from 'react'
import {
  MoreVertical,
  Eye,
  Edit,
  UserCheck,
  Wrench,
  TrendingDown,
  Archive,
  Trash2
} from 'lucide-react'
import type { DetailedAsset } from '../../../../services/assets'
import {
  formatINR,
  formatDisplayDate,
  getCategoryMeta,
  getStatusMeta
} from './assetHelpers'

interface AssetRowProps {
  asset: DetailedAsset
  isSelected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
  onRowClick: () => void
  onView: () => void
  onEdit: () => void
  onAssign: () => void
  onMaintenance: () => void
  onDepreciation: () => void
  onDispose: () => void
  onDelete: () => void
  canManage: boolean
  canDelete: boolean
  isHistorical: boolean
}

export const AssetRow: React.FC<AssetRowProps> = ({
  asset,
  isSelected,
  onToggleSelect,
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
  isHistorical
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutside)
    }
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  const categoryMeta = getCategoryMeta(asset.assetCategory)
  const CategoryIcon = categoryMeta.icon
  const statusMeta = getStatusMeta(asset.currentStatus)

  const cost = Number(asset.totalCapitalizedCost) || 0
  const bookVal = Number(asset.currentValue) || 0
  const progressRatio = cost > 0 ? Math.min(100, Math.max(0, (bookVal / cost) * 100)) : 0

  const isDisposed = ['disposed', 'retired'].includes((asset.currentStatus || '').toLowerCase())

  return (
    <tr
      onClick={onRowClick}
      className={`group border-b border-[#E5E9F2] transition-colors cursor-pointer select-none ${
        isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'
      } ${isDisposed ? 'opacity-65' : ''}`}
    >
      {/* Checkbox */}
      <td
        className="w-10 px-3 py-3 text-center align-middle"
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelect(e)
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-[#1A56DB]/20 focus:ring-offset-0 cursor-pointer"
        />
      </td>

      {/* Asset: Icon Tile + Name + Purchase Date */}
      <td className="px-3 py-3 align-middle max-w-[260px]">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-slate-200/60"
            style={{ backgroundColor: categoryMeta.lightBg }}
            title={asset.assetCategory}
          >
            <CategoryIcon className="w-4 h-4" style={{ color: categoryMeta.hex }} />
          </div>
          <div className="min-w-0">
            <span className="font-medium text-slate-900 text-xs block truncate" title={asset.assetName}>
              {asset.assetName}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {formatDisplayDate(asset.purchaseDate)}
            </span>
          </div>
        </div>
      </td>

      {/* Category: Pill */}
      <td className="px-3 py-3 align-middle">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${categoryMeta.bg} ${categoryMeta.text} ${categoryMeta.border}`}
        >
          {asset.assetCategory}
        </span>
      </td>

      {/* Location / Department + Assigned */}
      <td className="px-3 py-3 align-middle max-w-[220px]">
        <span className="text-xs text-slate-800 font-medium block truncate">
          {asset.location || 'Main Site'}
          {asset.department ? ` · ${asset.department}` : ''}
        </span>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {asset.assignedEmployeeName ? (
            <span className="truncate block" title={`Assigned to ${asset.assignedEmployeeName}`}>
              {asset.assignedEmployeeName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="italic text-slate-400">Unassigned</span>
              {canManage && !isDisposed && (
                <>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAssign()
                    }}
                    className="text-[#1A56DB] hover:text-[#1746B3] hover:underline font-semibold cursor-pointer"
                  >
                    Assign
                  </button>
                </>
              )}
            </span>
          )}
        </div>
      </td>

      {/* Value: Book Value + Cost + 3px Progress Bar */}
      <td className="px-3 py-3 align-middle text-right">
        <div className="inline-block text-right">
          <span className="font-medium text-slate-800 text-xs font-mono block">
            {formatINR(bookVal)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
            of {formatINR(cost)} cost
          </span>
          <div className="w-24 h-[3px] bg-slate-100 rounded-full mt-1.5 ml-auto overflow-hidden">
            <div
              className="h-full bg-slate-500 rounded-full transition-all duration-300"
              style={{ width: `${progressRatio}%` }}
              title={`${Math.round(progressRatio)}% book value remaining`}
            />
          </div>
        </div>
      </td>

      {/* Status + Condition */}
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-col items-center justify-center">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusMeta.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotBg}`} />
            {statusMeta.label}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Condition: {asset.condition || 'Good'}
          </span>
        </div>
      </td>

      {/* Row Menu (⋮) */}
      <td
        className="w-12 px-3 py-3 text-right align-middle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative inline-block text-left" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="More actions"
            className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onView()
                }}
                className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                View details
              </button>

              {canManage && !isDisposed && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onEdit()
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Edit className="w-3.5 h-3.5 text-slate-400" />
                  Edit asset
                </button>
              )}

              {canManage && !isDisposed && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onAssign()
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  {asset.assignedEmployeeName ? 'Reassign' : 'Assign'}
                </button>
              )}

              {canManage && !isDisposed && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onMaintenance()
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Wrench className="w-3.5 h-3.5 text-slate-400" />
                  Schedule maintenance
                </button>
              )}

              {canManage && !isDisposed && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onDepreciation()
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <TrendingDown className="w-3.5 h-3.5 text-slate-400" />
                  Record depreciation
                </button>
              )}

              <div className="my-1 border-t border-slate-100" />

              {canManage && !isDisposed && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onDispose()
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Archive className="w-3.5 h-3.5 text-slate-400" />
                  Dispose asset
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  Delete asset
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default AssetRow
