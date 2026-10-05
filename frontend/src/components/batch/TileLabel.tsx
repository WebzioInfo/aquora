import React from 'react'

export interface TileLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
  className?: string
}

export const TileLabel: React.FC<TileLabelProps> = ({ children, className = '', ...props }) => {
  return (
    <span
      className={`text-xs text-slate-500 font-normal normal-case block leading-tight ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

export default TileLabel
