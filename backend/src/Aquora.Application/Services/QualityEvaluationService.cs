using System;
using System.Collections.Generic;
using System.Linq;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities.QC;

namespace Aquora.Application.Services
{
    public class QualityEvaluationService : IQualityEvaluationService
    {
        public string EvaluateParameter(WaterTestParameter parameter, double? numericValue, string? stringValue)
        {
            if (parameter == null) return "NOT_ENTERED";

            string nameLower = parameter.Name.ToLowerInvariant().Trim();
            string category = parameter.Category?.ToUpperInvariant() ?? "";

            // Handle string values (presence/absence or descriptors)
            string? valStr = stringValue?.Trim().ToLowerInvariant();
            if (valStr == "—" || valStr == "not entered" || string.IsNullOrWhiteSpace(valStr))
            {
                valStr = null;
            }

            // Yeast & Mold or any other presence/absence pathogens
            if (category == "MICROBIOLOGY" && !nameLower.Contains("aerobic"))
            {
                if (string.IsNullOrWhiteSpace(valStr)) return "NOT_ENTERED";
                if (valStr == "absent") return "PASS";
                if (valStr == "present") return "FAIL";
                return "FAIL"; // Any other value is FAIL
            }

            // Descriptors: Colour, Odour, Taste
            if (nameLower == "colour" || nameLower == "color" || nameLower == "odour" || nameLower == "odor" || nameLower == "taste")
            {
                if (string.IsNullOrWhiteSpace(valStr)) return "NOT_ENTERED";
                if (valStr == "agreeable" || valStr == "unobjectionable") return "PASS";
                if (valStr == "not agreeable" || valStr == "objectionable") return "FAIL";
                return "FAIL";
            }

            // Aerobic Microbial Count 22°C and 37°C
            bool isAmc22 = nameLower.Contains("aerobic microbial count 22") || nameLower.Contains("amc 22");
            bool isAmc37 = nameLower.Contains("aerobic microbial count 37") || nameLower.Contains("amc 37");

            if (isAmc22 || isAmc37)
            {
                if (valStr == "absent") return "PASS";
                if (valStr == "present") return "FAIL";

                if (valStr == "enter count" || valStr == "enter count..." || (numericValue.HasValue && string.IsNullOrEmpty(valStr)))
                {
                    if (numericValue.HasValue)
                    {
                        double numVal = numericValue.Value;
                        if (numVal < 0) return "FAIL";

                        if (isAmc22)
                        {
                            if (numVal >= 0 && numVal <= 100) return "PASS";
                            return "FAIL";
                        }
                        if (isAmc37)
                        {
                            if (numVal >= 0 && numVal <= 20) return "PASS";
                            return "FAIL";
                        }
                    }
                    return "NOT_ENTERED";
                }

                return "NOT_ENTERED";
            }

            // Numeric parameters
            if (numericValue.HasValue)
            {
                double val = numericValue.Value;

                double? minWarn = parameter.MinWarning;
                double? minAcc = parameter.MinAcceptable;
                double? maxAcc = parameter.MaxAcceptable;
                double? maxWarn = parameter.MaxWarning;

                // 1. Lower bound checks
                if (minWarn.HasValue && val < minWarn.Value)
                {
                    return "FAIL";
                }
                if (minWarn.HasValue && minAcc.HasValue && val >= minWarn.Value && val < minAcc.Value)
                {
                    return "WARNING";
                }
                if (!minWarn.HasValue && minAcc.HasValue && val < minAcc.Value)
                {
                    return "FAIL";
                }

                // 2. Upper bound checks
                if (maxWarn.HasValue && val > maxWarn.Value)
                {
                    return "FAIL";
                }
                if (maxWarn.HasValue && maxAcc.HasValue && val > maxAcc.Value && val <= maxWarn.Value)
                {
                    return "WARNING";
                }
                if (!maxWarn.HasValue && maxAcc.HasValue && val > maxAcc.Value)
                {
                    return "FAIL";
                }

                // 3. In acceptable bounds
                return "PASS";
            }

            return "NOT_ENTERED";
        }

        public (string OverallStatus, string MicroStatus, int PassCount, int WarningCount, int FailCount) EvaluateReport(IEnumerable<(WaterTestParameter Parameter, double? Value, string? StringValue)> testResults)
        {
            int passCount = 0;
            int warningCount = 0;
            int failCount = 0;
            int pendingCount = 0;
            bool hasMicroFail = false;
            bool hasMicroEntered = false;

            foreach (var item in testResults)
            {
                string status = EvaluateParameter(item.Parameter, item.Value, item.StringValue);
                if (status == "PASS") passCount++;
                else if (status == "WARNING") warningCount++;
                else if (status == "FAIL") failCount++;
                else if (status == "NOT_ENTERED") pendingCount++;

                if (item.Parameter.Category?.ToUpperInvariant() == "MICROBIOLOGY")
                {
                    if (!string.IsNullOrEmpty(item.StringValue) && item.StringValue != "—" && item.StringValue != "Enter Count...")
                    {
                        hasMicroEntered = true;
                    }
                    else if (item.Value.HasValue)
                    {
                        hasMicroEntered = true;
                    }

                    if (status == "FAIL") hasMicroFail = true;
                }
            }

            string overallStatus = "PASS";
            if (failCount > 0) overallStatus = "FAIL";
            else if (warningCount > 0) overallStatus = "WARNING";
            else if (pendingCount > 0) overallStatus = "PENDING";

            string microStatus = "Pending";
            if (hasMicroFail) microStatus = "Failed";
            else if (hasMicroEntered) microStatus = "Passed";

            return (overallStatus, microStatus, passCount, warningCount, failCount);
        }

        public ComplianceRecord? CheckAndCreateComplianceRecord(WaterTestReport report, WaterTestParameter parameter, double? numericValue, string? stringValue, string qualityStatus)
        {
            if (qualityStatus != "FAIL" && qualityStatus != "WARNING") return null;

            string type = qualityStatus == "FAIL" ? "NCR" : "WARNING";
            string severity = qualityStatus == "FAIL" ? "HIGH" : "MEDIUM";
            string valStr = numericValue.HasValue ? numericValue.Value.ToString() : (stringValue ?? "Out of Spec");

            string expectedRange = "Within specification";
            if (parameter.MinAcceptable.HasValue && parameter.MaxAcceptable.HasValue)
                expectedRange = $"{parameter.MinAcceptable.Value} - {parameter.MaxAcceptable.Value} {parameter.Unit}";
            else if (parameter.MaxAcceptable.HasValue)
                expectedRange = $"Max {parameter.MaxAcceptable.Value} {parameter.Unit}";
            else if (parameter.MinAcceptable.HasValue)
                expectedRange = $"Min {parameter.MinAcceptable.Value} {parameter.Unit}";

            return new ComplianceRecord
            {
                TenantId = report.TenantId,
                CompanyId = report.CompanyId,
                ReportId = report.Id,
                ReferenceNumber = $"NCR-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}",
                Type = type,
                Severity = severity,
                Status = "OPEN",
                ParameterName = parameter.Name,
                BatchNumber = report.BatchNumber,
                DefectDescription = $"Parameter '{parameter.Name}' evaluated as {qualityStatus} with value '{valStr}'. Standard: {expectedRange}",
                MeasuredValue = valStr,
                ExpectedRange = expectedRange,
                AssignedTo = report.TestedBy ?? "QC Manager",
                TargetResolutionDate = DateTime.UtcNow.AddDays(2),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = report.CreatedBy
            };
        }
    }
}
