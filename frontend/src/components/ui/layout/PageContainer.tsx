import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Global page container — enforces identical max-width, padding, and
 * background across every page in the ERP. Never override these values
 * inline; use the className prop only for rare one-off additions.
 */
export const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`flex flex-col gap-4 font-sans text-slate-900 bg-[#F8FAFC] min-h-screen select-none ${className}`}
    >
      {children}
    </div>
  );
};

export default PageContainer;
