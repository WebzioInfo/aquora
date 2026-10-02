import React from 'react'
import { Download, Printer, UserX, X } from 'lucide-react'
import { formatINR } from './vendorHelpers'

interface VendorBulkBarProps {
  selectedCount: number
  totalPayableSelected: number
  onExport: () => void
  onPrint: () => void
  onDeactivate: () => void
  onClear: () => void
  canWrite?: boolean
}

export const VendorBulkBar: React.FC<VendorBulkBarProps> = ({
  selectedCount,
  totalPayableSelected,
  onExport,
  onPrint,
  onDeactivate,
  onClear,
  canWrite = true
}) => {
  return (
    <div className="h-[52px] px-3 bg-blue-50/70 border-b border-blue-200 flex items-center justify-between gap-3 text-xs shrink-0 select-none transition-colors">
      {/* Left: Summary */}
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-800">
          <span className="font-bold text-[#1A56DB]">{selectedCount}</span> selected
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-600">
          Payable: <span className="font-mono font-bold text-slate-900">{formatINR(totalPayableSelected)}</span>
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={onExport}
          className="h-[28px] px-2.5 rounded-[6px] border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
          title="Export selected vendors to CSV"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export</span>
        </button>

        <button
          type="button"
          onClick={onPrint}
          className="h-[28px] px-2.5 rounded-[6px] border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
          title="Print statements for selected vendors"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" />
          <span>Print statements</span>
        </button>

        {canWrite && (
          <button
            type="button"
            onClick={onDeactivate}
            className="h-[28px] px-2.5 rounded-[6px] border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Deactivate selected vendors"
          >
            <UserX className="w-3.5 h-3.5 text-amber-600" />
            <span>Deactivate</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClear}
          className="h-[28px] px-2 rounded-[6px] text-slate-500 hover:text-slate-800 hover:bg-blue-100/50 font-semibold flex items-center gap-1 cursor-pointer ml-1"
          title="Clear selection"
        >
          <X className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>
    </div>
  )
}

export default VendorBulkBar
