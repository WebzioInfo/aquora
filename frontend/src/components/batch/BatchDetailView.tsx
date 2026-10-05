import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Square,
  Plus,
  Play,
  Calendar,
  Layers,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import { Tile } from './Tile'
import { TileLabel } from './TileLabel'
import { StatTile } from './StatTile'
import { StatusBadge } from './StatusBadge'
import { CircularProgress } from './CircularProgress'
import { MaterialTile } from './MaterialTile'
import { usePageSize } from './usePageSize'
import {
  formatRunningDuration,
  formatBatchDate,
  formatBatchTime
} from './batchUtils'

export interface BatchDetailViewProps {
  batchMeta: any
  summaryData: any
  entries: any[]
  batchIssues: any[]
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
  batchIssues = [],
  canWrite,
  isCompleted,
  isPaused,
  onStopBatchClick,
  onAddEntryClick
}) => {
  const navigate = useNavigate()

  // ── Pagination & Expansion States for Zone 3 ─────────────────────────────────
  const [entriesPage, setEntriesPage] = useState(1)
  const [activityPage, setActivityPage] = useState(1)
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)

  // ── Derived Quantities ───────────────────────────────────────────────────────
  const producedQty = Number(summaryData?.casesProduced ?? batchMeta?.producedQuantity ?? 0)
  const targetQty = Number(batchMeta?.targetQuantity) || 0
  const hasTarget = targetQty > 0
  const isOverTarget = hasTarget && producedQty > targetQty
  const overQty = isOverTarget ? producedQty - targetQty : 0
  const remainingQty = hasTarget ? Math.max(0, targetQty - producedQty) : 0
  const pctComplete = hasTarget ? Math.min(100, Math.round((producedQty / targetQty) * 100)) : 0

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
    'Line —'

  // ── Zone 2 Materials Partitioning ────────────────────────────────────────────
  const { usedMaterialsList, unusedMaterialsList } = useMemo(() => {
    const raw = [
      {
        name: 'Preform',
        used: summaryData?.preformUsed ?? 0,
        waste: summaryData?.preformWaste ?? 0,
        unit: 'Bags'
      },
      {
        name: 'Cap',
        used: summaryData?.capUsed ?? 0,
        waste: summaryData?.capWaste ?? 0,
        unit: 'Boxes'
      },
      {
        name: 'Label',
        used: summaryData?.labelUsed ?? 0,
        waste: summaryData?.labelWaste ?? 0,
        unit: 'KG'
      },
      {
        name: 'Shrink',
        used: summaryData?.shrinkUsed ?? 0,
        waste: summaryData?.shrinkWaste ?? 0,
        unit: 'KG'
      },
      {
        name: 'Glue',
        used: summaryData?.glueUsed ?? 0,
        waste: summaryData?.glueWaste ?? 0,
        unit: 'KG'
      },
      {
        name: 'Ink / jet',
        used: summaryData?.inkUsed ? 'Active' : 0,
        waste: summaryData?.makeupUsed ? 'Active' : 0,
        unit: ''
      }
    ]

    const used = raw.filter((m) => {
      const u = typeof m.used === 'number' ? m.used > 0 : Boolean(m.used)
      const w = typeof m.waste === 'number' ? m.waste > 0 : Boolean(m.waste)
      return u || w
    })

    const unused = raw.filter((m) => !used.some((u) => u.name === m.name))

    return { usedMaterialsList: used, unusedMaterialsList: unused }
  }, [summaryData])

  // Display max 3 used materials + 1 "Not used" tile in grid-cols-4
  const displayUsedMaterials = usedMaterialsList.slice(0, 3)
  const remainingUnused = [
    ...usedMaterialsList.slice(3).map((m) => m.name),
    ...unusedMaterialsList.map((m) => m.name)
  ]

  // ── Helper to Extract Materials from an Individual Entry ─────────────────────
  const getEntryMaterials = (entry: any) => {
    if (!entry) return { usedMaterials: [], notUsedMaterials: [] }
    const all = [
      {
        name: 'Preform',
        used: Number(entry.preformUsage) || 0,
        waste: Number(entry.preformWastage) || 0,
        unit: entry.preformUnit || 'Bags'
      },
      {
        name: 'Cap',
        used: Number(entry.capUsage) || 0,
        waste: Number(entry.capWastage) || 0,
        unit: entry.capUnit || 'Boxes'
      },
      {
        name: 'Label',
        used: Number(entry.labelUsage) || 0,
        waste: Number(entry.labelWastage) || 0,
        unit: entry.labelUnit || 'KG'
      },
      {
        name: 'Shrink',
        used: Number(entry.shrinkUsage) || 0,
        waste: Number(entry.shrinkWastage) || 0,
        unit: entry.shrinkUnit || 'KG'
      },
      {
        name: 'Glue',
        used: Number(entry.glueUsage) || 0,
        waste: Number(entry.glueWastage) || 0,
        unit: entry.glueUnit || 'KG'
      }
    ]
    const usedMaterials = all.filter((m) => m.used > 0 || m.waste > 0)
    const notUsedMaterials = all.filter((m) => m.used === 0 && m.waste === 0).map((m) => m.name)
    return { usedMaterials, notUsedMaterials }
  }

  // ── Zone 3 Dynamic Row Heights (40px rows, 4px gap) ─────────────────────────
  const entriesContainerRef = useRef<HTMLDivElement>(null)
  const activityContainerRef = useRef<HTMLDivElement>(null)

  const { pageSize: rawEntriesPageSize } = usePageSize(entriesContainerRef, {
    itemHeight: 40,
    gap: 4,
    isSingleColumn: true
  })

  const { pageSize: rawActivityPageSize } = usePageSize(activityContainerRef, {
    itemHeight: 40,
    gap: 4,
    isSingleColumn: true
  })

  const expandedEntry = useMemo(() => {
    if (!expandedEntryId) return null
    return entries.find((e) => (e.id || e) === expandedEntryId) || null
  }, [entries, expandedEntryId])

  // Calculate slots consumed by the expanded table:
  // 28px header + (usedCount * 34px) + (hasNotUsed ? 26px footer : 0) + 2px border
  // Each entry row slot is 40px row + 4px gap = 44px
  const expandedSlots = useMemo(() => {
    if (!expandedEntry) return 0
    const { usedMaterials, notUsedMaterials } = getEntryMaterials(expandedEntry)
    const tableHeight = 28 + (usedMaterials.length * 34) + (notUsedMaterials.length > 0 ? 26 : 0) + 2
    return Math.max(1, Math.ceil((tableHeight + 4) / 44))
  }, [expandedEntry])

  // Check if expanded entry is on current page
  const hasExpandedOnPage = useMemo(() => {
    if (!expandedEntryId) return false
    const idx = entries.findIndex((e) => (e.id || e) === expandedEntryId)
    if (idx === -1) return false
    const targetPageSize = Math.max(1, rawEntriesPageSize - expandedSlots)
    const start = (entriesPage - 1) * targetPageSize
    const end = start + targetPageSize
    return idx >= start && idx < end
  }, [entries, expandedEntryId, entriesPage, rawEntriesPageSize, expandedSlots])

  // When an entry is expanded on this page, reserve row slots for the compact table
  const entriesPageSize = hasExpandedOnPage
    ? Math.max(1, rawEntriesPageSize - expandedSlots)
    : Math.max(1, rawEntriesPageSize)

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
    const events: Array<{ id: string; text: string; time: string | Date }> = []

    if (batchMeta?.startedAt) {
      events.push({
        id: 'start',
        text: `Batch initialized for ${batchMeta.product || 'production'}`,
        time: batchMeta.startedAt
      })
      if (batchMeta.operatorName) {
        events.push({
          id: 'op',
          text: `Assigned operator: ${batchMeta.operatorName} (${batchMeta.shift || 'Morning'} shift)`,
          time: batchMeta.startedAt
        })
      }
    }

    entries.forEach((e, i) => {
      events.push({
        id: `entry-${e.id || i}`,
        text: `Production entry #${entries.length - i} logged (+${e.casesProduced || 0} cases)`,
        time: e.createdAt
      })
    })

    if (isCompleted) {
      events.push({
        id: 'completed',
        text: `Batch completed with ${producedQty.toLocaleString()} cases`,
        time: batchMeta?.completedAt || summaryData?.endedAt || new Date()
      })
    }

    return events
  }, [batchMeta, entries, isCompleted, producedQty, summaryData])

  const activityPageSize = Math.max(1, rawActivityPageSize)
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
    <div className="w-full flex flex-col gap-2 min-h-0 lg:h-[calc(100vh-112px)] lg:max-h-[calc(100vh-112px)] lg:overflow-hidden select-none">
      
      {/* ── HEADER (fixed 48px / h-12) ───────────────────────────────────────── */}
      <div className="h-12 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/company/production')}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            title="Back to Production batches"
            aria-label="Back to Production batches"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <span className="font-mono font-bold text-base text-slate-900 shrink-0 tabular-nums">
            {batchMeta?.batchNumber || 'Batch'}
          </span>

          <StatusBadge status={statusRaw} />

          <span className="text-xs text-slate-500 truncate hidden sm:inline">
            {batchMeta?.product || 'Product —'} · {lineDisplay} · {batchMeta?.operatorName || 'Operator'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canWrite && !isCompleted && (
            <button
              type="button"
              onClick={onAddEntryClick}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add entry</span>
            </button>
          )}

          {canWrite && !isCompleted && !isPaused && (
            <button
              type="button"
              onClick={onStopBatchClick}
              className="h-8 px-3 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop batch</span>
            </button>
          )}
        </div>
      </div>

      {/* ── ZONE 1: Output Tile (128px) + 4 Small StatTiles (60px each in 2x2 grid) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        
        {/* Output Tile: Fixed 128px height, Circular progress ring on right, 30px number on left */}
        <Tile className="col-span-2 row-span-2 h-[128px] p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <TileLabel>Production output</TileLabel>
            {hasTarget && (
              <span className="text-xs text-slate-500 font-normal tabular-nums">
                Target: <span className="font-mono font-semibold">{targetQty.toLocaleString()}</span> cases
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 my-auto">
            {/* Left: 30px Output number & target status */}
            <div className="flex flex-col justify-center min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[30px] font-mono font-bold text-slate-900 leading-none tabular-nums tracking-tight">
                  {producedQty.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 font-normal leading-none">cases produced</span>
              </div>

              {hasTarget && (
                <div className="text-xs mt-2 text-slate-600 font-normal leading-none tabular-nums">
                  {isOverTarget ? (
                    <span className="text-amber-600 font-medium">
                      +<span className="font-mono font-semibold">{overQty.toLocaleString()}</span> over target
                    </span>
                  ) : (
                    <span><span className="font-mono font-semibold">{remainingQty.toLocaleString()}</span> left to target</span>
                  )}
                </div>
              )}
            </div>

            {/* Right: 56px circular progress ring */}
            <div className="shrink-0">
              <CircularProgress
                value={producedQty}
                max={hasTarget ? targetQty : 100}
                size={56}
                strokeWidth={5}
              />
            </div>
          </div>
        </Tile>

        {/* 4 Small StatTiles (fixed 60px height each, 2x2 grid beside Output tile) */}
        <StatTile
          label="Running"
          value={runningDuration.text}
          hint={runningDuration.isLongRun ? 'Long run' : isCompleted ? 'Completed' : 'Live run'}
          tone={runningDuration.isLongRun ? 'warn' : 'default'}
          height="h-[60px]"
          icon={<Play className="w-3.5 h-3.5 fill-current" />}
          iconBg="bg-blue-100 text-blue-600"
        />

        <StatTile
          label="Shift"
          value={batchMeta?.shift ? `${batchMeta.shift} shift` : 'Morning'}
          hint={batchMeta?.startedAt ? `Started ${formatBatchTime(batchMeta.startedAt)}` : 'Scheduled'}
          tone="default"
          height="h-[60px]"
          icon={<Calendar className="w-3.5 h-3.5" />}
          iconBg="bg-slate-100 text-slate-600"
        />

        <StatTile
          label="Entries"
          value={entries.length}
          hint={entries.length > 0 ? `Last ${formatBatchTime(entries[entries.length - 1].createdAt)}` : 'None logged'}
          tone="default"
          height="h-[60px]"
          icon={<Layers className="w-3.5 h-3.5" />}
          iconBg="bg-slate-100 text-slate-600"
        />

        <StatTile
          label="Issues"
          value={batchIssues.length}
          hint={batchIssues.length === 0 ? 'All clear' : 'Review issues'}
          tone={batchIssues.length === 0 ? 'ok' : 'bad'}
          height="h-[60px]"
          icon={batchIssues.length === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          iconBg={batchIssues.length === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}
          onClick={() => {
            if (batchIssues.length > 0 && batchMeta?.batchNumber) {
              navigate(`/company/operations-issues?batch=${batchMeta.batchNumber}`)
            }
          }}
        />
      </div>

      {/* ── ZONE 2: Material Tiles (fixed 72px / h-[72px], grid-cols-4) ──────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        {displayUsedMaterials.map((mat) => (
          <MaterialTile
            key={mat.name}
            name={mat.name}
            used={mat.used}
            waste={mat.waste}
            unit={mat.unit}
          />
        ))}

        {/* Dashed "Not used" Tile */}
        <div className="min-w-0 h-[72px] rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-2.5 flex flex-col justify-between select-none">
          <TileLabel>Not used</TileLabel>
          <div className="text-xs text-slate-500 font-medium my-auto leading-relaxed truncate">
            {remainingUnused.length > 0 ? remainingUnused.join(', ') : 'None'}
          </div>
          <div className="text-xs text-slate-400 leading-tight">Zero recorded consumption</div>
        </div>
      </div>

      {/* ── ZONE 3: Production Entries & Activity (flex-1 min-h-0 overflow-hidden) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 flex-1 min-h-0 overflow-hidden">
        
        {/* Left Column: Production Entries Tile */}
        <Tile className="flex flex-col h-full min-h-0 p-2.5 overflow-hidden">
          {/* Section header: 32px */}
          <div className="h-8 flex items-center justify-between px-1 border-b border-slate-100 shrink-0">
            <span className="text-xs font-semibold text-slate-800">Production entries</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-mono font-semibold text-slate-600 tabular-nums">
              {entries.length === 1 ? '1 entry' : `${entries.length} entries`}
            </span>
          </div>

          {/* Paginated rows area */}
          <div ref={entriesContainerRef} className="flex-1 min-h-0 py-1.5 flex flex-col gap-1 overflow-hidden">
            {entries.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 italic">
                No production entries recorded for this batch.
              </div>
            ) : (
              currentEntries.map((item, idx) => {
                const entryIndex = (entriesPage - 1) * entriesPageSize + idx + 1
                const isExpanded = expandedEntryId === (item.id || item)
                const { usedMaterials, notUsedMaterials } = getEntryMaterials(item)

                return (
                  <div key={item.id || idx} className="flex flex-col shrink-0">
                    {/* Fixed 40px entry row */}
                    <div
                      onClick={() => setExpandedEntryId(isExpanded ? null : (item.id || item))}
                      className={`h-[40px] px-2.5 ${
                        isExpanded
                          ? 'rounded-t-lg border-t border-x border-blue-200 bg-blue-50'
                          : 'rounded-lg border border-slate-100 bg-slate-50/60 hover:border-blue-300 hover:bg-blue-50/40'
                      } transition-colors cursor-pointer select-none flex items-center justify-between text-xs shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none`}
                      title={isExpanded ? 'Click to collapse breakdown' : 'Click to view material breakdown'}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setExpandedEntryId(isExpanded ? null : (item.id || item))
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-bold text-blue-600 tabular-nums shrink-0">
                          #{entryIndex}
                        </span>
                        <span className="text-slate-800 font-medium truncate font-mono text-xs tabular-nums">
                          {formatBatchDate(item.createdAt)}, {formatBatchTime(item.createdAt)}
                        </span>
                        <span className="text-slate-500 hidden sm:inline truncate">
                          · By {item.operatorName || 'Operator'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-emerald-600 tabular-nums text-xs">
                          +{item.casesProduced?.toLocaleString() || 0} cases
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Inline compact material breakdown table */}
                    {isExpanded && (
                      <div className="rounded-b-lg border-b border-x border-blue-200 bg-white overflow-hidden shrink-0 select-none">
                        {/* Header row (28px, text-xs text-slate-500, bottom border): Material | Used | Waste */}
                        <div className="h-7 px-3 bg-slate-50 border-b border-slate-200 grid grid-cols-[1.2fr_1fr_1fr] items-center text-xs text-slate-500 font-medium select-none">
                          <span>Material</span>
                          <span>Used</span>
                          <span>Waste</span>
                        </div>

                        {/* One 34px row per material that has used > 0 or waste > 0 */}
                        <div>
                          {usedMaterials.map((mat) => (
                            <div
                              key={mat.name}
                              className="h-[34px] px-3 grid grid-cols-[1.2fr_1fr_1fr] items-center text-xs border-b border-slate-100 last:border-b-0"
                            >
                              <span className="text-slate-800 font-medium">{mat.name}</span>
                              <span className="tabular-nums font-mono font-bold text-slate-800">
                                {mat.used.toLocaleString()}{' '}
                                <span className="text-slate-400 text-xs font-normal font-sans">{mat.unit}</span>
                              </span>
                              <span className="tabular-nums font-mono font-bold text-red-600">
                                {mat.waste.toLocaleString()}{' '}
                                <span className="text-xs font-normal text-red-600 font-sans">
                                  {mat.unit}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Footer line: bg-slate-50, text-xs text-slate-400, px-3 py-1.5 */}
                        {notUsedMaterials.length > 0 && (
                          <div className="bg-slate-50 text-xs text-slate-400 px-3 py-1.5 border-t border-slate-100">
                            Not used in this entry: {notUsedMaterials.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer: 32px */}
          <div className="h-8 flex items-center justify-between border-t border-slate-100 px-1 pt-1 shrink-0 text-xs text-slate-500 select-none">
            <span className="font-mono font-medium tabular-nums text-xs text-slate-600">
              {entries.length === 0
                ? '0 of 0'
                : `${(entriesPage - 1) * entriesPageSize + 1}-${Math.min(
                    entries.length,
                    entriesPage * entriesPageSize
                  )} of ${entries.length}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={entriesPage <= 1}
                onClick={() => setEntriesPage((p) => p - 1)}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Previous entries page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={entriesPage >= entriesTotalPages}
                onClick={() => setEntriesPage((p) => p + 1)}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Next entries page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Tile>

        {/* Right Column: Activity Tile */}
        <Tile className="flex flex-col h-full min-h-0 p-2.5 overflow-hidden">
          {/* Section header: 32px */}
          <div className="h-8 flex items-center justify-between px-1 border-b border-slate-100 shrink-0">
            <span className="text-xs font-semibold text-slate-800">Activity</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-mono font-semibold text-slate-600 tabular-nums">
              {activityEvents.length === 1 ? '1 event' : `${activityEvents.length} events`}
            </span>
          </div>

          {/* Paginated rows area */}
          <div ref={activityContainerRef} className="flex-1 min-h-0 py-1.5 flex flex-col gap-1 overflow-hidden">
            {activityEvents.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 italic">
                No activity logged yet.
              </div>
            ) : (
              currentActivities.map((ev) => (
                <div
                  key={ev.id}
                  className="h-[40px] px-2.5 rounded-lg border border-slate-100 bg-slate-50/40 hover:border-blue-300 hover:bg-blue-50/40 transition-colors flex items-center justify-between gap-3 text-xs shrink-0 select-none"
                >
                  <span className="font-medium text-slate-800 truncate">
                    {ev.text}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0 font-normal font-mono tabular-nums">
                    {formatBatchDate(ev.time)} {formatBatchTime(ev.time)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Footer: 32px */}
          <div className="h-8 flex items-center justify-between border-t border-slate-100 px-1 pt-1 shrink-0 text-xs text-slate-500 select-none">
            <span className="font-mono font-medium tabular-nums text-xs text-slate-600">
              {activityEvents.length === 0
                ? '0 of 0'
                : `${(activityPage - 1) * activityPageSize + 1}-${Math.min(
                    activityEvents.length,
                    activityPage * activityPageSize
                  )} of ${activityEvents.length}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={activityPage <= 1}
                onClick={() => setActivityPage((p) => p - 1)}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Previous activity page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={activityPage >= activityTotalPages}
                onClick={() => setActivityPage((p) => p + 1)}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Next activity page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Tile>

      </div>

    </div>
  )
}

export default BatchDetailView
