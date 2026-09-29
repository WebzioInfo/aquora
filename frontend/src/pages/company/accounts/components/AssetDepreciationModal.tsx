import React, { useState } from 'react'
import type { DetailedAsset, DepreciateAssetInput } from '../../../../services/assets'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import { TrendingDown, ArrowDownRight, AlertTriangle, Calendar, FileText } from 'lucide-react'

interface AssetDepreciationModalProps {
  asset: DetailedAsset
  pending: boolean
  onClose: () => void
  onSave: (data: DepreciateAssetInput) => void
}

export const AssetDepreciationModal: React.FC<AssetDepreciationModalProps> = ({
  asset,
  pending,
  onClose,
  onSave
}) => {
  const [percentage, setPercentage] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val)

  const value = Number(percentage)
  const numeric = /^\d+(\.\d{1,4})?$/.test(percentage) && value > 0 && value <= 100
  const amount = numeric ? Math.round((asset.currentValue * value / 100 + Number.EPSILON) * 100) / 100 : 0
  const nextValue = Math.round((asset.currentValue - amount) * 100) / 100
  const residualFloor = asset.residualValue || 0
  const valid = numeric && amount > 0 && nextValue >= residualFloor

  const handleQuickPercent = (pct: number) => {
    setPercentage(pct.toString())
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (valid && !pending) {
      onSave({
        percentage: value,
        effectiveDate,
        notes: notes.trim() || undefined,
        expectedVersion: asset.version
      })
    }
  }

  return (
    <EnterpriseModal
      isOpen
      onClose={onClose}
      maxWidth="md"
      title="Record Depreciation"
      subtitle={`Post depreciation write-down for ${asset.assetName}`}
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <EnterpriseButton
            type="button"
            disabled={pending}
            onClick={onClose}
            variant="secondary"
            size="sm"
          >
            Cancel
          </EnterpriseButton>
          <EnterpriseButton
            type="submit"
            form="depreciation-form"
            disabled={!valid || pending}
            loading={pending}
            loadingText="Applying..."
            variant="primary"
            size="sm"
          >
            Apply Depreciation
          </EnterpriseButton>
        </div>
      }
    >
      <form id="depreciation-form" onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700 select-none">
        {/* ASSET CONTEXT HEADER CARD */}
        <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Asset</span>
            <span className="text-sm font-black text-slate-900 mt-0.5 block">{asset.assetName}</span>
            <span className="font-mono text-xs text-slate-500">{asset.assetTag || asset.assetCode} · {asset.assetCategory}</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Current Book Value</span>
            <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">
              {formatCurrency(asset.currentValue)}
            </span>
            {residualFloor > 0 && (
              <span className="text-[10px] text-slate-500 block font-mono">
                Min Scrap Floor: {formatCurrency(residualFloor)}
              </span>
            )}
          </div>
        </div>

        {/* PERCENTAGE INPUT & PRESETS */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-bold text-slate-700 block">
              Depreciation Percentage <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-1">
              {[5, 10, 15, 20, 25].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleQuickPercent(pct)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                    percentage === pct.toString()
                      ? 'bg-[#1A56DB] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <input
              type="number"
              required
              min="0.0001"
              max="100"
              step="0.0001"
              placeholder="e.g. 10.00"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              className="w-full pr-8 pl-3 py-2 text-sm font-mono font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100 transition-all text-slate-900"
            />
            <span className="absolute right-3 top-2.5 font-bold text-slate-400 text-sm">%</span>
          </div>
        </div>

        {/* LIVE FINANCIAL CALCULATION CARD */}
        <div className="p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50/80 rounded-xl border border-blue-200/80 space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-bold text-[#1A56DB] uppercase tracking-wider">
            <TrendingDown className="w-3.5 h-3.5" /> Live Depreciation Calculation
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {/* Current Book Value */}
            <div className="p-2.5 bg-white/90 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Book Value</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-slate-800 mt-1 block">
                {formatCurrency(asset.currentValue)}
              </span>
            </div>

            {/* Depreciation Amount */}
            <div className="p-2.5 bg-white/90 rounded-lg border border-rose-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-rose-500 block">Depreciation</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-rose-600 mt-1 block">
                {numeric ? `− ${formatCurrency(amount)}` : '—'}
              </span>
            </div>

            {/* New Book Value */}
            <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">New Book Value</span>
              <span className="text-xs sm:text-sm font-mono font-black text-emerald-800 mt-1 block">
                {numeric ? formatCurrency(nextValue) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* VALIDATION WARNING */}
        {percentage && !valid && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-[11px]">
              {nextValue < residualFloor
                ? `Calculated new book value (${formatCurrency(nextValue)}) cannot drop below the asset residual salvage floor of ${formatCurrency(residualFloor)}.`
                : 'Enter a valid positive percentage between 0.0001% and 100%.'}
            </div>
          </div>
        )}

        {/* EFFECTIVE DATE & NOTES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Effective Accounting Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="date"
                required
                min={asset.purchaseDate.slice(0, 10)}
                max={new Date().toISOString().slice(0, 10)}
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Reason / Accounting Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <FileText className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. FY26 Annual WDV Depreciation Write-Down"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>
        </div>
      </form>
    </EnterpriseModal>
  )
}

export default AssetDepreciationModal
