import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export const Dialog: React.FC<DialogProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className = '' 
}) => {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`relative z-10 w-full max-w-lg glass-panel p-6 rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 ${className}`}>
        {title && (
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-ui">
            <h3 className="text-sm font-extrabold text-text-main select-none">{title}</h3>
            <button 
              onClick={onClose}
              className="p-1 rounded-md text-text-muted hover:bg-accent-soft hover:text-text-main transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {!title && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-md text-text-muted hover:bg-accent-soft hover:text-text-main transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 overflow-y-auto max-h-[80vh]">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Dialog
