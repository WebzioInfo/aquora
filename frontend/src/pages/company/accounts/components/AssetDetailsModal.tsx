import React, { useState } from 'react'
import {
  Cpu,
  MapPin,
  Building,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  DollarSign,
  Wrench,
  History,
  FileText,
  AlertCircle,
  Tag,
  Hash,
  Layers,
  Edit2
} from 'lucide-react'
import type { DetailedAsset, AssetMaintenanceRecord } from '../../../../services/assets'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseBadge from '../../../../components/ui/EnterpriseBadge'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import AssetHistoryDetails from './AssetHistoryDetails'

interface AssetDetailsModalProps {
  isOpen: boolean
  asset: DetailedAsset
  canManage: boolean
  maintenanceHistory: AssetMaintenanceRecord[]
  timelineHistory: Array<{
    id: string
    date: string
    action: string
    performedBy: string
    previousValue?: string
    newValue?: string
    remarks?: string
  }>
  loadingData?: boolean
  defaultTab?: 'overview' | 'financial' | 'assignment' | 'warranty' | 'maintenance' | 'history' | 'depreciation'
  onClose: () => void
  onEdit?: () => void
  onAssign?: () => void
}

export const AssetDetailsModal: React.FC<AssetDetailsModalProps> = ({
  isOpen,
  asset,
  canManage,
  maintenanceHistory,
  timelineHistory,
  loadingData = false,
  defaultTab = 'overview',
  onClose,
  onEdit,
  onAssign
}) => {
  const initialTab = defaultTab === 'depreciation' ? 'financial' : defaultTab
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'assignment' | 'warranty' | 'maintenance' | 'history'>(initialTab)

  const isHistorical = ['disposed', 'retired'].includes(asset.currentStatus.toLowerCase())

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0)
  }

  const formatDdMmYyyy = (utcDate?: string | null) => {
    if (!utcDate) return '—'
    if (typeof utcDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(utcDate)) {
      const [y, m, d] = utcDate.slice(0, 10).split('-')
      return `${d}/${m}/${y}`
    }
    const dt = new Date(utcDate)
    if (isNaN(dt.getTime())) return '—'
    const day = String(dt.getUTCDate()).padStart(2, '0')
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0')
    return `${day}/${month}/${dt.getUTCFullYear()}`
  }

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'active' || s === 'inuse') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {status}
        </span>
      )
    }
    if (s === 'undermaintenance') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Under Maintenance
        </span>
      )
    }
    if (s === 'disposed' || s === 'retired') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {status}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        {status}
      </span>
    )
  }

  const getConditionBadge = (condition: string) => {
    const isGood = condition === 'Excellent' || condition === 'Good'
    const isFair = condition === 'Fair'
    return (
      <span
        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
          isGood
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : isFair
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}
      >
        {condition}
      </span>
    )
  }

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-slate-900">{asset.assetName}</span>
            <span className="font-mono text-xs px-2 py-0.5 bg-blue-50 text-[#1A56DB] rounded-md font-bold border border-blue-100">
              {asset.assetTag || asset.assetCode}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>{asset.assetCategory}</span>
            <span>·</span>
            {getStatusBadge(asset.currentStatus)}
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-400 font-mono">
            ID: {asset.id.slice(0, 8)}...
          </div>
          <div className="flex items-center gap-2">
            <EnterpriseButton onClick={onClose} variant="secondary" size="sm">
              Close
            </EnterpriseButton>
            {canManage && !isHistorical && onEdit && (
              <EnterpriseButton
                onClick={() => {
                  onClose()
                  onEdit()
                }}
                variant="primary"
                size="sm"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1" />
                Edit Asset
              </EnterpriseButton>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-slate-700 select-none">
        {/* DISPOSED HISTORICAL BANNER */}
        {isHistorical && (
          <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-900">
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>
                Disposed on {asset.disposalDate ? new Date(asset.disposalDate).toLocaleDateString('en-IN') : 'N/A'} ({asset.disposalMethod || 'Retired'})
              </span>
            </div>
            <p className="mt-1 text-[11px] text-rose-700">
              Reason: {asset.disposalReason || 'End of life'} · Proceeds realized: {formatCurrency(asset.saleValue)} · Historical Book Value: {formatCurrency(asset.currentValue)}
            </p>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="border-b border-slate-200 flex gap-2 overflow-x-auto pb-1 text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-blue-50 text-[#1A56DB] border border-blue-200/60'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('financial')}
            className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'financial'
                ? 'bg-blue-50 text-[#1A56DB] border border-blue-200/60'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            Financial & Cost
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assignment')}
            className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'assignment'
                ? 'bg-blue-50 text-[#1A56DB] border border-blue-200/60'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            Location & Assignment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('warranty')}
            className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'warranty'
                ? 'bg-blue-50 text-[#1A56DB] border border-blue-200/60'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            Warranty
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'maintenance'
                ? 'bg-blue-50 text-[#1A56DB] border border-blue-200/60'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            Maintenance ({maintenanceHistory.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-50 text-[#1A56DB] border border-blue-200/60'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            Audit Trail ({timelineHistory.length})
          </button>
        </div>

        {loadingData && (
          <div className="py-2 text-center text-xs text-slate-400 font-medium animate-pulse">
            Refreshing asset records & timeline...
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
              <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] mb-3 text-[#1A56DB]">
                Asset Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Asset Tag</span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{asset.assetTag || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Category</span>
                  <span className="font-medium text-slate-900 mt-0.5 block">{asset.assetCategory}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Serial Number</span>
                  <span className="font-mono text-slate-900 mt-0.5 block">{asset.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Model Number</span>
                  <span className="font-medium text-slate-900 mt-0.5 block">{asset.modelNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Manufacturer</span>
                  <span className="font-medium text-slate-900 mt-0.5 block">{asset.manufacturer || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Condition</span>
                  <div className="mt-1">{getConditionBadge(asset.condition)}</div>
                </div>
              </div>

              {asset.description && (
                <div className="mt-3 pt-3 border-t border-slate-200/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Description</span>
                  <p className="text-xs text-slate-700 mt-0.5">{asset.description}</p>
                </div>
              )}
            </div>

            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
              <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] mb-3 text-[#1A56DB]">
                Acquisition & Lifecycle Summary
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Purchase / Acquisition Date</span>
                  <span className="font-medium text-slate-900 mt-0.5 block">
                    {formatDdMmYyyy(asset.purchaseDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Supplier</span>
                  <span className="font-medium text-slate-900 mt-0.5 block">{asset.supplierName || 'Not recorded'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Invoice Reference</span>
                  <span className="font-mono text-slate-900 mt-0.5 block">{asset.purchaseInvoiceNumber || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FINANCIAL & VALUATION */}
        {activeTab === 'financial' && (
          <div className="space-y-4">
            {/* Top 3 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Capitalized Cost</span>
                <span className="text-base font-black text-slate-900 font-mono mt-1 block">
                  {formatCurrency(asset.totalCapitalizedCost)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Original asset acquisition base</span>
              </div>
              <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-700 block">Current Book Value</span>
                <span className="text-base font-black text-blue-900 font-mono mt-1 block">
                  {formatCurrency(asset.currentValue)}
                </span>
                <span className="text-[10px] text-blue-600 mt-0.5 block">Net carrying amount</span>
              </div>
              <div className="p-3.5 bg-purple-50/80 rounded-xl border border-purple-200">
                <span className="text-[10px] uppercase font-bold text-purple-700 block">Accumulated Dep.</span>
                <span className="text-base font-black text-purple-900 font-mono mt-1 block">
                  {formatCurrency(asset.accumulatedDepreciation)}
                </span>
                <span className="text-[10px] text-purple-600 mt-0.5 block">Total written down to date</span>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-3">
              <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] text-[#1A56DB]">
                Capitalization Cost Breakdown
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">Base Purchase Price</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(asset.purchasePrice)}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">Tax / GST</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(asset.taxAmount)}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">Freight & Transport</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(asset.freightCost)}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">Installation Cost</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(asset.installationCost)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Purchase Date</span>
                  <span className="font-semibold text-slate-800">{formatDdMmYyyy(asset.purchaseDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Depreciation Method</span>
                  <span className="font-semibold text-slate-800">{asset.depreciationMethod || 'Straight Line'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Useful Lifespan</span>
                  <span className="font-semibold text-slate-800">{asset.usefulLifeYears || 5} Years</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Residual Value</span>
                  <span className="font-mono font-semibold text-slate-800">{formatCurrency(asset.residualValue)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LOCATION & ASSIGNMENT */}
        {activeTab === 'assignment' && (
          <div className="space-y-4">
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-4">
              <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] text-[#1A56DB]">
                Current Location & Custody
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200">
                  <div className="p-2 bg-blue-50 text-[#1A56DB] rounded-lg">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Plant / Site Location</span>
                    <span className="font-bold text-slate-900 text-sm">{asset.location || 'Main Plant'}</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">Department: {asset.department || 'Not specified'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Custodian</span>
                    {asset.assignedEmployeeName ? (
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">{asset.assignedEmployeeName}</span>
                        <span className="text-[11px] text-emerald-700 font-medium block">
                          Assigned: {asset.assignedDate ? new Date(asset.assignedDate).toLocaleDateString('en-IN') : 'Active'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-xs block mt-1">Currently Unassigned</span>
                    )}
                  </div>
                  {canManage && !isHistorical && onAssign && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onAssign()
                      }}
                      className="px-2 py-1 text-xs font-semibold text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      {asset.assignedEmployeeName ? 'Reassign' : 'Assign'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: WARRANTY */}
        {activeTab === 'warranty' && (
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-3">
            <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] text-[#1A56DB] flex items-center justify-between">
              <span>Warranty & Service Coverage</span>
              {asset.isWarrantyActive ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" /> Active Coverage
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200">
                  <ShieldAlert className="w-3.5 h-3.5" /> Expired / No Coverage
                </span>
              )}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Warranty Provider</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">{asset.warrantyProvider || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Policy / Contract #</span>
                <span className="font-mono font-semibold text-slate-900 mt-0.5 block">{asset.warrantyNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Coverage Duration</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {asset.warrantyStartDate ? new Date(asset.warrantyStartDate).toLocaleDateString('en-IN') : '—'} to{' '}
                  {asset.warrantyEndDate ? new Date(asset.warrantyEndDate).toLocaleDateString('en-IN') : '—'}
                </span>
              </div>
            </div>

            {asset.warrantyNotes && (
              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Warranty Terms / Notes</span>
                <p className="text-xs text-slate-700 mt-0.5">{asset.warrantyNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: MAINTENANCE */}
        {activeTab === 'maintenance' && (
          <div className="space-y-3">
            {maintenanceHistory.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
                <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700 text-xs">No maintenance records logged</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Preventive and corrective maintenance history will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {maintenanceHistory.map((m) => (
                  <div key={m.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[10px]">
                          {m.maintenanceType}
                        </span>
                        <span className="font-bold text-slate-900">{m.description}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span>Provider: <strong className="text-slate-700">{m.serviceProvider}</strong></span>
                        <span>·</span>
                        <span>Date: {new Date(m.maintenanceDate).toLocaleDateString('en-IN')}</span>
                        {m.technicianName && (
                          <>
                            <span>·</span>
                            <span>Technician: {m.technicianName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-slate-900 sm:self-center">
                      <span className="text-xs text-[#1A56DB]">{formatCurrency(m.totalCost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: AUDIT TRAIL */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {timelineHistory.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
                <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700 text-xs">No audit events recorded</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-blue-200 ml-3 space-y-4 py-2">
                {timelineHistory.map((h) => (
                  <div key={h.id} className="relative pl-5">
                    <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-[#1A56DB] border-2 border-white shadow-xs" />
                    <span className="font-bold text-slate-900 block">{h.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {new Date(h.date).toLocaleString('en-IN')} by <strong className="text-slate-600">{h.performedBy}</strong>
                    </span>
                    <AssetHistoryDetails
                      action={h.action}
                      remarks={h.remarks}
                      previousValue={h.previousValue}
                      newValue={h.newValue}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </EnterpriseModal>
  )
}

export default AssetDetailsModal
