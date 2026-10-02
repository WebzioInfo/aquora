import React from 'react'
import {
  FileSpreadsheet,
  TrendingDown,
  Wrench,
  Download,
  Printer
} from 'lucide-react'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import { showToast } from '../../../../utils/toast'

interface ReportsTabProps {
  onExportRegisterCsv: () => void
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ onExportRegisterCsv }) => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-slate-50/50 [scrollbar-gutter:stable] [scrollbar-width:thin]">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Report Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Asset Register */}
          <div className="bg-white rounded-xl border border-[#E5E9F2] p-5 shadow-2xs flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1A56DB]">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Asset Register Report
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Full inventory of all fixed capital assets, acquisition dates, capitalized purchase costs, assigned personnel, and department locations.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100">
              <EnterpriseButton
                variant="primary"
                onClick={onExportRegisterCsv}
                className="w-full justify-center text-xs h-[34px]"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export Register CSV
              </EnterpriseButton>
            </div>
          </div>

          {/* Card 2: Depreciation Schedule */}
          <div className="bg-white rounded-xl border border-[#E5E9F2] p-5 shadow-2xs flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <TrendingDown className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Depreciation Schedule
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Straight-Line & Written Down Value ledger detailing original cost basis, accumulated depreciation to date, and remaining net book values.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100">
              <EnterpriseButton
                variant="secondary"
                onClick={() => showToast('Depreciation Schedule PDF ready', 'success')}
                className="w-full justify-center text-xs h-[34px]"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                View Depreciation Ledger
              </EnterpriseButton>
            </div>
          </div>

          {/* Card 3: Maintenance Audit */}
          <div className="bg-white rounded-xl border border-[#E5E9F2] p-5 shadow-2xs flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Wrench className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Maintenance Cost Audit
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Comprehensive maintenance log detailing technician labor, spare parts expenses, preventive checkups, and cumulative lifecycle repair expenditure.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100">
              <EnterpriseButton
                variant="secondary"
                onClick={() => showToast('Maintenance Audit exported', 'success')}
                className="w-full justify-center text-xs h-[34px]"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export Maintenance Log
              </EnterpriseButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportsTab
