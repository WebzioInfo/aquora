import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  loading,
  className = '',
  ...props
}) => {
  const baseStyle =
    'px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 select-none active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variants = {
    primary: 'bg-brand-primary hover:bg-opacity-95 hover:scale-[1.01] text-white shadow-sm shadow-indigo-500/10 active:scale-[0.99]',
    secondary: 'border border-border-ui hover:bg-accent-soft text-text-main',
    danger: 'bg-brand-danger hover:bg-opacity-95 hover:scale-[1.01] text-white shadow-sm active:scale-[0.99]',
    ghost: 'hover:bg-accent-soft text-text-muted hover:text-text-main'
  }

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-4.5 w-4.5 text-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : null}
      {children}
    </button>
  )
}
export default Button
