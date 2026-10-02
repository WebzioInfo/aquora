import React, { useState } from 'react'
import {
  Package,
  Boxes,
  Info,
  Edit,
  Search,
  X
} from 'lucide-react'
import { formatINR } from './assetHelpers'

interface StockValuationTabProps {
  products: any[]
  rawMaterials: any[]
  loading: boolean
  onEditPrice: (type: 'product' | 'rawMaterial', id: string, name: string, currentPrice: number) => void
  canManage: boolean
}

export const StockValuationTab: React.FC<StockValuationTabProps> = ({
  products,
  rawMaterials,
  loading,
  onEditPrice,
  canManage
}) => {
  const [search, setSearch] = useState('')
  const [section, setSection] = useState<'all' | 'products' | 'rawMaterials'>('all')

  const totalFinishedGoodsVal = products.reduce((sum, p) => {
    const price = Number(p.sellingPrice || p.costPrice || 15.0)
    return sum + (Number(p.currentStock) || 0) * price
  }, 0)

  const totalRawMaterialsVal = rawMaterials.reduce((sum, rm) => {
    const cost = Number(rm.costPerUnit || 5.0)
    return sum + (Number(rm.currentStock) || 0) * cost
  }, 0)

  const filteredProducts = products.filter((p) =>
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(search.toLowerCase())
  )

  const filteredRawMaterials = rawMaterials.filter((rm) =>
    (rm.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (rm.code || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full space-y-3">
      {/* Subtle bordered inline note above filter bar */}
      <div className="px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-2 text-xs text-slate-600">
        <Info className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          <strong className="text-slate-800">Inventory notice:</strong> Stock valuation is tracked separately from capital fixed assets. Finished products and warehouse materials reflect active inventory values.
        </span>
      </div>

      {/* Filter toolbar (single rounded container like Ledger) */}
      <div className="p-2 sm:px-3 sm:py-2 border border-slate-200/90 shadow-xs w-full bg-white rounded-xl shrink-0 select-none">
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          {/* Search on left */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products or raw materials..."
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

          {/* Segmented toggle on the right (All Items / Finished Goods (n) / Raw Materials (n)) */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setSection('all')}
              className={`py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                section === 'all'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              All Items
            </button>
            <button
              type="button"
              onClick={() => setSection('products')}
              className={`py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                section === 'products'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Finished Goods ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setSection('rawMaterials')}
              className={`py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                section === 'rawMaterials'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Raw Materials ({rawMaterials.length})
            </button>
          </div>
        </div>
      </div>

      {/* Two Table Cards (Scrollable container) */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 [scrollbar-gutter:stable] [scrollbar-width:thin]">
        {/* Card 1: Finished Goods */}
        {(section === 'all' || section === 'products') && (
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden w-full">
            {/* Header row with icon + title + item count on left, Total on right */}
            <div className="py-2.5 px-3.5 bg-slate-50 border-b border-slate-200/90 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Finished Goods Valuation ({filteredProducts.length} items)
                </h3>
              </div>
              <div className="font-mono text-xs text-slate-700 font-bold">
                Total: {formatINR(totalFinishedGoodsVal)}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/60 border-b border-slate-200/80 select-none">
                  <tr className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2 px-3.5">Product</th>
                    <th className="py-2 px-3.5 text-right">Current Stock</th>
                    <th className="py-2 px-3.5 text-right">Price / Unit</th>
                    <th className="py-2 px-3.5 text-right">Total Stock Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredProducts.map((p) => {
                    const price = Number(p.sellingPrice || p.costPrice || 15.0)
                    const val = (Number(p.currentStock) || 0) * price
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-2 px-3.5 font-medium text-slate-900">
                          {p.name}
                          {p.sku && <span className="text-[10px] text-slate-400 font-mono block">{p.sku}</span>}
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono font-bold text-slate-800">
                          {(p.currentStock || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono text-slate-600">
                          <div className="flex items-center justify-end gap-1.5">
                            <span>{formatINR(price, true)}</span>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => onEditPrice('product', p.id, p.name, price)}
                                title="Edit unit price"
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all cursor-pointer"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono font-bold text-slate-900">
                          {formatINR(val)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Card 2: Raw Materials */}
        {(section === 'all' || section === 'rawMaterials') && (
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden w-full">
            {/* Header row with icon + title + item count on left, Total on right */}
            <div className="py-2.5 px-3.5 bg-slate-50 border-b border-slate-200/90 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Raw Materials Valuation ({filteredRawMaterials.length} materials)
                </h3>
              </div>
              <div className="font-mono text-xs text-slate-700 font-bold">
                Total: {formatINR(totalRawMaterialsVal)}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/60 border-b border-slate-200/80 select-none">
                  <tr className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2 px-3.5">Material</th>
                    <th className="py-2 px-3.5 text-right">Current Stock</th>
                    <th className="py-2 px-3.5 text-right">Cost / Unit</th>
                    <th className="py-2 px-3.5 text-right">Total Material Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRawMaterials.map((rm) => {
                    const cost = Number(rm.costPerUnit || 5.0)
                    const val = (Number(rm.currentStock) || 0) * cost
                    return (
                      <tr key={rm.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-2 px-3.5 font-medium text-slate-900">
                          {rm.name}
                          {rm.code && <span className="text-[10px] text-slate-400 font-mono block">({rm.code})</span>}
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono font-bold text-slate-800">
                          {(rm.currentStock || 0).toLocaleString()} {rm.unit || rm.baseUnit || ''}
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono text-slate-600">
                          <div className="flex items-center justify-end gap-1.5">
                            <span>{formatINR(cost, true)}</span>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => onEditPrice('rawMaterial', rm.id, rm.name, cost)}
                                title="Edit unit price"
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-all cursor-pointer"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono font-bold text-slate-900">
                          {formatINR(val)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StockValuationTab
