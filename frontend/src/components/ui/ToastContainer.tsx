import React from 'react'
import { useNotificationStore } from '../../store/useNotificationStore'
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react'

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useNotificationStore()

  if (toasts.length === 0) return null

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
      default:
        return <Info className="w-5 h-5 text-sky-500 shrink-0" />
    }
  }

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-l-4 border-l-emerald-500'
      case 'error':
        return 'border-l-4 border-l-rose-500'
      case 'warning':
        return 'border-l-4 border-l-amber-500'
      default:
        return 'border-l-4 border-l-sky-500'
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`glass-panel p-4 rounded-xl flex items-start gap-3 shadow-lg transition-all duration-300 transform translate-y-0 opacity-100 hover:scale-[1.01] ${getTypeStyles(
            toast.type
          )}`}
        >
          {getIcon(toast.type)}
          <div className="flex-1 text-sm font-medium pr-2">
            {toast.message}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-text-muted hover:text-text-main shrink-0 transition-colors p-0.5 rounded-md hover:bg-accent-soft"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
export default ToastContainer
