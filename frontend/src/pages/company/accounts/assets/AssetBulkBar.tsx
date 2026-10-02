import React from 'react'
import { Download, UserCheck, X } from 'lucide-react'
import { formatINR } from './assetHelpers'

interface AssetBulkBarProps {
  selectedCount: number
  totalSelectedBookValue: number
  onExport: () => void
  onAssign?: () => void
  onClear: () => void
  canManage: boolean
}

export const AssetBulkBar: React.FC<AssetBulkBarProps> = ({
  selectedCount,
  totalSelectedBookValue,
  onExport,
  onAssign,
  onClear,
  canManage
}) => {
  return (
    <div className="p-2 sm:px-3 sm:py-2 border border-slate-200/90 shadow-xs w-full bg-white rounded-xl shrink-0 select-none flex items-center justify-between gap-3 animate-in fade-in duration-150">
      {/* Left: Selected count and book value */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center bg-slate-900 text-white text-xs font-black px-2 py-0.5 rounded-md">
          {selectedCount}
        </span>
        <span className="text-xs font-bold text-slate-800">
          Selected
        </span>
        <span className="text-slate-400 text-xs">•</span>
        <span className="text-xs text-slate-600 font-mono font-semibold">
          Book value {formatINR(totalSelectedBookValue)}
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={onExport}
          className="h-[30px] px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          title="Export selected assets as CSV"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Export selected</span>
        </button>

        {canManage && onAssign && (
          <button
            type="button"
            onClick={onAssign}
            className="h-[30px] px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Assign selected assets"
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Assign</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClear}
          className="h-[30px] px-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ml-1"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>
    </div>
  )
}

export default AssetBulkBar
