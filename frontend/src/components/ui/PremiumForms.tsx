import React from 'react';

export const PremiumLabel: React.FC<{ label: string; required?: boolean }> = ({ label, required }) => {
  const hasAsterisk = required || label.endsWith('*');
  const cleanLabel = hasAsterisk ? label.replace('*', '').trim() : label;
  
  return (
    <label className="text-[13px] font-semibold text-gray-700 select-none mb-1.5 flex items-center">
      <span>{cleanLabel}</span>
      {hasAsterisk && <span className="text-[#F04438] ml-1 font-bold text-xs select-none">*</span>}
    </label>
  );
};

export interface PremiumInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export const PremiumInput: React.FC<PremiumInputProps> = ({ label, error, helpText, required, className = '', ...props }) => {
  return (
    <div className="flex flex-col w-full text-left">
      <PremiumLabel label={label} required={required} />
      <input
        className={`w-full h-[44px] px-3.5 border text-[14px] text-gray-900 bg-white placeholder-gray-400 rounded-[10px] transition-all duration-150 focus:outline-none focus:border-[#1A56DB] focus:ring-4 focus:ring-blue-100/50 hover:border-gray-300 disabled:bg-gray-50 disabled:text-gray-400 ${
          error ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100' : 'border-gray-200'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs font-medium text-red-500 mt-1">{error}</span>}
    </div>
  );
};

export interface PremiumSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export const PremiumSelect: React.FC<PremiumSelectProps> = ({ label, error, helpText, required, className = '', children, ...props }) => {
  return (
    <div className="flex flex-col w-full text-left">
      <PremiumLabel label={label} required={required} />
      <div className="relative">
        <select
          className={`w-full h-[44px] px-3.5 pr-10 border text-[14px] text-gray-900 bg-white rounded-[10px] transition-all duration-150 focus:outline-none focus:border-[#1A56DB] focus:ring-4 focus:ring-blue-100/50 hover:border-gray-300 disabled:bg-gray-50 disabled:text-gray-400 appearance-none cursor-pointer ${
            error ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100' : 'border-gray-200'
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {helpText && <p className="text-[10px] text-gray-400 mt-1 pl-1">{helpText}</p>}
      {error && <p className="text-[10px] text-red-500 mt-1 font-medium pl-1">{error}</p>}
    </div>
  );
};

export interface PremiumTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const PremiumTextarea: React.FC<PremiumTextareaProps> = ({ label, error, required, className = '', ...props }) => {
  return (
    <div className="flex flex-col w-full text-left">
      <PremiumLabel label={label} required={required} />
      <textarea
        className={`w-full p-3.5 border text-[14px] text-gray-900 bg-white placeholder-gray-400 rounded-[10px] transition-all duration-150 focus:outline-none focus:border-[#1A56DB] focus:ring-4 focus:ring-blue-100/50 hover:border-gray-300 disabled:bg-gray-50 disabled:text-gray-400 ${
          error ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100' : 'border-gray-200'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs font-medium text-red-500 mt-1">{error}</span>}
    </div>
  );
};

export const PremiumSectionHeading: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="pt-2 pb-1.5 border-b border-gray-100 mb-4 select-none">
      <h4 className="text-[15px] font-semibold text-gray-800 tracking-tight">
        {title}
      </h4>
    </div>
  );
};
