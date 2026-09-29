import React from 'react'
import type { DetailedAsset, TransferAssetInput } from '../../../../services/assets'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import { Truck, MapPin, ArrowRight, Calendar, FileText } from 'lucide-react'

interface AssetTransferModalProps {
  isOpen: boolean
  asset: DetailedAsset
  transferForm: TransferAssetInput
  setTransferForm: React.Dispatch<React.SetStateAction<TransferAssetInput>>
  pending: boolean
  onClose: () => void
  onSave: (data: TransferAssetInput) => void
}

export const AssetTransferModal: React.FC<AssetTransferModalProps> = ({
  isOpen,
  asset,
  transferForm,
  setTransferForm,
  pending,
  onClose,
  onSave
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pending) {
      onSave(transferForm)
    }
  }

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Transfer Asset Location"
      subtitle={`Relocate ${asset.assetName} to another plant, facility, or department`}
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
            form="transfer-form"
            loading={pending}
            loadingText="Transferring..."
            variant="primary"
            size="sm"
          >
            Transfer Asset
          </EnterpriseButton>
        </div>
      }
    >
      <form id="transfer-form" onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700 select-none">
        {/* ASSET SUMMARY CARD */}
        <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Asset</span>
            <span className="text-sm font-black text-slate-900 mt-0.5 block">{asset.assetName}</span>
            <span className="font-mono text-xs text-slate-500">{asset.assetTag || asset.assetCode} · {asset.assetCategory}</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Current Custodian</span>
            <span className="text-xs font-bold text-slate-800 mt-0.5 block">
              {asset.assignedEmployeeName || 'Unassigned'}
            </span>
          </div>
        </div>

        {/* LOCATION TRANSFER VISUAL PIPELINE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              From Current Location
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                disabled
                value={transferForm.fromLocation || asset.location || 'Main Plant'}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-100 text-slate-600 font-medium cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Destination Location / Plant <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#1A56DB]" />
              <input
                type="text"
                required
                placeholder="e.g. Bottling Plant Unit B / Site 2"
                value={transferForm.toLocation}
                onChange={(e) => setTransferForm({ ...transferForm, toLocation: e.target.value })}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100 transition-all font-medium"
              />
            </div>
          </div>
        </div>

        {/* REASON & EFFECTIVE DATE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Reason for Transfer <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Production line capacity expansion"
              value={transferForm.reason}
              onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Transfer Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="date"
                required
                value={transferForm.transferDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
                onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>
        </div>

        {/* NOTES */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Transfer Notes / Transit Details <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Transported via company truck; inspected upon arrival by site engineer."
            value={transferForm.notes || ''}
            onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
          />
        </div>
      </form>
    </EnterpriseModal>
  )
}

export default AssetTransferModal
