import { jsPDF } from 'jspdf'
import type { WaterTestReport } from '../services/api/waterTest'
import {
  drawCompanyPdfHeader,
  drawCompanyPdfContinuationHeader
} from './companyPdfHeader'
import type { PDFCompanyProfile } from './companyPdfHeader'

export interface WaterTestPdfOptions {
  report: WaterTestReport
  company?: PDFCompanyProfile | null
}

const PHYSICAL_CHEMICAL_ORDER = [
  'pH',
  'TDS',
  'Turbidity',
  'Sulphate',
  'Colour',
  'Odour',
  'Taste',
  'Residual Free Chlorine',
  'Alkalinity',
  'Chloride'
]

const MICROBIOLOGY_ORDER = [
  'E.coli',
  'Coliform',
  'Pseudomonas',
  'Clostridia',
  'Aerobic Microbial Count 22°C',
  'Aerobic Microbial Count 37°C',
  'Yeast & Mold'
]

export const generateWaterTestReportPDF = (options: WaterTestPdfOptions): jsPDF => {
  const { report, company } = options

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Geometry (A4: 210mm x 297mm)
  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  const contentWidth = pageWidth - (margin * 2) // 180mm
  const rightMarginX = pageWidth - margin // 195mm
  const topMargin = 15
  const bottomMargin = 16

  // Color Palette Tokens
  const C_NAVY = [30, 58, 138] // blue-900
  const C_PRIMARY = [37, 99, 235] // blue-600
  const C_DARK = [15, 23, 42] // slate-900
  const C_TEXT = [51, 65, 85] // slate-700
  const C_MUTED = [100, 116, 139] // slate-500
  const C_LIGHT_MUTED = [148, 163, 184] // slate-400
  const C_BORDER = [226, 232, 240] // slate-200
  const C_BORDER_DARK = [203, 213, 225] // slate-300
  const C_BG_LIGHT = [248, 250, 252] // slate-50
  const C_BG_HEAD = [241, 245, 249] // slate-100
  const C_GREEN = [22, 101, 52] // emerald-800
  const C_GREEN_BG = [240, 253, 244] // emerald-50
  const C_GREEN_BORDER = [187, 247, 208] // emerald-200
  const C_RED = [185, 28, 28] // red-700
  const C_RED_BG = [254, 242, 242] // red-50
  const C_RED_BORDER = [254, 202, 202] // red-200
  const C_AMBER = [180, 83, 9] // amber-700
  const C_AMBER_BG = [254, 243, 199] // amber-50
  const C_AMBER_BORDER = [253, 230, 138] // amber-200

  // Drawing Helpers
  const textRight = (text: string, x: number, currentY: number) => {
    const textWidth = pdf.getTextWidth(text)
    pdf.text(text, x - textWidth, currentY)
  }

  const textCenter = (text: string, centerX: number, currentY: number) => {
    const textWidth = pdf.getTextWidth(text)
    pdf.text(text, centerX - (textWidth / 2), currentY)
  }

  const formatDateStr = (dateVal: string | Date | undefined | null, includeTime = false): string => {
    if (!dateVal) return '—'
    try {
      const d = new Date(dateVal)
      if (isNaN(d.getTime())) return String(dateVal)
      if (includeTime) {
        return d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      }
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return String(dateVal)
    }
  }

  const cleanPersonName = (name: string | undefined | null): string => {
    if (!name || ['null', 'undefined', '00000000-0000-0000-0000-000000000000'].includes(name.trim().toLowerCase())) return '—'
    const trimmed = name.trim()
    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
    return isGuid ? '—' : trimmed
  }

  // Safe formatting for numbers without apostrophes or broken character spacing
  const formatResultValue = (val: number | null | undefined, strVal: string | null | undefined): string => {
    if (strVal && strVal.trim() !== '' && strVal !== 'null' && strVal !== 'undefined') {
      return strVal.trim()
    }
    if (val !== null && val !== undefined && !isNaN(val)) {
      // Clean decimal formatting
      if (Number.isInteger(val)) {
        return val.toString()
      }
      return parseFloat(val.toFixed(3)).toString()
    }
    return '—'
  }

  const formatReferenceLimits = (
    minAcc: number | null | undefined,
    maxAcc: number | null | undefined,
    minWarn?: number | null | undefined,
    maxWarn?: number | null | undefined,
    category?: string | null,
    unit?: string | null
  ): string => {
    if (category?.toUpperCase() === 'MICROBIOLOGY') {
      return 'Absent / 100 ml'
    }
    if (minAcc !== null && minAcc !== undefined && maxAcc !== null && maxAcc !== undefined) {
      return `${minAcc} – ${maxAcc}`
    }
    if (maxAcc !== null && maxAcc !== undefined) {
      return `< ${maxAcc}`
    }
    if (minAcc !== null && minAcc !== undefined) {
      return `> ${minAcc}`
    }
    if (minWarn !== null && minWarn !== undefined && maxWarn !== null && maxWarn !== undefined) {
      return `${minWarn} – ${maxWarn}`
    }
    if (maxWarn !== null && maxWarn !== undefined) {
      return `< ${maxWarn}`
    }
    if (minWarn !== null && minWarn !== undefined) {
      return `> ${minWarn}`
    }
    if (unit === 'MPN/100ml' || unit === 'CFU/ml') {
      return 'Absent'
    }
    return '—'
  }

  // Resolve overall report status
  const resolveOverallStatus = (): 'PASS' | 'WARNING' | 'FAIL' | 'DRAFT' | 'IN_PROGRESS' | 'PARTIALLY_COMPLETED' | 'RESULTS_OVERDUE' => {
    if (!report) return 'DRAFT'
    if (report.completionStatus === 'RESULTS_OVERDUE' || (report.results && report.results.some(r => r.resultStatus === 'OVERDUE'))) {
      return 'RESULTS_OVERDUE'
    }
    if (report.completionStatus === 'IN_PROGRESS' || report.completionStatus === 'PARTIALLY_COMPLETED' || (report.results && report.results.some(r => r.resultStatus === 'IN_PROGRESS' || r.resultStatus === 'PENDING_RESULT' || r.resultStatus === 'NOT_STARTED'))) {
      if (report.results && report.results.some(r => r.resultStatus === 'COMPLETED')) {
        return 'PARTIALLY_COMPLETED'
      }
      return 'IN_PROGRESS'
    }
    if (report.status === 'DRAFT') return 'DRAFT'
    if (report.results && report.results.length > 0) {
      if (report.results.some(r => r.qualityStatus === 'FAIL')) return 'FAIL'
      if (report.results.some(r => r.qualityStatus === 'WARNING')) return 'WARNING'
      return 'PASS'
    }
    if (report.status === 'FAIL') return 'FAIL'
    if (report.status === 'WARNING') return 'WARNING'
    if (report.status === 'PASS' || report.status === 'APPROVED') return 'PASS'
    return 'DRAFT'
  }

  const overallStatus = resolveOverallStatus()
  const reportNumber = report.reportNumber || report.id.substring(0, 8).toUpperCase()
  const reportDate = formatDateStr(report.sampleTime || report.createdAt || new Date())
  const companyName = (company?.displayName || company?.name || 'AQUZIO ENTERPRISE').toUpperCase()

  let y = topMargin
  let pageCount = 1

  // Continuation Header Function
  const drawContinuationHeader = () => {
    y = drawCompanyPdfContinuationHeader(pdf, {
      company,
      docTitle: 'WATER TEST REPORT',
      docNumber: reportNumber,
      startX: margin,
      startY: 10,
      rightMarginX
    })
  }

  const checkPageBreak = (neededHeight: number): boolean => {
    if (y + neededHeight > pageHeight - bottomMargin) {
      pdf.addPage()
      pageCount++
      drawContinuationHeader()
      return true
    }
    return false
  }

  // ==========================================
  // 1. GLOBAL STANDARD COMPANY HEADER (PAGE 1)
  // ==========================================
  const headerRes = drawCompanyPdfHeader(pdf, {
    company,
    docTitle: 'WATER TEST REPORT',
    docNumber: `Report No: ${reportNumber}`,
    docDate: `Date: ${reportDate}`,
    startX: margin,
    startY: y,
    contentWidth,
    rightMarginX,
    titleColor: [30, 58, 138],
    maxAddressWidth: 105,
    showDivider: true
  })

  y = headerRes.nextY

  // ==========================================
  // 2. SECTION 1: REPORT & SAMPLE INFORMATION
  // ==========================================
  const compStatusLabel = report.completionStatus ? report.completionStatus.replace(/_/g, ' ') : (report.status || 'DRAFT')
  const infoItems: Array<{ label: string; value: string }> = [
    { label: 'Report Number', value: reportNumber },
    { label: 'Report Type', value: report.reportType || 'DAILY' },
    { label: 'Batch Number', value: report.batchNumber || '—' },
    { label: 'Sample Number', value: report.sampleNumber || '—' },
    { label: 'Production Date', value: formatDateStr(report.productionDate) },
    { label: 'Collection Time', value: formatDateStr(report.sampleTime || report.createdAt, true) },
    { label: 'Tested By (Analyst)', value: cleanPersonName(report.testedBy || report.createdByName) },
    { label: 'Completion Status', value: compStatusLabel }
  ]

  // Filter out completely missing values
  const validInfo = infoItems.filter(i => i.value && i.value !== '—' || ['Report Number', 'Report Type', 'Batch Number', 'Tested By (Analyst)'].includes(i.label))

  // Render info in a clean 3-column card
  const cols = 3
  const colW = contentWidth / cols
  const rowsCount = Math.ceil(validInfo.length / cols)
  const cardH = (rowsCount * 10) + 6

  pdf.setFillColor(C_BG_LIGHT[0], C_BG_LIGHT[1], C_BG_LIGHT[2])
  pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
  pdf.setLineWidth(0.3)
  pdf.roundedRect(margin, y, contentWidth, cardH, 2, 2, 'FD')

  validInfo.forEach((item, idx) => {
    const colIdx = idx % cols
    const rowIdx = Math.floor(idx / cols)
    const itemX = margin + 5 + (colIdx * colW)
    const itemY = y + 5 + (rowIdx * 10)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.5)
    pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
    pdf.text(item.label.toUpperCase(), itemX, itemY)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
    pdf.text(item.value, itemX, itemY + 4)
  })

  y += cardH + 6

  // ==========================================
  // 3. SECTION 2: OVERALL QUALITY STATUS BANNER
  // ==========================================
  const isOverdue = overallStatus === 'RESULTS_OVERDUE'
  const isInProgress = overallStatus === 'IN_PROGRESS' || overallStatus === 'PARTIALLY_COMPLETED'
  const isPass = overallStatus === 'PASS'
  const isFail = overallStatus === 'FAIL'
  const isWarn = overallStatus === 'WARNING'

  const statusBg = isPass ? C_GREEN_BG : (isWarn ? C_AMBER_BG : (isFail || isOverdue ? C_RED_BG : (isInProgress ? [239, 246, 255] : C_BG_LIGHT)))
  const statusBorder = isPass ? C_GREEN_BORDER : (isWarn ? C_AMBER_BORDER : (isFail || isOverdue ? C_RED_BORDER : (isInProgress ? [191, 219, 254] : C_BORDER)))
  const statusText = isPass ? C_GREEN : (isWarn ? C_AMBER : (isFail || isOverdue ? C_RED : (isInProgress ? C_PRIMARY : C_MUTED)))
  
  let statusLabel = 'DRAFT REPORT'
  let statusDesc = 'Quality analysis is currently in draft state.'

  if (isOverdue) {
    statusLabel = 'OVERDUE QC RESULTS — IMMEDIATE ACTION REQUIRED'
    statusDesc = 'One or more required microbiological/observation results have exceeded their expected incubation period.'
  } else if (isInProgress) {
    statusLabel = overallStatus === 'PARTIALLY_COMPLETED' ? 'PARTIALLY COMPLETED — INCUBATION IN PROGRESS' : 'RESULTS IN PROGRESS — INCUBATING'
    statusDesc = 'Physical/chemical parameters recorded. Microbiological parameters are under active incubation.'
  } else if (isPass) {
    statusLabel = 'QUALITY COMPLIANT — PASSED'
    statusDesc = 'All measured parameters comply with BIS IS 14543 Drinking Water Standards.'
  } else if (isWarn) {
    statusLabel = 'WARNING — ACTION REQUIRED'
    statusDesc = 'One or more parameters are within warning threshold limits. Immediate attention recommended.'
  } else if (isFail) {
    statusLabel = 'NON-COMPLIANT — FAILED'
    statusDesc = 'One or more parameters failed standard limits. Water batch must not be dispatched.'
  }

  pdf.setFillColor(statusBg[0], statusBg[1], statusBg[2])
  pdf.setDrawColor(statusBorder[0], statusBorder[1], statusBorder[2])
  pdf.setLineWidth(0.4)
  pdf.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(statusText[0], statusText[1], statusText[2])
  pdf.text(statusLabel, margin + 4, y + 5)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2])
  pdf.text(statusDesc, margin + 4, y + 9.5)

  y += 17

  // ==========================================
  // 4. SECTION 3: TEST RESULTS TABLE
  // ==========================================
  // Organize results in canonical order
  const rawResults = report.results || []
  const sortedResults = [...rawResults].sort((a, b) => {
    const isMicroA = a.parameterCategory?.toUpperCase() === 'MICROBIOLOGY'
    const isMicroB = b.parameterCategory?.toUpperCase() === 'MICROBIOLOGY'
    if (isMicroA !== isMicroB) return isMicroA ? 1 : -1

    const orderList = isMicroA ? MICROBIOLOGY_ORDER : PHYSICAL_CHEMICAL_ORDER
    const idxA = orderList.findIndex(o => o.toLowerCase() === (a.parameterName || '').toLowerCase())
    const idxB = orderList.findIndex(o => o.toLowerCase() === (b.parameterName || '').toLowerCase())
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return (a.parameterName || '').localeCompare(b.parameterName || '')
  })

  // Table Columns Widths (Total: 180mm)
  const colParamW = 55
  const colCatW = 28
  const colResultW = 28
  const colUnitW = 20
  const colRefW = 31
  const colStatusW = 18

  const drawTableHeader = (currentY: number) => {
    pdf.setFillColor(C_BG_HEAD[0], C_BG_HEAD[1], C_BG_HEAD[2])
    pdf.rect(margin, currentY, contentWidth, 6.5, 'F')

    pdf.setDrawColor(C_BORDER_DARK[0], C_BORDER_DARK[1], C_BORDER_DARK[2])
    pdf.setLineWidth(0.3)
    pdf.line(margin, currentY, rightMarginX, currentY)
    pdf.line(margin, currentY + 6.5, rightMarginX, currentY + 6.5)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2])

    let xCursor = margin + 2
    pdf.text('PARAMETER NAME', xCursor, currentY + 4.3)
    xCursor += colParamW
    pdf.text('CATEGORY', xCursor, currentY + 4.3)
    xCursor += colCatW
    textCenter('RESULT', xCursor + (colResultW / 2) - 2, currentY + 4.3)
    xCursor += colResultW
    textCenter('UNIT', xCursor + (colUnitW / 2), currentY + 4.3)
    xCursor += colUnitW
    textCenter('REFERENCE LIMITS', xCursor + (colRefW / 2), currentY + 4.3)
    xCursor += colRefW
    textCenter('STATUS', xCursor + (colStatusW / 2), currentY + 4.3)
  }

  // Section title
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9.5)
  pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
  pdf.text('PARAMETER ANALYSIS RESULTS', margin, y)
  y += 3

  drawTableHeader(y)
  y += 6.5

  sortedResults.forEach((r, idx) => {
    // Check page break (each row is ~6.2mm)
    if (checkPageBreak(7)) {
      drawTableHeader(y)
      y += 6.5
    }

    const isEven = idx % 2 === 0
    if (isEven) {
      pdf.setFillColor(C_BG_LIGHT[0], C_BG_LIGHT[1], C_BG_LIGHT[2])
      pdf.rect(margin, y, contentWidth, 6.2, 'F')
    }

    // Row bottom border
    pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
    pdf.setLineWidth(0.2)
    pdf.line(margin, y + 6.2, rightMarginX, y + 6.2)

    const paramName = r.parameterName || 'Unknown Parameter'
    const category = (r.parameterCategory || 'CHEMICAL').toUpperCase()
    const isResultOverdue = r.resultStatus === 'OVERDUE'
    const isResultPending = r.resultStatus === 'IN_PROGRESS' || r.resultStatus === 'PENDING_RESULT'
    const isResultNotStarted = r.resultStatus === 'NOT_STARTED'
    
    let resultVal = formatResultValue(r.value, r.stringValue)
    if (isResultOverdue) {
      resultVal = 'OVERDUE'
    } else if (isResultPending) {
      resultVal = 'INCUBATING'
    } else if (isResultNotStarted) {
      resultVal = 'PENDING'
    }

    const unit = r.parameterUnit && r.parameterUnit !== '—' ? r.parameterUnit : '—'
    const refLimits = formatReferenceLimits(r.minAcceptable, r.maxAcceptable, r.minWarning, r.maxWarning, r.parameterCategory, r.parameterUnit)
    const rowStatus = r.qualityStatus?.toUpperCase() || (r.isPass ? 'PASS' : 'FAIL')

    // 1. Parameter Name
    let xCursor = margin + 2
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
    const pNameTrim = pdf.splitTextToSize(paramName, colParamW - 3)[0]
    pdf.text(pNameTrim, xCursor, y + 4.2)

    // 2. Category
    xCursor += colParamW
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
    pdf.text(category, xCursor, y + 4.2)

    // 3. Result Value
    xCursor += colCatW
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    if (isResultOverdue || rowStatus === 'FAIL') {
      pdf.setTextColor(C_RED[0], C_RED[1], C_RED[2])
    } else if (isResultPending) {
      pdf.setTextColor(C_PRIMARY[0], C_PRIMARY[1], C_PRIMARY[2])
    } else if (rowStatus === 'WARNING') {
      pdf.setTextColor(C_AMBER[0], C_AMBER[1], C_AMBER[2])
    } else {
      pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
    }
    textCenter(resultVal, xCursor + (colResultW / 2) - 2, y + 4.2)

    // 4. Unit
    xCursor += colResultW
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
    textCenter(unit, xCursor + (colUnitW / 2), y + 4.2)

    // 5. Reference Limits
    xCursor += colUnitW
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2])
    textCenter(refLimits, xCursor + (colRefW / 2), y + 4.2)

    // 6. Status Badge
    xCursor += colRefW
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.5)
    if (isResultOverdue) {
      pdf.setTextColor(C_RED[0], C_RED[1], C_RED[2])
      textCenter('OVERDUE', xCursor + (colStatusW / 2), y + 4.2)
    } else if (isResultPending) {
      pdf.setTextColor(C_PRIMARY[0], C_PRIMARY[1], C_PRIMARY[2])
      textCenter('PENDING', xCursor + (colStatusW / 2), y + 4.2)
    } else if (isResultNotStarted) {
      pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
      textCenter('QUEUED', xCursor + (colStatusW / 2), y + 4.2)
    } else if (rowStatus === 'PASS' || rowStatus === 'APPROVED') {
      pdf.setTextColor(C_GREEN[0], C_GREEN[1], C_GREEN[2])
      textCenter('PASS', xCursor + (colStatusW / 2), y + 4.2)
    } else if (rowStatus === 'WARNING') {
      pdf.setTextColor(C_AMBER[0], C_AMBER[1], C_AMBER[2])
      textCenter('WARN', xCursor + (colStatusW / 2), y + 4.2)
    } else if (rowStatus === 'FAIL') {
      pdf.setTextColor(C_RED[0], C_RED[1], C_RED[2])
      textCenter('FAIL', xCursor + (colStatusW / 2), y + 4.2)
    } else {
      pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
      textCenter('—', xCursor + (colStatusW / 2), y + 4.2)
    }

    y += 6.2
  })

  y += 5

  // ==========================================
  // 5. SECTION 4: REMARKS / OBSERVATIONS (IF ANY)
  // ==========================================
  if (report.remarks && report.remarks.trim() && !['null', 'undefined'].includes(report.remarks.trim().toLowerCase())) {
    const cleanRemarks = report.remarks.trim()
    checkPageBreak(18)

    pdf.setFillColor(C_BG_LIGHT[0], C_BG_LIGHT[1], C_BG_LIGHT[2])
    pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
    pdf.setLineWidth(0.3)

    const remarkLines = pdf.splitTextToSize(cleanRemarks, contentWidth - 8)
    const remarkCardH = 8 + (remarkLines.length * 3.8)
    pdf.roundedRect(margin, y, contentWidth, remarkCardH, 1.5, 1.5, 'FD')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
    pdf.text('ANALYST OBSERVATIONS & NOTES', margin + 4, y + 4.5)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
    pdf.text(remarkLines, margin + 4, y + 8.5)

    y += remarkCardH + 6
  }

  // ==========================================
  // 6. SECTION 5: SIGNATURES & VERIFICATION
  // ==========================================
  checkPageBreak(24)

  const sigBoxW = (contentWidth - 20) / 2
  const sigY = y + 2

  // Signer 1: Analyst / Tested By
  const analystName = cleanPersonName(report.testedBy || report.createdByName || 'Quality Analyst')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
  pdf.text('TESTED & RECORDED BY', margin, sigY + 3)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2])
  pdf.text(analystName, margin, sigY + 8)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
  pdf.text(`Date: ${reportDate}`, margin, sigY + 12)

  pdf.setDrawColor(C_BORDER_DARK[0], C_BORDER_DARK[1], C_BORDER_DARK[2])
  pdf.setLineWidth(0.3)
  pdf.line(margin, sigY + 18, margin + sigBoxW, sigY + 18)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6.5)
  pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
  pdf.text('Authorized Analyst Signature', margin, sigY + 21.5)

  // Signer 2: QC Reviewer / Approver
  const reviewerName = cleanPersonName(report.verifiedBy || 'Quality Assurance Manager')
  const sig2X = rightMarginX - sigBoxW

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
  pdf.text('REVIEWED & APPROVED BY', sig2X, sigY + 3)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2])
  pdf.text(reviewerName, sig2X, sigY + 8)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
  pdf.text(`Date: ${reportDate}`, sig2X, sigY + 12)

  pdf.setDrawColor(C_BORDER_DARK[0], C_BORDER_DARK[1], C_BORDER_DARK[2])
  pdf.setLineWidth(0.3)
  pdf.line(sig2X, sigY + 18, rightMarginX, sigY + 18)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6.5)
  pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
  pdf.text('Quality Assurance Manager Signature', sig2X, sigY + 21.5)

  // ==========================================
  // 7. FOOTER ON ALL PAGES
  // ==========================================
  const totalPages = (pdf as any).internal.getNumberOfPages()

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p)

    const footerY = pageHeight - 9
    pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
    pdf.setLineWidth(0.3)
    pdf.line(margin, footerY - 2, rightMarginX, footerY - 2)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])

    pdf.text('Generated by Aquzio ERP • Quality Control Laboratory', margin, footerY + 2)
    textCenter(companyName, pageWidth / 2, footerY + 2)
    textRight(`Report No: ${reportNumber} • Page ${p} of ${totalPages}`, rightMarginX, footerY + 2)
  }

  return pdf
}
