import { jsPDF } from 'jspdf'
import { api } from '../services/api'
import { useAuthStore } from '../store/useAuthStore'

export interface PDFCompanyProfile {
  name?: string | null
  displayName?: string | null
  legalName?: string | null
  companyName?: string | null
  email?: string | null
  phone?: string | null
  gstNumber?: string | null
  address?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  district?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  pincode?: string | null
  zipCode?: string | null
  logoUrl?: string | null
  currency?: string | null
}

export interface CompanyHeaderOptions {
  company?: PDFCompanyProfile | null
  docTitle: string
  docNumber?: string
  docDate?: string
  metaLines?: string[]
  startX?: number
  startY?: number
  contentWidth?: number
  rightMarginX?: number
  titleColor?: [number, number, number]
  showDivider?: boolean
  maxAddressWidth?: number
  subtitle?: string
}

export interface ContinuationHeaderOptions {
  company?: PDFCompanyProfile | null
  docTitle: string
  docNumber?: string
  metaText?: string
  startX?: number
  startY?: number
  contentWidth?: number
  rightMarginX?: number
}

// In-memory & localStorage cache for synchronous retrieval
let _cachedCompanyProfile: PDFCompanyProfile | null = null

const isValidString = (val: any): val is string => {
  if (typeof val !== 'string') return false
  const trimmed = val.trim().toLowerCase()
  return trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined' && trimmed !== 'n/a' && trimmed !== 'none'
}

/**
 * Global centralized address formatter for all PDF documents and print templates.
 * Safely inspects all available address fields, deduplicates values, removes null/undefined,
 * and formats clean multiline or comma-separated output with zero empty commas or labels.
 */
export const formatCompanyAddress = (company?: PDFCompanyProfile | null): string => {
  if (!company) return ''

  // If a pre-formatted full address string exists
  if (isValidString(company.address)) {
    const raw = company.address.trim()
    // If it already contains line breaks or commas, clean redundant whitespace
    const cleaned = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = cleaned.split('\n').map(l => l.trim()).filter(l => isValidString(l))
    return lines.join(', ')
  }

  // Otherwise, construct from individual address fragments
  const parts: string[] = []

  const addUnique = (val?: string | null) => {
    if (!isValidString(val)) return
    const trimmed = val.trim()
    // Avoid duplicate insertions
    if (!parts.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
      parts.push(trimmed)
    }
  }

  addUnique(company.addressLine1)
  addUnique(company.addressLine2)
  addUnique(company.city)
  addUnique(company.district)

  // Format State + Postal/Zip Code cleanly (e.g. "Kerala - 682022")
  const stateVal = isValidString(company.state) ? company.state.trim() : null
  const pinVal = isValidString(company.pincode) 
    ? company.pincode.trim() 
    : (isValidString(company.postalCode) 
        ? company.postalCode.trim() 
        : (isValidString(company.zipCode) ? company.zipCode.trim() : null))

  if (stateVal && pinVal) {
    parts.push(`${stateVal} - ${pinVal}`)
  } else if (stateVal) {
    parts.push(stateVal)
  } else if (pinVal) {
    parts.push(pinVal)
  }

  addUnique(company.country)

  return parts.join(', ')
}

/**
 * Resolves the active company profile from AuthStore, Cache, or API.
 */
export const getGlobalCompanyProfileSync = (fallbackCompany?: PDFCompanyProfile | null): PDFCompanyProfile => {
  if (fallbackCompany && (fallbackCompany.name || fallbackCompany.displayName || fallbackCompany.address)) {
    return fallbackCompany
  }

  if (_cachedCompanyProfile) {
    return _cachedCompanyProfile
  }

  // Check localStorage cache
  try {
    const local = localStorage.getItem('aquzio_company_profile')
    if (local) {
      const parsed = JSON.parse(local)
      if (parsed && typeof parsed === 'object') {
        _cachedCompanyProfile = parsed
        return parsed
      }
    }
  } catch {}

  // Fallback to AuthStore user context
  const authUser = useAuthStore.getState().user
  return {
    name: authUser?.companyName || authUser?.tenantName || 'AQUZIO ENTERPRISE',
    displayName: authUser?.companyName || authUser?.tenantName || 'AQUZIO ENTERPRISE'
  }
}

/**
 * Fetches the freshest company profile from the server and caches it.
 */
export const fetchGlobalCompanyProfileAsync = async (): Promise<PDFCompanyProfile> => {
  try {
    const res = await api.get('/api/v1/company/settings')
    if (res.data?.success && res.data?.data) {
      const data = res.data.data
      const profile: PDFCompanyProfile = {
        name: data.name,
        displayName: data.displayName || data.name,
        legalName: data.name,
        email: data.email,
        phone: data.phone,
        gstNumber: data.gstNumber,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        pincode: data.pincode || data.postalCode,
        logoUrl: data.logoUrl,
        currency: data.currency
      }
      _cachedCompanyProfile = profile
      try {
        localStorage.setItem('aquzio_company_profile', JSON.stringify(profile))
      } catch {}
      return profile
    }
  } catch (err) {
    console.warn('[CompanyPdfHeader] Failed to fetch company profile from API, using cached state:', err)
  }

  return getGlobalCompanyProfileSync()
}

/**
 * GLOBAL STANDARD PDF HEADER RENDERER
 * 
 * Draws the standardized two-column enterprise header:
 * - LEFT: Company Name (Prominent bold uppercase) + Formatted Company Address (wrapped with 0 overlap)
 * - RIGHT: Document Title + Metadata lines (Report No, Date, Period, etc.)
 * - BOTTOM: Subtle divider line
 */
export const drawCompanyPdfHeader = (
  pdf: jsPDF,
  options: CompanyHeaderOptions
): { nextY: number; headerHeight: number } => {
  const {
    company,
    docTitle,
    docNumber,
    docDate,
    metaLines = [],
    startX = 14,
    startY = 14,
    contentWidth = 182,
    rightMarginX = 196,
    titleColor = [30, 58, 138], // Navy
    showDivider = true,
    maxAddressWidth = 105,
    subtitle
  } = options

  const resolvedCompany = getGlobalCompanyProfileSync(company)

  // 1. Resolve Company Name
  const rawName = resolvedCompany.displayName || resolvedCompany.name || resolvedCompany.companyName || 'AQUZIO ENTERPRISE'
  const companyName = rawName.toUpperCase().trim()

  // 2. Resolve Formatted Address
  const cleanAddress = formatCompanyAddress(resolvedCompany)

  // Colors
  const C_DARK = [15, 23, 42] // slate-900
  const C_MUTED = [100, 116, 139] // slate-500
  const C_LINE = [203, 213, 225] // slate-300

  // -------------------------------------------------------------
  // LEFT COLUMN: COMPANY NAME + ADDRESS
  // -------------------------------------------------------------
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13.5)
  pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
  pdf.text(companyName, startX, startY + 4)

  let leftY = startY + 8.5

  if (subtitle && isValidString(subtitle)) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
    pdf.text(subtitle, startX, leftY)
    leftY += 3.8
  }

  if (cleanAddress) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
    const addrLines = pdf.splitTextToSize(cleanAddress, maxAddressWidth)
    pdf.text(addrLines, startX, leftY)
    leftY += (addrLines.length * 3.8)
  }

  // -------------------------------------------------------------
  // RIGHT COLUMN: DOCUMENT TITLE & METADATA
  // -------------------------------------------------------------
  const textRight = (text: string, x: number, currentY: number) => {
    const textWidth = pdf.getTextWidth(text)
    pdf.text(text, x - textWidth, currentY)
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12.5)
  pdf.setTextColor(titleColor[0], titleColor[1], titleColor[2])
  textRight(docTitle.toUpperCase(), rightMarginX, startY + 4)

  let rightY = startY + 8.5

  if (docNumber && isValidString(docNumber)) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2])
    textRight(docNumber, rightMarginX, rightY)
    rightY += 4.5
  }

  if (docDate && isValidString(docDate)) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
    textRight(docDate, rightMarginX, rightY)
    rightY += 4
  }

  metaLines.forEach(line => {
    if (isValidString(line)) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
      textRight(line, rightMarginX, rightY)
      rightY += 3.8
    }
  })

  // Calculate bottom of header
  const maxY = Math.max(leftY, rightY) + 2

  // Divider Line
  if (showDivider) {
    pdf.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2])
    pdf.setLineWidth(0.4)
    pdf.line(startX, maxY, rightMarginX, maxY)
  }

  const nextY = maxY + 5
  return {
    nextY,
    headerHeight: nextY - startY
  }
}

/**
 * GLOBAL STANDARD CONTINUATION HEADER (PAGE 2+)
 */
export const drawCompanyPdfContinuationHeader = (
  pdf: jsPDF,
  options: ContinuationHeaderOptions
): number => {
  const {
    company,
    docTitle,
    docNumber,
    metaText,
    startX = 14,
    startY = 12,
    rightMarginX = 196
  } = options

  const resolvedCompany = getGlobalCompanyProfileSync(company)
  const rawName = resolvedCompany.displayName || resolvedCompany.name || 'AQUZIO ENTERPRISE'
  const companyName = rawName.toUpperCase().trim()

  const C_DARK = [15, 23, 42]
  const C_NAVY = [30, 58, 138]
  const C_MUTED = [100, 116, 139]
  const C_LINE = [226, 232, 240]

  const textRight = (text: string, x: number, currentY: number) => {
    const textWidth = pdf.getTextWidth(text)
    pdf.text(text, x - textWidth, currentY)
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8.5)
  pdf.setTextColor(C_NAVY[0], C_NAVY[1], C_NAVY[2])
  pdf.text(companyName, startX, startY)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2])
  const rightLabel = docNumber ? `${docTitle} — ${docNumber}` : (metaText || docTitle)
  textRight(rightLabel, rightMarginX, startY)

  pdf.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2])
  pdf.setLineWidth(0.3)
  pdf.line(startX, startY + 3.5, rightMarginX, startY + 3.5)

  return startY + 8
}
