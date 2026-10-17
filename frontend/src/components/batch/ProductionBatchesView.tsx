import React, { useState, useMemo, useEffect } from 'react'
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
  AlertTriangle,
  Eye,
  Edit2,
  Trash2,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { StatTile } from './StatTile'
import { PageHeader } from '../ui/layout/PageHeader'
import { StatusBadge } from './StatusBadge'
import { ProgressBar } from './ProgressBar'
import { EditBatchModal } from './EditBatchModal'
import { DeleteBatchConfirmationModal } from './DeleteBatchConfirmationModal'
import { LONG_RUN_DAYS, formatRunningDuration, formatBatchDate, formatBatchTime } from './batchUtils'
import { FailedLoadState } from '../ui/FailedLoadState'
import type { ProductionBatch } from '../../services/productionBatches'

export interface ProductionBatchesViewProps {
  allBatches: any[]
  activeBatches?: any[]
  batchesLoading: boolean
  isError?: boolean
  productionLines: any[]
  catalogProducts?: any[]
  onRefresh: () => void
  isOwnerRole: boolean
  onCreateBatchClick: () => void
}

export const ProductionBatchesView: React.FC<ProductionBatchesViewProps> = ({
  allBatches = [],
  activeBatches = [],
  batchesLoading,
  isError,
  productionLines = [],
  catalogProducts = [],
  onRefresh,
  isOwnerRole,
  onCreateBatchClick
}) => {
  const navigate = useNavigate()

  // ── View Mode: Table (default as required) or Grid ──────────────────────────
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  // ── Filters State ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Running' | 'Paused' | 'Completed'>('All')
  const [lineFilter, setLineFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  // ── Pagination State ─────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // ── Modals State ─────────────────────────────────────────────────────────────
  const [editingBatch, setEditingBatch] = useState<ProductionBatch | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [deletingBatch, setDeletingBatch] = useState<ProductionBatch | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Reset page when filters change
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

  const pageCount = Math.max(1, Math.ceil(filteredBatches.length / pageSize))

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

  const getInitials = (name?: string) => {
    if (!name) return 'OP'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const getStatusBorderColor = (status?: string, completedAt?: string | null) => {
    const s = (status || (completedAt ? 'COMPLETED' : '')).toLowerCase()
    if (s === 'running' || s === 'active' || s === 'in progress' || s === 'bottling active') {
      return 'border-l-emerald-500'
    }
    if (s === 'paused') {
      return 'border-l-amber-500'
    }
    if (s === 'completed') {
      return 'border-l-[#12A89A]'
    }
    return 'border-l-slate-300'
  }

  const handleEditClick = (batch: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingBatch(batch)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (batch: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingBatch(batch)
    setIsDeleteModalOpen(true)
  }

  const startRecord = filteredBatches.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(filteredBatches.length, currentPage * pageSize)

  return (
    <div className="w-full flex flex-col gap-4.5 pb-8 animate-in fade-in duration-150">
      {/* ── Section A: Page Heading ────────────────────────────────────────── */}
      <PageHeader
        title="Production Batches"
        description="Monitor production, track output, and manage batches."
        actions={
          !isOwnerRole && (
            <button
              type="button"
              onClick={onCreateBatchClick}
              className="h-9 px-4 bg-[#05303B] hover:bg-[#0A4352] active:bg-[#031F27] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Batch</span>
            </button>
          )
        }
      />

      {/* ── Section B: Summary KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <StatTile
          label="Running Batches"
          value={runningCount}
          hint={`across ${runningLinesCount} ${runningLinesCount === 1 ? 'active line' : 'active lines'}`}
          icon={<Play className="w-3.5 h-3.5 fill-current" />}
          iconBg="bg-emerald-50 text-emerald-600"
          borderAccentColor="border-l-emerald-500"
          height="h-[74px]"
        />
        <StatTile
          label="Total Output"
          value={totalCases.toLocaleString()}
          hint={`Cases across ${allBatches.length} batches`}
          icon={<Package className="w-3.5 h-3.5" />}
          iconBg="bg-[#E6F6F4] text-[#0B7A70]"
          borderAccentColor="border-l-[#12A89A]"
          height="h-[74px]"
        />
        <StatTile
          label="Paused Batches"
          value={pausedCount}
          hint={pausedCount === 0 ? 'No paused runs' : `${pausedCount} runs pending resume`}
          tone={pausedCount > 0 ? 'warn' : 'default'}
          icon={<Pause className="w-3.5 h-3.5 fill-current" />}
          iconBg={pausedCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}
          borderAccentColor={pausedCount > 0 ? 'border-l-amber-500' : 'border-l-slate-400'}
          height="h-[74px]"
        />
        <StatTile
          label="Needs Attention"
          value={needsAttentionCount}
          hint="Active run > 30 days"
          tone={needsAttentionCount > 0 ? 'bad' : 'default'}
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          iconBg={needsAttentionCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}
          borderAccentColor={needsAttentionCount > 0 ? 'border-l-rose-500' : 'border-l-slate-400'}
          height="h-[74px]"
        />
      </div>

      {/* ── Section C: Search and Filter Toolbar ─────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search batch, product, operator..."
              value={search}
              onChange={(e) => handleFilterChange(() => setSearch(e.target.value))}
              className="w-full h-9 pl-9 pr-7 text-xs bg-slate-50/60 border border-slate-200 rounded-lg placeholder-slate-400 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleFilterChange(() => setSearch(''))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
            {statusChips.map((chip) => {
              const active = statusFilter === chip
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleFilterChange(() => setStatusFilter(chip))}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#12A89A] focus-visible:outline-none ${
                    active
                      ? 'bg-[#05303B] text-white font-semibold shadow-xs'
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
            className="h-9 px-2.5 text-xs bg-slate-50/60 border border-slate-200 rounded-lg text-slate-700 cursor-pointer focus:outline-none focus:bg-white focus:border-blue-500 transition-all shrink-0"
          >
            <option value="">All lines</option>
            {productionLines.map((line: any) => (
              <option key={line.lineId || line.id} value={line.lineId || line.id}>
                {line.name} {line.code ? `(${line.code})` : ''}
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => handleFilterChange(() => setDateFilter(e.target.value))}
            className="h-9 px-2.5 text-xs bg-slate-50/60 border border-slate-200 rounded-lg text-slate-700 cursor-pointer focus:outline-none focus:bg-white focus:border-blue-500 transition-all shrink-0"
            title="Filter by production date"
          />

          {/* Refresh Action */}
          <button
            type="button"
            onClick={onRefresh}
            className="h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none shadow-xs"
            title="Refresh list"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Clear Filters Button */}
          {(search || statusFilter !== 'All' || lineFilter || dateFilter) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-9 px-2.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title="Clear all active filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* View Toggle (Grid / Table) */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-end md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-[#05303B] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            title="Table View (Default)"
            aria-label="Table View"
          >
            <List className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-[#05303B] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            title="Grid View"
            aria-label="Grid View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {/* ── Section D: Production Batch Presentation ────────────────────────── */}
      <div className="w-full">
        {batchesLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-xs font-medium text-slate-500">Loading production batches...</span>
          </div>
        ) : isError ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center">
            <FailedLoadState resourceName="production batches" onRetry={onRefresh} />
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">No batches found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                No production batches match your current search and filter criteria. Clear your filters or start a new
                batch.
              </p>
            </div>
            {(search || statusFilter !== 'All' || lineFilter || dateFilter) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-1 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* ── TABLE / LIST VIEW (Default Desktop View) ─────────────────────── */
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold select-none">
                    <th className="py-3 px-4 w-44">Batch</th>
                    <th className="py-3 px-4 min-w-[180px]">Product / Line</th>
                    <th className="py-3 px-4 w-40 hidden sm:table-cell">Operator</th>
                    <th className="py-3 px-4 w-48">Output & Target</th>
                    <th className="py-3 px-4 w-32 hidden md:table-cell">Start Date</th>
                    <th className="py-3 px-4 w-32 hidden lg:table-cell">Duration</th>
                    <th className="py-3 px-4 w-28">Status</th>
                    <th className="py-3 px-4 w-32 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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
                      batch.productionLine?.name ||
                      (batch.productionLineCode ? `Line ${batch.productionLineCode}` : 'Line —')

                    const produced = Number(batch.producedQuantity || 0)
                    const target = Number(batch.targetQuantity || 0)
                    const hasTarget = target > 0
                    const isOverTarget = hasTarget && produced > target
                    const pct = hasTarget ? Math.min(100, Math.round((produced / target) * 100)) : 0

                    const { text: runDurationText, isLongRun } = formatRunningDuration(
                      batch.startedAt || batch.createdAt,
                      batch.completedAt
                    )

                    const borderAccent = getStatusBorderColor(batch.status, batch.completedAt)

                    return (
                      <tr
                        key={batch.id}
                        onClick={() => navigate(`/company/production/batches/${batch.id}`)}
                        className={`hover:bg-blue-50/30 transition-colors cursor-pointer group border-l-[3px] ${borderAccent}`}
                      >
                        {/* Batch Number & Shift */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-xs tabular-nums">
                              {batch.batchNumber || 'Batch'}
                            </span>
                            <span className="text-[11px] text-slate-500 font-normal">
                              {batch.shift || 'General Shift'}
                            </span>
                          </div>
                        </td>

                        {/* Product & Line */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                            <span className="font-semibold text-slate-800 truncate" title={batch.product}>
                              {batch.product || '—'}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              {lineDisplay}
                            </span>
                          </div>
                        </td>

                        {/* Operator */}
                        <td className="py-3.5 px-4 align-middle hidden sm:table-cell">
                          <div className="flex items-center gap-2 truncate">
                            <div className="w-6 h-6 rounded-full bg-blue-50 text-[10px] font-semibold text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
                              {getInitials(batch.operatorName)}
                            </div>
                            <span className="text-slate-700 truncate" title={batch.operatorName || 'Unassigned'}>
                              {batch.operatorName || 'Unassigned'}
                            </span>
                          </div>
                        </td>

                        {/* Output & Progress */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex flex-col gap-1.5 pr-2">
                            <div className="flex items-baseline justify-between text-xs leading-none">
                              <span className="font-mono font-bold text-slate-900 tabular-nums">
                                {produced.toLocaleString()}{' '}
                                <span className="font-normal text-slate-500">
                                  / {hasTarget ? target.toLocaleString() : '—'}
                                </span>
                              </span>
                              {hasTarget && (
                                <span
                                  className={`text-[11px] font-mono tabular-nums font-semibold ${
                                    isOverTarget ? 'text-amber-600' : 'text-slate-500'
                                  }`}
                                >
                                  {isOverTarget ? `+${(produced - target).toLocaleString()} over` : `${pct}%`}
                                </span>
                              )}
                            </div>
                            {hasTarget && (
                              <div className="w-full">
                                <ProgressBar
                                  value={isOverTarget ? target : produced}
                                  max={target}
                                  color={isOverTarget ? 'bg-amber-500' : 'bg-blue-600'}
                                  height="h-1.5"
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Start Date */}
                        <td className="py-3.5 px-4 align-middle hidden md:table-cell text-slate-600 font-mono text-[11px] tabular-nums">
                          {formatBatchDate(batch.startedAt || batch.createdAt)}
                        </td>

                        {/* Duration */}
                        <td className="py-3.5 px-4 align-middle hidden lg:table-cell tabular-nums">
                          {isRunning ? (
                            <span
                              className={`font-mono text-xs flex items-center gap-1 ${
                                isLongRun ? 'text-amber-600 font-medium' : 'text-slate-700'
                              }`}
                              title={isLongRun ? 'Running for over 30 days' : 'Active elapsed time'}
                            >
                              <Clock className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                              {runDurationText}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-slate-500">
                              {runDurationText !== '—' ? runDurationText : 'Finished'}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 align-middle">
                          <StatusBadge status={statusRaw} />
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 align-middle text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => navigate(`/company/production/batches/${batch.id}`)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="View batch details"
                              aria-label="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {!isOwnerRole && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleEditClick(batch, e)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                                  title="Edit batch"
                                  aria-label="Edit batch"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteClick(batch, e)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Delete batch"
                                  aria-label="Delete batch"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ── GRID / CARD VIEW (Compact 135-155px Cards) ──────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
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
                batch.productionLine?.name ||
                (batch.productionLineCode ? `Line ${batch.productionLineCode}` : 'Line —')

              const produced = Number(batch.producedQuantity || 0)
              const target = Number(batch.targetQuantity || 0)
              const hasTarget = target > 0
              const isOverTarget = hasTarget && produced > target
              const pct = hasTarget ? Math.min(100, Math.round((produced / target) * 100)) : 0

              const { text: runDurationText, isLongRun } = formatRunningDuration(
                batch.startedAt || batch.createdAt,
                batch.completedAt
              )

              const borderAccent = getStatusBorderColor(batch.status, batch.completedAt)

              return (
                <div
                  key={batch.id}
                  onClick={() => navigate(`/company/production/batches/${batch.id}`)}
                  className={`bg-white border border-slate-200 border-l-[3px] ${borderAccent} rounded-xl px-3 py-2.5 flex flex-col justify-between gap-1.5 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group select-none min-h-[135px] max-h-[155px]`}
                >
                  {/* Top Row: Batch Number, Shift & Status Badge */}
                  <div className="flex items-center justify-between gap-1.5 leading-none">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold text-xs text-slate-900 group-hover:text-blue-600 transition-colors tabular-nums truncate">
                        {batch.batchNumber || 'Batch'}
                      </span>
                      {batch.shift && (
                        <span className="text-[10px] text-slate-500 font-medium px-1.5 py-0.5 bg-slate-100 rounded text-nowrap truncate max-w-[75px]">
                          {batch.shift}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={statusRaw} className="text-[10px] px-1.5 py-0.5 shrink-0" />
                  </div>

                  {/* Compact Product & Production Line Row */}
                  <div className="flex items-center justify-between gap-1 text-[11px] leading-tight min-w-0">
                    <span className="font-semibold text-slate-800 truncate" title={batch.product}>
                      {batch.product || 'Product —'}
                    </span>
                    <span className="text-slate-500 truncate shrink-0 max-w-[95px] text-right" title={lineDisplay}>
                      {lineDisplay}
                    </span>
                  </div>

                  {/* Operator Info Row */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 leading-none">
                    <div className="w-4 h-4 rounded-full bg-blue-50 text-[9px] font-semibold text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
                      {getInitials(batch.operatorName)}
                    </div>
                    <span className="truncate" title={batch.operatorName || 'Unassigned'}>
                      {batch.operatorName || 'Unassigned'}
                    </span>
                  </div>

                  {/* Output & Target Quantity + Thin Progress Bar */}
                  <div className="flex flex-col gap-1 leading-none">
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {produced.toLocaleString()}{' '}
                        <span className="font-normal text-slate-500">
                          / {hasTarget ? target.toLocaleString() : '—'}
                        </span>
                      </span>
                      {hasTarget && (
                        <span
                          className={`font-mono text-[10px] tabular-nums font-semibold ${
                            isOverTarget ? 'text-amber-600' : 'text-slate-500'
                          }`}
                        >
                          {isOverTarget ? `+${(produced - target).toLocaleString()} over` : `${pct}%`}
                        </span>
                      )}
                    </div>
                    {hasTarget && (
                      <ProgressBar
                        value={isOverTarget ? target : produced}
                        max={target}
                        color={isOverTarget ? 'bg-amber-500' : 'bg-blue-600'}
                        height="h-1"
                      />
                    )}
                  </div>

                  {/* Bottom Row: Start Date, Elapsed Duration & Action Icons */}
                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 leading-none">
                    <div className="flex items-center gap-1 font-mono tabular-nums truncate text-slate-500">
                      <span>{formatBatchDate(batch.startedAt || batch.createdAt)}</span>
                      {isRunning && (
                        <span
                          className={`flex items-center gap-0.5 truncate ${
                            isLongRun ? 'text-amber-600 font-medium' : 'text-slate-600'
                          }`}
                        >
                          <span>·</span>
                          <Clock className="w-2.5 h-2.5 text-emerald-500 animate-pulse shrink-0" />
                          <span>{runDurationText}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(`/company/production/batches/${batch.id}`)}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="View details"
                        aria-label="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {!isOwnerRole && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleEditClick(batch, e)}
                            className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Edit batch"
                            aria-label="Edit batch"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(batch, e)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete batch"
                            aria-label="Delete batch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section E: Page Footer & Pagination ─────────────────────────────── */}
      {filteredBatches.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Showing <strong className="font-mono text-slate-900">{startRecord}</strong> to{' '}
              <strong className="font-mono text-slate-900">{endRecord}</strong> of{' '}
              <strong className="font-mono text-slate-900">{filteredBatches.length}</strong> records
            </span>

            <span className="text-slate-300">|</span>

            <div className="flex items-center gap-1.5">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="h-7 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 cursor-pointer focus:outline-none focus:border-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>per page</span>
            </div>
          </div>

          {/* Page Selector */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-1 px-1">
              <span className="text-xs font-medium text-slate-600 font-mono">
                Page <strong className="text-slate-900">{currentPage}</strong> of{' '}
                <strong className="text-slate-900">{pageCount}</strong>
              </span>
            </div>

            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <EditBatchModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingBatch(null)
        }}
        batch={editingBatch}
        productionLines={productionLines}
        catalogProducts={catalogProducts}
        onSuccess={onRefresh}
      />

      <DeleteBatchConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setDeletingBatch(null)
        }}
        batch={deletingBatch}
        onSuccess={onRefresh}
      />
    </div>
  )
}

export default ProductionBatchesView
