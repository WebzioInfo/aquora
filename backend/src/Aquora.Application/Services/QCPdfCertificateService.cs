using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities.QC;

namespace Aquora.Application.Services
{
    public class QCPdfCertificateService : IQCPdfCertificateService
    {
        private const double PageWidth = 595.28;  // A4 portrait width in points (210mm)
        private const double PageHeight = 841.89; // A4 portrait height in points (297mm)
        private const double Margin = 42.5;       // ~15mm in points
        private const double UsableWidth = PageWidth - (Margin * 2); // 510.28 pt

        private static readonly string[] PhysicalChemicalOrder = new[]
        {
            "pH", "TDS", "Turbidity", "Sulphate", "Colour", "Odour", "Taste",
            "Residual Free Chlorine", "Alkalinity", "Chloride"
        };

        private static readonly string[] MicrobiologyOrder = new[]
        {
            "E.coli", "Coliform", "Pseudomonas", "Clostridia",
            "Aerobic Microbial Count 22°C", "Aerobic Microbial Count 37°C", "Yeast & Mold"
        };

        public Task<byte[]> GenerateCertificatePdfAsync(WaterTestReport report, string companyName)
        {
            var pdfBytes = BuildPdfBinary(report, companyName);
            return Task.FromResult(pdfBytes);
        }

        public string GenerateCertificateHtml(WaterTestReport report, string companyName)
        {
            // Retained for backward compatibility
            return $"<!DOCTYPE html><html><body><h1>Water Test Report {report.Id} - {companyName}</h1></body></html>";
        }

        private byte[] BuildPdfBinary(WaterTestReport report, string companyName)
        {
            var pages = new List<string>();
            var currentPageStream = new StringBuilder();

            double y = PageHeight - 45; // Start top
            int pageIndex = 1;

            string reportNo = !string.IsNullOrWhiteSpace(report.SampleNumber) ? report.SampleNumber : report.Id.ToString()[..8].ToUpper();
            string reportDate = report.SampleTime.HasValue 
                ? report.SampleTime.Value.ToString("dd MMM yyyy", CultureInfo.InvariantCulture) 
                : (report.CreatedAt.ToString("dd MMM yyyy", CultureInfo.InvariantCulture));

            string safeCompanyName = SanitizeText(string.IsNullOrWhiteSpace(companyName) ? "AQUZIO ENTERPRISE" : companyName.ToUpperInvariant());

            // Helper to add page break
            void PageBreak()
            {
                // Draw footer for current page
                DrawFooter(currentPageStream, safeCompanyName, reportNo, pageIndex);
                pages.Add(currentPageStream.ToString());
                currentPageStream.Clear();
                pageIndex++;
                y = PageHeight - 45;

                // Draw continuation header
                DrawContinuationHeader(currentPageStream, safeCompanyName, reportNo);
            }

            // 1. PAGE 1 HEADER
            DrawHeader(currentPageStream, safeCompanyName, reportNo, reportDate, ref y);

            // 2. REPORT INFORMATION BLOCK
            DrawReportInfoGrid(currentPageStream, report, reportNo, reportDate, ref y);

            // 3. OVERALL QUALITY STATUS BANNER
            string overallStatus = ResolveOverallStatus(report);
            DrawOverallStatusBanner(currentPageStream, overallStatus, ref y);

            // 4. TEST RESULTS TABLE
            var sortedResults = SortResults(report.Results);
            DrawResultsTable(currentPageStream, sortedResults, ref y, PageBreak);

            // 5. REMARKS (IF PRESENT)
            if (!string.IsNullOrWhiteSpace(report.Remarks))
            {
                if (y < 120) PageBreak();
                DrawRemarksBox(currentPageStream, report.Remarks, ref y);
            }

            // 6. SIGNATURES & VERIFICATION
            if (y < 95) PageBreak();
            DrawSignatures(currentPageStream, report, reportDate, ref y);

            // Draw footer on last page
            DrawFooter(currentPageStream, safeCompanyName, reportNo, pageIndex);
            pages.Add(currentPageStream.ToString());

            // Now assemble the PDF document structure
            return CompilePdfDocument(pages, pageIndex);
        }

        private static string ResolveOverallStatus(WaterTestReport report)
        {
            if (report == null) return "DRAFT";
            if (report.Status == "DRAFT") return "DRAFT";
            if (report.Results != null && report.Results.Count > 0)
            {
                if (report.Results.Any(r => r.QualityStatus == "FAIL")) return "FAIL";
                if (report.Results.Any(r => r.QualityStatus == "WARNING")) return "WARNING";
                return "PASS";
            }
            if (report.Status == "FAIL") return "FAIL";
            if (report.Status == "WARNING") return "WARNING";
            if (report.Status == "PASS" || report.Status == "APPROVED") return "PASS";
            return "DRAFT";
        }

        private static List<WaterTestResult> SortResults(ICollection<WaterTestResult>? results)
        {
            if (results == null || results.Count == 0) return new List<WaterTestResult>();

            return results.OrderBy(r =>
            {
                bool isMicro = string.Equals(r.Parameter?.Category, "MICROBIOLOGY", StringComparison.OrdinalIgnoreCase);
                return isMicro ? 1 : 0;
            }).ThenBy(r =>
            {
                bool isMicro = string.Equals(r.Parameter?.Category, "MICROBIOLOGY", StringComparison.OrdinalIgnoreCase);
                var order = isMicro ? MicrobiologyOrder : PhysicalChemicalOrder;
                string name = r.Parameter?.Name ?? string.Empty;
                int idx = Array.FindIndex(order, o => o.Equals(name, StringComparison.OrdinalIgnoreCase));
                return idx != -1 ? idx : 999;
            }).ThenBy(r => r.Parameter?.Name ?? string.Empty)
            .ToList();
        }

        private void DrawHeader(StringBuilder stream, string companyName, string reportNo, string reportDate, ref double y)
        {
            // Company Name
            DrawText(stream, companyName, Margin, y, "F2", 14, 0.06, 0.09, 0.16); // 15,23,42

            // Right side: Document Title & Metadata
            DrawText(stream, "WATER TEST REPORT", PageWidth - Margin, y, "F2", 12, 0.12, 0.23, 0.54, "right"); // 30,58,138
            y -= 13;

            DrawText(stream, "Quality Control & Water Testing Laboratory", Margin, y, "F1", 8.5, 0.39, 0.45, 0.55);
            DrawText(stream, $"Report No: {reportNo}", PageWidth - Margin, y, "F2", 8.5, 0.06, 0.09, 0.16, "right");
            y -= 11;

            DrawText(stream, "Compliant with BIS IS 14543 Drinking Water Standards", Margin, y, "F3", 7.5, 0.45, 0.53, 0.63);
            DrawText(stream, $"Date: {reportDate}", PageWidth - Margin, y, "F1", 8, 0.39, 0.45, 0.55, "right");
            y -= 8;

            // Header line
            DrawLine(stream, Margin, y, PageWidth - Margin, y, 0.5, 0.80, 0.84, 0.88);
            y -= 12;
        }

        private void DrawContinuationHeader(StringBuilder stream, string companyName, string reportNo)
        {
            double hY = PageHeight - 25;
            DrawText(stream, companyName, Margin, hY, "F2", 8, 0.12, 0.23, 0.54);
            DrawText(stream, $"WATER TEST REPORT - {reportNo}", PageWidth - Margin, hY, "F1", 8, 0.39, 0.45, 0.55, "right");
            DrawLine(stream, Margin, hY - 6, PageWidth - Margin, hY - 6, 0.3, 0.88, 0.91, 0.94);
        }

        private void DrawReportInfoGrid(StringBuilder stream, WaterTestReport report, string reportNo, string reportDate, ref double y)
        {
            double cardHeight = 44;
            double cardY = y - cardHeight;

            // Card background & border
            DrawRect(stream, Margin, cardY, UsableWidth, cardHeight, 0.97, 0.98, 0.99, true, true, 0.88, 0.91, 0.94, 0.4);

            double col1X = Margin + 12;
            double col2X = Margin + 180;
            double col3X = Margin + 350;

            double row1Y = y - 13;
            double row2Y = y - 31;

            // Row 1
            DrawField(stream, "REPORT NUMBER", reportNo, col1X, row1Y);
            DrawField(stream, "REPORT TYPE", report.ReportType ?? "DAILY", col2X, row1Y);
            DrawField(stream, "BATCH NUMBER", report.BatchNumber ?? "—", col3X, row1Y);

            // Row 2
            string sampleTime = report.SampleTime.HasValue 
                ? report.SampleTime.Value.ToString("dd MMM yyyy, hh:mm tt", CultureInfo.InvariantCulture) 
                : reportDate;
            string testedBy = !string.IsNullOrWhiteSpace(report.TestedBy) ? report.TestedBy : "Quality Analyst";

            DrawField(stream, "COLLECTION TIME", sampleTime, col1X, row2Y);
            DrawField(stream, "SAMPLE NUMBER", report.SampleNumber ?? "—", col2X, row2Y);
            DrawField(stream, "TESTED BY", testedBy, col3X, row2Y);

            y = cardY - 10;
        }

        private void DrawField(StringBuilder stream, string label, string val, double x, double fieldY)
        {
            DrawText(stream, label, x, fieldY, "F2", 6.5, 0.58, 0.64, 0.72);
            DrawText(stream, SanitizeText(val), x, fieldY - 9, "F2", 8.5, 0.06, 0.09, 0.16);
        }

        private void DrawOverallStatusBanner(StringBuilder stream, string status, ref double y)
        {
            double bannerHeight = 24;
            double bannerY = y - bannerHeight;

            double bgR = 0.94, bgG = 0.99, bgB = 0.96; // Green-50
            double bdrR = 0.73, bdrG = 0.97, bdrB = 0.82; // Green-200
            double txtR = 0.09, txtG = 0.40, txtB = 0.20; // Green-800
            string title = "QUALITY COMPLIANT — PASSED";
            string desc = "All tested physical, chemical, and microbiological parameters comply with standard specifications.";

            if (status == "FAIL")
            {
                bgR = 1.0; bgG = 0.95; bgB = 0.95;
                bdrR = 1.0; bdrG = 0.79; bdrB = 0.79;
                txtR = 0.73; txtG = 0.11; txtB = 0.11;
                title = "NON-COMPLIANT — FAILED SPECIFICATIONS";
                desc = "One or more measured parameters exceed maximum permissible contamination limits.";
            }
            else if (status == "WARNING")
            {
                bgR = 1.0; bgG = 0.97; bgB = 0.88;
                bdrR = 0.99; bdrG = 0.90; bdrB = 0.54;
                txtR = 0.71; txtG = 0.33; txtB = 0.04;
                title = "WARNING — PARAMETERS APPROACHING LIMITS";
                desc = "One or more parameters have exceeded advisory warning thresholds.";
            }
            else if (status == "DRAFT")
            {
                bgR = 0.97; bgG = 0.98; bgB = 0.99;
                bdrR = 0.88; bdrG = 0.91; bdrB = 0.94;
                txtR = 0.39; txtG = 0.45; txtB = 0.55;
                title = "DRAFT WATER TEST REPORT";
                desc = "Analysis results are currently recorded in preliminary draft status.";
            }

            DrawRect(stream, Margin, bannerY, UsableWidth, bannerHeight, bgR, bgG, bgB, true, true, bdrR, bdrG, bdrB, 0.5);
            DrawText(stream, title, Margin + 10, bannerY + 14, "F2", 8.5, txtR, txtG, txtB);
            DrawText(stream, desc, Margin + 10, bannerY + 5, "F1", 7, 0.20, 0.25, 0.33);

            y = bannerY - 12;
        }

        private void DrawResultsTable(StringBuilder stream, List<WaterTestResult> results, ref double y, Action pageBreak)
        {
            // Section Title
            DrawText(stream, "PARAMETER ANALYSIS RESULTS", Margin, y, "F2", 9, 0.06, 0.09, 0.16);
            y -= 8;

            void RenderHeader(double hY)
            {
                DrawRect(stream, Margin, hY - 14, UsableWidth, 14, 0.95, 0.96, 0.98, true, true, 0.80, 0.84, 0.88, 0.4);
                DrawText(stream, "PARAMETER NAME", Margin + 8, hY - 10, "F2", 7, 0.20, 0.25, 0.33);
                DrawText(stream, "CATEGORY", Margin + 160, hY - 10, "F2", 7, 0.20, 0.25, 0.33);
                DrawText(stream, "RESULT", Margin + 255, hY - 10, "F2", 7, 0.20, 0.25, 0.33, "center");
                DrawText(stream, "UNIT", Margin + 325, hY - 10, "F2", 7, 0.20, 0.25, 0.33, "center");
                DrawText(stream, "REFERENCE LIMITS", Margin + 415, hY - 10, "F2", 7, 0.20, 0.25, 0.33, "center");
                DrawText(stream, "STATUS", Margin + 485, hY - 10, "F2", 7, 0.20, 0.25, 0.33, "center");
            }

            RenderHeader(y);
            y -= 14;

            for (int i = 0; i < results.Count; i++)
            {
                if (y < 65)
                {
                    pageBreak();
                    RenderHeader(y);
                    y -= 14;
                }

                var r = results[i];
                double rowHeight = 14;
                double rowY = y - rowHeight;

                if (i % 2 == 0)
                {
                    DrawRect(stream, Margin, rowY, UsableWidth, rowHeight, 0.98, 0.99, 1.0, true, false);
                }
                DrawLine(stream, Margin, rowY, PageWidth - Margin, rowY, 0.2, 0.88, 0.91, 0.94);

                string paramName = SanitizeText(r.Parameter?.Name ?? "Unknown");
                string category = SanitizeText((r.Parameter?.Category ?? "CHEMICAL").ToUpperInvariant());
                string resultVal = FormatResultValue(r.Value, r.StringValue);
                string unit = SanitizeText(string.IsNullOrWhiteSpace(r.Parameter?.Unit) || r.Parameter?.Unit == "—" ? "—" : r.Parameter!.Unit);
                string limits = FormatLimits(r.Parameter, category, unit);
                string status = (r.QualityStatus ?? (r.IsPass ? "PASS" : "FAIL")).ToUpperInvariant();

                DrawText(stream, paramName, Margin + 8, rowY + 4.5, "F2", 7.5, 0.06, 0.09, 0.16);
                DrawText(stream, category, Margin + 160, rowY + 4.5, "F1", 7, 0.39, 0.45, 0.55);

                double resR = 0.06, resG = 0.09, resB = 0.16;
                if (status == "FAIL") { resR = 0.73; resG = 0.11; resB = 0.11; }
                else if (status == "WARNING") { resR = 0.71; resG = 0.33; resB = 0.04; }

                DrawText(stream, resultVal, Margin + 255, rowY + 4.5, "F2", 8, resR, resG, resB, "center");
                DrawText(stream, unit, Margin + 325, rowY + 4.5, "F1", 7, 0.39, 0.45, 0.55, "center");
                DrawText(stream, limits, Margin + 415, rowY + 4.5, "F1", 7, 0.20, 0.25, 0.33, "center");

                double stR = 0.09, stG = 0.40, stB = 0.20;
                string stLabel = "PASS";
                if (status == "FAIL") { stR = 0.73; stG = 0.11; stB = 0.11; stLabel = "FAIL"; }
                else if (status == "WARNING") { stR = 0.71; stG = 0.33; stB = 0.04; stLabel = "WARN"; }
                else if (status == "DRAFT" || status == "NOT_ENTERED") { stR = 0.58; stG = 0.64; stB = 0.72; stLabel = "—"; }

                DrawText(stream, stLabel, Margin + 485, rowY + 4.5, "F2", 7, stR, stG, stB, "center");

                y = rowY;
            }

            y -= 10;
        }

        private static string FormatResultValue(double? val, string? strVal)
        {
            if (!string.IsNullOrWhiteSpace(strVal)) return SanitizeText(strVal);
            if (val.HasValue)
            {
                if (val.Value % 1 == 0) return val.Value.ToString("0", CultureInfo.InvariantCulture);
                return val.Value.ToString("0.###", CultureInfo.InvariantCulture);
            }
            return "—";
        }

        private static string FormatLimits(WaterTestParameter? param, string category, string unit)
        {
            if (category == "MICROBIOLOGY") return "Absent / 100 ml";
            if (param == null) return "—";

            if (param.MinAcceptable.HasValue && param.MaxAcceptable.HasValue)
                return $"{param.MinAcceptable.Value.ToString("0.##", CultureInfo.InvariantCulture)} - {param.MaxAcceptable.Value.ToString("0.##", CultureInfo.InvariantCulture)}";
            if (param.MaxAcceptable.HasValue)
                return $"< {param.MaxAcceptable.Value.ToString("0.##", CultureInfo.InvariantCulture)}";
            if (param.MinAcceptable.HasValue)
                return $"> {param.MinAcceptable.Value.ToString("0.##", CultureInfo.InvariantCulture)}";

            if (unit == "MPN/100ml" || unit == "CFU/ml") return "Absent";
            return "—";
        }

        private void DrawRemarksBox(StringBuilder stream, string remarks, ref double y)
        {
            double boxHeight = 28;
            double boxY = y - boxHeight;

            DrawRect(stream, Margin, boxY, UsableWidth, boxHeight, 0.98, 0.99, 1.0, true, true, 0.88, 0.91, 0.94, 0.4);
            DrawText(stream, "ANALYST OBSERVATIONS & NOTES", Margin + 10, boxY + 18, "F2", 7, 0.39, 0.45, 0.55);
            DrawText(stream, SanitizeText(remarks), Margin + 10, boxY + 7, "F1", 7.5, 0.06, 0.09, 0.16);

            y = boxY - 10;
        }

        private void DrawSignatures(StringBuilder stream, WaterTestReport report, string reportDate, ref double y)
        {
            double sigY = y - 28;
            double boxW = 180;

            // Analyst Sign Box
            string analyst = SanitizeText(!string.IsNullOrWhiteSpace(report.TestedBy) ? report.TestedBy : "Quality Analyst");
            DrawText(stream, "TESTED & RECORDED BY", Margin + 10, sigY + 20, "F2", 7.5, 0.06, 0.09, 0.16);
            DrawText(stream, analyst, Margin + 10, sigY + 10, "F1", 7.5, 0.20, 0.25, 0.33);
            DrawText(stream, $"Date: {reportDate}", Margin + 10, sigY + 1, "F1", 6.5, 0.45, 0.53, 0.63);
            DrawLine(stream, Margin + 10, sigY - 4, Margin + 10 + boxW, sigY - 4, 0.4, 0.80, 0.84, 0.88);
            DrawText(stream, "Authorized Analyst Signature", Margin + 10, sigY - 12, "F1", 6, 0.58, 0.64, 0.72);

            // Reviewer Sign Box
            double sig2X = PageWidth - Margin - boxW - 10;
            string reviewer = SanitizeText(!string.IsNullOrWhiteSpace(report.VerifiedBy) ? report.VerifiedBy : "Quality Assurance Manager");
            DrawText(stream, "REVIEWED & APPROVED BY", sig2X, sigY + 20, "F2", 7.5, 0.06, 0.09, 0.16);
            DrawText(stream, reviewer, sig2X, sigY + 10, "F1", 7.5, 0.20, 0.25, 0.33);
            DrawText(stream, $"Date: {reportDate}", sig2X, sigY + 1, "F1", 6.5, 0.45, 0.53, 0.63);
            DrawLine(stream, sig2X, sigY - 4, sig2X + boxW, sigY - 4, 0.4, 0.80, 0.84, 0.88);
            DrawText(stream, "Quality Assurance Manager Signature", sig2X, sigY - 12, "F1", 6, 0.58, 0.64, 0.72);

            y = sigY - 20;
        }

        private void DrawFooter(StringBuilder stream, string companyName, string reportNo, int pageNum)
        {
            double footerY = 22;
            DrawLine(stream, Margin, footerY + 8, PageWidth - Margin, footerY + 8, 0.3, 0.88, 0.91, 0.94);
            DrawText(stream, "Generated by Aquzio ERP • Quality Control Laboratory", Margin, footerY, "F1", 6.5, 0.58, 0.64, 0.72);
            DrawText(stream, companyName, PageWidth / 2, footerY, "F1", 6.5, 0.58, 0.64, 0.72, "center");
            DrawText(stream, $"Report No: {reportNo} • Page {pageNum}", PageWidth - Margin, footerY, "F1", 6.5, 0.58, 0.64, 0.72, "right");
        }

        // ==========================================
        // PDF LOW-LEVEL DRAWING PRIMITIVES
        // ==========================================
        private static void DrawText(StringBuilder stream, string text, double x, double y, string font, double size, double r, double g, double b, string align = "left")
        {
            if (string.IsNullOrEmpty(text)) return;
            string cleanText = EscapePdfString(text);

            // Compute approximate text width for alignment
            if (align == "right" || align == "center")
            {
                double approxWidth = text.Length * (size * 0.52);
                if (align == "right") x -= approxWidth;
                else if (align == "center") x -= (approxWidth / 2.0);
            }

            stream.Append(CultureInfo.InvariantCulture, $"BT /{font} {size:0.##} Tf {r:0.##} {g:0.##} {b:0.##} rg {x:0.##} {y:0.##} Td ({cleanText}) Tj ET\n");
        }

        private static void DrawLine(StringBuilder stream, double x1, double y1, double x2, double y2, double width, double r, double g, double b)
        {
            stream.Append(CultureInfo.InvariantCulture, $"{width:0.##} w {r:0.##} {g:0.##} {b:0.##} RG {x1:0.##} {y1:0.##} m {x2:0.##} {y2:0.##} l S\n");
        }

        private static void DrawRect(StringBuilder stream, double x, double y, double w, double h, double bgR, double bgG, double bgB, bool fill, bool stroke, double bdrR = 0, double bdrG = 0, double bdrB = 0, double bdrW = 1)
        {
            if (fill && stroke)
            {
                stream.Append(CultureInfo.InvariantCulture, $"{bdrW:0.##} w {bdrR:0.##} {bdrG:0.##} {bdrB:0.##} RG {bgR:0.##} {bgG:0.##} {bgB:0.##} rg {x:0.##} {y:0.##} {w:0.##} {h:0.##} re B\n");
            }
            else if (fill)
            {
                stream.Append(CultureInfo.InvariantCulture, $"{bgR:0.##} {bgG:0.##} {bgB:0.##} rg {x:0.##} {y:0.##} {w:0.##} {h:0.##} re f\n");
            }
            else if (stroke)
            {
                stream.Append(CultureInfo.InvariantCulture, $"{bdrW:0.##} w {bdrR:0.##} {bdrG:0.##} {bdrB:0.##} RG {x:0.##} {y:0.##} {w:0.##} {h:0.##} re S\n");
            }
        }

        private static string EscapePdfString(string input)
        {
            var sb = new StringBuilder();
            foreach (char c in input)
            {
                if (c == '(' || c == ')' || c == '\\')
                {
                    sb.Append('\\');
                }
                sb.Append(c);
            }
            return sb.ToString();
        }

        private static string SanitizeText(string input)
        {
            if (string.IsNullOrEmpty(input)) return string.Empty;
            return input
                .Replace("°C", " deg C")
                .Replace("µ", "u")
                .Replace("≤", "<=")
                .Replace("≥", ">=")
                .Replace("–", "-")
                .Replace("—", "-")
                .Replace("₹", "INR ")
                .Replace("\r", "")
                .Replace("\n", " ");
        }

        // ==========================================
        // PDF 1.4 DOCUMENT COMPILER
        // ==========================================
        private static byte[] CompilePdfDocument(List<string> pageStreams, int pageCount)
        {
            using var ms = new MemoryStream();
            using var writer = new StreamWriter(ms, Encoding.ASCII);

            var offsets = new List<long>();

            void WriteRaw(string s) => writer.Write(s);
            long CurrentOffset()
            {
                writer.Flush();
                return ms.Position;
            }

            // PDF-1.4 Header
            WriteRaw("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");

            // Obj 1: Catalog
            offsets.Add(CurrentOffset());
            WriteRaw("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

            // Obj 2: Pages
            var pageObjIds = new List<int>();
            for (int i = 0; i < pageCount; i++)
            {
                pageObjIds.Add(6 + (i * 2));
            }
            string kids = string.Join(" ", pageObjIds.Select(id => $"{id} 0 R"));

            offsets.Add(CurrentOffset());
            WriteRaw($"2 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {pageCount} >>\nendobj\n");

            // Obj 3: Font F1 (Helvetica)
            offsets.Add(CurrentOffset());
            WriteRaw("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n");

            // Obj 4: Font F2 (Helvetica-Bold)
            offsets.Add(CurrentOffset());
            WriteRaw("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n");

            // Obj 5: Font F3 (Helvetica-Oblique)
            offsets.Add(CurrentOffset());
            WriteRaw("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>\nendobj\n");

            // Pages & Contents
            for (int i = 0; i < pageCount; i++)
            {
                int pageObjId = 6 + (i * 2);
                int streamObjId = pageObjId + 1;
                string streamContent = pageStreams[i];
                byte[] streamBytes = Encoding.ASCII.GetBytes(streamContent);

                // Page Object
                offsets.Add(CurrentOffset());
                WriteRaw($"{pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PageWidth:0.##} {PageHeight:0.##}] /Contents {streamObjId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> >>\nendobj\n");

                // Stream Object
                offsets.Add(CurrentOffset());
                WriteRaw($"{streamObjId} 0 obj\n<< /Length {streamBytes.Length} >>\nstream\n");
                WriteRaw(streamContent);
                WriteRaw("\nendstream\nendobj\n");
            }

            // Cross-Reference Table
            long xrefOffset = CurrentOffset();
            int totalObjects = 5 + (pageCount * 2) + 1;

            WriteRaw($"xref\n0 {totalObjects}\n");
            WriteRaw("0000000000 65535 f \n");
            foreach (var off in offsets)
            {
                WriteRaw($"{off:D10} 00000 n \n");
            }

            // Trailer
            WriteRaw($"trailer\n<< /Size {totalObjects} /Root 1 0 R >>\nstartxref\n{xrefOffset}\n%%EOF\n");
            writer.Flush();

            return ms.ToArray();
        }
    }
}
