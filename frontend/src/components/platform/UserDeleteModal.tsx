import React, { useState } from 'react'
import { AlertTriangle, Trash2, X, UserX } from 'lucide-react'

interface UserDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  user: any
}

export const UserDeleteModal: React.FC<UserDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  user
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !user) return null

  const handleDelete = async () => {
    try {
      setLoading(true)
      setError(null)
      await onConfirm()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Delete operation failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150" />

      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        
        <div className="p-6 space-y-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/10 border border-rose-600/20 text-rose-600 flex items-center justify-center">
              <UserX className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Delete User Account</h3>
              <p className="text-slate-500 font-mono">{user.email}</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold">
              {error}
            </div>
          )}

          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-bold block mb-1">Session Termination Warning:</span>
            Deleting this user will immediately revoke their JWT refresh tokens, invalidate all active browser sessions, and remove their account directory record.
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 block">User Name: <strong className="text-slate-900 dark:text-white">{user.name || user.email}</strong></span>
            <span className="text-slate-500 block">Privilege Role: <strong className="text-slate-900 dark:text-white">{user.roleName || 'Standard'}</strong></span>
            <span className="text-slate-500 block">Assigned Tenant: <strong className="text-slate-900 dark:text-white">{user.tenantName || 'Global Platform'}</strong></span>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {loading ? 'Deleting...' : 'Delete User'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default UserDeleteModal
