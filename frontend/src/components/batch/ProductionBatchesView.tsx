import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  RefreshCw,
  X,
  LayoutGrid,
  List,
  Play,
  Package,
  Pause,
  AlertTriangle
} from 'lucide-react'
import { StatTile } from './StatTile'
import { StatusBadge } from './StatusBadge'
import { ProgressBar } from './ProgressBar'
import { Pagination } from './Pagination'
import { usePageSize } from './usePageSize'
import { LONG_RUN_DAYS, formatRunningDuration, formatBatchDate } from './batchUtils'

export interface ProductionBatchesViewProps {
  allBatches: any[]
  activeBatches: any[]
  batchesLoading: boolean
  productionLines: any[]
  onRefresh: () => void
  isOwnerRole: boolean
  onCreateBatchClick: () => void
}

export const ProductionBatchesView: React.FC<ProductionBatchesViewProps> = ({
  allBatches = [],
  activeBatches = [],
  batchesLoading,
  productionLines = [],
  onRefresh,
  isOwnerRole,
  onCreateBatchClick
}) => {
  const navigate = useNavigate()

  // ── View Mode: Grid (default) or Table ──────────────────────────────────────
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // ── Filters State ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Running' | 'Paused' | 'Completed'>('All')
  const [lineFilter, setLineFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)

  // Reset page to 1 when filters or viewMode change
  const handleFilterChange = (updater: () => void) => {
    updater()
    setPage(1)
  }

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('All')
    setLineFilter('')
    setDateFilter('')
    setPage(1)
  }

  // ── KPI Computations ─────────────────────────────────────────────────────────
  const { runningCount, runningLinesCount, totalCases, pausedCount, needsAttentionCount } = useMemo(() => {
    let running = 0
    const runningLinesSet = new Set<string>()
    let cases = 0
    let paused = 0
    let attention = 0
    const now = Date.now()

    allBatches.forEach((b: any) => {
      const s = (b.status || (b.completedAt ? 'COMPLETED' : '')).toUpperCase()
      const isRunning = s === 'ACTIVE' || s === 'RUNNING' || s === 'BOTTLING ACTIVE' || s === 'IN PROGRESS'

      if (isRunning) {
        running++
        const lineId = b.productionLineId || b.lineId || b.productionLineName
        if (lineId) runningLinesSet.add(lineId)

        const start = b.startedAt || b.createdAt
        if (start) {
          const days = (now - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
          if (days >= LONG_RUN_DAYS) {
            attention++
          }
        }
      } else if (s === 'PAUSED') {
        paused++
      }

      cases += Number(b.producedQuantity || 0)
    })

    return {
      runningCount: running,
      runningLinesCount: runningLinesSet.size,
      totalCases: cases,
      pausedCount: paused,
      needsAttentionCount: attention
    }
  }, [allBatches])

  // ── Filtering Logic ──────────────────────────────────────────────────────────
  const filteredBatches = useMemo(() => {
    return allBatches.filter((batch: any) => {
      const s = (search || '').trim().toLowerCase()
      const matchesSearch =
        !s ||
        (batch.batchNumber && batch.batchNumber.toLowerCase().includes(s)) ||
        (batch.product && batch.product.toLowerCase().includes(s)) ||
        (batch.operatorName && batch.operatorName.toLowerCase().includes(s)) ||
        (batch.productionLineName && batch.productionLineName.toLowerCase().includes(s)) ||
        (batch.productionLineCode && batch.productionLineCode.toLowerCase().includes(s)) ||
        (batch.shift && batch.shift.toLowerCase().includes(s))

      const matchesLine = lineFilter === '' || batch.productionLineId === lineFilter

      let matchesStatus = true
      if (statusFilter !== 'All') {
        const statusUpper = (batch.status || (batch.completedAt ? 'COMPLETED' : '')).toUpperCase()
        if (statusFilter === 'Running') {
          matchesStatus =
            statusUpper === 'ACTIVE' ||
            statusUpper === 'RUNNING' ||
            statusUpper === 'BOTTLING ACTIVE' ||
            statusUpper === 'IN PROGRESS'
        } else if (statusFilter === 'Paused') {
          matchesStatus = statusUpper === 'PAUSED'
        } else if (statusFilter === 'Completed') {
          matchesStatus = statusUpper === 'COMPLETED' || !!batch.completedAt
        }
      }

      let matchesDate = true
      if (dateFilter) {
        const batchDate = batch.startedAt || batch.createdAt || batch.completedAt
        matchesDate = !!batchDate && new Date(batchDate).toISOString().slice(0, 10) === dateFilter
      }

      return matchesSearch && matchesLine && matchesStatus && matchesDate
    })
  }, [allBatches, search, lineFilter, statusFilter, dateFilter])

  // ── Dynamic Page Size Calculation (ResizeObserver) ───────────────────────────
  // Batch tile fixed height: 104px. Gap: 8px.
  // Table row fixed height: 40px. Table header: 32px.
  const containerRef = useRef<HTMLDivElement>(null)
  const isGrid = viewMode === 'grid'

  const { pageSize } = usePageSize(containerRef, {
    itemHeight: isGrid ? 104 : 40,
    gap: isGrid ? 8 : 2,
    isSingleColumn: !isGrid
  })

  const pageCount = Math.max(1, Math.ceil(filteredBatches.length / pageSize))

  // Clamp page when pageSize changes
  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount)
    }
  }, [page, pageCount])

  const currentPage = Math.min(Math.max(1, page), pageCount)
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredBatches.slice(start, start + pageSize)
  }, [filteredBatches, currentPage, pageSize])

  const statusChips: Array<'All' | 'Running' | 'Paused' | 'Completed'> = ['All', 'Running', 'Paused', 'Completed']

  // Helper for operator initials
  const getInitials = (name?: string) => {
    if (!name) return 'OP'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Helper for status left border accent (emerald running, blue completed, amber paused)
  const getStatusBorderColor = (status?: string, completedAt?: string | null) => {
    const s = (status || (completedAt ? 'COMPLETED' : '')).toLowerCase()
    if (s === 'running' || s === 'active' || s === 'in progress' || s === 'bottling active') {
      return 'border-l-emerald-500'
    }
    if (s === 'paused') {
      return 'border-l-amber-500'
    }
    if (s === 'completed') {
      return 'border-l-blue-500'
    }
    return 'border-l-slate-300'
  }

  return (
    <div className="w-full flex flex-col gap-2 min-h-0 lg:h-[calc(100vh-112px)] lg:max-h-[calc(100vh-112px)] lg:overflow-hidden select-none">
      
      {/* ── ZONE A: Page Header (fixed 48px / h-12) ─────────────────────────── */}
      <div className="h-12 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">Production batches</h1>
          <p className="text-xs text-slate-500 font-normal leading-tight mt-0.5">Track, filter, and review every batch</p>
        </div>
        {!isOwnerRole && (
          <button
            type="button"
            onClick={onCreateBatchClick}
            className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          >
            <Plus className="w-4 h-4" />
            <span>Create batch</span>
          </button>
        )}
      </div>

      {/* ── ZONE B: KPI Strip (fixed 64px, 4 StatTiles in grid-cols-4) ──────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
        <StatTile
          label="Running now"
          value={runningCount}
          hint={`on ${runningLinesCount} ${runningLinesCount === 1 ? 'line' : 'lines'}`}
          icon={<Play className="w-4 h-4 fill-current" />}
          iconBg="bg-blue-100 text-blue-600"
          height="h-16"
          isHero={true}
        />
        <StatTile
          label="Cases produced"
          value={totalCases.toLocaleString()}
          hint={`${allBatches.length} batches`}
          icon={<Package className="w-4 h-4" />}
          iconBg="bg-emerald-100 text-emerald-600"
          height="h-16"
        />
        <StatTile
          label="Paused"
          value={pausedCount}
          hint={pausedCount === 0 ? 'None' : `${pausedCount} batches`}
          tone={pausedCount > 0 ? 'warn' : 'default'}
          icon={<Pause className="w-4 h-4 fill-current" />}
          iconBg="bg-slate-100 text-slate-600"
          height="h-16"
        />
        <StatTile
          label="Needs attention"
          value={needsAttentionCount}
          hint="Running over 30 days"
          tone={needsAttentionCount > 0 ? 'warn' : 'default'}
          icon={<AlertTriangle className="w-4 h-4" />}
          iconBg="bg-amber-100 text-amber-600"
          height="h-16"
        />
      </div>

      {/* ── ZONE C: Filter Bar (fixed 36px / h-9) ─────────────────────────────── */}
      <div className="h-9 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative w-44 sm:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search batch, product, operator..."
              value={search}
              onChange={(e) => handleFilterChange(() => setSearch(e.target.value))}
              className="w-full h-9 pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-lg placeholder-slate-400 text-slate-900 focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          {/* Status Chips */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
            {statusChips.map((chip) => {
              const active = statusFilter === chip
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleFilterChange(() => setStatusFilter(chip))}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                    active
                      ? 'bg-white text-blue-600 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {chip}
                </button>
              )
            })}
          </div>

          {/* Production Lines Dropdown */}
          <select
            value={lineFilter}
            onChange={(e) => handleFilterChange(() => setLineFilter(e.target.value))}
            className="h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 cursor-pointer focus:outline-none focus:border-blue-500 shrink-0"
          >
            <option value="">All lines</option>
            {productionLines.map((line: any) => (
              <option key={line.lineId} value={line.lineId}>
                {line.name}
              </option>
            ))}
          </select>

          {/* Compact Date Filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => handleFilterChange(() => setDateFilter(e.target.value))}
            className="h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 shrink-0"
            title="Filter by date"
          />

          {/* Refresh & Clear */}
          <button
            type="button"
            onClick={onRefresh}
            className="h-9 px-2.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            title="Refresh list"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {(search || statusFilter !== 'All' || lineFilter || dateFilter) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-9 px-2.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              title="Clear all filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Grid / Table Toggle (Icon Buttons, right end of filter bar) */}
        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => handleFilterChange(() => setViewMode('grid'))}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white text-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Grid view"
            aria-label="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange(() => setViewMode('table'))}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Table view"
            aria-label="Table view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── ZONE D: Batch Content Area (flex-1 min-h-0 overflow-hidden) ──────── */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {batchesLoading ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            {Array.from({ length: pageSize || 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[104px] rounded-xl border border-slate-200 bg-white p-2.5 flex flex-col gap-1.5"
              >
                <div className="flex justify-between items-start">
                  <div className="h-4 bg-slate-200 rounded w-20"></div>
                  <div className="h-4 bg-slate-200 rounded w-14"></div>
                </div>
                <div className="h-3 bg-slate-100 rounded w-32"></div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-slate-200"></div>
                  <div className="h-3 bg-slate-100 rounded w-20"></div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full w-full mt-auto"></div>
              </div>
            ))}
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl text-center">
            <p className="text-xs text-slate-600 font-medium">
              No batches match your filters. Clear a filter to see more.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ── GRID VIEW (Fixed 104px tile height, 4 cols on xl) ──────────────── */
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            {paginatedBatches.map((batch: any) => {
              const statusRaw = batch.status || (batch.completedAt ? 'Completed' : 'Running')
              const statusLower = statusRaw.toLowerCase()
              const isRunning =
                statusLower === 'running' ||
                statusLower === 'active' ||
                statusLower === 'in progress' ||
                statusLower === 'bottling active'

              const lineDisplay =
                batch.productionLineName ||
                batch.lineName ||
                (batch.productionLine?.name || batch.productionLine?.Name) ||
                (batch.productionLineCode ? `Line ${batch.productionLineCode}` : 'Line —')

              const hasTarget = Boolean(batch.targetQuantity && batch.targetQuantity > 0)
              const produced = Number(batch.producedQuantity || 0)
              const target = Number(batch.targetQuantity || 0)
              const isOverTarget = hasTarget && produced > target
              const overQty = isOverTarget ? produced - target : 0

              const { text: runDurationText, isLongRun } = formatRunningDuration(
                batch.startedAt || batch.createdAt,
                batch.completedAt
              )

              const borderAccent = getStatusBorderColor(batch.status, batch.completedAt)

              return (
                <div
                  key={batch.id}
                  onClick={() => navigate(`/company/production/batches/${batch.id}`)}
                  className={`h-[104px] rounded-xl border border-slate-200 border-l-[3px] ${borderAccent} bg-white p-2.5 flex flex-col gap-1 cursor-pointer select-none transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate(`/company/production/batches/${batch.id}`)
                    }
                  }}
                >
                  {/* Row 1: Batch ID (font-mono font-bold) + StatusBadge */}
                  <div className="h-5 flex items-center justify-between gap-1 leading-none shrink-0">
                    <span className="font-mono font-bold text-xs text-slate-900 truncate tabular-nums">
                      {batch.batchNumber || 'Batch'}
                    </span>
                    <StatusBadge status={statusRaw} />
                  </div>

                  {/* Row 2: Product and line */}
                  <div className="h-3.5 text-xs text-slate-600 truncate leading-none shrink-0">
                    {batch.product || 'Product —'} · {lineDisplay}
                  </div>

                  {/* Row 3: Operator avatar (20px circle, initials, soft colored background) + name */}
                  <div className="h-5 flex items-center gap-1.5 leading-none shrink-0">
                    <div className="w-5 h-5 rounded-full bg-blue-50 text-[10px] font-medium text-blue-700 flex items-center justify-center shrink-0">
                      {getInitials(batch.operatorName)}
                    </div>
                    <span className="text-xs text-slate-500 truncate font-normal">
                      {batch.operatorName || 'Unassigned'}
                    </span>
                  </div>

                  {/* Bottom: 6px progress bar, then 'produced / target' on left and duration/date on right */}
                  <div className="flex flex-col gap-1 pt-1 border-t border-slate-100 shrink-0">
                    {hasTarget && (
                      <ProgressBar
                        value={isOverTarget ? target : produced}
                        max={target}
                        color={isOverTarget ? 'bg-amber-500' : 'bg-blue-600'}
                        height="h-[6px]"
                      />
                    )}

                    <div className="flex items-center justify-between text-xs leading-none">
                      <span className="font-mono text-slate-700 font-medium tabular-nums truncate text-[11px]">
                        {hasTarget
                          ? isOverTarget
                            ? `${produced.toLocaleString()} / ${target.toLocaleString()} (+${overQty.toLocaleString()} over)`
                            : `${produced.toLocaleString()} / ${target.toLocaleString()} cases`
                          : `${produced.toLocaleString()} cases`}
                      </span>

                      {isRunning ? (
                        <span
                          className={`font-mono text-xs tabular-nums truncate ml-1.5 ${
                            isLongRun ? 'text-amber-600 font-medium' : 'text-slate-500'
                          }`}
                          title={isLongRun ? 'Running over 30 days' : 'Running duration'}
                        >
                          {runDurationText}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-slate-400 tabular-nums truncate ml-1.5">
                          {formatBatchDate(batch.startedAt || batch.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── TABLE VIEW (Fixed 40px row height per batch, fits 14+ rows) ────── */
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden flex flex-col">
            <div className="h-8 bg-slate-50/80 border-b border-slate-200 px-3 flex items-center text-xs font-semibold text-slate-600 select-none shrink-0">
              <span className="w-28 shrink-0">Batch</span>
              <span className="flex-1 min-w-0 pr-2">Product & line</span>
              <span className="w-40 shrink-0 hidden sm:block">Operator</span>
              <span className="w-44 shrink-0 hidden md:block">Output</span>
              <span className="w-32 shrink-0 text-right pr-4 hidden lg:block">Started or running</span>
              <span className="w-24 shrink-0 text-right">Status</span>
            </div>

            <div className="flex flex-col divide-y divide-slate-100">
              {paginatedBatches.map((batch: any) => {
                const statusRaw = batch.status || (batch.completedAt ? 'Completed' : 'Running')
                const statusLower = statusRaw.toLowerCase()
                const isRunning =
                  statusLower === 'running' ||
                  statusLower === 'active' ||
                  statusLower === 'in progress' ||
                  statusLower === 'bottling active'

                const lineDisplay =
                  batch.productionLineName ||
                  batch.lineName ||
                  (batch.productionLine?.name || batch.productionLine?.Name) ||
                  (batch.productionLineCode ? `Line ${batch.productionLineCode}` : 'Line —')

                const hasTarget = Boolean(batch.targetQuantity && batch.targetQuantity > 0)
                const produced = Number(batch.producedQuantity || 0)
                const target = Number(batch.targetQuantity || 0)
                const isOverTarget = hasTarget && produced > target
                const overQty = isOverTarget ? produced - target : 0

                const { text: runDurationText, isLongRun } = formatRunningDuration(
                  batch.startedAt || batch.createdAt,
                  batch.completedAt
                )

                const borderAccent = getStatusBorderColor(batch.status, batch.completedAt)

                return (
                  <div
                    key={batch.id}
                    onClick={() => navigate(`/company/production/batches/${batch.id}`)}
                    className={`h-[40px] px-3 flex items-center border-l-[3px] ${borderAccent} hover:border-blue-300 hover:bg-blue-50/40 transition-colors cursor-pointer select-none text-xs shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        navigate(`/company/production/batches/${batch.id}`)
                      }
                    }}
                  >
                    {/* Batch Number */}
                    <span className="w-28 shrink-0 font-mono font-bold text-slate-900 truncate tabular-nums text-xs">
                      {batch.batchNumber || 'Batch'}
                    </span>

                    {/* Product & Line */}
                    <span className="flex-1 min-w-0 pr-2 text-slate-700 truncate font-normal">
                      {batch.product || 'Product —'} <span className="text-slate-400">· {lineDisplay}</span>
                    </span>

                    {/* Operator (20px circle avatar + name) */}
                    <div className="w-40 shrink-0 hidden sm:flex items-center gap-1.5 truncate">
                      <div className="w-5 h-5 rounded-full bg-blue-50 text-[10px] font-medium text-blue-700 flex items-center justify-center shrink-0">
                        {getInitials(batch.operatorName)}
                      </div>
                      <span className="text-slate-600 truncate">{batch.operatorName || 'Unassigned'}</span>
                    </div>

                    {/* Output (value plus mini progress bar) */}
                    <div className="w-44 shrink-0 hidden md:flex items-center gap-2 pr-2">
                      <span className="font-mono tabular-nums font-medium text-slate-800 shrink-0 text-xs">
                        {hasTarget
                          ? isOverTarget
                            ? `${produced.toLocaleString()} / ${target.toLocaleString()} (+${overQty.toLocaleString()} over)`
                            : `${produced.toLocaleString()} / ${target.toLocaleString()}`
                          : `${produced.toLocaleString()} cases`}
                      </span>
                      {hasTarget && (
                        <div className="flex-1 max-w-[60px]">
                          <ProgressBar
                            value={isOverTarget ? target : produced}
                            max={target}
                            color={isOverTarget ? 'bg-amber-500' : 'bg-blue-600'}
                            height="h-[6px]"
                          />
                        </div>
                      )}
                    </div>

                    {/* Started or running */}
                    <div className="w-32 shrink-0 text-right pr-4 hidden lg:block tabular-nums">
                      {isRunning ? (
                        <span className={`font-mono text-xs ${isLongRun ? 'text-amber-600 font-medium' : 'text-slate-600'}`}>
                          {runDurationText}
                        </span>
                      ) : (
                        <span className="font-mono text-slate-400 text-xs">
                          {formatBatchDate(batch.startedAt || batch.createdAt)}
                        </span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="w-24 shrink-0 text-right">
                      <StatusBadge status={statusRaw} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── ZONE E: Pagination Bar (fixed 36px / h-9) ─────────────────────────── */}
      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onChange={setPage}
        total={filteredBatches.length}
        pageSize={pageSize}
      />
    </div>
  )
}

export default ProductionBatchesView
