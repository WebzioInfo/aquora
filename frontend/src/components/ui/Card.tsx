import React from 'react'

export const Card = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`glass-panel rounded-2xl shadow-sm border border-border-ui ${className}`} {...props}>
    {children}
  </div>
)

export const CardHeader = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-5 pb-0 ${className}`} {...props}>
    {children}
  </div>
)

export const CardTitle = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-sm font-extrabold text-text-main ${className}`} {...props}>
    {children}
  </h3>
)

export const CardContent = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-5 ${className}`} {...props}>
    {children}
  </div>
)

export const CardFooter = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-5 pt-0 flex items-center justify-between ${className}`} {...props}>
    {children}
  </div>
)

export default Card
