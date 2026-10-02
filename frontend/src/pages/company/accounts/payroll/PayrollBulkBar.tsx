import React from 'react'
import { Calculator, Download, Printer, X } from 'lucide-react'
import { formatINR } from './payrollHelpers'

interface PayrollBulkBarProps {
  selectedCount: number
  totalBalanceSelected: number
  canSettleSelected: boolean
  onSettleSelected: () => void
  onExportSelected: () => void
  onPrintPayslips: () => void
  onClearSelection: () => void
}

export const PayrollBulkBar: React.FC<PayrollBulkBarProps> = ({
  selectedCount,
  totalBalanceSelected,
  canSettleSelected,
  onSettleSelected,
  onExportSelected,
  onPrintPayslips,
  onClearSelection
}) => {
  return (
    <div className="h-[49px] px-3.5 bg-blue-50/90 border-b border-blue-200/80 flex items-center justify-between gap-3 text-xs shrink-0 select-none animate-in fade-in duration-150">
      {/* Left: Summary */}
      <div className="flex items-center gap-2">
        <span className="font-semibold text-blue-900">
          {selectedCount} selected
        </span>
        <span className="text-blue-300">·</span>
        <span className="text-blue-800 font-medium">
          Balance Due: <span className="font-mono font-bold text-rose-600">{formatINR(totalBalanceSelected)}</span>
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {canSettleSelected && (
          <button
            type="button"
            onClick={onSettleSelected}
            className="h-[30px] px-2.5 bg-[#1A56DB] text-white hover:bg-blue-700 font-medium rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Settle selected</span>
          </button>
        )}

        <button
          type="button"
          onClick={onExportSelected}
          className="h-[30px] px-2.5 bg-white border border-blue-200 text-blue-900 hover:bg-blue-100/50 font-medium rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-blue-700" />
          <span className="hidden sm:inline">Export selected</span>
        </button>

        <button
          type="button"
          onClick={onPrintPayslips}
          className="h-[30px] px-2.5 bg-white border border-blue-200 text-blue-900 hover:bg-blue-100/50 font-medium rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Printer className="w-3.5 h-3.5 text-blue-700" />
          <span className="hidden sm:inline">Print payslips</span>
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          className="h-[30px] px-2 text-slate-500 hover:text-slate-800 hover:bg-blue-100/40 rounded-lg flex items-center gap-1 transition-colors"
          title="Clear selection"
        >
          <X className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>
    </div>
  )
}

export default PayrollBulkBar
