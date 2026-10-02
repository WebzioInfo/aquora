using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.Purchase
{
    public class VendorDto
    {
        public Guid Id { get; set; }
        public string? VendorCode { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? GST { get; set; }
        public string? Address { get; set; }
        public decimal OpeningBalance { get; set; }
        public decimal CurrentBalance { get; set; }
        public decimal CreditLimit { get; set; }
        public bool IsActive { get; set; } = true;
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedByName { get; set; } = "Company Administrator";

        public int TotalPurchasesCount { get; set; }
        public decimal TotalPurchaseValue { get; set; }
        public DateTime? LastPurchaseDate { get; set; }
    }

    public class CreateVendorRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? GST { get; set; }
        public string? Address { get; set; }
        public decimal OpeningBalance { get; set; }
        public decimal CreditLimit { get; set; }
        public string? Notes { get; set; }
    }

    public class UpdateVendorRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? GST { get; set; }
        public string? Address { get; set; }
        public decimal CreditLimit { get; set; }
        public bool IsActive { get; set; } = true;
        public string? Notes { get; set; }
    }

    public class VendorDropdownDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? GST { get; set; }
        public decimal CurrentBalance { get; set; }
    }

    public class VendorSummaryStatsDto
    {
        public decimal OutstandingBalance { get; set; }
        public int TotalPurchasesCount { get; set; }
        public decimal TotalPurchaseValue { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal PendingAmount { get; set; }
        public decimal AveragePurchaseValue { get; set; }
        public DateTime? LastPurchaseDate { get; set; }
    }

    public class VendorLedgerEntryDto
    {
        public Guid Id { get; set; }
        public DateTime Date { get; set; }
        public string TransactionType { get; set; } = string.Empty; // Purchase Invoice, Payment, Opening Balance
        public string VoucherNo { get; set; } = string.Empty;
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public decimal RunningBalance { get; set; }
        public string? Reference { get; set; }
        public string? Remarks { get; set; }
    }

    public class VendorTimelineEventDto
    {
        public Guid Id { get; set; }
        public DateTime EventDate { get; set; }
        public string Action { get; set; } = string.Empty;
        public string PerformedByName { get; set; } = "Company Administrator";
        public string Details { get; set; } = string.Empty;
    }

    public class VendorDetailsDto
    {
        public VendorDto Vendor { get; set; } = null!;
        public VendorSummaryStatsDto SummaryStats { get; set; } = null!;
        public List<PurchaseDto> Purchases { get; set; } = new();
        public List<VendorLedgerEntryDto> Ledger { get; set; } = new();
        public List<VendorTimelineEventDto> Timeline { get; set; } = new();
    }

    public class RecordVendorPaymentRequest
    {
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
        public string PaymentMethod { get; set; } = "BankAccount"; // "BankAccount" or "Cash"
        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }
        public string? ReferenceNumber { get; set; }
        public string? Notes { get; set; }
    }
}
