import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore } from '../store/useThemeStore'
import { useNotificationStore } from '../store/useNotificationStore'
import ToastContainer from '../components/ui/ToastContainer'
import { LogOut, Calendar, Clock, Check, ChevronDown, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { getLineTheme } from '../utils/lineTheme'

export const OperatorLayout: React.FC = () => {
  const { user, clearAuth } = useAuthStore()
  const { initTheme } = useThemeStore()
  const { showToast } = useNotificationStore()
  const navigate = useNavigate()

  // State managed globally in layout and shared with child pages via context
  const [selectedLine, setSelectedLine] = useState<any>(null)
  const [selectedShift, setSelectedShift] = useState<string | null>(null)

  const [isLineDropdownOpen, setIsLineDropdownOpen] = useState(false)
  const [hasUnsavedData, setHasUnsavedData] = useState(false)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [pendingLineSwitch, setPendingLineSwitch] = useState<any>(null)

  const saveHandlerRef = useRef<(() => Promise<boolean>) | null>(null)
  const discardHandlerRef = useRef<(() => void) | null>(null)

  const registerSaveHandler = (handler: () => Promise<boolean>) => {
    saveHandlerRef.current = handler
  }

  const registerDiscardHandler = (handler: () => void) => {
    discardHandlerRef.current = handler
  }

  // Fetch production lines
  const { data: linesData } = useQuery<any[]>({
    queryKey: ['productionLines'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production/lines')
      return res.data?.data || []
    }
  })

  // Filter lines: if user has assignedProductionLineId, filter to that line, else return all.
  const authorizedLines = useMemo(() => {
    if (!linesData) return []
    if (user?.assignedProductionLineId) {
      return linesData.filter(l => l.lineId === user.assignedProductionLineId)
    }
    return linesData
  }, [linesData, user?.assignedProductionLineId])

  // Get active line theme context
  const lineTheme = useMemo(() => {
    if (!selectedLine) return null
    return getLineTheme(selectedLine.name, selectedLine.lineId)
  }, [selectedLine])

  // Refs for page triggers
  const endBatchTriggerRef = useRef<(() => void) | null>(null)
  const refreshTriggerRef = useRef<(() => void) | null>(null)

  const registerEndBatchTrigger = (trigger: () => void) => {
    endBatchTriggerRef.current = trigger
  }

  const registerRefreshTrigger = (trigger: () => void) => {
    refreshTriggerRef.current = trigger
  }

  const triggerEndBatch = () => {
    if (endBatchTriggerRef.current) {
      endBatchTriggerRef.current()
    }
  }



  // Fetch active batch telemetry for status strip (Unified Endpoint)
  const { data: activeBatchData, refetch: refetchActiveBatch } = useQuery<any>({
    queryKey: ['activeBatchHeader', selectedLine?.lineId],
    queryFn: async ({ signal }) => {
      if (!selectedLine?.lineId) return null
      const res = await api.get(`/api/operator/production-context?lineId=${selectedLine.lineId}`, { signal })
      return res.data?.data || null
    },
    enabled: !!selectedLine
  })



  // Switch toast notification trigger
  const [showSwitchToast, setShowSwitchToast] = useState(false)
  const [toastTheme, setToastTheme] = useState<any>(null)
  const [toastLineName, setToastLineName] = useState('')

  useEffect(() => {
    if (selectedLine) {
      const theme = getLineTheme(selectedLine.name, selectedLine.lineId)
      setToastTheme(theme)
      setToastLineName(selectedLine.name)
      setShowSwitchToast(true)
      
      const timer = setTimeout(() => {
        setShowSwitchToast(false)
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [selectedLine?.lineId])

  // Live Clock
  const [timeString, setTimeString] = useState('')

  useEffect(() => {
    initTheme()
    
    // Load from LocalStorage for persistence on page reload
    const line = localStorage.getItem('mes_selected_line')
    const shift = localStorage.getItem('mes_selected_shift')
    
    if (line) setSelectedLine(JSON.parse(line))
    if (shift) setSelectedShift(shift)

     // Live clock timer
    const updateTime = () => {
      const now = new Date()
      setTimeString(now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      }))
    }
    updateTime()
    const timer = setInterval(updateTime, 60000) // update every minute is enough
    return () => clearInterval(timer)
  }, [])

  // Dynamic fallback when linesData finishes loading if no line is currently selected
  useEffect(() => {
    if (!selectedLine && user?.assignedProductionLineId && linesData && linesData.length > 0) {
      const assigned = linesData.find(l => l.lineId === user.assignedProductionLineId)
      if (assigned) {
        setSelectedLine(assigned)
        localStorage.setItem('mes_selected_line', JSON.stringify(assigned))
      }
    }
  }, [linesData, user?.assignedProductionLineId, selectedLine])

  const performLineSwitch = async (line: any) => {
    const oldLine = selectedLine
    setSelectedLine(line)
    if (line) {
      localStorage.setItem('mes_selected_line', JSON.stringify(line))
      // Trigger audit log switch on the backend!
      try {
        await api.post('/api/v1/production/line-switch', {
          oldLineId: oldLine?.lineId || null,
          newLineId: line.lineId,
          device: navigator.userAgent,
          ipAddress: '127.0.0.1'
        })
      } catch (err) {
        console.error('Failed to log line switch to audit trail', err)
      }
    } else {
      localStorage.removeItem('mes_selected_line')
    }
  }

  const updateLine = async (line: any) => {
    if (hasUnsavedData) {
      setPendingLineSwitch(line)
      setShowUnsavedModal(true)
      return
    }
    await performLineSwitch(line)
  }

  const updateShift = (shift: string | null) => {
    setSelectedShift(shift)
    if (shift) localStorage.setItem('mes_selected_shift', shift)
    else localStorage.removeItem('mes_selected_shift')
  }

  const resetTerminal = () => {
    setSelectedLine(null)
    setSelectedShift(null)
    localStorage.removeItem('mes_selected_line')
    localStorage.removeItem('mes_selected_shift')
  }

  const handleCancelSwitch = () => {
    setShowUnsavedModal(false)
    setPendingLineSwitch(null)
  }

  const handleDiscardAndSwitch = () => {
    if (discardHandlerRef.current) {
      discardHandlerRef.current()
    }
    setHasUnsavedData(false)
    setShowUnsavedModal(false)
    if (pendingLineSwitch) {
      performLineSwitch(pendingLineSwitch)
      setPendingLineSwitch(null)
    }
  }

  const handleSaveAndSwitch = async () => {
    if (saveHandlerRef.current) {
      const saved = await saveHandlerRef.current()
      if (saved) {
        setHasUnsavedData(false)
        setShowUnsavedModal(false)
        if (pendingLineSwitch) {
          performLineSwitch(pendingLineSwitch)
          setPendingLineSwitch(null)
        }
      }
    }
  }

  const handleLogout = () => {
    resetTerminal()
    clearAuth()
    showToast('Successfully logged out.', 'info')
    navigate('/login')
  }

  // Format today's date
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  const getInitials = () => {
    if (!user) return 'OP'
    const first = user.firstName ? user.firstName[0] : ''
    const last = user.lastName ? user.lastName[0] : ''
    return (first + last).toUpperCase() || 'OP'
  }

  return (
    <div 
      className="h-screen w-screen overflow-hidden flex flex-col bg-[#F3F4F6] text-[#111827] font-sans"
      style={{
        '--line-primary': lineTheme?.primary || '#1A56DB',
        '--line-secondary': lineTheme?.secondary || '#E8F0FE',
        '--line-bg': lineTheme?.primary || '#FFFFFF',
        '--line-text': lineTheme ? '#FFFFFF' : '#111827'
      } as React.CSSProperties}
    >
      {/* Sticky Global Header (Height 60px, Dynamic Theme Color) */}
      <header 
        className="sticky top-0 z-50 h-[60px] border-b transition-all duration-300 px-4 flex items-center justify-between shrink-0 select-none shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        style={{
          backgroundColor: 'var(--line-bg)',
          color: 'var(--line-text)',
          borderColor: lineTheme ? 'rgba(255,255,255,0.1)' : '#E5E7EB'
        }}
      >
        <div className="flex items-center gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div 
              className="w-7.5 h-7.5 rounded-[6px] flex items-center justify-center font-extrabold text-xs tracking-tight shrink-0 shadow-sm transition-colors duration-300"
              style={{
                backgroundColor: lineTheme ? 'rgba(255,255,255,0.2)' : '#1A56DB',
                color: lineTheme ? '#FFFFFF' : '#FFFFFF'
              }}
            >
              AQ
            </div>
            <div className="text-left">
              <span className="font-extrabold text-xs leading-none tracking-tight block">Aquora ERP</span>
              <span className="font-bold text-[8px] uppercase tracking-widest block mt-0.5" style={{ color: lineTheme ? 'rgba(255,255,255,0.7)' : '#6B7280' }}>
                Production Terminal
              </span>
            </div>
          </div>

          <span className="text-white/20 select-none hidden md:inline">|</span>

          {/* Date & Time (Minimal Outline Icons, No Emojis) */}
          <div className="hidden md:flex items-center gap-3 text-[10px] select-none">
            <div className="flex items-center gap-1 font-bold animate-in fade-in" style={{ color: lineTheme ? 'rgba(255,255,255,0.85)' : '#4B5563' }}>
              <Calendar className="w-3.5 h-3.5 opacity-75" />
              <span>{todayStr}</span>
            </div>
            <span className="text-white/20 select-none">|</span>
            <div className="flex items-center gap-1 font-bold font-mono" style={{ color: lineTheme ? 'rgba(255,255,255,0.85)' : '#4B5563' }}>
              <Clock className="w-3.5 h-3.5 opacity-75" />
              <span>{timeString}</span>
            </div>
          </div>
        </div>

        {/* Center: Line Selector dropdown, and Active Batch Details */}
        <div className="flex items-center gap-3">
          {/* Line Selector Dropdown */}
          {selectedLine && lineTheme && (
            <div className="relative">
              <button
                onClick={() => setIsLineDropdownOpen(!isLineDropdownOpen)}
                className="flex items-center gap-1.5 h-8 px-2 border rounded-[6px] text-xs font-extrabold transition-all duration-200 focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: '#FFFFFF'
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block bg-white animate-pulse"></span>
                <span>{selectedLine.name}</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>
              
              {isLineDropdownOpen && (
                <div className="absolute left-0 mt-1 w-44 bg-white border border-[#E5E7EB] rounded-[6px] shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  {authorizedLines.map((line) => {
                    const t = getLineTheme(line.name, line.lineId)
                    const isSelected = selectedLine.lineId === line.lineId
                    return (
                      <button
                        key={line.lineId}
                        onClick={() => {
                          setIsLineDropdownOpen(false)
                          updateLine(line)
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-slate-50 transition-all duration-150 flex justify-between items-center cursor-pointer"
                        style={{
                          color: isSelected ? t.primary : '#4B5563',
                          backgroundColor: isSelected ? t.secondary : 'transparent'
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.primary }}></span>
                          <span>{line.name}</span>
                        </div>
                        {isSelected && <Check className="w-3 h-3" style={{ color: t.primary }} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Active Batch details displayed in a single unified global header */}
          {selectedLine && lineTheme && activeBatchData?.canEnterProductionPage && (
            <>
              <span className="text-white/20 select-none hidden lg:inline">|</span>
              
              <div className="hidden lg:flex items-center gap-4 text-left animate-in fade-in slide-in-from-left-2 duration-200">
                <div>
                  <span className="text-white/60 text-[9px] uppercase tracking-wider block font-bold leading-none">Batch</span>
                  <span className="text-white text-[13px] font-medium leading-tight block mt-0.5">{activeBatchData.batchNumber}</span>
                </div>
                <div>
                  <span className="text-white/60 text-[9px] uppercase tracking-wider block font-bold leading-none">Product</span>
                  <span className="text-white text-[13px] font-bold leading-none block mt-0.5 truncate max-w-[150px]" title={activeBatchData.productName}>
                    {activeBatchData.productName}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right side: Operator name, End Batch, and Logout */}
        <div className="flex items-center gap-3">
          {/* Operator Avatar and Details */}
          <div className="flex items-center gap-2">
            <div 
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shadow-sm transition-colors duration-300"
              style={{
                backgroundColor: lineTheme ? '#FFFFFF' : '#1A56DB',
                color: lineTheme ? 'var(--line-primary)' : '#FFFFFF'
              }}
            >
              {getInitials()}
            </div>
            <div className="hidden xl:block text-left select-none">
              <span className="font-bold text-[11px] block leading-tight">{user?.firstName} {user?.lastName}</span>
              <span className="text-[8px] uppercase tracking-wider block font-bold mt-0.5" style={{ color: lineTheme ? 'rgba(255,255,255,0.7)' : '#6B7280' }}>
                Operator
              </span>
            </div>
          </div>

          <span className="text-white/20 select-none hidden md:inline">|</span>

          {/* Action buttons (End Batch & Logout) */}
          <div className="flex items-center gap-2 select-none shrink-0">
            {selectedLine && lineTheme && activeBatchData?.canEnterProductionPage && (
              <button
                onClick={triggerEndBatch}
                className="h-7.5 px-2.5 rounded-[6px] bg-red-600 hover:bg-red-700 text-white font-extrabold shadow-sm transition-all duration-150 flex items-center gap-1 text-[9px] uppercase cursor-pointer"
                title="End Active Batch"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
                <span>End Batch</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center justify-center px-2.5 h-7.5 rounded-[6px] border text-[9px] font-bold uppercase gap-1 cursor-pointer transition-all duration-150"
              style={{
                borderColor: lineTheme ? 'rgba(255,255,255,0.3)' : '#E5E7EB',
                color: lineTheme ? '#FFFFFF' : '#DC2626',
                backgroundColor: lineTheme ? 'transparent' : 'rgba(254, 226, 226, 0.3)'
              }}
              title="Logout"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Terminal Viewport (Screen Filling, No Scroll) */}
      <main className="flex-1 min-h-0 relative overflow-hidden flex flex-col p-4">
        <Outlet context={{
          selectedLine, updateLine,
          selectedShift, updateShift,
          resetTerminal,
          hasUnsavedData, setHasUnsavedData,
          registerSaveHandler,
          registerDiscardHandler,
          registerEndBatchTrigger,
          registerRefreshTrigger,
          activeBatchData,
          refetchActiveBatch
        }} />
      </main>

      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-[#E5E7EB] w-full max-w-[420px] rounded-[12px] shadow-2xl p-6 text-left">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight uppercase mb-2">Unsaved Production Entries</h3>
            <p className="text-xs text-slate-500 font-semibold mb-6">You have unsaved production entries. Save before switching?</p>
            
            <div className="flex justify-end gap-2.5">
              <button
                onClick={handleCancelSwitch}
                className="px-4 py-2 border border-[#E5E7EB] rounded-[6px] text-slate-700 font-bold hover:bg-slate-50 transition-colors text-xs uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscardAndSwitch}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-[6px] font-bold transition-colors text-xs uppercase cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={handleSaveAndSwitch}
                className="px-4 py-2 bg-[#1A56DB] hover:bg-[#1E40AF] text-white rounded-[6px] font-bold transition-colors text-xs uppercase cursor-pointer"
              >
                Save & Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {showSwitchToast && toastTheme && (
        <div className="fixed top-24 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-200 select-none">
          <div 
            className="flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-[8px] shadow-2xl border text-xs font-bold uppercase tracking-wider transition-all duration-200" 
            style={{ borderColor: toastTheme.primary }}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: toastTheme.primary }}></span>
            <span>Switched to <strong style={{ color: toastTheme.primary }}>{toastLineName}</strong></span>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  )
}

export default OperatorLayout
