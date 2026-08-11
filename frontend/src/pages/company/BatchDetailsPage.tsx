import PageContainer from '../../components/ui/layout/PageContainer';
import PageHeader from '../../components/ui/layout/PageHeader';
import KPICard from '../../components/ui/layout/KPICard';
import FilterBar from '../../components/ui/layout/FilterBar';
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { operationsIssueApi } from '../../services/api/operationsIssue'
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp, Package, Clock, User, Calendar, History, Box, FileText, CheckCircle2, PlayCircle, Layers, Wrench, ShieldCheck, Square, Loader2 } from 'lucide-react'
import EnterpriseLoading from '../../components/ui/EnterpriseLoading'
import EnterpriseModal from '../../components/ui/EnterpriseModal'
import { useStationConfig } from '../../hooks/useStationConfig'

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

import { formatRawMaterialUsage, formatRawMaterialWastage } from '../../utils/rawMaterialFormatting'

// ─── Material Widgets ────────────────────────────────────────────────────────
const CompactMatWidget: React.FC<{
  color: string, title: string, used: any, waste: any, unit: string, isBoolean?: boolean
}> = ({ color, title, used, waste, unit, isBoolean }) => {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500 bg-blue-50/50',
    purple: 'border-purple-500 bg-purple-50/50',
    green: 'border-green-500 bg-green-50/50',
    orange: 'border-orange-500 bg-orange-50/50',
    slate: 'border-slate-500 bg-slate-50/50',
    cyan: 'border-cyan-500 bg-cyan-50/50',
  }
  const bgClass = colorMap[color] || colorMap.slate
  
  return (
    <div className={`border-l-2 rounded-md p-2 border border-slate-200 shadow-sm ${bgClass}`}>
      <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block mb-1.5">{title}</span>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-end">
          <span className="text-[9px] uppercase font-bold text-slate-500">{isBoolean ? 'Ink' : 'Used'}</span>
          <span className="text-[12px] font-black text-slate-900 leading-none">{used || 0} <span className="text-[8px] font-bold text-slate-500">{unit}</span></span>
        </div>
        <div className="flex justify-between items-end">
          <span className="text-[9px] uppercase font-bold text-slate-500">{isBoolean ? 'Makeup' : 'Waste'}</span>
          <span className={`text-[12px] font-black leading-none ${waste > 0 && !isBoolean ? 'text-red-600' : 'text-slate-900'}`}>{waste || 0} <span className="text-[8px] font-bold text-slate-500">{unit}</span></span>
        </div>
      </div>
    </div>
  )
}

const MiniMatCard: React.FC<{ label: string, used: any, waste: any, unit?: string }> = ({ label, used, waste, unit = '' }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{label}</p>
    <div className="flex justify-between items-end mb-1">
      <span className="text-[9px] font-bold text-slate-400 uppercase">Used</span>
      <span className="text-xs font-black text-slate-800">{used || 0} <span className="text-[9px] text-slate-400 font-bold">{unit}</span></span>
    </div>
    <div className="flex justify-between items-end">
      <span className="text-[9px] font-bold text-slate-400 uppercase">Waste</span>
      <span className={`text-xs font-black ${waste > 0 ? 'text-red-600' : 'text-slate-800'}`}>{waste || 0} <span className="text-[9px] text-slate-400 font-bold">{unit}</span></span>
    </div>
  </div>
)

// ─── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    Active: 'bg-green-500 text-white shadow-sm',
    Paused: 'bg-orange-500 text-white shadow-sm',
    Completed: 'bg-slate-800 text-white shadow-sm',
    Cancelled: 'bg-red-500 text-white shadow-sm',
  }
  return (
    <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

// ─── Timeline Helpers ──────────────────────────────────────────────────────────
const timelineColorMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  green: 'bg-green-100 text-green-600',
  slate: 'bg-slate-100 text-slate-600',
}

const timelineIconMap: Record<string, React.ReactNode> = {
  blue: <PlayCircle className="w-4 h-4" />,
  indigo: <User className="w-4 h-4" />,
  green: <Package className="w-4 h-4" />,
  slate: <CheckCircle2 className="w-4 h-4" />,
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export const BatchDetailsPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isBlowingEnabled, isFillingEnabled, isLabelingEnabled, isPackingEnabled } = useStationConfig()
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({})

  // ── Stop Batch State ────────────────────────────────────────────────────────
  const [isStopModalOpen, setIsStopModalOpen] = useState(false)
  const [stopReason, setStopReason] = useState('Production Completed')
  const [stopRemarks, setStopRemarks] = useState('')
  const [isStoppingBatch, setIsStoppingBatch] = useState(false)
  const [stopError, setStopError] = useState<string | null>(null)
  const [stopSuccessMsg, setStopSuccessMsg] = useState<string | null>(null)

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

  const { data: batchIssues = [] } = useQuery<any[]>({
    queryKey: ['batchIssues', batchMeta?.batchNumber],
    queryFn: async () => {
      if (!batchMeta?.batchNumber) return [];
      const res = await operationsIssueApi.getIssuesForBatch(batchMeta.batchNumber);
      return res.data || [];
    },
    enabled: !!batchMeta?.batchNumber
  })

  // ── Stop Batch Action Handler ────────────────────────────────────────────────
  const handleStopBatch = async () => {
    if (!batchId || isStoppingBatch) return
    setIsStoppingBatch(true)
    setStopError(null)

    try {
      await api.post(`/api/v1/production/batches/${batchId}/stop`, {
        reason: stopReason,
        remarks: stopRemarks
      })

      setIsStoppingBatch(false)
      setIsStopModalOpen(false)
      setStopSuccessMsg(`Production Batch ${batchMeta?.batchNumber || ''} has been stopped successfully.`)

      // Refetch queries instantly to update batch status and release line
      queryClient.invalidateQueries({ queryKey: ['sessionSummary', batchId] })
      queryClient.invalidateQueries({ queryKey: ['activeBatchesList'] })
      queryClient.invalidateQueries({ queryKey: ['sessionEntries', batchId] })
      queryClient.invalidateQueries({ queryKey: ['productionLinesList'] })
      queryClient.invalidateQueries({ queryKey: ['lineHistory'] })
      queryClient.invalidateQueries({ queryKey: ['batchIssues', batchMeta?.batchNumber] })
    } catch (err: any) {
      setIsStoppingBatch(false)
      const msg = err.response?.data?.message || err.message || 'Unable to stop the batch. Please try again.'
      setStopError(msg)
    }
  }

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
  const isCompleted = batchMeta.status === 'Completed' || batchMeta.status === 'Stopped' || batchMeta.status === 'Closed'
  const isPaused = batchMeta.status === 'Paused'
  const producedQty = summaryData?.casesProduced ?? batchMeta.producedQuantity ?? 0
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
  const timelineEvents: { title: string; desc: string; time: Date; color: string; entry?: any }[] = [
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
        title: `Entry #${i + 1}`,
        desc: '',
        time: new Date(e.createdAt),
        color: 'green',
        entry: e
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
    <PageContainer>
      <div className="flex flex-col gap-3 max-w-[1600px] mx-auto w-full pb-8">
        
        {/* ══ SUCCESS NOTIFICATION BANNER ═══════════════════════════════════════ */}
        {stopSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{stopSuccessMsg}</span>
            </div>
            <button onClick={() => setStopSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 font-bold text-xs cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* ══ COMPACT HEADER ════════════════════════════════════════════════════ */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
            <button onClick={() => navigate('/company/production')} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Operations
            </button>
            <div className="flex items-center gap-2.5">
              <StatusBadge status={isCompleted ? 'Completed' : isPaused ? 'Paused' : 'Active'} />
              {!isCompleted && !isPaused && (
                <button
                  type="button"
                  onClick={() => { setStopError(null); setIsStopModalOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" /> Stop Batch
                </button>
              )}
            </div>
          </div>
          
          <div className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-x-8 gap-y-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 leading-none mb-1">{batchMeta.batchNumber}</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Batch ID</p>
            </div>
            
            <div className="hidden md:block w-px h-8 bg-slate-200"></div>
            
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-6 gap-y-3 flex-1">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-0.5">Product</p>
                <p className="text-[13px] font-bold text-slate-800 truncate">{batchMeta.product}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-0.5">Line</p>
                <p className="text-[13px] font-bold text-slate-800 truncate">{batchMeta.productionLineName || 'Bottling Line'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-0.5">Operator</p>
                <p className="text-[13px] font-bold text-slate-800 truncate">{batchMeta.operatorName}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-0.5">Shift</p>
                <p className="text-[13px] font-bold text-slate-800 truncate">{batchMeta.shift} Shift</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-0.5">Started</p>
                <p className="text-[13px] font-bold text-slate-800 truncate">{fmtTime(batchMeta.startedAt)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-0.5">Running Time</p>
                <p className="text-[13px] font-bold text-slate-800 truncate">
                  <LiveDuration startedAt={batchMeta.startedAt} endedAt={isCompleted ? batchMeta.completedAt : null} />
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ══ KPI SUMMARY CARDS ═══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { title: 'Cases Produced', value: producedQty.toLocaleString(), icon: <Package className="w-4 h-4 text-blue-600" />, bg: 'bg-blue-100', border: 'border-blue-200' },
            { title: 'Production Entries', value: totalEntries, icon: <FileText className="w-4 h-4 text-indigo-600" />, bg: 'bg-indigo-100', border: 'border-indigo-200' },
            { title: 'Waste Generated', value: totalWaste.toLocaleString(), icon: <AlertTriangle className="w-4 h-4 text-red-600" />, bg: 'bg-red-100', border: 'border-red-200' }
          ].map((kpi, idx) => (
            <div key={idx} className={`bg-white px-4 py-3 rounded-lg border ${kpi.border} shadow-sm flex items-center justify-between`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">{kpi.title}</p>
                <p className="text-xl font-black text-slate-900 leading-none">{kpi.value}</p>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${kpi.bg}`}>
                {kpi.icon}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-1">
          
          {/* ══ MAIN CONTENT (Left: 2 Columns) ══════════════════════════ */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            
            {/* Materials Used */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Material Consumption
                </h3>
              </div>
              <div className="p-3">
                {(() => {
                  const enabledMatCards = summaryData ? [
                    isBlowingEnabled && (
                      <CompactMatWidget key="preform" color="blue" title="Preform" used={summaryData.preformUsed} waste={summaryData.preformWaste} unit="Bags" />
                    ),
                    isFillingEnabled && (
                      <CompactMatWidget key="cap" color="purple" title="Cap" used={summaryData.capUsed} waste={summaryData.capWaste} unit="Boxes" />
                    ),
                    isLabelingEnabled && (
                      <CompactMatWidget key="label" color="green" title="Label" used={summaryData.labelUsed} waste={summaryData.labelWaste} unit="KG" />
                    ),
                    isPackingEnabled && (
                      <CompactMatWidget key="shrink" color="orange" title="Shrink" used={summaryData.shrinkUsed} waste={summaryData.shrinkWaste} unit="KG" />
                    ),
                    isLabelingEnabled && (
                      <CompactMatWidget key="glue" color="slate" title="Glue" used={summaryData.glueUsed} waste={summaryData.glueWaste} unit="KG" />
                    ),
                    (isFillingEnabled || isLabelingEnabled) && (
                      <CompactMatWidget key="ink" color="cyan" title="Ink / Jet" used={summaryData.inkUsed ? 'Yes' : 'No'} waste={summaryData.makeupUsed ? 'Yes' : 'No'} unit="" isBoolean />
                    )
                  ].filter(Boolean) : []

                  const cardCount = enabledMatCards.length

                  return (
                    <div 
                      className="grid gap-2 grid-cols-2 sm:grid-cols-3"
                      style={{
                        gridTemplateColumns: cardCount > 0 ? `repeat(${Math.min(cardCount, 6)}, minmax(0, 1fr))` : undefined
                      }}
                    >
                      {summaryData ? (
                        cardCount > 0 ? (
                          enabledMatCards
                        ) : (
                          <div className="col-span-full py-4 text-center text-[12px] text-slate-400 font-medium italic">
                            No material consumption cards enabled for current station configuration.
                          </div>
                        )
                      ) : (
                        <div className="col-span-full py-6 text-center text-[12px] text-slate-400 font-medium italic">
                          Material consumption data is not available.
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Reported Operations Issues Section */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-amber-50/50 flex justify-between items-center">
                <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Reported Batch Incidents & Issues ({batchIssues.length})
                </h3>
              </div>
              <div className="p-3">
                {batchIssues.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-3 text-center">No operations issues reported during this batch.</p>
                ) : (
                  <div className="space-y-2">
                    {batchIssues.map((issue: any) => (
                      <div key={issue.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-600">#{issue.issueNumber}</span>
                            <span className="text-xs font-bold text-slate-900">{issue.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-500">{issue.category} • Reported by {issue.reportedByName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${issue.priority === 'Critical' || issue.priority === 'Emergency' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                            {issue.priority}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                            {issue.status}
                          </span>
                          <button
                            onClick={() => navigate(`/company/operations-issues/${issue.id}`)}
                            className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-bold rounded hover:bg-blue-700 transition-colors"
                          >
                            Open Issue
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Production Entries (Activity Cards) */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-600" />
                  Production Entries
                </h3>
              </div>
              
              <div className="p-3 flex flex-col gap-2">
                {entries.length === 0 ? (
                  <div className="py-8 text-center text-[12px] text-slate-400 font-medium italic">
                    No production entries have been logged.
                  </div>
                ) : (
                  entries.map((item: any, idx: number) => {
                    const isExpanded = !!expandedEntries[item.id]
                    return (
                      <div key={item.id} className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-sm">
                        <div 
                          className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors"
                          onClick={() => toggleEntry(item.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                              <span className="text-[12px] font-black">#{entries.length - idx}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-bold text-slate-900 text-[13px]">{fmtTime(item.createdAt)}</span>
                                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{fmtDate(item.createdAt)}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium">By <span className="text-slate-800 font-bold">{item.operatorName}</span></p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-[9px] uppercase font-bold tracking-widest text-slate-400 mb-0.5">Produced</p>
                              <p className="text-[15px] font-black text-green-600 leading-none">+{item.casesProduced}</p>
                            </div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-500">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded Material Data */}
                        {isExpanded && (
                          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                            {(() => {
                              const miniMatCards = [
                                isBlowingEnabled && <MiniMatCard key="preform" label="Preform" used={item.preformUsage} waste={item.preformWastage} unit={item.preformUnit || "Bag"} />,
                                isFillingEnabled && <MiniMatCard key="cap" label="Cap" used={item.capUsage} waste={item.capWastage} unit={item.capUnit || "Box"} />,
                                isLabelingEnabled && <MiniMatCard key="label" label="Label" used={item.labelUsage} waste={item.labelWastage} unit={item.labelUnit || "KG"} />,
                                isPackingEnabled && <MiniMatCard key="shrink" label="Shrink" used={item.shrinkUsage} waste={item.shrinkWastage} unit={item.shrinkUnit || "KG"} />,
                                isLabelingEnabled && <MiniMatCard key="glue" label="Glue" used={item.glueUsage} waste={item.glueWastage} unit={item.glueUnit || "KG"} />
                              ].filter(Boolean)

                              const miniCount = miniMatCards.length

                              return (
                                <div 
                                  className="grid gap-2 grid-cols-2 sm:grid-cols-3"
                                  style={{
                                    gridTemplateColumns: miniCount > 0 ? `repeat(${Math.min(miniCount, 5)}, minmax(0, 1fr))` : undefined
                                  }}
                                >
                                  {miniMatCards}
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* ══ RIGHT SIDEBAR (Timeline) ════════════════════════════════ */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden sticky top-[84px]">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Activity Feed
                </h3>
              </div>
              
              <div className="p-4 max-h-[600px] overflow-y-auto">
                {timelineEvents.length === 0 ? (
                  <p className="text-[12px] text-slate-400 italic text-center py-6">No events recorded.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[11px] top-2 bottom-2 w-[1.5px] bg-slate-200 rounded-full" />
                    <div className="flex flex-col gap-5 relative">
                      {timelineEvents.map((ev, idx) => (
                        <div key={idx} className="flex gap-3 group">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm z-10 ${timelineColorMap[ev.color] || 'bg-slate-100 text-slate-500'}`}>
                            {timelineIconMap[ev.color] || <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                          </div>
                          <div className="flex-1 pt-0.5">
                            <h4 className="text-[12px] font-bold text-slate-900 leading-none mb-1">{ev.title}</h4>
                            
                            {ev.entry ? (
                              <div className="mt-2 mb-2 bg-slate-50 border border-slate-200 rounded p-2">
                                <div className="mb-2">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-0.5">Produced</span>
                                  <span className="text-[12px] font-black text-green-600">{ev.entry.casesProduced} Cases</span>
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Materials</span>
                                <div className="flex flex-col gap-1.5">
                                  {ev.entry.preformName && isBlowingEnabled && (
                                    <div className="bg-white border border-slate-100 rounded px-2 py-1.5 flex justify-between items-center shadow-sm">
                                      <span className="text-[10px] font-bold text-slate-700 w-12">Preform</span>
                                      <div className="flex gap-3 text-[10px]">
                                        <span className="text-slate-500">Used <span className="font-bold text-slate-800 ml-0.5">{ev.entry.preformUsage} {ev.entry.preformUnit || 'Bags'}</span></span>
                                        <span className="text-slate-500">Waste <span className={`font-bold ml-0.5 ${ev.entry.preformWastage > 0 ? 'text-red-600' : 'text-slate-800'}`}>{ev.entry.preformWastage} {ev.entry.preformUnit || 'Bags'}</span></span>
                                      </div>
                                    </div>
                                  )}
                                  {ev.entry.capName && isFillingEnabled && (ev.entry.capUsage > 0 || ev.entry.capWastage > 0) && (
                                    <div className="bg-white border border-slate-100 rounded px-2 py-1.5 flex justify-between items-center shadow-sm">
                                      <span className="text-[10px] font-bold text-slate-700 w-12">Cap</span>
                                      <div className="flex gap-3 text-[10px]">
                                        <span className="text-slate-500">Used <span className="font-bold text-slate-800 ml-0.5">{ev.entry.capUsage} {ev.entry.capUnit || 'Boxes'}</span></span>
                                        <span className="text-slate-500">Waste <span className={`font-bold ml-0.5 ${ev.entry.capWastage > 0 ? 'text-red-600' : 'text-slate-800'}`}>{ev.entry.capWastage} {ev.entry.capUnit || 'Boxes'}</span></span>
                                      </div>
                                    </div>
                                  )}
                                  {ev.entry.labelName && isLabelingEnabled && (ev.entry.labelUsage > 0 || ev.entry.labelWastage > 0) && (
                                    <div className="bg-white border border-slate-100 rounded px-2 py-1.5 flex justify-between items-center shadow-sm">
                                      <span className="text-[10px] font-bold text-slate-700 w-12">Label</span>
                                      <div className="flex gap-3 text-[10px]">
                                        <span className="text-slate-500">Used <span className="font-bold text-slate-800 ml-0.5">{ev.entry.labelUsage} {ev.entry.labelUnit || 'KG'}</span></span>
                                        <span className="text-slate-500">Waste <span className={`font-bold ml-0.5 ${ev.entry.labelWastage > 0 ? 'text-red-600' : 'text-slate-800'}`}>{ev.entry.labelWastage} {ev.entry.labelUnit || 'KG'}</span></span>
                                      </div>
                                    </div>
                                  )}
                                  {ev.entry.shrinkName && isPackingEnabled && (ev.entry.shrinkUsage > 0 || ev.entry.shrinkWastage > 0) && (
                                    <div className="bg-white border border-slate-100 rounded px-2 py-1.5 flex justify-between items-center shadow-sm">
                                      <span className="text-[10px] font-bold text-slate-700 w-12">Shrink</span>
                                      <div className="flex gap-3 text-[10px]">
                                        <span className="text-slate-500">Used <span className="font-bold text-slate-800 ml-0.5">{ev.entry.shrinkUsage} {ev.entry.shrinkUnit || 'KG'}</span></span>
                                        <span className="text-slate-500">Waste <span className={`font-bold ml-0.5 ${ev.entry.shrinkWastage > 0 ? 'text-red-600' : 'text-slate-800'}`}>{ev.entry.shrinkWastage} {ev.entry.shrinkUnit || 'KG'}</span></span>
                                      </div>
                                    </div>
                                  )}
                                  {ev.entry.glueName && isLabelingEnabled && (ev.entry.glueUsage > 0 || ev.entry.glueWastage > 0) && (
                                    <div className="bg-white border border-slate-100 rounded px-2 py-1.5 flex justify-between items-center shadow-sm">
                                      <span className="text-[10px] font-bold text-slate-700 w-12">Glue</span>
                                      <div className="flex gap-3 text-[10px]">
                                        <span className="text-slate-500">Used <span className="font-bold text-slate-800 ml-0.5">{ev.entry.glueUsage} {ev.entry.glueUnit || 'KG'}</span></span>
                                        <span className="text-slate-500">Waste <span className={`font-bold ml-0.5 ${ev.entry.glueWastage > 0 ? 'text-red-600' : 'text-slate-800'}`}>{ev.entry.glueWastage} {ev.entry.glueUnit || 'KG'}</span></span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-[11px] font-medium text-slate-500 mb-1.5 leading-snug">{ev.desc}</p>
                            )}

                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              {ev.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
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
      </div>

      {/* ══ STOP BATCH CONFIRMATION MODAL ═════════════════════════════════════ */}
      <EnterpriseModal
        isOpen={isStopModalOpen}
        onClose={() => !isStoppingBatch && setIsStopModalOpen(false)}
        title="Stop Production Batch?"
        maxWidth="md"
      >
        <div className="flex flex-col gap-4">
          {/* Warning Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-bold text-[13px]">Are you sure you want to stop this production batch?</p>
              <p className="text-amber-700 mt-0.5 leading-relaxed">
                This action will permanently end the current active run, freeze the running timer, and release the production line.
              </p>
            </div>
          </div>

          {/* Batch Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Batch Number</span>
              <span className="font-black text-slate-900 text-[13px]">{batchMeta.batchNumber}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Product</span>
              <span className="font-bold text-slate-800 truncate block">{batchMeta.product}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Production Line</span>
              <span className="font-bold text-slate-800 truncate block">{batchMeta.productionLineName || 'Bottling Line'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Cases Produced</span>
              <span className="font-bold text-slate-800">{producedQty} cases</span>
            </div>
          </div>

          {/* Business Action Impacts */}
          <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/50 border border-slate-200 rounded-lg p-3">
            <p className="font-bold text-slate-800 mb-1">System actions upon batch stop:</p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
              <span>Stops current batch and freezes running duration timer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
              <span>Releases line <span className="font-semibold text-slate-800">({batchMeta.productionLineName || 'Bottling Line'})</span> for next production run</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></div>
              <span>Prevents additional production entries or material consumption</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
              <span>Preserves all production history, logs, and material consumption records</span>
            </div>
          </div>

          {/* Reason & Remarks Input */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Stop Reason <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <select
                value={stopReason}
                onChange={(e) => setStopReason(e.target.value)}
                disabled={isStoppingBatch}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Production Completed">Production Completed</option>
                <option value="Shift Completed">Shift Completed</option>
                <option value="Machine Issue">Machine Issue</option>
                <option value="Material Shortage">Material Shortage</option>
                <option value="Operator Issue">Operator Issue</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Additional Remarks <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={stopRemarks}
                onChange={(e) => setStopRemarks(e.target.value)}
                placeholder="e.g. Completed target production run"
                disabled={isStoppingBatch}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Error Message Display */}
          {stopError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{stopError}</span>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsStopModalOpen(false)}
              disabled={isStoppingBatch}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStopBatch}
              disabled={isStoppingBatch}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isStoppingBatch ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Stopping...</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Batch</span>
                </>
              )}
            </button>
          </div>
        </div>
      </EnterpriseModal>
    </PageContainer>
  )
}

export default BatchDetailsPage
