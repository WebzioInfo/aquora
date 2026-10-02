import React, { useState } from 'react'
import { Upload, Download, Check, AlertCircle, FileSpreadsheet, X } from 'lucide-react'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import { showToast } from '../../../../utils/toast'

interface ImportAssetsModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: () => void
}

export const ImportAssetsModal: React.FC<ImportAssetsModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [csvRows, setCsvRows] = useState<any[]>([])
  const [validCount, setValidCount] = useState(0)
  const [errors, setErrors] = useState<Array<{ row: number; error: string }>>([])
  const [isImporting, setIsImporting] = useState(false)

  const handleDownloadTemplate = () => {
    const templateHeaders = [
      'AssetName',
      'Category',
      'PurchaseDate',
      'PurchasePrice',
      'Location',
      'Department',
      'Condition',
      'SerialNumber',
      'ModelNumber'
    ]
    const sampleRows = [
      'Office Laser Printer,Printers,2026-08-04,15000,Headquarters,Administration,Good,SN-10928,HP LaserJet Pro',
      'Executive Chair,Furniture,2026-08-04,500,Floor 2,Operations,Good,SN-29381,Herman Miller Aeron'
    ]
    const csvContent = [templateHeaders.join(','), ...sampleRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'asset-import-template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Import template downloaded', 'success')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        parseCsv(text)
      }
      reader.readAsText(selected)
    }
  }

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length <= 1) {
      setErrors([{ row: 0, error: 'CSV file is empty or missing headers.' }])
      return
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const rowErrors: Array<{ row: number; error: string }> = []
    const parsed: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim())
      const name = parts[0]
      const price = parseFloat(parts[3])

      if (!name) {
        rowErrors.push({ row: i, error: 'Asset Name is required' })
      } else if (isNaN(price) || price < 0) {
        rowErrors.push({ row: i, error: 'PurchasePrice must be a valid non-negative number' })
      } else {
        parsed.push({
          assetName: name,
          assetCategory: parts[1] || 'Other',
          purchaseDate: parts[2] || new Date().toISOString().slice(0, 10),
          purchasePrice: price,
          location: parts[4] || 'Main Site',
          department: parts[5] || '',
          condition: parts[6] || 'Good',
          serialNumber: parts[7] || '',
          modelNumber: parts[8] || ''
        })
      }
    }

    setCsvRows(parsed)
    setValidCount(parsed.length)
    setErrors(rowErrors)
    setStep(3)
  }

  const handleCommitImport = async () => {
    setIsImporting(true)
    try {
      // simulate batch / single requests with small delay
      await new Promise((r) => setTimeout(r, 600))
      showToast(`Successfully imported ${validCount} assets`, 'success')
      onImportSuccess()
      onClose()
    } catch {
      showToast('Error during import process. Please try again.', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Import Fixed Assets"
      subtitle="Upload a batch CSV file to import multiple capital asset records"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {step > 1 && (
              <EnterpriseButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as any)}
                disabled={isImporting}
              >
                Back
              </EnterpriseButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <EnterpriseButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isImporting}
            >
              Cancel
            </EnterpriseButton>
            {step === 1 && (
              <EnterpriseButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setStep(2)}
              >
                Next: Upload File
              </EnterpriseButton>
            )}
            {step === 3 && (
              <EnterpriseButton
                type="button"
                variant="primary"
                size="sm"
                disabled={validCount === 0 || isImporting}
                loading={isImporting}
                loadingText="Importing..."
                onClick={handleCommitImport}
              >
                Import {validCount} valid {validCount === 1 ? 'row' : 'rows'}
              </EnterpriseButton>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs select-none">
        {/* Stepper Progress */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                step >= 1 ? 'bg-[#1A56DB] text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              1
            </span>
            <span className={`font-semibold ${step >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>
              Template
            </span>
          </div>
          <div className="h-0.5 flex-1 bg-slate-200 mx-3" />
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                step >= 2 ? 'bg-[#1A56DB] text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              2
            </span>
            <span className={`font-semibold ${step >= 2 ? 'text-slate-900' : 'text-slate-400'}`}>
              Upload CSV
            </span>
          </div>
          <div className="h-0.5 flex-1 bg-slate-200 mx-3" />
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                step >= 3 ? 'bg-[#1A56DB] text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              3
            </span>
            <span className={`font-semibold ${step >= 3 ? 'text-slate-900' : 'text-slate-400'}`}>
              Review
            </span>
          </div>
        </div>

        {/* STEP 1: DOWNLOAD TEMPLATE */}
        {step === 1 && (
          <div className="py-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1A56DB] flex items-center justify-center mx-auto border border-blue-100">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-slate-800 text-sm">Download standard CSV template</h4>
            <p className="text-slate-500 max-w-sm mx-auto text-xs">
              Use our formatted spreadsheet template containing required headers (AssetName, Category, PurchaseDate, PurchasePrice, Location, etc.)
            </p>
            <EnterpriseButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDownloadTemplate}
              className="mt-2"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Template (.csv)
            </EnterpriseButton>
          </div>
        )}

        {/* STEP 2: UPLOAD FILE */}
        {step === 2 && (
          <div className="py-4 space-y-3">
            <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#1A56DB] hover:bg-blue-50/20 transition-all block">
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <span className="font-semibold text-slate-800 text-xs">
                {file ? file.name : 'Click or drag CSV file here to upload'}
              </span>
              <span className="text-[11px] text-slate-400 mt-1">Supports UTF-8 CSV files up to 5MB</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* STEP 3: REVIEW & SUMMARY */}
        {step === 3 && (
          <div className="space-y-3 py-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Validation Summary
                </span>
                <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                  {validCount} rows ready to import · {errors.length} with validation issues
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  errors.length === 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {errors.length === 0 ? 'All Valid' : `${errors.length} Flagged`}
              </span>
            </div>

            {errors.length > 0 && (
              <div className="border border-rose-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-rose-50 text-rose-800 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2 w-16">Row</th>
                      <th className="p-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 bg-white">
                    {errors.map((err, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-mono text-slate-500">Row {err.row}</td>
                        <td className="p-2 text-rose-600 font-medium">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </EnterpriseModal>
  )
}

export default ImportAssetsModal
