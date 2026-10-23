import PageContainer from '../../components/ui/layout/PageContainer';
import PageHeader from '../../components/ui/layout/PageHeader';
import KPICard from '../../components/ui/layout/KPICard';
import FilterBar from '../../components/ui/layout/FilterBar';
import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { operationsIssueApi } from '../../services/api/operationsIssue'
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp, Package, Clock, User, Calendar, History, Box, FileText, CheckCircle2, PlayCircle, Layers, Wrench, ShieldCheck, Square, Loader2, Plus, Trash2 } from 'lucide-react'
import EnterpriseLoading from '../../components/ui/EnterpriseLoading'
import EnterpriseModal from '../../components/ui/EnterpriseModal'
import { useStationConfig } from '../../hooks/useStationConfig'
import { useAuthStore } from '../../store/useAuthStore'
import { BatchDetailView } from '../../components/batch'

export interface MaterialRow {
  id: string
  rawMaterialId: string
  usageQuantity: string
  wastageQuantity: string
}

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

const isDecimalUnit = (unit?: string | null): boolean => {
  const u = (unit || '').toUpperCase()
  return u === 'KG' || u === 'KGS' || u === 'GRAM' || u === 'GRAMS' || u === 'GM' || u === 'G' || u === 'LITRE' || u === 'L' || u.includes('KG') || u.includes('GM') || u.includes('LIT')
}

interface StationMaterialCardProps {
  stationName: string
  stationBadge: string
  borderAccentColor: string
  badgeColorClass: string
  eligibleMaterials: any[]
  rows: MaterialRow[]
  onAddRow: () => void
  onRemoveRow: (rowId: string) => void
  onUpdateRow: (rowId: string, field: keyof MaterialRow, val: string) => void
  rawMaterials: any[]
  isIntegerUsage?: boolean
  hideWastage?: boolean
  addLabelText?: string
  fullWidth?: boolean
}

const StationMaterialCard: React.FC<StationMaterialCardProps> = ({
  stationName,
  stationBadge,
  borderAccentColor,
  badgeColorClass,
  eligibleMaterials,
  rows,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  rawMaterials,
  isIntegerUsage = false,
  hideWastage = false,
  addLabelText = '+ Add Material',
  fullWidth = false,
}) => {
  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${borderAccentColor} rounded-xl p-3.5 shadow-2xs flex flex-col gap-3 ${fullWidth ? 'md:col-span-2' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            {stationName}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeColorClass}`}>
            {stationBadge}
          </span>
        </div>
        <button
          type="button"
          onClick={onAddRow}
          disabled={eligibleMaterials.length === 0}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3" />
          <span>{addLabelText}</span>
        </button>
      </div>

      {/* If no materials exist */}
      {eligibleMaterials.length === 0 ? (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 font-medium">
          No active {stationBadge} materials found in inventory.
        </div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3 text-center flex items-center justify-between">
          <span>No material added for this station.</span>
          <button
            type="button"
            onClick={onAddRow}
            className="text-blue-600 hover:underline font-semibold text-[11px] cursor-pointer"
          >
            {addLabelText}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((row, idx) => {
            const selectedMat = rawMaterials.find((m: any) => m.id === row.rawMaterialId)
            const unitLabel = selectedMat ? (selectedMat.unit?.trim() || 'No Unit') : '—'
            const stockVal = selectedMat ? Number(selectedMat.currentStock || 0) : null

            return (
              <div
                key={row.id}
                className="p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg flex flex-col gap-2"
              >
                {/* Row Header & Material Selector */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Material {rows.length > 1 ? `#${idx + 1}` : ''} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={row.rawMaterialId}
                      onChange={(e) => onUpdateRow(row.id, 'rawMaterialId', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Select Material --</option>
                      {eligibleMaterials.map((m: any) => {
                        const isAlreadySelected = rows.some((r) => r.id !== row.id && r.rawMaterialId === m.id)
                        return (
                          <option key={m.id} value={m.id} disabled={isAlreadySelected}>
                            {m.name} — {m.unit || 'Unit'} (Stock: {Number(m.currentStock || 0).toLocaleString()})
                            {isAlreadySelected ? ' [Already Added]' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div className="flex items-end gap-2 pt-4">
                    {stockVal !== null && (
                      <span className="text-[10px] font-mono text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                        Stock: <strong className="text-slate-900">{stockVal.toLocaleString()} {unitLabel}</strong>
                      </span>
                    )}

                    {(rows.length > 1 || hideWastage) && (
                      <button
                        type="button"
                        onClick={() => onRemoveRow(row.id)}
                        title="Remove Material"
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quantities Grid */}
                <div className={`grid ${hideWastage ? 'grid-cols-1' : 'grid-cols-2'} gap-2 pt-1 border-t border-slate-200/60`}>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Usage ({unitLabel})
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step={isIntegerUsage && !isDecimalUnit(unitLabel) ? '1' : 'any'}
                        placeholder={isIntegerUsage && !isDecimalUnit(unitLabel) ? '0' : '0.00'}
                        value={row.usageQuantity}
                        onChange={(e) => onUpdateRow(row.id, 'usageQuantity', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 pr-12"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                        {unitLabel}
                      </span>
                    </div>
                  </div>

                  {!hideWastage && (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                        Wastage ({unitLabel})
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step={isDecimalUnit(unitLabel) ? 'any' : '1'}
                          placeholder="0"
                          value={row.wastageQuantity}
                          onChange={(e) => onUpdateRow(row.id, 'wastageQuantity', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 pr-10"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                          {unitLabel}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export const BatchDetailsPage: React.FC = () => {
  const params = useParams<{ batchId?: string; id?: string }>()
  const batchId = params.batchId || params.id || ''
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

  // ── Production Raw Materials Query ──────────────────────────────────────────
  const { data: rawMaterials = [], isLoading: rawMaterialsLoading } = useQuery<any[]>({
    queryKey: ['productionRawMaterials'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v1/production-entries/materials')
        if (res.data?.success && Array.isArray(res.data.data)) {
          return res.data.data
        }
      } catch (err) {
        console.error('Failed to load raw materials for production', err)
      }
      return []
    }
  })

  // ── Station Material Category Filtering ─────────────────────────────────────
  const eligiblePreforms = useMemo(() => {
    return rawMaterials.filter((m: any) => {
      const cat = (m.category || '').toUpperCase()
      const name = (m.name || '').toUpperCase()
      return cat.includes('PREFORM') || name.includes('PREFORM')
    })
  }, [rawMaterials])

  const eligibleCaps = useMemo(() => {
    return rawMaterials.filter((m: any) => {
      const cat = (m.category || '').toUpperCase()
      const name = (m.name || '').toUpperCase()
      return cat.includes('CAP') || name.includes('CAP')
    })
  }, [rawMaterials])

  const eligibleLabels = useMemo(() => {
    return rawMaterials.filter((m: any) => {
      const cat = (m.category || '').toUpperCase()
      const name = (m.name || '').toUpperCase()
      return cat.includes('LABEL') || cat.includes('BOPP') || name.includes('LABEL') || name.includes('BOPP')
    })
  }, [rawMaterials])

  const eligibleShrinks = useMemo(() => {
    return rawMaterials.filter((m: any) => {
      const cat = (m.category || '').toUpperCase()
      const name = (m.name || '').toUpperCase()
      return cat.includes('SHRINK') || cat.includes('FILM') || name.includes('SHRINK') || name.includes('FILM')
    })
  }, [rawMaterials])

  const eligibleGlues = useMemo(() => {
    return rawMaterials.filter((m: any) => {
      const cat = (m.category || '').toUpperCase()
      const name = (m.name || '').toUpperCase()
      return cat.includes('GLUE') || name.includes('GLUE')
    })
  }, [rawMaterials])

  // ── Station-specific Add Entry State ────────────────────────────────────────
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false)
  const [addEntryCases, setAddEntryCases] = useState('')
  const [isAddingEntry, setIsAddingEntry] = useState(false)
  const [addEntryError, setAddEntryError] = useState<string | null>(null)

  // Dynamic Station Material Rows State
  const [blowingRows, setBlowingRows] = useState<MaterialRow[]>([])
  const [fillingRows, setFillingRows] = useState<MaterialRow[]>([])
  const [labelingRows, setLabelingRows] = useState<MaterialRow[]>([])
  const [packingRows, setPackingRows] = useState<MaterialRow[]>([])
  const [glueRows, setGlueRows] = useState<MaterialRow[]>([])

  // Row Manipulation Handlers
  const handleAddRow = (
    setter: React.Dispatch<React.SetStateAction<MaterialRow[]>>,
    prefix: string,
    eligibleList: any[]
  ) => {
    setter(prev => {
      const selected = new Set(prev.map(r => r.rawMaterialId))
      const nextMat = eligibleList.find(m => !selected.has(m.id)) || eligibleList[0]
      return [
        ...prev,
        {
          id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          rawMaterialId: nextMat ? nextMat.id : '',
          usageQuantity: '',
          wastageQuantity: ''
        }
      ]
    })
  }

  const handleRemoveRow = (
    setter: React.Dispatch<React.SetStateAction<MaterialRow[]>>,
    rowId: string
  ) => {
    setter(prev => prev.filter(r => r.id !== rowId))
  }

  const handleUpdateRow = (
    setter: React.Dispatch<React.SetStateAction<MaterialRow[]>>,
    rowId: string,
    field: keyof MaterialRow,
    value: string
  ) => {
    setter(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r))
  }

  // Initialize Station Material Rows when modal is opened
  useEffect(() => {
    if (isAddEntryModalOpen) {
      if (isBlowingEnabled && blowingRows.length === 0) {
        setBlowingRows([
          { id: `blow-${Date.now()}-0`, rawMaterialId: eligiblePreforms[0]?.id || '', usageQuantity: '', wastageQuantity: '' }
        ])
      }
      if (isFillingEnabled && fillingRows.length === 0) {
        setFillingRows([
          { id: `fill-${Date.now()}-0`, rawMaterialId: eligibleCaps[0]?.id || '', usageQuantity: '', wastageQuantity: '' }
        ])
      }
      if (isLabelingEnabled && labelingRows.length === 0) {
        setLabelingRows([
          { id: `label-${Date.now()}-0`, rawMaterialId: eligibleLabels[0]?.id || '', usageQuantity: '', wastageQuantity: '' }
        ])
      }
      if (isPackingEnabled && packingRows.length === 0) {
        setPackingRows([
          { id: `pack-${Date.now()}-0`, rawMaterialId: eligibleShrinks[0]?.id || '', usageQuantity: '', wastageQuantity: '' }
        ])
      }
      if (isPackingEnabled && glueRows.length === 0 && eligibleGlues.length > 0) {
        setGlueRows([
          { id: `glue-${Date.now()}-0`, rawMaterialId: eligibleGlues[0]?.id || '', usageQuantity: '', wastageQuantity: '0' }
        ])
      }
    }
  }, [
    isAddEntryModalOpen,
    isBlowingEnabled,
    isFillingEnabled,
    isLabelingEnabled,
    isPackingEnabled,
    eligiblePreforms,
    eligibleCaps,
    eligibleLabels,
    eligibleShrinks,
    eligibleGlues
  ])

  // If rawMaterials finish loading while modal is open and a row is missing its material ID, assign the first eligible one
  useEffect(() => {
    if (isAddEntryModalOpen) {
      if (eligiblePreforms.length > 0) {
        setBlowingRows(prev => prev.map(r => !r.rawMaterialId ? { ...r, rawMaterialId: eligiblePreforms[0].id } : r))
      }
      if (eligibleCaps.length > 0) {
        setFillingRows(prev => prev.map(r => !r.rawMaterialId ? { ...r, rawMaterialId: eligibleCaps[0].id } : r))
      }
      if (eligibleLabels.length > 0) {
        setLabelingRows(prev => prev.map(r => !r.rawMaterialId ? { ...r, rawMaterialId: eligibleLabels[0].id } : r))
      }
      if (eligibleShrinks.length > 0) {
        setPackingRows(prev => prev.map(r => !r.rawMaterialId ? { ...r, rawMaterialId: eligibleShrinks[0].id } : r))
      }
      if (eligibleGlues.length > 0) {
        setGlueRows(prev => prev.map(r => !r.rawMaterialId ? { ...r, rawMaterialId: eligibleGlues[0].id } : r))
      }
    }
  }, [isAddEntryModalOpen, eligiblePreforms, eligibleCaps, eligibleLabels, eligibleShrinks, eligibleGlues])

  const resetEntryModal = () => {
    setAddEntryCases('')
    setBlowingRows([])
    setFillingRows([])
    setLabelingRows([])
    setPackingRows([])
    setGlueRows([])
    setAddEntryError(null)
    setIsAddEntryModalOpen(false)
  }

  const handleAddEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addEntryCases || Number(addEntryCases) <= 0) {
      setAddEntryError('Please enter a valid quantity of cases produced.')
      return
    }

    const materialsPayload: { rawMaterialId: string; usageQuantity: number; wastageQuantity: number }[] = []

    // 1. Blowing Station (Preforms: Bags usage, PCS wastage)
    if (isBlowingEnabled) {
      for (const row of blowingRows) {
        if (!row.rawMaterialId) continue
        const mat = rawMaterials.find((m: any) => m.id === row.rawMaterialId)
        const name = mat?.name || 'Preform'
        const usage = row.usageQuantity === '' ? 0 : parseFloat(row.usageQuantity)
        const waste = row.wastageQuantity === '' ? 0 : parseFloat(row.wastageQuantity)

        if (isNaN(usage) || usage < 0 || isNaN(waste) || waste < 0) {
          setAddEntryError(`Quantities for "${name}" cannot be negative.`)
          return
        }
        const unit = mat?.unit?.trim() || 'Units'
        if (!isDecimalUnit(unit) && (!Number.isInteger(usage) || !Number.isInteger(waste))) {
          setAddEntryError(`Usage and wastage (${unit}) for "${name}" must be whole numbers.`)
          return
        }
        if (usage > 0 || waste > 0) {
          materialsPayload.push({
            rawMaterialId: row.rawMaterialId,
            usageQuantity: usage,
            wastageQuantity: waste
          })
        }
      }
    }

    // 2. Filling Station (Caps)
    if (isFillingEnabled) {
      for (const row of fillingRows) {
        if (!row.rawMaterialId) continue
        const mat = rawMaterials.find((m: any) => m.id === row.rawMaterialId)
        const name = mat?.name || 'Cap'
        const usage = row.usageQuantity === '' ? 0 : parseFloat(row.usageQuantity)
        const waste = row.wastageQuantity === '' ? 0 : parseFloat(row.wastageQuantity)

        if (isNaN(usage) || usage < 0 || isNaN(waste) || waste < 0) {
          setAddEntryError(`Quantities for "${name}" cannot be negative.`)
          return
        }
        const unit = mat?.unit?.trim() || 'Units'
        if (!isDecimalUnit(unit) && (!Number.isInteger(usage) || !Number.isInteger(waste))) {
          setAddEntryError(`Usage and wastage (${unit}) for "${name}" must be whole numbers.`)
          return
        }
        if (usage > 0 || waste > 0) {
          materialsPayload.push({
            rawMaterialId: row.rawMaterialId,
            usageQuantity: usage,
            wastageQuantity: waste
          })
        }
      }
    }

    // 3. Labelling Station (Labels)
    if (isLabelingEnabled) {
      for (const row of labelingRows) {
        if (!row.rawMaterialId) continue
        const mat = rawMaterials.find((m: any) => m.id === row.rawMaterialId)
        const name = mat?.name || 'Label'
        const usage = row.usageQuantity === '' ? 0 : parseFloat(row.usageQuantity)
        const waste = row.wastageQuantity === '' ? 0 : parseFloat(row.wastageQuantity)

        if (isNaN(usage) || usage < 0 || isNaN(waste) || waste < 0) {
          setAddEntryError(`Quantities for "${name}" cannot be negative.`)
          return
        }
        const unit = mat?.unit?.trim() || 'Units'
        if (!isDecimalUnit(unit) && !Number.isInteger(waste)) {
          setAddEntryError(`Wastage (${unit}) for "${name}" must be a whole number.`)
          return
        }
        if (usage > 0 || waste > 0) {
          materialsPayload.push({
            rawMaterialId: row.rawMaterialId,
            usageQuantity: usage,
            wastageQuantity: waste
          })
        }
      }
    }

    // 4. Packing Station (Shrink Film)
    if (isPackingEnabled) {
      for (const row of packingRows) {
        if (!row.rawMaterialId) continue
        const mat = rawMaterials.find((m: any) => m.id === row.rawMaterialId)
        const name = mat?.name || 'Shrink Film'
        const usage = row.usageQuantity === '' ? 0 : parseFloat(row.usageQuantity)
        const waste = row.wastageQuantity === '' ? 0 : parseFloat(row.wastageQuantity)

        if (isNaN(usage) || usage < 0 || isNaN(waste) || waste < 0) {
          setAddEntryError(`Quantities for "${name}" cannot be negative.`)
          return
        }
        const unit = mat?.unit?.trim() || 'Units'
        if (!isDecimalUnit(unit) && !Number.isInteger(waste)) {
          setAddEntryError(`Wastage (${unit}) for "${name}" must be a whole number.`)
          return
        }
        if (usage > 0 || waste > 0) {
          materialsPayload.push({
            rawMaterialId: row.rawMaterialId,
            usageQuantity: usage,
            wastageQuantity: waste
          })
        }
      }
    }

    // 5. Glue (Usage in configured unit)
    if (isPackingEnabled) {
      for (const row of glueRows) {
        if (!row.rawMaterialId) continue
        const mat = rawMaterials.find((m: any) => m.id === row.rawMaterialId)
        const name = mat?.name || 'Glue'
        const usage = row.usageQuantity === '' ? 0 : parseFloat(row.usageQuantity)

        if (isNaN(usage) || usage < 0) {
          setAddEntryError(`Quantity for "${name}" cannot be negative.`)
          return
        }
        if (usage > 0) {
          materialsPayload.push({
            rawMaterialId: row.rawMaterialId,
            usageQuantity: usage,
            wastageQuantity: 0
          })
        }
      }
    }

    // Duplicate check across entire payload
    const distinctMatIds = new Set(materialsPayload.map(m => m.rawMaterialId))
    if (distinctMatIds.size !== materialsPayload.length) {
      setAddEntryError('A raw material cannot be selected multiple times in a single production entry.')
      return
    }

    // Calculate legacy compatibility values
    const primaryPreform = blowingRows[0]?.rawMaterialId ? blowingRows[0] : null
    const primaryCap = fillingRows[0]?.rawMaterialId ? fillingRows[0] : null
    const primaryLabel = labelingRows[0]?.rawMaterialId ? labelingRows[0] : null
    const primaryShrink = packingRows[0]?.rawMaterialId ? packingRows[0] : null
    const primaryGlue = glueRows[0]?.rawMaterialId ? glueRows[0] : null

    const totalPreformUsage = blowingRows.reduce((acc, r) => acc + (parseFloat(r.usageQuantity) || 0), 0)
    const totalPreformWastage = blowingRows.reduce((acc, r) => acc + (parseFloat(r.wastageQuantity) || 0), 0)
    const totalCapUsage = fillingRows.reduce((acc, r) => acc + (parseFloat(r.usageQuantity) || 0), 0)
    const totalCapWastage = fillingRows.reduce((acc, r) => acc + (parseFloat(r.wastageQuantity) || 0), 0)
    const totalLabelUsage = labelingRows.reduce((acc, r) => acc + (parseFloat(r.usageQuantity) || 0), 0)
    const totalLabelWastage = labelingRows.reduce((acc, r) => acc + (parseFloat(r.wastageQuantity) || 0), 0)
    const totalShrinkUsage = packingRows.reduce((acc, r) => acc + (parseFloat(r.usageQuantity) || 0), 0)
    const totalShrinkWastage = packingRows.reduce((acc, r) => acc + (parseFloat(r.wastageQuantity) || 0), 0)
    const totalGlueUsage = glueRows.reduce((acc, r) => acc + (parseFloat(r.usageQuantity) || 0), 0)

    setIsAddingEntry(true)
    setAddEntryError(null)

    try {
      await api.post('/api/v1/production-entries', {
        batchId: batchId,
        batchSessionId: batchMeta?.sessionId || batchId,
        productionLineId: batchMeta?.productionLineId,
        shift: batchMeta?.shift || 'Morning',
        casesProduced: Number(addEntryCases),
        operatorName: batchMeta?.operatorName || user?.fullName || 'Operator',
        materials: materialsPayload,
        // Station-specific backward compatibility properties
        preformMaterialId: isBlowingEnabled && primaryPreform ? primaryPreform.rawMaterialId : null,
        preformUsage: isBlowingEnabled ? totalPreformUsage : 0,
        preformWastage: isBlowingEnabled ? totalPreformWastage : 0,
        capMaterialId: isFillingEnabled && primaryCap ? primaryCap.rawMaterialId : null,
        capUsage: isFillingEnabled ? totalCapUsage : 0,
        capWastage: isFillingEnabled ? totalCapWastage : 0,
        labelMaterialId: isLabelingEnabled && primaryLabel ? primaryLabel.rawMaterialId : null,
        labelUsage: isLabelingEnabled ? totalLabelUsage : 0,
        labelWastage: isLabelingEnabled ? totalLabelWastage : 0,
        shrinkMaterialId: isPackingEnabled && primaryShrink ? primaryShrink.rawMaterialId : null,
        shrinkUsage: isPackingEnabled ? totalShrinkUsage : 0,
        shrinkWastage: isPackingEnabled ? totalShrinkWastage : 0,
        glueMaterialId: isPackingEnabled && primaryGlue ? primaryGlue.rawMaterialId : null,
        glueUsage: isPackingEnabled && totalGlueUsage > 0 ? totalGlueUsage : null
      })

      setIsAddingEntry(false)
      resetEntryModal()
      setStopSuccessMsg('Production entry and raw material stock movements recorded successfully.')

      queryClient.invalidateQueries({ queryKey: ['batchEntries', batchId] })
      queryClient.invalidateQueries({ queryKey: ['sessionSummary', batchId] })
      queryClient.invalidateQueries({ queryKey: ['sessionEntries', batchId] })
      queryClient.invalidateQueries({ queryKey: ['activeBatchesList'] })
      queryClient.invalidateQueries({ queryKey: ['productionBatchById', batchId] })
      queryClient.invalidateQueries({ queryKey: ['productionRawMaterials'] })
      queryClient.invalidateQueries({ queryKey: ['lineHistory'] })
    } catch (err: any) {
      setIsAddingEntry(false)
      const msg = err.response?.data?.message || err.message || 'Failed to add entry. Please try again.'
      setAddEntryError(msg)
    }
  }

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

  const {
    data: entries = [],
    isLoading: entriesLoading,
    isError: isEntriesError,
    error: entriesErrorObj,
    refetch: refetchEntries
  } = useQuery<any[]>({
    queryKey: ['batchEntries', batchId],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/v1/production/batches/${batchId}/entries`)
        if (res.data?.success && Array.isArray(res.data.data)) {
          return res.data.data
        }
      } catch (e: any) {
        try {
          const fallbackRes = await api.get(`/api/v1/production-entries/session/${batchId}/entries`)
          if (fallbackRes.data?.success && Array.isArray(fallbackRes.data.data)) {
            return fallbackRes.data.data
          }
        } catch (innerErr) {
          throw e
        }
      }
      return []
    },
    enabled: !!batchId
  })

  const { data: directBatchData, isLoading: directBatchLoading } = useQuery<any>({
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

  if ((directBatchLoading || activeLoading) && !batchMeta) {
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
        entriesLoading={entriesLoading}
        entriesError={isEntriesError ? ((entriesErrorObj as any)?.response?.data?.message || (entriesErrorObj as any)?.message || 'Failed to load entries.') : null}
        onRetryEntries={() => refetchEntries()}
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
          setAddEntryCases('')
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
        onClose={() => !isAddingEntry && resetEntryModal()}
        title="Add Production Entry"
        maxWidth="lg"
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

          {/* ── STATION-SPECIFIC MATERIAL CONSUMPTION SECTION ── */}
          <div className="pt-2 border-t border-slate-200 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Station Material Consumption
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Inputs strictly reflect stations enabled for this line. Inventory deduction = Usage quantity only.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono font-medium self-start sm:self-auto">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Usage deducts stock • Wastage tracked for QA</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {/* 1. BLOWING STATION (Preforms) */}
              {isBlowingEnabled && (
                <StationMaterialCard
                  stationName="Blowing Station"
                  stationBadge="Preforms"
                  borderAccentColor="border-l-blue-500"
                  badgeColorClass="text-blue-700 bg-blue-50 border-blue-200"
                  eligibleMaterials={eligiblePreforms}
                  rows={blowingRows}
                  onAddRow={() => handleAddRow(setBlowingRows, 'blow', eligiblePreforms)}
                  onRemoveRow={(rowId) => handleRemoveRow(setBlowingRows, rowId)}
                  onUpdateRow={(rowId, field, val) => handleUpdateRow(setBlowingRows, rowId, field, val)}
                  rawMaterials={rawMaterials}
                  isIntegerUsage={true}
                  addLabelText="+ Add Preform"
                />
              )}

              {/* 2. FILLING STATION (Caps) */}
              {isFillingEnabled && (
                <StationMaterialCard
                  stationName="Filling Station"
                  stationBadge="Caps"
                  borderAccentColor="border-l-emerald-500"
                  badgeColorClass="text-emerald-700 bg-emerald-50 border-emerald-200"
                  eligibleMaterials={eligibleCaps}
                  rows={fillingRows}
                  onAddRow={() => handleAddRow(setFillingRows, 'fill', eligibleCaps)}
                  onRemoveRow={(rowId) => handleRemoveRow(setFillingRows, rowId)}
                  onUpdateRow={(rowId, field, val) => handleUpdateRow(setFillingRows, rowId, field, val)}
                  rawMaterials={rawMaterials}
                  isIntegerUsage={true}
                  addLabelText="+ Add Cap"
                />
              )}

              {/* 3. LABELLING STATION (Labels) */}
              {isLabelingEnabled && (
                <StationMaterialCard
                  stationName="Labelling Station"
                  stationBadge="Labels"
                  borderAccentColor="border-l-purple-500"
                  badgeColorClass="text-purple-700 bg-purple-50 border-purple-200"
                  eligibleMaterials={eligibleLabels}
                  rows={labelingRows}
                  onAddRow={() => handleAddRow(setLabelingRows, 'label', eligibleLabels)}
                  onRemoveRow={(rowId) => handleRemoveRow(setLabelingRows, rowId)}
                  onUpdateRow={(rowId, field, val) => handleUpdateRow(setLabelingRows, rowId, field, val)}
                  rawMaterials={rawMaterials}
                  isIntegerUsage={false}
                  addLabelText="+ Add Label Roll"
                />
              )}

              {/* 4. PACKING STATION (Shrink Film) */}
              {isPackingEnabled && (
                <StationMaterialCard
                  stationName="Packing Station"
                  stationBadge="Shrink Film"
                  borderAccentColor="border-l-amber-500"
                  badgeColorClass="text-amber-700 bg-amber-50 border-amber-200"
                  eligibleMaterials={eligibleShrinks}
                  rows={packingRows}
                  onAddRow={() => handleAddRow(setPackingRows, 'pack', eligibleShrinks)}
                  onRemoveRow={(rowId) => handleRemoveRow(setPackingRows, rowId)}
                  onUpdateRow={(rowId, field, val) => handleUpdateRow(setPackingRows, rowId, field, val)}
                  rawMaterials={rawMaterials}
                  isIntegerUsage={false}
                  addLabelText="+ Add Shrink Film"
                />
              )}

              {/* 5. GLUE & CONSUMABLES */}
              {isPackingEnabled && eligibleGlues.length > 0 && (
                <StationMaterialCard
                  stationName="Packing Consumables"
                  stationBadge="Glue / Consumables"
                  borderAccentColor="border-l-slate-400"
                  badgeColorClass="text-slate-700 bg-slate-100 border-slate-200"
                  eligibleMaterials={eligibleGlues}
                  rows={glueRows}
                  onAddRow={() => handleAddRow(setGlueRows, 'glue', eligibleGlues)}
                  onRemoveRow={(rowId) => handleRemoveRow(setGlueRows, rowId)}
                  onUpdateRow={(rowId, field, val) => handleUpdateRow(setGlueRows, rowId, field, val)}
                  rawMaterials={rawMaterials}
                  isIntegerUsage={false}
                  hideWastage={true}
                  addLabelText="+ Add Consumable"
                  fullWidth={true}
                />
              )}

              {/* Notice if all stations disabled */}
              {!isBlowingEnabled && !isFillingEnabled && !isLabelingEnabled && !isPackingEnabled && (
                <div className="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-xl p-5 text-center text-xs text-slate-500">
                  All production stations are currently disabled in production configuration. Only cases produced will be recorded.
                </div>
              )}
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
              onClick={resetEntryModal}
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

