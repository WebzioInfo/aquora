import React from 'react'

interface EnterpriseBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'gray'
}

export const EnterpriseBadge: React.FC<EnterpriseBadgeProps> = ({
  children,
  variant = 'primary',
  className = '',
  ...props
}) => {
  const baseStyle = 'px-3 py-0.5 rounded-full text-xs font-semibold select-none shrink-0'
  
  const variants = {
    primary: 'bg-[#EFF4FF] text-[#1A56DB]',
    success: 'bg-[#DCFCE7] text-[#166534]',
    danger: 'bg-[#FEE2E2] text-[#991B1B]',
    warning: 'bg-[#FFFAEB] text-[#F79009]',
    info: 'bg-[#EFF8FF] text-[#2E90FA]',
    gray: 'bg-[#F9FAFB] text-[#667085]'
  }

  return (
    <span 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

export default EnterpriseBadge
