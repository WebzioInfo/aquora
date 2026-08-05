using System.Collections.Generic;
using Aquora.Domain.Entities.QC;

namespace Aquora.Application.Interfaces.Services
{
    public interface IQualityEvaluationService
    {
        string EvaluateParameter(WaterTestParameter parameter, double? numericValue, string? stringValue);
        (string OverallStatus, string MicroStatus, int PassCount, int WarningCount, int FailCount) EvaluateReport(IEnumerable<(WaterTestParameter Parameter, double? Value, string? StringValue)> testResults);
        ComplianceRecord? CheckAndCreateComplianceRecord(WaterTestReport report, WaterTestParameter parameter, double? numericValue, string? stringValue, string qualityStatus);
    }
}
