import React from 'react'

export interface TileProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export const Tile: React.FC<TileProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`min-w-0 rounded-xl border border-slate-200 bg-white p-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export default Tile
