import React, { useState } from 'react'
import { AlertTriangle, Trash2, X, Loader2, Ban } from 'lucide-react'
import { productionBatchesService, type ProductionBatch } from '../../services/productionBatches'
import { showToast } from '../../utils/toast'

export interface DeleteBatchConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  batch: ProductionBatch | null
  onSuccess: () => void
}

export const DeleteBatchConfirmationModal: React.FC<DeleteBatchConfirmationModalProps> = ({
  isOpen,
  onClose,
  batch,
  onSuccess
}) => {
  const [isDeleting, setIsDeleting] = useState(false)

  if (!isOpen || !batch) return null

  const producedQty = Number(batch.producedQuantity || 0)
  const hasProducedOutput = producedQty > 0
  const isCompleted = (batch.status || '').toLowerCase() === 'completed' || !!batch.completedAt

  const handleDelete = async () => {
    if (hasProducedOutput) {
      showToast(
        `Cannot delete batch ${batch.batchNumber} because it already has ${producedQty.toLocaleString()} produced cases. Mark it as Completed or Stopped instead.`,
        'warning'
      )
      return
    }

    setIsDeleting(true)
    try {
      const res = await productionBatchesService.deleteBatch(batch.id)
      if (res.data?.success || res.status === 200) {
        showToast(`Production batch ${batch.batchNumber} deleted successfully.`, 'success')
        onSuccess()
        onClose()
      } else {
        showToast(res.data?.message || 'Failed to delete batch.', 'error')
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.errors?.[0] ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to delete batch.'
      showToast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={() => !isDeleting && onClose()}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
      />

      {/* Dialog container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-batch-title"
        className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-10 flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-6 pb-0 flex items-start justify-between">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            {hasProducedOutput ? (
              <Ban className="w-5 h-5 text-rose-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-3">
          <div>
            <h3 id="delete-batch-title" className="text-base font-bold text-slate-900">
              {hasProducedOutput ? 'Batch Cannot Be Deleted' : 'Delete Production Batch'}
            </h3>
            <p className="text-xs text-slate-500 font-normal mt-1 leading-relaxed">
              Batch identifier:{' '}
              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {batch.batchNumber}
              </span>
            </p>
          </div>

          {/* Details summary */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col gap-1.5 text-xs text-slate-600">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Product:</span>
              <span className="font-medium text-slate-900">{batch.product || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Production Line:</span>
              <span className="font-medium text-slate-900">{batch.productionLineName || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Output Logged:</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {producedQty.toLocaleString()} / {Number(batch.targetQuantity || 0).toLocaleString()} cases
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Status:</span>
              <span className="font-semibold text-slate-800">{batch.status || (isCompleted ? 'Completed' : 'Active')}</span>
            </div>
          </div>

          {hasProducedOutput ? (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed flex flex-col gap-1">
              <span className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Data Integrity Policy
              </span>
              <span>
                This batch has recorded production entries ({producedQty.toLocaleString()} cases). Manufacturing and
                inventory records cannot be erased once output is logged. You may mark this batch as Completed or Stopped.
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this batch? All unstarted session references will be removed.
              This action cannot be undone.
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {hasProducedOutput ? 'Close' : 'Cancel'}
          </button>

          {!hasProducedOutput && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-sm"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Batch</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default DeleteBatchConfirmationModal
