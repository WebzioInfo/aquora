import React from 'react'
import EnterpriseNumberInput from './EnterpriseNumberInput'

interface EnterpriseInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  light?: boolean
}

export const EnterpriseInput = React.forwardRef<HTMLInputElement, EnterpriseInputProps>(
  ({ label, error, icon, light = true, className = '', type, value, onChange, ...props }, ref) => {
    if (type === 'number') {
      return (
        <EnterpriseNumberInput
          ref={ref}
          label={label}
          error={error}
          icon={icon}
          className={className}
          value={value as any}
          onChange={onChange}
          {...(props as any)}
        />
      )
    }
    return (
      <div className="flex flex-col gap-1 w-full text-left">
        {label && (
          <label className="text-xs font-medium select-none text-[#344054]">
            {label}
          </label>
        )}
        <div className="relative group w-full">
          <input
            ref={ref}
            className={`w-full h-[40px] border px-3 py-2 text-sm transition-all placeholder:text-[#98A2B3] focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] focus:shadow-[0_0_0_2px_rgba(26,86,219,0.15)] rounded-[8px] bg-white text-slate-900 border-[#D0D5DD] ${
              error ? 'border-red-500 ring-1 ring-red-500' : ''
            } ${icon ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {icon && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-hydro-navy transition-colors select-none">
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
