import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { api } from '../../services/api'
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import EnterpriseLoading from '../../components/ui/EnterpriseLoading'

// ─── Live Duration Cell ────────────────────────────────────────────────────────
const LiveDuration: React.FC<{ startedAt: string; endedAt?: string | null }> = ({ startedAt, endedAt }) => {
  const compute = () => {
    const end = endedAt ? new Date(endedAt).getTime() : Date.now()
    const diff = Math.max(0, end - new Date(startedAt).getTime())
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    const s = Math.floor((diff % 60_000) / 1_000)
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  }
  const [val, setVal] = useState(compute)
  useEffect(() => {
    if (endedAt) { setVal(compute()); return }
    const t = setInterval(() => setVal(compute()), 1000)
    return () => clearInterval(t)
  }, [startedAt, endedAt])
  return <span className="font-mono">{val}</span>
}

// ─── Material Card ─────────────────────────────────────────────────────────────
interface MatCardProps {
  accent: string
  label: string
  name?: string | null
  used?: number | string | null
  waste?: number | string | null
  unit?: string | null
}
const MatCard: React.FC<MatCardProps> = ({ accent, label, name, used, waste, unit }) => (
  <div className={`border-l-4 ${accent} border border-[#E5E7EB] rounded-lg bg-white p-3 flex flex-col gap-2`}>
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">{label}</span>
      <span className="text-[12px] font-semibold text-slate-700 truncate text-right" title={name ?? undefined}>
        {name || <span className="text-slate-300 italic text-[11px]">Not Selected</span>}
      </span>
    </div>
    <div className="flex gap-4 border-t border-[#F1F5F9] pt-2">
      <div className="flex flex-col flex-1">
        <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Used</span>
        <span className="text-[13px] font-bold text-blue-600">{used ?? 0} {unit || ''}</span>
      </div>
      <div className="flex flex-col flex-1">
        <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Waste</span>
        <span className="text-[13px] font-bold text-red-600">{waste ?? 0} {unit || ''}</span>
      </div>
    </div>
  </div>
)

// ─── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    Active: 'bg-green-50 border-green-200 text-green-700',
    Paused: 'bg-orange-50 border-orange-200 text-orange-700',
    Completed: 'bg-blue-50 border-blue-200 text-blue-700',
    Cancelled: 'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${map[status] ?? 'bg-slate-50 border-slate-200 text-slate-600'}`}>
      {status}
    </span>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export const BatchDetailsPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({})

  const toggleEntry = (id: string) =>
    setExpandedEntries(prev => ({ ...prev, [id]: !prev[id] }))

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: productionLines = [] } = useQuery<any[]>({
    queryKey: ['productionLinesList'],
    queryFn: async () => (await api.get('/api/v1/production/lines?includeInactive=true')).data?.data || []
  })

  const { data: activeBatches = [], isLoading: activeLoading } = useQuery<any[]>({
    queryKey: ['activeBatchesList'],
    queryFn: async () => (await api.get('/api/v1/production/batches/active')).data?.data || []
  })

  const historyQueries = useQueries({
    queries: productionLines.map(line => ({
      queryKey: ['lineHistory', line.lineId],
      queryFn: async () => (await api.get(`/api/v1/production/batch/history?lineId=${line.lineId}`)).data?.data || [],
      enabled: productionLines.length > 0
    }))
  })

  const { data: summaryData, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ['sessionSummary', batchId],
    queryFn: async () =>
      (await api.get(`/api/v1/production-entries/session/summary?sessionId=${batchId}`)).data?.data || null,
    enabled: !!batchId
  })

  const { data: entries = [], isLoading: entriesLoading } = useQuery<any[]>({
    queryKey: ['sessionEntries', batchId],
    queryFn: async () =>
      (await api.get(`/api/v1/production-entries/session/${batchId}/entries`)).data?.data || [],
    enabled: !!batchId
  })

  // ── Batch meta resolution ─────────────────────────────────────────────────
  const allHistory = historyQueries.flatMap(q => q.data || [])
  const batchMeta =
    activeBatches.find(b => b.id === batchId) ||
    allHistory.find(b => b.id === batchId) ||
    (summaryData
      ? {
          batchNumber: summaryData.batchNumber,
          product: summaryData.skuName,
          operatorName: summaryData.operatorName,
          shift: summaryData.shift,
          startedAt: summaryData.startedAt,
          completedAt: summaryData.endedAt,
          targetQuantity: 1000,
          producedQuantity: summaryData.casesProduced,
          status: summaryData.endedAt ? 'Completed' : 'Active',
          productionLineName: undefined as any,
        }
      : null)

  if (activeLoading || summaryLoading || entriesLoading) {
    return <EnterpriseLoading label="Loading batch workspace..." />
  }

  if (!batchMeta) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
        <AlertTriangle className="w-9 h-9 text-amber-500 mb-3" />
        <h2 className="text-[15px] font-bold text-slate-800">Batch Not Found</h2>
        <p className="text-[13px] text-slate-500 mt-1 text-center max-w-sm">
          The requested production run could not be resolved. It may have been deleted or the ID is invalid.
        </p>
        <button
          onClick={() => navigate('/company/production')}
          className="mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg cursor-pointer transition-all"
        >
          Return to Console
        </button>
      </div>
    )
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const isCompleted = batchMeta.status === 'Completed'
  const isPaused = batchMeta.status === 'Paused'
  const targetQty = batchMeta.targetQuantity || 1000
  const producedQty = summaryData?.casesProduced ?? batchMeta.producedQuantity ?? 0
  const progressPct = Math.min(100, Math.round((producedQty / targetQty) * 100))
  const totalEntries = entries.length
  const totalWaste = summaryData
    ? (summaryData.preformWaste || 0) +
      (summaryData.capWaste || 0) +
      (summaryData.labelWaste || 0) +
      (summaryData.shrinkWaste || 0)
    : 0
  const rawMatsConsumed = summaryData?.inventorySummary || []
  const totalMaterialsQty = rawMatsConsumed.reduce(
    (acc: number, it: any) => acc + (it.Consumed || 0), 0
  )

  // ── Timeline ──────────────────────────────────────────────────────────────
  const timelineEvents: { title: string; desc: string; time: Date; color: string }[] = [
    {
      title: 'Batch Initialized',
      desc: `Run started for ${batchMeta.product}`,
      time: new Date(batchMeta.startedAt),
      color: 'blue',
    },
    {
      title: 'Operator Session',
      desc: `Assigned to ${batchMeta.operatorName}`,
      time: new Date(batchMeta.startedAt),
      color: 'indigo',
    },
    ...[...entries]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((e, i) => ({
        title: `Entry #${i + 1} Logged`,
        desc: `${e.casesProduced} cases recorded`,
        time: new Date(e.createdAt),
        color: 'green',
      })),
    ...(isCompleted
      ? [
          {
            title: 'Batch Completed',
            desc: `Locked at ${producedQty} cases`,
            time: batchMeta.completedAt ? new Date(batchMeta.completedAt) : new Date(),
            color: 'slate',
          },
        ]
      : []),
  ].sort((a, b) => a.time.getTime() - b.time.getTime())

  const dotColors: Record<string, string> = {
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    green: 'bg-green-500',
    slate: 'bg-slate-400',
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 font-sans text-slate-900 bg-[#F8FAFC] p-4 min-h-screen">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">

        {/* Top bar: back / batch number / status / progress */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[#F1F5F9]">
          <button
            onClick={() => navigate('/company/production')}
            className="h-[30px] px-2.5 text-[12px] font-bold text-slate-700 border border-[#E5E7EB] hover:bg-[#F8FAFC] rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-[0.97]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

          <h1 className="text-[22px] font-black text-slate-900 tracking-tight leading-none">
            {batchMeta.batchNumber}
          </h1>

          <StatusBadge status={isCompleted ? 'Completed' : isPaused ? 'Paused' : 'Active'} />

          <div className="ml-auto flex items-center gap-2 select-none">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Progress</span>
            <div className="w-[130px] bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[12px] font-black text-blue-600 whitespace-nowrap">{progressPct}%</span>
          </div>
        </div>

        {/* Metadata strip: 7 cells divided by vertical rules */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 select-none divide-x divide-[#F1F5F9]">
          {([
            { label: 'Product', value: batchMeta.product },
            { label: 'Line', value: batchMeta.productionLineName || 'Bottling Line' },
            { label: 'Operator', value: batchMeta.operatorName },
            { label: 'Shift', value: `${batchMeta.shift} Shift` },
            { label: 'Started', value: fmtTime(batchMeta.startedAt) },
            {
              label: 'Duration',
              value: (
                <LiveDuration
                  startedAt={batchMeta.startedAt}
                  endedAt={isCompleted ? batchMeta.completedAt : null}
                />
              ),
            },
            { label: 'Target', value: `${targetQty.toLocaleString()} Cases` },
          ] as { label: string; value: React.ReactNode }[]).map((item, i) => (
            <div key={i} className="flex flex-col px-4 py-2.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.label}</span>
              <span className="text-[13px] font-bold text-slate-800 truncate mt-0.5">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ KPI STRIP ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
        {[
          { value: producedQty.toLocaleString(), label: 'Cases Produced' },
          { value: totalEntries, label: 'Entries Logged' },
          { value: totalMaterialsQty.toLocaleString(), label: 'Material Consumed' },
          { value: totalWaste.toLocaleString(), label: 'Total Waste' },
        ].map((kpi, i) => (
          <div
            key={i}
            className="bg-white border border-[#E5E7EB] rounded-lg py-2 px-3 shadow-sm flex flex-col justify-center h-[54px] text-center"
          >
            <span className="text-[20px] font-black text-slate-900 leading-tight">{kpi.value}</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{kpi.label}</span>
          </div>
        ))}
      </div>

      {/* ══ MAIN 70/30 LAYOUT ════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">

        {/* ── Production Entry History ──────────────────────────────────── */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-[#F1F5F9] flex items-center justify-between select-none">
            <h2 className="text-[16px] font-bold text-slate-900">Production Entry History</h2>
            <span className="text-[11px] font-semibold text-slate-400">
              {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none h-[36px]">
                  <th className="py-2 px-4 text-left">Date</th>
                  <th className="py-2 px-4 text-left">Time</th>
                  <th className="py-2 px-4 text-left">Operator</th>
                  <th className="py-2 px-4 text-left">Shift</th>
                  <th className="py-2 px-4 text-center">Cases</th>
                  <th className="py-2 px-4 text-center">Status</th>
                  <th className="py-2 px-4 text-center">Details</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F5F9] text-[13px] font-medium text-slate-700">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[13px] text-slate-400 italic">
                      No production entries have been logged for this batch yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((item: any, rowIdx: number) => {
                    const isExpanded = !!expandedEntries[item.id]
                    const isEven = rowIdx % 2 === 0
                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          onClick={() => toggleEntry(item.id)}
                          className={`cursor-pointer transition-colors h-[38px] ${
                            isEven ? 'bg-white' : 'bg-[#FAFBFC]'
                          } hover:bg-blue-50/40`}
                        >
                          <td className="py-2 px-4 font-semibold text-slate-800 whitespace-nowrap">
                            {fmtDate(item.createdAt)}
                          </td>
                          <td className="py-2 px-4 text-slate-600 whitespace-nowrap">
                            {fmtTime(item.createdAt)}
                          </td>
                          <td className="py-2 px-4 text-slate-800 whitespace-nowrap">
                            {item.operatorName}
                          </td>
                          <td className="py-2 px-4 text-slate-600 whitespace-nowrap">
                            {item.shift || batchMeta.shift} Shift
                          </td>
                          <td className="py-2 px-4 text-center font-bold text-slate-900">
                            {item.casesProduced}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <span className="text-[9px] font-black text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full uppercase tracking-wider select-none">
                              Logged
                            </span>
                          </td>
                          <td className="py-2 px-4 text-center">
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                toggleEntry(item.id)
                              }}
                              aria-expanded={isExpanded}
                              aria-controls={`details-${item.id}`}
                              id={`toggle-${item.id}`}
                              className="h-[28px] px-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded transition-all cursor-pointer inline-flex items-center gap-1 border border-[#E5E7EB] select-none"
                            >
                              {isExpanded ? (
                                <><ChevronUp className="w-3 h-3" /> Hide</>
                              ) : (
                                <><ChevronDown className="w-3 h-3" /> Details</>
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded material detail row */}
                        {isExpanded && (
                          <tr className="border-b border-[#E5E7EB]">
                            <td colSpan={7} className="px-4 py-4 bg-[#F8FAFC]">
                              <div
                                id={`details-${item.id}`}
                                role="region"
                                aria-labelledby={`toggle-${item.id}`}
                              >
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 select-none">
                                  Material Consumption
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                  <MatCard
                                    accent="border-l-blue-500"
                                    label="Preform"
                                    name={item.preformName}
                                    used={item.preformUsage}
                                    waste={item.preformWastage}
                                    unit={item.preformUnit}
                                  />
                                  <MatCard
                                    accent="border-l-purple-500"
                                    label="Cap"
                                    name={item.capName}
                                    used={item.capUsage}
                                    waste={item.capWastage}
                                    unit={item.capUnit}
                                  />
                                  <MatCard
                                    accent="border-l-green-500"
                                    label="Label"
                                    name={item.labelName}
                                    used={item.labelUsage}
                                    waste={item.labelWastage}
                                    unit={item.labelUnit}
                                  />
                                  <MatCard
                                    accent="border-l-orange-500"
                                    label="Shrink Film"
                                    name={item.shrinkName}
                                    used={item.shrinkUsage}
                                    waste={item.shrinkWastage}
                                    unit={item.shrinkUnit}
                                  />
                                  <MatCard
                                    accent="border-l-slate-400"
                                    label="Glue"
                                    name={item.glueName}
                                    used={item.glueUsage ?? 0}
                                    waste={item.glueWastage ?? 0}
                                    unit={item.glueUnit || 'KG'}
                                  />
                                  {/* Printer Jet */}
                                  <div className="border-l-4 border-l-indigo-500 border border-[#E5E7EB] rounded-lg bg-white p-3 flex flex-col gap-2">
                                    <div className="flex items-baseline justify-between gap-2">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
                                        Printer Jet
                                      </span>
                                      <span className="text-[12px] font-semibold text-slate-700">
                                        Active Jet Mode
                                      </span>
                                    </div>
                                    <div className="flex gap-4 border-t border-[#F1F5F9] pt-2">
                                      <div className="flex flex-col flex-1">
                                        <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Ink</span>
                                        <span className={`text-[13px] font-bold ${item.inkUsed ? 'text-blue-600' : 'text-slate-400'}`}>
                                          {item.inkUsed ? 'Yes' : 'No'}
                                        </span>
                                      </div>
                                      <div className="flex flex-col flex-1">
                                        <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Makeup</span>
                                        <span className={`text-[13px] font-bold ${item.makeupUsed ? 'text-blue-600' : 'text-slate-400'}`}>
                                          {item.makeupUsed ? 'Yes' : 'No'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Timeline sidebar ─────────────────────────────────────────── */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#F1F5F9] select-none">
            <h2 className="text-[16px] font-bold text-slate-900">Timeline</h2>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            {timelineEvents.length === 0 ? (
              <p className="text-[12px] text-slate-400 italic text-center py-8">No events recorded yet.</p>
            ) : (
              <div className="relative pl-5">
                <div className="absolute left-[7px] top-2 bottom-2 w-[1.5px] bg-[#E5E7EB]" />
                <div className="flex flex-col gap-4">
                  {timelineEvents.map((ev, idx) => (
                    <div key={idx} className="relative">
                      <div
                        className={`absolute -left-[14px] top-[5px] w-2 h-2 rounded-full border-2 border-white shadow-sm ${
                          dotColors[ev.color] || 'bg-slate-300'
                        }`}
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {ev.time.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}{' '}
                          &middot;{' '}
                          {ev.time.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                        <h4 className="text-[13px] font-bold text-slate-900 leading-tight">{ev.title}</h4>
                        <p className="text-[12px] text-slate-500 leading-tight">{ev.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default BatchDetailsPage
