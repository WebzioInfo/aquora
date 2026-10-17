import React from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

interface FailedLoadStateProps {
  itemName?: string
  resourceName?: string
  message?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}

export const FailedLoadState: React.FC<FailedLoadStateProps> = ({
  itemName,
  resourceName,
  message,
  onRetry,
  className = '',
  compact = false,
}) => {
  const targetName = itemName || resourceName || 'data'
  const displayMessage = message || `Couldn't load ${targetName}. Try again.`

  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 ${className}`}>
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate font-medium">{displayMessage}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white border border-slate-200 rounded-xl select-none ${className}`}>
      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium text-slate-700 mb-4 max-w-sm">
        {displayMessage}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  )
}

export default FailedLoadState
