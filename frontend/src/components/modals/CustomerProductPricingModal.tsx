import React, { useState, useEffect } from 'react'
import { X, Tag, Plus, Trash2, Check, AlertCircle, Calendar } from 'lucide-react'
import { customerService } from '../../services/customers'
import type { CustomerProductPriceDto, SaveCustomerProductPriceRequest } from '../../services/customers'
import { productsService } from '../../services/products'
import type { Product } from '../../services/products'

export interface CustomerProductPricingModalProps {
  isOpen: boolean
  onClose: () => void
  customerId: string
  customerName: string
  customerCode?: string
  customerType?: string
  products?: Array<{ id: string; name: string; sku?: string; category?: string; baseSellingPrice?: number }>
  onSaved?: () => void
}

export const CustomerProductPricingModal: React.FC<CustomerProductPricingModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  customerCode,
  onSaved
}) => {
  const [prices, setPrices] = useState<CustomerProductPriceDto[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [discountPercentage, setDiscountPercentage] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().split('T')[0])
  const [effectiveTo, setEffectiveTo] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (isOpen && customerId) {
      loadData()
    }
  }, [isOpen, customerId])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [pricesRes, prodsRes] = await Promise.all([
        customerService.getProductPrices(customerId),
        productsService.getProducts(1, 100, '')
      ])
      setPrices(pricesRes.data || [])
      const prodsList = prodsRes.data?.items || []
      setProducts(prodsList.filter(p => p.isActive))
      if (prodsList.length > 0 && !selectedProductId) {
        setSelectedProductId(prodsList[0].id)
        if (prodsList[0].sellingPrice) {
          setCustomPrice(prodsList[0].sellingPrice.toString())
        }
      }
    } catch (err: any) {
      setError('Failed to load custom product prices.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId)
    const existing = prices.find(p => p.productId === prodId)
    if (existing) {
      setCustomPrice(existing.customPrice.toString())
      setDiscountPercentage(existing.discountPercentage?.toString() || '')
      setEffectiveFrom(existing.effectiveFrom ? existing.effectiveFrom.split('T')[0] : new Date().toISOString().split('T')[0])
      setEffectiveTo(existing.effectiveTo ? existing.effectiveTo.split('T')[0] : '')
      setNotes(existing.notes || '')
    } else {
      const prod = products.find(p => p.id === prodId)
      if (prod && prod.sellingPrice) {
        setCustomPrice(prod.sellingPrice.toString())
      } else {
        setCustomPrice('')
      }
      setDiscountPercentage('')
      setNotes('')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId) {
      setError('Please select a product.')
      return
    }
    const priceNum = parseFloat(customPrice)
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Please enter a valid price.')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const payload: SaveCustomerProductPriceRequest = {
        productId: selectedProductId,
        customPrice: priceNum,
        discountPercentage: discountPercentage ? parseFloat(discountPercentage) : 0,
        effectiveFrom: effectiveFrom,
        effectiveTo: effectiveTo || null,
        notes: notes.trim() || null,
        isActive: true
      }

      await customerService.saveProductPrice(customerId, payload)
      setSuccessMsg('Product-wise price saved successfully.')
      await loadData()
      onSaved?.()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save product price.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (priceId: string) => {
    if (!confirm('Remove this custom product price rule? Billing will fall back to standard catalog price.')) return
    try {
      await customerService.deleteProductPrice(customerId, priceId)
      await loadData()
      onSaved?.()
    } catch {
      setError('Failed to remove price rule.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Product-Wise Pricing Rules
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Customer: <span className="font-bold text-slate-700">{customerName}</span> {customerCode && `(${customerCode})`}
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

          {/* Add / Edit Form */}
          <form onSubmit={handleSave} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3.5">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>Configure Negotiated Price</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Select Product *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-blue-600 cursor-pointer"
                  required
                >
                  <option value="">-- Choose Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(SKU: ${p.sku})` : ''} — Standard: ₹{p.sellingPrice}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Custom Unit / Case Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 text-blue-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Discount (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Effective From
                </label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600"
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
                  className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Pricing Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Special distributor volume discount contract"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Set Custom Price'}
              </button>
            </div>
          </form>

          {/* Existing Rules List */}
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Configured Product Prices ({prices.length})</span>
            </div>

            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-500">Loading custom pricing rules...</div>
            ) : prices.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                No custom pricing configured. Standard catalog prices and 20L rate cards apply.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {prices.map((p) => (
                  <div key={p.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{p.productName || 'Product'}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-emerald-700">₹{p.customPrice.toFixed(2)}</span>
                        {p.discountPercentage ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                            {p.discountPercentage}% OFF
                          </span>
                        ) : null}
                        {p.effectiveFrom && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            From {p.effectiveFrom.split('T')[0]}
                            {p.effectiveTo ? ` to ${p.effectiveTo.split('T')[0]}` : ''}
                          </span>
                        )}
                      </div>
                      {p.notes && <div className="text-[11px] text-slate-400 italic mt-0.5">{p.notes}</div>}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete price override"
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
