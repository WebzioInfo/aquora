import React from 'react'

interface EnterpriseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  loadingText?: string
}

export const EnterpriseButton: React.FC<EnterpriseButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none rounded-[8px] select-none cursor-pointer disabled:cursor-not-allowed shrink-0'
  
  const variants = {
    primary: 'bg-[#05303B] text-white hover:bg-[#0A4352] active:bg-[#031F27] disabled:bg-[#F2F4F7] disabled:text-[#98A2B3] disabled:shadow-none !rounded-[8px] !h-[42px]',
    secondary: 'border border-[#CBD5DB] bg-white text-[#05303B] hover:bg-[#F4F7F8] active:bg-[#E3E8EC] disabled:border-[#F2F4F7] disabled:text-[#98A2B3]',
    danger: 'bg-[#DC2626] text-white hover:bg-[#B91C1C] active:bg-[#991B1B] disabled:bg-[#F2F4F7] disabled:text-[#98A2B3]',
    success: 'bg-[#16A34A] text-white hover:bg-[#15803D] active:bg-[#166534] disabled:bg-[#F2F4F7] disabled:text-[#98A2B3]',
    ghost: 'text-[#5B6B75] hover:bg-[#E6F6F4] hover:text-[#0B7A70]'
  }

  const sizes = {
    sm: 'h-[36px] px-3.5 text-xs',
    md: 'h-[40px] px-5 text-sm',
    lg: 'h-[48px] px-6 text-base'
  }

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2.5 h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{loadingText || 'Processing...'}</span>
        </>
      ) : children}
    </button>
  )
}

export default EnterpriseButton
