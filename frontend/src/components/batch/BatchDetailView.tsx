import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Square,
  Plus,
  Play,
  Calendar,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Box,
  User,
  Clock,
  Package
} from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { MaterialTile } from './MaterialTile'
import { Pagination } from './Pagination'
import {
  formatRunningDuration,
  formatBatchDate,
  formatBatchTime
} from './batchUtils'

export interface BatchDetailViewProps {
  batchMeta: any
  summaryData: any
  entries: any[]
  entriesLoading?: boolean
  entriesError?: string | null
  onRetryEntries?: () => void
  batchIssues?: any[]
  canWrite: boolean
  isCompleted: boolean
  isPaused: boolean
  onStopBatchClick: () => void
  onAddEntryClick: () => void
}

export const BatchDetailView: React.FC<BatchDetailViewProps> = ({
  batchMeta,
  summaryData,
  entries = [],
  entriesLoading = false,
  entriesError = null,
  onRetryEntries,
  batchIssues = [],
  canWrite,
  isCompleted,
  isPaused,
  onStopBatchClick,
  onAddEntryClick
}) => {
  const navigate = useNavigate()

  // ── Pagination States ────────────────────────────────────────────────────────
  const [entriesPage, setEntriesPage] = useState(1)
  const [activityPage, setActivityPage] = useState(1)
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const entriesPageSize = 5
  const activityPageSize = 6

  // ── Derived Production Metrics ───────────────────────────────────────────────
  const producedQty = Number(summaryData?.casesProduced ?? batchMeta?.producedQuantity ?? 0)
  const targetQty = Number(batchMeta?.targetQuantity) || 0
  const hasTarget = targetQty > 0
  const isOverTarget = hasTarget && producedQty > targetQty
  const overQty = isOverTarget ? producedQty - targetQty : 0
  const remainingQty = hasTarget ? Math.max(0, targetQty - producedQty) : 0
  const pctComplete = hasTarget ? Math.round((producedQty / targetQty) * 100) : 0
  const cappedProgress = hasTarget ? Math.min(100, Math.max(0, (producedQty / targetQty) * 100)) : 0

  const runningDuration = useMemo(() => {
    return formatRunningDuration(
      batchMeta?.startedAt || batchMeta?.createdAt,
      isCompleted ? (batchMeta?.completedAt || summaryData?.endedAt) : null
    )
  }, [batchMeta, isCompleted, summaryData])

  const lineDisplay =
    batchMeta?.productionLineName ||
    batchMeta?.lineName ||
    batchMeta?.productionLine?.name ||
    'Line 1'

  // ── Material Consumption ─────────────────────────────────────────────────────
  const usedMaterialsList = useMemo(() => {
    const matMap = new Map<string, { rawMaterialId?: string; name: string; unit: string; used: number; waste: number }>()

    entries.forEach((e: any) => {
      if (Array.isArray(e.materials) && e.materials.length > 0) {
        e.materials.forEach((m: any, mIndex: number) => {
          const key = (m.rawMaterialId || m.materialName || m.rawMaterialName || `mat-${mIndex}`).toString().trim()
          const displayName = m.materialName || m.rawMaterialName || (m.category ? `${m.category}` : 'Material')
          const existing = matMap.get(key) || {
            rawMaterialId: m.rawMaterialId,
            name: displayName,
            unit: m.unit || '',
            used: 0,
            waste: 0
          }
          if (existing.name === 'Material' && displayName !== 'Material') {
            existing.name = displayName
          }
          if (!existing.unit && m.unit) {
            existing.unit = m.unit
          }
          existing.used += Number(m.usageQuantity) || 0
          existing.waste += Number(m.wastageQuantity) || 0
          matMap.set(key, existing)
        })
      } else {
        const legacy = [
          { rawMaterialId: e.preformMaterialId, name: e.preformName || 'Preform', used: Number(e.preformUsage) || 0, waste: Number(e.preformWastage) || 0, unit: e.preformUnit || '' },
          { rawMaterialId: e.bottleMaterialId, name: e.bottleName || 'Bottle', used: Number(e.bottleUsage) || 0, waste: Number(e.bottleWastage) || 0, unit: e.bottleUnit || '' },
          { rawMaterialId: e.capMaterialId, name: e.capName || 'Cap', used: Number(e.capUsage) || 0, waste: Number(e.capWastage) || 0, unit: e.capUnit || '' },
          { rawMaterialId: e.labelMaterialId, name: e.labelName || 'Label', used: Number(e.labelUsage) || 0, waste: Number(e.labelWastage) || 0, unit: e.labelUnit || '' },
          { rawMaterialId: e.shrinkMaterialId, name: e.shrinkName || 'Shrink Film', used: Number(e.shrinkUsage) || 0, waste: Number(e.shrinkWastage) || 0, unit: e.shrinkUnit || '' },
          { rawMaterialId: e.glueMaterialId, name: e.glueName || 'Glue', used: Number(e.glueUsage) || 0, waste: Number(e.glueWastage) || 0, unit: e.glueUnit || '' },
        ]
        legacy.forEach((m) => {
          if (m.used > 0 || m.waste > 0) {
            const key = (m.rawMaterialId || m.name).toString().trim()
            const existing = matMap.get(key) || { rawMaterialId: m.rawMaterialId, name: m.name, unit: m.unit, used: 0, waste: 0 }
            if (!existing.unit && m.unit) existing.unit = m.unit
            existing.used += m.used
            existing.waste += m.waste
            matMap.set(key, existing)
          }
        })
      }
    })

    if (matMap.size === 0 && summaryData) {
      if (Array.isArray(summaryData.inventorySummary) && summaryData.inventorySummary.length > 0) {
        summaryData.inventorySummary.forEach((it: any) => {
          const key = (it.materialId || it.materialName || 'mat').toString().trim()
          matMap.set(key, {
            rawMaterialId: it.materialId,
            name: it.materialName || 'Material',
            unit: it.unit || '',
            used: Number(it.consumed) || 0,
            waste: Number(it.waste) || 0
          })
        })
      }
    }

    return Array.from(matMap.values())
  }, [entries, summaryData])

  // ── Helper to Extract Materials from an Entry ────────────────────────────────
  const getEntryMaterials = (entry: any): {
    usedMaterials: Array<{ rawMaterialId?: string; name: string; used: number; waste: number; unit: string; total: number }>
    notUsedMaterials: string[]
  } => {
    if (!entry) return { usedMaterials: [], notUsedMaterials: [] }
    if (Array.isArray(entry.materials) && entry.materials.length > 0) {
      const used = entry.materials
        .filter((m: any) => Number(m.usageQuantity) > 0 || Number(m.wastageQuantity) > 0)
        .map((m: any, mIdx: number) => ({
          rawMaterialId: m.rawMaterialId,
          name: m.materialName || m.rawMaterialName || (m.category ? `${m.category}` : `Material #${mIdx + 1}`),
          used: Number(m.usageQuantity) || 0,
          waste: Number(m.wastageQuantity) || 0,
          unit: m.unit || '',
          total: Number(m.totalConsumption) || ((Number(m.usageQuantity) || 0) + (Number(m.wastageQuantity) || 0))
        }))
      return { usedMaterials: used, notUsedMaterials: [] }
    }
    const all = [
      {
        rawMaterialId: entry.preformMaterialId,
        name: entry.preformName || 'Preform',
        used: Number(entry.preformUsage) || 0,
        waste: Number(entry.preformWastage) || 0,
        unit: entry.preformUnit || ''
      },
      {
        rawMaterialId: entry.bottleMaterialId,
        name: entry.bottleName || 'Bottle',
        used: Number(entry.bottleUsage) || 0,
        waste: Number(entry.bottleWastage) || 0,
        unit: entry.bottleUnit || ''
      },
      {
        rawMaterialId: entry.capMaterialId,
        name: entry.capName || 'Cap',
        used: Number(entry.capUsage) || 0,
        waste: Number(entry.capWastage) || 0,
        unit: entry.capUnit || ''
      },
      {
        rawMaterialId: entry.labelMaterialId,
        name: entry.labelName || 'Label',
        used: Number(entry.labelUsage) || 0,
        waste: Number(entry.labelWastage) || 0,
        unit: entry.labelUnit || ''
      },
      {
        rawMaterialId: entry.shrinkMaterialId,
        name: entry.shrinkName || 'Shrink Film',
        used: Number(entry.shrinkUsage) || 0,
        waste: Number(entry.shrinkWastage) || 0,
        unit: entry.shrinkUnit || ''
      },
      {
        rawMaterialId: entry.glueMaterialId,
        name: entry.glueName || 'Glue',
        used: Number(entry.glueUsage) || 0,
        waste: Number(entry.glueWastage) || 0,
        unit: entry.glueUnit || ''
      }
    ]
    const used = all.filter((m) => m.used > 0 || m.waste > 0).map((m) => ({ ...m, total: m.used + m.waste }))
    const notUsed = all.filter((m) => m.used === 0 && m.waste === 0).map((m) => m.name)
    return { usedMaterials: used, notUsedMaterials: notUsed }
  }

  // ── Paginated Entries ────────────────────────────────────────────────────────
  const entriesTotalPages = Math.max(1, Math.ceil(entries.length / entriesPageSize))

  useEffect(() => {
    if (entriesPage > entriesTotalPages) {
      setEntriesPage(entriesTotalPages)
    }
  }, [entriesPage, entriesTotalPages])

  const currentEntries = useMemo(() => {
    const start = (entriesPage - 1) * entriesPageSize
    return entries.slice(start, start + entriesPageSize)
  }, [entries, entriesPage, entriesPageSize])

  // ── Activity Events ─────────────────────────────────────────────────────────
  const activityEvents = useMemo(() => {
    const events: Array<{ id: string; text: string; time: string | Date; type: 'start' | 'op' | 'entry' | 'complete' }> = []

    if (batchMeta?.startedAt) {
      events.push({
        id: 'start',
        text: `Batch initialized for ${batchMeta.product || 'production'}`,
        time: batchMeta.startedAt,
        type: 'start'
      })
      if (batchMeta.operatorName) {
        events.push({
          id: 'op',
          text: `Assigned operator: ${batchMeta.operatorName} (${batchMeta.shift || 'Morning'} shift)`,
          time: batchMeta.startedAt,
          type: 'op'
        })
      }
    }

    entries.forEach((e, i) => {
      events.push({
        id: `entry-${e.id || i}`,
        text: `Production entry #${entries.length - i} logged (+${(e.casesProduced || 0).toLocaleString()} cases)`,
        time: e.createdAt,
        type: 'entry'
      })
    })

    if (isCompleted) {
      events.push({
        id: 'completed',
        text: `Batch completed with ${producedQty.toLocaleString()} cases`,
        time: batchMeta?.completedAt || summaryData?.endedAt || new Date(),
        type: 'complete'
      })
    }

    return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }, [batchMeta, entries, isCompleted, producedQty, summaryData])

  const activityTotalPages = Math.max(1, Math.ceil(activityEvents.length / activityPageSize))

  useEffect(() => {
    if (activityPage > activityTotalPages) {
      setActivityPage(activityTotalPages)
    }
  }, [activityPage, activityTotalPages])

  const currentActivities = useMemo(() => {
    const start = (activityPage - 1) * activityPageSize
    return activityEvents.slice(start, start + activityPageSize)
  }, [activityEvents, activityPage, activityPageSize])

  const statusRaw = batchMeta?.status || (isCompleted ? 'Completed' : 'Running')

  return (
    <div className="w-full flex flex-col gap-4 pb-12">
      
      {/* ── 1. COMPACT PAGE HEADER ─────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/company/production')}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            title="Back to Production Batches"
            aria-label="Back to Production Batches"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <h1 className="font-mono font-bold text-lg text-slate-900 tabular-nums">
              {batchMeta?.batchNumber || 'Batch'}
            </h1>
            <StatusBadge status={statusRaw} />
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="text-slate-300">•</span>
            <span className="text-slate-700 font-semibold">{batchMeta?.product || 'Product'}</span>
            <span className="text-slate-300">•</span>
            <span>{lineDisplay}</span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {batchMeta?.operatorName || 'Operator'}
            </span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {canWrite && !isCompleted && (
            <button
              type="button"
              onClick={onAddEntryClick}
              className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold cursor-pointer transition-all shadow-xs flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Entry</span>
            </button>
          )}

          {canWrite && !isCompleted && !isPaused && (
            <button
              type="button"
              onClick={onStopBatchClick}
              className="h-8 px-3 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Batch</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. PRODUCTION SUMMARY SECTION ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        
        {/* Production Output Card (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Production Output
            </span>
            {hasTarget && (
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                isOverTarget ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {pctComplete}% Target
              </span>
            )}
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-slate-900 tabular-nums tracking-tight">
                {producedQty.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                / {hasTarget ? `${targetQty.toLocaleString()} cases` : 'cases produced'}
              </span>
            </div>

            <div className="mt-1.5 text-xs">
              {isOverTarget ? (
                <span className="text-emerald-700 font-semibold font-mono">
                  +{overQty.toLocaleString()} cases over target
                </span>
              ) : hasTarget ? (
                <span className="text-slate-600 font-medium font-mono">
                  {remainingQty.toLocaleString()} cases remaining
                </span>
              ) : (
                <span className="text-slate-400">Continuous production run</span>
              )}
            </div>
          </div>

          {/* Slim progress bar */}
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isOverTarget ? 'bg-emerald-500' : 'bg-blue-600'}`}
                style={{ width: `${hasTarget ? cappedProgress : (producedQty > 0 ? 100 : 0)}%` }}
                role="progressbar"
                aria-valuenow={producedQty}
                aria-valuemin={0}
                aria-valuemax={targetQty || 100}
              />
            </div>
          </div>
        </div>

        {/* Operational Summary 4 Cards (7 cols on lg) */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Card 1: Status & Duration */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">Duration</span>
              <div className="p-1 rounded bg-blue-50 text-blue-600">
                <Play className="w-3.5 h-3.5 fill-current" />
              </div>
            </div>
            <div className="font-mono font-bold text-slate-900 text-sm tabular-nums truncate">
              {runningDuration.text}
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              {isCompleted ? 'Completed run' : 'Live duration'}
            </div>
          </div>

          {/* Card 2: Shift & Started */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">Shift</span>
              <div className="p-1 rounded bg-slate-100 text-slate-600">
                <Calendar className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="font-bold text-slate-900 text-sm truncate">
              {batchMeta?.shift || 'Morning'}
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              {batchMeta?.startedAt ? `Started ${formatBatchTime(batchMeta.startedAt)}` : 'Active'}
            </div>
          </div>

          {/* Card 3: Production Entries */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">Entries</span>
              <div className="p-1 rounded bg-indigo-50 text-indigo-600">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="font-mono font-bold text-slate-900 text-sm tabular-nums">
              {entries.length}
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              {entries.length === 1 ? '1 record logged' : `${entries.length} records logged`}
            </div>
          </div>

          {/* Card 4: Operational Issues */}
          <div
            onClick={() => {
              if (batchIssues.length > 0 && batchMeta?.batchNumber) {
                navigate(`/company/operations-issues?batch=${batchMeta.batchNumber}`)
              }
            }}
            className={`bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col justify-between ${
              batchIssues.length > 0 ? 'cursor-pointer hover:border-red-300' : ''
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">Issues</span>
              <div className={`p-1 rounded ${batchIssues.length === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {batchIssues.length === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              </div>
            </div>
            <div className="font-mono font-bold text-slate-900 text-sm tabular-nums">
              {batchIssues.length}
            </div>
            <div className={`text-[11px] truncate mt-0.5 ${batchIssues.length === 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-semibold'}`}>
              {batchIssues.length === 0 ? 'All clear' : 'View issues'}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. MATERIAL CONSUMPTION SECTION ───────────────────────────────── */}
      {usedMaterialsList.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
            Material Consumption
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {usedMaterialsList.map((mat, idx) => (
              <MaterialTile
                key={`${mat.rawMaterialId || mat.name || 'mat'}-${mat.unit || ''}-${idx}`}
                name={mat.name}
                used={mat.used}
                waste={mat.waste}
                unit={mat.unit}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-xs flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-700">No material consumption recorded for this batch yet.</span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">Raw materials update automatically when logged with entries.</span>
        </div>
      )}

      {/* ── 4. PRODUCTION ENTRIES & ACTIVITY GRID (2 COLUMNS ON DESKTOP) ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Production Entries Table (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                Production Entries
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-mono font-bold text-slate-600 tabular-nums">
                {entries.length}
              </span>
            </div>

            {canWrite && !isCompleted && (
              <button
                type="button"
                onClick={onAddEntryClick}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Entry</span>
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-[180px]">
            {entriesLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span>Loading production entries...</span>
              </div>
            ) : entriesError ? (
              <div className="py-10 px-4 flex flex-col items-center justify-center text-center">
                <AlertTriangle className="w-7 h-7 text-red-500 mb-2" />
                <p className="text-xs font-semibold text-slate-800">Failed to load production entries</p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm">{entriesError}</p>
                {onRetryEntries && (
                  <button
                    onClick={onRetryEntries}
                    className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retry
                  </button>
                )}
              </div>
            ) : entries.length === 0 ? (
              <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                <Layers className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-700">No production entries recorded for this batch</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                  Click "Add Entry" above to record output cases and raw material usage.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {currentEntries.map((item, idx) => {
                  const entryIndex = (entriesPage - 1) * entriesPageSize + idx + 1
                  const isExpanded = expandedEntryId === (item.id || item)
                  const { usedMaterials, notUsedMaterials } = getEntryMaterials(item)

                  return (
                    <div key={item.id || idx} className="flex flex-col">
                      <div
                        onClick={() => setExpandedEntryId(isExpanded ? null : (item.id || item))}
                        className={`px-4 py-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50/50' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono font-bold text-xs text-blue-600 tabular-nums shrink-0">
                            #{entryIndex}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono font-semibold text-slate-900 tabular-nums">
                              {formatBatchDate(item.createdAt)}, {formatBatchTime(item.createdAt)}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 flex-wrap">
                              <span>By {item.operatorName || 'Operator'} • {item.shift || 'Morning'}</span>
                              {usedMaterials.length > 0 && (
                                <span className="text-slate-600 font-medium bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {usedMaterials.length} {usedMaterials.length === 1 ? 'material' : 'materials'} logged
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-mono font-bold text-emerald-600 text-sm tabular-nums block">
                              +{Number(item.casesProduced || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">cases</span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Material Breakdown */}
                      {isExpanded && (
                        <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 text-xs">
                          <div className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider mb-2">
                            Entry Material Breakdown
                          </div>
                          {usedMaterials.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {usedMaterials.map((mat: any, mIdx: number) => (
                                <div key={`${mat.rawMaterialId || mat.name || 'mat'}-${mat.unit || ''}-${mIdx}`} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-semibold text-slate-800 text-xs truncate block">{mat.name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                      Total: {(mat.total ?? (mat.used + mat.waste)).toLocaleString()} {mat.unit}
                                    </span>
                                  </div>
                                  <div className="text-slate-900 font-mono font-bold mt-1 text-xs">
                                    Used: {mat.used.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{mat.unit}</span>
                                  </div>
                                  {mat.waste > 0 && (
                                    <div className="text-red-600 font-mono text-[11px] mt-0.5 font-medium">
                                      Waste: {mat.waste.toLocaleString()} {mat.unit}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400 text-xs italic">
                              No raw material consumption recorded with this entry.
                            </div>
                          )}
                          {notUsedMaterials.length > 0 && usedMaterials.length > 0 && (
                            <div className="text-[11px] text-slate-400 mt-2">
                              Unused in this entry: {notUsedMaterials.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          {entries.length > entriesPageSize && (
            <div className="p-3 border-t border-slate-100">
              <Pagination
                page={entriesPage}
                pageCount={entriesTotalPages}
                onChange={setEntriesPage}
                total={entries.length}
                pageSize={entriesPageSize}
              />
            </div>
          )}
        </div>

        {/* Right Column: Activity Panel (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-900 text-xs sm:text-sm">
              Batch Activity & Audit
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-mono font-bold text-slate-600 tabular-nums">
              {activityEvents.length} events
            </span>
          </div>

          <div className="p-4 flex-1">
            {activityEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No activity recorded yet.
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {currentActivities.map((ev) => (
                  <div key={ev.id} className="relative flex flex-col text-xs">
                    {/* Circle marker */}
                    <div className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full border-2 border-white shadow-xs ${
                      ev.type === 'start' ? 'bg-blue-600' :
                      ev.type === 'complete' ? 'bg-slate-800' :
                      ev.type === 'op' ? 'bg-indigo-600' : 'bg-emerald-500'
                    }`} />
                    
                    <span className="text-slate-800 font-medium leading-tight">{ev.text}</span>
                    <span className="text-[11px] text-slate-400 font-mono mt-0.5 tabular-nums">
                      {formatBatchDate(ev.time)}, {formatBatchTime(ev.time)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Pagination Footer */}
          {activityEvents.length > activityPageSize && (
            <div className="p-3 border-t border-slate-100">
              <Pagination
                page={activityPage}
                pageCount={activityTotalPages}
                onChange={setActivityPage}
                total={activityEvents.length}
                pageSize={activityPageSize}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
