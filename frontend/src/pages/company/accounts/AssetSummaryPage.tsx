import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import { productsService } from '../../../services/products'
import { rawMaterialsService } from '../../../services/rawMaterials'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import { Package, Boxes, PieChart, TrendingUp, Calculator } from 'lucide-react'

export const AssetSummaryPage: React.FC = () => {

  const { data: assetSummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['assetSummary'],
    queryFn: () => simpleAccountsService.getAssetSummary()
  })

  const { data: productsRes, isLoading: isProductsLoading } = useQuery({
    queryKey: ['productsListAssetSummary'],
    queryFn: async () => {
      const res = await productsService.getProducts(1, 100, '')
      return res.data?.items || []
    }
  })

  const { data: rawMaterialsRes, isLoading: isRawMaterialsLoading } = useQuery({
    queryKey: ['rawMaterialsListAssetSummary'],
    queryFn: async () => {
      const res = await rawMaterialsService.getRawMaterials(1, 100, '')
      return res.data?.items || []
    }
  })

  const products = productsRes || []
  const rawMaterials = rawMaterialsRes || []

  const isLoading = isSummaryLoading || isProductsLoading || isRawMaterialsLoading

  if (isLoading) {
    return <EnterpriseLoading label="Calculating Live Asset Summaries..." />
  }

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0)
  }

  return (
    <div className="space-y-6">
      <EnterpriseHeader
        title="Asset Summary"
        description="Read-only breakdown of inventory assets, raw materials, and average costs derived live from inventory records"
      />

      {/* KPI CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Total Inventory Value */}
        <EnterpriseCard className="p-5 border-l-4 border-l-teal-600 col-span-1 md:col-span-3 lg:col-span-1 bg-teal-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-teal-800 uppercase tracking-wider">Total Inventory Value</span>
            <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
              <PieChart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {formatCurrency(assetSummary?.combinedInventoryValue)}
          </div>
        </EnterpriseCard>

        {/* Finished Goods Value */}
        <EnterpriseCard className="p-4 border-l-4 border-l-blue-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Finished Goods Value</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            {formatCurrency(assetSummary?.finishedGoods?.totalStockValue)}
          </div>
        </EnterpriseCard>

        {/* Finished Goods Quantity */}
        <EnterpriseCard className="p-4 border-l-4 border-l-indigo-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Finished Goods Quantity</span>
          <div className="text-xl font-extrabold text-indigo-600 mt-1">
            {assetSummary?.finishedGoods?.totalQuantity?.toLocaleString() || 0} Units
          </div>
        </EnterpriseCard>

        {/* Average Finished Goods Cost */}
        <EnterpriseCard className="p-4 border-l-4 border-l-sky-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Finished Goods Cost</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            {formatCurrency(assetSummary?.finishedGoods?.averageUnitCost)} / Unit
          </div>
        </EnterpriseCard>

        {/* Raw Material Value */}
        <EnterpriseCard className="p-4 border-l-4 border-l-cyan-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Raw Material Value</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            {formatCurrency(assetSummary?.rawMaterials?.totalStockValue)}
          </div>
        </EnterpriseCard>

        {/* Raw Material Quantity */}
        <EnterpriseCard className="p-4 border-l-4 border-l-amber-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Raw Material Quantity</span>
          <div className="text-xl font-extrabold text-amber-600 mt-1">
            {assetSummary?.rawMaterials?.totalQuantity?.toLocaleString() || 0} Units
          </div>
        </EnterpriseCard>

        {/* Average Raw Material Cost */}
        <EnterpriseCard className="p-4 border-l-4 border-l-emerald-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Raw Material Cost</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            {formatCurrency(assetSummary?.rawMaterials?.averageUnitCost)} / Unit
          </div>
        </EnterpriseCard>
      </div>

      {/* SUMMARY TABLES GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FINISHED GOODS SUMMARY TABLE */}
        <EnterpriseCard className="p-6">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" /> Finished Goods Inventory Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3">Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Current Stock</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products && products.length > 0 ? (
                  products.map((p) => {
                    const price = p.sellingPrice || p.costPrice || 15.0
                    const value = (p.currentStock || 0) * price
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{p.name}</td>
                        <td className="p-3"><EnterpriseBadge variant="gray">{'Bottle'}</EnterpriseBadge></td>
                        <td className="p-3 text-right font-bold text-blue-600">{p.currentStock?.toLocaleString()}</td>
                        <td className="p-3 text-right text-slate-600">{formatCurrency(price)}</td>
                        <td className="p-3 text-right font-extrabold text-slate-900">{formatCurrency(value)}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 font-medium">No finished goods products found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </EnterpriseCard>

        {/* RAW MATERIAL SUMMARY TABLE */}
        <EnterpriseCard className="p-6">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-amber-600" /> Raw Materials Inventory Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3">Material</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Current Stock</th>
                  <th className="p-3 text-right">Cost / Unit</th>
                  <th className="p-3 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rawMaterials && rawMaterials.length > 0 ? (
                  rawMaterials.map((rm) => {
                    const cost = rm.costPerUnit || 5.0
                    const value = (rm.currentStock || 0) * cost
                    return (
                      <tr key={rm.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{rm.name} ({rm.code})</td>
                        <td className="p-3"><EnterpriseBadge variant="info">{rm.category}</EnterpriseBadge></td>
                        <td className="p-3 text-right font-bold text-amber-600">{rm.currentStock?.toLocaleString()} {rm.baseUnit || rm.unit}</td>
                        <td className="p-3 text-right text-slate-600">{formatCurrency(cost)}</td>
                        <td className="p-3 text-right font-extrabold text-slate-900">{formatCurrency(value)}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 font-medium">No raw materials found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </EnterpriseCard>
      </div>
    </div>
  )
}

export default AssetSummaryPage
