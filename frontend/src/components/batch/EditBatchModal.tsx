import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Loader2 } from 'lucide-react'
import { productionBatchesService, type ProductionBatch } from '../../services/productionBatches'
import { showToast } from '../../utils/toast'

export interface EditBatchModalProps {
  isOpen: boolean
  onClose: () => void
  batch: ProductionBatch | null
  productionLines: any[]
  catalogProducts: any[]
  onSuccess: () => void
}

export const EditBatchModal: React.FC<EditBatchModalProps> = ({
  isOpen,
  onClose,
  batch,
  productionLines = [],
  catalogProducts = [],
  onSuccess
}) => {
  const [batchNumber, setBatchNumber] = useState('')
  const [product, setProduct] = useState('')
  const [productionLineId, setProductionLineId] = useState('')
  const [shift, setShift] = useState('')
  const [targetQuantity, setTargetQuantity] = useState<number | string>('')
  const [operatorName, setOperatorName] = useState('')
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (batch) {
      setBatchNumber(batch.batchNumber || '')
      setProduct(batch.product || '')
      setProductionLineId(batch.productionLineId || '')
      setShift(batch.shift || 'Morning')
      setTargetQuantity(batch.targetQuantity || '')
      setOperatorName(batch.operatorName || '')
      setStatus(batch.status || (batch.completedAt ? 'Completed' : 'Active'))
      setFieldErrors({})
    }
  }, [batch, isOpen])

  if (!isOpen || !batch) return null

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!batchNumber.trim()) {
      errors.batchNumber = 'Batch number is required.'
    }
    if (!product.trim()) {
      errors.product = 'Product selection is required.'
    }
    if (!productionLineId) {
      errors.productionLineId = 'Production line is required.'
    }
    const targetNum = Number(targetQuantity)
    if (!targetQuantity || isNaN(targetNum) || targetNum <= 0) {
      errors.targetQuantity = 'Target quantity must be greater than zero.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const payload = {
        batchNumber: batchNumber.trim(),
        product: product.trim(),
        productionLineId,
        shift: shift.trim(),
        targetQuantity: Number(targetQuantity),
        operatorName: operatorName.trim() || undefined,
        status: status.trim()
      }

      const res = await productionBatchesService.updateBatch(batch.id, payload)
      if (res.data?.success || res.status === 200) {
        showToast('Production batch updated successfully.', 'success')
        onSuccess()
        onClose()
      } else {
        const errorMsg = res.data?.message || 'Failed to update batch.'
        showToast(errorMsg, 'error')
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.errors?.[0] ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to update batch.'
      showToast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={() => !isSubmitting && onClose()}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
      />

      {/* Dialog container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-batch-title"
        className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-10 flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 id="edit-batch-title" className="text-base font-bold text-slate-900 leading-tight">
              Edit Production Batch
            </h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Update batch details, target quotas, and operational parameters for{' '}
              <span className="font-mono font-semibold text-slate-800">{batch.batchNumber}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {/* Read-only output callout */}
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-blue-900 font-medium">Actual Produced Output:</span>
              <span className="font-mono font-bold text-blue-900">
                {Number(batch.producedQuantity || 0).toLocaleString()} cases
              </span>
            </div>
            <span className="text-[11px] text-blue-700 italic">
              Historical production output is recorded via process entries
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Batch Number */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Batch Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => {
                  setBatchNumber(e.target.value)
                  if (fieldErrors.batchNumber) setFieldErrors((prev) => ({ ...prev, batchNumber: '' }))
                }}
                placeholder="e.g. B-20261017-001"
                className={`h-9.5 px-3 rounded-lg border text-xs font-mono bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  fieldErrors.batchNumber ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                }`}
              />
              {fieldErrors.batchNumber && (
                <span className="text-[11px] text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.batchNumber}
                </span>
              )}
            </div>

            {/* Product */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Product SKU <span className="text-rose-500">*</span>
              </label>
              <select
                value={product}
                onChange={(e) => {
                  setProduct(e.target.value)
                  if (fieldErrors.product) setFieldErrors((prev) => ({ ...prev, product: '' }))
                }}
                className={`h-9.5 px-3 rounded-lg border text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer ${
                  fieldErrors.product ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                }`}
              >
                <option value="">Select a product...</option>
                {catalogProducts.map((p: any) => (
                  <option key={p.id || p.name} value={p.name}>
                    {p.name} {p.sku ? `(${p.sku})` : ''}
                  </option>
                ))}
                {/* Fallback option if current product is not in catalog */}
                {product && !catalogProducts.some((p: any) => p.name === product) && (
                  <option value={product}>{product} (Current)</option>
                )}
              </select>
              {fieldErrors.product && (
                <span className="text-[11px] text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.product}
                </span>
              )}
            </div>

            {/* Production Line */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Production Line <span className="text-rose-500">*</span>
              </label>
              <select
                value={productionLineId}
                onChange={(e) => {
                  setProductionLineId(e.target.value)
                  if (fieldErrors.productionLineId) setFieldErrors((prev) => ({ ...prev, productionLineId: '' }))
                }}
                className={`h-9.5 px-3 rounded-lg border text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer ${
                  fieldErrors.productionLineId ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                }`}
              >
                <option value="">Select a production line...</option>
                {productionLines.map((line: any) => (
                  <option key={line.lineId || line.id} value={line.lineId || line.id}>
                    {line.name} {line.code ? `(${line.code})` : ''}
                  </option>
                ))}
              </select>
              {fieldErrors.productionLineId && (
                <span className="text-[11px] text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.productionLineId}
                </span>
              )}
            </div>

            {/* Target Quantity */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Target Quantity (Cases) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={targetQuantity}
                onChange={(e) => {
                  setTargetQuantity(e.target.value)
                  if (fieldErrors.targetQuantity) setFieldErrors((prev) => ({ ...prev, targetQuantity: '' }))
                }}
                placeholder="e.g. 1000"
                className={`h-9.5 px-3 rounded-lg border text-xs font-mono bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  fieldErrors.targetQuantity ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                }`}
              />
              {fieldErrors.targetQuantity && (
                <span className="text-[11px] text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.targetQuantity}
                </span>
              )}
            </div>

            {/* Shift */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">Operational Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="h-9.5 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="Morning">Morning Shift</option>
                <option value="Evening">Evening Shift</option>
                <option value="Night">Night Shift</option>
                <option value="General">General Shift</option>
              </select>
            </div>

            {/* Assigned Operator */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">Assigned Operator</label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="Operator Full Name"
                className="h-9.5 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Status Transition */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Batch Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9.5 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="Active">Running / Active</option>
                <option value="Paused">Paused</option>
                <option value="Completed">Completed</option>
                <option value="Stopped">Stopped</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <span className="text-[11px] text-slate-400">
                Changing status to Completed will mark this batch as finalized. Active batches require an available line.
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-4.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditBatchModal
