import React from 'react'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import { AlertTriangle } from 'lucide-react'
import type { SimpleExpense } from '../../../../services/simpleAccounts'

interface ExpenseDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isSubmitting: boolean
  itemsToDelete: SimpleExpense[]
  progress?: { current: number; total: number } | null
}

export const ExpenseDeleteModal: React.FC<ExpenseDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  itemsToDelete,
  progress
}) => {
  if (!isOpen || itemsToDelete.length === 0) return null

  const isBulk = itemsToDelete.length > 1
  const totalAmount = itemsToDelete.reduce((sum, e) => sum + (e.amount || 0), 0)

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title={isBulk ? `Delete ${itemsToDelete.length} Expenses` : 'Delete Expense'}
      maxWidth="sm"
    >
      <div className="space-y-4 text-left">
        <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 space-y-1">
            <p className="font-bold">
              {isBulk
                ? `Are you sure you want to delete ${itemsToDelete.length} expenses totalling ₹${totalAmount.toLocaleString('en-IN')}?`
                : `Are you sure you want to delete expense ${itemsToDelete[0].expenseNumber || ''} (₹${itemsToDelete[0].amount.toLocaleString('en-IN')})?`}
            </p>
            <p className="text-rose-700">
              Bank and cash balances will be restored.
            </p>
          </div>
        </div>

        {/* Progress state during bulk delete */}
        {isSubmitting && progress && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs text-slate-600 font-medium">
              <span>Deleting expenses...</span>
              <span>{progress.current} of {progress.total}</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-600 transition-all duration-200"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <EnterpriseButton
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </EnterpriseButton>
          <EnterpriseButton
            variant="danger"
            onClick={onConfirm}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isBulk ? `Delete ${itemsToDelete.length} Expenses` : 'Delete Expense'}
          </EnterpriseButton>
        </div>
      </div>
    </EnterpriseModal>
  )
}
