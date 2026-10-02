import React, { useState, useEffect, useRef, useMemo } from 'react'
import { X, AlertCircle, AlertTriangle, Loader2, UserPlus, Edit2 } from 'lucide-react'
import type { Owner, CreateOwnerRequest, UpdateOwnerRequest } from '../../../../services/simpleAccounts'

interface OwnerFormModalProps {
  isOpen: boolean
  onClose: () => void
  ownerToEdit?: Owner | null
  existingOwners: Owner[]
  onCreate: (req: CreateOwnerRequest) => Promise<void>
  onUpdate: (id: string, req: UpdateOwnerRequest) => Promise<void>
}

export const OwnerFormModal: React.FC<OwnerFormModalProps> = ({
  isOpen,
  onClose,
  ownerToEdit = null,
  existingOwners,
  onCreate,
  onUpdate
}) => {
  const isEditing = Boolean(ownerToEdit)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [ownershipPercentage, setOwnershipPercentage] = useState<string>('0')
  const [initialInvestment, setInitialInvestment] = useState<string>('0')
  const [notes, setNotes] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Populate form if editing
  useEffect(() => {
    if (ownerToEdit) {
      setName(ownerToEdit.name || '')
      setPhone(ownerToEdit.phone || '')
      setEmail(ownerToEdit.email || '')
      setOwnershipPercentage(String(ownerToEdit.ownershipPercentage || 0))
      setInitialInvestment(String(ownerToEdit.initialInvestment || 0))
      setNotes(ownerToEdit.notes || '')
    } else {
      setName('')
      setPhone('')
      setEmail('')
      setOwnershipPercentage('0')
      setInitialInvestment('0')
      setNotes('')
    }
    setErrorBanner(null)
  }, [ownerToEdit, isOpen])

  // Focus trap / auto-focus
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Available percentage calculation:
  // 100 - sum(other owners' ownership %)
  const availablePercentage = useMemo(() => {
    const allocatedByOthers = existingOwners
      .filter(o => !ownerToEdit || o.id !== ownerToEdit.id)
      .reduce((acc, o) => acc + Number(o.ownershipPercentage || 0), 0)
    return Math.max(0, Math.round((100 - allocatedByOthers) * 100) / 100)
  }, [existingOwners, ownerToEdit])

  const enteredOwnership = parseFloat(ownershipPercentage) || 0
  const isExceeding100 = enteredOwnership > availablePercentage

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setErrorBanner('Owner name is required.')
      return
    }
    if (!phone.trim()) {
      setErrorBanner('Phone number is required.')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorBanner(null)

      if (isEditing && ownerToEdit) {
        await onUpdate(ownerToEdit.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          ownershipPercentage: enteredOwnership,
          notes: notes.trim() || undefined
        })
      } else {
        await onCreate({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          ownershipPercentage: enteredOwnership,
          initialInvestment: parseFloat(initialInvestment) || 0,
          notes: notes.trim() || undefined
        })
      }
      onClose()
    } catch (err: any) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to save owner.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-[480px] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/60">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {isEditing ? (
                <>
                  <Edit2 className="w-4 h-4 text-[#1A56DB]" />
                  <span>Edit Owner</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-[#1A56DB]" />
                  <span>Add New Owner</span>
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing
                ? 'Update owner profile and ownership equity share'
                : 'Register a new equity owner with initial investment'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorBanner && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Owner Name <span className="text-rose-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              placeholder="e.g. Sanoof Sinan"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#1A56DB] transition-colors"
            />
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="+91 98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#1A56DB] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                placeholder="owner@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#1A56DB] transition-colors"
              />
            </div>
          </div>

          {/* Ownership (%) & Initial Investment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Ownership (%)
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  {availablePercentage}% available
                </span>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0.00"
                value={ownershipPercentage}
                onChange={e => setOwnershipPercentage(e.target.value)}
                className="w-full h-[38px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1A56DB] transition-colors"
              />
            </div>

            {!isEditing && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Initial Investment (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={initialInvestment}
                    onChange={e => setInitialInvestment(e.target.value)}
                    className="w-full h-[38px] pl-7 pr-3 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1A56DB] transition-colors"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Warning if total would exceed 100% */}
          {isExceeding100 && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Allocating <strong>{enteredOwnership}%</strong> will bring the total company ownership to{' '}
                <strong>{Math.round((100 - availablePercentage + enteredOwnership) * 100) / 100}%</strong>, exceeding 100%.
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Roles, equity agreements, or special clauses..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#1A56DB]"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-[34px] px-3.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-[34px] px-4 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium rounded-lg text-xs shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isEditing ? 'Update Owner' : 'Save Owner'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default OwnerFormModal
