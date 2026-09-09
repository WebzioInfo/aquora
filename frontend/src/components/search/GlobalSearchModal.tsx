import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  Command,
  ArrowRight,
  Clock,
  Trash2,
  Building2,
  Users,
  Truck,
  UserCheck,
  User,
  MapPin,
  Droplets,
  Droplet,
  Package,
  PackageCheck,
  Layers,
  Store,
  Receipt,
  CreditCard,
  Beaker,
  Compass,
  Zap,
  Sliders,
  ExternalLink,
  ChevronRight,
  CornerDownLeft
} from 'lucide-react'
import { useSearchStore } from '../../store/useSearchStore'
import { searchService } from '../../services/search'
import type { GlobalSearchResponse, GlobalSearchResult } from '../../services/search'

const SCOPES = [
  { id: 'all', label: 'All Results' },
  { id: '20l', label: '20L Business' },
  { id: 'customers', label: 'Customers' },
  { id: 'distributors', label: 'Distributors' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'people', label: 'People & Drivers' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'production', label: 'Production' },
  { id: 'finance', label: 'Finance' },
  { id: 'qc', label: 'QC & Tests' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'actions', label: 'Actions' }
]

const renderIcon = (iconName?: string) => {
  switch (iconName) {
    case 'Building2': return <Building2 className="w-4 h-4 text-blue-600" />
    case 'Users': return <Users className="w-4 h-4 text-indigo-600" />
    case 'Truck': return <Truck className="w-4 h-4 text-emerald-600" />
    case 'UserCheck': return <UserCheck className="w-4 h-4 text-teal-600" />
    case 'User': return <User className="w-4 h-4 text-slate-600" />
    case 'MapPin': return <MapPin className="w-4 h-4 text-amber-600" />
    case 'Droplets': return <Droplets className="w-4 h-4 text-sky-600" />
    case 'Droplet': return <Droplet className="w-4 h-4 text-blue-500" />
    case 'Package': return <Package className="w-4 h-4 text-amber-700" />
    case 'PackageCheck': return <PackageCheck className="w-4 h-4 text-emerald-600" />
    case 'Layers': return <Layers className="w-4 h-4 text-purple-600" />
    case 'Store': return <Store className="w-4 h-4 text-orange-600" />
    case 'Receipt': return <Receipt className="w-4 h-4 text-rose-600" />
    case 'CreditCard': return <CreditCard className="w-4 h-4 text-cyan-600" />
    case 'Beaker': return <Beaker className="w-4 h-4 text-violet-600" />
    case 'Compass': return <Compass className="w-4 h-4 text-blue-600" />
    case 'Zap': return <Zap className="w-4 h-4 text-amber-500" />
    case 'Sliders': return <Sliders className="w-4 h-4 text-slate-500" />
    default: return <Search className="w-4 h-4 text-slate-400" />
  }
}

export const GlobalSearchModal: React.FC = () => {
  const { isOpen, initialQuery, initialScope, closeSearch, toggleSearch, recentSearches, addRecentSearch, clearRecentSearches } = useSearchStore()
  const navigate = useNavigate()

  const [query, setQuery] = useState(initialQuery)
  const [activeScope, setActiveScope] = useState(initialScope || 'all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<GlobalSearchResponse | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Global Keyboard Listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggleSearch()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSearch])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery)
      setActiveScope(initialScope || 'all')
      setSelectedIndex(0)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen, initialQuery, initialScope])

  // Debounced search query
  const executeSearch = useCallback(async (q: string, sc: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const response = await searchService.search(q, sc, undefined, 5, controller.signal)
      setData(response)
      setSelectedIndex(0)
    } catch (err: any) {
      if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
        setError('Search could not be completed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      executeSearch(query, activeScope)
    }, 150)
    return () => clearTimeout(timer)
  }, [query, activeScope, isOpen, executeSearch])

  // Flattened results for keyboard navigation
  const flattenedResults = useMemo(() => {
    if (!data?.groups) return []
    const list: GlobalSearchResult[] = []
    data.groups.forEach(group => {
      group.results.forEach(res => {
        list.push(res)
      })
    })
    return list
  }, [data])

  const handleSelectResult = (result: GlobalSearchResult) => {
    if (query.trim()) {
      addRecentSearch(query.trim(), result.category)
    }
    closeSearch()
    navigate(result.routeUrl)
  }

  // Handle arrow key and enter navigation
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flattenedResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % flattenedResults.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flattenedResults.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + flattenedResults.length) % flattenedResults.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flattenedResults.length > 0 && flattenedResults[selectedIndex]) {
        handleSelectResult(flattenedResults[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeSearch()
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-search-index="${selectedIndex}"]`)
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (!isOpen) return null

  let globalIndexCounter = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 md:pt-16 px-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={closeSearch} />

      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] z-10 animate-in zoom-in-95 duration-150">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/70">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search Aquzio (customers, distributors, vehicles, 20L supplies, batches, finance)..."
            className="flex-1 bg-transparent border-none outline-none text-sm md:text-base text-slate-800 placeholder-slate-400 font-medium"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-slate-200/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Esc</span>
          </div>
        </div>

        {/* Scope Filter Chips */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 overflow-x-auto scrollbar-none bg-white">
          {SCOPES.map((sc) => (
            <button
              key={sc.id}
              onClick={() => setActiveScope(sc.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeScope === sc.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Search Body Content */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-4 max-h-[60vh]">
          {error ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <p className="text-sm font-semibold text-red-500">{error}</p>
              <button
                onClick={() => executeSearch(query, activeScope)}
                className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100"
              >
                Try Again
              </button>
            </div>
          ) : !query && recentSearches.length > 0 && data?.groups.length === 0 ? (
            <div className="space-y-4 p-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Recent Searches
                </span>
                <button
                  onClick={clearRecentSearches}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500 transition-colors font-medium lowercase"
                >
                  <Trash2 className="w-3 h-3" /> clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuery(item.query)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 text-xs font-medium transition-colors cursor-pointer border border-slate-200/60"
                  >
                    <span>{item.query}</span>
                    {item.category && <span className="text-[10px] text-slate-400">• {item.category}</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : data && data.groups.length === 0 && !loading ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">No results found for &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Try checking spelling, searching by phone number, vehicle registration number (e.g. KL12), or reference ID.
                </p>
              </div>
            </div>
          ) : (
            data?.groups.map((group) => (
              <div key={group.type} className="space-y-1.5">
                <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {renderIcon(group.icon)} {group.label}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">
                    {group.totalCount}
                  </span>
                </div>

                <div className="space-y-1">
                  {group.results.map((result) => {
                    const currentIndex = globalIndexCounter++
                    const isSelected = selectedIndex === currentIndex

                    return (
                      <div
                        key={result.id}
                        data-search-index={currentIndex}
                        onClick={() => handleSelectResult(result)}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 border ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-200 shadow-sm text-blue-950'
                            : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {renderIcon(result.icon)}
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs md:text-sm truncate">{result.title}</span>
                              {result.status && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                  {result.status}
                                </span>
                              )}
                            </div>
                            {result.subtitle && (
                              <p className="text-[11px] text-slate-500 truncate">{result.subtitle}</p>
                            )}
                          </div>
                        </div>

                        {/* Actions / Enter Key Indicator */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isSelected && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-white px-2 py-1 rounded shadow-xs border border-blue-200">
                              <span>Open</span>
                              <CornerDownLeft className="w-3 h-3" />
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Search Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 font-mono text-[10px] text-slate-700 font-bold">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 font-mono text-[10px] text-slate-700 font-bold">↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 font-mono text-[10px] text-slate-700 font-bold">↵</kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 font-mono text-[10px] text-slate-700 font-bold">esc</kbd>
              <span>Close</span>
            </span>
          </div>

          {data && (
            <div className="text-[10px] text-slate-400 font-mono">
              {data.totalMatches} matches ({data.executionTimeMs}ms)
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
