import React, { useState } from 'react'
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react'

interface TenantDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  tenant: any
}

export const TenantDeleteModal: React.FC<TenantDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tenant
}) => {
  const [confirmationInput, setConfirmationInput] = useState('')
  const [reason, setReason] = useState('Platform Admin Manual Deletion')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !tenant) return null

  const isConfirmed = confirmationInput.trim() === 'DELETE'

  const handleDelete = async () => {
    if (!isConfirmed) return
    try {
      setLoading(true)
      setError(null)
      await onConfirm(reason)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Tenant deletion failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      {/* Light Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity" />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-600">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">
              Confirm Tenant Deletion
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs">

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold">
              {error}
            </div>
          )}

          {/* Warning Banner */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-xs block">Action cannot be undone.</span>
              <p className="text-xs leading-relaxed text-amber-800">
                This operation will remove the tenant entry and permanently drop the underlying database schema.
              </p>
            </div>
          </div>

          {/* Minimal Tenant Target Details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Company Name:</span>
              <span className="font-bold text-slate-900">{tenant.name || 'Not Available'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Schema Name:</span>
              <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">{tenant.schemaName || 'Not Available'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Tenant ID:</span>
              <span className="font-mono text-[11px] text-slate-700">{tenant.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Status:</span>
              <span className={`font-semibold ${tenant.isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
                {tenant.status || (tenant.isActive ? 'Active' : 'Inactive')}
              </span>
            </div>
          </div>

          {/* Audit Reason Input */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium">Deletion Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State reason for hard deletion..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
            />
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-slate-900 font-bold">
              Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-rose-600">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2 font-mono font-bold text-xs tracking-wider border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-600"
            />
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || loading}
            className={`px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
              isConfirmed && !loading
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {loading ? 'Deleting...' : 'Delete Tenant'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default TenantDeleteModal
