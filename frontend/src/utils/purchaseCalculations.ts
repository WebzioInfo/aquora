// ========================================================
// AUTHORITATIVE PURCHASE CALCULATION ENGINE (FRONTEND)
// Parity with Aquora.Application.Services.PurchaseService
// ========================================================

export type TaxMode = 'GST' | 'NonGST'

export interface PurchaseCalculationInput {
  subTotal: number
  discountAmount: number
  otherCharges: number
  taxMode: TaxMode
  gstRate: number
  isInclusiveTax: boolean
  isGstOverridden: boolean
  manualTaxAmount?: number
  isInterState: boolean
  amountPaid: number
  paymentMethod: string
}

export interface PurchaseCalculationResult {
  subTotal: number
  discountAmount: number
  otherCharges: number
  taxableAmount: number
  taxMode: TaxMode
  gstRate: number
  calculatedGst: number
  finalGst: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  isGstOverridden: boolean
  isInclusiveTax: boolean
  isInterState: boolean
  grandTotal: number
  amountPaid: number
  balanceAmount: number
  paymentStatus: 'Paid' | 'PartiallyPaid' | 'Unpaid'
}

/** Round to 2 decimal places with financial precision */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

/**
 * Authoritative Purchase Calculation Engine
 * Matches C# CalculatePurchaseTotals exactly.
 */
export function calculatePurchaseTotals(input: PurchaseCalculationInput): PurchaseCalculationResult {
  const cleanSubTotal = Math.max(0, round2(input.subTotal || 0))
  const cleanDiscount = Math.max(0, round2(input.discountAmount || 0))
  const cleanCharges = Math.max(0, round2(input.otherCharges || 0))
  const cleanRate = Math.max(0, round2(input.gstRate || 0))
  const cleanMode: TaxMode = input.taxMode === 'NonGST' ? 'NonGST' : 'GST'
  const isInclusive = Boolean(input.isInclusiveTax)
  const isInterState = Boolean(input.isInterState)
  const isOverridden = Boolean(input.isGstOverridden)
  const manualTax = Math.max(0, round2(input.manualTaxAmount || 0))

  let taxableAmount = 0
  let calculatedGst = 0
  let finalGst = 0
  let grandTotal = 0

  if (cleanMode === 'NonGST' || cleanRate === 0) {
    taxableAmount = Math.max(0, round2(cleanSubTotal - cleanDiscount + cleanCharges))
    calculatedGst = 0
    finalGst = 0
    grandTotal = taxableAmount
  } else if (!isInclusive) {
    // GST Exclusive: Taxable = SubTotal - Discount + OtherCharges
    taxableAmount = Math.max(0, round2(cleanSubTotal - cleanDiscount + cleanCharges))
    calculatedGst = round2(taxableAmount * (cleanRate / 100))
    finalGst = isOverridden ? manualTax : calculatedGst
    grandTotal = Math.max(0, round2(taxableAmount + finalGst))
  } else {
    // GST Inclusive: Total with Tax = SubTotal - Discount + OtherCharges
    const totalInclusive = Math.max(0, round2(cleanSubTotal - cleanDiscount + cleanCharges))
    taxableAmount = round2(totalInclusive / (1 + cleanRate / 100))
    calculatedGst = Math.max(0, round2(totalInclusive - taxableAmount))
    if (isOverridden) {
      finalGst = manualTax
      grandTotal = Math.max(0, round2(taxableAmount + finalGst))
    } else {
      finalGst = calculatedGst
      grandTotal = totalInclusive
    }
  }

  let cgstAmount = 0
  let sgstAmount = 0
  let igstAmount = 0

  if (cleanMode === 'GST' && finalGst > 0) {
    if (isInterState) {
      igstAmount = finalGst
      cgstAmount = 0
      sgstAmount = 0
    } else {
      cgstAmount = round2(finalGst / 2)
      sgstAmount = round2(finalGst - cgstAmount) // Exact balanced penny preservation
      igstAmount = 0
    }
  }

  let cleanPaid = Math.max(0, round2(input.amountPaid || 0))
  if (input.paymentMethod === 'Credit') {
    cleanPaid = 0
  } else if (cleanPaid > grandTotal) {
    cleanPaid = grandTotal
  }

  const balanceAmount = Math.max(0, round2(grandTotal - cleanPaid))

  let paymentStatus: 'Paid' | 'PartiallyPaid' | 'Unpaid' = 'Unpaid'
  if (cleanPaid >= grandTotal && grandTotal > 0) {
    paymentStatus = 'Paid'
  } else if (cleanPaid > 0) {
    paymentStatus = 'PartiallyPaid'
  }

  return {
    subTotal: cleanSubTotal,
    discountAmount: cleanDiscount,
    otherCharges: cleanCharges,
    taxableAmount,
    taxMode: cleanMode,
    gstRate: cleanRate,
    calculatedGst,
    finalGst,
    cgstAmount,
    sgstAmount,
    igstAmount,
    isGstOverridden: isOverridden,
    isInclusiveTax: isInclusive,
    isInterState,
    grandTotal,
    amountPaid: cleanPaid,
    balanceAmount,
    paymentStatus
  }
}
