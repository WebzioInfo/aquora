using System;
using System.Text;
using System.Threading.Tasks;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities.QC;

namespace Aquora.Application.Services
{
    public class QCPdfCertificateService : IQCPdfCertificateService
    {
        public Task<byte[]> GenerateCertificatePdfAsync(WaterTestReport report, string companyName)
        {
            string html = GenerateCertificateHtml(report, companyName);
            byte[] bytes = Encoding.UTF8.GetBytes(html);
            return Task.FromResult(bytes);
        }

        public string GenerateCertificateHtml(WaterTestReport report, string companyName)
        {
            var sb = new StringBuilder();
            sb.AppendLine("<!DOCTYPE html><html><head><meta charset='utf-8'><title>Certificate of Analysis</title>");
            sb.AppendLine("<style>");
            sb.AppendLine("body { font-family: 'Helvetica', 'Arial', sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }");
            sb.AppendLine(".header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }");
            sb.AppendLine(".company-name { font-size: 24px; font-weight: bold; color: #1e3a8a; uppercase; }");
            sb.AppendLine(".doc-title { font-size: 18px; font-weight: bold; color: #334155; margin-top: 5px; }");
            sb.AppendLine(".info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }");
            sb.AppendLine(".info-item label { font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; display: block; }");
            sb.AppendLine(".info-item span { font-size: 14px; font-weight: 600; color: #0f172a; }");
            sb.AppendLine("table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }");
            sb.AppendLine("th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; font-size: 12px; }");
            sb.AppendLine("th { background-color: #f1f5f9; font-weight: bold; color: #334155; text-transform: uppercase; font-size: 11px; }");
            sb.AppendLine(".badge { padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; text-transform: uppercase; }");
            sb.AppendLine(".badge-pass { background-color: #dcfce7; color: #15803d; }");
            sb.AppendLine(".badge-fail { background-color: #ffe4e6; color: #be123c; }");
            sb.AppendLine(".footer { margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 20px; }");
            sb.AppendLine(".sig-box { text-align: center; width: 200px; }");
            sb.AppendLine(".sig-line { border-top: 1px solid #94a3b8; margin-top: 40px; font-size: 12px; font-weight: bold; }");
            sb.AppendLine("</style></head><body>");

            sb.AppendLine("<div class='header'>");
            sb.AppendLine($"<div class='company-name'>{companyName}</div>");
            sb.AppendLine("<div class='doc-title'>QUALITY CONTROL CERTIFICATE OF ANALYSIS</div>");
            sb.AppendLine($"<div style='font-size: 12px; color: #64748b;'>BIS IS 14543 Drinking Water Standard Compliance</div>");
            sb.AppendLine("</div>");

            sb.AppendLine("<div class='info-grid'>");
            sb.AppendLine($"<div class='info-item'><label>Report Number</label><span>{report.Id.ToString()[..8].ToUpper()}</span></div>");
            sb.AppendLine($"<div class='info-item'><label>Batch Number</label><span>{report.BatchNumber}</span></div>");
            sb.AppendLine($"<div class='info-item'><label>Sample Number</label><span>{report.SampleNumber ?? "—"}</span></div>");
            sb.AppendLine($"<div class='info-item'><label>Report Type</label><span>{report.ReportType}</span></div>");
            sb.AppendLine($"<div class='info-item'><label>Production Date</label><span>{(report.ProductionDate.HasValue ? report.ProductionDate.Value.ToString("dd MMM yyyy") : "—")}</span></div>");
            sb.AppendLine($"<div class='info-item'><label>Sample Collection Time</label><span>{(report.SampleTime.HasValue ? report.SampleTime.Value.ToString("dd MMM yyyy, hh:mm tt") : "—")}</span></div>");
            sb.AppendLine($"<div class='info-item'><label>Analyst / Tested By</label><span>{report.TestedBy ?? "—"}</span></div>");
            sb.AppendLine($"<div class='info-item'><label>QC Verifier</label><span>{report.VerifiedBy ?? "—"}</span></div>");
            sb.AppendLine("</div>");

            sb.AppendLine("<h3>Parameter Analysis Results</h3>");
            sb.AppendLine("<table><thead><tr><th>Parameter Name</th><th>Category</th><th>Measured Result</th><th>Unit</th><th>Status</th></tr></thead><tbody>");

            foreach (var r in report.Results)
            {
                string statusBadgeClass = r.QualityStatus == "PASS" ? "badge-pass" : "badge-fail";
                string valStr = r.StringValue ?? (r.Value.HasValue ? r.Value.Value.ToString() : "—");
                string catStr = r.Parameter?.Category ?? "GENERAL";
                string unitStr = r.Parameter?.Unit ?? "";

                sb.AppendLine($"<tr><td>{r.Parameter?.Name ?? "Parameter"}</td><td>{catStr}</td><td>{valStr}</td><td>{unitStr}</td><td><span class='badge {statusBadgeClass}'>{r.QualityStatus}</span></td></tr>");
            }

            sb.AppendLine("</tbody></table>");

            if (!string.IsNullOrWhiteSpace(report.Remarks))
            {
                sb.AppendLine("<div style='background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e2e8f0;'>");
                sb.AppendLine("<h4 style='margin: 0 0 5px 0; font-size: 12px; color: #475569;'>ANALYST OBSERVATIONS & CONCLUSION</h4>");
                sb.AppendLine($"<p style='margin: 0; font-size: 13px; color: #0f172a;'>{report.Remarks}</p>");
                sb.AppendLine("</div>");
            }

            sb.AppendLine("<div class='footer'>");
            sb.AppendLine("<div>");
            sb.AppendLine($"<div style='font-size: 10px; color: #94a3b8;'>Verification QR String: AQUORA-QC-{report.Id.ToString()[..8].ToUpper()}</div>");
            sb.AppendLine($"<div style='font-size: 10px; color: #94a3b8;'>Generated: {DateTime.UtcNow:dd MMM yyyy, HH:mm} UTC</div>");
            sb.AppendLine("</div>");
            sb.AppendLine("<div class='sig-box'>");
            sb.AppendLine("<div class='sig-line'>Authorized QC Manager Signature</div>");
            sb.AppendLine("</div>");
            sb.AppendLine("</div>");

            sb.AppendLine("</body></html>");
            return sb.ToString();
        }
    }
}
