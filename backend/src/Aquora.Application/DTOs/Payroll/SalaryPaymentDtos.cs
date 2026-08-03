using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Payroll
{
    public class SalaryPaymentDto
    {
        public Guid Id { get; set; }
        public string SalaryNo { get; set; } = string.Empty;
        public Guid EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public string SalaryMonth { get; set; } = string.Empty;
        public decimal MonthlySalary { get; set; }
        public int WorkingDays { get; set; }
        public int DaysWorked { get; set; }
        public decimal NetSalary { get; set; }
        public string PaymentMethod { get; set; } = "BankAccount";
        public string PaidFrom { get; set; } = string.Empty;
        public DateTime PaymentDate { get; set; }
        public string Status { get; set; } = "Paid";
    }

    public class SalaryPaymentDetailsDto : SalaryPaymentDto
    {
        public decimal DailySalary { get; set; }
        public decimal GrossSalary { get; set; }
        public decimal Bonus { get; set; }
        public decimal AdvanceDeduction { get; set; }
        public decimal OtherDeduction { get; set; }
        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }
        public string? Remarks { get; set; }
    }

    public class CreateSalaryPaymentRequest
    {
        [Required(ErrorMessage = "Employee selection is required.")]
        public Guid EmployeeId { get; set; }

        [Required(ErrorMessage = "Salary Month is required.")]
        [RegularExpression(@"^\d{4}-\d{2}$", ErrorMessage = "Salary Month must be in YYYY-MM format.")]
        public string SalaryMonth { get; set; } = string.Empty;

        [Required(ErrorMessage = "Working Days is required.")]
        [Range(1, 31, ErrorMessage = "Working Days must be between 1 and 31.")]
        public int WorkingDays { get; set; }

        [Required(ErrorMessage = "Days Worked is required.")]
        [Range(0, 31, ErrorMessage = "Days Worked must be between 0 and 31.")]
        public int DaysWorked { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "Bonus must be non-negative.")]
        public decimal Bonus { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "Advance Deduction must be non-negative.")]
        public decimal AdvanceDeduction { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "Other Deduction must be non-negative.")]
        public decimal OtherDeduction { get; set; }

        [Required(ErrorMessage = "Payment Method is required.")]
        [RegularExpression("^(BankAccount|CashBook)$", ErrorMessage = "Payment Method must be BankAccount or CashBook.")]
        public string PaymentMethod { get; set; } = "BankAccount";

        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }

        public string? Remarks { get; set; }
    }

    public class UpdateSalaryPaymentRequest : CreateSalaryPaymentRequest
    {
    }

    public class PayrollFilterDto
    {
        public string? Search { get; set; }
        public string? Month { get; set; }
        public Guid? EmployeeId { get; set; }
    }
}
