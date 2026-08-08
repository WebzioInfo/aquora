import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNotificationStore } from '../../store/useNotificationStore'
import type { Toast } from '../../store/useNotificationStore'
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info, ArrowRight } from 'lucide-react'

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useNotificationStore()

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        )
      case 'error':
        return (
          <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
        )
      case 'warning':
        return (
          <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
        )
    }
  }

  const getBorderColor = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'border-l-4 border-l-emerald-500 border-t border-r border-b border-slate-200/80'
      case 'error':
        return 'border-l-4 border-l-rose-500 border-t border-r border-b border-slate-200/80'
      case 'warning':
        return 'border-l-4 border-l-amber-500 border-t border-r border-b border-slate-200/80'
      default:
        return 'border-l-4 border-l-blue-500 border-t border-r border-b border-slate-200/80'
    }
  }

  const getProgressBarColor = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500'
      case 'error':
        return 'bg-rose-500'
      case 'warning':
        return 'bg-amber-500'
      default:
        return 'bg-blue-500'
    }
  }

  return (
    <aside
      aria-label="Notifications"
      tabIndex={-1}
      className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[9999] flex flex-col gap-3 max-w-[420px] w-[calc(100vw-2rem)] pointer-events-none font-sans"
    >
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-auto bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-xl shadow-slate-900/5 relative overflow-hidden transition-all ${getBorderColor(
              toast.type
            )}`}
          >
            <div className="flex items-start gap-3.5">
              {getIcon(toast.type)}

              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className="text-xs font-bold text-slate-900 tracking-tight leading-none mb-1">
                  {toast.title}
                </h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed break-words">
                  {toast.message}
                </p>

                {toast.actionLabel && toast.onAction && (
                  <button
                    onClick={() => {
                      toast.onAction?.()
                      removeToast(toast.id)
                    }}
                    className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    <span>{toast.actionLabel}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100 shrink-0 cursor-pointer -mt-1 -mr-1"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subtle duration progress bar */}
            {toast.duration && toast.duration > 0 && (
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: toast.duration / 1000, ease: 'linear' }}
                style={{ transformOrigin: 'left center' }}
                className={`absolute bottom-0 left-0 right-0 h-[2.5px] opacity-75 ${getProgressBarColor(
                  toast.type
                )}`}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </aside>
  )
}

export default ToastContainer
