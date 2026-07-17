import React from 'react'

interface EnterpriseInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  light?: boolean
}

export const EnterpriseInput = React.forwardRef<HTMLInputElement, EnterpriseInputProps>(
  ({ label, error, icon, light = true, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full text-left">
        {label && (
          <label className={`text-xs font-medium select-none ${
            light ? 'text-[#344054] dark:text-[#344054]' : 'text-[#344054] dark:text-slate-300'
          }`}>
            {label}
          </label>
        )}
        <div className="relative group w-full">
          <input
            ref={ref}
            className={`w-full h-[40px] border px-3 py-2 text-sm transition-all placeholder:text-[#98A2B3] focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] focus:shadow-[0_0_0_2px_rgba(26,86,219,0.15)] rounded-[8px] ${
              light 
                ? 'bg-white dark:bg-white text-slate-900 dark:text-slate-900 border-[#D0D5DD] dark:border-[#D0D5DD]' 
                : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-[#D0D5DD] dark:border-slate-700'
            } ${
              error ? 'border-red-500 ring-1 ring-red-500' : ''
            } ${icon ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {icon && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-hydro-navy dark:group-focus-within:text-hydro-azure transition-colors select-none">
              {icon}
            </div>
          )}
        </div>
        {error && (
          <span className="text-[10px] font-semibold text-error select-none">
            {error}
          </span>
        )}
      </div>
    )
  }
)

EnterpriseInput.displayName = 'EnterpriseInput'

export default EnterpriseInput
