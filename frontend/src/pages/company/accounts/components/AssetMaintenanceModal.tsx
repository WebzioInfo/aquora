import React from 'react'
import type { DetailedAsset, RecordMaintenanceInput } from '../../../../services/assets'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import { Wrench, Calendar, DollarSign, UserCheck, ShieldCheck } from 'lucide-react'

interface AssetMaintenanceModalProps {
  isOpen: boolean
  asset: DetailedAsset
  maintenanceForm: RecordMaintenanceInput
  setMaintenanceForm: React.Dispatch<React.SetStateAction<RecordMaintenanceInput>>
  pending: boolean
  onClose: () => void
  onSave: (data: RecordMaintenanceInput) => void
}

export const AssetMaintenanceModal: React.FC<AssetMaintenanceModalProps> = ({
  isOpen,
  asset,
  maintenanceForm,
  setMaintenanceForm,
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

  const totalCost =
    (Number(maintenanceForm.partsCost) || 0) +
    (Number(maintenanceForm.labourCost) || 0) +
    (Number(maintenanceForm.otherCost) || 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pending) {
      onSave(maintenanceForm)
    }
  }

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Log Maintenance Record"
      subtitle={`Record preventive or corrective service for ${asset.assetName}`}
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
            form="maintenance-form"
            loading={pending}
            loadingText="Logging..."
            variant="primary"
            size="sm"
          >
            Log Maintenance Record
          </EnterpriseButton>
        </div>
      }
    >
      <form id="maintenance-form" onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700 select-none">
        {/* ASSET SUMMARY CARD */}
        <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Asset</span>
            <span className="text-sm font-black text-slate-900 mt-0.5 block">{asset.assetName}</span>
            <span className="font-mono text-xs text-slate-500">{asset.assetTag || asset.assetCode} · {asset.assetCategory}</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Recorded Maintenance</span>
            <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">
              {formatCurrency(asset.totalMaintenanceCost || 0)}
            </span>
          </div>
        </div>

        {/* TYPE & SERVICE PROVIDER */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Maintenance Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={maintenanceForm.maintenanceType}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenanceType: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-medium focus:outline-none focus:border-[#1A56DB]"
            >
              <option value="Preventive">Preventive Maintenance (Routine)</option>
              <option value="Corrective">Corrective Maintenance (Fault Fix)</option>
              <option value="Scheduled">Scheduled Servicing (Periodic)</option>
              <option value="Repair">Emergency Repair / Overhaul</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Service Provider / Agency <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Aquatech Internal Team / OEM Care"
              value={maintenanceForm.serviceProvider}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, serviceProvider: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
            />
          </div>
        </div>

        {/* DESCRIPTION */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Service Description & Scope <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Replaced RO membrane filter elements, lubricated bearings, and recalibrated pressure valves"
            value={maintenanceForm.description}
            onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
          />
        </div>

        {/* FINANCIAL COSTS */}
        <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
              Expenditure Breakdown
            </span>
            <span className="text-xs font-mono font-bold text-[#1A56DB]">
              Total Service Cost: {formatCurrency(totalCost)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Parts Cost (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={maintenanceForm.partsCost === 0 ? '' : maintenanceForm.partsCost}
                onChange={(e) =>
                  setMaintenanceForm({ ...maintenanceForm, partsCost: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Labour Cost (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={maintenanceForm.labourCost === 0 ? '' : maintenanceForm.labourCost}
                onChange={(e) =>
                  setMaintenanceForm({ ...maintenanceForm, labourCost: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Other Incidental Cost (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={maintenanceForm.otherCost === 0 ? '' : maintenanceForm.otherCost}
                onChange={(e) =>
                  setMaintenanceForm({ ...maintenanceForm, otherCost: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>
        </div>

        {/* DATES & TECHNICIAN */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Technician / Lead</label>
            <input
              type="text"
              placeholder="e.g. Rajesh Kumar"
              value={maintenanceForm.technicianName || ''}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, technicianName: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Maintenance Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="date"
                required
                value={maintenanceForm.maintenanceDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenanceDate: e.target.value })}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Next Service Due</label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="date"
                value={maintenanceForm.nextMaintenanceDate?.slice(0, 10) || ''}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextMaintenanceDate: e.target.value })}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>
        </div>

        {/* NOTES */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Service Notes / Observations <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Operational notes, oil grade used, pressure check readings, or recommended follow-up..."
            value={maintenanceForm.notes || ''}
            onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
          />
        </div>
      </form>
    </EnterpriseModal>
  )
}

export default AssetMaintenanceModal
