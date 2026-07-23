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
      className={`w-full max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 bg-[#F8FAFC] min-h-[calc(100vh-56px)] space-y-6 select-none ${className}`}
    >
      {children}
    </div>
  );
};

export default PageContainer;
