import React from 'react'

interface Option {
  value: string
  label: string
}

interface EnterpriseSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options?: Option[]
  error?: string
  light?: boolean
}

export const EnterpriseSelect = React.forwardRef<HTMLSelectElement, EnterpriseSelectProps>(
  ({ label, options, error, light = true, children, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full text-left">
        {label && (
          <label className={`text-xs font-medium select-none ${
            light ? 'text-[#344054] dark:text-[#344054]' : 'text-[#344054] dark:text-slate-300'
          }`}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full h-[40px] border px-3 py-2 text-sm transition-all focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] focus:shadow-[0_0_0_2px_rgba(26,86,219,0.15)] rounded-[8px] cursor-pointer ${
            light 
              ? 'bg-white dark:bg-white text-slate-900 dark:text-slate-900 border-[#D0D5DD] dark:border-[#D0D5DD]' 
              : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-[#D0D5DD] dark:border-slate-700'
          } ${
            error ? 'border-red-500 ring-1 ring-red-500' : ''
          } ${className}`}
          {...props}
        >
          {children ? children : (
            options?.map((opt) => (
              <option key={opt.value} value={opt.value} className={`bg-white text-slate-900 ${
                light ? 'dark:bg-white dark:text-slate-900' : 'dark:bg-slate-900 dark:text-white'
              }`}>
                {opt.label}
              </option>
            ))
          )}
        </select>
        {error && (
          <span className="text-[10px] font-semibold text-error select-none">
            {error}
          </span>
        )}
      </div>
    )
  }
)

EnterpriseSelect.displayName = 'EnterpriseSelect'

export default EnterpriseSelect
