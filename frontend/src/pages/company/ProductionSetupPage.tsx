import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { productionShiftsService, type ProductionShift, calculateShiftDuration } from '../../services/productionShifts'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'
import PageContainer from '../../components/ui/layout/PageContainer'
import EnterpriseModal from '../../components/ui/EnterpriseModal'
import EnterpriseInput from '../../components/ui/EnterpriseInput'
import EnterpriseButton from '../../components/ui/EnterpriseButton'
import EnterpriseLoading from '../../components/ui/EnterpriseLoading'
import { EnterpriseTimePicker } from '../../components/ui/EnterpriseTimePicker'
import { Sliders, Workflow, Clock, Plus, Edit2, Trash2, Power, Search } from 'lucide-react'

export const ProductionSetupPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()

  // Tab State: 'lines' | 'shifts'
  const activeTab = (searchParams.get('tab') === 'shifts' ? 'shifts' : 'lines') as 'lines' | 'shifts'

  const setActiveTab = (tab: 'lines' | 'shifts') => {
    setSearchParams({ tab })
  }

  // User Role Check
  const userRoles = (user?.roles || []).map((r: string) => r.toLowerCase().replace(/[\s_]/g, ''))
  const primaryRole = (user?.roleName || '').toLowerCase().replace(/[\s_]/g, '')
  const isOwner = userRoles.some((r: string) => ['owner', 'companyowner', 'platformowner'].includes(r)) || primaryRole === 'owner'
  const canManage = !isOwner && (
    !!user?.isPlatformAdmin ||
    userRoles.some((r: string) => ['companyadmin', 'admin', 'superadmin', 'platformadmin'].includes(r)) ||
    ['companyadmin', 'admin', 'superadmin', 'platformadmin'].includes(primaryRole)
  )

  // ─── TAB 1: PRODUCTION LINES DATA & MUTATIONS ────────────────────────────────
  const [lineSearch, setLineSearch] = useState('')
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false)
  const [isEditLineModalOpen, setIsEditLineModalOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<any | null>(null)

  const [lineName, setLineName] = useState('')
  const [lineCode, setLineCode] = useState('')
  const [lineIsActive, setLineIsActive] = useState(true)
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})

  // Queries
  const { data: productionLines = [], isLoading: linesLoading } = useQuery<any[]>({
    queryKey: ['productionLinesList'],
    queryFn: async () => (await api.get('/api/v1/production/lines?includeInactive=true')).data?.data || [],
    enabled: activeTab === 'lines'
  })

  // Line Mutations
  const createLineMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; isActive: boolean }) =>
      (await api.post('/api/v1/production/lines', data)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Line created successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionLinesList'] })
        setIsAddLineModalOpen(false)
        resetLineForm()
      } else {
        showToast(res.message || 'Failed to create Production Line.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to create Production Line.', 'error')
    }
  })

  const updateLineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; code: string; isActive: boolean } }) =>
      (await api.put(`/api/v1/production/lines/${id}`, data)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Line updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionLinesList'] })
        setIsEditLineModalOpen(false)
        setEditingLine(null)
        resetLineForm()
      } else {
        showToast(res.message || 'Failed to update Production Line.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update Production Line.', 'error')
    }
  })

  const deleteLineMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/v1/production/lines/${id}`)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Line deleted successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionLinesList'] })
      } else {
        showToast(res.message || 'Failed to delete Production Line.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to delete Production Line.', 'error')
    }
  })

  const resetLineForm = () => {
    setLineName('')
    setLineCode('')
    setLineIsActive(true)
    setLineErrors({})
  }

  const handleOpenAddLine = () => {
    resetLineForm()
    const nextNum = (productionLines.length || 0) + 1
    setLineName(`Line ${nextNum}`)
    setLineCode(`L${String(nextNum).padStart(3, '0')}`)
    setIsAddLineModalOpen(true)
  }

  const handleOpenEditLine = (line: any) => {
    setEditingLine(line)
    setLineName(line.name || '')
    setLineCode(line.code || '')
    setLineIsActive(line.isActive ?? true)
    setLineErrors({})
    setIsEditLineModalOpen(true)
  }

  const handleSaveLine = () => {
    const errs: Record<string, string> = {}
    if (!lineName.trim()) errs.name = 'Line Name is required.'
    if (!lineCode.trim()) errs.code = 'Line Code is required.'
    if (Object.keys(errs).length > 0) {
      setLineErrors(errs)
      return
    }

    if (editingLine) {
      updateLineMutation.mutate({
        id: editingLine.id || editingLine.lineId,
        data: { name: lineName.trim(), code: lineCode.trim(), isActive: lineIsActive }
      })
    } else {
      createLineMutation.mutate({
        name: lineName.trim(),
        code: lineCode.trim(),
        isActive: lineIsActive
      })
    }
  }

  const handleToggleLineStatus = (line: any) => {
    const lineId = line.id || line.lineId
    updateLineMutation.mutate({
      id: lineId,
      data: { name: line.name, code: line.code, isActive: !line.isActive }
    })
  }

  // ─── TAB 2: PRODUCTION SHIFTS DATA & MUTATIONS ───────────────────────────────
  const [shiftSearch, setShiftSearch] = useState('')
  const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false)
  const [isEditShiftModalOpen, setIsEditShiftModalOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<ProductionShift | null>(null)

  const [shiftName, setShiftName] = useState('')
  const [shiftStartTime, setShiftStartTime] = useState('06:00 AM')
  const [shiftEndTime, setShiftEndTime] = useState('02:00 PM')
  const [shiftDescription, setShiftDescription] = useState('')
  const [shiftIsActive, setShiftIsActive] = useState(true)
  const [shiftErrors, setShiftErrors] = useState<Record<string, string>>({})

  // Queries
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<ProductionShift[]>({
    queryKey: ['productionShifts'],
    queryFn: async () => {
      const res = await productionShiftsService.getAll()
      return res.data?.data || []
    },
    enabled: activeTab === 'shifts'
  })

  // Shift Mutations
  const createShiftMutation = useMutation({
    mutationFn: async (data: any) => (await productionShiftsService.create(data)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Shift created successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionShifts'] })
        setIsAddShiftModalOpen(false)
        resetShiftForm()
      } else {
        showToast(res.message || 'Failed to create Production Shift.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to create Production Shift.', 'error')
    }
  })

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      (await productionShiftsService.update(id, data)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Shift updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionShifts'] })
        setIsEditShiftModalOpen(false)
        setEditingShift(null)
        resetShiftForm()
      } else {
        showToast(res.message || 'Failed to update Production Shift.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update Production Shift.', 'error')
    }
  })

  const toggleShiftStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await productionShiftsService.patchStatus(id, isActive)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Shift status updated.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionShifts'] })
      } else {
        showToast(res.message || 'Failed to update shift status.', 'error')
      }
    }
  })

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => (await productionShiftsService.delete(id)).data,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Production Shift deleted successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['productionShifts'] })
      } else {
        showToast(res.message || 'Failed to delete shift.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to delete shift.', 'error')
    }
  })

  const resetShiftForm = () => {
    setShiftName('')
    setShiftStartTime('06:00 AM')
    setShiftEndTime('02:00 PM')
    setShiftDescription('')
    setShiftIsActive(true)
    setShiftErrors({})
  }

  const handleOpenAddShift = () => {
    resetShiftForm()
    setIsAddShiftModalOpen(true)
  }

  const handleOpenEditShift = (shift: ProductionShift) => {
    setEditingShift(shift)
    setShiftName(shift.name)
    setShiftStartTime(shift.startTime)
    setShiftEndTime(shift.endTime)
    setShiftDescription(shift.description || '')
    setShiftIsActive(shift.isActive)
    setShiftErrors({})
    setIsEditShiftModalOpen(true)
  }

  const handleSaveShift = () => {
    const errs: Record<string, string> = {}
    if (!shiftName.trim()) errs.name = 'Shift Name is required.'
    if (!shiftStartTime.trim()) errs.startTime = 'Start Time is required.'
    if (!shiftEndTime.trim()) errs.endTime = 'End Time is required.'
    if (shiftStartTime === shiftEndTime) errs.endTime = 'End Time cannot equal Start Time.'

    if (Object.keys(errs).length > 0) {
      setShiftErrors(errs)
      return
    }

    const payload = {
      name: shiftName.trim(),
      startTime: shiftStartTime,
      endTime: shiftEndTime,
      description: shiftDescription.trim(),
      isActive: shiftIsActive
    }

    if (editingShift) {
      updateShiftMutation.mutate({ id: editingShift.id, data: payload })
    } else {
      createShiftMutation.mutate(payload)
    }
  }

  // Filtered Lists
  const filteredLines = productionLines.filter((l: any) =>
    (l.name || '').toLowerCase().includes(lineSearch.toLowerCase()) ||
    (l.code || '').toLowerCase().includes(lineSearch.toLowerCase())
  )

  const filteredShifts = shifts.filter((s: ProductionShift) =>
    (s.name || '').toLowerCase().includes(shiftSearch.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(shiftSearch.toLowerCase())
  )

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <PageContainer>
      <div className="flex flex-col gap-3 max-w-[1600px] mx-auto w-full pb-4">

        {/* ══ PAGE HEADER & TOP TAB BAR ════════════════════════════════════════ */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">Production Setup</h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Manage production lines, operating shifts, and line status schedules.
            </p>
          </div>

          {/* Primary Action Button */}
          {canManage && (
            <div>
              {activeTab === 'lines' ? (
                <button
                  onClick={handleOpenAddLine}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Production Line
                </button>
              ) : (
                <button
                  onClick={handleOpenAddShift}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Production Shift
                </button>
              )}
            </div>
          )}
        </div>

        {/* ══ TAB SWITCHER & SEARCH BAR ════════════════════════════════════════ */}
        <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-md w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('lines')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeTab === 'lines'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Production Lines</span>
              <span className="ml-1 text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full text-slate-700 font-extrabold">
                {productionLines.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('shifts')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeTab === 'shifts'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Production Shifts</span>
              <span className="ml-1 text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full text-slate-700 font-extrabold">
                {shifts.length}
              </span>
            </button>
          </div>

          {/* Search Filter Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeTab === 'lines' ? "Search lines..." : "Search shifts..."}
              value={activeTab === 'lines' ? lineSearch : shiftSearch}
              onChange={(e) => activeTab === 'lines' ? setLineSearch(e.target.value) : setShiftSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ══ TAB CONTENT AREA (SINGLE VIEW SCROLL-OPTIMIZED) ═══════════════════ */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-230px)]">

          {/* ────────────── TAB 1: PRODUCTION LINES ────────────── */}
          {activeTab === 'lines' && (
            linesLoading ? (
              <div className="p-8">
                <EnterpriseLoading label="Loading production lines..." />
              </div>
            ) : filteredLines.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Workflow className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No production lines found.</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {lineSearch ? "No lines match your search filter." : "Get started by adding your first production line to the system."}
                </p>
                {canManage && !lineSearch && (
                  <button
                    onClick={handleOpenAddLine}
                    className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Production Line
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 select-none">
                    <tr>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Line Name</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Code</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Status</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Current Batch</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Operator</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLines.map((line: any) => {
                      const lineId = line.id || line.lineId
                      const isActive = line.isActive ?? true
                      const activeBatch = line.activeBatch

                      return (
                        <tr key={lineId} className="hover:bg-slate-50/70 transition-colors">
                          {/* Line Name */}
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {line.name}
                          </td>

                          {/* Code */}
                          <td className="py-2.5 px-4">
                            <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {line.code || 'L001'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Current Batch */}
                          <td className="py-2.5 px-4">
                            {activeBatch ? (
                              <button
                                onClick={() => navigate(`/company/production/batches/${activeBatch.batchId || activeBatch.id}`)}
                                className="text-left group cursor-pointer"
                              >
                                <span className="font-bold text-blue-600 group-hover:underline block leading-tight">
                                  {activeBatch.batchNumber}
                                </span>
                                <span className="text-[10px] text-slate-500 block truncate">
                                  {activeBatch.product || 'Active Run'}
                                </span>
                              </button>
                            ) : (
                              <span className="text-slate-400 font-medium text-[11px]">Idle (No active batch)</span>
                            )}
                          </td>

                          {/* Operator */}
                          <td className="py-2.5 px-4 font-medium text-slate-700">
                            {activeBatch?.operatorName || '—'}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-right">
                            {canManage ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEditLine(line)}
                                  title="Edit Line"
                                  className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleToggleLineStatus(line)}
                                  title={isActive ? "Deactivate Line" : "Activate Line"}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    isActive
                                      ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                      : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete '${line.name}'?`)) {
                                      deleteLineMutation.mutate(lineId)
                                    }
                                  }}
                                  title="Delete Line"
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Read-only</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ────────────── TAB 2: PRODUCTION SHIFTS ────────────── */}
          {activeTab === 'shifts' && (
            shiftsLoading ? (
              <div className="p-8">
                <EnterpriseLoading label="Loading production shifts..." />
              </div>
            ) : filteredShifts.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Clock className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No production shifts found.</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {shiftSearch ? "No shifts match your search filter." : "Get started by adding operating shifts for your facility."}
                </p>
                {canManage && !shiftSearch && (
                  <button
                    onClick={handleOpenAddShift}
                    className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Production Shift
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 select-none">
                    <tr>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Shift Name</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Schedule / Timing</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Duration</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Status</th>
                      <th className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredShifts.map((shift: ProductionShift) => {
                      const duration = calculateShiftDuration(shift.startTime, shift.endTime)

                      return (
                        <tr key={shift.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Shift Name */}
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-slate-900 block leading-tight">{shift.name}</span>
                            {shift.description && (
                              <span className="text-[10px] text-slate-500 block truncate max-w-xs mt-0.5">{shift.description}</span>
                            )}
                          </td>

                          {/* Schedule */}
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                            {shift.startTime} – {shift.endTime}
                          </td>

                          {/* Duration */}
                          <td className="py-2.5 px-4">
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {duration}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                shift.isActive
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${shift.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                              {shift.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-right">
                            {canManage ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEditShift(shift)}
                                  title="Edit Shift"
                                  className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => toggleShiftStatusMutation.mutate({ id: shift.id, isActive: !shift.isActive })}
                                  title={shift.isActive ? "Deactivate Shift" : "Activate Shift"}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    shift.isActive
                                      ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                      : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete '${shift.name}'?`)) {
                                      deleteShiftMutation.mutate(shift.id)
                                    }
                                  }}
                                  title="Delete Shift"
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Read-only</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

        </div>

      </div>

      {/* ══ MODALS: ADD / EDIT PRODUCTION LINE ══════════════════════════════════ */}
      <EnterpriseModal
        isOpen={isAddLineModalOpen || isEditLineModalOpen}
        onClose={() => { setIsAddLineModalOpen(false); setIsEditLineModalOpen(false); resetLineForm(); }}
        title={isEditLineModalOpen ? "Edit Production Line" : "Add Production Line"}
        maxWidth="sm"
      >
        <div className="flex flex-col gap-3">
          <EnterpriseInput
            label="Line Name *"
            placeholder="e.g. Line 1"
            value={lineName}
            onChange={(e) => setLineName(e.target.value)}
            error={lineErrors.name}
            required
          />

          <EnterpriseInput
            label="Line Code *"
            placeholder="e.g. L001"
            value={lineCode}
            onChange={(e) => setLineCode(e.target.value)}
            error={lineErrors.code}
            required
          />

          <div className="flex items-center gap-2 pt-1 select-none">
            <input
              type="checkbox"
              id="lineActiveCheck"
              checked={lineIsActive}
              onChange={(e) => setLineIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="lineActiveCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
              Active Line (Available for production assignment)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setIsAddLineModalOpen(false); setIsEditLineModalOpen(false); resetLineForm(); }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <EnterpriseButton
              onClick={handleSaveLine}
              loading={createLineMutation.isPending || updateLineMutation.isPending}
            >
              {isEditLineModalOpen ? 'Save Changes' : 'Create Line'}
            </EnterpriseButton>
          </div>
        </div>
      </EnterpriseModal>

      {/* ══ MODALS: ADD / EDIT PRODUCTION SHIFT ═════════════════════════════════ */}
      <EnterpriseModal
        isOpen={isAddShiftModalOpen || isEditShiftModalOpen}
        onClose={() => { setIsAddShiftModalOpen(false); setIsEditShiftModalOpen(false); resetShiftForm(); }}
        title={isEditShiftModalOpen ? "Edit Production Shift" : "Add Production Shift"}
        maxWidth="md"
      >
        <div className="flex flex-col gap-3">
          <EnterpriseInput
            label="Shift Name *"
            placeholder="e.g. Morning Shift"
            value={shiftName}
            onChange={(e) => setShiftName(e.target.value)}
            error={shiftErrors.name}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Start Time *</label>
              <EnterpriseTimePicker
                value={shiftStartTime}
                onChange={setShiftStartTime}
                error={shiftErrors.startTime}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">End Time *</label>
              <EnterpriseTimePicker
                value={shiftEndTime}
                onChange={setShiftEndTime}
                error={shiftErrors.endTime}
              />
            </div>
          </div>

          {/* Calculated Duration Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-2 flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-500">Calculated Shift Duration:</span>
            <span className="font-bold text-blue-700">{calculateShiftDuration(shiftStartTime, shiftEndTime)}</span>
          </div>

          <EnterpriseInput
            label="Description (Optional)"
            placeholder="e.g. Standard morning production operating window"
            value={shiftDescription}
            onChange={(e) => setShiftDescription(e.target.value)}
          />

          <div className="flex items-center gap-2 pt-1 select-none">
            <input
              type="checkbox"
              id="shiftActiveCheck"
              checked={shiftIsActive}
              onChange={(e) => setShiftIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="shiftActiveCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
              Active Shift
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setIsAddShiftModalOpen(false); setIsEditShiftModalOpen(false); resetShiftForm(); }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <EnterpriseButton
              onClick={handleSaveShift}
              loading={createShiftMutation.isPending || updateShiftMutation.isPending}
            >
              {isEditShiftModalOpen ? 'Save Changes' : 'Create Shift'}
            </EnterpriseButton>
          </div>
        </div>
      </EnterpriseModal>

    </PageContainer>
  )
}

export default ProductionSetupPage
