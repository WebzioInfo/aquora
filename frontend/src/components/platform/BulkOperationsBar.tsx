import React, { useState } from 'react'
import { Trash2, Power, Key } from 'lucide-react'

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
    <div className="bg-white text-slate-900 p-3 px-5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200 select-none border border-slate-200">
      <div className="flex items-center gap-3">
        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg font-mono font-bold text-xs">
          {selectedCount} Selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-xs text-slate-500 hover:text-slate-900 font-semibold underline cursor-pointer"
        >
          Deselect All
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs flex-wrap">
        <button
          onClick={() => handleAction('bulk_activate')}
          disabled={loading}
          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
        >
          <Power className="w-3.5 h-3.5" /> Activate
        </button>
        <button
          onClick={() => handleAction('bulk_deactivate')}
          disabled={loading}
          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
        >
          <Power className="w-3.5 h-3.5" /> Deactivate
        </button>

        <button
          onClick={() => handleAction('reset_password')}
          disabled={loading}
          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
        >
          <Key className="w-3.5 h-3.5" /> Reset Passwords
        </button>

        <button
          onClick={() => handleAction('bulk_delete')}
          disabled={loading}
          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" /> Bulk Delete
        </button>
      </div>
    </div>
  )
}

export default BulkOperationsBar
