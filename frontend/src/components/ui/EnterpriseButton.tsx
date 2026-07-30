import React from 'react'

interface EnterpriseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const EnterpriseButton: React.FC<EnterpriseButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none rounded-[8px] select-none cursor-pointer disabled:cursor-not-allowed shrink-0'
  
  const variants = {
    primary: 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF] disabled:bg-[#F2F4F7] disabled:text-[#98A2B3] disabled:shadow-none !rounded-[10px] !h-[42px]',
    secondary: 'border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB] active:bg-[#F2F4F7] disabled:border-[#F2F4F7] disabled:text-[#98A2B3]',
    danger: 'bg-[#F04438] text-white hover:bg-[#D92D20] active:bg-[#B42318] disabled:bg-[#F2F4F7] disabled:text-[#98A2B3]',
    success: 'bg-[#17B26A] text-white hover:bg-[#079455] active:bg-[#067647] disabled:bg-[#F2F4F7] disabled:text-[#98A2B3]',
    ghost: 'text-[#667085] hover:bg-[#EFF4FF] hover:text-[#1A56DB]'
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
          <span>Processing...</span>
        </>
      ) : children}
    </button>
  )
}

export default EnterpriseButton
