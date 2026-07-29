using System;

namespace Aquora.Application.DTOs
{
    public class QualityInspectionDto
    {
        public Guid Id { get; set; }
        public Guid ProductionBatchId { get; set; }
        public DateTime InspectionDate { get; set; }
        public string InspectorName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Remarks { get; set; } = string.Empty;
    }

    public class PayslipDto
    {
        public Guid Id { get; set; }
        public Guid EmployeeId { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
        public decimal BasicSalary { get; set; }
        public decimal Deductions { get; set; }
        public decimal NetPay { get; set; }
        public bool IsPaid { get; set; }
    }
}
