import React from 'react'

interface EnterpriseCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  extra?: React.ReactNode
}

export const EnterpriseCard: React.FC<EnterpriseCardProps> = ({
  children,
  title,
  extra,
  className = '',
  ...props
}) => {
  return (
    <div 
      className={`bg-white border border-[#E5E9F2] p-5 rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 ${className}`}
      {...props}
    >
      {(title || extra) && (
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E5E9F2] select-none">
          {title && (
            <h2 className="text-sm font-semibold text-[#344054]">
              {title}
            </h2>
          )}
          {extra && (
            <div className="text-xs">
              {extra}
            </div>
          )}
        </div>
      )}
      <div className="w-full">
        {children}
      </div>
    </div>
  )
}

export default EnterpriseCard
