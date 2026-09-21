import { jsPDF } from 'jspdf'
import {
  drawCompanyPdfHeader,
  drawCompanyPdfContinuationHeader
} from './companyPdfHeader'
import type { PDFCompanyProfile } from './companyPdfHeader'

export type PDFCompanyInfo = PDFCompanyProfile

export interface PDFDocumentOptions {
  title: string;
  docNumber: string;
  date: string;
  companyInfo: PDFCompanyInfo;
  partyLabel: string;
  partyInfo: {
    name: string;
    details1?: string;
    details2?: string;
  };
  preparedBy?: string;
  paymentDetails?: {
    method?: string;
    reference?: string;
    status?: string;
  };
  items: {
    sno: number;
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount: number;
  }[];
  financialSummary: {
    subTotal?: number;
    taxAmount?: number;
    discountAmount?: number;
    grandTotal: number;
    amountPaid?: number;
    balance?: number;
  };
  notes?: string;
  remarks?: string;
}

export const generateERPDocumentPDF = (options: PDFDocumentOptions): jsPDF => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 15;
  const contentWidth = 210 - (margin * 2); // 180mm
  const rightMarginX = 210 - margin; // 195mm
  const pageHeight = 297;
  const bottomMargin = 20;

  // Helpers
  const textRight = (text: string, x: number, y: number) => {
    const textWidth = pdf.getTextWidth(text);
    pdf.text(text, x - textWidth, y);
  };

  const getInitials = (name: string): string => {
    if (!name) return 'CB';
    return name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const drawPageHeader = (pageNum: number) => {
    if (pageNum === 1) {
      const headerRes = drawCompanyPdfHeader(pdf, {
        company: options.companyInfo,
        docTitle: options.title,
        docNumber: options.docNumber ? `Doc No: ${options.docNumber}` : undefined,
        docDate: options.date ? `Date: ${options.date}` : undefined,
        metaLines: options.companyInfo?.gstNumber ? [`GSTIN: ${options.companyInfo.gstNumber}`] : [],
        startX: margin,
        startY: margin,
        contentWidth,
        rightMarginX,
        titleColor: [26, 86, 219],
        maxAddressWidth: 105,
        showDivider: true
      })
      return headerRes.nextY + 3
    } else {
      return drawCompanyPdfContinuationHeader(pdf, {
        company: options.companyInfo,
        docTitle: options.title,
        docNumber: options.docNumber,
        startX: margin,
        startY: margin,
        rightMarginX
      })
    }
  }

  // Main Page 1 Initial Setup
  let y = drawPageHeader(1)

  // Render Party and Invoice Details side-by-side
  pdf.setFillColor(248, 250, 252); // slate-50 background card
  pdf.rect(margin, y, contentWidth, 24, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.rect(margin, y, contentWidth, 24, 'S');

  // Bil To / Party Info
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139); // slate-500
  pdf.text(options.partyLabel.toUpperCase(), margin + 5, y + 5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(15, 23, 42);
  pdf.text(options.partyInfo.name, margin + 5, y + 10);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  let partyY = y + 14;
  if (options.partyInfo.details1) {
    pdf.text(options.partyInfo.details1, margin + 5, partyY);
    partyY += 4;
  }
  if (options.partyInfo.details2) {
    pdf.text(options.partyInfo.details2, margin + 5, partyY);
  }

  // General Document Metadata (Right)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text('PAYMENT & SOURCE DETAILS', margin + 95, y + 5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Prepared By: ${options.preparedBy || 'System'}`, margin + 95, y + 10);
  
  if (options.paymentDetails) {
    pdf.text(`Payment Mode: ${options.paymentDetails.method || 'N/A'}`, margin + 95, y + 14);
    pdf.text(`Ref Number: ${options.paymentDetails.reference || '—'}`, margin + 95, y + 18);
  }

  y += 32;

  // Table Drawing Setup
  const drawTableHeader = (currentY: number) => {
    pdf.setFillColor(241, 245, 249); // slate-100 table header
    pdf.rect(margin, currentY, contentWidth, 7, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);

    pdf.text('S.No', margin + 3, currentY + 4.5);
    pdf.text('Description / Details', margin + 15, currentY + 4.5);
    textRight('Qty', margin + 115, currentY + 4.5);
    textRight('Unit Price', margin + 145, currentY + 4.5);
    textRight('Total Amount', rightMarginX - 3, currentY + 4.5);
  };

  drawTableHeader(y);
  y += 7;

  // Table Body Rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);

  options.items.forEach((item, index) => {
    // Auto page break check before writing row
    const rowHeight = 7;
    if (y + rowHeight > pageHeight - bottomMargin) {
      pdf.addPage();
      y = drawPageHeader(pdf.getNumberOfPages());
      drawTableHeader(y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
    }

    // Alternating rows bg
    if (index % 2 === 1) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    // Row line divider
    pdf.setDrawColor(241, 245, 249);
    pdf.line(margin, y + rowHeight, rightMarginX, y + rowHeight);

    pdf.text(String(item.sno || index + 1), margin + 3, y + 4.5);
    
    // Description text wrap
    const descText = item.description || '—';
    const splitDesc = pdf.splitTextToSize(descText, 90);
    pdf.text(splitDesc[0], margin + 15, y + 4.5);

    textRight(item.quantity !== undefined ? String(item.quantity) : '—', margin + 115, y + 4.5);
    textRight(item.unitPrice !== undefined ? `INR ${item.unitPrice.toFixed(2)}` : '—', margin + 145, y + 4.5);
    textRight(`INR ${item.amount.toFixed(2)}`, rightMarginX - 3, y + 4.5);

    y += rowHeight;
  });

  y += 5;

  // Check page break for financial summary block
  const summaryBlockHeight = 35;
  if (y + summaryBlockHeight > pageHeight - bottomMargin) {
    pdf.addPage();
    y = drawPageHeader(pdf.getNumberOfPages());
  }

  // Draw notes / remarks (Left side)
  let notesY = y + 5;
  if (options.notes) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('NOTES / TERMS', margin, notesY);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    const splitNotes = pdf.splitTextToSize(options.notes, 95);
    pdf.text(splitNotes, margin, notesY + 4);
  }

  // Draw Financial Summary (Right side aligned)
  const sumX = margin + 110;
  let sumY = y + 4;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);

  const drawSummaryLine = (label: string, val: number | undefined) => {
    if (val === undefined) return;
    pdf.text(label, sumX, sumY);
    textRight(`INR ${val.toFixed(2)}`, rightMarginX - 3, sumY);
    sumY += 5;
  };

  drawSummaryLine('Sub Total:', options.financialSummary.subTotal);
  drawSummaryLine('Tax Amount:', options.financialSummary.taxAmount);
  drawSummaryLine('Discount:', options.financialSummary.discountAmount);

  // Grand Total Card Box
  pdf.setFillColor(241, 245, 249);
  pdf.rect(sumX - 2, sumY - 1.5, contentWidth - 108, 7.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Grand Total:', sumX, sumY + 3.5);
  textRight(`INR ${options.financialSummary.grandTotal.toFixed(2)}`, rightMarginX - 3, sumY + 3.5);
  sumY += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  drawSummaryLine('Amount Paid:', options.financialSummary.amountPaid);
  
  if (options.financialSummary.balance !== undefined) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(options.financialSummary.balance > 0 ? 225 : 15, 23, 42); // Red if balance outstanding
    drawSummaryLine('Balance Due:', options.financialSummary.balance);
  }

  // Loop through all pages to add dynamic page numbering and system footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    
    // Bottom border
    pdf.setDrawColor(241, 245, 249);
    pdf.setLineWidth(0.4);
    pdf.line(margin, pageHeight - 15, rightMarginX, pageHeight - 15);

    // Footer details
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.setTextColor(148, 163, 184); // slate-400

    const systemText = 'Generated by Aquzio ERP • Developed by Webzio Technology';
    const compGeneratedText = 'This is a computer-generated document and does not require a physical signature.';
    const dateText = `Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;

    pdf.text(systemText, margin, pageHeight - 11);
    pdf.text(compGeneratedText, margin, pageHeight - 8);
    textRight(dateText, rightMarginX, pageHeight - 11);
    
    // Page numbering
    textRight(`Page ${i} of ${totalPages}`, rightMarginX, pageHeight - 8);
  }

  return pdf;
};
