import React, { useState, useEffect } from 'react'
import { X, Award, Plus, Trash2, Check, AlertCircle, Percent, DollarSign } from 'lucide-react'
import { twentyLService } from '../../services/twentyL'
import type { CommissionRule } from '../../services/twentyL'
import { productsService } from '../../services/products'
import type { Product } from '../../services/products'
import { customerService } from '../../services/customers'
import type { Customer } from '../../services/customers'

export interface DistributorCommissionModalProps {
  isOpen: boolean
  onClose: () => void
  distributorId?: string
  distributorName?: string
}

export const DistributorCommissionModal: React.FC<DistributorCommissionModalProps> = ({
  isOpen,
  onClose,
  distributorId,
  distributorName
}) => {
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [distributors, setDistributors] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Form State
  const [targetDistributorId, setTargetDistributorId] = useState(distributorId || '')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [calculationType, setCalculationType] = useState<'PERCENTAGE' | 'FIXED_PER_UNIT'>('PERCENTAGE')
  const [commissionValue, setCommissionValue] = useState('')
  const [minimumQuantity, setMinimumQuantity] = useState('0')
  const [priority, setPriority] = useState('10')
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().split('T')[0])
  const [effectiveTo, setEffectiveTo] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (distributorId) setTargetDistributorId(distributorId)
      loadData()
    }
  }, [isOpen, distributorId])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [rulesData, prodsRes, distsRes] = await Promise.all([
        twentyLService.getCommissionRules(),
        productsService.getProducts(1, 100, ''),
        customerService.getCustomers(1, 100, '', 'Distributor')
      ])
      setRules(rulesData || [])
      setProducts((prodsRes.data?.items || []).filter(p => p.isActive))
      setDistributors(distsRes.data?.items || [])
    } catch {
      setError('Failed to load commission rules.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(commissionValue)
    if (isNaN(val) || val < 0) {
      setError('Please enter a valid commission rate.')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await twentyLService.createCommissionRule({
        beneficiaryCustomerId: targetDistributorId || undefined,
        productId: selectedProductId || undefined,
        beneficiaryType: 'DISTRIBUTOR',
        calculationType,
        value: val,
        minimumQuantity: parseFloat(minimumQuantity) || 0,
        priority: parseInt(priority) || 10,
        effectiveFrom,
        effectiveTo: effectiveTo || null
      })

      setSuccessMsg('Product-wise distributor commission rule created.')
      setCommissionValue('')
      await loadData()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save commission rule.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this commission rule?')) return
    try {
      await twentyLService.deleteCommissionRule(id)
      await loadData()
    } catch {
      setError('Failed to delete commission rule.')
    }
  }

  if (!isOpen) return null

  const filteredRules = distributorId
    ? rules.filter(r => !r.beneficiaryCustomerId || r.beneficiaryCustomerId === distributorId)
    : rules

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shadow-2xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Product-Wise Distributor Commission
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {distributorName ? `For Distributor: ${distributorName}` : 'Product-specific margins & commission rates'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="font-medium">{successMsg}</div>
            </div>
          )}

          {/* Create Rule Form */}
          <form onSubmit={handleSave} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3.5">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-purple-600" />
              <span>Configure Commission Rule</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Distributor
                </label>
                <select
                  value={targetDistributorId}
                  onChange={(e) => setTargetDistributorId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-purple-600 cursor-pointer"
                >
                  <option value="">All Distributors (Global Rule)</option>
                  {distributors.map(d => (
                    <option key={d.id} value={d.id}>{d.customerName} ({d.customerCode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Applicable Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-purple-600 cursor-pointer"
                >
                  <option value="">All Eligible Products</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Calculation Model
                </label>
                <select
                  value={calculationType}
                  onChange={(e) => setCalculationType(e.target.value as any)}
                  className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-purple-600 cursor-pointer"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_PER_UNIT">Fixed / Unit (₹/Jar)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  {calculationType === 'PERCENTAGE' ? 'Commission Rate (%) *' : 'Commission (₹ / Jar) *'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 10.00"
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(e.target.value)}
                    className="w-full h-9 pl-8 pr-3 text-xs font-bold bg-white border border-slate-200 rounded-lg text-purple-700 focus:outline-none focus:border-purple-600"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    {calculationType === 'PERCENTAGE' ? <Percent className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Min. Volume / Qty
                </label>
                <input
                  type="number"
                  min="0"
                  value={minimumQuantity}
                  onChange={(e) => setMinimumQuantity(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Effective From
                </label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Effective To (Optional)
                </label>
                <input
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Add Commission Rule'}
              </button>
            </div>
          </form>

          {/* Existing Rules List */}
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Active Commission Rules ({filteredRules.length})
            </div>

            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-500">Loading commission rules...</div>
            ) : filteredRules.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                No commission rules configured.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {filteredRules.map((r) => (
                  <div key={r.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                    <div>
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <span>{r.productName || 'All Eligible Products'}</span>
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/60 rounded text-[10px] font-extrabold">
                          {r.calculationType === 'PERCENTAGE' ? `${r.value}% of Sales` : `₹${r.value} / Jar`}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                        <span>Beneficiary: <strong className="text-slate-700">{r.beneficiaryName || 'All Distributors'}</strong></span>
                        {r.minimumQuantity > 0 && <span>Min: {r.minimumQuantity} Jars</span>}
                        <span>From {r.effectiveFrom ? r.effectiveFrom.split('T')[0] : 'Always'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete commission rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
