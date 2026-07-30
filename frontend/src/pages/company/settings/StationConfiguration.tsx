import React, { useState, useEffect } from 'react'
import { api } from '../../../services/api'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useQueryClient } from '@tanstack/react-query'
import { Settings, Info, Box } from 'lucide-react'

interface StationItem {
  name: string
  isEnabled: boolean
}

export const StationConfiguration: React.FC = () => {
  const { showToast } = useNotificationStore()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stations, setStations] = useState<StationItem[]>([])

  const dependencies: Record<string, string[]> = {
    Blowing: ['Preforms'],
    Filling: ['Caps'],
    Labelling: ['Labels'],
    Packing: ['Shrink Film']
  }

  const fetchStations = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/company/stations')
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setStations(res.data.data)
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load station configurations.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStations()
  }, [])

  const handleToggle = async (name: string, currentStatus: boolean) => {
    try {
      setSaving(true)
      const updated = stations.map(s => s.name === name ? { ...s, isEnabled: !currentStatus } : s)
      const res = await api.put('/api/v1/company/stations', {
        stations: updated.map(s => ({ name: s.name, isEnabled: s.isEnabled }))
      })
      if (res.data?.success) {
        showToast(`Station ${name} ${!currentStatus ? 'enabled' : 'disabled'} successfully.`, 'success')
        queryClient.invalidateQueries({ queryKey: ['enabledProductionStations'] })
        fetchStations()
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update station state.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-sm font-semibold text-slate-800">Station Configuration</h3>
        <p className="text-xs text-slate-500 mt-1">Enable or disable manufacturing stations to customize Aquora workflow availability.</p>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stations.map((station) => {
            const deps = dependencies[station.name] || []
            return (
              <div 
                key={station.name}
                className={`p-4 rounded-xl border transition-all duration-200 ${
                  station.isEnabled 
                    ? 'bg-blue-50/20 border-blue-200 shadow-sm' 
                    : 'bg-slate-50/50 border-slate-200 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      {station.name}
                    </h4>
                    <div className="space-y-1">
                      <span className="block text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Consumes</span>
                      <div className="flex flex-wrap gap-1.5">
                        {deps.map((dep) => (
                          <span 
                            key={dep} 
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                              dep === 'Final Packaging' 
                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <Box className="w-3 h-3 text-slate-400" />
                            {dep}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleToggle(station.name, station.isEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      station.isEnabled ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        station.isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex gap-3">
          <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Disabling production stations hides them dynamically from menus, schedules, dashboards, operator interfaces, and reports. 
            Historical production batch records remain fully intact.
          </p>
        </div>
      </div>
    </div>
  )
}
