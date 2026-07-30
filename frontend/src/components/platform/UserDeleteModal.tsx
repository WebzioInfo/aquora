import React, { useState } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

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
      {/* Light Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity" />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">
              Delete User Account
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs">

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold">
              {error}
            </div>
          )}

          <p className="text-slate-600 leading-relaxed">
            Are you sure you want to delete the user account for <strong className="text-slate-900">{user.name || user.email}</strong>? Active refresh tokens will be revoked and session access terminated.
          </p>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Email:</span>
              <span className="text-slate-900 font-bold">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Role:</span>
              <span className="text-blue-600 font-bold">{user.roleName || 'Standard'}</span>
            </div>
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
            disabled={loading}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {loading ? 'Deleting...' : 'Delete User'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default UserDeleteModal
