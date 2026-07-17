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
    primary: 'bg-[#EFF4FF] text-[#1A56DB] dark:bg-[#1e3a8a]/25 dark:text-blue-300',
    success: 'bg-[#DCFCE7] text-[#166534] dark:bg-green-950/30 dark:text-green-300',
    danger: 'bg-[#FEE2E2] text-[#991B1B] dark:bg-red-950/30 dark:text-red-300',
    warning: 'bg-[#FFFAEB] text-[#F79009] dark:bg-amber-950/30 dark:text-amber-300',
    info: 'bg-[#EFF8FF] text-[#2E90FA] dark:bg-blue-950/30 dark:text-blue-300',
    gray: 'bg-[#F9FAFB] text-[#667085] dark:bg-slate-800 dark:text-slate-350'
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
