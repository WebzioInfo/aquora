import React from 'react'
import type { DetailedAsset, AssignAssetInput } from '../../../../services/assets'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import AssetEmployeeSelect from './AssetEmployeeSelect'
import { UserCheck, Building, Calendar, FileText } from 'lucide-react'

interface AssetAssignmentModalProps {
  isOpen: boolean
  asset: DetailedAsset
  assignForm: AssignAssetInput
  setAssignForm: React.Dispatch<React.SetStateAction<AssignAssetInput>>
  pending: boolean
  onClose: () => void
  onSave: (data: AssignAssetInput) => void
}

export const AssetAssignmentModal: React.FC<AssetAssignmentModalProps> = ({
  isOpen,
  asset,
  assignForm,
  setAssignForm,
  pending,
  onClose,
  onSave
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (assignForm.employeeId && !pending) {
      onSave(assignForm)
    }
  }

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Assign Asset Custody"
      subtitle={`Assign operational responsibility and custody for ${asset.assetName}`}
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
            form="assign-form"
            disabled={!assignForm.employeeId || pending}
            loading={pending}
            loadingText="Assigning..."
            variant="primary"
            size="sm"
          >
            Assign Asset
          </EnterpriseButton>
        </div>
      }
    >
      <form id="assign-form" onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700 select-none">
        {/* ASSET CONTEXT & CURRENT ASSIGNMENT CARD */}
        <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Asset</span>
            <span className="text-sm font-black text-slate-900 mt-0.5 block">{asset.assetName}</span>
            <span className="font-mono text-xs text-slate-500">{asset.assetTag || asset.assetCode} · {asset.assetCategory}</span>
          </div>

          <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Current Assignment</span>
            {asset.assignedEmployeeName ? (
              <div className="flex items-center sm:justify-end gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800 text-xs">{asset.assignedEmployeeName}</span>
              </div>
            ) : (
              <span className="text-slate-400 italic text-xs mt-0.5 block">Unassigned</span>
            )}
            <span className="text-[10px] text-slate-500 block">Location: {asset.location || 'Main Site'}</span>
          </div>
        </div>

        {/* SEARCHABLE EMPLOYEE SELECT */}
        <div className="pt-1">
          <AssetEmployeeSelect
            selectedId={assignForm.employeeId}
            selectedName={assignForm.employeeName}
            selectedDepartment={assignForm.department}
            onSelect={(emp) =>
              setAssignForm((prev) => ({
                ...prev,
                employeeId: emp.id,
                employeeName: emp.fullName,
                department: emp.department || prev.department || ''
              }))
            }
            onClear={() =>
              setAssignForm((prev) => ({
                ...prev,
                employeeId: undefined,
                employeeName: '',
                department: ''
              }))
            }
          />
        </div>

        {/* DEPARTMENT & DATE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Department <span className="text-slate-400 font-normal">(from employee profile)</span>
            </label>
            <div className="relative">
              <Building className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                readOnly
                placeholder="Department will auto-fill"
                value={assignForm.department || ''}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Assignment Effective Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="date"
                required
                value={assignForm.assignmentDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, assignmentDate: e.target.value }))}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>
        </div>

        {/* ASSIGNMENT NOTES */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Assignment Notes / Purpose <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Issued for Q3 plant production expansion; laptop handed over with original charger and bag."
            value={assignForm.notes || ''}
            onChange={(e) => setAssignForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
          />
        </div>
      </form>
    </EnterpriseModal>
  )
}

export default AssetAssignmentModal
