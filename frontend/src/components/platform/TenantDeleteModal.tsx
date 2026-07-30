import React, { useState } from 'react'
import { AlertTriangle, Trash2, X, ShieldAlert, Database } from 'lucide-react'
import EnterpriseInput from '../ui/EnterpriseInput'

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
  const [reason, setReason] = useState('Platform Admin Manual Deletion & Hard Drop')
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
      setError(err?.response?.data?.message || err?.message || 'Hard delete failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div onClick={onClose} className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-150" />

      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border-2 border-rose-600/30 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/10 border border-rose-600/20 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-950 dark:text-rose-200 leading-tight">
                Permanent Hard Delete Tenant Schema
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-400 font-mono">
                PostgreSQL Drop Schema Action: DROP SCHEMA {tenant.schemaName} CASCADE;
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">

          {error && (
            <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-800 font-semibold">
              {error}
            </div>
          )}

          {/* Warning Banner */}
          <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start gap-3 text-rose-900 dark:text-rose-300">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-sm block">This operation is irreversible.</span>
              <p className="text-xs leading-relaxed text-rose-700 dark:text-rose-400">
                Executing this operation will lock all tenant access, revoke all JWT active refresh tokens, terminate user sessions, and <strong>physically drop the PostgreSQL schema ({tenant.schemaName}) using CASCADE</strong>. All database tables, records, products, orders, sales, inventory, and foreign keys will be permanently purged.
              </p>
            </div>
          </div>

          {/* Impact Summary Grid */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Target Tenant Metadata</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block">Company Name</span>
                <span className="font-semibold text-slate-900 dark:text-white">{tenant.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Tenant ID (GUID)</span>
                <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200">{tenant.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block">PostgreSQL Schema</span>
                <span className="font-mono font-bold text-rose-600">{tenant.schemaName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Subscription Tier</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{tenant.subscriptionPlan || 'Not Available'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">User Accounts</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {tenant.activeUsersCount !== undefined && tenant.activeUsersCount !== null ? `${tenant.activeUsersCount} Users` : 'Not Available'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Storage Consumption</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {tenant.storageUsedMb !== undefined && tenant.storageUsedMb !== null ? `${tenant.storageUsedMb} MB` : 'Not Available'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Provisioning Date</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : 'Not Available'}
                </span>
              </div>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1">
            <label className="block text-slate-700 dark:text-slate-300 font-medium">Super Admin Audit Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State reason for hard deletion..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Type DELETE verification */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-slate-900 dark:text-white font-bold">
              Type <span className="font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-rose-600">DELETE</span> to enable button:
            </label>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2 font-mono font-bold text-sm tracking-widest border border-rose-300 dark:border-rose-800 rounded-lg bg-white dark:bg-slate-900 text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-600"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || loading}
            className={`px-5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all ${
              isConfirmed && !loading
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {loading ? 'Dropping Schema...' : 'Permanently Delete Tenant'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default TenantDeleteModal
