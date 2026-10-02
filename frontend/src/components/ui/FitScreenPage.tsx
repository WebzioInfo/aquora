import React from 'react'

interface FitScreenPageProps {
  children: React.ReactNode
  className?: string
}

/**
 * FitScreenPage:
 * A reusable layout wrapper that fills 100% of the available viewport area below the top bar
 * with display:flex, flex-direction:column, and overflow:hidden so that ONLY internal
 * table rows scroll and window-level scrolling is eliminated.
 */
export const FitScreenPage: React.FC<FitScreenPageProps> = ({
  children,
  className = ''
}) => {
  return (
    <div
      className={`w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden select-none ${className}`}
    >
      {children}
    </div>
  )
}

export default FitScreenPage
