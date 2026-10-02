import React from 'react'
import { Download, Printer, Trash2, X } from 'lucide-react'

interface BulkActionBarProps {
  selectedCount: number
  totalSelectedAmount: number
  onExport: () => void
  onPrint: () => void
  onDelete: () => void
  onClear: () => void
  canWrite: boolean
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalSelectedAmount,
  onExport,
  onPrint,
  onDelete,
  onClear,
  canWrite
}) => {
  return (
    <div className="p-3 border-b border-[#E5E9F2] bg-blue-50/70 flex items-center justify-between gap-3 animate-in fade-in duration-150">
      {/* Left: Selected count and amount */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center bg-[#1A56DB] text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {selectedCount}
        </span>
        <span className="text-xs font-bold text-slate-800">
          Selected
        </span>
        <span className="text-slate-400 text-xs">•</span>
        <span className="text-xs text-slate-600 font-mono font-semibold">
          Total: ₹{Math.round(totalSelectedAmount).toLocaleString('en-IN')}
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={onExport}
          className="h-[32px] px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          title="Export selected expenses as CSV"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Export selected</span>
        </button>

        <button
          type="button"
          onClick={onPrint}
          className="h-[32px] px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          title="Print selected expense vouchers"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Print selected</span>
        </button>

        {canWrite && (
          <button
            type="button"
            onClick={onDelete}
            className="h-[32px] px-2.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Delete selected expenses"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">Delete selected</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClear}
          className="h-[32px] px-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg flex items-center gap-1 transition-colors cursor-pointer ml-1"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>
    </div>
  )
}
