import PageContainer from '../../components/ui/layout/PageContainer';
import PageHeader from '../../components/ui/layout/PageHeader';
import KPICard from '../../components/ui/layout/KPICard';
import FilterBar from '../../components/ui/layout/FilterBar';
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { operationsIssueApi } from '../../services/api/operationsIssue'
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp, Package, Clock, User, Calendar, History, Box, FileText, CheckCircle2, PlayCircle, Layers, Wrench, ShieldCheck, Square, Loader2, Plus } from 'lucide-react'
import EnterpriseLoading from '../../components/ui/EnterpriseLoading'
import EnterpriseModal from '../../components/ui/EnterpriseModal'
import { useStationConfig } from '../../hooks/useStationConfig'
import { useAuthStore } from '../../store/useAuthStore'
import { BatchDetailView } from '../../components/batch'

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
  const { user } = useAuthStore()
  const isOwner = (user?.roles?.some(r => ['owner', 'companyowner', 'platformowner'].includes(r.toLowerCase())) || user?.roleName?.toLowerCase() === 'owner') ?? false
  const canWrite = !isOwner
  const { isBlowingEnabled, isFillingEnabled, isLabelingEnabled, isPackingEnabled } = useStationConfig()
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({})

  // ── Stop Batch State ────────────────────────────────────────────────────────
  const [isStopModalOpen, setIsStopModalOpen] = useState(false)
  const [stopReason, setStopReason] = useState('Production Completed')
  const [stopRemarks, setStopRemarks] = useState('')
  const [isStoppingBatch, setIsStoppingBatch] = useState(false)
  const [stopError, setStopError] = useState<string | null>(null)
  const [stopSuccessMsg, setStopSuccessMsg] = useState<string | null>(null)

  // ── Add Entry State ─────────────────────────────────────────────────────────
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false)
  const [addEntryCases, setAddEntryCases] = useState('')
  const [addEntryPreform, setAddEntryPreform] = useState('')
  const [addEntryCap, setAddEntryCap] = useState('')
  const [addEntryLabel, setAddEntryLabel] = useState('')
  const [addEntryShrink, setAddEntryShrink] = useState('')
  const [addEntryGlue, setAddEntryGlue] = useState('')
  const [isAddingEntry, setIsAddingEntry] = useState(false)
  const [addEntryError, setAddEntryError] = useState<string | null>(null)

  const handleAddEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addEntryCases || Number(addEntryCases) <= 0) {
      setAddEntryError('Please enter a valid quantity of cases produced.')
      return
    }
    setIsAddingEntry(true)
    setAddEntryError(null)

    try {
      await api.post('/api/v1/production-entries', {
        batchSessionId: batchId,
        casesProduced: Number(addEntryCases),
        operatorName: batchMeta?.operatorName || user?.fullName || 'Operator',
        preformUsage: addEntryPreform ? Number(addEntryPreform) : 0,
        capUsage: addEntryCap ? Number(addEntryCap) : 0,
        labelUsage: addEntryLabel ? Number(addEntryLabel) : 0,
        shrinkUsage: addEntryShrink ? Number(addEntryShrink) : 0,
        glueUsage: addEntryGlue ? Number(addEntryGlue) : 0,
      })

      setIsAddingEntry(false)
      setIsAddEntryModalOpen(false)
      setAddEntryCases('')
      setAddEntryPreform('')
      setAddEntryCap('')
      setAddEntryLabel('')
      setAddEntryShrink('')
      setAddEntryGlue('')

      queryClient.invalidateQueries({ queryKey: ['sessionSummary', batchId] })
      queryClient.invalidateQueries({ queryKey: ['sessionEntries', batchId] })
      queryClient.invalidateQueries({ queryKey: ['activeBatchesList'] })
      queryClient.invalidateQueries({ queryKey: ['productionBatchById', batchId] })
    } catch (err: any) {
      setIsAddingEntry(false)
      const msg = err.response?.data?.message || err.message || 'Failed to add entry. Please try again.'
      setAddEntryError(msg)
    }
  }

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

  const { data: directBatchData } = useQuery<any>({
    queryKey: ['productionBatchById', batchId],
    queryFn: async () => (await api.get(`/api/v1/production/batches/${batchId}`)).data?.data || null,
    enabled: !!batchId
  })

  // ── Batch meta resolution ─────────────────────────────────────────────────
  const allHistory = historyQueries.flatMap(q => q.data || [])
  const batchMeta =
    directBatchData ||
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
    <div className="w-full h-full min-h-0">
      {/* ══ SUCCESS NOTIFICATION BANNER ═══════════════════════════════════════ */}
      {stopSuccessMsg && (
        <div className="mb-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-lg flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{stopSuccessMsg}</span>
          </div>
          <button onClick={() => setStopSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      <BatchDetailView
        batchMeta={batchMeta}
        summaryData={summaryData}
        entries={entries}
        batchIssues={batchIssues}
        canWrite={canWrite}
        isCompleted={isCompleted}
        isPaused={isPaused}
        onStopBatchClick={() => {
          setStopError(null)
          setIsStopModalOpen(true)
        }}
        onAddEntryClick={() => {
          setAddEntryError(null)
          setIsAddEntryModalOpen(true)
        }}
      />

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

      {/* ══ ADD PRODUCTION ENTRY MODAL ════════════════════════════════════════ */}
      <EnterpriseModal
        isOpen={isAddEntryModalOpen}
        onClose={() => !isAddingEntry && setIsAddEntryModalOpen(false)}
        title="Add Production Entry"
        maxWidth="md"
      >
        <form onSubmit={handleAddEntrySubmit} className="flex flex-col gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">Batch Number</span>
              <span className="font-bold text-slate-800">{batchMeta?.batchNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">Product</span>
              <span className="font-bold text-slate-800 truncate block">{batchMeta?.product}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cases Produced <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              required
              placeholder="e.g. 100"
              value={addEntryCases}
              onChange={(e) => setAddEntryCases(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Preforms (Bags)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={addEntryPreform}
                onChange={(e) => setAddEntryPreform(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Caps (Boxes)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={addEntryCap}
                onChange={(e) => setAddEntryCap(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Labels (KG)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={addEntryLabel}
                onChange={(e) => setAddEntryLabel(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Shrink (KG)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={addEntryShrink}
                onChange={(e) => setAddEntryShrink(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Glue (KG)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={addEntryGlue}
                onChange={(e) => setAddEntryGlue(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {addEntryError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{addEntryError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddEntryModalOpen(false)}
              disabled={isAddingEntry}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAddingEntry}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isAddingEntry ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Logging entry...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Log Entry</span>
                </>
              )}
            </button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

export default BatchDetailsPage

