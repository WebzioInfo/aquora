using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.Purchase
{
    public class PurchaseSummaryStatsDto
    {
        public int TotalPurchasesCount { get; set; }
        public int TodayPurchasesCount { get; set; }
        public decimal TotalPurchaseValue { get; set; }
        public decimal OutstandingBalance { get; set; }
        public int PendingPaymentsCount { get; set; }
        public int ActiveVendorsCount { get; set; }
    }

    public class PagedPurchasesResponseDto
    {
        public List<PurchaseDto> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public PurchaseSummaryStatsDto SummaryStats { get; set; } = new();
    }

    public class PurchaseDto
    {
        public Guid Id { get; set; }
        public string PurchaseNo { get; set; } = string.Empty;
        public DateTime PurchaseDate { get; set; }

        public Guid? VendorId { get; set; }
        public string VendorName { get; set; } = string.Empty;
        public string? VendorCode { get; set; }

        public string PurchaseCategory { get; set; } = string.Empty;
        public string? InvoiceNumber { get; set; }
        public string? ReferenceNumber { get; set; }

        public string PaymentMethod { get; set; } = "Credit";
        public Guid? BankAccountId { get; set; }
        public string? BankAccountName { get; set; }
        public Guid? CashBookId { get; set; }
        public string? CashBookName { get; set; }

        public decimal SubTotal { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal OtherCharges { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal AmountPaid { get; set; }
        public decimal BalanceAmount { get; set; }

        public string PaymentStatus { get; set; } = "Unpaid";
        public bool IsCancelled { get; set; }
        public DateTime? CancelledAt { get; set; }
        public string? CancelledByName { get; set; }

        public string? Notes { get; set; }
        public string? AttachmentUrl { get; set; }

        public Guid? AssetId { get; set; }
        public string? AssetName { get; set; }

        public string? CategoryMetadataJson { get; set; }

        public List<PurchaseItemDto> Items { get; set; } = new List<PurchaseItemDto>();
        public List<PurchasePaymentDto> Payments { get; set; } = new List<PurchasePaymentDto>();
        public List<PurchaseTimelineEventDto> TimelineEvents { get; set; } = new List<PurchaseTimelineEventDto>();

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string CreatedByName { get; set; } = "Company Administrator";
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedByName { get; set; }
    }

    public class PurchaseItemDto
    {
        public Guid Id { get; set; }
        public Guid PurchaseId { get; set; }
        public Guid? RawMaterialId { get; set; }
        public string? RawMaterialName { get; set; }
        public string ItemName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string Unit { get; set; } = "Pcs";
        public decimal UnitPrice { get; set; }
        public decimal GSTPercent { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TotalAmount { get; set; }
    }

    public class PurchasePaymentDto
    {
        public Guid Id { get; set; }
        public Guid PurchaseId { get; set; }
        public DateTime PaymentDate { get; set; }
        public string PaymentMethod { get; set; } = "BankAccount";
        public Guid? BankAccountId { get; set; }
        public string? BankAccountName { get; set; }
        public Guid? CashBookId { get; set; }
        public string? CashBookName { get; set; }
        public decimal Amount { get; set; }
        public string? ReferenceNo { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string CreatedByName { get; set; } = "Company Administrator";
    }

    public class PurchaseTimelineEventDto
    {
        public Guid Id { get; set; }
        public Guid PurchaseId { get; set; }
        public DateTime EventDate { get; set; }
        public string Action { get; set; } = string.Empty;
        public string PerformedBy { get; set; } = string.Empty;
        public string PerformedByName { get; set; } = "Company Administrator";
        public string Details { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }

    public class AssetHistoryDto
    {
        public Guid Id { get; set; }
        public Guid AssetId { get; set; }
        public DateTime Date { get; set; }
        public string Action { get; set; } = string.Empty;
        public string PerformedBy { get; set; } = string.Empty;
        public string PerformedByName { get; set; } = "Company Administrator";
        public string? PreviousValue { get; set; }
        public string? NewValue { get; set; }
        public string? Remarks { get; set; }
    }

    public class CreatePurchaseRequest
    {
        public DateTime PurchaseDate { get; set; } = DateTime.UtcNow;

        public Guid? VendorId { get; set; }
        public string VendorName { get; set; } = string.Empty;

        public string PurchaseCategory { get; set; } = string.Empty;

        public string? InvoiceNumber { get; set; }
        public string? ReferenceNumber { get; set; }

        public string PaymentMethod { get; set; } = "Credit";
        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }

        public decimal SubTotal { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal OtherCharges { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal AmountPaid { get; set; }

        public string? Notes { get; set; }
        public string? AttachmentUrl { get; set; }

        public string? CategoryMetadataJson { get; set; }

        public List<CreatePurchaseItemRequest> Items { get; set; } = new List<CreatePurchaseItemRequest>();
    }

    public class CreatePurchaseItemRequest
    {
        public Guid? Id { get; set; }
        public Guid? RawMaterialId { get; set; }
        public string ItemName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string Unit { get; set; } = "Pcs";
        public decimal UnitPrice { get; set; }
        public decimal GSTPercent { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TotalAmount { get; set; }
    }

    public class UpdatePurchaseRequest : CreatePurchaseRequest
    {
        public Guid? Id { get; set; }
    }

    public class AddPurchasePaymentRequest
    {
        public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
        public string PaymentMethod { get; set; } = "BankAccount";
        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }
        public decimal Amount { get; set; }
        public string? ReferenceNo { get; set; }
        public string? Notes { get; set; }
    }
}
