import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { useNotificationStore } from '../../store/useNotificationStore'
import { generateERPDocumentPDF } from '../../utils/pdfTemplateEngine'
import type { PDFDocumentOptions, PDFCompanyInfo } from '../../utils/pdfTemplateEngine'
import { X, Printer, Download, Eye, FileText } from 'lucide-react'
import EnterpriseButton from './EnterpriseButton'
import EnterpriseModal from './EnterpriseModal'

interface PrintPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  documentData: Omit<PDFDocumentOptions, 'companyInfo'>
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  documentData
}) => {
  const { showToast } = useNotificationStore()
  const [companyProfile, setCompanyProfile] = useState<PDFCompanyInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string>('')

  // 1. Fetch Company settings dynamically
  useEffect(() => {
    const fetchCompanyProfile = async () => {
      try {
        setLoading(true)
        const res = await api.get('/api/v1/company/settings')
        if (res.data?.success && res.data?.data) {
          setCompanyProfile(res.data.data)
        }
      } catch (err: any) {
        console.error('Failed to load company profile for print:', err)
        showToast('Failed to load company settings for document header.', 'error')
      } finally {
        setLoading(false)
      }
    }

    if (isOpen) {
      fetchCompanyProfile()
    }
  }, [isOpen])

  // 2. Generate PDF blob url once profile is loaded
  useEffect(() => {
    if (isOpen && companyProfile) {
      try {
        const fullOptions: PDFDocumentOptions = {
          ...documentData,
          companyInfo: {
            name: companyProfile.name || 'Company Name',
            displayName: companyProfile.displayName || companyProfile.name || 'Company Profile',
            email: companyProfile.email,
            phone: companyProfile.phone,
            gstNumber: companyProfile.gstNumber,
            address: companyProfile.address,
            logoUrl: companyProfile.logoUrl
          }
        }
        const pdfInstance = generateERPDocumentPDF(fullOptions)
        const blob = pdfInstance.output('blob')
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)

        return () => {
          URL.revokeObjectURL(url)
          setPdfUrl('')
        }
      } catch (pdfErr: any) {
        console.error('Failed to generate document PDF:', pdfErr)
        showToast('Error generating PDF document layout.', 'error')
      }
    }
  }, [isOpen, companyProfile, documentData])

  const handleDownload = () => {
    if (!companyProfile) return
    try {
      const fullOptions: PDFDocumentOptions = {
        ...documentData,
        companyInfo: companyProfile
      }
      const pdfInstance = generateERPDocumentPDF(fullOptions)
      pdfInstance.save(`${documentData.docNumber || 'document'}.pdf`)
      showToast('Document downloaded successfully.', 'success')
    } catch (err) {
      showToast('Failed to download PDF.', 'error')
    }
  }

  const handlePrint = () => {
    const iframe = document.getElementById('pdf-preview-iframe') as HTMLIFrameElement
    if (iframe) {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (err) {
        console.error('Print iframe error:', err)
        showToast('Direct print is unsupported by this browser. Please download the PDF instead.', 'warning')
      }
    } else {
      showToast('PDF viewer is not loaded yet.', 'error')
    }
  }

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${documentData.title} Preview`}
      maxWidth="xl"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 gap-3 min-h-[300px]">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500 animate-pulse">Loading company settings...</p>
        </div>
      ) : !pdfUrl ? (
        <div className="flex flex-col items-center justify-center p-12 gap-3 min-h-[300px] text-center text-slate-500">
          <FileText className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-700">Unable to generate preview</p>
          <p className="text-[11px] text-slate-500">Something went wrong while preparing the document details.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 text-left text-xs min-h-[500px]">
          {/* LEFT SIDEBAR: Document details summary and primary actions */}
          <div className="lg:col-span-1 space-y-4 flex flex-col justify-between">
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Document Title</p>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{documentData.title}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Reference Number</p>
                <p className="text-xs font-bold text-indigo-600 mt-0.5 font-mono">{documentData.docNumber}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Issued Date</p>
                <p className="text-xs font-semibold text-slate-800 mt-0.5">{documentData.date}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{documentData.partyLabel}</p>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{documentData.partyInfo.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Grand Total</p>
                <p className="text-sm font-extrabold text-emerald-600 mt-0.5">
                  ₹{documentData.financialSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-4">
              <EnterpriseButton
                variant="primary"
                onClick={handlePrint}
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                <Printer className="w-4 h-4" /> Print Document
              </EnterpriseButton>

              <EnterpriseButton
                variant="secondary"
                onClick={handleDownload}
                className="w-full gap-2 font-bold"
              >
                <Download className="w-4 h-4" /> Download PDF
              </EnterpriseButton>

              <EnterpriseButton
                variant="secondary"
                onClick={onClose}
                className="w-full"
              >
                Close Preview
              </EnterpriseButton>
            </div>
          </div>

          {/* RIGHT VIEWPORT: Interactive PDF Preview */}
          <div className="lg:col-span-3 flex flex-col">
            <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-100 flex-1 shadow-sm">
              <iframe
                id="pdf-preview-iframe"
                src={`${pdfUrl}#toolbar=0&navpanes=0`}
                className="w-full h-[50vh] min-h-[350px] max-h-[600px] bg-slate-50 border-none block"
                title="Print Preview Viewer"
              />
            </div>
          </div>
        </div>
      )}
    </EnterpriseModal>
  )
}
