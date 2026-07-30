import React, { useState } from 'react'
import { Upload, Download, FileSpreadsheet, FileText, Printer, CheckCircle2, AlertCircle, X, ShieldAlert } from 'lucide-react'

interface ImportExportModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'tenant' | 'user'
  onExport: (format: 'csv' | 'excel' | 'pdf' | 'print') => void
  onImportPreview: (file: File) => Promise<any>
  onImportCommit: (records: any[]) => Promise<void>
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  type,
  onExport,
  onImportPreview,
  onImportCommit
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImportFile(file)
      try {
        setLoading(true)
        setError(null)
        const report = await onImportPreview(file)
        setPreviewData(report)
      } catch (err: any) {
        setError(err?.message || 'Failed to parse import file.')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleCommitImport = async () => {
    if (!previewData || !previewData.previewItems) return
    try {
      setLoading(true)
      await onImportCommit(previewData.previewItems)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to commit import records.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150" />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
              {type} Directory Import & Export Utilities
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'export' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            <Download className="w-4 h-4" /> Export Data
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'import' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            <Upload className="w-4 h-4" /> Batch Import (Excel/CSV)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">

          {activeTab === 'export' && (
            <div className="space-y-4">
              <p className="text-slate-500 leading-relaxed">
                Export current filtered {type} directory records into standardized production formats for external auditing or backup.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => onExport('csv')}
                  className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-500 flex items-center gap-3 transition-all text-left"
                >
                  <FileText className="w-8 h-8 text-emerald-600" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">CSV Format</span>
                    <span className="text-slate-400 text-[10px]">Comma-separated values data sheet</span>
                  </div>
                </button>
                <button
                  onClick={() => onExport('excel')}
                  className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-500 flex items-center gap-3 transition-all text-left"
                >
                  <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">Excel Workbook</span>
                    <span className="text-slate-400 text-[10px]">Microsoft Excel (.xlsx) file</span>
                  </div>
                </button>
                <button
                  onClick={() => onExport('pdf')}
                  className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-500 flex items-center gap-3 transition-all text-left"
                >
                  <FileText className="w-8 h-8 text-rose-600" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">PDF Audit Report</span>
                    <span className="text-slate-400 text-[10px]">Formatted PDF document</span>
                  </div>
                </button>
                <button
                  onClick={() => onExport('print')}
                  className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-500 flex items-center gap-3 transition-all text-left"
                >
                  <Printer className="w-8 h-8 text-purple-600" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">Print View</span>
                    <span className="text-slate-400 text-[10px]">Direct print dialog</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold">
                  {error}
                </div>
              )}

              <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center space-y-2 bg-slate-50 dark:bg-slate-950">
                <Upload className="w-8 h-8 text-blue-600 mx-auto" />
                <span className="font-bold text-slate-900 dark:text-white block">Select CSV or Excel File</span>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="import-file-upload"
                />
                <label
                  htmlFor="import-file-upload"
                  className="inline-block px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Choose Local File
                </label>
                {importFile && (
                  <p className="text-xs text-slate-500 font-mono mt-2">File: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>
                )}
              </div>

              {previewData && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                    <span className="font-bold text-slate-900 dark:text-white">Validation Report:</span>
                    <div className="flex gap-3">
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> {previewData.successCount || previewData.previewItems?.length || 0} Valid
                      </span>
                      {previewData.errorCount > 0 && (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {previewData.errorCount} Errors
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-white dark:bg-slate-900 space-y-1">
                    {previewData.previewItems?.map((item: any, idx: number) => (
                      <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-950 rounded flex justify-between font-mono text-[11px]">
                        <span>{item.CompanyName || item.Name || item.Email}</span>
                        <span className="text-emerald-600 font-bold">Ready</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleCommitImport}
                      disabled={loading}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                    >
                      {loading ? 'Importing...' : 'Commit Batch Import'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  )
}

export default ImportExportModal
