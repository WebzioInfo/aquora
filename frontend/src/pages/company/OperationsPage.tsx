import PageContainer from '../../components/ui/layout/PageContainer';
import PageHeader from '../../components/ui/layout/PageHeader';
import KPICard from '../../components/ui/layout/KPICard';
import FilterBar from '../../components/ui/layout/FilterBar';
import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { useNotificationStore } from '../../store/useNotificationStore'
import EnterpriseNumberInput from '../../components/ui/EnterpriseNumberInput'
import { Truck, Clock, Package, AlertCircle, RefreshCw, Box, Layers, LogIn, CheckCircle, Search, Edit2, Zap, Settings, HelpCircle, Plus, X, User, Phone, MapPin, CreditCard } from 'lucide-react'

export const OperationsPage: React.FC = () => {
  const { showToast } = useNotificationStore()

  // Master Data
  const [distributors, setDistributors] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [rawMaterials, setRawMaterials] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [queue, setQueue] = useState<any[]>([])

  // Dashboard Stats
  const [stats, setStats] = useState({
    returnedToday: 0,
    loadedToday: 0,
    pendingQueue: 0,
    damagedToday: 0,
    outstandingBalance: 0
  })

  // Form states - Section 1: Return Entry
  const [returnDistributor, setReturnDistributor] = useState('')
  const [returnVehicle, setReturnVehicle] = useState('')
  const [returnBrand, setReturnBrand] = useState('')
  const [returnQty, setReturnQty] = useState('')
  const [laterReq, setLaterReq] = useState('')
  const [damagedQty, setDamagedQty] = useState('')
  const [returnRemarks, setReturnRemarks] = useState('')
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false)

  // Quick Customer Creation Modal State
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false)
  const [quickCustLoading, setQuickCustLoading] = useState(false)
  const [quickCustForm, setQuickCustForm] = useState({
    customerName: '',
    phone: '',
    customerType: 'Distributor',
    assignedVehicle: '',
    assignedRoute: '',
    addressLine1: '',
    city: '',
    paymentTerms: 'COD'
  })

  // Form states - Section 2/3: Loading
  const [loadVisitId, setLoadVisitId] = useState<string | null>(null)
  const [loadDistributor, setLoadDistributor] = useState('')
  const [loadVehicle, setLoadVehicle] = useState('')
  const [loadBrand, setLoadBrand] = useState('')
  const [loadProduct, setLoadProduct] = useState('')
  const [loadQty, setLoadQty] = useState('')
  const [loadBatch, setLoadBatch] = useState('')
  const [loadCapMaterial, setLoadCapMaterial] = useState('')
  const [loadSealRequired, setLoadSealRequired] = useState(false)
  const [isSubmittingLoad, setIsSubmittingLoad] = useState(false)

  useEffect(() => {
    loadMasterData()
  }, [])

  const loadMasterData = async () => {
    try {
      const [resBrands, resProducts, resRaw, resBatches, resDist, resQueue, resDash] = await Promise.all([
        api.get('/api/v1/brands?pageSize=1000'),
        api.get('/api/v1/products?pageSize=1000'),
        api.get('/api/v1/rawmaterials?pageSize=1000'),
        api.get('/api/v1/production/batches/active'),
        api.get('/api/v1/customers?pageSize=1000'),
        api.get('/api/v1/operations/queue'),
        api.get('/api/v1/operations/dashboard')
      ])

      setBrands(resBrands.data?.data?.items || [])
      setProducts(resProducts.data?.data?.items || [])
      setRawMaterials(resRaw.data?.data?.items || [])
      setBatches(resBatches.data?.data || [])
      
      const allDist = resDist.data?.data?.items || []
      setDistributors(allDist)
      
      setQueue(resQueue.data?.data || [])
      
      const dash = resDash.data?.data || {}
      setStats({
        returnedToday: dash.returnedToday || 0,
        loadedToday: dash.loadedToday || 0,
        pendingQueue: dash.pendingQueue || 0,
        damagedToday: dash.damagedToday || 0,
        outstandingBalance: dash.outstandingBalance || 0
      })
    } catch (err: any) {
      showToast('Error loading master data.', 'error')
    }
  }

  const handleDistributorChange = (selectedId: string) => {
    setReturnDistributor(selectedId)
    if (!selectedId) {
      setReturnVehicle('')
      return
    }
    const selected = distributors.find(d => (d.id || d.customerId) === selectedId)
    if (selected && selected.assignedVehicle) {
      setReturnVehicle(selected.assignedVehicle.trim())
    } else {
      setReturnVehicle('')
    }
  }

  const handleQuickCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickCustForm.customerName.trim()) {
      showToast('Customer Name is required.', 'error')
      return
    }
    if (!quickCustForm.phone.trim()) {
      showToast('Phone number is required.', 'error')
      return
    }

    setQuickCustLoading(true)
    try {
      const res = await api.post('/api/v1/customers/quick', {
        customerName: quickCustForm.customerName.trim(),
        phone: quickCustForm.phone.trim(),
        customerType: quickCustForm.customerType || 'Distributor',
        assignedVehicle: quickCustForm.assignedVehicle.trim() || null,
        assignedRoute: quickCustForm.assignedRoute.trim() || null,
        addressLine1: quickCustForm.addressLine1.trim() || null,
        city: quickCustForm.city.trim() || null,
        paymentTerms: quickCustForm.paymentTerms || 'COD'
      })

      const newCustomer = res.data?.data
      showToast(`Customer "${newCustomer?.customerName || quickCustForm.customerName}" created successfully!`, 'success')
      
      // Refresh master data
      await loadMasterData()

      // Auto-select newly created customer
      const newId = newCustomer?.id || newCustomer?.customerId
      if (newId) {
        setReturnDistributor(newId)
        setReturnVehicle(newCustomer?.assignedVehicle || quickCustForm.assignedVehicle.trim() || '')
      }

      // Reset and close modal
      setQuickCustForm({
        customerName: '',
        phone: '',
        customerType: 'Distributor',
        assignedVehicle: '',
        assignedRoute: '',
        addressLine1: '',
        city: '',
        paymentTerms: 'COD'
      })
      setShowQuickCustomerModal(false)
    } catch (err: any) {
      console.error('Error creating customer:', err)
      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to create customer. Please check fields and try again.'
      showToast(errorMsg, 'error')
    } finally {
      setQuickCustLoading(false)
    }
  }

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingReturn(true)
    try {
      // 1. Record Arrival
      const arrivalRes = await api.post('/api/v1/operations/visit', {
        vehicleNumber: returnVehicle,
        driverName: 'Driver', // Default
        distributorId: returnDistributor,
        priority: 'Normal',
        arrivalTime: new Date().toISOString()
      })
      const visitId = arrivalRes.data?.data?.id
      if (!visitId) throw new Error('Failed to get Visit ID')

      // 2. Record Unloading
      const conditions = []
      if (Number(damagedQty) > 0) {
        conditions.push({ conditionType: 'Damaged', quantity: Number(damagedQty), responsibility: 'Distributor' })
      }

      await api.post(`/api/v1/operations/visit/${visitId}/unload`, {
        brandId: returnBrand,
        returnedEmptyCount: Number(returnQty),
        immediateRequirement: 0,
        laterRequirement: Number(laterReq || 0),
        scheduledRequirement: 0,
        conditions: conditions
      })

      showToast('Return entry recorded successfully.', 'success')
      loadMasterData() // Refresh queue & dashboard

      // Reset
      setReturnDistributor('')
      setReturnVehicle('')
      setReturnBrand('')
      setReturnQty('')
      setLaterReq('')
      setDamagedQty('')
      setReturnRemarks('')
    } catch (err: any) {
      console.error('Error recording return entry:', err)

      // Dynamically resolve customer name from selected distributor
      const selectedDist = distributors.find(d => (d.id || d.customerId) === returnDistributor)
      const distName = selectedDist?.customerName || selectedDist?.name

      const rawMsg = err?.response?.data?.message || err?.message || ''
      const rawCode = err?.response?.data?.code || err?.code || ''
      const msgLower = (typeof rawMsg === 'string' ? rawMsg : '').toLowerCase()

      const isInsufficientJars =
        msgLower.includes('insufficient outstanding jars') ||
        msgLower.includes('insufficient jars') ||
        msgLower.includes('no outstanding 20l jars') ||
        (rawCode === 'INVALID_OPERATION' && (msgLower.includes('jar') || msgLower.includes('balance') || msgLower.includes('outstanding'))) ||
        err?.userFriendly?.title === 'Return Not Recorded' ||
        err?.title === 'Return Not Recorded'

      if (isInsufficientJars) {
        const custMatch = typeof rawMsg === 'string' ? rawMsg.match(/customer ['"]([^'"]+)['"]/i) : null
        const customerName = distName || (custMatch ? custMatch[1].trim() : 'Customer')

        showToast(
          `${customerName} has no outstanding 20L jars to return. Please check the customer's jar balance and try again.`,
          'error',
          undefined,
          'Return Not Recorded'
        )
      } else {
        const title = err?.title || err?.userFriendly?.title || 'Return Not Recorded'
        const message = err?.userFriendly?.message || (typeof err?.message === 'string' && err.message !== 'An error occurred' ? err.message : 'Failed to record return. Please check the details and try again.')
        showToast(message, 'error', undefined, title)
      }
    } finally {
      setIsSubmittingReturn(false)
    }
  }

  const selectQueueItemForLoading = (item: any) => {
    setLoadVisitId(item.visitId)
    // Find distributor
    const dist = distributors.find(d => d.customerName === item.distributorName)
    if (dist) setLoadDistributor(dist.id || dist.customerId)
    
    setLoadVehicle(item.vehicleNumber || '')
    
    // Find brand
    const brand = brands.find(b => b.name === item.brandName)
    if (brand) setLoadBrand(brand.id)
    
    setLoadQty(item.remainingQuantity?.toString() || '')
  }

  const handleLoadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loadVisitId) {
      showToast('Please select an item from the Live Queue to load.', 'error')
      return
    }
    setIsSubmittingLoad(true)
    try {
      await api.post(`/api/v1/operations/visit/${loadVisitId}/load`, {
        productId: loadProduct,
        brandId: loadBrand,
        batchNumber: loadBatch,
        capMaterialId: loadCapMaterial || null,
        sealMaterialId: null,
        sealRequired: loadSealRequired,
        quantityLoaded: Number(loadQty),
        loadedBy: 'System User',
        remarks: ''
      })
      showToast('Loading entry recorded successfully.', 'success')
      loadMasterData()

      setLoadVisitId(null)
      setLoadDistributor('')
      setLoadVehicle('')
      setLoadBrand('')
      setLoadProduct('')
      setLoadQty('')
      setLoadBatch('')
      setLoadCapMaterial('')
      setLoadSealRequired(false)
    } catch (err: any) {
      console.error('Error recording loading:', err)
      const title = err?.title || err?.userFriendly?.title || 'Loading Not Recorded'
      const message = err?.userFriendly?.message || (typeof err?.message === 'string' && err.message !== 'An error occurred' ? err.message : 'Failed to record loading. Please check the loading parameters and try again.')
      showToast(message, 'error', undefined, title)
    } finally {
      setIsSubmittingLoad(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="20L Operations"
        description="Manage 20L empty returns, filling queue, and loading operations."
      />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          <div className="lg:col-span-3 space-y-6">
            
            {/* SECTION 1: Return Entry */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Return Entry & Arrival
              </h2>
              <form onSubmit={handleReturnSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-700">Distributor / Customer *</label>
                      <button
                        type="button"
                        onClick={() => setShowQuickCustomerModal(true)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Quick Add
                      </button>
                    </div>
                    <select
                      required
                      value={returnDistributor}
                      onChange={e => handleDistributorChange(e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Distributor / Customer --</option>
                      {distributors.map(d => (
                        <option key={d.id || d.customerId} value={d.id || d.customerId}>
                          {d.customerName || d.name} {d.assignedVehicle ? `(${d.assignedVehicle})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-700 mb-1">Vehicle Number *</label>
                    <input
                      required
                      type="text"
                      value={returnVehicle}
                      onChange={e => setReturnVehicle(e.target.value)}
                      placeholder="KL-XX-XXXX"
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-700 mb-1">Return Brand *</label>
                    <select
                      required
                      value={returnBrand}
                      onChange={e => setReturnBrand(e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Brand --</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <EnterpriseNumberInput
                      label="Returned Empty Qty *"
                      placeholder="0"
                      allowDecimals={false}
                      min={0}
                      value={returnQty}
                      onChange={e => setReturnQty(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col">
                    <EnterpriseNumberInput
                      label="Later Req."
                      placeholder="0"
                      allowDecimals={false}
                      min={0}
                      value={laterReq}
                      onChange={e => setLaterReq(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col">
                    <EnterpriseNumberInput
                      label="Damaged Qty"
                      placeholder="0"
                      allowDecimals={false}
                      min={0}
                      value={damagedQty}
                      onChange={e => setDamagedQty(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={isSubmittingReturn} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-6 rounded-md transition-colors disabled:opacity-50 cursor-pointer">
                    {isSubmittingReturn ? 'Saving...' : 'Confirm Arrival & Queue'}
                  </button>
                </div>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* SECTION 2: Live Queue */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col max-h-[600px]">
                <div className="p-4 border-b border-slate-100 shrink-0">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Live Filling Queue
                  </h2>
                </div>
                <div className="p-0 overflow-y-auto grow">
                  {queue.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">Queue is empty</div>
                  ) : (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 sticky top-0 text-slate-600 text-xs uppercase font-semibold">
                        <tr>
                          <th className="p-3 border-b">Vehicle / Dist.</th>
                          <th className="p-3 border-b">Req</th>
                          <th className="p-3 border-b">Pending</th>
                          <th className="p-3 border-b text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {queue.map(q => (
                          <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3">
                              <div className="font-semibold text-slate-900">{q.vehicleNumber || 'N/A'}</div>
                              <div className="text-xs text-slate-500 max-w-[120px] truncate" title={q.distributorName}>{q.distributorName}</div>
                            </td>
                            <td className="p-3 text-slate-600">{q.requestedQuantity}</td>
                            <td className="p-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                {q.remainingQuantity} {q.brandName}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button type="button" onClick={() => selectQueueItemForLoading(q)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded transition-colors">
                                Load
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* SECTION 3: Loading Form */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 md:p-6 max-h-[600px] overflow-y-auto">
                <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  Loading
                </h2>
                
                {!loadVisitId ? (
                  <div className="text-center py-8 text-sm text-slate-500 flex flex-col items-center">
                    <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                    Select an item from the Live Queue to begin loading
                  </div>
                ) : (
                  <form onSubmit={handleLoadSubmit} className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-md border border-slate-200 mb-4">
                      <div className="text-xs text-slate-500 mb-1">Loading for Visit ID</div>
                      <div className="text-sm font-mono text-slate-900 truncate">{loadVisitId}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-700 mb-1">Product *</label>
                        <select required value={loadProduct} onChange={e => setLoadProduct(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">-- Select Product --</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col">
                        <EnterpriseNumberInput
                          label="Load Qty *"
                          placeholder="0"
                          allowDecimals={false}
                          min={1}
                          value={loadQty}
                          onChange={e => setLoadQty(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-700 mb-1">Traceability Batch *</label>
                        <select required value={loadBatch} onChange={e => setLoadBatch(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">-- Select Batch --</option>
                          {batches.map(b => <option key={b.batchNumber} value={b.batchNumber}>{b.batchNumber}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-700 mb-1">Cap Material</label>
                        <select value={loadCapMaterial} onChange={e => setLoadCapMaterial(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">-- Optional --</option>
                          {rawMaterials.filter(r => r.name.toLowerCase().includes('cap') || r.category === 'CAP').map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <input type="checkbox" id="sealReq" checked={loadSealRequired} onChange={e => setLoadSealRequired(e.target.checked)} className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500" />
                      <label htmlFor="sealReq" className="text-sm font-semibold text-slate-700">Seal Applied</label>
                    </div>

                    <div className="flex justify-end pt-4">
                      <button type="button" onClick={() => setLoadVisitId(null)} className="mr-3 text-slate-500 hover:text-slate-700 text-sm font-semibold py-2 px-4">
                        Cancel
                      </button>
                      <button type="submit" disabled={isSubmittingLoad} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 px-6 rounded-md transition-colors disabled:opacity-50">
                        {isSubmittingLoad ? 'Saving...' : 'Confirm Load'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

            </div>
          </div>

          {/* SIDEBAR: Summary Dashboard */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sticky top-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                Shift Summary
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-md">
                  <span className="text-sm text-slate-600 font-semibold">Returned Today</span>
                  <span className="text-xl font-bold text-slate-900">{stats.returnedToday}</span>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-md">
                  <span className="text-sm text-slate-600 font-semibold">Loaded Today</span>
                  <span className="text-xl font-bold text-slate-900">{stats.loadedToday}</span>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-md">
                  <span className="text-sm text-slate-600 font-semibold">Pending Filling</span>
                  <span className="text-xl font-bold text-amber-600">{stats.pendingQueue}</span>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-rose-50 border border-rose-100 rounded-md">
                  <span className="text-sm text-rose-700 font-semibold">Damaged Today</span>
                  <span className="text-xl font-bold text-rose-700">{stats.damagedToday}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 text-center">Live operational stats for the current shift.</p>
              </div>
            </div>
          </div>

        </div>

        {/* QUICK CUSTOMER CREATION MODAL */}
        {showQuickCustomerModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Quick Add Customer</h3>
                    <p className="text-xs text-slate-500">Create and auto-assign a distributor / customer</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(false)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleQuickCustomerSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Royal Waters"
                      value={quickCustForm.customerName}
                      onChange={e => setQuickCustForm(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                    <input
                      required
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={quickCustForm.phone}
                      onChange={e => setQuickCustForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-700 mb-1">Customer Type</label>
                    <select
                      value={quickCustForm.customerType}
                      onChange={e => setQuickCustForm(prev => ({ ...prev, customerType: e.target.value }))}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="Distributor">Distributor</option>
                      <option value="B2B">B2B Commercial</option>
                      <option value="B2C">B2C Retail</option>
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-700 mb-1">Assigned Vehicle Number</label>
                    <input
                      type="text"
                      placeholder="e.g. KL-07-CD-1234"
                      value={quickCustForm.assignedVehicle}
                      onChange={e => setQuickCustForm(prev => ({ ...prev, assignedVehicle: e.target.value }))}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-700 mb-1">Assigned Route</label>
                    <input
                      type="text"
                      placeholder="e.g. Route 1 - North"
                      value={quickCustForm.assignedRoute}
                      onChange={e => setQuickCustForm(prev => ({ ...prev, assignedRoute: e.target.value }))}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
                    <select
                      value={quickCustForm.paymentTerms}
                      onChange={e => setQuickCustForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="COD">Cash on Delivery (COD)</option>
                      <option value="Credit">Credit Account</option>
                      <option value="Prepaid">Prepaid</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-700 mb-1">Address (Optional)</label>
                    <input
                      type="text"
                      placeholder="Street / Building"
                      value={quickCustForm.addressLine1}
                      onChange={e => setQuickCustForm(prev => ({ ...prev, addressLine1: e.target.value }))}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-700 mb-1">City (Optional)</label>
                    <input
                      type="text"
                      placeholder="City"
                      value={quickCustForm.city}
                      onChange={e => setQuickCustForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowQuickCustomerModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={quickCustLoading}
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {quickCustLoading ? 'Creating...' : 'Create & Select'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </PageContainer>
  )
}


export default OperationsPage
