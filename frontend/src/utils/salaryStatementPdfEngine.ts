import { jsPDF } from 'jspdf'
import type { EmployeeSalaryStatementReport } from '../services/payroll'
import {
  drawCompanyPdfHeader,
  drawCompanyPdfContinuationHeader
} from './companyPdfHeader'
import type { PDFCompanyProfile } from './companyPdfHeader'

/**
 * Robust monetary amount formatter.
 * Uses 'Rs. ' (or ISO code) prefix with standard Indian numbering (e.g. Rs. 15,000.00).
 * Completely eliminates any character-mapping artifacts (such as apostrophe `'`)
 * that occur when raw unicode rupee symbols are passed to standard Latin PDF font encodings.
 */
const formatAmount = (val: number | undefined | null, prefix: string = 'Rs. '): string => {
  if (val === undefined || val === null || isNaN(val)) return `${prefix}0.00`
  const num = Number(val)
  return `${prefix}${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

const formatDate = (dateVal: string | Date | undefined | null): string => {
  if (!dateVal) return '—'
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return String(dateVal)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return String(dateVal)
  }
}

const formatMonth = (mStr?: string) => {
  if (!mStr || !/^\d{4}-\d{2}$/.test(mStr)) return mStr || 'Current Period'
  try {
    const [year, month] = mStr.split('-')
    const d = new Date(parseInt(year), parseInt(month) - 1, 1)
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  } catch {
    return mStr
  }
}

const truncateText = (str: string | undefined | null, maxLen: number): string => {
  if (!str) return '—'
  const trimmed = str.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.substring(0, maxLen - 1)}…`
}

/**
 * ============================================================================
 * 1. CLEAN, MODERN ONE-PAGE SALARY SLIP PDF ENGINE
 * ============================================================================
 * Designed specifically as a professional, human-readable salary slip:
 * - Fits naturally on a SINGLE A4 PAGE for standard payroll statements
 * - Dynamic Company Branding (Name, Address, Contact)
 * - Clear Employee Info (Name, ID, Designation, Department, Attendance)
 * - 4-Metric Salary Summary in Large Bold Typography
 * - Conditional Adjustments (shown ONLY if meaningful)
 * - Current Period Payment Transactions Table (with safe bounds & right alignment)
 * - Bold Final Settlement Status Box (Green for FULLY SETTLED / Red for PARTIALLY PAID)
 * - Compact Signatures on Page 1 (No empty second page)
 * - Zero Duplication of Data
 */
export const generateSalarySlipPDF = (data: EmployeeSalaryStatementReport): jsPDF => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Geometry (A4: 210mm x 297mm)
  const pageWidth = 210
  const pageHeight = 297
  const margin = 14
  const contentWidth = pageWidth - (margin * 2) // 182mm
  const rightMarginX = pageWidth - margin // 196mm
  const topMargin = 13
  const bottomMargin = 14

  // Currency prefix: 'Rs. ' or custom ISO prefix
  const rawCurr = (data.company?.currency || 'INR').toUpperCase().trim()
  const currPrefix = rawCurr === 'INR' ? 'Rs. ' : (rawCurr === 'USD' ? '$ ' : (rawCurr === 'EUR' ? '€ ' : `${rawCurr} `))

  // Corporate Colors
  const C_DARK = [15, 23, 42] // slate-900
  const C_TEXT = [51, 65, 85] // slate-700
  const C_MUTED = [100, 116, 139] // slate-500
  const C_LIGHT_MUTED = [148, 163, 184] // slate-400
  const C_BORDER = [226, 232, 240] // slate-200
  const C_BG_LIGHT = [248, 250, 252] // slate-50
  const C_NAVY = [30, 58, 138] // blue-900 / navy
  const C_GREEN = [22, 101, 52] // emerald-800
  const C_GREEN_BG = [240, 253, 244] // emerald-50
  const C_GREEN_BORDER = [187, 247, 208] // emerald-200
  const C_RED = [185, 28, 28] // red-700
  const C_RED_BG = [254, 242, 242] // red-50
  const C_RED_BORDER = [254, 202, 202] // red-200

  // Helpers
  const textRight = (text: string, x: number, currentY: number) => {
    const textWidth = pdf.getTextWidth(text)
    pdf.text(text, x - textWidth, currentY)
  }

  const textCenter = (text: string, centerX: number, currentY: number) => {
    const textWidth = pdf.getTextWidth(text)
    pdf.text(text, centerX - (textWidth / 2), currentY)
  }

  let y = topMargin
  let pageCount = 1

  const drawContinuationHeader = () => {
    y = drawCompanyPdfContinuationHeader(pdf, {
      company: data.company,
      docTitle: 'SALARY SLIP',
      docNumber: `${data.employee.fullName} (${formatMonth(data.currentStatement.salaryMonth)})`,
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
    company: data.company,
    docTitle: 'SALARY SLIP',
    docNumber: formatMonth(data.currentStatement.salaryMonth).toUpperCase(),
    docDate: `Generated: ${formatDate(new Date())}`,
    metaLines: data.company?.gstNumber ? [`GSTIN: ${data.company.gstNumber}`] : [],
    startX: margin,
    startY: y,
    contentWidth,
    rightMarginX,
    titleColor: [30, 58, 138],
    maxAddressWidth: 105,
    showDivider: true
  })

  y = headerRes.nextY
  y += 5

  // ==========================================
  // 2. EMPLOYEE INFORMATION (2-ROW COMPACT GRID)
  // ==========================================
  const empBoxH = 18
  pdf.setFillColor(C_BG_LIGHT[0], C_BG_LIGHT[1], C_BG_LIGHT[2])
  pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
  pdf.setLineWidth(0.4)
  pdf.roundedRect(margin, y, contentWidth, empBoxH, 1.5, 1.5, 'FD')

  const c1 = margin + 5
  const c2 = margin + 65
  const c3 = margin + 125

  // Row 1 Labels
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
  pdf.text('EMPLOYEE NAME', c1, y + 4.8)
  pdf.text('DESIGNATION', c2, y + 4.8)
  pdf.text('DEPARTMENT', c3, y + 4.8)

  // Row 1 Values
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9.5)
  pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
  pdf.text(data.employee.fullName, c1, y + 9.5)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2])
  pdf.text(data.employee.designation || 'Staff', c2, y + 9.5)
  pdf.text(data.employee.department || 'Operations', c3, y + 9.5)

  // Row 2 Labels
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
  pdf.text('SALARY PERIOD', c1, y + 13.5)
  pdf.text('DAYS WORKED', c2, y + 13.5)
  pdf.text('PAYMENT STATUS', c3, y + 13.5)

  // Row 2 Values
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
  pdf.text(formatMonth(data.currentStatement.salaryMonth), c1, y + 17)

  pdf.text(`${data.currentStatement.daysWorked} / ${data.currentStatement.workingDays} Days`, c2, y + 17)

  const statusLabel = (data.currentStatement.status || 'Unpaid').toUpperCase()
  const isFullySettled = (data.currentStatement.remainingBalance ?? 0) <= 0 && (data.currentStatement.totalPaid ?? 0) > 0
  pdf.setFont('helvetica', 'bold')
  if (isFullySettled || statusLabel.includes('PAID')) {
    pdf.setTextColor(C_GREEN[0], C_GREEN[1], C_GREEN[2])
    pdf.text(isFullySettled ? 'FULLY SETTLED' : statusLabel, c3, y + 17)
  } else {
    pdf.setTextColor(C_RED[0], C_RED[1], C_RED[2])
    pdf.text(statusLabel, c3, y + 17)
  }

  y += empBoxH + 6

  // ==========================================
  // 3. SALARY SUMMARY (4 LARGE-VALUE BOXES)
  // ==========================================
  const earnedAmt = data.currentStatement.earnedSalary ?? data.currentStatement.grossSalary ?? data.currentStatement.calculatedEntitlement ?? data.currentStatement.baseSalary ?? 0
  const isZeroBalance = (data.currentStatement.remainingBalance ?? 0) <= 0

  const summaryGap = 3.5
  const summaryWidth = (contentWidth - (3 * summaryGap)) / 4 // 42.875mm
  const summaryH = 19

  const summaryCards = [
    {
      title: 'MONTHLY SALARY',
      val: formatAmount(data.currentStatement.baseSalary, currPrefix),
      sub: 'Standard base rate',
      color: C_DARK,
      bg: [255, 255, 255],
      border: C_BORDER
    },
    {
      title: 'EARNED SALARY',
      val: formatAmount(earnedAmt, currPrefix),
      sub: `For ${data.currentStatement.daysWorked} days worked`,
      color: C_NAVY,
      bg: [255, 255, 255],
      border: C_BORDER
    },
    {
      title: 'TOTAL PAID',
      val: formatAmount(data.currentStatement.totalPaid, currPrefix),
      sub: `${data.currentStatement.payments?.length || 0} disbursement(s)`,
      color: C_GREEN,
      bg: C_GREEN_BG,
      border: C_GREEN_BORDER
    },
    {
      title: 'BALANCE DUE',
      val: formatAmount(data.currentStatement.remainingBalance, currPrefix),
      sub: isZeroBalance ? 'Fully settled' : 'Pending payment',
      color: isZeroBalance ? C_GREEN : C_RED,
      bg: isZeroBalance ? C_GREEN_BG : C_RED_BG,
      border: isZeroBalance ? C_GREEN_BORDER : C_RED_BORDER
    }
  ]

  summaryCards.forEach((c, idx) => {
    const cardX = margin + (idx * (summaryWidth + summaryGap))

    pdf.setFillColor(c.bg[0], c.bg[1], c.bg[2])
    pdf.setDrawColor(c.border[0], c.border[1], c.border[2])
    pdf.setLineWidth(0.4)
    pdf.roundedRect(cardX, y, summaryWidth, summaryH, 1.5, 1.5, 'FD')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.5)
    pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
    pdf.text(c.title, cardX + 3, y + 4.8)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(c.color[0], c.color[1], c.color[2])
    pdf.text(c.val, cardX + 3, y + 11.5)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
    pdf.text(c.sub, cardX + 3, y + 16)
  })

  y += summaryH + 6

  // ==========================================
  // 4. CONDITIONAL BONUS / DEDUCTIONS (ONLY IF NON-ZERO)
  // ==========================================
  const hasBonus = (data.currentStatement.bonus ?? 0) > 0
  const hasAdvanceDed = (data.currentStatement.advanceDeduction ?? 0) > 0
  const hasOtherDed = (data.currentStatement.otherDeduction ?? 0) > 0

  if (hasBonus || hasAdvanceDed || hasOtherDed) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
    pdf.text('ADJUSTMENTS & DEDUCTIONS', margin, y + 2)
    y += 5

    const adjBoxH = 10
    pdf.setFillColor(C_BG_LIGHT[0], C_BG_LIGHT[1], C_BG_LIGHT[2])
    pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
    pdf.setLineWidth(0.3)
    pdf.roundedRect(margin, y, contentWidth, adjBoxH, 1.5, 1.5, 'FD')

    let adjX = margin + 5
    if (hasBonus) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
      pdf.text('Performance Bonus:', adjX, y + 6.5)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(C_GREEN[0], C_GREEN[1], C_GREEN[2])
      pdf.text(`+ ${formatAmount(data.currentStatement.bonus, currPrefix)}`, adjX + 27, y + 6.5)
      adjX += 55
    }

    if (hasAdvanceDed) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
      pdf.text('Advance Recovered:', adjX, y + 6.5)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(C_RED[0], C_RED[1], C_RED[2])
      pdf.text(`- ${formatAmount(data.currentStatement.advanceDeduction, currPrefix)}`, adjX + 27, y + 6.5)
      adjX += 55
    }

    if (hasOtherDed) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
      pdf.text('Other Deductions (LOP):', adjX, y + 6.5)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(C_RED[0], C_RED[1], C_RED[2])
      pdf.text(`- ${formatAmount(data.currentStatement.otherDeduction, currPrefix)}`, adjX + 32, y + 6.5)
    }

    y += adjBoxH + 5
  }

  // ==========================================
  // 5. CURRENT PERIOD PAYMENT DETAILS TABLE (SAFE BOUNDS & RIGHT ALIGNMENT)
  // ==========================================
  const payments = data.currentStatement.payments || []

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
  pdf.text('PAYMENT DETAILS', margin, y + 2)
  y += 5

  if (payments.length === 0) {
    pdf.setFillColor(C_BG_LIGHT[0], C_BG_LIGHT[1], C_BG_LIGHT[2])
    pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
    pdf.roundedRect(margin, y, contentWidth, 10, 1.5, 1.5, 'FD')

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
    textCenter('No payment transactions recorded for this salary period yet.', pageWidth / 2, y + 6.5)
    y += 14
  } else {
    // Payment Table Header (Total table width = 182mm, sits strictly from margin=14 to rightMarginX=196)
    pdf.setFillColor(C_BG_LIGHT[0], C_BG_LIGHT[1], C_BG_LIGHT[2])
    pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
    pdf.setLineWidth(0.3)
    pdf.rect(margin, y, contentWidth, 6, 'FD')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
    pdf.text('DATE', margin + 3, y + 4.2)
    pdf.text('PAYMENT TYPE', margin + 28, y + 4.2)
    pdf.text('PAYMENT SOURCE', margin + 70, y + 4.2)
    pdf.text('REFERENCE / REMARKS', margin + 118, y + 4.2)
    textRight('AMOUNT', rightMarginX - 3.5, y + 4.2)
    y += 6

    payments.forEach((p, idx) => {
      checkPageBreak(6.5)
      pdf.setFillColor(idx % 2 === 0 ? 255 : C_BG_LIGHT[0], idx % 2 === 0 ? 255 : C_BG_LIGHT[1], idx % 2 === 0 ? 255 : C_BG_LIGHT[2])
      pdf.rect(margin, y, contentWidth, 6.5, 'F')
      pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
      pdf.line(margin, y + 6.5, rightMarginX, y + 6.5)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2])
      pdf.text(formatDate(p.paymentDate), margin + 3, y + 4.5)

      pdf.setFont('helvetica', 'bold')
      pdf.text(truncateText(p.paymentType, 22), margin + 28, y + 4.5)

      pdf.setFont('helvetica', 'normal')
      pdf.text(truncateText(p.paidFrom || p.paymentMethod || 'Bank Transfer', 26), margin + 70, y + 4.5)

      pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
      pdf.text(truncateText(p.remarks || '—', 18), margin + 118, y + 4.5)

      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(C_GREEN[0], C_GREEN[1], C_GREEN[2])
      textRight(formatAmount(p.amount, currPrefix), rightMarginX - 3.5, y + 4.5)

      y += 6.5
    })

    // Total Row
    pdf.setFillColor(C_BG_LIGHT[0], C_BG_LIGHT[1], C_BG_LIGHT[2])
    pdf.rect(margin, y, contentWidth, 6.5, 'F')
    pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
    pdf.line(margin, y + 6.5, rightMarginX, y + 6.5)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
    pdf.text('TOTAL PAID THIS PERIOD', margin + 3, y + 4.5)

    pdf.setFontSize(8.5)
    pdf.setTextColor(C_GREEN[0], C_GREEN[1], C_GREEN[2])
    textRight(formatAmount(data.currentStatement.totalPaid, currPrefix), rightMarginX - 3.5, y + 4.5)
    y += 10
  }

  // ==========================================
  // 6. FINAL SETTLEMENT STATUS BOX
  // ==========================================
  checkPageBreak(18)

  const isSettled = (data.currentStatement.remainingBalance ?? 0) <= 0 && (data.currentStatement.totalPaid ?? 0) > 0
  const isPartiallyPaid = (data.currentStatement.remainingBalance ?? 0) > 0 && (data.currentStatement.totalPaid ?? 0) > 0

  const statusBoxH = 14
  if (isSettled) {
    pdf.setFillColor(C_GREEN_BG[0], C_GREEN_BG[1], C_GREEN_BG[2])
    pdf.setDrawColor(C_GREEN_BORDER[0], C_GREEN_BORDER[1], C_GREEN_BORDER[2])
  } else if (isPartiallyPaid) {
    pdf.setFillColor(C_RED_BG[0], C_RED_BG[1], C_RED_BG[2])
    pdf.setDrawColor(C_RED_BORDER[0], C_RED_BORDER[1], C_RED_BORDER[2])
  } else {
    pdf.setFillColor(C_BG_LIGHT[0], C_BG_LIGHT[1], C_BG_LIGHT[2])
    pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
  }
  pdf.setLineWidth(0.4)
  pdf.roundedRect(margin, y, contentWidth, statusBoxH, 1.5, 1.5, 'FD')

  // Left Status Badge
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  if (isSettled) {
    pdf.setTextColor(C_GREEN[0], C_GREEN[1], C_GREEN[2])
    pdf.text('✓  FULLY SETTLED', margin + 5, y + 6)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.text('All salary entitlements for this period have been fully disbursed.', margin + 5, y + 10.5)
  } else if (isPartiallyPaid) {
    pdf.setTextColor(C_RED[0], C_RED[1], C_RED[2])
    pdf.text('PARTIALLY PAID', margin + 5, y + 6)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.text('Balance remains pending settlement for this salary period.', margin + 5, y + 10.5)
  } else {
    pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
    pdf.text('UNPAID', margin + 5, y + 6)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.text('Salary payment pending processing.', margin + 5, y + 10.5)
  }

  // Right Totals inside Settlement Box
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
  textRight(`Total Paid: ${formatAmount(data.currentStatement.totalPaid, currPrefix)}`, rightMarginX - 5, y + 6)

  pdf.setFont('helvetica', 'bold')
  if (isSettled) {
    pdf.setTextColor(C_GREEN[0], C_GREEN[1], C_GREEN[2])
  } else {
    pdf.setTextColor(C_RED[0], C_RED[1], C_RED[2])
  }
  textRight(`Balance Due: ${formatAmount(data.currentStatement.remainingBalance, currPrefix)}`, rightMarginX - 5, y + 10.5)

  y += statusBoxH + 10

  // ==========================================
  // 7. COMPACT SIGNATURE & AUTHORIZATION SECTION
  // ==========================================
  checkPageBreak(24)

  const sigWidth = 65
  const sigH = 12

  // Left: Employee
  pdf.setDrawColor(C_DARK[0], C_DARK[1], C_DARK[2])
  pdf.setLineWidth(0.3)
  pdf.line(margin, y + sigH, margin + sigWidth, y + sigH)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
  pdf.text('Employee Signature', margin, y + sigH + 4)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
  pdf.text(data.employee.fullName, margin, y + sigH + 7.5)
  pdf.text('Date: ____________________', margin, y + sigH + 11.5)

  // Right: Employer
  const rightSigX = rightMarginX - sigWidth
  pdf.line(rightSigX, y + sigH, rightMarginX, y + sigH)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
  textRight('Authorized Signatory', rightMarginX, y + sigH + 4)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
  textRight(`For ${data.company.displayName || data.company.name || 'Aquora'}`, rightMarginX, y + sigH + 7.5)
  textRight('Date: ____________________', rightMarginX, y + sigH + 11.5)

  // ==========================================
  // 8. MINIMAL FOOTER ON EVERY PAGE
  // ==========================================
  const totalPages = (pdf as any).internal.getNumberOfPages()

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p)

    const footerY = pageHeight - 8
    pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
    pdf.setLineWidth(0.3)
    pdf.line(margin, footerY - 2, rightMarginX, footerY - 2)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])

    pdf.text('CONFIDENTIAL — EMPLOYEE PAYROLL DOCUMENT', margin, footerY + 1.5)
    textCenter((data.company.displayName || data.company.name || 'Aquora Enterprise').toUpperCase(), pageWidth / 2, footerY + 1.5)
    textRight(`Page ${p} of ${totalPages}`, rightMarginX, footerY + 1.5)
  }

  return pdf
}

/**
 * ============================================================================
 * 2. COMPLETE EMPLOYEE SALARY HISTORY REPORT PDF ENGINE (SEPARATE DOCUMENT)
 * ============================================================================
 * Clean statement-card based export for all historical periods belonging ONLY to the selected employee
 */
export const generateSalaryHistoryPDF = (data: EmployeeSalaryStatementReport): jsPDF => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = 210
  const pageHeight = 297
  const margin = 14
  const contentWidth = pageWidth - (margin * 2) // 182mm
  const rightMarginX = pageWidth - margin // 196mm
  const topMargin = 14
  const bottomMargin = 14

  const rawCurr = (data.company?.currency || 'INR').toUpperCase().trim()
  const currPrefix = rawCurr === 'INR' ? 'Rs. ' : (rawCurr === 'USD' ? '$ ' : (rawCurr === 'EUR' ? '€ ' : `${rawCurr} `))

  const C_DARK = [15, 23, 42]
  const C_TEXT = [51, 65, 85]
  const C_MUTED = [100, 116, 139]
  const C_LIGHT_MUTED = [148, 163, 184]
  const C_BORDER = [226, 232, 240]
  const C_BG_LIGHT = [248, 250, 252]
  const C_NAVY = [30, 58, 138]
  const C_GREEN = [22, 101, 52]
  const C_RED = [185, 28, 28]

  const textRight = (text: string, x: number, currentY: number) => {
    const textWidth = pdf.getTextWidth(text)
    pdf.text(text, x - textWidth, currentY)
  }

  const textCenter = (text: string, centerX: number, currentY: number) => {
    const textWidth = pdf.getTextWidth(text)
    pdf.text(text, centerX - (textWidth / 2), currentY)
  }

  let y = topMargin
  let pageCount = 1

  const drawHeader = () => {
    y = drawCompanyPdfContinuationHeader(pdf, {
      company: data.company,
      docTitle: 'EMPLOYEE SALARY HISTORY',
      docNumber: data.employee.fullName,
      startX: margin,
      startY: 10,
      rightMarginX
    })
  }

  const checkPageBreak = (neededHeight: number): boolean => {
    if (y + neededHeight > pageHeight - bottomMargin) {
      pdf.addPage()
      pageCount++
      drawHeader()
      return true
    }
    return false
  }

  // ==========================================
  // 1. GLOBAL STANDARD COMPANY HEADER (PAGE 1)
  // ==========================================
  const headerRes = drawCompanyPdfHeader(pdf, {
    company: data.company,
    docTitle: 'SALARY HISTORY',
    docNumber: data.employee.fullName,
    docDate: `Generated: ${formatDate(new Date())}`,
    metaLines: [`Total Periods: ${data.monthlyHistory?.length || 0}`],
    startX: margin,
    startY: y,
    contentWidth,
    rightMarginX,
    titleColor: [30, 58, 138],
    maxAddressWidth: 105,
    showDivider: true
  })

  y = headerRes.nextY

  // Employee Identity Block
  pdf.setFillColor(C_BG_LIGHT[0], C_BG_LIGHT[1], C_BG_LIGHT[2])
  pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
  pdf.setLineWidth(0.4)
  pdf.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9.5)
  pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
  pdf.text(data.employee.fullName, margin + 4, y + 6)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
  pdf.text(`${data.employee.designation || 'Staff'}  •  ${data.employee.department || 'Operations'}`, margin + 4, y + 10.5)

  textRight(`Generated: ${formatDate(new Date())}`, rightMarginX - 4, y + 6)
  textRight(`Total Periods Recorded: ${data.monthlyHistory?.length || 0}`, rightMarginX - 4, y + 10.5)
  y += 18

  // Monthly Statement Cards
  const statements = data.monthlyHistory || []
  statements.forEach((stmt) => {
    const monthPayments = (data.allPaymentTransactions || []).filter(
      p => p.salaryNo?.includes(stmt.salaryMonth.replace('-', '')) || p.monthlySalaryId === stmt.id
    )

    const cardBaseH = 18
    const paymentsH = monthPayments.length > 0 ? (monthPayments.length * 6) + 9 : 0
    const totalCardH = cardBaseH + paymentsH

    checkPageBreak(totalCardH + 5)

    pdf.setFillColor(C_BG_LIGHT[0], C_BG_LIGHT[1], C_BG_LIGHT[2])
    pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
    pdf.setLineWidth(0.3)
    pdf.roundedRect(margin, y, contentWidth, totalCardH, 1.5, 1.5, 'FD')

    // Period Header
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(C_NAVY[0], C_NAVY[1], C_NAVY[2])
    pdf.text(formatMonth(stmt.salaryMonth).toUpperCase(), margin + 4, y + 5.5)

    const isPaid = (stmt.status || '').toLowerCase().includes('paid')
    pdf.setTextColor(isPaid ? C_GREEN[0] : C_RED[0], isPaid ? C_GREEN[1] : C_RED[1], isPaid ? C_GREEN[2] : C_RED[2])
    textRight((stmt.status || 'Unpaid').toUpperCase(), rightMarginX - 4, y + 5.5)

    // Metric Columns
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
    pdf.text(`Attendance: ${stmt.daysWorked}/${stmt.workingDays}d`, margin + 4, y + 12)
    pdf.text(`Base: ${formatAmount(stmt.baseSalary, currPrefix)}`, margin + 48, y + 12)
    pdf.text(`Paid: ${formatAmount(stmt.totalPaid, currPrefix)}`, margin + 92, y + 12)
    pdf.text(`Balance: ${formatAmount(stmt.remainingBalance, currPrefix)}`, margin + 138, y + 12)

    // Payments sub-table
    if (monthPayments.length > 0) {
      let py = y + 16
      pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
      pdf.line(margin + 4, py, rightMarginX - 4, py)
      py += 3.5

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
      pdf.text('DATE', margin + 5, py)
      pdf.text('TYPE', margin + 35, py)
      pdf.text('SOURCE', margin + 80, py)
      textRight('AMOUNT', rightMarginX - 5, py)
      py += 4

      monthPayments.forEach((p) => {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2])
        pdf.text(formatDate(p.paymentDate), margin + 5, py)
        pdf.text(truncateText(p.paymentType, 20), margin + 35, py)
        pdf.text(truncateText(p.paidFrom || p.paymentMethod || 'Bank', 25), margin + 80, py)

        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(C_GREEN[0], C_GREEN[1], C_GREEN[2])
        textRight(formatAmount(p.amount, currPrefix), rightMarginX - 5, py)
        py += 4.5
      })
    }

    y += totalCardH + 4
  })

  // Footers
  const totalPages = (pdf as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p)
    const footerY = pageHeight - 8
    pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2])
    pdf.setLineWidth(0.3)
    pdf.line(margin, footerY - 2, rightMarginX, footerY - 2)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(C_LIGHT_MUTED[0], C_LIGHT_MUTED[1], C_LIGHT_MUTED[2])
    pdf.text('CONFIDENTIAL — EMPLOYEE SALARY HISTORY REPORT', margin, footerY + 1.5)
    textCenter((data.company.displayName || data.company.name || 'Aquora Enterprise').toUpperCase(), pageWidth / 2, footerY + 1.5)
    textRight(`Page ${p} of ${totalPages}`, rightMarginX, footerY + 1.5)
  }

  return pdf
}

/**
 * Clean browser print utility for salary slip
 */
export const printSalarySlip = (data: EmployeeSalaryStatementReport): void => {
  const pdfInstance = generateSalarySlipPDF(data)
  const blob = pdfInstance.output('blob')
  const blobUrl = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '-10000px'
  iframe.style.left = '-10000px'
  iframe.style.width = '1px'
  iframe.style.height = '1px'
  iframe.src = blobUrl

  document.body.appendChild(iframe)

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      window.open(blobUrl, '_blank')
    }
  }
}

/**
 * Clean browser print utility for salary history
 */
export const printSalaryHistory = (data: EmployeeSalaryStatementReport): void => {
  const pdfInstance = generateSalaryHistoryPDF(data)
  const blob = pdfInstance.output('blob')
  const blobUrl = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '-10000px'
  iframe.style.left = '-10000px'
  iframe.style.width = '1px'
  iframe.style.height = '1px'
  iframe.src = blobUrl

  document.body.appendChild(iframe)

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      window.open(blobUrl, '_blank')
    }
  }
}

// Aliases for full compatibility
export const generateSalaryStatementPDF = generateSalarySlipPDF
export const printSalaryStatement = printSalarySlip
