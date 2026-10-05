import React, { useState, useMemo, type Dispatch, type SetStateAction } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { assetService, type CreateAssetInput, type AssetCategoryDto } from '../../../../services/assets'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import { Info, Sparkles, AlertCircle, Plus, Loader2 } from 'lucide-react'
import { QuickCreateAssetCategoryModal } from './QuickCreateAssetCategoryModal'

const DEFAULT_CATEGORIES: { code: string; name: string }[] = [
  { code: 'Machinery', name: 'Machinery & Equipment' },
  { code: 'Vehicles', name: 'Vehicles & Transport' },
  { code: 'Computers', name: 'Computers & Laptops' },
  { code: 'Printers', name: 'Printers & Scanners' },
  { code: 'Furniture', name: 'Furniture & Fixtures' },
  { code: 'Office Equipment', name: 'Office Equipment' },
  { code: 'Buildings', name: 'Buildings & Infrastructure' },
  { code: 'Other', name: 'Other Capital Assets' }
]

interface Props {
  editing: boolean
  pending: boolean
  isDateLocked?: boolean
  lockedReason?: string
  createForm: CreateAssetInput
  setCreateForm: Dispatch<SetStateAction<CreateAssetInput>>
  onSave: (form: CreateAssetInput) => void
  onClose: () => void
}

export const AssetFormModal: React.FC<Props> = ({
  editing,
  pending,
  isDateLocked = false,
  lockedReason,
  createForm,
  setCreateForm,
  onSave,
  onClose
}) => {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

  const calculatedCapitalizedCost =
    (Number(createForm.purchasePrice) || 0) +
    (Number(createForm.taxAmount) || 0) +
    (Number(createForm.freightCost) || 0) +
    (Number(createForm.installationCost) || 0) +
    (Number(createForm.otherCapitalizedCost) || 0)

  const queryClient = useQueryClient()
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)

  const { data: dbCategories = [], isLoading: isLoadingCategories } = useQuery<AssetCategoryDto[]>({
    queryKey: ['assetCategories'],
    queryFn: () => assetService.getAssetCategories(false)
  })

  const categoryOptions = useMemo(() => {
    const list: { code: string; name: string; isActive?: boolean }[] =
      dbCategories.length > 0
        ? dbCategories.map(c => ({ code: c.code, name: c.name, isActive: c.isActive }))
        : [...DEFAULT_CATEGORIES]

    // If currently selected category is not in list (e.g. historical/inactive), include it safely
    if (
      createForm.assetCategory &&
      !list.some(
        c =>
          c.code.toLowerCase() === createForm.assetCategory.toLowerCase() ||
          c.name.toLowerCase() === createForm.assetCategory.toLowerCase()
      )
    ) {
      list.push({ code: createForm.assetCategory, name: createForm.assetCategory })
    }
    return list
  }, [dbCategories, createForm.assetCategory])

  const selectedCategoryValue = useMemo(() => {
    if (!createForm.assetCategory) return ''
    const match = categoryOptions.find(
      c =>
        c.code.toLowerCase() === createForm.assetCategory.toLowerCase() ||
        c.name.toLowerCase() === createForm.assetCategory.toLowerCase()
    )
    return match ? match.code : createForm.assetCategory
  }, [categoryOptions, createForm.assetCategory])

  const handleCategoryCreated = (newCategory: AssetCategoryDto) => {
    queryClient.invalidateQueries({ queryKey: ['assetCategories'] })
    // Automatically select newly created category code while preserving ALL other form fields
    setCreateForm(prev => ({ ...prev, assetCategory: newCategory.code }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pending) {
      onSave(createForm)
    }
  }

  return (
    <>
      <EnterpriseModal
      isOpen
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-extrabold text-slate-900">
            {editing ? 'Edit Fixed Asset' : 'Register New Fixed Capital Asset'}
          </span>
          {editing ? (
            <span className="text-xs font-medium text-slate-500">
              {createForm.assetName || 'Asset'} {createForm.assetTag ? `· ${createForm.assetTag}` : ''}
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-500">
              Enter asset identification, purchase capitalization, and physical assignment details.
            </span>
          )}
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <EnterpriseButton
            type="button"
            disabled={pending}
            onClick={onClose}
            variant="secondary"
            size="sm"
          >
            Cancel
          </EnterpriseButton>
          <EnterpriseButton
            type="submit"
            form="asset-form"
            loading={pending}
            loadingText={editing ? 'Saving...' : 'Registering...'}
            variant="primary"
            size="sm"
          >
            {editing ? 'Save Changes' : 'Register Asset'}
          </EnterpriseButton>
        </div>
      }
    >
      <form id="asset-form" onSubmit={handleSubmit} className="space-y-5 text-xs text-slate-700 select-none">
        {/* SECTION 1: BASIC INFORMATION */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] text-[#1A56DB]">
              Basic Identification
            </h4>
            <span className="text-[10px] text-slate-400 font-medium">Fields with * are required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Asset Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. RO High-Pressure Pump Unit"
                value={createForm.assetName}
                onChange={(e) => setCreateForm({ ...createForm, assetName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB] transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 block">
                  Asset Category <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickCreateOpen(true)}
                  className="text-xs font-semibold text-[#1A56DB] hover:text-blue-700 active:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer focus:outline-none focus-visible:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Category</span>
                </button>
              </div>
              <div className="relative">
                <select
                  value={selectedCategoryValue}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, assetCategory: e.target.value }))}
                  disabled={isLoadingCategories && dbCategories.length === 0}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:border-[#1A56DB] transition-all disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {isLoadingCategories && dbCategories.length === 0 && (
                  <div className="absolute right-8 top-2.5 pointer-events-none">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Asset Tag <span className="text-slate-400 font-normal">(Optional unique code)</span>
              </label>
              <input
                type="text"
                placeholder="Auto-generated if blank (e.g. MCH-001)"
                value={createForm.assetTag || ''}
                onChange={(e) => setCreateForm({ ...createForm, assetTag: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB] transition-all"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Serial Number
              </label>
              <input
                type="text"
                placeholder="e.g. SN-9842104"
                value={createForm.serialNumber || ''}
                onChange={(e) => setCreateForm({ ...createForm, serialNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB] transition-all"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Model Number</label>
              <input
                type="text"
                placeholder="e.g. HydroFlow-5000"
                value={createForm.modelNumber || ''}
                onChange={(e) => setCreateForm({ ...createForm, modelNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB] transition-all"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Manufacturer</label>
              <input
                type="text"
                placeholder="e.g. Grundfos / Kirloskar"
                value={createForm.manufacturer || ''}
                onChange={(e) => setCreateForm({ ...createForm, manufacturer: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB] transition-all"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: FINANCIAL & CAPITALIZATION */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3.5">
          <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] text-[#1A56DB]">
            Financial & Capitalization
          </h4>

          {editing ? (
            <div className="space-y-3.5">
              <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-lg text-blue-900 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-[#1A56DB] shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Historical Accounting Integrity:</strong> Original acquisition cost,
                  tax capitalization, and initial depreciation rules are immutable audit records and cannot be overwritten
                  here. To record book value reductions, use the <em>Record Depreciation</em> action.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Purchase / Acquisition Date */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                    <span>
                      Purchase / Acquisition Date <span className="text-rose-500">*</span>
                    </span>
                    {isDateLocked && (
                      <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Immutable Accounting Record
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    required
                    disabled={isDateLocked}
                    value={createForm.purchaseDate?.slice(0, 10) || ''}
                    onChange={(e) => setCreateForm({ ...createForm, purchaseDate: e.target.value })}
                    className={`w-full px-3 py-2 text-xs border rounded-lg transition-all ${
                      isDateLocked
                        ? 'bg-slate-100/90 text-slate-500 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-800 border-slate-200 focus:outline-none focus:border-[#1A56DB]'
                    }`}
                  />
                  {isDateLocked && (
                    <p className="text-[10px] text-amber-800 mt-1 leading-normal">
                      {lockedReason || 'Original acquisition date is part of the asset’s accounting history and cannot be changed here.'}
                    </p>
                  )}
                </div>

                {/* Capitalized Cost Read-Only Card */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Capitalized Cost <span className="text-slate-400 font-normal">(Recorded Base)</span>
                  </label>
                  <div className="px-3 py-2 text-xs font-mono font-bold text-slate-800 bg-slate-100/80 border border-slate-200 rounded-lg">
                    {formatCurrency(calculatedCapitalizedCost || createForm.purchasePrice || 0)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <fieldset disabled={editing} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Purchase / Acquisition Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.purchaseDate?.slice(0, 10) || ''}
                    onChange={(e) => setCreateForm({ ...createForm, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Purchase Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={createForm.purchasePrice === 0 ? '' : createForm.purchasePrice}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, purchasePrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tax / GST (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={createForm.taxAmount === 0 ? '' : createForm.taxAmount}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, taxAmount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Freight / Transit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={createForm.freightCost === 0 ? '' : createForm.freightCost}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, freightCost: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Installation / Setup (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={createForm.installationCost === 0 ? '' : createForm.installationCost}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, installationCost: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Calculated Capitalized Cost</label>
                  <div className="px-3 py-2 bg-blue-50/80 border border-blue-200 rounded-lg font-mono font-black text-slate-900 text-xs">
                    {formatCurrency(calculatedCapitalizedCost)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200/60">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Useful Life (Years) *</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    value={createForm.usefulLifeYears ?? 5}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, usefulLifeYears: parseFloat(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Residual / Scrap Value (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={createForm.residualValue ?? 0}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, residualValue: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Supplier Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Aquatech Engineering Ltd"
                    value={createForm.supplierName || ''}
                    onChange={(e) => setCreateForm({ ...createForm, supplierName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Purchase Invoice #</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-081"
                    value={createForm.purchaseInvoiceNumber || ''}
                    onChange={(e) => setCreateForm({ ...createForm, purchaseInvoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>
              </div>
            </fieldset>
          )}
        </div>

        {/* SECTION 3: LOCATION & ASSIGNMENT */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3.5">
          <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] text-[#1A56DB]">
            Location & Physical Condition
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Location / Plant *</label>
              <input
                type="text"
                placeholder="e.g. Main Plant / Warehouse A"
                value={createForm.location || ''}
                onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Department</label>
              <input
                type="text"
                disabled={editing && !!createForm.assignedEmployeeId}
                placeholder="e.g. Production / Quality Control"
                value={createForm.department || ''}
                onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Physical Condition *</label>
              <select
                value={createForm.condition || 'Good'}
                onChange={(e) => setCreateForm({ ...createForm, condition: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-medium focus:outline-none focus:border-[#1A56DB]"
              >
                <option value="Excellent">Excellent (Like New)</option>
                <option value="Good">Good (Operational)</option>
                <option value="Fair">Fair (Wear & Tear)</option>
                <option value="NeedsRepair">Needs Repair</option>
                <option value="Damaged">Damaged</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 4: WARRANTY */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3.5">
          <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] text-[#1A56DB]">
            Warranty & Service Terms
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Warranty Provider</label>
              <input
                type="text"
                placeholder="e.g. OEM / Service Corp"
                value={createForm.warrantyProvider || ''}
                onChange={(e) => setCreateForm({ ...createForm, warrantyProvider: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Policy / Contract #</label>
              <input
                type="text"
                placeholder="e.g. WAR-2026-90"
                value={createForm.warrantyNumber || ''}
                onChange={(e) => setCreateForm({ ...createForm, warrantyNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Warranty Start Date</label>
              <input
                type="date"
                value={createForm.warrantyStartDate?.slice(0, 10) || ''}
                onChange={(e) =>
                  setCreateForm({ ...createForm, warrantyStartDate: e.target.value || undefined })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Warranty End Date</label>
              <input
                type="date"
                value={createForm.warrantyEndDate?.slice(0, 10) || ''}
                onChange={(e) =>
                  setCreateForm({ ...createForm, warrantyEndDate: e.target.value || undefined })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Warranty Notes / Coverage Details</label>
            <input
              type="text"
              placeholder="e.g. 24-month comprehensive coverage including motors & electrical components"
              value={createForm.warrantyNotes || ''}
              onChange={(e) => setCreateForm({ ...createForm, warrantyNotes: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
            />
          </div>
        </div>

        {/* SECTION 5: ADDITIONAL INFORMATION & NOTES */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3.5">
          <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] text-[#1A56DB]">
            Additional Information
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Asset Sub-Type / Tag Type</label>
              <input
                type="text"
                placeholder="e.g. Core Machinery / IT Infrastructure"
                value={createForm.assetType || ''}
                onChange={(e) => setCreateForm({ ...createForm, assetType: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Internal Notes</label>
              <input
                type="text"
                placeholder="Optional internal asset remarks"
                value={createForm.notes || ''}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Description / Technical Notes</label>
            <textarea
              rows={2}
              placeholder="Detailed description of specifications, accessories included, or operating instructions..."
              value={createForm.description || ''}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB]"
            />
          </div>
        </div>
      </form>
    </EnterpriseModal>

    <QuickCreateAssetCategoryModal
      isOpen={isQuickCreateOpen}
      onClose={() => setIsQuickCreateOpen(false)}
      onSuccess={handleCategoryCreated}
      existingCategories={dbCategories}
    />
  </>
  )
}

export default AssetFormModal
