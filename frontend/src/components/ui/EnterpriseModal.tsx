import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface EnterpriseModalProps {
  isOpen: boolean
  onClose: () => void
  title: React.ReactNode
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  className?: string
}

export const EnterpriseModal: React.FC<EnterpriseModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
  className = ''
}) => {
  // Lock body scroll when modal is open and restore when closed
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)

      return () => {
        document.body.style.overflow = originalStyle
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const widths = {
    sm: 'max-w-md',       // 448px (confirmations, simple dialogs)
    md: 'max-w-2xl',      // 672px (standard forms)
    lg: 'max-w-4xl',      // 896px (payroll, sales, complex forms)
    xl: 'max-w-5xl',      // 1024px (wide accounting & ledgers)
    '2xl': 'max-w-6xl',   // 1152px (extra wide screens)
    full: 'max-w-[calc(100vw-3rem)]'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      {/* Backdrop Overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200" 
      />

      {/* Dialog Shell Container */}
      <div 
        className={`relative w-full ${widths[maxWidth]} max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] bg-white border border-slate-200 rounded-[14px] shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150 z-10 overflow-hidden ${className}`}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white select-none">
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button 
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer -mr-1"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          {children}
        </div>

        {/* Optional Fixed Footer */}
        {footer && (
          <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 rounded-b-[14px] flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default EnterpriseModal
