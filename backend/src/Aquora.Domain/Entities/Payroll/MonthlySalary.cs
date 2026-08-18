using System;
using System.Collections;
using System.Collections.Generic;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Payroll
{
    public class MonthlySalary : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string SalaryNo { get; set; } = string.Empty;
        
        public Guid EmployeeId { get; set; }
        public virtual User Employee { get; set; } = null!;

        public string SalaryMonth { get; set; } = string.Empty; // e.g. "2026-08"
        public decimal BaseSalary { get; set; }
        public int WorkingDays { get; set; }
        public int DaysWorked { get; set; }
        public decimal DailySalary { get; set; }
        public decimal GrossSalary { get; set; }
        public decimal Bonus { get; set; }
        public decimal AdvanceDeduction { get; set; }
        public decimal OtherDeduction { get; set; }
        public decimal CalculatedEntitlement { get; set; }
        public decimal NetSalaryEntitlement { get; set; }

        public decimal TotalPaid { get; set; }
        public decimal RemainingBalance { get; set; }
        public string Status { get; set; } = "Unpaid"; // Unpaid, Partially Paid, Paid, Fully Paid
        public bool IsFinalized { get; set; }
        public DateTime? FinalizedAt { get; set; }
        public string? FinalizedBy { get; set; }
        public string? Remarks { get; set; }

        public virtual ICollection<SalaryPayment> Payments { get; set; } = new List<SalaryPayment>();

        // Auditable
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }

        // Soft Delete
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
