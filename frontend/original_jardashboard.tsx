import React from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'
import {
  RotateCcw, ArrowUpRight, ArrowDownLeft, Trash2, ShieldAlert,
  Wind, ClipboardCheck, Droplet, Hammer, Cpu, RefreshCw
} from 'lucide-react'

export const JarDashboardPage: React.FC = () => {
  const { selectedProduct, resetTerminal } = useOutletContext<any>()
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const handleClearAllocation = () => {
    resetTerminal()
    showToast('Product allocation cleared.', 'info')
    navigate('/operator/product-selection')
  }

  // Cards for the Jar Operations Module
  const jarOperations = [
    {
      title: 'Loading',
      description: 'Load empty jars into the production queue.',
      icon: <ArrowDownLeft className="w-5 h-5" />,
      color: 'from-blue-500 to-cyan-500',
      badge: 'Queue'
    },
    {
      title: 'Returns',
      description: 'Log empty jar returns from distributors.',
      icon: <RotateCcw className="w-5 h-5" />,
      color: 'from-teal-500 to-emerald-500',
      badge: 'Inventory'
    },
    {
      title: 'Damage',
      description: 'Report cracked, leaking, or damaged jars.',
      icon: <Trash2 className="w-5 h-5" />,
      color: 'from-red-500 to-rose-500',
      badge: 'Scrap'
    },
    {
      title: 'Dispatch',
      description: 'Dispatch filled 20L jars for delivery.',
      icon: <ArrowUpRight className="w-5 h-5" />,
      color: 'from-indigo-500 to-purple-500',
      badge: 'Outbound'
    },
    {
      title: 'Cleaning',
      description: 'Log washing, chemical sanitization, and pre-rinsing.',
      icon: <Wind className="w-5 h-5" />,
      color: 'from-sky-400 to-blue-500',
      badge: 'Sanitary'
    },
    {
      title: 'Inspection',
      description: 'Perform visual inspection and cap seals validation.',
      icon: <ClipboardCheck className="w-5 h-5" />,
      color: 'from-amber-500 to-orange-500',
      badge: 'Quality'
    },
    {
      title: 'Refilling',
      description: 'Manage filling station, filler speed, and batch counts.',
      icon: <Droplet className="w-5 h-5" />,
      color: 'from-blue-600 to-blue-800',
      badge: 'Filling'
    },
    {
      title: 'Operator Tools',
      description: 'Calibrate filler sensors and reset station logs.',
      icon: <Hammer className="w-5 h-5" />,
      color: 'from-slate-500 to-slate-700',
      badge: 'Maintenance'
    }
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto select-none p-4 bg-[#F3F4F6]">
      <div className="w-full max-w-[1280px] mx-auto space-y-6">
        
        {/* Header Summary */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-[#111827] uppercase tracking-tight">Jar Operations Dashboard</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase text-white bg-blue-600 tracking-wider shadow-sm">
                20L Jar Module
              </span>
            </div>
            <p className="text-xs text-[#6B7280] font-semibold">
              Product model: <strong className="text-blue-600">{selectedProduct?.name || '20L Jar'}</strong> (SKU: <span className="font-mono">{selectedProduct?.sku || 'N/A'}</span>)
            </p>
          </div>
          
          {/* Change Product Button */}
          <button
            onClick={handleClearAllocation}
            className="h-9 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-[8px] text-slate-700 text-xs font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Change Product</span>
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-white border border-blue-100 rounded-[12px] p-5 flex items-start gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div className="text-xs space-y-1">
            <h3 className="font-bold text-slate-800 uppercase tracking-wide">Jar Operations Context Initialized</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              You are logged in as <strong className="text-slate-700">{user?.firstName} {user?.lastName}</strong>. This module manages the returns, cleaning, refilling, and dispatch workflow specifically designed for returnable 20L Jars, skipping line allocation.
            </p>
          </div>
        </div>

        {/* Grid of Operations */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
          {jarOperations.map((op, idx) => (
            <button
              key={idx}
              onClick={() => showToast(`${op.title} action clicked. Module implementation coming soon.`, 'info')}
              className="bg-white border border-[#E5E7EB] hover:border-slate-300 rounded-[12px] p-4 text-left hover:shadow-md transition-all duration-200 flex flex-col justify-between aspect-[1.4] relative group cursor-pointer"
            >
              <div className="flex justify-between items-start w-full">
                {/* Icon Circle */}
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${op.color} text-white flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform duration-200`}>
                  {op.icon}
                </div>
                {/* Badge */}
                <span className="px-2 py-0.5 rounded-[4px] text-[8px] font-extrabold uppercase bg-slate-100 text-slate-500 tracking-wider">
                  {op.badge}
                </span>
              </div>

              {/* Title & Description */}
              <div className="mt-4">
                <span className="font-extrabold text-slate-800 text-xs block uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                  {op.title}
                </span>
                <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-normal">
                  {op.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default JarDashboardPage
