import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label ? (
          <label className="text-xs font-semibold text-text-muted select-none">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          className={`w-full px-3.5 py-2.5 rounded-lg border border-border-ui bg-transparent text-sm text-text-main placeholder:text-muted/40 focus:outline-none focus:border-brand-primary transition-all focus:ring-2 focus:ring-brand-primary/10 ${
            error ? 'border-brand-danger focus:border-brand-danger focus:ring-brand-danger/10' : ''
          } ${className}`}
          {...props}
        />
        {error ? (
          <span className="text-xs font-medium text-brand-danger">
            {error}
          </span>
        ) : null}
      </div>
    )
  }
)
Input.displayName = 'Input'
export default Input
