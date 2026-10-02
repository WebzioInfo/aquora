import React from 'react'
import { Search, X } from 'lucide-react'

interface OwnerFiltersProps {
  searchTerm: string
  onSearchChange: (search: string) => void
  onClearFilters: () => void
  totalCount: number
  filteredCount: number
}

export const OwnerFilters: React.FC<OwnerFiltersProps> = ({
  searchTerm,
  onSearchChange,
  onClearFilters,
  totalCount,
  filteredCount
}) => {
  return (
    <div className="p-3 border-b border-[#E5E9F2] bg-white flex items-center justify-between gap-3 shrink-0 select-none">
      <div className="relative flex-1 max-w-sm">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search by owner name or phone..."
          className="w-full h-[34px] pl-8 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1A56DB] focus:bg-white transition-colors"
        />
        {searchTerm.trim() && (
          <button
            type="button"
            onClick={onClearFilters}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="text-xs text-slate-500">
        {searchTerm.trim() ? (
          <span>
            Showing <strong>{filteredCount}</strong> of {totalCount} {totalCount === 1 ? 'owner' : 'owners'}
          </span>
        ) : (
          <span>
            <strong>{totalCount}</strong> {totalCount === 1 ? 'owner' : 'owners'} total
          </span>
        )}
      </div>
    </div>
  )
}

export default OwnerFilters
