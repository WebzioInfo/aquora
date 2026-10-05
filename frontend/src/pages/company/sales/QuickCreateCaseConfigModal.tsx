import React, { useState, useEffect, useRef } from 'react'
import { X, Loader2, AlertCircle, Package } from 'lucide-react'
import { caseConfigurationsService, type CaseConfiguration } from '../../../services/caseConfigurations'
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'

interface QuickCreateCaseConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newConfig: CaseConfiguration) => void
  productId?: string
  productName?: string
  products?: Array<{ id: string; name: string; sku?: string | null }>
  existingConfigs?: CaseConfiguration[]
}

export const QuickCreateCaseConfigModal: React.FC<QuickCreateCaseConfigModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  productId: initialProductId = '',
  productName: initialProductName = '',
  products = [],
  existingConfigs = []
}) => {
  const { showToast } = useNotificationStore()
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [selectedProductId, setSelectedProductId] = useState(initialProductId)
  const [name, setName] = useState('')
  const [bottlesPerCase, setBottlesPerCase] = useState<string>('24')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset and auto-focus on open
  useEffect(() => {
    if (isOpen) {
      setSelectedProductId(initialProductId)
      setName(initialProductName ? `Standard 24 Bottle Case` : '')
      setBottlesPerCase('24')
      setDescription('')
      setIsActive(true)
      setError(null)
      setIsSubmitting(false)

      const timer = setTimeout(() => {
        nameInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen, initialProductId, initialProductName])

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

  const effectiveProductId = selectedProductId || initialProductId
  const displayProductName =
    initialProductName ||
    products.find(p => p.id === effectiveProductId)?.name ||
    'Selected Product'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!effectiveProductId) {
      setError('Please select a finished product.')
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Configuration Name is required.')
      nameInputRef.current?.focus()
      return
    }

    const units = parseInt(bottlesPerCase, 10)
    if (isNaN(units) || units <= 0) {
      setError('Bottles Per Case must be a positive number greater than 0.')
      return
    }

    // Client-side duplicate check
    const normalizedName = trimmedName.toLowerCase()
    const duplicate = existingConfigs.some(
      c =>
        c.productId === effectiveProductId &&
        c.isActive &&
        (c.name?.trim().toLowerCase() === normalizedName || c.unitsPerCase === units)
    )

    if (duplicate) {
      setError('An identical case configuration already exists.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await caseConfigurationsService.create({
        productId: effectiveProductId,
        name: trimmedName,
        unitsPerCase: units,
        description: description.trim() || undefined,
        isActive
      })

      if (res.data) {
        showToast(`Configuration created successfully: "${res.data.name || trimmedName}"`, 'success')
        onSuccess(res.data)
        onClose()
      } else {
        throw new Error(res.message || 'Failed to create configuration.')
      }
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.[0] ||
        err?.message ||
        'Failed to create case configuration. Please try again.'
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
        className="relative w-full max-w-md bg-white border border-slate-200 rounded-[14px] shadow-2xl p-5 sm:p-6 animate-in zoom-in-95 duration-150 text-left"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                Create Case Configuration
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Define packaging specification for finished goods
              </p>
            </div>
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
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Product display or select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Finished Product <span className="text-rose-500">*</span>
            </label>
            {initialProductId ? (
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="font-bold text-slate-800 truncate">{displayProductName}</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-200">
                  Preselected
                </span>
              </div>
            ) : (
              <select
                value={selectedProductId}
                onChange={e => {
                  setSelectedProductId(e.target.value)
                  if (error) setError(null)
                }}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100/50 bg-white"
                required
              >
                <option value="">Select Finished Product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(SKU: ${p.sku})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Configuration Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Configuration Name <span className="text-rose-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              placeholder="e.g. Standard 24 Bottle Case"
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100/50 bg-white"
            />
          </div>

          {/* Bottles Per Case */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Bottles Per Case <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="100000"
              required
              placeholder="e.g. 24"
              value={bottlesPerCase}
              onChange={e => {
                setBottlesPerCase(e.target.value)
                if (error) setError(null)
              }}
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100/50 bg-white font-mono font-semibold"
            />
          </div>

          {/* Optional Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Shrink film wrap with corrugated tray"
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
                Available for sales dispatch & order booking
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
              disabled={isSubmitting || !name.trim() || !bottlesPerCase || parseInt(bottlesPerCase, 10) <= 0}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </span>
              ) : (
                'Create Configuration'
              )}
            </EnterpriseButton>
          </div>
        </form>
      </div>
    </div>
  )
}
