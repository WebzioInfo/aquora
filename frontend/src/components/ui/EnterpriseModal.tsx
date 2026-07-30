import React from 'react'
import { X } from 'lucide-react'

interface EnterpriseModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
}

export const EnterpriseModal: React.FC<EnterpriseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md'
}) => {
  if (!isOpen) return null

  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
      />

      {/* Dialog body */}
      <div className={`relative w-full ${widths[maxWidth]} bg-white border border-slate-200 p-6 rounded-[12px] shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 z-10`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 select-none">
          <h3 className="text-sm font-semibold text-[#111827]">
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-sm text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  )
}

export default EnterpriseModal
