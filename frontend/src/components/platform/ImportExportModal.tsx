import React, { useState } from 'react'
import { Upload, Download, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react'

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
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-150" />

      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900 capitalize">
              {type} Directory Data Utilities
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white text-xs font-semibold">
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'export' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" /> Export Records
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'import' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" /> Batch Import (CSV)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold">
              {error}
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              <p className="text-slate-600 leading-relaxed">
                Export registered {type} records with active filters applied.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => onExport('csv')}
                  className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all text-left flex items-start gap-3 shadow-xs"
                >
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">Comma Separated CSV</span>
                    <span className="text-slate-500 text-[11px]">Structured CSV dataset for Excel and database import.</span>
                  </div>
                </button>

                <button
                  onClick={() => onExport('excel')}
                  className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all text-left flex items-start gap-3 shadow-xs"
                >
                  <FileText className="w-6 h-6 text-blue-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">JSON Format</span>
                    <span className="text-slate-500 text-[11px]">Complete schema document export for backup & migration.</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <span className="font-bold text-slate-900 block text-sm">Upload CSV Dataset</span>
                <span className="text-slate-500 text-[11px] block mb-3">Select a formatted CSV file to preview import records.</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload-input"
                />
                <label
                  htmlFor="csv-upload-input"
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 cursor-pointer inline-block shadow-xs"
                >
                  Browse File
                </label>
              </div>

              {importFile && (
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className="font-mono text-slate-800">{importFile.name}</span>
                  <span className="text-slate-400">{Math.round(importFile.size / 1024)} KB</span>
                </div>
              )}

              {previewData && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">Parsed Preview</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> {previewData.successCount || previewData.previewItems?.length || 0} valid records
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
          {activeTab === 'import' && previewData && (
            <button
              onClick={handleCommitImport}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {loading ? 'Importing...' : 'Commit Import'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

export default ImportExportModal
