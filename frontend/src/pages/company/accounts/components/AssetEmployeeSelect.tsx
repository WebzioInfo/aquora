import React, { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { assetService, type AssetEmployee } from '../../../../services/assets'
import { Search, UserCheck, X, Check, Loader2, User } from 'lucide-react'

interface AssetEmployeeSelectProps {
  selectedId?: string
  selectedName: string
  selectedDepartment?: string
  onSelect: (employee: AssetEmployee) => void
  onClear?: () => void
}

export const AssetEmployeeSelect: React.FC<AssetEmployeeSelectProps> = ({
  selectedId,
  selectedName,
  selectedDepartment,
  onSelect,
  onClear
}) => {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search)
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const { data = [], isFetching, isError, refetch } = useQuery({
    queryKey: ['assetEmployeeSearch', debounced],
    queryFn: ({ signal }) => assetService.searchEmployees(debounced, signal),
    staleTime: 30_000,
    enabled: isSearching || debounced.length > 0
  })

  // Close search popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSearching(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getInitials = (name: string) => {
    if (!name) return 'EM'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const handleSelectEmployee = (emp: AssetEmployee) => {
    onSelect(emp)
    setIsSearching(false)
    setSearch('')
  }

  const handleClearSelection = () => {
    if (onClear) {
      onClear()
    }
    setIsSearching(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div ref={containerRef} className="space-y-2 select-none">
      <div className="flex items-center justify-between">
        <label className="font-bold text-slate-700 text-xs block">
          Employee / Assignee <span className="text-rose-500">*</span>
        </label>
        {selectedId && !isSearching && (
          <button
            type="button"
            onClick={handleClearSelection}
            className="text-[11px] font-semibold text-[#1A56DB] hover:underline cursor-pointer"
          >
            Change Assignee
          </button>
        )}
      </div>

      {/* Selected Employee Card View */}
      {selectedId && !isSearching ? (
        <div className="flex items-center justify-between p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {getInitials(selectedName)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 text-xs">{selectedName}</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  <UserCheck className="w-2.5 h-2.5" /> Selected
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {selectedDepartment || 'No department assigned'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearSelection}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-emerald-100/60 transition-colors"
            title="Change selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={isSearching}
              aria-controls="asset-employee-results"
              placeholder="Search employee by name, department, or ID..."
              value={search}
              onFocus={() => setIsSearching(true)}
              onChange={(e) => {
                setSearch(e.target.value)
                setIsSearching(true)
              }}
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800"
            />
            {isFetching ? (
              <Loader2 className="w-3.5 h-3.5 absolute right-3 top-3 text-[#1A56DB] animate-spin" />
            ) : search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {/* Results Dropdown */}
          {isSearching && (
            <div
              id="asset-employee-results"
              className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100"
            >
              {isFetching && data.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1A56DB]" />
                  <span>Searching employees...</span>
                </div>
              ) : isError ? (
                <div className="p-3 text-center text-xs text-rose-600 space-y-1">
                  <p>Unable to load employees from database.</p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="text-[11px] font-bold text-[#1A56DB] underline"
                  >
                    Retry
                  </button>
                </div>
              ) : data.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  <User className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <p className="font-semibold text-slate-600">No active employees found</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Try searching with a different name or department</p>
                </div>
              ) : (
                data.map((emp) => {
                  const isCurrent = emp.id === selectedId
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleSelectEmployee(emp)}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-blue-50/70 flex items-center justify-between transition-colors cursor-pointer ${
                        isCurrent ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0 border border-slate-200">
                          {getInitials(emp.fullName)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block text-xs">{emp.fullName}</span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {emp.department || 'Production'} {emp.username ? `· ${emp.username}` : ''}
                          </span>
                        </div>
                      </div>
                      {isCurrent && <Check className="w-4 h-4 text-[#1A56DB]" />}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AssetEmployeeSelect
