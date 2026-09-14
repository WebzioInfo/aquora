using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.SimpleAccounts
{
    // ==========================================
    // 1. EXPENSE DTOs
    // ==========================================
    public class SimpleExpenseDto
    {
        public Guid Id { get; set; }
        public string ExpenseNumber { get; set; } = string.Empty;
        public DateTime ExpenseDate { get; set; }
        public string Category { get; set; } = string.Empty;
        public string? Vendor { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string PaymentMethod { get; set; } = string.Empty;
        public Guid? BankAccountId { get; set; }
        public string? BankAccountName { get; set; }
        public Guid? CashBookId { get; set; }
        public string? CashBookName { get; set; }
        public string PaidFrom { get; set; } = "Cash";
        public string? Notes { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string CreatedById { get; set; } = string.Empty;
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
    }

    public class CreateSimpleExpenseRequest
    {
        public DateTime ExpenseDate { get; set; } = DateTime.UtcNow;

        [Required(ErrorMessage = "Category is required.")]
        public string Category { get; set; } = string.Empty; // Salary, Electricity, Fuel, Maintenance, Vehicle, Rent, Office, Purchase Related, Miscellaneous

        public string? Vendor { get; set; }

        [Required(ErrorMessage = "Description is required.")]
        public string Description { get; set; } = string.Empty;

        [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero.")]
        public decimal Amount { get; set; }

        [Required(ErrorMessage = "Payment method is required.")]
        public string PaymentMethod { get; set; } = "Cash"; // Cash or Bank

        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }

        public string? Notes { get; set; }
    }

    public class UpdateSimpleExpenseRequest
    {
        public DateTime ExpenseDate { get; set; }

        [Required(ErrorMessage = "Category is required.")]
        public string Category { get; set; } = string.Empty;

        public string? Vendor { get; set; }

        [Required(ErrorMessage = "Description is required.")]
        public string Description { get; set; } = string.Empty;

        [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero.")]
        public decimal Amount { get; set; }

        [Required(ErrorMessage = "Payment method is required.")]
        public string PaymentMethod { get; set; } = "Cash";

        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }

        public string? Notes { get; set; }
    }

    // ==========================================
    // 2. BANK ACCOUNT DTOs
    // ==========================================
    public class BankAccountDto
    {
        public Guid Id { get; set; }
        public string BankName { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public string AccountNumber { get; set; } = string.Empty;
        public string IfscCode { get; set; } = string.Empty;
        public decimal OpeningBalance { get; set; }
        public decimal CurrentBalance { get; set; }
        public string? Notes { get; set; }
        public string Status { get; set; } = "Active"; // Active, Inactive
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
    }

    public class CreateBankAccountRequest
    {
        [Required(ErrorMessage = "Bank name is required.")]
        public string BankName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Account name is required.")]
        public string AccountName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Account number is required.")]
        public string AccountNumber { get; set; } = string.Empty;

        [Required(ErrorMessage = "IFSC code is required.")]
        public string IfscCode { get; set; } = string.Empty;

        [Range(0, double.MaxValue, ErrorMessage = "Opening balance cannot be negative.")]
        public decimal OpeningBalance { get; set; } = 0m;

        public string? Notes { get; set; }

        public string Status { get; set; } = "Active";
    }

    public class UpdateBankAccountRequest
    {
        [Required(ErrorMessage = "Bank name is required.")]
        public string BankName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Account name is required.")]
        public string AccountName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Account number is required.")]
        public string AccountNumber { get; set; } = string.Empty;

        [Required(ErrorMessage = "IFSC code is required.")]
        public string IfscCode { get; set; } = string.Empty;

        public string? Notes { get; set; }

        public string Status { get; set; } = "Active";
    }

    public class BankAccountDropdownDto
    {
        public Guid Id { get; set; }
        public string BankName { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public string AccountNumber { get; set; } = string.Empty;
        public decimal CurrentBalance { get; set; }
    }


    public class CashBookDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal OpeningBalance { get; set; }
        public decimal CurrentBalance { get; set; }
        public string Status { get; set; } = "Active";
        public string? Notes { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class CreateCashBookRequest
    {
        [Required(ErrorMessage = "Cash book name is required.")]
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Range(0, double.MaxValue, ErrorMessage = "Opening balance cannot be negative.")]
        public decimal OpeningBalance { get; set; } = 0m;
        public string Status { get; set; } = "Active";
        public string? Notes { get; set; }
    }

    public class UpdateCashBookRequest
    {
        [Required(ErrorMessage = "Cash book name is required.")]
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Status { get; set; } = "Active";
        public string? Notes { get; set; }
    }

    public class CashBookDropdownDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal CurrentBalance { get; set; }
    }

    // ==========================================
    // 3. OWNER & INVESTMENT DTOs
    // ==========================================
    public class OwnerDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
        public decimal OwnershipPercentage { get; set; }
        public decimal InitialInvestment { get; set; }
        public decimal CurrentInvestment { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public List<OwnerInvestmentTransactionDto> Transactions { get; set; } = new();
    }

    public class CreateOwnerRequest
    {
        [Required(ErrorMessage = "Owner name is required.")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Phone number is required.")]
        public string Phone { get; set; } = string.Empty;

        public string? Email { get; set; }

        [Range(0, 100, ErrorMessage = "Ownership percentage must be between 0 and 100.")]
        public decimal OwnershipPercentage { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "Initial investment cannot be negative.")]
        public decimal InitialInvestment { get; set; }

        public string? Notes { get; set; }
    }

    public class UpdateOwnerRequest
    {
        [Required(ErrorMessage = "Owner name is required.")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Phone number is required.")]
        public string Phone { get; set; } = string.Empty;

        public string? Email { get; set; }

        [Range(0, 100, ErrorMessage = "Ownership percentage must be between 0 and 100.")]
        public decimal OwnershipPercentage { get; set; }

        public string? Notes { get; set; }
    }

    public class OwnerInvestmentTransactionDto
    {
        public Guid Id { get; set; }
        public Guid OwnerId { get; set; }
        public string OwnerName { get; set; } = string.Empty;
        public DateTime TransactionDate { get; set; }
        public decimal Amount { get; set; }
        public string TransactionType { get; set; } = "Investment"; // Investment, Withdrawal
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
    }

    public class CreateOwnerInvestmentTransactionRequest
    {
        public DateTime TransactionDate { get; set; } = DateTime.UtcNow;

        [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero.")]
        public decimal Amount { get; set; }

        [Required(ErrorMessage = "Transaction type is required.")]
        public string TransactionType { get; set; } = "Investment"; // Investment or Withdrawal

        public string? Notes { get; set; }
    }

    public class OwnerSummaryDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal OwnershipPercentage { get; set; }
        public decimal InitialInvestment { get; set; }
        public decimal CurrentInvestment { get; set; }
        public decimal TotalInvested { get; set; }
        public decimal TotalWithdrawn { get; set; }
    }

    public class CompanyTotalInvestmentDto
    {
        public decimal TotalInitialInvestment { get; set; }
        public decimal TotalCurrentInvestment { get; set; }
        public decimal TotalAdditionalInvested { get; set; }
        public decimal TotalWithdrawn { get; set; }
        public int TotalOwners { get; set; }
    }

    // ==========================================
    // 4. ASSET SUMMARY DTOs
    // ==========================================
    public class CategoryAssetSummaryDto
    {
        public decimal TotalQuantity { get; set; }
        public decimal AverageUnitCost { get; set; }
        public decimal TotalStockValue { get; set; }
    }

    public class AssetSummaryDto
    {
        public CategoryAssetSummaryDto FinishedGoods { get; set; } = new();
        public CategoryAssetSummaryDto RawMaterials { get; set; } = new();
        public decimal TotalFinishedGoodsValue { get; set; }
        public decimal TotalRawMaterialValue { get; set; }
        public decimal CombinedInventoryValue { get; set; }
    }

    // ==========================================
    // 5. DASHBOARD SUMMARY DTO
    // ==========================================
    public class SimpleAccountsDashboardSummaryDto
    {
        public decimal TodaysExpense { get; set; }
        public decimal ThisWeekExpense { get; set; }
        public decimal ThisMonthExpense { get; set; }
        public decimal OutstandingSales { get; set; }
        public decimal TodaysSales { get; set; }
        public decimal TodaysReturn { get; set; }
        public decimal TodaysDamage { get; set; }
        public decimal FinishedGoodsValue { get; set; }
        public decimal RawMaterialValue { get; set; }
        public decimal TotalInventoryValue { get; set; }
        public decimal CompanyInvestment { get; set; }

        public decimal CashBalance { get; set; }
        public decimal TotalBankBalance { get; set; }
        public decimal TotalExpenses { get; set; }
    }
}
