import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  UserCheck,
  Edit2,
  Wrench,
  Archive,
  Calendar,
  Building,
  Tag,
  Hash,
  Clock,
  ShieldCheck,
  ShieldAlert,
  DollarSign
} from 'lucide-react'
import type { DetailedAsset, AssetMaintenanceRecord } from '../../../../services/assets'
import {
  formatINR,
  formatDisplayDate,
  getCategoryMeta,
  getStatusMeta
} from './assetHelpers'
import { showToast } from '../../../../utils/toast'

interface AssetDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  asset: DetailedAsset | null
  assetsList: DetailedAsset[]
  onSelectAsset: (asset: DetailedAsset) => void
  onEdit: (asset: DetailedAsset) => void
  onAssign: (asset: DetailedAsset) => void
  onMaintenance: (asset: DetailedAsset) => void
  onDispose: (asset: DetailedAsset) => void
  maintenanceHistory?: AssetMaintenanceRecord[]
  timelineHistory?: Array<{ id: string; date: string; action: string; performedBy: string; remarks?: string }>
  canManage: boolean
}

export const AssetDetailDrawer: React.FC<AssetDetailDrawerProps> = ({
  isOpen,
  onClose,
  asset,
  assetsList,
  onSelectAsset,
  onEdit,
  onAssign,
  onMaintenance,
  onDispose,
  maintenanceHistory = [],
  timelineHistory = [],
  canManage
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'maintenance' | 'history'>('overview')
  const [copiedTag, setCopiedTag] = useState(false)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Focus trap & restore
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      drawerRef.current?.focus()
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus()
    }
  }, [isOpen])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !asset) return null

  const currentIndex = assetsList.findIndex((a) => a.id === asset.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < assetsList.length - 1

  const handlePrev = () => {
    if (hasPrev) onSelectAsset(assetsList[currentIndex - 1])
  }
  const handleNext = () => {
    if (hasNext) onSelectAsset(assetsList[currentIndex + 1])
  }

  const handleCopyTag = () => {
    if (!asset.assetTag) return
    navigator.clipboard.writeText(asset.assetTag)
    setCopiedTag(true)
    showToast('Asset tag copied', 'success')
    setTimeout(() => setCopiedTag(false), 2000)
  }

  const categoryMeta = getCategoryMeta(asset.assetCategory)
  const CategoryIcon = categoryMeta.icon
  const statusMeta = getStatusMeta(asset.currentStatus)
  const cost = Number(asset.totalCapitalizedCost) || 0
  const bookVal = Number(asset.currentValue) || 0
  const progressRatio = cost > 0 ? Math.min(100, Math.max(0, (bookVal / cost) * 100)) : 0
  const isDisposed = ['disposed', 'retired'].includes((asset.currentStatus || '').toLowerCase())

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Drawer Container: 520px desktop, full-screen mobile */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className="relative w-full sm:w-[520px] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 focus:outline-none"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E5E9F2] bg-[#F8FAFC] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-slate-200/60"
              style={{ backgroundColor: categoryMeta.lightBg }}
            >
              <CategoryIcon className="w-4 h-4" style={{ color: categoryMeta.hex }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate" title={asset.assetName}>
                {asset.assetName}
              </h2>
              {/* Asset Tag in Mono with copy button */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  {asset.assetTag || 'TAG-PENDING'}
                </span>
                {asset.assetTag && (
                  <button
                    type="button"
                    onClick={handleCopyTag}
                    title="Copy Asset Tag"
                    className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  >
                    {copiedTag ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-medium border ${statusMeta.badgeClass}`}
                >
                  <span className={`w-1 h-1 rounded-full ${statusMeta.dotBg}`} />
                  {statusMeta.label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handlePrev}
              disabled={!hasPrev}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Previous asset"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasNext}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Next asset"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors ml-1"
              title="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Highlight Block: Current Book Value + Progress Bar */}
        <div className="p-4 bg-white border-b border-[#E5E9F2]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Current Net Book Value
          </span>
          <div className="flex items-baseline justify-between gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {formatINR(bookVal)}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              of {formatINR(cost)} capitalized cost
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
            <div
              className="h-full bg-slate-700 rounded-full transition-all duration-300"
              style={{ width: `${progressRatio}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-mono">
            <span>{Math.round(progressRatio)}% residual</span>
            <span>Accum. Dep: {formatINR(asset.accumulatedDepreciation || 0)}</span>
          </div>
        </div>

        {/* Segmented Switcher (Overview | Financials | Maintenance | History) */}
        <div className="px-4 py-2 bg-[#F8FAFC] border-b border-[#E5E9F2]">
          <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-200/70 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-1 rounded-md transition-all text-center ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('financials')}
              className={`py-1 rounded-md transition-all text-center ${
                activeTab === 'financials'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Financials
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('maintenance')}
              className={`py-1 rounded-md transition-all text-center ${
                activeTab === 'maintenance'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Maintenance
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`py-1 rounded-md transition-all text-center ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              History
            </button>
          </div>
        </div>

        {/* Tab Content Area (Scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 [scrollbar-gutter:stable] [scrollbar-width:thin] text-xs">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Asset Identity Card */}
              <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Asset Identification
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Asset Tag</span>
                    <span className="font-mono font-semibold text-slate-800 mt-0.5 block">
                      {asset.assetTag || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Serial Number</span>
                    <span className="font-mono font-semibold text-slate-800 mt-0.5 block">
                      {asset.serialNumber || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Model Number</span>
                    <span className="text-slate-800 font-medium mt-0.5 block">
                      {asset.modelNumber || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Manufacturer</span>
                    <span className="text-slate-800 font-medium mt-0.5 block">
                      {asset.manufacturer || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Custody & Location */}
              <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Location & Custody
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Location</span>
                    <span className="text-slate-800 font-medium mt-0.5 block">
                      {asset.location || 'Main Site'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Department</span>
                    <span className="text-slate-800 font-medium mt-0.5 block">
                      {asset.department || '—'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-500 block">Assigned Custodian</span>
                    <span className="text-slate-800 font-medium mt-0.5 block">
                      {asset.assignedEmployeeName ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-800 font-semibold">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {asset.assignedEmployeeName}
                        </span>
                      ) : (
                        <span className="italic text-slate-400">Unassigned custodian</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Acquisition & Vendor */}
              <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Acquisition
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Purchase Date</span>
                    <span className="text-slate-800 font-medium mt-0.5 block">
                      {formatDisplayDate(asset.purchaseDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Supplier</span>
                    <span className="text-slate-800 font-medium mt-0.5 block">
                      {asset.supplierName || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Invoice Number</span>
                    <span className="font-mono text-slate-800 font-medium mt-0.5 block">
                      {asset.purchaseInvoiceNumber || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Condition</span>
                    <span className="text-slate-800 font-semibold mt-0.5 block">
                      {asset.condition || 'Good'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {asset.notes && (
                <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Notes
                  </span>
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {asset.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FINANCIALS */}
          {activeTab === 'financials' && (
            <div className="space-y-4">
              <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Depreciation & Cost Basis
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Purchase Price</span>
                    <span className="font-mono font-semibold text-slate-900 mt-0.5 block">
                      {formatINR(asset.purchasePrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Capitalized Cost</span>
                    <span className="font-mono font-semibold text-slate-900 mt-0.5 block">
                      {formatINR(asset.totalCapitalizedCost)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Method</span>
                    <span className="font-medium text-slate-800 mt-0.5 block">
                      {asset.depreciationMethod || 'StraightLine'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Useful Life</span>
                    <span className="font-medium text-slate-800 mt-0.5 block">
                      {asset.usefulLifeYears || 5} years
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Salvage / Residual</span>
                    <span className="font-mono text-slate-800 mt-0.5 block">
                      {formatINR(asset.residualValue || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Accumulated Dep.</span>
                    <span className="font-mono font-semibold text-slate-700 mt-0.5 block">
                      {formatINR(asset.accumulatedDepreciation || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Disposal info if disposed */}
              {isDisposed && (
                <div className="bg-rose-50/60 rounded-xl p-3.5 border border-rose-200/80 space-y-2">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                    Disposal Details
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] text-rose-600 block">Disposal Date</span>
                      <span className="font-medium text-rose-900 mt-0.5 block">
                        {formatDisplayDate(asset.disposalDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-rose-600 block">Sale Value</span>
                      <span className="font-mono font-semibold text-rose-900 mt-0.5 block">
                        {formatINR(asset.saleValue || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MAINTENANCE */}
          {activeTab === 'maintenance' && (
            <div className="space-y-4">
              {/* Warranty Card */}
              <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Warranty Coverage
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Warranty Expiry</span>
                    <span className="font-medium text-slate-800 mt-0.5 block">
                      {formatDisplayDate(asset.warrantyEndDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Provider</span>
                    <span className="font-medium text-slate-800 mt-0.5 block">
                      {asset.warrantyProvider || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Service Records */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Maintenance Service History ({maintenanceHistory.length})
                </span>
                {maintenanceHistory.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl">
                    No maintenance records logged yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {maintenanceHistory.map((rec) => (
                      <div
                        key={rec.id}
                        className="bg-white rounded-lg p-3 border border-slate-200 shadow-2xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900">{rec.maintenanceType}</span>
                          <span className="font-mono text-slate-500 text-[11px]">
                            {formatDisplayDate(rec.maintenanceDate)}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{rec.description}</p>
                        <div className="flex justify-between items-center text-[11px] pt-1 text-slate-400 font-mono">
                          <span>Technician: {rec.technicianName || '—'}</span>
                          <span className="font-bold text-slate-800">
                            Cost: {formatINR(rec.totalCost || 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Asset Audit Trail
              </span>
              {timelineHistory.length === 0 ? (
                <p className="text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl">
                  No historical lifecycle changes recorded yet.
                </p>
              ) : (
                <div className="relative pl-4 border-l-2 border-slate-200 space-y-4">
                  {timelineHistory.map((item) => (
                    <div key={item.id} className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#1A56DB] border-2 border-white ring-1 ring-slate-200" />
                      <div className="text-xs font-semibold text-slate-900">{item.action}</div>
                      <div className="text-[10px] text-slate-400">
                        {formatDisplayDate(item.date)} by {item.performedBy}
                      </div>
                      {item.remarks && (
                        <p className="text-[11px] text-slate-600 mt-1">{item.remarks}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-[#E5E9F2] bg-[#F8FAFC] flex items-center justify-between gap-2">
          {canManage && !isDisposed ? (
            <button
              type="button"
              onClick={() => onDispose(asset)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1 cursor-pointer"
            >
              Dispose asset
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 italic">Disposed</span>
          )}

          <div className="flex items-center gap-2">
            {canManage && !isDisposed && (
              <>
                <button
                  type="button"
                  onClick={() => onAssign(asset)}
                  className="h-[32px] px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Assign
                </button>
                <button
                  type="button"
                  onClick={() => onMaintenance(asset)}
                  className="h-[32px] px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Schedule maintenance
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(asset)}
                  className="h-[32px] px-3 text-xs font-semibold text-white bg-[#1A56DB] hover:bg-[#1746B3] rounded-lg transition-colors cursor-pointer"
                >
                  Edit
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssetDetailDrawer
