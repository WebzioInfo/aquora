import { jsPDF } from 'jspdf'
import type { BusinessReportDto } from '../services/api/reports'

export const generateBusinessReportPDF = (report: BusinessReportDto): jsPDF => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const margin = 14
  const contentWidth = 210 - (margin * 2) // 182mm
  const rightMarginX = 210 - margin // 196mm
  const pageHeight = 297
  const bottomMargin = 18

  const currSym = report.company?.currencySymbol || 'INR '

  const formatNumber = (num: number | undefined | null, decimals = 0): string => {
    if (num === undefined || num === null) return '0'
    return Number(num).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
  }

  const formatCurrency = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return `${currSym}0`
    return `${currSym}${Number(num).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const textRight = (text: string, x: number, y: number) => {
    const textWidth = pdf.getTextWidth(text)
    pdf.text(text, x - textWidth, y)
  }

  const drawPageHeader = (title: string, subtitle?: string) => {
    // 1. Company Name Left
    const companyName = (
      report.company.displayName ||
      report.company.name ||
      'AQUZIO ENTERPRISE'
    ).toUpperCase()

    pdf.setTextColor(15, 23, 42) // slate-900
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text(companyName, margin, margin + 2)

    // 2. Company Address / Contacts if available
    const addressParts: string[] = []
    if (report.company.address && report.company.address.trim() && !['null', 'undefined'].includes(report.company.address.toLowerCase())) {
      addressParts.push(report.company.address.trim())
    }
    if (report.company.phone && !['null', 'undefined'].includes(report.company.phone.toLowerCase())) {
      addressParts.push(`Ph: ${report.company.phone}`)
    }
    if (report.company.email && !['null', 'undefined'].includes(report.company.email.toLowerCase())) {
      addressParts.push(`Email: ${report.company.email}`)
    }
    if (report.company.gstNumber && !['null', 'undefined'].includes(report.company.gstNumber.toLowerCase())) {
      addressParts.push(`GST: ${report.company.gstNumber}`)
    }

    let nextY = margin + 6
    if (addressParts.length > 0) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.setTextColor(100, 116, 139) // slate-500
      const addressLine = addressParts.slice(0, 2).join(' • ')
      const splitAddr = pdf.splitTextToSize(addressLine, 110)
      pdf.text(splitAddr[0], margin, nextY)
      nextY += 4
    }

    // 3. Document Title on Right
    pdf.setTextColor(37, 99, 235) // blue-600
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    textRight(title.toUpperCase(), rightMarginX, margin + 2)

    // 4. Metadata details on Right
    pdf.setTextColor(100, 116, 139)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    textRight(`Period: ${report.period.formattedRange}`, rightMarginX, margin + 6)
    if (subtitle) {
      textRight(subtitle, rightMarginX, margin + 10)
    }

    // 5. Divider Line
    const lineY = Math.max(nextY + 1, margin + 12)
    pdf.setDrawColor(226, 232, 240) // slate-200
    pdf.setLineWidth(0.35)
    pdf.line(margin, lineY, rightMarginX, lineY)

    return lineY + 5
  }

  let y = drawPageHeader('BUSINESS REPORT', `Generated: ${report.period.generatedAtLocal}`)

  const checkPageBreak = (neededHeight: number, sectionTitle: string): boolean => {
    if (y + neededHeight > pageHeight - bottomMargin) {
      pdf.addPage()
      y = drawPageHeader(sectionTitle, `Period: ${report.period.formattedRange}`)
      return true
    }
    return false
  }

  const renderSectionHeader = (title: string, iconNumber?: string) => {
    checkPageBreak(16, title)
    pdf.setFillColor(241, 245, 249) // slate-100
    pdf.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'F')
    pdf.setDrawColor(203, 213, 225) // slate-300
    pdf.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'S')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(30, 41, 59) // slate-800
    const label = iconNumber ? `${iconNumber}. ${title.toUpperCase()}` : title.toUpperCase()
    pdf.text(label, margin + 4, y + 4.8)

    y += 10
  }

  const renderEmptySection = (message: string) => {
    checkPageBreak(12, 'BUSINESS REPORT')
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(8)
    pdf.setTextColor(148, 163, 184)
    pdf.text(`• ${message}`, margin + 4, y + 2)
    y += 8
  }

  // ==========================================
  // SECTION 1: EXECUTIVE SUMMARY KPIS (PAGE 1)
  // ==========================================
  renderSectionHeader('Executive Summary & Operational KPI Overview', '1')

  const kpis = [
    { label: 'Total Production', val: `${formatNumber(report.summary.totalCasesProduced)} Cases`, sub: `${report.summary.totalBatchesCount} Batches (${report.summary.completedBatchesCount} Done)` },
    { label: 'Gross Sales Revenue', val: formatCurrency(report.summary.totalSalesRevenue), sub: `${formatNumber(report.summary.totalSalesQuantity)} Cases Billed` },
    { label: 'Dispatches Delivered', val: `${formatNumber(report.summary.totalDispatchedQuantity)} Cases`, sub: `${report.summary.totalDispatchesCount} Dispatches (${report.summary.uniqueVehiclesCount} Vehicles)` },
    { label: 'Customer Returns', val: `${formatNumber(report.summary.totalReturnedQuantity)} Cases`, sub: `${formatCurrency(report.summary.totalReturnedAmount)} Total Value` },
    { label: 'Damages / Wastage', val: `${formatNumber(report.summary.totalDamagedQuantity)} Cases`, sub: `${formatCurrency(report.summary.totalDamageCost)} Estimated Cost` },
    { label: 'Net Sales Realized', val: formatCurrency(report.summary.netSalesRevenue), sub: `${formatNumber(report.summary.netSalesQuantity)} Net Cases Realized` },
    { label: 'Operating Expenses', val: formatCurrency(report.summary.totalOperatingExpenses), sub: 'General & Plant Expenses' },
    { label: 'Material Purchases', val: formatCurrency(report.summary.totalPurchasesAmount), sub: 'Raw Materials & Supplies' },
    { label: 'Salaries & Payroll', val: formatCurrency(report.summary.totalSalariesPaid), sub: 'Direct Labor Disbursed' },
  ]

  const cardW = (contentWidth - 6) / 3 // 3 columns
  const cardH = 14

  for (let i = 0; i < kpis.length; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const cx = margin + (col * (cardW + 3))
    const cy = y + (row * (cardH + 2.5))

    pdf.setFillColor(248, 250, 252) // slate-50
    pdf.roundedRect(cx, cy, cardW, cardH, 1, 1, 'F')
    pdf.setDrawColor(226, 232, 240)
    pdf.roundedRect(cx, cy, cardW, cardH, 1, 1, 'S')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.5)
    pdf.setTextColor(100, 116, 139)
    pdf.text(kpis[i].label.toUpperCase(), cx + 3, cy + 3.8)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(15, 23, 42)
    pdf.text(kpis[i].val, cx + 3, cy + 8.2)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(100, 116, 139)
    pdf.text(kpis[i].sub, cx + 3, cy + 11.8)
  }

  y += (Math.ceil(kpis.length / 3) * (cardH + 2.5)) + 4

  // ==========================================
  // SECTION 2: PRODUCTION REPORT
  // ==========================================
  renderSectionHeader('Production Operations & Batch Execution', '2')

  if (report.production.batches.length === 0 && report.production.entries.length === 0) {
    renderEmptySection('No production batches or logs recorded during this period.')
  } else {
    // Production Batches Table
    const drawBatchesTableHeader = () => {
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, y, contentWidth, 5.5, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(71, 85, 105)

      pdf.text('Batch No', margin + 2, y + 3.8)
      pdf.text('Product / SKU', margin + 30, y + 3.8)
      pdf.text('Line / Shift', margin + 80, y + 3.8)
      pdf.text('Operator', margin + 115, y + 3.8)
      textRight('Target', margin + 150, y + 3.8)
      textRight('Produced', margin + 170, y + 3.8)
      textRight('Status', rightMarginX - 2, y + 3.8)
      y += 5.5
    }

    drawBatchesTableHeader()

    report.production.batches.forEach((b, idx) => {
      checkPageBreak(6, 'Production Report')
      if (idx % 2 === 1) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(margin, y, contentWidth, 5.5, 'F')
      }
      pdf.setDrawColor(241, 245, 249)
      pdf.line(margin, y + 5.5, rightMarginX, y + 5.5)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(15, 23, 42)
      pdf.text(b.batchNumber || '—', margin + 2, y + 3.8)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6.8)
      pdf.setTextColor(51, 65, 85)
      const pName = pdf.splitTextToSize(b.product || 'Standard Water', 48)
      pdf.text(pName[0], margin + 30, y + 3.8)

      pdf.text(`${b.productionLine} • ${b.shift || 'General'}`, margin + 80, y + 3.8)
      pdf.text(b.operatorName || '—', margin + 115, y + 3.8)

      textRight(formatNumber(b.targetQuantity), margin + 150, y + 3.8)
      pdf.setFont('helvetica', 'bold')
      textRight(formatNumber(b.producedQuantity), margin + 170, y + 3.8)
      pdf.setFont('helvetica', 'normal')
      textRight(b.status || 'Done', rightMarginX - 2, y + 3.8)

      y += 5.5
    })

    // Totals line for production
    checkPageBreak(7, 'Production Report')
    pdf.setFillColor(241, 245, 249)
    pdf.rect(margin, y, contentWidth, 6, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(15, 23, 42)
    pdf.text(`Total Batches: ${report.production.totalBatches} (${report.production.completedBatches} Completed)`, margin + 2, y + 4.2)
    textRight(`Total Cases: ${formatNumber(report.production.totalCasesProduced)} Cases`, rightMarginX - 2, y + 4.2)
    y += 8
  }

  // ==========================================
  // SECTION 3: SALES REPORT
  // ==========================================
  renderSectionHeader('Sales Orders & Revenue Realization', '3')

  if (report.sales.transactions.length === 0) {
    renderEmptySection('No sales orders recorded during this period.')
  } else {
    const drawSalesTableHeader = () => {
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, y, contentWidth, 5.5, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(71, 85, 105)

      pdf.text('Date / Order #', margin + 2, y + 3.8)
      pdf.text('Customer Name', margin + 35, y + 3.8)
      pdf.text('Product Item', margin + 85, y + 3.8)
      textRight('Cases', margin + 125, y + 3.8)
      textRight('Total Amount', margin + 155, y + 3.8)
      textRight('Received', margin + 175, y + 3.8)
      textRight('Status', rightMarginX - 2, y + 3.8)
      y += 5.5
    }

    drawSalesTableHeader()

    report.sales.transactions.forEach((s, idx) => {
      checkPageBreak(6, 'Sales Report')
      if (idx % 2 === 1) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(margin, y, contentWidth, 5.5, 'F')
      }
      pdf.setDrawColor(241, 245, 249)
      pdf.line(margin, y + 5.5, rightMarginX, y + 5.5)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6.8)
      pdf.setTextColor(15, 23, 42)
      pdf.text(s.transactionNumber || '—', margin + 2, y + 3.8)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6.8)
      pdf.setTextColor(51, 65, 85)
      const cName = pdf.splitTextToSize(s.customerName || 'Direct', 48)
      pdf.text(cName[0], margin + 35, y + 3.8)

      const pName = pdf.splitTextToSize(s.productName || 'Water', 38)
      pdf.text(pName[0], margin + 85, y + 3.8)

      textRight(formatNumber(s.cases), margin + 125, y + 3.8)
      pdf.setFont('helvetica', 'bold')
      textRight(formatCurrency(s.totalAmount), margin + 155, y + 3.8)
      pdf.setFont('helvetica', 'normal')
      textRight(formatCurrency(s.amountReceived), margin + 175, y + 3.8)
      textRight(s.paymentStatus || s.status || 'Paid', rightMarginX - 2, y + 3.8)

      y += 5.5
    })

    // Totals line for sales
    checkPageBreak(7, 'Sales Report')
    pdf.setFillColor(241, 245, 249)
    pdf.rect(margin, y, contentWidth, 6, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(15, 23, 42)
    pdf.text(`Total Orders: ${report.sales.totalTransactions} | Total Cases: ${formatNumber(report.sales.totalQuantity)}`, margin + 2, y + 4.2)
    textRight(`Gross: ${formatCurrency(report.sales.totalGrossAmount)} | Recv: ${formatCurrency(report.sales.totalReceived)} | Bal: ${formatCurrency(report.sales.totalOutstanding)}`, rightMarginX - 2, y + 4.2)
    y += 8
  }

  // ==========================================
  // SECTION 4: DISPATCH REPORT
  // ==========================================
  renderSectionHeader('Product Dispatches & Vehicle Logistics', '4')

  if (report.dispatch.dispatches.length === 0) {
    renderEmptySection('No dispatches recorded during this period.')
  } else {
    const drawDispatchTableHeader = () => {
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, y, contentWidth, 5.5, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(71, 85, 105)

      pdf.text('Dispatch #', margin + 2, y + 3.8)
      pdf.text('Destination / Customer', margin + 30, y + 3.8)
      pdf.text('Product Loaded', margin + 85, y + 3.8)
      textRight('Quantity', margin + 130, y + 3.8)
      pdf.text('Vehicle #', margin + 140, y + 3.8)
      pdf.text('Driver / Crew', margin + 165, y + 3.8)
      y += 5.5
    }

    drawDispatchTableHeader()

    report.dispatch.dispatches.forEach((d, idx) => {
      checkPageBreak(6, 'Dispatch Report')
      if (idx % 2 === 1) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(margin, y, contentWidth, 5.5, 'F')
      }
      pdf.setDrawColor(241, 245, 249)
      pdf.line(margin, y + 5.5, rightMarginX, y + 5.5)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6.8)
      pdf.setTextColor(15, 23, 42)
      pdf.text(d.dispatchNumber || '—', margin + 2, y + 3.8)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6.8)
      pdf.setTextColor(51, 65, 85)
      const cName = pdf.splitTextToSize(d.customerName || 'Direct', 52)
      pdf.text(cName[0], margin + 30, y + 3.8)

      const pName = pdf.splitTextToSize(d.productName || 'Water', 42)
      pdf.text(pName[0], margin + 85, y + 3.8)

      pdf.setFont('helvetica', 'bold')
      textRight(formatNumber(d.quantity), margin + 130, y + 3.8)
      pdf.setFont('helvetica', 'normal')
      pdf.text(d.vehicleNumber || '—', margin + 140, y + 3.8)
      pdf.text(d.driverOrLoadedBy || '—', margin + 165, y + 3.8)

      y += 5.5
    })

    // Totals line for dispatches
    checkPageBreak(7, 'Dispatch Report')
    pdf.setFillColor(241, 245, 249)
    pdf.rect(margin, y, contentWidth, 6, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(15, 23, 42)
    pdf.text(`Dispatches Count: ${report.dispatch.totalDispatches} | Vehicles: ${report.dispatch.uniqueVehicles}`, margin + 2, y + 4.2)
    textRight(`Total Dispatched: ${formatNumber(report.dispatch.totalDispatchedQuantity)} Cases`, rightMarginX - 2, y + 4.2)
    y += 8
  }

  // ==========================================
  // SECTION 5: RETURNS & DAMAGES REPORT
  // ==========================================
  renderSectionHeader('Customer Returns & Goods Damage Summary', '5')

  if (report.returns.returns.length === 0 && report.damages.damages.length === 0) {
    renderEmptySection('No customer returns or damage claims recorded during this period.')
  } else {
    // Summary line for Returns & Damages
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(15, 23, 42)
    pdf.text(`Returns: ${report.returns.totalReturnsCount} records (${formatNumber(report.returns.totalReturnedQuantity)} Cases, ${formatCurrency(report.returns.totalReturnedAmount)})  |  Damages: ${report.damages.totalDamagesCount} records (${formatNumber(report.damages.totalDamagedQuantity)} Cases, ${formatCurrency(report.damages.totalDamageCost)})`, margin + 2, y + 1)
    y += 5

    // Reason Breakdown Table
    if (report.returns.reasonBreakdown.length > 0 || report.damages.reasonBreakdown.length > 0) {
      pdf.setFillColor(248, 250, 252)
      pdf.rect(margin, y, contentWidth, 5, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6.8)
      pdf.setTextColor(71, 85, 105)
      pdf.text('Category / Reason', margin + 2, y + 3.5)
      pdf.text('Log Type', margin + 90, y + 3.5)
      textRight('Records Count', margin + 140, y + 3.5)
      textRight('Total Quantity', rightMarginX - 2, y + 3.5)
      y += 5

      report.returns.reasonBreakdown.forEach((rb) => {
        checkPageBreak(5.5, 'Returns & Damages Report')
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(6.8)
        pdf.setTextColor(51, 65, 85)
        pdf.text(rb.reason || 'General Return', margin + 2, y + 3.5)
        pdf.text('Customer Return', margin + 90, y + 3.5)
        textRight(String(rb.count), margin + 140, y + 3.5)
        textRight(`${formatNumber(rb.totalQuantity)} Cases`, rightMarginX - 2, y + 3.5)
        y += 5
      })

      report.damages.reasonBreakdown.forEach((db) => {
        checkPageBreak(5.5, 'Returns & Damages Report')
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(6.8)
        pdf.setTextColor(51, 65, 85)
        pdf.text(db.reason || 'Transit Damage', margin + 2, y + 3.5)
        pdf.text('Damage / Spoilage', margin + 90, y + 3.5)
        textRight(String(db.count), margin + 140, y + 3.5)
        textRight(`${formatNumber(db.totalQuantity)} Cases`, rightMarginX - 2, y + 3.5)
        y += 5
      })
      y += 4
    }
  }

  // ==========================================
  // SECTION 6: CUSTOMER PERFORMANCE
  // ==========================================
  renderSectionHeader('Customer Account & Sales Volume Performance', '6')

  if (report.customers.customers.length === 0) {
    renderEmptySection('No customer performance data available for this period.')
  } else {
    const drawCustomerTableHeader = () => {
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, y, contentWidth, 5.5, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(71, 85, 105)

      pdf.text('Customer Account', margin + 2, y + 3.8)
      pdf.text('Type', margin + 50, y + 3.8)
      textRight('Orders', margin + 75, y + 3.8)
      textRight('Dispatched', margin + 105, y + 3.8)
      textRight('Returned', margin + 130, y + 3.8)
      textRight('Net Cases', margin + 155, y + 3.8)
      textRight('Total Sales', rightMarginX - 2, y + 3.8)
      y += 5.5
    }

    drawCustomerTableHeader()

    report.customers.customers.forEach((c, idx) => {
      checkPageBreak(6, 'Customer Report')
      if (idx % 2 === 1) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(margin, y, contentWidth, 5.5, 'F')
      }
      pdf.setDrawColor(241, 245, 249)
      pdf.line(margin, y + 5.5, rightMarginX, y + 5.5)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6.8)
      pdf.setTextColor(15, 23, 42)
      const cName = pdf.splitTextToSize(c.customerName || '—', 46)
      pdf.text(cName[0], margin + 2, y + 3.8)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6.8)
      pdf.setTextColor(51, 65, 85)
      pdf.text(c.customerType || 'Wholesale', margin + 50, y + 3.8)
      textRight(String(c.ordersCount), margin + 75, y + 3.8)
      textRight(formatNumber(c.totalDispatchedCases), margin + 105, y + 3.8)
      textRight(formatNumber(c.totalReturnedCases), margin + 130, y + 3.8)
      pdf.setFont('helvetica', 'bold')
      textRight(formatNumber(c.netCases), margin + 155, y + 3.8)
      textRight(formatCurrency(c.totalSalesValue), rightMarginX - 2, y + 3.8)

      y += 5.5
    })

    // Customer totals
    checkPageBreak(7, 'Customer Report')
    pdf.setFillColor(241, 245, 249)
    pdf.rect(margin, y, contentWidth, 6, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(15, 23, 42)
    pdf.text(`Active Buyers: ${report.customers.totalActiveCustomers}`, margin + 2, y + 4.2)
    textRight(`Net Volume: ${formatNumber(report.customers.totalNetQuantity)} Cases  |  Total Value: ${formatCurrency(report.customers.totalPurchasedValue)}`, rightMarginX - 2, y + 4.2)
    y += 8
  }

  // ==========================================
  // SECTION 7: INVENTORY & STOCK MOVEMENT
  // ==========================================
  renderSectionHeader('Finished Products Stock Movement & Raw Materials', '7')

  if (report.inventory.productMovements.length === 0 && report.inventory.rawMaterials.length === 0) {
    renderEmptySection('No inventory stock movement logged for this period.')
  } else {
    // Finished Products Table
    if (report.inventory.productMovements.length > 0) {
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, y, contentWidth, 5.5, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(71, 85, 105)

      pdf.text('Product Name / SKU', margin + 2, y + 3.8)
      textRight('Current Stock', margin + 70, y + 3.8)
      textRight('+ Produced', margin + 100, y + 3.8)
      textRight('- Dispatched', margin + 130, y + 3.8)
      textRight('+ Returned', margin + 160, y + 3.8)
      textRight('Net Period Movement', rightMarginX - 2, y + 3.8)
      y += 5.5

      report.inventory.productMovements.forEach((p, idx) => {
        checkPageBreak(6, 'Inventory Report')
        if (idx % 2 === 1) {
          pdf.setFillColor(250, 250, 250)
          pdf.rect(margin, y, contentWidth, 5.5, 'F')
        }
        pdf.setDrawColor(241, 245, 249)
        pdf.line(margin, y + 5.5, rightMarginX, y + 5.5)

        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(6.8)
        pdf.setTextColor(15, 23, 42)
        const pName = pdf.splitTextToSize(p.productName || '—', 50)
        pdf.text(pName[0], margin + 2, y + 3.8)

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(6.8)
        pdf.setTextColor(51, 65, 85)
        textRight(formatNumber(p.currentStock), margin + 70, y + 3.8)
        textRight(formatNumber(p.producedInPeriod), margin + 100, y + 3.8)
        textRight(formatNumber(p.dispatchedInPeriod), margin + 130, y + 3.8)
        textRight(formatNumber(p.returnedInPeriod), margin + 160, y + 3.8)

        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(p.netMovementInPeriod >= 0 ? 22 : 220, p.netMovementInPeriod >= 0 ? 101 : 38, p.netMovementInPeriod >= 0 ? 52 : 38)
        textRight(`${p.netMovementInPeriod >= 0 ? '+' : ''}${formatNumber(p.netMovementInPeriod)}`, rightMarginX - 2, y + 3.8)

        y += 5.5
      })
      y += 4
    }

    // Raw Materials Consumption & Wastage
    if (report.inventory.rawMaterials.length > 0) {
      checkPageBreak(15, 'Inventory Report')
      pdf.setFillColor(248, 250, 252)
      pdf.rect(margin, y, contentWidth, 5.5, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(71, 85, 105)

      pdf.text('Raw Material', margin + 2, y + 3.8)
      pdf.text('Category / Unit', margin + 55, y + 3.8)
      textRight('Current Stock', margin + 110, y + 3.8)
      textRight('Consumed', margin + 145, y + 3.8)
      textRight('Period Wastage', rightMarginX - 2, y + 3.8)
      y += 5.5

      report.inventory.rawMaterials.forEach((r, idx) => {
        checkPageBreak(6, 'Inventory Report')
        if (idx % 2 === 1) {
          pdf.setFillColor(250, 250, 250)
          pdf.rect(margin, y, contentWidth, 5.5, 'F')
        }
        pdf.setDrawColor(241, 245, 249)
        pdf.line(margin, y + 5.5, rightMarginX, y + 5.5)

        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(6.8)
        pdf.setTextColor(15, 23, 42)
        pdf.text(r.materialName || '—', margin + 2, y + 3.8)

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(6.8)
        pdf.setTextColor(51, 65, 85)
        pdf.text(`${r.category} (${r.unit || 'PCS'})`, margin + 55, y + 3.8)
        textRight(formatNumber(r.currentStock), margin + 110, y + 3.8)
        textRight(formatNumber(r.consumedInPeriod), margin + 145, y + 3.8)
        textRight(formatNumber(r.wastageInPeriod), rightMarginX - 2, y + 3.8)

        y += 5.5
      })
      y += 6
    }
  }

  // ==========================================
  // SECTION 8: ACCOUNTS & FINANCIAL DETAILS
  // ==========================================
  renderSectionHeader('Accounts, Operating Expenses & Vendor Purchases', '8')

  if (report.financials.expenseCategories.length === 0 && report.financials.recentPurchases.length === 0) {
    renderEmptySection('No financial expenses or supplier purchase records logged during this period.')
  } else {
    // Summary
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(15, 23, 42)
    pdf.text(`Operating Expenses: ${formatCurrency(report.financials.totalOperatingExpenses)}  |  Purchases: ${formatCurrency(report.financials.totalMaterialPurchases)} (Paid: ${formatCurrency(report.financials.totalPurchasesPaid)}, Due: ${formatCurrency(report.financials.totalPurchasesOutstanding)})  |  Salaries: ${formatCurrency(report.financials.totalSalariesPaid)}`, margin + 2, y + 1)
    y += 5

    // Operating Expenses by Category
    if (report.financials.expenseCategories.length > 0) {
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, y, contentWidth, 5.5, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(71, 85, 105)
      pdf.text('Expense Category', margin + 2, y + 3.8)
      textRight('Transactions Count', margin + 100, y + 3.8)
      textRight('Total Amount Expensed', rightMarginX - 2, y + 3.8)
      y += 5.5

      report.financials.expenseCategories.forEach((exp) => {
        checkPageBreak(5.5, 'Financial Report')
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(6.8)
        pdf.setTextColor(51, 65, 85)
        pdf.text(exp.category, margin + 2, y + 3.5)
        textRight(String(exp.count), margin + 100, y + 3.5)
        pdf.setFont('helvetica', 'bold')
        textRight(formatCurrency(exp.totalAmount), rightMarginX - 2, y + 3.5)
        y += 5.5
      })
      y += 4
    }

    // Recent Purchases Table
    if (report.financials.recentPurchases.length > 0) {
      checkPageBreak(15, 'Financial Report')
      pdf.setFillColor(248, 250, 252)
      pdf.rect(margin, y, contentWidth, 5.5, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(71, 85, 105)

      pdf.text('Purchase #', margin + 2, y + 3.8)
      pdf.text('Supplier / Vendor', margin + 35, y + 3.8)
      textRight('Grand Total', margin + 115, y + 3.8)
      textRight('Amount Paid', margin + 145, y + 3.8)
      textRight('Balance Due', margin + 175, y + 3.8)
      textRight('Status', rightMarginX - 2, y + 3.8)
      y += 5.5

      report.financials.recentPurchases.forEach((pur, idx) => {
        checkPageBreak(6, 'Financial Report')
        if (idx % 2 === 1) {
          pdf.setFillColor(250, 250, 250)
          pdf.rect(margin, y, contentWidth, 5.5, 'F')
        }
        pdf.setDrawColor(241, 245, 249)
        pdf.line(margin, y + 5.5, rightMarginX, y + 5.5)

        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(6.8)
        pdf.setTextColor(15, 23, 42)
        pdf.text(pur.purchaseNumber || '—', margin + 2, y + 3.8)

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(6.8)
        pdf.setTextColor(51, 65, 85)
        const vName = pdf.splitTextToSize(pur.vendorName || 'Supplier', 48)
        pdf.text(vName[0], margin + 35, y + 3.8)

        textRight(formatCurrency(pur.totalAmount), margin + 115, y + 3.8)
        textRight(formatCurrency(pur.paidAmount), margin + 145, y + 3.8)
        textRight(formatCurrency(pur.balanceAmount), margin + 175, y + 3.8)
        textRight(pur.status || 'Paid', rightMarginX - 2, y + 3.8)

        y += 5.5
      })
      y += 6
    }
  }

  // ==========================================
  // SECTION 9: QUALITY CONTROL (QC)
  // ==========================================
  renderSectionHeader('Quality Control & Water Test Compliance', '9')

  if (report.qualityControl.recentTests.length === 0) {
    renderEmptySection('No quality control water tests recorded during this period.')
  } else {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(15, 23, 42)
    pdf.text(`Total Tests: ${report.qualityControl.totalTestsConducted}  |  Passed: ${report.qualityControl.totalPassed}  |  Failed: ${report.qualityControl.totalFailed}  |  Under Incubation / Draft: ${report.qualityControl.totalUnderIncubation}`, margin + 2, y + 1)
    y += 5

    pdf.setFillColor(241, 245, 249)
    pdf.rect(margin, y, contentWidth, 5.5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(71, 85, 105)

    pdf.text('Report / Sample #', margin + 2, y + 3.8)
    pdf.text('Sample Type', margin + 45, y + 3.8)
    pdf.text('Batch Link', margin + 85, y + 3.8)
    pdf.text('Tested By', margin + 125, y + 3.8)
    textRight('Compliance Status', rightMarginX - 2, y + 3.8)
    y += 5.5

    report.qualityControl.recentTests.forEach((t, idx) => {
      checkPageBreak(6, 'Quality Control Report')
      if (idx % 2 === 1) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(margin, y, contentWidth, 5.5, 'F')
      }
      pdf.setDrawColor(241, 245, 249)
      pdf.line(margin, y + 5.5, rightMarginX, y + 5.5)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6.8)
      pdf.setTextColor(15, 23, 42)
      pdf.text(t.reportNumber || '—', margin + 2, y + 3.8)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6.8)
      pdf.setTextColor(51, 65, 85)
      pdf.text(t.sampleSource || 'DAILY', margin + 45, y + 3.8)
      pdf.text(t.batchNumber || '—', margin + 85, y + 3.8)
      pdf.text(t.testedBy || 'QC Chemist', margin + 125, y + 3.8)

      pdf.setFont('helvetica', 'bold')
      const isPassed = t.overallStatus.toLowerCase().includes('pass') || t.overallStatus.toLowerCase().includes('approve')
      const isFailed = t.overallStatus.toLowerCase().includes('fail') || t.overallStatus.toLowerCase().includes('reject')
      pdf.setTextColor(isPassed ? 22 : (isFailed ? 220 : 180), isPassed ? 101 : (isFailed ? 38 : 100), isPassed ? 52 : (isFailed ? 38 : 20))
      textRight(t.overallStatus || 'APPROVED', rightMarginX - 2, y + 3.8)

      y += 5.5
    })
    y += 6
  }

  // ==========================================
  // DYNAMIC PAGE NUMBERING & OFFICIAL FOOTER
  // ==========================================
  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)

    // Footer divider line
    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.35)
    pdf.line(margin, pageHeight - 12, rightMarginX, pageHeight - 12)

    // Left Footer Details
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(148, 163, 184) // slate-400

    const systemText = 'Generated by Aquzio ERP • Developed by Webzio Technology'
    const compGeneratedText = 'This is an official computer-generated business report produced from authenticated ledgers.'
    pdf.text(systemText, margin, pageHeight - 8.5)
    pdf.text(compGeneratedText, margin, pageHeight - 5.5)

    // Right Footer Details
    const dateText = `Period: ${report.period.formattedRange}`
    textRight(dateText, rightMarginX, pageHeight - 8.5)
    textRight(`Page ${i} of ${totalPages}`, rightMarginX, pageHeight - 5.5)
  }

  return pdf
}
