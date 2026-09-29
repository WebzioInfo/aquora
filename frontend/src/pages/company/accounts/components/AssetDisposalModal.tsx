import React from 'react'
import type { DetailedAsset, DisposeAssetInput } from '../../../../services/assets'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import { Archive, AlertTriangle, Calendar, DollarSign, FileText } from 'lucide-react'

interface AssetDisposalModalProps {
  isOpen: boolean
  asset: DetailedAsset
  disposeForm: DisposeAssetInput
  setDisposeForm: React.Dispatch<React.SetStateAction<DisposeAssetInput>>
  pending: boolean
  onClose: () => void
  onSave: (data: DisposeAssetInput) => void
}

export const AssetDisposalModal: React.FC<AssetDisposalModalProps> = ({
  isOpen,
  asset,
  disposeForm,
  setDisposeForm,
  pending,
  onClose,
  onSave
}) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pending) {
      onSave(disposeForm)
    }
  }

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Dispose / Retire Asset"
      subtitle={`Record the formal accounting disposal of ${asset.assetName}`}
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
            form="dispose-form"
            loading={pending}
            loadingText="Disposing..."
            variant="danger"
            size="sm"
          >
            Dispose Asset
          </EnterpriseButton>
        </div>
      }
    >
      <form id="dispose-form" onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700 select-none">
        {/* ASSET CONTEXT & BOOK VALUE */}
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
          </div>
        </div>

        {/* SIGNIFICANT ACCOUNTING LIFECYCLE WARNING PANEL */}
        <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="font-bold text-xs block text-amber-950">
              Significant Accounting Lifecycle Operation
            </strong>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              This asset will remain in your records for historical and accounting purposes, but it will no longer be
              treated as an active asset and will be excluded from ongoing book value capitalization.
            </p>
          </div>
        </div>

        {/* DISPOSAL DATE & METHOD */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Disposal Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="date"
                required
                min={asset.purchaseDate.slice(0, 10)}
                max={new Date().toISOString().slice(0, 10)}
                value={disposeForm.disposalDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDisposeForm({ ...disposeForm, disposalDate: e.target.value })}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Disposal Method <span className="text-rose-500">*</span>
            </label>
            <select
              value={disposeForm.disposalMethod}
              onChange={(e) => setDisposeForm({ ...disposeForm, disposalMethod: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-medium focus:outline-none focus:border-[#1A56DB]"
            >
              <option value="Scrapped">Scrapped / Salvaged</option>
              <option value="Sold">Sold to Buyer / Third Party</option>
              <option value="WrittenOff">Written Off (Total Loss)</option>
              <option value="Donated">Donated / Transferred Out</option>
              <option value="Lost">Lost / Stolen</option>
            </select>
          </div>
        </div>

        {/* DISPOSAL REASON */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Disposal Reason <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. End of operational lifespan; high repair frequency and obsolete technology"
            value={disposeForm.reason}
            onChange={(e) => setDisposeForm({ ...disposeForm, reason: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
          />
        </div>

        {/* SALE VALUE & DISPOSAL COST */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Sale Value Realized (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={disposeForm.saleValue === 0 ? '' : disposeForm.saleValue}
              onChange={(e) =>
                setDisposeForm({ ...disposeForm, saleValue: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Disposal Cost Incurred (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={disposeForm.disposalCost === 0 ? '' : disposeForm.disposalCost}
              onChange={(e) =>
                setDisposeForm({ ...disposeForm, disposalCost: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
            />
          </div>
        </div>

        {/* BUYER / PARTY */}
        {disposeForm.disposalMethod === 'Sold' && (
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Buyer / Purchasing Party Name
            </label>
            <input
              type="text"
              placeholder="e.g. Scrap Recycling Corp Ltd"
              value={disposeForm.buyerParty || ''}
              onChange={(e) => setDisposeForm({ ...disposeForm, buyerParty: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
            />
          </div>
        )}

        {/* DISPOSAL NOTES */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Disposal Audit Notes / Reference # <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Additional notes for asset ledger and audit team..."
            value={disposeForm.notes || ''}
            onChange={(e) => setDisposeForm({ ...disposeForm, notes: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
          />
        </div>
      </form>
    </EnterpriseModal>
  )
}

export default AssetDisposalModal
