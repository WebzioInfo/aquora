import React from 'react'
import { ClipboardList } from 'lucide-react'
import EnterpriseButton from './EnterpriseButton'

interface EnterpriseEmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
}

export const EnterpriseEmptyState: React.FC<EnterpriseEmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon = <ClipboardList className="w-12 h-12 text-slate-350 dark:text-slate-600" />
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] select-none">
      <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 mb-4 shrink-0">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-[#111827] dark:text-white mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[#6B7280] dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <EnterpriseButton onClick={onAction} className="text-xs font-bold">
          {actionLabel}
        </EnterpriseButton>
      )}
    </div>
  )
}

export default EnterpriseEmptyState
