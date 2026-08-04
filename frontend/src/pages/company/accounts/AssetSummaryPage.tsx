import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import { productsService } from '../../../services/products'
import { rawMaterialsService } from '../../../services/rawMaterials'
import { purchaseService, type AssetHistory } from '../../../services/purchases'
import { api } from '../../../services/api'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import { Package, Boxes, PieChart, History, Cpu, X, Calendar, User, Info } from 'lucide-react'

interface AssetRecord {
  id: string
  assetName: string
  assetCategory: string
  serialNumber?: string
  purchaseDate: string
  purchasePrice: number
  currentStatus: string
  location?: string
  currentValue: number
}

export const AssetSummaryPage: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState<AssetRecord | null>(null)
  const [assetHistoryList, setAssetHistoryList] = useState<AssetHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false)

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

  const { data: assetsRes, isLoading: isAssetsLoading } = useQuery({
    queryKey: ['registeredAssetsList'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: AssetRecord[] }>('/api/v1/finance/assets')
        return res.data.data || []
      } catch {
        return []
      }
    }
  })

  const products = productsRes || []
  const rawMaterials = rawMaterialsRes || []
  const registeredAssets = assetsRes || []

  const isLoading = isSummaryLoading || isProductsLoading || isRawMaterialsLoading || isAssetsLoading

  const handleOpenAssetHistory = async (asset: AssetRecord) => {
    setSelectedAsset(asset)
    setLoadingHistory(true)
    try {
      const history = await purchaseService.getAssetHistory(asset.id)
      setAssetHistoryList(history || [])
    } catch {
      setAssetHistoryList([])
    } finally {
      setLoadingHistory(false)
    }
  }

  if (isLoading) {
    return <EnterpriseLoading label="Calculating Live Asset Summaries..." />
  }

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0)
  }

  return (
    <div className="space-y-6">
      <EnterpriseHeader
        title="Asset Summary & Capital Asset Register"
        description="Comprehensive view of inventory stock assets, machinery, office assets, and lifecycle audit history"
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

        {/* Registered Capital Assets */}
        <EnterpriseCard className="p-4 border-l-4 border-l-purple-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Capital Fixed Assets</span>
          <div className="text-xl font-extrabold text-purple-600 mt-1">
            {registeredAssets.length} Assets Registered
          </div>
        </EnterpriseCard>
      </div>

      {/* REGISTERED CAPITAL ASSET TABLE WITH HISTORY TIMELINE */}
      {registeredAssets.length > 0 && (
        <EnterpriseCard className="p-6">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-600" /> Capital Assets & Machinery Register
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3">Asset Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Purchase Date</th>
                  <th className="p-3 text-right">Purchase Price</th>
                  <th className="p-3 text-right">Current Value</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">History Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registeredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">
                      {asset.assetName}
                      {asset.serialNumber && <p className="text-[10px] text-slate-400 font-mono">SN: {asset.serialNumber}</p>}
                    </td>
                    <td className="p-3"><EnterpriseBadge variant="info">{asset.assetCategory}</EnterpriseBadge></td>
                    <td className="p-3 text-slate-600">{asset.location || 'Main Site'}</td>
                    <td className="p-3 text-slate-600">{new Date(asset.purchaseDate).toLocaleDateString('en-IN')}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(asset.purchasePrice)}</td>
                    <td className="p-3 text-right font-bold font-mono text-purple-700">{formatCurrency(asset.currentValue)}</td>
                    <td className="p-3 text-center">
                      <EnterpriseBadge variant={asset.currentStatus === 'Active' ? 'success' : 'warning'}>
                        {asset.currentStatus}
                      </EnterpriseBadge>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleOpenAssetHistory(asset)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
                      >
                        <History className="w-3.5 h-3.5" /> Timeline
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EnterpriseCard>
      )}

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

      {/* ASSET HISTORY TIMELINE MODAL */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedAsset.assetName}</h3>
                <p className="text-xs text-slate-500">Asset Audit & Activity Lifecycle History</p>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {loadingHistory ? (
                <div className="p-8 text-center text-slate-400">Loading timeline...</div>
              ) : assetHistoryList.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Info className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No History Records Found</p>
                  <p className="text-xs">Asset history will accumulate as maintenance, updates, or audits occur.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-purple-200 ml-3 space-y-6">
                  {assetHistoryList.map((h) => (
                    <div key={h.id} className="relative pl-6">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-purple-600 border-2 border-white" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">{h.action}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{new Date(h.date).toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{h.remarks || h.newValue || 'Action logged'}</p>
                      <span className="text-[10px] text-slate-400 block mt-0.5">By: {h.performedBy}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetSummaryPage
