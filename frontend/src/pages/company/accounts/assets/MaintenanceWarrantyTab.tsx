import React, { useState } from 'react'
import {
  Wrench,
  Search,
  CheckCircle2,
  X
} from 'lucide-react'
import type { DetailedAsset } from '../../../../services/assets'
import { LedgerPagination } from '../../../../components/accounts/ui/LedgerPagination'
import { formatINR, formatDisplayDate, getCategoryMeta } from './assetHelpers'

interface MaintenanceWarrantyTabProps {
  assets: DetailedAsset[]
  loading: boolean
  onLogMaintenance: (asset: DetailedAsset) => void
  onViewAsset: (asset: DetailedAsset) => void
  canManage: boolean
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (newPage: number) => void
  onPageSizeChange: (newPageSize: number) => void
}

export const MaintenanceWarrantyTab: React.FC<MaintenanceWarrantyTabProps> = ({
  assets,
  loading: _loading,
  onLogMaintenance,
  onViewAsset,
  canManage,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange
}) => {
  const [search, setSearch] = useState('')
  const [trackingFilter, setTrackingFilter] = useState<'all' | 'maintenance' | 'warranty'>('all')

  const now = new Date()

  const items = assets.map((a) => {
    const nextMaint = a.nextMaintenanceDate ? new Date(a.nextMaintenanceDate) : null
    const warrantyEnd = a.warrantyEndDate ? new Date(a.warrantyEndDate) : null

    const isMaintOverdue = nextMaint && nextMaint < now
    const isMaintDue30Days = nextMaint && nextMaint >= now && (nextMaint.getTime() - now.getTime()) <= 30 * 86400000
    const isUnderMaint = (a.currentStatus || '').toLowerCase().includes('maintenance')

    const isWarrantyExpiring60Days = warrantyEnd && warrantyEnd >= now && (warrantyEnd.getTime() - now.getTime()) <= 60 * 86400000
    const isWarrantyExpired = warrantyEnd && warrantyEnd < now

    return {
      asset: a,
      nextMaint,
      warrantyEnd,
      isMaintOverdue,
      isMaintDue30Days,
      isUnderMaint,
      isWarrantyExpiring60Days,
      isWarrantyExpired
    }
  })

  const filteredItems = items
    .filter((i) => {
      const q = search.toLowerCase()
      const matchSearch =
        (i.asset.assetName || '').toLowerCase().includes(q) ||
        (i.asset.assetCategory || '').toLowerCase().includes(q) ||
        (i.asset.location || '').toLowerCase().includes(q)

      if (!matchSearch) return false

      if (trackingFilter === 'maintenance') {
        return Boolean(i.nextMaint || i.isUnderMaint || i.asset.lastMaintenanceDate)
      }
      if (trackingFilter === 'warranty') {
        return Boolean(i.warrantyEnd)
      }
      return true
    })
    .sort((a, b) => {
      if (a.isMaintOverdue && !b.isMaintOverdue) return -1
      if (!a.isMaintOverdue && b.isMaintOverdue) return 1
      if (a.nextMaint && b.nextMaint) return a.nextMaint.getTime() - b.nextMaint.getTime()
      return 0
    })

  const totalMaintenanceSpend = filteredItems.reduce(
    (acc, i) => acc + (Number(i.asset.totalMaintenanceCost) || 0),
    0
  )

  const getRelativeDaysText = (targetDate: Date | null) => {
    if (!targetDate) return null
    const diffTime = targetDate.getTime() - now.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true }
    }
    if (diffDays === 0) {
      return { text: 'Due today', isOverdue: false }
    }
    return { text: `in ${diffDays}d`, isOverdue: false }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full space-y-3">
      {/* Filter toolbar (search on left, segmented toggle on right) */}
      <div className="p-2 sm:px-3 sm:py-2 border border-slate-200/90 shadow-xs w-full bg-white rounded-xl shrink-0 select-none">
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search asset, category, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-[32px] pl-8 pr-6 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Segmented Toggle: All Tracking / Maintenance Schedule / Warranty Expiry */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setTrackingFilter('all')}
              className={`py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                trackingFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              All Tracking
            </button>
            <button
              type="button"
              onClick={() => setTrackingFilter('maintenance')}
              className={`py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                trackingFilter === 'maintenance'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Maintenance Schedule
            </button>
            <button
              type="button"
              onClick={() => setTrackingFilter('warranty')}
              className={`py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                trackingFilter === 'warranty'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Warranty Expiry
            </button>
          </div>
        </div>
      </div>

      {/* Table Shell Card */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden w-full flex-1 flex flex-col min-h-0">
        {filteredItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
            <h4 className="text-sm font-bold text-slate-800">
              No overdue maintenance or expiring warranties
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              All registered assets are currently up to date on servicing and warranty terms.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs min-w-[900px]">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] select-none">
                  <tr className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3.5 min-w-[200px] bg-slate-50">ASSET</th>
                    <th className="py-2.5 px-3.5 w-36 bg-slate-50">LOCATION</th>
                    <th className="py-2.5 px-3.5 w-44 bg-slate-50">NEXT DUE / STATUS</th>
                    <th className="py-2.5 px-3.5 text-right w-32 bg-slate-50">MAINT. SPEND</th>
                    <th className="py-2.5 px-3.5 w-40 bg-slate-50">WARRANTY STATUS</th>
                    <th className="py-2.5 px-3.5 text-right w-36 bg-slate-50">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredItems.map(
                    ({
                      asset,
                      nextMaint,
                      warrantyEnd,
                      isMaintOverdue,
                      isMaintDue30Days,
                      isUnderMaint,
                      isWarrantyExpiring60Days
                    }) => {
                      const categoryMeta = getCategoryMeta(asset.assetCategory)
                      const CategoryIcon = categoryMeta.icon
                      const rel = getRelativeDaysText(nextMaint)

                      return (
                        <tr
                          key={asset.id}
                          onClick={() => onViewAsset(asset)}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        >
                          {/* Asset */}
                          <td className="py-2 px-3.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-slate-200/60"
                                style={{ backgroundColor: categoryMeta.lightBg }}
                              >
                                <CategoryIcon
                                  className="w-3.5 h-3.5"
                                  style={{ color: categoryMeta.hex }}
                                />
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 block text-xs truncate">
                                  {asset.assetName}
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  {formatDisplayDate(asset.purchaseDate)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Location */}
                          <td className="py-2 px-3.5 text-slate-700">
                            <span className="block font-medium">{asset.location || 'Main Site'}</span>
                            {asset.department && (
                              <span className="text-[10px] text-slate-400 block">
                                {asset.department}
                              </span>
                            )}
                          </td>

                          {/* Next Due / Status as badges: Overdue = red, Due soon = amber, Scheduled = blue, Unscheduled = gray */}
                          <td className="py-2 px-3.5">
                            {isUnderMaint ? (
                              <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded text-[10px] font-bold">
                                <Wrench className="w-3 h-3" /> Under Service
                              </span>
                            ) : isMaintOverdue ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                  Overdue {rel?.text}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {formatDisplayDate(asset.nextMaintenanceDate)}
                                </span>
                              </div>
                            ) : isMaintDue30Days ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  Due soon ({rel?.text})
                                </span>
                              </div>
                            ) : nextMaint ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                Scheduled {formatDisplayDate(asset.nextMaintenanceDate)}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Unscheduled</span>
                            )}
                          </td>

                          {/* Maintenance Spend */}
                          <td className="py-2 px-3.5 text-right font-mono font-bold text-slate-900 text-xs">
                            {formatINR(asset.totalMaintenanceCost)}
                          </td>

                          {/* Warranty Status: Active = green, Expiring = amber, Expired = red, No warranty = muted */}
                          <td className="py-2 px-3.5">
                            {asset.isWarrantyActive ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active ({formatDisplayDate(asset.warrantyEndDate)})
                              </span>
                            ) : isWarrantyExpiring60Days ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                Expiring ({formatDisplayDate(asset.warrantyEndDate)})
                              </span>
                            ) : warrantyEnd ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                Expired ({formatDisplayDate(asset.warrantyEndDate)})
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No warranty</span>
                            )}
                          </td>

                          {/* Action Button: compact outline button with wrench icon */}
                          <td
                            className="py-2 px-3.5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => onLogMaintenance(asset)}
                                className="h-[28px] px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                              >
                                <Wrench className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="whitespace-nowrap">Log service</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    }
                  )}
                </tbody>
              </table>
            </div>

            {/* Ledger-style Pagination Footer */}
            <LedgerPagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              totalPages={totalPages}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              entityName="records"
              summaryNode={
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                  <span>Maintenance spend:</span>
                  <strong className="font-bold text-slate-800">
                    {formatINR(totalMaintenanceSpend)}
                  </strong>
                </div>
              }
            />
          </>
        )}
      </div>
    </div>
  )
}

export default MaintenanceWarrantyTab
