using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Payroll
{
    public class MonthlySalaryDirectoryDto
    {
        public Guid Id { get; set; }
        public string SalaryNo { get; set; } = string.Empty;
        public Guid EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public string SalaryMonth { get; set; } = string.Empty;
        public decimal BaseSalary { get; set; }
        public int WorkingDays { get; set; }
        public int DaysWorked { get; set; }
        public decimal EarnedSalary { get; set; }
        public decimal CalculatedEntitlement { get; set; }
        public decimal NetSalaryEntitlement { get; set; }
        public decimal TotalAdvances { get; set; }
        public decimal TotalSettlements { get; set; }
        public decimal TotalPaid { get; set; }
        public decimal RemainingBalance { get; set; }
        public decimal ExcessAdvance { get; set; }
        public string Status { get; set; } = "Unpaid"; // Unpaid, Partially Paid, Paid, Fully Paid, Overpaid
        public bool IsFinalized { get; set; }
        public DateTime? FinalizedAt { get; set; }
        public string? FinalizedBy { get; set; }
        public int UnworkedDays => Math.Max(0, WorkingDays - DaysWorked);
        public DateTime? LastPaymentDate { get; set; }
        public int PaymentsCount { get; set; }
    }

    public class SalaryPaymentTransactionDto
    {
        public Guid Id { get; set; }
        public Guid MonthlySalaryId { get; set; }
        public string SalaryNo { get; set; } = string.Empty;
        public string PaymentType { get; set; } = "Salary Settlement"; // Salary Advance, Salary Settlement
        public decimal Amount { get; set; }
        public string PaymentMethod { get; set; } = "BankAccount";
        public string PaidFrom { get; set; } = string.Empty;
        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }
        public DateTime PaymentDate { get; set; }
        public string? Remarks { get; set; }
        public string Status { get; set; } = "Paid";
    }

    public class MonthlySalaryDetailsDto : MonthlySalaryDirectoryDto
    {
        public decimal DailySalary { get; set; }
        public decimal GrossSalary { get; set; }
        public decimal Bonus { get; set; }
        public decimal AdvanceDeduction { get; set; }
        public decimal OtherDeduction { get; set; }
        public string? Remarks { get; set; }
        public List<SalaryPaymentTransactionDto> Payments { get; set; } = new List<SalaryPaymentTransactionDto>();
    }

    public class CreateOrGetMonthlySalaryRequest
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

        [Range(0, double.MaxValue, ErrorMessage = "Final Entitlement must be non-negative.")]
        public decimal? FinalEntitlementOverride { get; set; }

        public string? Remarks { get; set; }
    }

    public class ProcessSalaryPaymentRequest
    {
        [Required(ErrorMessage = "Monthly Salary Entitlement ID is required.")]
        public Guid MonthlySalaryId { get; set; }

        [Required(ErrorMessage = "Payment Type is required.")]
        [RegularExpression("^(Salary Advance|Salary Settlement)$", ErrorMessage = "Payment Type must be 'Salary Advance' or 'Salary Settlement'.")]
        public string PaymentType { get; set; } = "Salary Settlement";

        [Required(ErrorMessage = "Payment Amount is required.")]
        [Range(0.01, double.MaxValue, ErrorMessage = "Payment Amount must be greater than zero.")]
        public decimal Amount { get; set; }

        [Required(ErrorMessage = "Payment Method is required.")]
        [RegularExpression("^(BankAccount|CashBook)$", ErrorMessage = "Payment Method must be BankAccount or CashBook.")]
        public string PaymentMethod { get; set; } = "BankAccount";

        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }

        public int? WorkingDays { get; set; }
        public int? DaysWorked { get; set; }
        public decimal? Bonus { get; set; }
        public decimal? AdvanceDeduction { get; set; }
        public decimal? OtherDeduction { get; set; }
        public DateTime? PaymentDate { get; set; }

        public bool ConfirmFinalSettlement { get; set; }
        public bool ForceFinalizeWithUnpaid { get; set; }

        public string? Remarks { get; set; }
    }

    public class FinalizeMonthlySalaryRequest
    {
        [Required(ErrorMessage = "Monthly Salary ID is required.")]
        public Guid MonthlySalaryId { get; set; }

        public bool ForceFinalizeWithUnpaid { get; set; }
        public string? Remarks { get; set; }
    }

    public class UpdateSalaryPaymentTransactionRequest
    {
        [Required(ErrorMessage = "Payment Amount is required.")]
        [Range(0.01, double.MaxValue, ErrorMessage = "Payment Amount must be greater than zero.")]
        public decimal Amount { get; set; }

        [Required(ErrorMessage = "Payment Method is required.")]
        [RegularExpression("^(BankAccount|CashBook)$", ErrorMessage = "Payment Method must be BankAccount or CashBook.")]
        public string PaymentMethod { get; set; } = "BankAccount";

        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }

        public string? Remarks { get; set; }
    }

    // Legacy DTO Aliases for full backward compatibility
    public class SalaryPaymentDto : MonthlySalaryDirectoryDto
    {
        public decimal MonthlySalary => BaseSalary;
        public decimal NetSalary => NetSalaryEntitlement;
        public string PaymentMethod { get; set; } = "BankAccount";
        public string PaidFrom { get; set; } = string.Empty;
        public DateTime PaymentDate { get; set; }
    }

    public class SalaryPaymentDetailsDto : MonthlySalaryDetailsDto
    {
        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }
        public string PaymentMethod { get; set; } = "BankAccount";
        public string PaidFrom { get; set; } = string.Empty;
        public DateTime PaymentDate { get; set; }
    }

    public class CreateSalaryPaymentRequest : CreateOrGetMonthlySalaryRequest
    {
        public string PaymentMethod { get; set; } = "BankAccount";
        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }
        public decimal? PaymentAmount { get; set; }
        public string PaymentType { get; set; } = "Salary Settlement";
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

    public class PayrollDashboardMetricsDto
    {
        public decimal DisbursedThisMonth { get; set; }
        public decimal PaidViaBankThisMonth { get; set; }
        public decimal PaidViaCashThisMonth { get; set; }
        public decimal TotalPendingBalanceThisMonth { get; set; }
    }
}
