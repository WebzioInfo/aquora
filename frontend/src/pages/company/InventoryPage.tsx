import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { productsService } from '../../services/products'
import { rawMaterialsService } from '../../services/rawMaterials'
import { brandService } from '../../services/brands'
import { RAW_MATERIAL_CATEGORIES } from '../../utils/rawMaterialCategories'
import { Search, Plus, Edit2, Trash2, ChevronDown, ChevronUp, RefreshCw, RotateCcw, Package } from 'lucide-react'
import EnterpriseModal from '../../components/ui/EnterpriseModal'
import EnterpriseInput from '../../components/ui/EnterpriseInput'
import EnterpriseSelect from '../../components/ui/EnterpriseSelect'
import EnterpriseButton from '../../components/ui/EnterpriseButton'

type ToastType = 'success' | 'error' | 'warning'

const MOVEMENT_BADGE: Record<string, { label: string; cls: string }> = {
  ProductionEntry:        { label: 'Production',  cls: 'bg-red-50 border-red-200 text-red-700' },
  ProductionConsumption:  { label: 'Consumption', cls: 'bg-red-50 border-red-200 text-red-700' },
  StockAdjustment:        { label: 'Adjustment',  cls: 'bg-purple-50 border-purple-200 text-purple-700' },
  Purchase:               { label: 'Purchase',    cls: 'bg-green-50 border-green-200 text-green-700' },
  OpeningStock:           { label: 'Opening',     cls: 'bg-slate-100 border-slate-300 text-slate-600' },
  Transfer:               { label: 'Transfer',    cls: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  Return:                 { label: 'Return',      cls: 'bg-teal-50 border-teal-200 text-teal-700' },
  Sales:                  { label: 'Sales',       cls: 'bg-orange-50 border-orange-200 text-orange-700' },
}
const getMovementBadge = (type: string) =>
  MOVEMENT_BADGE[type] || { label: type, cls: 'bg-slate-100 border-slate-200 text-slate-600' }

interface MovementPanelProps {
  materialId: string
  currentStock: number
  unit: string
}

const MovementPanel: React.FC<MovementPanelProps> = ({ materialId, currentStock, unit }) => {
  const [page, setPage] = useState(1)
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ['movements', materialId, page],
    queryFn: async () => {
      const res = await api.get(`/api/v1/rawmaterials/${materialId}/movements?pageNumber=${page}&pageSize=20`)
      return res.data?.data || null
    },
    staleTime: 30_000,
  })
  const movements: any[] = data?.items || []
  const totalPages: number = data?.totalPages || 1
  const fmtDT = (d: string) => {
    const dt = new Date(d)
    return {
      date: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    }
  }
  return (
    <div className="bg-[#F8FAFC] border-t border-[#E5E7EB] px-4 py-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
        {[
          { label: 'Current Stock', value: currentStock, cls: currentStock <= 0 ? 'text-red-600' : 'text-slate-900' },
          { label: 'Reserved', value: currentStock > 0 ? Math.round(currentStock * 0.15) : 0, cls: 'text-slate-900' },
          { label: 'Available', value: currentStock > 0 ? Math.round(currentStock * 0.85) : 0, cls: 'text-green-600' },
          { label: 'Last Movement', value: movements.length > 0 ? fmtDT(movements[0].createdAt).date : '—', cls: 'text-slate-800' },
        ].map((c, i) => (
          <div key={i} className="bg-white border border-[#E5E7EB] rounded-lg p-3 flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{c.label}</span>
            <span className={`text-[16px] font-black mt-0.5 leading-tight ${c.cls}`}>
              {i < 3 ? <>{c.value} <span className="text-[11px] font-semibold text-slate-500">{unit}</span></> : c.value}
            </span>
          </div>
        ))}
      </div>
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#F1F5F9] flex items-center justify-between select-none">
          <p className="text-[12px] font-bold text-slate-600 uppercase tracking-widest">Movement History</p>
          <button onClick={() => refetch()} className="h-[26px] px-2 text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded flex items-center gap-1 transition-all">
            <RefreshCw className="w-3 h-3" />Refresh
          </button>
        </div>
        {isLoading ? (
          <div className="py-8 text-center text-[13px] text-slate-400">Loading movement history...</div>
        ) : movements.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-slate-400 italic">No stock movements recorded for this material.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-bold text-slate-500 uppercase tracking-wider h-[34px] select-none">
                  <th className="py-2 px-4">Date</th>
                  <th className="py-2 px-4">Time</th>
                  <th className="py-2 px-4">Movement Type</th>
                  <th className="py-2 px-4">Reference</th>
                  <th className="py-2 px-4 text-right">Quantity</th>
                  <th className="py-2 px-4 text-right">Balance After</th>
                  <th className="py-2 px-4">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-[13px] text-slate-700">
                {movements.map((m: any, idx: number) => {
                  const badge = getMovementBadge(m.referenceType)
                  const dt = fmtDT(m.createdAt)
                  const isPos = m.quantity > 0
                  return (
                    <tr key={m.id} className={`h-[36px] transition-colors hover:bg-[#F8FAFC] ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                      <td className="py-2 px-4 font-semibold text-slate-800 whitespace-nowrap">{dt.date}</td>
                      <td className="py-2 px-4 text-slate-500 whitespace-nowrap">{dt.time}</td>
                      <td className="py-2 px-4">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="py-2 px-4 font-mono text-slate-400 text-[11px]">{m.referenceId?.slice(0,8)}...</td>
                      <td className={`py-2 px-4 text-right font-bold tabular-nums whitespace-nowrap ${isPos ? 'text-green-600' : 'text-red-600'}`}>
                        {isPos ? '+' : ''}{m.quantity} {m.unit}
                      </td>
                      <td className="py-2 px-4 text-right font-bold tabular-nums text-slate-900 whitespace-nowrap">{m.balanceAfter} {m.unit}</td>
                      <td className="py-2 px-4 text-slate-500 whitespace-nowrap">{m.createdBy}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-[#F1F5F9] flex items-center justify-between select-none">
            <span className="text-[11px] text-slate-400 font-semibold">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page<=1} onClick={() => setPage(p=>p-1)} className="h-[26px] px-3 text-[11px] font-bold text-slate-600 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Prev</button>
              <button disabled={page>=totalPages} onClick={() => setPage(p=>p+1)} className="h-[26px] px-3 text-[11px] font-bold text-slate-600 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface InventoryPageProps {
  canWrite: boolean
  showToast: (msg: string, type: 'success' | 'error' | 'warning') => void
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ canWrite, showToast }) => {
  const queryClient = useQueryClient()
  const [inventoryTab, setInventoryTab] = useState<'products' | 'raw_materials' | 'brands'>('products')
  const [globalSearch, setGlobalSearch] = useState('')
  const [productsPage, setProductsPage] = useState(1)
  const [productsSearch, setProductsSearch] = useState('')
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false)
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [productFormName, setProductFormName] = useState('')
  const [productFormBrandId, setProductFormBrandId] = useState('')
  const [productFormSKU, setProductFormSKU] = useState('')
  const [productFormIsActive, setProductFormIsActive] = useState(true)
  const [brandsPage, setBrandsPage] = useState(1)
  const [brandsSearch, setBrandsSearch] = useState('')
  const [isAddBrandModalOpen, setIsAddBrandModalOpen] = useState(false)
  const [isEditBrandModalOpen, setIsEditBrandModalOpen] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<any | null>(null)
  const [brandFormName, setBrandFormName] = useState('')
  const [brandFormCode, setBrandFormCode] = useState('')
  const [brandFormDescription, setBrandFormDescription] = useState('')
  const [brandFormIsActive, setBrandFormIsActive] = useState(true)
  const [rawMaterialsPage, setRawMaterialsPage] = useState(1)
  const [rawMaterialsSearch, setRawMaterialsSearch] = useState('')
  const [isAddRawMaterialModalOpen, setIsAddRawMaterialModalOpen] = useState(false)
  const [isEditRawMaterialModalOpen, setIsEditRawMaterialModalOpen] = useState(false)
  const [selectedRawMaterial, setSelectedRawMaterial] = useState<any | null>(null)
  const [rawMaterialFormName, setRawMaterialFormName] = useState('')
  const [rawMaterialFormCategory, setRawMaterialFormCategory] = useState('PREFORM')
  const [rawMaterialFormUnit, setRawMaterialFormUnit] = useState('PIECE')
  const [rawMaterialFormIsActive, setRawMaterialFormIsActive] = useState(true)
  const [rawMaterialFormCurrentStock, setRawMaterialFormCurrentStock] = useState('0')
  const [rawMaterialFormStockAdjustment, setRawMaterialFormStockAdjustment] = useState('0')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const toggleRow = (id: string) => setExpandedRowId(prev => prev === id ? null : id)
  const switchTab = (tab: 'products' | 'raw_materials' | 'brands') => {
    setInventoryTab(tab); setExpandedRowId(null); setGlobalSearch('')
    setProductsSearch(''); setRawMaterialsSearch(''); setBrandsSearch('')
  }
  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['productsList', productsPage, productsSearch],
    queryFn: async () => (await productsService.getProducts(productsPage, 10, productsSearch)).data,
    enabled: inventoryTab === 'products'
  })
  const { data: paginatedBrandsData, isLoading: brandsLoading, refetch: refetchBrands } = useQuery({
    queryKey: ['brandsPaginated', brandsPage, brandsSearch],
    queryFn: async () => (await brandService.getBrands(brandsPage, 10, brandsSearch)).data,
    enabled: inventoryTab === 'brands'
  })
  const { data: brands = [] } = useQuery({
    queryKey: ['brandsDropdown'],
    queryFn: async () => (await brandService.getBrands(1, 1000)).data?.items || []
  })
  const { data: rawMaterialsData, isLoading: rawMaterialsLoading, refetch: refetchMaterials } = useQuery({
    queryKey: ['rawMaterialsList', rawMaterialsPage, rawMaterialsSearch],
    queryFn: async () => (await rawMaterialsService.getRawMaterials(rawMaterialsPage, 10, rawMaterialsSearch)).data,
    enabled: inventoryTab === 'raw_materials'
  })
  const allMats: any[] = rawMaterialsData?.items || []
  const totalProducts = productsData?.totalCount ?? 0
  const totalMaterials = rawMaterialsData?.totalCount ?? 0
  const lowStock = allMats.filter(m => m.currentStock > 0 && m.currentStock < 50).length
  const outOfStock = allMats.filter(m => m.currentStock <= 0).length
  const createProductMutation = useMutation({
    mutationFn: productsService.createProduct,
    onSuccess: (d) => { if (d.success) { showToast('Product created.', 'success'); queryClient.invalidateQueries({ queryKey: ['productsList'] }); setIsAddProductModalOpen(false) } else showToast(d.message||'Failed.','error') },
    onError: (e: any) => showToast(e.response?.data?.message||'Error.','error')
  })
  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsService.updateProduct(id, data),
    onSuccess: (d) => { if (d.success) { showToast('Product updated.', 'success'); queryClient.invalidateQueries({ queryKey: ['productsList'] }); setIsEditProductModalOpen(false) } else showToast(d.message||'Failed.','error') },
    onError: (e: any) => showToast(e.response?.data?.message||'Error.','error')
  })
  const deleteProductMutation = useMutation({
    mutationFn: productsService.deleteProduct,
    onSuccess: (d) => { if (d.success) { showToast('Product deleted.', 'success'); queryClient.invalidateQueries({ queryKey: ['productsList'] }) } else showToast(d.message||'Failed.','error') },
    onError: (e: any) => showToast(e.response?.data?.message||'Error.','error')
  })
  const createRawMaterialMutation = useMutation({
    mutationFn: rawMaterialsService.createRawMaterial,
    onSuccess: (d) => { if (d.success) { showToast('Raw material created.', 'success'); queryClient.invalidateQueries({ queryKey: ['rawMaterialsList'] }); queryClient.invalidateQueries({ queryKey: ['rawMaterials'] }); setIsAddRawMaterialModalOpen(false); setRawMaterialFormName(''); setRawMaterialFormCurrentStock('0') } else showToast(d.message||'Failed.','error') },
    onError: (e: any) => showToast(e.response?.data?.message||'Error.','error')
  })
  const updateRawMaterialMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => rawMaterialsService.updateRawMaterial(id, data),
    onSuccess: (d) => { if (d.success) { showToast('Raw material updated.', 'success'); queryClient.invalidateQueries({ queryKey: ['rawMaterialsList'] }); queryClient.invalidateQueries({ queryKey: ['rawMaterials'] }); setIsEditRawMaterialModalOpen(false) } else showToast(d.message||'Failed.','error') },
    onError: (e: any) => showToast(e.response?.data?.message||'Error.','error')
  })
  const deleteRawMaterialMutation = useMutation({
    mutationFn: rawMaterialsService.deleteRawMaterial,
    onSuccess: (d) => { if (d.success) { showToast('Raw material deleted.', 'success'); queryClient.invalidateQueries({ queryKey: ['rawMaterialsList'] }); queryClient.invalidateQueries({ queryKey: ['rawMaterials'] }) } else showToast(d.message||'Failed.','error') },
    onError: (e: any) => showToast(e.response?.data?.message||'Error.','error')
  })
  const createBrandMutation = useMutation({
    mutationFn: brandService.createBrand,
    onSuccess: (d) => { if (d.success) { showToast('Brand created.', 'success'); queryClient.invalidateQueries({ queryKey: ['brandsPaginated'] }); queryClient.invalidateQueries({ queryKey: ['brandsDropdown'] }); setIsAddBrandModalOpen(false); setBrandFormName(''); setBrandFormCode(''); setBrandFormDescription('') } else showToast(d.message||'Failed.','error') },
    onError: (e: any) => showToast(e.response?.data?.message||'Error.','error')
  })
  const updateBrandMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => brandService.updateBrand(id, data),
    onSuccess: (d) => { if (d.success) { showToast('Brand updated.', 'success'); queryClient.invalidateQueries({ queryKey: ['brandsPaginated'] }); queryClient.invalidateQueries({ queryKey: ['brandsDropdown'] }); setIsEditBrandModalOpen(false) } else showToast(d.message||'Failed.','error') },
    onError: (e: any) => showToast(e.response?.data?.message||'Error.','error')
  })
  const deleteBrandMutation = useMutation({
    mutationFn: brandService.deleteBrand,
    onSuccess: (d) => { if (d.success) { showToast('Brand deleted.', 'success'); queryClient.invalidateQueries({ queryKey: ['brandsPaginated'] }); queryClient.invalidateQueries({ queryKey: ['brandsDropdown'] }) } else showToast(d.message||'Failed.','error') },
    onError: (e: any) => showToast(e.response?.data?.message||'Error.','error')
  })
  const handleCreateProductSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!productFormName.trim()) return showToast('Product Name is required.','warning'); if (!productFormBrandId) return showToast('Brand is required.','warning'); createProductMutation.mutate({ name: productFormName.trim(), brandId: productFormBrandId, sku: productFormSKU.trim()||undefined, isActive: productFormIsActive }) }
  const handleEditProductSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!selectedProduct||!productFormName.trim()) return showToast('Product Name is required.','warning'); if (!productFormBrandId) return showToast('Brand is required.','warning'); updateProductMutation.mutate({ id: selectedProduct.id, data: { name: productFormName.trim(), brandId: productFormBrandId, sku: productFormSKU.trim()||undefined, isActive: productFormIsActive } }) }
  const openEditProduct = (prod: any) => { setSelectedProduct(prod); setProductFormName(prod.name); setProductFormBrandId(prod.brandId); setProductFormSKU(prod.sku||''); setProductFormIsActive(prod.isActive); setIsEditProductModalOpen(true) }
  const triggerDeleteProduct = (id: string, name: string) => { if (confirm(`Delete product "${name}"?`)) deleteProductMutation.mutate(id) }
  const handleCreateRawMaterialSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!rawMaterialFormName.trim()) return showToast('Material Name is required.','warning'); createRawMaterialMutation.mutate({ name: rawMaterialFormName.trim(), category: rawMaterialFormCategory, unit: rawMaterialFormUnit, isActive: rawMaterialFormIsActive, currentStock: parseFloat(rawMaterialFormCurrentStock)||0 }) }
  const handleEditRawMaterialSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!selectedRawMaterial||!rawMaterialFormName.trim()) return showToast('Material Name is required.','warning'); updateRawMaterialMutation.mutate({ id: selectedRawMaterial.id, data: { name: rawMaterialFormName.trim(), category: rawMaterialFormCategory, unit: rawMaterialFormUnit, isActive: rawMaterialFormIsActive, currentStock: parseFloat(rawMaterialFormCurrentStock)||0, stockAdjustment: parseFloat(rawMaterialFormStockAdjustment)||0 } }) }
  const openEditRawMaterial = (mat: any) => { setSelectedRawMaterial(mat); setRawMaterialFormName(mat.name); setRawMaterialFormCategory(mat.category.toUpperCase()); setRawMaterialFormUnit(mat.unit.toUpperCase()); setRawMaterialFormIsActive(mat.isActive); setRawMaterialFormCurrentStock(mat.currentStock?.toString()||'0'); setRawMaterialFormStockAdjustment('0'); setIsEditRawMaterialModalOpen(true) }
  const triggerDeleteRawMaterial = (id: string, name: string) => { if (confirm(`Delete raw material "${name}"?`)) deleteRawMaterialMutation.mutate(id) }
  const handleCreateBrandSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!brandFormName.trim()) return showToast('Brand Name is required.','warning'); createBrandMutation.mutate({ name: brandFormName.trim(), code: brandFormCode.trim()||undefined, description: brandFormDescription.trim()||undefined, isActive: brandFormIsActive }) }
  const handleEditBrandSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!selectedBrand||!brandFormName.trim()) return showToast('Brand Name is required.','warning'); updateBrandMutation.mutate({ id: selectedBrand.id, data: { name: brandFormName.trim(), code: brandFormCode.trim()||undefined, description: brandFormDescription.trim()||undefined, isActive: brandFormIsActive } }) }
  const openEditBrand = (brand: any) => { setSelectedBrand(brand); setBrandFormName(brand.name); setBrandFormCode(brand.code||''); setBrandFormDescription(brand.description||''); setBrandFormIsActive(brand.isActive); setIsEditBrandModalOpen(true) }
  const triggerDeleteBrand = (id: string, name: string) => { if (confirm(`Delete brand "${name}"?`)) deleteBrandMutation.mutate(id) }
  const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const matRowCls = (mat: any, i: number) => {
    if (mat.currentStock <= 0) return 'bg-red-50 hover:bg-red-100/60'
    if (mat.currentStock < 50) return 'bg-amber-50 hover:bg-amber-100/60'
    return i % 2 === 0 ? 'bg-white hover:bg-blue-50/30' : 'bg-[#FAFBFC] hover:bg-blue-50/30'
  }
  return (
    <div className="flex flex-col gap-4 font-sans text-slate-900 bg-[#F8FAFC] min-h-screen">
      <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-black text-slate-900 leading-tight tracking-tight">Inventory Management</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Track materials, products, and stock movements</p>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-[11px] text-slate-400 font-semibold select-none hidden sm:block">{todayStr}</span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Search inventory..." value={globalSearch}
              onChange={e => { const v=e.target.value; setGlobalSearch(v); if(inventoryTab==='products'){setProductsSearch(v);setProductsPage(1)} if(inventoryTab==='raw_materials'){setRawMaterialsSearch(v);setRawMaterialsPage(1)} if(inventoryTab==='brands')setBrandsSearch(v) }}
              className="h-[32px] pl-8 pr-3 text-[12px] border border-[#E5E7EB] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-blue-400 w-[200px] text-slate-800" />
          </div>
          {canWrite && inventoryTab==='products' && <button onClick={()=>{setProductFormName('');setProductFormBrandId((brands[0] as any)?.id||'');setProductFormSKU('');setProductFormIsActive(true);setIsAddProductModalOpen(true)}} className="h-[32px] px-3 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"><Plus className="w-3.5 h-3.5"/>Product</button>}
          {canWrite && inventoryTab==='raw_materials' && <button onClick={()=>{setRawMaterialFormName('');setRawMaterialFormCategory('PREFORM');setRawMaterialFormUnit('PIECE');setRawMaterialFormIsActive(true);setRawMaterialFormCurrentStock('0');setRawMaterialFormStockAdjustment('0');setIsAddRawMaterialModalOpen(true)}} className="h-[32px] px-3 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"><Plus className="w-3.5 h-3.5"/>Material</button>}
          {canWrite && inventoryTab==='brands' && <button onClick={()=>setIsAddBrandModalOpen(true)} className="h-[32px] px-3 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"><Plus className="w-3.5 h-3.5"/>Brand</button>}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
        {[{value:totalProducts,label:'Total Products',d:false,w:false},{value:totalMaterials,label:'Raw Materials',d:false,w:false},{value:lowStock,label:'Low Stock Items',d:false,w:lowStock>0},{value:outOfStock,label:'Out of Stock',d:outOfStock>0,w:false}].map((k,i)=>(
          <div key={i} className="bg-white border border-[#E5E7EB] rounded-lg py-2 px-3 shadow-sm flex flex-col justify-center h-[54px] text-center">
            <span className={`text-[20px] font-black leading-tight ${k.d?'text-red-600':k.w?'text-amber-600':'text-slate-900'}`}>{k.value}</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{k.label}</span>
          </div>
        ))}
      </div>
      <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b border-[#E5E7EB] select-none">
          {(['products','raw_materials','brands'] as const).map(tab=>(
            <button key={tab} onClick={()=>switchTab(tab)} className={`px-5 py-2.5 text-[12px] font-bold transition-all border-b-2 -mb-px ${inventoryTab===tab?'border-blue-600 text-blue-600 bg-blue-50/30':'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              {tab==='products'?'Products':tab==='raw_materials'?'Raw Materials':'Brands'}
            </button>
          ))}
          <div className="ml-auto flex items-center pr-3">
            <button onClick={()=>{if(inventoryTab==='products')refetchProducts();if(inventoryTab==='raw_materials')refetchMaterials();if(inventoryTab==='brands')refetchBrands()}} className="h-[28px] px-2.5 text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded flex items-center gap-1 transition-all">
              <RotateCcw className="w-3 h-3"/>Refresh
            </button>
          </div>
        </div>
        {inventoryTab==='products' && (
          productsLoading ? <div className="py-12 text-center text-[13px] text-slate-400">Loading products...</div>
          : productsData?.items && productsData.items.length > 0 ? (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none h-[36px]">
                    <th className="py-2 px-4">Product Name</th><th className="py-2 px-4">Brand</th>
                    <th className="py-2 px-4 text-center">Status</th><th className="py-2 px-4">Last Updated</th>
                    {canWrite && <th className="py-2 px-4 text-center">Actions</th>}
                  </tr></thead>
                  <tbody className="divide-y divide-[#F1F5F9] text-[13px] text-slate-700">
                    {productsData.items.map((row: any, i: number)=>(
                      <tr key={row.id} className={`h-[38px] transition-colors ${i%2===0?'bg-white':'bg-[#FAFBFC]'} hover:bg-blue-50/30`}>
                        <td className="py-2 px-4 font-bold text-slate-800">{row.name}</td>
                        <td className="py-2 px-4 text-slate-600">{row.brandName}</td>
                        <td className="py-2 px-4 text-center"><span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${row.isActive?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'}`}>{row.isActive?'Active':'Inactive'}</span></td>
                        <td className="py-2 px-4 text-slate-500 text-[12px]">{fmtDate(row.updatedAt||row.createdAt)}</td>
                        {canWrite && <td className="py-2 px-4 text-center"><div className="flex items-center justify-center gap-1">
                          <button onClick={()=>openEditProduct(row)} title="Edit" className="h-[26px] w-[26px] flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"><Edit2 className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>triggerDeleteProduct(row.id,row.name)} title="Delete" className="h-[26px] w-[26px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {productsData.totalPages > 1 && (
                <div className="px-4 py-2 border-t border-[#F1F5F9] flex items-center justify-between select-none">
                  <span className="text-[11px] text-slate-400 font-semibold">Page {productsPage} of {productsData.totalPages} &bull; {productsData.totalCount} products</span>
                  <div className="flex gap-2">
                    <button disabled={!productsData.hasPreviousPage} onClick={()=>setProductsPage(p=>p-1)} className="h-[26px] px-3 text-[11px] font-bold text-slate-600 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Prev</button>
                    <button disabled={!productsData.hasNextPage} onClick={()=>setProductsPage(p=>p+1)} className="h-[26px] px-3 text-[11px] font-bold text-slate-600 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next</button>
                  </div>
                </div>
              )}
            </div>
          ) : <div className="py-16 text-center"><Package className="w-8 h-8 text-slate-300 mx-auto mb-3"/><p className="text-[14px] font-semibold text-slate-600">No Products Found</p>{canWrite && <button onClick={()=>setIsAddProductModalOpen(true)} className="mt-4 h-[32px] px-4 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg cursor-pointer transition-all">Add Product</button>}</div>
        )}
        {inventoryTab==='raw_materials' && (
          rawMaterialsLoading ? <div className="py-12 text-center text-[13px] text-slate-400">Loading raw materials...</div>
          : rawMaterialsData?.items && rawMaterialsData.items.length > 0 ? (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none h-[36px]">
                    <th className="py-2 px-4">Material Name</th><th className="py-2 px-4">Category</th>
                    <th className="py-2 px-4 text-right">Current Stock</th><th className="py-2 px-4">Unit</th>
                    <th className="py-2 px-4 text-center">Status</th><th className="py-2 px-4">Last Updated</th>
                    {canWrite && <th className="py-2 px-4 text-center">Actions</th>}
                    <th className="py-2 px-4 text-center">Movements</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#F1F5F9] text-[13px] text-slate-700">
                    {rawMaterialsData.items.map((mat: any, i: number)=>{
                      const isExp=expandedRowId===mat.id
                      return (
                        <React.Fragment key={mat.id}>
                          <tr className={`h-[38px] cursor-pointer transition-colors ${matRowCls(mat,i)}`} onClick={()=>toggleRow(mat.id)}>
                            <td className="py-2 px-4 font-bold text-slate-800">{mat.name}</td>
                            <td className="py-2 px-4"><span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded uppercase tracking-wider">{mat.category}</span></td>
                            <td className="py-2 px-4 text-right font-black tabular-nums"><span className={mat.currentStock<=0?'text-red-600':mat.currentStock<50?'text-amber-600':'text-slate-900'}>{mat.currentStock??0}</span></td>
                            <td className="py-2 px-4 text-slate-500 text-[12px]">{mat.unit}</td>
                            <td className="py-2 px-4 text-center"><span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${mat.isActive?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'}`}>{mat.isActive?'Active':'Inactive'}</span></td>
                            <td className="py-2 px-4 text-slate-500 text-[12px]">{fmtDate(mat.updatedAt||mat.createdAt)}</td>
                            {canWrite && <td className="py-2 px-4 text-center" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-center gap-1">
                              <button onClick={()=>openEditRawMaterial(mat)} title="Edit" className="h-[26px] w-[26px] flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"><Edit2 className="w-3.5 h-3.5"/></button>
                              <button onClick={()=>triggerDeleteRawMaterial(mat.id,mat.name)} title="Delete" className="h-[26px] w-[26px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div></td>}
                            <td className="py-2 px-4 text-center">
                              <button onClick={e=>{e.stopPropagation();toggleRow(mat.id)}} className="h-[26px] px-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200 rounded border border-[#E5E7EB] inline-flex items-center gap-1 select-none transition-all">
                                {isExp?<><ChevronUp className="w-3 h-3"/>Hide</>:<><ChevronDown className="w-3 h-3"/>View</>}
                              </button>
                            </td>
                          </tr>
                          {isExp && <tr><td colSpan={canWrite?8:7} className="p-0"><MovementPanel materialId={mat.id} currentStock={mat.currentStock??0} unit={mat.unit}/></td></tr>}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-[#F1F5F9] flex items-center gap-4 select-none">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Legend:</span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"/>Low Stock (&lt;50)</span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"/>Out of Stock</span>
              </div>
              {rawMaterialsData.totalPages > 1 && (
                <div className="px-4 py-2 border-t border-[#F1F5F9] flex items-center justify-between select-none">
                  <span className="text-[11px] text-slate-400 font-semibold">Page {rawMaterialsPage} of {rawMaterialsData.totalPages} &bull; {rawMaterialsData.totalCount} materials</span>
                  <div className="flex gap-2">
                    <button disabled={!rawMaterialsData.hasPreviousPage} onClick={()=>setRawMaterialsPage(p=>p-1)} className="h-[26px] px-3 text-[11px] font-bold text-slate-600 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Prev</button>
                    <button disabled={!rawMaterialsData.hasNextPage} onClick={()=>setRawMaterialsPage(p=>p+1)} className="h-[26px] px-3 text-[11px] font-bold text-slate-600 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next</button>
                  </div>
                </div>
              )}
            </div>
          ) : <div className="py-16 text-center"><Package className="w-8 h-8 text-slate-300 mx-auto mb-3"/><p className="text-[14px] font-semibold text-slate-600">No Raw Materials Found</p>{canWrite && <button onClick={()=>setIsAddRawMaterialModalOpen(true)} className="mt-4 h-[32px] px-4 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg cursor-pointer transition-all">Add Material</button>}</div>
        )}
        {inventoryTab==='brands' && (
          brandsLoading ? <div className="py-12 text-center text-[13px] text-slate-400">Loading brands...</div>
          : paginatedBrandsData?.items && paginatedBrandsData.items.length > 0 ? (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none h-[36px]">
                    <th className="py-2 px-4">Brand Name</th><th className="py-2 px-4">Code</th><th className="py-2 px-4">Description</th>
                    <th className="py-2 px-4 text-center">Status</th><th className="py-2 px-4">Created</th>
                    {canWrite && <th className="py-2 px-4 text-center">Actions</th>}
                  </tr></thead>
                  <tbody className="divide-y divide-[#F1F5F9] text-[13px] text-slate-700">
                    {paginatedBrandsData.items.map((row: any, i: number)=>(
                      <tr key={row.id} className={`h-[38px] transition-colors ${i%2===0?'bg-white':'bg-[#FAFBFC]'} hover:bg-blue-50/30`}>
                        <td className="py-2 px-4 font-bold text-slate-800">{row.name}</td>
                        <td className="py-2 px-4 text-slate-500 font-mono text-[12px]">{row.code||'—'}</td>
                        <td className="py-2 px-4 text-slate-500 text-[12px] max-w-[200px] truncate">{row.description||'—'}</td>
                        <td className="py-2 px-4 text-center"><span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${row.isActive?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'}`}>{row.isActive?'Active':'Inactive'}</span></td>
                        <td className="py-2 px-4 text-slate-500 text-[12px]">{fmtDate(row.createdAt)}</td>
                        {canWrite && <td className="py-2 px-4 text-center"><div className="flex items-center justify-center gap-1">
                          <button onClick={()=>openEditBrand(row)} title="Edit" className="h-[26px] w-[26px] flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"><Edit2 className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>triggerDeleteBrand(row.id,row.name)} title="Delete" className="h-[26px] w-[26px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginatedBrandsData.totalPages > 1 && (
                <div className="px-4 py-2 border-t border-[#F1F5F9] flex items-center justify-between select-none">
                  <span className="text-[11px] text-slate-400 font-semibold">Page {brandsPage} of {paginatedBrandsData.totalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={!paginatedBrandsData.hasPreviousPage} onClick={()=>setBrandsPage(p=>p-1)} className="h-[26px] px-3 text-[11px] font-bold text-slate-600 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Prev</button>
                    <button disabled={!paginatedBrandsData.hasNextPage} onClick={()=>setBrandsPage(p=>p+1)} className="h-[26px] px-3 text-[11px] font-bold text-slate-600 border border-[#E5E7EB] rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next</button>
                  </div>
                </div>
              )}
            </div>
          ) : <div className="py-16 text-center"><Package className="w-8 h-8 text-slate-300 mx-auto mb-3"/><p className="text-[14px] font-semibold text-slate-600">No Brands Found</p>{canWrite && <button onClick={()=>setIsAddBrandModalOpen(true)} className="mt-4 h-[32px] px-4 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg cursor-pointer transition-all">Add Brand</button>}</div>
        )}
      </div>
      <EnterpriseModal isOpen={isAddProductModalOpen} onClose={()=>setIsAddProductModalOpen(false)} title="Add New Product" maxWidth="sm">
        <form onSubmit={handleCreateProductSubmit} className="flex flex-col gap-4">
          <EnterpriseInput label="Product Name" placeholder="E.g., Aquora Premium 500ml" value={productFormName} onChange={e=>setProductFormName(e.target.value)} required/>
          <EnterpriseSelect label="Brand" value={productFormBrandId} onChange={e=>setProductFormBrandId(e.target.value)} required><option value="">Select a Brand</option>{(brands as any[]).map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</EnterpriseSelect>
          <EnterpriseInput label="SKU (Optional)" placeholder="E.g., AQ-500ML" value={productFormSKU} onChange={e=>setProductFormSKU(e.target.value)}/>
          <div className="flex items-center gap-2"><input type="checkbox" id="addPA" checked={productFormIsActive} onChange={e=>setProductFormIsActive(e.target.checked)} className="w-4 h-4 accent-blue-600"/><label htmlFor="addPA" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">Active Product</label></div>
          <div className="flex justify-end gap-2 mt-2"><EnterpriseButton type="button" onClick={()=>setIsAddProductModalOpen(false)} variant="secondary">Cancel</EnterpriseButton><EnterpriseButton type="submit" variant="primary" disabled={createProductMutation.isPending}>{createProductMutation.isPending?'Saving...':'Add Product'}</EnterpriseButton></div>
        </form>
      </EnterpriseModal>
      <EnterpriseModal isOpen={isEditProductModalOpen} onClose={()=>setIsEditProductModalOpen(false)} title="Edit Product" maxWidth="sm">
        <form onSubmit={handleEditProductSubmit} className="flex flex-col gap-4">
          <EnterpriseInput label="Product Name" value={productFormName} onChange={e=>setProductFormName(e.target.value)} required/>
          <EnterpriseSelect label="Brand" value={productFormBrandId} onChange={e=>setProductFormBrandId(e.target.value)} required><option value="">Select a Brand</option>{(brands as any[]).map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</EnterpriseSelect>
          <EnterpriseInput label="SKU (Optional)" value={productFormSKU} onChange={e=>setProductFormSKU(e.target.value)}/>
          <div className="flex items-center gap-2"><input type="checkbox" id="editPA" checked={productFormIsActive} onChange={e=>setProductFormIsActive(e.target.checked)} className="w-4 h-4 accent-blue-600"/><label htmlFor="editPA" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">Active Product</label></div>
          <div className="flex justify-end gap-2 mt-2"><EnterpriseButton type="button" onClick={()=>setIsEditProductModalOpen(false)} variant="secondary">Cancel</EnterpriseButton><EnterpriseButton type="submit" variant="primary" disabled={updateProductMutation.isPending}>{updateProductMutation.isPending?'Saving...':'Save Changes'}</EnterpriseButton></div>
        </form>
      </EnterpriseModal>
      <EnterpriseModal isOpen={isAddRawMaterialModalOpen} onClose={()=>setIsAddRawMaterialModalOpen(false)} title="Add New Raw Material" maxWidth="sm">
        <form onSubmit={handleCreateRawMaterialSubmit} className="flex flex-col gap-4">
          <EnterpriseInput label="Material Name" placeholder="E.g., 28mm Preform (Premium)" value={rawMaterialFormName} onChange={e=>setRawMaterialFormName(e.target.value)} required/>
          <EnterpriseSelect label="Category" value={rawMaterialFormCategory} onChange={e=>setRawMaterialFormCategory(e.target.value)} required>{Object.values(RAW_MATERIAL_CATEGORIES).map(cat=><option key={cat.value} value={cat.value}>{cat.label}</option>)}</EnterpriseSelect>
          <EnterpriseSelect label="Unit" value={rawMaterialFormUnit} onChange={e=>setRawMaterialFormUnit(e.target.value)} required>{['PIECE','KG','GRAM','ROLL','BOX','BAG','LITER','ML'].map(u=><option key={u} value={u}>{u}</option>)}</EnterpriseSelect>
          <EnterpriseInput type="number" step="0.01" label="Initial Stock" placeholder="E.g., 500" value={rawMaterialFormCurrentStock} onChange={e=>setRawMaterialFormCurrentStock(e.target.value)}/>
          <div className="flex items-center gap-2"><input type="checkbox" id="addMA" checked={rawMaterialFormIsActive} onChange={e=>setRawMaterialFormIsActive(e.target.checked)} className="w-4 h-4 accent-blue-600"/><label htmlFor="addMA" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">Active Material</label></div>
          <div className="flex justify-end gap-2 mt-2"><EnterpriseButton type="button" onClick={()=>setIsAddRawMaterialModalOpen(false)} variant="secondary">Cancel</EnterpriseButton><EnterpriseButton type="submit" variant="primary" disabled={createRawMaterialMutation.isPending}>{createRawMaterialMutation.isPending?'Saving...':'Add Material'}</EnterpriseButton></div>
        </form>
      </EnterpriseModal>
      <EnterpriseModal isOpen={isEditRawMaterialModalOpen} onClose={()=>setIsEditRawMaterialModalOpen(false)} title="Edit Raw Material" maxWidth="sm">
        <form onSubmit={handleEditRawMaterialSubmit} className="flex flex-col gap-4">
          <EnterpriseInput label="Material Name" value={rawMaterialFormName} onChange={e=>setRawMaterialFormName(e.target.value)} required/>
          <EnterpriseSelect label="Category" value={rawMaterialFormCategory} onChange={e=>setRawMaterialFormCategory(e.target.value)} required>{Object.values(RAW_MATERIAL_CATEGORIES).map(cat=><option key={cat.value} value={cat.value}>{cat.label}</option>)}</EnterpriseSelect>
          <EnterpriseSelect label="Unit" value={rawMaterialFormUnit} onChange={e=>setRawMaterialFormUnit(e.target.value)} required>{['PIECE','KG','GRAM','ROLL','BOX','BAG','LITER','ML'].map(u=><option key={u} value={u}>{u}</option>)}</EnterpriseSelect>
          <div className="grid grid-cols-2 gap-4">
            <EnterpriseInput type="number" step="0.01" label="Current Stock" value={rawMaterialFormCurrentStock} onChange={e=>setRawMaterialFormCurrentStock(e.target.value)} required/>
            <EnterpriseInput type="number" step="0.01" label="Add Stock (Receipt)" placeholder="E.g., 40" value={rawMaterialFormStockAdjustment} onChange={e=>setRawMaterialFormStockAdjustment(e.target.value)}/>
          </div>
          <div className="flex items-center gap-2"><input type="checkbox" id="editMA" checked={rawMaterialFormIsActive} onChange={e=>setRawMaterialFormIsActive(e.target.checked)} className="w-4 h-4 accent-blue-600"/><label htmlFor="editMA" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">Active Material</label></div>
          <div className="flex justify-end gap-2 mt-2"><EnterpriseButton type="button" onClick={()=>setIsEditRawMaterialModalOpen(false)} variant="secondary">Cancel</EnterpriseButton><EnterpriseButton type="submit" variant="primary" disabled={updateRawMaterialMutation.isPending}>{updateRawMaterialMutation.isPending?'Saving...':'Save Changes'}</EnterpriseButton></div>
        </form>
      </EnterpriseModal>
      <EnterpriseModal isOpen={isAddBrandModalOpen} onClose={()=>setIsAddBrandModalOpen(false)} title="Add New Brand" maxWidth="sm">
        <form onSubmit={handleCreateBrandSubmit} className="flex flex-col gap-4">
          <EnterpriseInput label="Brand Name" placeholder="E.g., Aquora" value={brandFormName} onChange={e=>setBrandFormName(e.target.value)} required/>
          <EnterpriseInput label="Brand Code (Optional)" placeholder="E.g., AQR" value={brandFormCode} onChange={e=>setBrandFormCode(e.target.value)}/>
          <EnterpriseInput label="Description (Optional)" value={brandFormDescription} onChange={e=>setBrandFormDescription(e.target.value)}/>
          <div className="flex items-center gap-2"><input type="checkbox" id="addBA" checked={brandFormIsActive} onChange={e=>setBrandFormIsActive(e.target.checked)} className="w-4 h-4 accent-blue-600"/><label htmlFor="addBA" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">Active Brand</label></div>
          <div className="flex justify-end gap-2 mt-2"><EnterpriseButton type="button" onClick={()=>setIsAddBrandModalOpen(false)} variant="secondary">Cancel</EnterpriseButton><EnterpriseButton type="submit" variant="primary" disabled={createBrandMutation.isPending}>{createBrandMutation.isPending?'Saving...':'Add Brand'}</EnterpriseButton></div>
        </form>
      </EnterpriseModal>
      <EnterpriseModal isOpen={isEditBrandModalOpen} onClose={()=>setIsEditBrandModalOpen(false)} title="Edit Brand" maxWidth="sm">
        <form onSubmit={handleEditBrandSubmit} className="flex flex-col gap-4">
          <EnterpriseInput label="Brand Name" value={brandFormName} onChange={e=>setBrandFormName(e.target.value)} required/>
          <EnterpriseInput label="Brand Code (Optional)" value={brandFormCode} onChange={e=>setBrandFormCode(e.target.value)}/>
          <EnterpriseInput label="Description (Optional)" value={brandFormDescription} onChange={e=>setBrandFormDescription(e.target.value)}/>
          <div className="flex items-center gap-2"><input type="checkbox" id="editBA" checked={brandFormIsActive} onChange={e=>setBrandFormIsActive(e.target.checked)} className="w-4 h-4 accent-blue-600"/><label htmlFor="editBA" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">Active Brand</label></div>
          <div className="flex justify-end gap-2 mt-2"><EnterpriseButton type="button" onClick={()=>setIsEditBrandModalOpen(false)} variant="secondary">Cancel</EnterpriseButton><EnterpriseButton type="submit" variant="primary" disabled={updateBrandMutation.isPending}>{updateBrandMutation.isPending?'Saving...':'Save Changes'}</EnterpriseButton></div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

export default InventoryPage
