import React, { useState } from 'react'
import { CheckSquare, ShieldCheck, Trash2, Power, UserCheck, Key, Download, RefreshCw } from 'lucide-react'

interface BulkOperationsBarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkExecute: (action: string, targetValue?: string) => Promise<void>
}

export const BulkOperationsBar: React.FC<BulkOperationsBarProps> = ({
  selectedCount,
  onClearSelection,
  onBulkExecute
}) => {
  const [loading, setLoading] = useState(false)
  const [roleSelectOpen, setRoleSelectOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState('Standard')

  if (selectedCount === 0) return null

  const handleAction = async (action: string, value?: string) => {
    try {
      setLoading(true)
      await onBulkExecute(action, value)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-900 text-white p-3 px-5 rounded-xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200 select-none border border-slate-800">
      <div className="flex items-center gap-3">
        <span className="px-2.5 py-1 bg-blue-600 rounded-lg font-mono font-bold text-xs">
          {selectedCount} Selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
        >
          Deselect All
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs flex-wrap">
        <button
          onClick={() => handleAction('bulk_activate')}
          disabled={loading}
          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 rounded-lg flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
        >
          <Power className="w-3.5 h-3.5" /> Activate
        </button>
        <button
          onClick={() => handleAction('bulk_deactivate')}
          disabled={loading}
          className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-500/30 rounded-lg flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
        >
          <Power className="w-3.5 h-3.5" /> Deactivate
        </button>

        <button
          onClick={() => handleAction('reset_password')}
          disabled={loading}
          className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 rounded-lg flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
        >
          <Key className="w-3.5 h-3.5" /> Reset Passwords
        </button>

        <button
          onClick={() => handleAction('bulk_delete')}
          disabled={loading}
          className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/30 rounded-lg flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" /> Bulk Delete
        </button>
      </div>
    </div>
  )
}

export default BulkOperationsBar
