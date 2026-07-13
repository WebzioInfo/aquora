import React from 'react'

interface EnterpriseHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export const EnterpriseHeader: React.FC<EnterpriseHeaderProps> = ({
  title,
  description,
  actions
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 select-none">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-normal">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}

export default EnterpriseHeader
