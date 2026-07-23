import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  backHref?: string;
  backLabel?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, backHref, backLabel }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-2 mb-2">
      {backHref && (
        <button 
          onClick={() => navigate(backHref)}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors text-xs font-bold w-fit cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>{backLabel || 'Back'}</span>
        </button>
      )}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <React.Fragment key={index}>
              {item.href && !isLast ? (
                <button 
                  onClick={() => navigate(item.href!)}
                  className="hover:text-slate-900 transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ) : (
                <span className={isLast ? 'text-slate-600 font-bold' : ''}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default Breadcrumb;
