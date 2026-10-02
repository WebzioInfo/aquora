import React, { useState } from 'react'
import { Search, X, Calendar, Filter, Users, RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { VendorDropdownItem } from '../../../../services/vendors'
import { getCategoryMeta } from '../expenses/categoryMeta'

export interface PurchaseFilterValues {
  search: string
  status: string // '' | 'Paid' | 'PartiallyPaid' | 'Unpaid'
  vendorId: string
  category: string
  paymentMethod: string
  datePreset: 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom'
  startDate?: string
  endDate?: string
}

interface PurchaseFiltersProps {
  vendors: VendorDropdownItem[]
  categories: string[]
  filters: PurchaseFilterValues
  onChange: (newFilters: Partial<PurchaseFilterValues>) => void
  onClear: () => void
  hasActiveFilters: boolean
}

export const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' }
]

export const getDateRangeForPreset = (
  preset: string
): { startDate?: string; endDate?: string } => {
  const now = new Date()
  const toYMD = (d: Date) => d.toISOString().split('T')[0]

  switch (preset) {
    case 'today': {
      const todayStr = toYMD(now)
      return { startDate: todayStr, endDate: todayStr }
    }
    case 'thisWeek': {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(now.setDate(diff))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { startDate: toYMD(monday), endDate: toYMD(sunday) }
    }
    case 'thisMonth': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) }
    }
    case 'lastMonth': {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) }
    }
    case 'all':
    default:
      return { startDate: undefined, endDate: undefined }
  }
}

export const PurchaseFilters: React.FC<PurchaseFiltersProps> = ({
  vendors,
  categories,
  filters,
  onChange,
  onClear,
  hasActiveFilters
}) => {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const handlePresetChange = (preset: 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom') => {
    if (preset === 'custom') {
      onChange({ datePreset: 'custom' })
    } else {
      const dates = getDateRangeForPreset(preset)
      onChange({
        datePreset: preset,
        startDate: dates.startDate,
        endDate: dates.endDate
      })
    }
  }

  const handleStatusChange = (status: string) => {
    onChange({ status: filters.status === status ? '' : status })
  }

  return (
    <div className="p-3 border-b border-[#E5E9F2] bg-white">
      {/* Desktop & Tablet View (>= 640px) */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-2.5">
        {/* Left Side: Search + Status Chips + Vendor + Category + Date Preset */}
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          {/* Search Box */}
          <div className="relative w-56 md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search purchase #, vendor, invoice..."
              value={filters.search}
              onChange={e => onChange({ search: e.target.value })}
              className="w-full h-[32px] pl-8 pr-7 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] focus:bg-white text-slate-800 placeholder-slate-400 transition-colors"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onChange({ search: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Chips: All, Paid, Partial, Unpaid */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => onChange({ status: '' })}
              className={`py-1 px-2.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filters.status === ''
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('Paid')}
              className={`py-1 px-2.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filters.status === 'Paid'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paid
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('PartiallyPaid')}
              className={`py-1 px-2.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filters.status === 'PartiallyPaid'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Partial
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('Unpaid')}
              className={`py-1 px-2.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filters.status === 'Unpaid'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unpaid
            </button>
          </div>

          {/* Vendor Dropdown */}
          <div className="relative shrink-0 flex items-center">
            <select
              value={filters.vendorId}
              onChange={e => onChange({ vendorId: e.target.value })}
              className={`h-[32px] pl-2.5 pr-7 text-xs border rounded-lg focus:outline-none focus:border-[#1A56DB] cursor-pointer appearance-none ${
                filters.vendorId
                  ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB] font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <option value="">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <Users className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Category Dropdown */}
          <div className="relative shrink-0 flex items-center">
            {filters.category && (
              <span
                className="absolute left-2.5 w-2 h-2 rounded-full z-10 pointer-events-none"
                style={{ backgroundColor: getCategoryMeta(filters.category).dot }}
              />
            )}
            <select
              value={filters.category}
              onChange={e => onChange({ category: e.target.value })}
              style={
                filters.category
                  ? {
                      backgroundColor: getCategoryMeta(filters.category).bg,
                      color: getCategoryMeta(filters.category).text,
                      borderColor: getCategoryMeta(filters.category).dot
                    }
                  : undefined
              }
              className={`h-[32px] ${
                filters.category ? 'pl-6 font-bold' : 'pl-2.5'
              } pr-7 text-xs border rounded-lg focus:outline-none cursor-pointer appearance-none ${
                !filters.category ? 'border-slate-200 bg-slate-50 text-slate-700' : ''
              }`}
            >
              <option value="" style={{ color: '#334155', backgroundColor: '#ffffff' }}>All Categories</option>
              {categories.map(c => {
                const meta = getCategoryMeta(c)
                return (
                  <option
                    key={c}
                    value={c}
                    style={{ color: meta.text, backgroundColor: '#ffffff' }}
                  >
                    ● {c}
                  </option>
                )
              })}
            </select>
            <Filter className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Date Range Preset Selector */}
          <div className="relative shrink-0">
            <select
              value={filters.datePreset}
              onChange={e => handlePresetChange(e.target.value as any)}
              className={`h-[32px] pl-2.5 pr-7 text-xs border rounded-lg focus:outline-none focus:border-[#1A56DB] cursor-pointer appearance-none ${
                filters.datePreset !== 'all'
                  ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB] font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {DATE_PRESETS.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <Calendar className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Custom Date Inputs (only if preset is 'custom') */}
          {filters.datePreset === 'custom' && (
            <div className="flex items-center gap-1 text-xs shrink-0">
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={e => onChange({ startDate: e.target.value })}
                className="h-[32px] px-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] bg-slate-50"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={e => onChange({ endDate: e.target.value })}
                className="h-[32px] px-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] bg-slate-50"
              />
            </div>
          )}
        </div>

        {/* Right Side: Clear Filters Button (only when filters active) */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-[#1A56DB] hover:text-[#1746B3] hover:underline font-semibold cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            Clear filters
          </button>
        )}
      </div>

      {/* Mobile View (< 640px) */}
      <div className="sm:hidden flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search purchases..."
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
            className="w-full h-[36px] pl-8 pr-7 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB]"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileFilterOpen(true)}
          className={`h-[36px] px-3 text-xs font-semibold rounded-lg border flex items-center gap-1.5 shrink-0 ${
            hasActiveFilters
              ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5" />}
        </button>
      </div>

      {/* Mobile Filters Bottom Sheet */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:hidden">
          <div className="w-full bg-white rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-sm text-slate-900">Filter Purchases</span>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Chips */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Payment Status
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {['', 'Paid', 'PartiallyPaid', 'Unpaid'].map(s => {
                  const isSelected = filters.status === s
                  const label = s === '' ? 'All' : s === 'PartiallyPaid' ? 'Partial' : s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleStatusChange(s)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Vendor Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Vendor
              </label>
              <select
                value={filters.vendorId}
                onChange={e => onChange({ vendorId: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              >
                <option value="">All Vendors</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Category
              </label>
              <select
                value={filters.category}
                onChange={e => onChange({ category: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Preset */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Date Range
              </label>
              <select
                value={filters.datePreset}
                onChange={e => handlePresetChange(e.target.value as any)}
                className="w-full h-[40px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              >
                {DATE_PRESETS.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {filters.datePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">From</span>
                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={e => onChange({ startDate: e.target.value })}
                    className="w-full h-[36px] px-2 text-xs border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">To</span>
                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={e => onChange({ endDate: e.target.value })}
                    className="w-full h-[36px] px-2 text-xs border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    onClear()
                    setMobileFilterOpen(false)
                  }}
                  className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className={`${hasActiveFilters ? 'w-1/2' : 'w-full'} py-2.5 text-xs font-semibold text-white bg-[#1A56DB] rounded-lg`}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
