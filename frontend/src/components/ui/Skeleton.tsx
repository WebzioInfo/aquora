import React from 'react'

interface SkeletonProps {
  className?: string
  circle?: boolean
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', circle }) => {
  return (
    <div
      className={`animate-pulse bg-border-ui/40 dark:bg-accent-soft/40 ${
        circle ? 'rounded-full' : 'rounded-lg'
      } ${className}`}
    />
  )
}
export default Skeleton
