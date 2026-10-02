import React from 'react'
import { Search, X, LayoutList, LayoutGrid } from 'lucide-react'

export type VendorStatusChip = 'all' | 'with-balance' | 'settled' | 'inactive'
export type VendorViewMode = 'table' | 'cards'

interface VendorFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  statusChip: VendorStatusChip
  onStatusChipChange: (chip: VendorStatusChip) => void
  viewMode: VendorViewMode
  onViewModeChange: (mode: VendorViewMode) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}

const CHIPS: { id: VendorStatusChip; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'with-balance', label: 'With balance' },
  { id: 'settled', label: 'Settled' },
  { id: 'inactive', label: 'Inactive' }
]

export const VendorFilters: React.FC<VendorFiltersProps> = ({
  search,
  onSearchChange,
  statusChip,
  onStatusChipChange,
  viewMode,
  onViewModeChange,
  hasActiveFilters,
  onClearFilters
}) => {
  return (
    <div className="p-3 border-b border-[#E5E9F2] bg-white flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shrink-0 select-none">
      {/* Left: Search input + Status Chips */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
        {/* Search Input */}
        <div className="relative w-full sm:w-72 lg:w-80 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search vendor name, code, phone, GST, email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-[32px] pl-8 pr-7 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] text-slate-900 placeholder:text-slate-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {CHIPS.map(chip => {
            const isSelected = statusChip === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onStatusChipChange(chip.id)}
                className={`h-[28px] px-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-[#1A56DB] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-[#1A56DB] hover:underline font-semibold flex items-center gap-1 cursor-pointer shrink-0 ml-1"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Right: View Toggle (Table / Cards) */}
      <div className="flex items-center justify-end gap-1 shrink-0 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
        <button
          type="button"
          onClick={() => onViewModeChange('table')}
          className={`h-[26px] px-2 rounded-md flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
            viewMode === 'table'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
          title="Table view"
          aria-label="Table view"
        >
          <LayoutList className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Table</span>
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('cards')}
          className={`h-[26px] px-2 rounded-md flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
            viewMode === 'cards'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
          title="Card grid view"
          aria-label="Card grid view"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cards</span>
        </button>
      </div>
    </div>
  )
}

export default VendorFilters
