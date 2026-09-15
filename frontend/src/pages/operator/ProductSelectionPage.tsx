import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useNotificationStore } from '../../store/useNotificationStore'
import { Loader2, Layers, CheckCircle2, AlertTriangle, Play, ChevronRight, RefreshCw } from 'lucide-react'
import { getLineTheme } from '../../utils/lineTheme'

interface ProductionLineItem {
  lineId: string
  id?: string
  name: string
  code: string
  isActive: boolean
  hasActiveBatch: boolean
  activeBatch?: {
    batchId: string
    batchNumber: string
    product?: any
    productName?: string
    skuCode?: string
    shift?: string
    startedAt?: string
  } | null
}

export const ProductSelectionPage: React.FC = () => {
  const { updateLine, updateProduct, updateShift } = useOutletContext<any>()
  const { showToast } = useNotificationStore()
  const navigate = useNavigate()

  const [loadingLineId, setLoadingLineId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch active production lines with active batch telemetry
  const { data: lines = [], isLoading, isError, refetch } = useQuery<ProductionLineItem[]>({
    queryKey: ['operatorActiveProductionLines'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production/lines')
      return res.data?.data || []
    },
    staleTime: 5000,
    refetchInterval: 10000
  })

  // Filter to show active/running lines
  const activeLines = lines.filter(l => l.isActive)

  const handleSelectLine = async (line: ProductionLineItem) => {
    const targetLineId = line.lineId || line.id
    if (!targetLineId) return

    setLoadingLineId(targetLineId)
    setErrorMessage(null)

    try {
      // 1. Fetch current active context for this line from backend source of truth
      const res = await api.get(`/api/operator/production-context?lineId=${targetLineId}`)
      const context = res.data?.data

      if (!context || !context.canEnterProductionPage) {
        setErrorMessage(`No active production configuration found for ${line.name} (${line.code}). Please contact the production administrator.`)
        showToast(`No active production configuration found for ${line.name}.`, 'warning')
        setLoadingLineId(null)
        return
      }

      // 2. Extract active product, SKU, and shift from active line configuration
      const activeProduct = context.product || (line.activeBatch?.product ? line.activeBatch.product : {
        id: context.skuId,
        name: context.skuName,
        sku: context.skuCode,
        category: context.skuName?.toLowerCase().includes('jar') ? '20L Jar' : 'Bottled Water'
      })

      const activeShift = context.shift || line.activeBatch?.shift || 'Morning'

      // 3. Save line, product, and shift into global Operator context & LocalStorage
      updateLine(line)
      updateProduct(activeProduct)
      updateShift(activeShift)

      showToast(`Loaded active configuration for ${line.name}: ${activeProduct?.name || 'Production Batch'}`, 'success')

      // 4. Redirect to appropriate production terminal
      const isJar = activeProduct?.category?.toLowerCase() === '20l jar' || activeProduct?.name?.toLowerCase().includes('jar')
      if (isJar) {
        navigate('/operator/jar', { replace: true })
      } else {
        navigate('/operator/dashboard', { replace: true })
      }
    } catch (err: any) {
      console.error('Failed to load active line configuration:', err)
      const msg = err.response?.data?.message || `Failed to retrieve active configuration for ${line.name}.`
      setErrorMessage(msg)
      showToast(msg, 'error')
    } finally {
      setLoadingLineId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#F8FAFC] text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <span className="text-xs font-bold uppercase tracking-wider">Retrieving active production lines...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#F8FAFC] p-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-md font-bold text-slate-800 uppercase tracking-wide">Failed to Load Production Lines</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-[340px] mb-4">
          There was an error retrieving active line configurations from the server.
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto select-none p-6 bg-[#F8FAFC]">
      <div className="w-full max-w-[1200px] mx-auto space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Layers className="w-7 h-7 text-blue-600" />
              Select Active Production Line
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Select a running line below. Aquzio will automatically load its currently assigned product, shift, and production batch.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="h-8 px-3 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" /> Refresh Lines
          </button>
        </div>

        {/* Error / Warning Alert Banner */}
        {errorMessage && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs font-semibold animate-in fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-amber-950">Active Configuration Error</p>
              <p className="mt-0.5 text-amber-800">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Active Line Grid */}
        {activeLines.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 shadow-sm">
            <Layers className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">No Active Production Lines</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              There are currently no running production lines configured. Please contact the production administrator to activate a line.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeLines.map((line) => {
              const theme = getLineTheme(line.name, line.lineId || line.id)
              const hasBatch = Boolean(line.hasActiveBatch || line.activeBatch)
              const isSelectedLoading = loadingLineId === (line.lineId || line.id)

              return (
                <div
                  key={line.lineId || line.id}
                  onClick={() => !isSelectedLoading && handleSelectLine(line)}
                  className={`bg-white border rounded-2xl p-6 flex flex-col justify-between hover:shadow-xl transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                    hasBatch ? 'border-slate-200 hover:border-blue-500' : 'border-slate-200 opacity-80'
                  }`}
                >
                  {/* Top Color Accent Line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2"
                    style={{ backgroundColor: theme.color }}
                  />

                  {/* Top Card Content */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-sm"
                          style={{ backgroundColor: theme.color }}
                        >
                          {line.name.replace(/[^0-9]/g, '') || 'L'}
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 leading-tight">{line.name}</h3>
                          <span className="text-[11px] font-mono font-bold text-slate-400">{line.code}</span>
                        </div>
                      </div>

                      {hasBatch ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          RUNNING
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          IDLE
                        </span>
                      )}
                    </div>

                    {/* Active Configuration Details */}
                    {hasBatch && line.activeBatch ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-semibold uppercase text-[10px]">Active Product</span>
                          <span className="font-bold text-slate-800">{line.activeBatch.productName || line.activeBatch.product?.name || 'Assigned Product'}</span>
                        </div>
                        {line.activeBatch.shift && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-semibold uppercase text-[10px]">Working Shift</span>
                            <span className="font-semibold text-slate-700">{line.activeBatch.shift}</span>
                          </div>
                        )}
                        {line.activeBatch.batchNumber && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-semibold uppercase text-[10px]">Batch Number</span>
                            <span className="font-mono font-bold text-blue-600">{line.activeBatch.batchNumber}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3.5 text-xs text-amber-800 font-medium">
                        No active production batch currently running on this line.
                      </div>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500 group-hover:text-blue-600 transition-colors">
                      {isSelectedLoading ? 'Loading configuration...' : 'Select Production Line'}
                    </span>
                    {isSelectedLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-600 flex items-center justify-center transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductSelectionPage
