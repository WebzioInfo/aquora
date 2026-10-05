import React, { useState, useEffect, useRef } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { assetService, type AssetCategoryDto } from '../../../../services/assets'
import { useNotificationStore } from '../../../../store/useNotificationStore'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'

interface QuickCreateAssetCategoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newCategory: AssetCategoryDto) => void
  existingCategories?: AssetCategoryDto[]
}

export const QuickCreateAssetCategoryModal: React.FC<QuickCreateAssetCategoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingCategories = []
}) => {
  const { showToast } = useNotificationStore()
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset and auto-focus on open
  useEffect(() => {
    if (isOpen) {
      setName('')
      setDescription('')
      setIsActive(true)
      setError(null)
      setIsSubmitting(false)

      const timer = setTimeout(() => {
        nameInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Category name is required.')
      nameInputRef.current?.focus()
      return
    }

    // Client-side duplicate check
    const normalizedName = trimmedName.toLowerCase()
    const duplicate = existingCategories.some(
      c => c.name.trim().toLowerCase() === normalizedName || c.code.trim().toLowerCase() === normalizedName
    )
    if (duplicate) {
      setError(`An asset category with the name "${trimmedName}" already exists.`)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const created = await assetService.createAssetCategory({
        name: trimmedName,
        description: description.trim() || undefined,
        isActive
      })

      showToast(`Category "${created.name}" created successfully`, 'success')
      onSuccess(created)
      onClose()
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.[0] ||
        err?.message ||
        'Failed to create asset category. Please try again.'
      setError(serverMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="relative w-full max-w-sm bg-white border border-slate-200 rounded-[14px] shadow-2xl p-5 sm:p-6 animate-in zoom-in-95 duration-150 text-left"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-800 tracking-tight">
              Create Asset Category
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Add a custom capital asset classification
            </p>
          </div>
          <button
            type="button"
            onClick={() => !isSubmitting && onClose()}
            className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            disabled={isSubmitting}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-2.5 mb-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              placeholder="e.g. Solar Equipment, Laboratory Instruments"
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100/50 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Brief description or usage note"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100/50 bg-white"
            />
          </div>

          {/* Active status toggle */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Active
              </span>
              <span className="block text-[11px] text-slate-500">
                Available for asset registration
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(!isActive)}
              disabled={isSubmitting}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isActive ? 'bg-[#1A56DB]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <EnterpriseButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </EnterpriseButton>
            <EnterpriseButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </span>
              ) : (
                'Create Category'
              )}
            </EnterpriseButton>
          </div>
        </form>
      </div>
    </div>
  )
}
