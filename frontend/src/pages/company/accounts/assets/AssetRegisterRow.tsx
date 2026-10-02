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

interface AssetRegisterRowProps {
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

export const AssetRegisterRow: React.FC<AssetRegisterRowProps> = ({
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
  const accumDep = Number(asset.accumulatedDepreciation) || 0

  const isDisposed = ['disposed', 'retired'].includes((asset.currentStatus || '').toLowerCase())

  return (
    <tr
      onClick={onRowClick}
      className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${
        isSelected ? 'bg-blue-50/50' : ''
      } ${isDisposed ? 'opacity-70' : ''}`}
    >
      {/* Checkbox */}
      <td
        className="py-2.5 px-3.5 w-10 text-center whitespace-nowrap"
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelect(e)
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-[#1A56DB] cursor-pointer"
        />
      </td>

      {/* ASSET: Icon tile + name, line 2: acquisition date and tag/serial */}
      <td className="py-2.5 px-3.5 min-w-[220px]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-slate-200/60"
            style={{ backgroundColor: categoryMeta.lightBg }}
            title={asset.assetCategory}
          >
            <CategoryIcon className="w-3.5 h-3.5" style={{ color: categoryMeta.hex }} />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-slate-900 block text-xs truncate" title={asset.assetName}>
              {asset.assetName}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
              <span>{formatDisplayDate(asset.purchaseDate)}</span>
              {asset.assetTag && (
                <>
                  <span>•</span>
                  <span className="font-mono text-slate-500 font-semibold">{asset.assetTag}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* CATEGORY: Tinted tag badge */}
      <td className="py-2.5 px-3.5 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${categoryMeta.bg} ${categoryMeta.text} ${categoryMeta.border}`}
        >
          {asset.assetCategory}
        </span>
      </td>

      {/* LOCATION: Location name; line 2: assigned person or small "Assign" text button */}
      <td className="py-2.5 px-3.5 min-w-[170px]">
        <span className="font-medium text-slate-800 text-xs block truncate">
          {asset.location || 'Main Site'}
          {asset.department ? ` · ${asset.department}` : ''}
        </span>
        <div className="text-[10px] text-slate-500 mt-0.5">
          {asset.assignedEmployeeName ? (
            <span className="text-slate-600 font-medium truncate block">
              {asset.assignedEmployeeName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <span className="italic text-slate-400">Unassigned</span>
              {canManage && !isDisposed && (
                <>
                  <span className="text-slate-300">•</span>
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

      {/* PURCHASE COST: Right-aligned, tabular-nums */}
      <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono">
        <span className="font-semibold text-slate-900 text-xs">
          {formatINR(cost)}
        </span>
      </td>

      {/* BOOK VALUE: Right-aligned, tabular-nums; depreciation shown as small muted/red second line */}
      <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono">
        <span className="font-bold text-slate-900 text-xs block">
          {formatINR(bookVal)}
        </span>
        {accumDep > 0 ? (
          <span className="text-[10px] text-amber-700 block">
            -{formatINR(accumDep)} dep.
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 block">
            0 dep.
          </span>
        )}
      </td>

      {/* STATUS: Badge with dot, Condition as muted second line */}
      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
        <div className="flex flex-col items-center">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusMeta.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotBg}`} />
            {statusMeta.label}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {asset.condition || 'Good'}
          </span>
        </div>
      </td>

      {/* ACTIONS: Eye icon + kebab menu */}
      <td
        className="py-2.5 px-3.5 text-center whitespace-nowrap"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center gap-1 relative" ref={menuRef}>
          <button
            type="button"
            title="View Details"
            onClick={onView}
            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            title="More actions"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 text-left">
              {canManage && !isDisposed && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onEdit()
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Edit className="w-3.5 h-3.5 text-slate-400" />
                    Edit Asset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onAssign()
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    {asset.assignedEmployeeName ? 'Reassign' : 'Assign'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onMaintenance()
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Wrench className="w-3.5 h-3.5 text-slate-400" />
                    Schedule Service
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onDepreciation()
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <TrendingDown className="w-3.5 h-3.5 text-slate-400" />
                    Record Depreciation
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onDispose()
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Archive className="w-3.5 h-3.5 text-slate-400" />
                    Dispose Asset
                  </button>
                </>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  Delete Asset
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default AssetRegisterRow
