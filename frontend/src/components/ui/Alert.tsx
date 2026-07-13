import React from 'react'
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react'

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
}

const variantStyles = {
  info: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500',
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
  error: 'bg-rose-500/10 border-rose-500/30 text-rose-500'
}

const icons = {
  info: <Info className="w-5 h-5" />,
  success: <CheckCircle className="w-5 h-5" />,
  warning: <AlertCircle className="w-5 h-5" />,
  error: <XCircle className="w-5 h-5" />
}

export const Alert: React.FC<AlertProps> = ({ 
  variant = 'info', 
  title, 
  children, 
  className = '', 
  ...props 
}) => {
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${variantStyles[variant]} ${className}`} {...props}>
      <div className="shrink-0 mt-0.5">
        {icons[variant]}
      </div>
      <div className="flex-1">
        {title && <h5 className="font-bold text-sm mb-1">{title}</h5>}
        <div className="text-xs leading-relaxed opacity-90">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Alert
