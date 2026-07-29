using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Payroll
{
    public class Payslip : BaseEntity, IAuditable
    {
        public Guid Id { get; set; }
        public Guid EmployeeId { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
        public decimal BasicSalary { get; set; }
        public decimal Deductions { get; set; }
        public decimal NetPay { get; set; }
        public bool IsPaid { get; set; }

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
