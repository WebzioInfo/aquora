import React, { useState, useRef, useEffect } from 'react'
import { Search, ChevronLeft, ChevronRight, Calendar, X, Lock } from 'lucide-react'
import { formatMonthLabel, getPrevMonth, getNextMonth } from './payrollHelpers'

export type PayrollStatusFilter = 'all' | 'unpaid' | 'partial' | 'paid'

interface PayrollFiltersProps {
  selectedMonth: string
  onMonthChange: (month: string) => void
  availableMonths?: string[]
  finalizedMonths?: Set<string>
  searchTerm: string
  onSearchChange: (search: string) => void
  statusFilter: PayrollStatusFilter
  onStatusChange: (status: PayrollStatusFilter) => void
  departmentFilter: string
  onDepartmentChange: (dept: string) => void
  departments: string[]
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export const PayrollFilters: React.FC<PayrollFiltersProps> = ({
  selectedMonth,
  onMonthChange,
  availableMonths = [],
  finalizedMonths = new Set(),
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  departmentFilter,
  onDepartmentChange,
  departments,
  onClearFilters,
  hasActiveFilters
}) => {
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close month picker dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsMonthPickerOpen(false)
      }
    }
    if (isMonthPickerOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isMonthPickerOpen])

  // Build a distinct sorted list of months
  const monthOptions = React.useMemo(() => {
    const set = new Set<string>(availableMonths)
    if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      set.add(selectedMonth)
    }
    const currentM = new Date().toISOString().slice(0, 7)
    set.add(currentM)
    return Array.from(set).sort().reverse()
  }, [availableMonths, selectedMonth])

  const isCurrentMonthFinalized = Boolean(selectedMonth && finalizedMonths.has(selectedMonth))

  return (
    <div className="p-3 border-b border-[#E5E9F2] bg-white flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
        {/* Month Switcher ‹ Month Year › */}
        <div className="relative inline-flex items-center" ref={pickerRef}>
          <div className="inline-flex items-center h-[34px] bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-xs text-slate-800 shadow-2xs">
            <button
              type="button"
              onClick={() => onMonthChange(getPrevMonth(selectedMonth))}
              title="Previous month"
              className="w-7 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
              className="px-2.5 h-full flex items-center gap-1.5 font-medium hover:text-[#1A56DB] transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{formatMonthLabel(selectedMonth)}</span>
              {isCurrentMonthFinalized && (
                <span title="Finalized" className="inline-flex items-center text-slate-400 cursor-help">
                  <Lock className="w-3 h-3 text-slate-500" />
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onMonthChange(getNextMonth(selectedMonth))}
              title="Next month"
              className="w-7 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Month Picker Dropdown */}
          {isMonthPickerOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
              <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Select Payroll Month
              </div>
              <button
                type="button"
                onClick={() => {
                  onMonthChange('')
                  setIsMonthPickerOpen(false)
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !selectedMonth ? 'bg-blue-50 text-[#1A56DB] font-semibold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                All Months
              </button>
              <div className="my-1 border-t border-slate-100" />
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {monthOptions.map(m => {
                  const isMonthFinalized = finalizedMonths.has(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        onMonthChange(m)
                        setIsMonthPickerOpen(false)
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                        selectedMonth === m
                          ? 'bg-blue-50 text-[#1A56DB] font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{formatMonthLabel(m)}</span>
                      {isMonthFinalized && (
                        <span title="Finalized" className="inline-flex items-center text-slate-400">
                          <Lock className="w-3 h-3 text-slate-500" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-56 sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search salary no, employee..."
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full h-[34px] pl-8 pr-3 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1A56DB] focus:bg-white transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Chips */}
        <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200/70">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'unpaid', label: 'Unpaid' },
              { key: 'partial', label: 'Partial' },
              { key: 'paid', label: 'Paid' }
            ] as const
          ).map(chip => {
            const isActive = statusFilter === chip.key
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => onStatusChange(chip.key)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* Department Dropdown */}
        <select
          value={departmentFilter}
          onChange={e => onDepartmentChange(e.target.value)}
          className="h-[34px] px-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100/60 focus:outline-none focus:border-[#1A56DB] transition-all cursor-pointer"
        >
          <option value="">All Departments</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-[#1A56DB] hover:underline font-medium px-1 flex items-center gap-1"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}

export default PayrollFilters
