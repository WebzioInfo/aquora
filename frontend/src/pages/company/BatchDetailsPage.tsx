import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { api } from '../../services/api'
import {
  ArrowLeft, Factory, Clock, User, Shield, Info,
  TrendingUp, Package, Trash2, ArrowUpRight, ArrowDownRight,
  TrendingDown, CheckCircle, AlertTriangle, Play, Pause, ChevronDown, ChevronUp,
  ExternalLink, Eye
} from 'lucide-react'
import EnterpriseHeader from '../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../components/ui/EnterpriseCard'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseLoading from '../../components/ui/EnterpriseLoading'

export const BatchDetailsPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)

  // 1. Fetch Production Lines
  const { data: productionLines = [] } = useQuery<any[]>({
    queryKey: ['productionLinesList'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production/lines?includeInactive=true')
      return res.data?.data || []
    }
  })

  // 2. Fetch Active Batches
  const { data: activeBatches = [], isLoading: activeLoading } = useQuery<any[]>({
    queryKey: ['activeBatchesList'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production/batches/active')
      return res.data?.data || []
    }
  })

  // 3. Fetch History for all lines to scan for completed batches
  const historyQueries = useQueries({
    queries: productionLines.map((line) => ({
      queryKey: ['lineHistory', line.lineId],
      queryFn: async () => {
        const res = await api.get(`/api/v1/production/batch/history?lineId=${line.lineId}`)
        return res.data?.data || []
      },
      enabled: productionLines.length > 0
    }))
  })

  // 4. Fetch Session Summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ['sessionSummary', batchId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/production-entries/session/summary?sessionId=${batchId}`)
      return res.data?.data || null
    },
    enabled: !!batchId
  })

  // 5. Fetch Session Entries
  const { data: entries = [], isLoading: entriesLoading } = useQuery<any[]>({
    queryKey: ['sessionEntries', batchId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/production-entries/session/${batchId}/entries`)
      return res.data?.data || []
    },
    enabled: !!batchId
  })

  // Consolidate batch meta information
  const allHistory = historyQueries.flatMap((q) => q.data || [])
  const batchMeta =
    activeBatches.find((b) => b.id === batchId) ||
    allHistory.find((b) => b.id === batchId) ||
    (summaryData
      ? {
          batchNumber: summaryData.batchNumber,
          product: summaryData.skuName,
          operatorName: summaryData.operatorName,
          shift: summaryData.shift,
          startedAt: summaryData.startedAt,
          completedAt: summaryData.endedAt,
          targetQuantity: 1000, // standard default
          producedQuantity: summaryData.casesProduced,
          status: summaryData.endedAt ? 'Completed' : 'Active'
        }
      : null)

  const isGlobalLoading = activeLoading || summaryLoading || entriesLoading

  if (isGlobalLoading) {
    return <EnterpriseLoading label="Loading production parameters..." />
  }

  if (!batchMeta) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[12px] border border-slate-200">
        <AlertTriangle className="w-10 h-10 text-red-500 mb-2" />
        <h2 className="text-sm font-semibold text-slate-800">Batch Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">
          The requested production run could not be resolved in the systems cache.
        </p>
        <button
          onClick={() => navigate('/company/production')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg cursor-pointer"
        >
          Return to Console
        </button>
      </div>
    )
  }

  const isCompleted = batchMeta.status === 'Completed'
  const isPaused = batchMeta.status === 'Paused'
  
  // Progress calculations
  const targetQty = batchMeta.targetQuantity || 1000
  const producedQty = summaryData?.casesProduced ?? batchMeta.producedQuantity ?? 0
  const progressPercent = Math.min(100, Math.round((producedQty / targetQty) * 100))

  // Derived summaries
  const totalEntries = entries.length
  const totalWaste = summaryData
    ? (summaryData.preformWaste || 0) +
      (summaryData.capWaste || 0) +
      (summaryData.labelWaste || 0) +
      (summaryData.shrinkWaste || 0)
    : 0
  const avgCasesPerEntry = totalEntries > 0 ? Math.round(producedQty / totalEntries) : 0
  
  const rawMaterialsConsumed = summaryData?.inventorySummary || []
  const totalMaterialsQty = rawMaterialsConsumed.reduce((acc: number, item: any) => acc + (item.Consumed || 0), 0)

  // Construct timeline events
  const timelineEvents = [
    {
      title: 'Batch Created',
      description: `Run initialized for product ${batchMeta.product}`,
      time: new Date(batchMeta.startedAt),
      color: 'blue'
    },
    {
      title: 'Operator Session Started',
      description: `Console assigned to ${batchMeta.operatorName}`,
      time: new Date(batchMeta.startedAt),
      color: 'indigo'
    }
  ]

  // Map entries to timeline events (newest first in history, but timeline is chronological)
  const entryEvents = [...entries]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((e, idx) => ({
      title: `Logged Entry #${idx + 1}`,
      description: `Produced ${e.casesProduced} cases & recorded material yields.`,
      time: new Date(e.createdAt),
      color: 'green'
    }))

  timelineEvents.push(...entryEvents)

  if (isCompleted) {
    timelineEvents.push({
      title: 'Batch Completed',
      description: `Production run locked with final yield of ${producedQty} cases.`,
      time: batchMeta.completedAt ? new Date(batchMeta.completedAt) : new Date(),
      color: 'red'
    })
  }

  // Sort timeline chronologically
  timelineEvents.sort((a, b) => a.time.getTime() - b.time.getTime())

  // Stock status helper
  const getStockStatus = (stock: number, category: string) => {
    if (stock < 0) return { label: 'Negative Stock', color: 'text-red-650 bg-red-50 border-red-200' }
    const threshold = ['INK', 'MAKEUP'].includes(category?.toUpperCase()) ? 5 : 1000
    if (stock < threshold) return { label: 'Low Stock', color: 'text-orange-600 bg-orange-50 border-orange-200' }
    return { label: 'In Stock', color: 'text-green-600 bg-green-50 border-green-200' }
  }

  return (
    <div className="flex flex-col gap-3 font-sans text-slate-900 bg-[#F8FAFC] p-3 min-h-screen">
      {/* Header toolbar card */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2 select-none">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/company/production')}
              className="h-8 px-2.5 text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <h1 className="text-[22px] font-black text-slate-900 tracking-tight">
              Batch: {batchMeta.batchNumber}
            </h1>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
              isCompleted
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : isPaused
                ? 'bg-orange-50 border-orange-200 text-orange-600'
                : 'bg-green-50 border-green-200 text-green-600'
            }`}>
              {isCompleted ? 'Completed' : isPaused ? 'Paused' : 'Running'}
            </span>
          </div>

          {/* Thin blue progress bar */}
          <div className="flex items-center gap-2.5 w-full sm:w-[240px]">
            <span className="text-[12px] font-bold text-slate-500 whitespace-nowrap">Progress:</span>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span className="text-[12px] font-black text-blue-650">{progressPercent}%</span>
          </div>
        </div>

        {/* Horizontal parameters row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-[12px] select-none">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-bold">Product SKU</span>
            <span className="text-[13px] font-bold text-slate-800 truncate block" title={batchMeta.product}>{batchMeta.product}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-bold">Production Line</span>
            <span className="text-[13px] font-bold text-slate-800 block">{batchMeta.productionLineName || 'Bottling Line'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-bold">Shift Operator</span>
            <span className="text-[13px] font-bold text-slate-800 block">{batchMeta.operatorName}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-bold">Operational Shift</span>
            <span className="text-[13px] font-bold text-slate-800 block">{batchMeta.shift} Shift</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-bold">Started Time</span>
            <span className="text-[13px] font-bold text-slate-800 block">
              {new Date(batchMeta.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-bold">Running Duration</span>
            <span className="text-[13px] font-bold text-slate-800 block">{summaryData?.Duration || '00h 00m'}</span>
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        
        {/* Left Column (Details and History) */}
        <div className="lg:col-span-2 space-y-3">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 select-none">
            <div className="bg-white border border-slate-200 rounded-lg py-2 px-3 shadow-sm text-center flex flex-col justify-center h-[54px]">
              <span className="text-lg font-black text-slate-900 leading-none">{producedQty}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Cases Produced</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg py-2 px-3 shadow-sm text-center flex flex-col justify-center h-[54px]">
              <span className="text-lg font-black text-slate-900 leading-none">{totalEntries}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Total Entries</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg py-2 px-3 shadow-sm text-center flex flex-col justify-center h-[54px]">
              <span className="text-lg font-black text-slate-900 leading-none">{totalMaterialsQty.toLocaleString()}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Material Consumed</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg py-2 px-3 shadow-sm text-center flex flex-col justify-center h-[54px]">
              <span className="text-lg font-black text-slate-900 leading-none">{totalWaste.toLocaleString()}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Total Waste</span>
            </div>
          </div>

          {/* Production Entry History */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 select-none">
              <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">Production Entry History</h2>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200 text-[#344054] font-bold select-none h-[32px]">
                    <th className="py-1 px-3 w-8"></th>
                    <th className="py-1 px-3">Time</th>
                    <th className="py-1 px-3">Operator</th>
                    <th className="py-1 px-3 text-right">Cases</th>
                    <th className="py-1 px-3 text-right">Preform</th>
                    <th className="py-1 px-3 text-right">Cap</th>
                    <th className="py-1 px-3 text-right">Label</th>
                    <th className="py-1 px-3 text-right">Shrink</th>
                    <th className="py-1 px-3 text-right">Glue</th>
                    <th className="py-1 px-3 text-right">Waste</th>
                    <th className="py-1 px-3">Status</th>
                    <th className="py-1 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {entries.length > 0 ? (
                    entries.map((item: any) => {
                      const isExpanded = expandedEntry === item.Id
                      const rowWaste = (item.preformWastage || 0) + (item.capWastage || 0) + (item.labelWastage || 0) + (item.shrinkWastage || 0)
                      return (
                        <React.Fragment key={item.Id}>
                          <tr
                            onClick={() => setExpandedEntry(isExpanded ? null : item.Id)}
                            className="hover:bg-[#F8FAFC] h-[36px] transition-colors cursor-pointer"
                          >
                            <td className="py-1 px-3 text-center">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                            </td>
                            <td className="py-1 px-3 font-bold text-slate-900">
                              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-1 px-3">{item.operatorName}</td>
                            <td className="py-1 px-3 text-right font-bold text-slate-900">{item.casesProduced}</td>
                            <td className="py-1 px-3 text-right font-mono">{item.preformUsage} {item.preformUnit}</td>
                            <td className="py-1 px-3 text-right font-mono">{item.capUsage} {item.capUnit}</td>
                            <td className="py-1 px-3 text-right font-mono">{item.labelUsage} {item.labelUnit}</td>
                            <td className="py-1 px-3 text-right font-mono">{item.shrinkUsage} {item.shrinkUnit}</td>
                            <td className="py-1 px-3 text-right font-mono">{item.glueUsage || 0} {item.glueUnit || 'KG'}</td>
                            <td className="py-1 px-3 text-right font-mono text-red-650">{rowWaste}</td>
                            <td className="py-1 px-3">
                              <span className="text-[9px] font-black text-green-600 bg-green-50 border border-green-150 px-2 py-0.5 rounded-full">
                                LOGGED
                              </span>
                            </td>
                            <td className="py-1 px-3 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpandedEntry(isExpanded ? null : item.Id)
                                }}
                                className="h-6 px-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded transition-all cursor-pointer inline-flex items-center justify-center"
                              >
                                {isExpanded ? 'Hide' : 'Inspect'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/50">
                              <td colSpan={12} className="p-2 border-t border-slate-100">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs font-semibold text-slate-650 select-none">
                                  <div className="bg-white p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5 font-bold">Preforms</span>
                                    <span className="text-slate-800">Use: {item.preformUsage} | Waste: {item.preformWastage}</span>
                                  </div>
                                  <div className="bg-white p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5 font-bold">Caps</span>
                                    <span className="text-slate-800">Use: {item.capUsage} | Waste: {item.capWastage}</span>
                                  </div>
                                  <div className="bg-white p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5 font-bold">Labels</span>
                                    <span className="text-slate-800">Use: {item.labelUsage} | Waste: {item.labelWastage}</span>
                                  </div>
                                  <div className="bg-white p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5 font-bold">Shrink Film</span>
                                    <span className="text-slate-800">Use: {item.shrinkUsage} | Waste: {item.shrinkWastage}</span>
                                  </div>
                                  <div className="bg-white p-2 rounded border border-slate-200">
                                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5 font-bold">Glue & Printer</span>
                                    <span className="text-slate-800 font-mono font-semibold">Glue: {item.glueUsage || 0} KG | Ink: {item.inkUsed ? 'YES' : 'NO'} | Makeup: {item.makeupUsed ? 'YES' : 'NO'}</span>
                                  </div>
                                  <div className="bg-white p-2 rounded border border-slate-200 col-span-3">
                                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5 font-bold">Reference GUID</span>
                                    <span className="text-slate-800 font-mono text-[10px] break-all">{item.id}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={12} className="p-4 text-center text-slate-400 italic">No logged entries found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Material Consumption cards */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2.5">
            <h2 className="text-[18px] font-bold text-slate-900 tracking-tight border-b border-slate-100 pb-1.5 select-none">
              Material Consumption
            </h2>
            {rawMaterialsConsumed.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {rawMaterialsConsumed.map((item: any) => {
                  const stockStatus = getStockStatus(item.RemainingStock, item.Category)
                  return (
                    <div key={item.MaterialName} className="bg-[#F8FAFC] border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between h-[82px]">
                      <div className="flex justify-between items-start select-none">
                        <div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">{item.Category}</span>
                          <h3 className="text-xs font-extrabold text-slate-800 truncate max-w-[120px]" title={item.MaterialName}>{item.MaterialName}</h3>
                        </div>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[11px] font-semibold text-slate-650 pt-1.5 border-t border-slate-200 mt-1">
                        <div>
                          <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Use</span>
                          <span className="text-slate-900 font-bold">{item.Consumed} {item.Unit}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Waste</span>
                          <span className="text-red-600 font-bold">{item.Waste} {item.Unit}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Stock</span>
                          <span className="text-slate-900 font-bold truncate block">{item.RemainingStock} {item.BaseUnit || item.Unit}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-slate-400 italic">No consumption records configured.</div>
            )}
          </div>

          {/* Comparative Inventory Impact Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 select-none">
              <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">Inventory Impact Matrix</h2>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200 text-[#344054] font-bold select-none h-[32px]">
                    <th className="py-1 px-3">Material</th>
                    <th className="py-1 px-3 text-right">Before (Opening)</th>
                    <th className="py-1 px-3 text-right">Consumed</th>
                    <th className="py-1 px-3 text-right">Waste</th>
                    <th className="py-1 px-3 text-right">After (Remaining)</th>
                    <th className="py-1 px-3 text-right">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {rawMaterialsConsumed.length > 0 ? (
                    rawMaterialsConsumed.map((item: any, idx: number) => {
                      const diff = (item.Consumed || 0) + (item.Waste || 0)
                      return (
                        <tr
                          key={item.MaterialName}
                          className={`h-[36px] hover:bg-[#F8FAFC] transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]/50'
                          }`}
                        >
                          <td className="py-1 px-3 font-extrabold text-slate-900">{item.MaterialName}</td>
                          <td className="py-1 px-3 text-right font-mono">{item.OpeningStock?.toLocaleString()} {item.Unit}</td>
                          <td className="py-1 px-3 text-right font-mono">{item.Consumed?.toLocaleString()} {item.Unit}</td>
                          <td className="py-1 px-3 text-right font-mono text-red-655">{item.Waste?.toLocaleString()} {item.Unit}</td>
                          <td className="py-1 px-3 text-right text-slate-900 font-mono font-bold">{item.RemainingStock?.toLocaleString()} {item.Unit}</td>
                          <td className="py-1 px-3 text-right text-red-655 font-bold font-mono">-{diff.toLocaleString()}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400 italic">No inventory summary items.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column (Sidebar Panels) */}
        <div className="space-y-3">
          
          {/* Live Chronological Timeline */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <h2 className="text-[18px] font-bold text-slate-900 tracking-tight select-none border-b border-slate-100 pb-1.5 mb-2.5">
              Timeline
            </h2>
            <div className="relative pl-4 space-y-2.5">
              <div className="absolute left-1 top-2 bottom-2 w-[1.5px] bg-blue-600"></div>

              {timelineEvents.map((ev, idx) => (
                <div key={idx} className="relative select-none text-[13px] font-semibold">
                  <div className={`absolute -left-[16.5px] top-1.5 w-2 h-2 rounded-full border border-white ${
                    ev.color === 'green' ? 'bg-green-500' : ev.color === 'indigo' ? 'bg-indigo-500' : ev.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'
                  }`}></div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">
                      {ev.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                    <h3 className="font-bold text-slate-900 tracking-tight leading-tight">{ev.title}</h3>
                    <p className="text-[12px] text-slate-500 leading-tight">{ev.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Session Details Info */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <h2 className="text-[18px] font-bold text-slate-900 tracking-tight select-none border-b border-slate-100 pb-1.5 mb-2.5">
              Session Parameter Data
            </h2>
            <div className="space-y-2 text-[13px] font-semibold text-slate-600">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-400 uppercase text-[12px] font-bold tracking-wider">Session GUID</span>
                <span className="text-slate-900 font-mono text-[12px] break-all max-w-[125px] text-right">{summaryData?.SessionId || batchId}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-400 uppercase text-[12px] font-bold tracking-wider">Session Start</span>
                <span className="text-slate-900 text-[12px]">{new Date(batchMeta.startedAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-400 uppercase text-[12px] font-bold tracking-wider">System Duration</span>
                <span className="text-slate-900 font-bold">{summaryData?.Duration || '00h 00m'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-400 uppercase text-[12px] font-bold tracking-wider">Operator Name</span>
                <span className="text-slate-900">{batchMeta.operatorName}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-400 uppercase text-[12px] font-bold tracking-wider">Active Line</span>
                <span className="text-slate-900">{batchMeta.productionLineName || 'Bottling Line'}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400 uppercase text-[12px] font-bold tracking-wider">Active Shift</span>
                <span className="text-slate-900 font-bold">{batchMeta.shift} Shift</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}

export default BatchDetailsPage
