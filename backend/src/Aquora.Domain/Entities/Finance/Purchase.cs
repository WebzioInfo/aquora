using System;
using System.Collections.Generic;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class Purchase : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string PurchaseNo { get; set; } = string.Empty; // e.g. PUR-2026-000001
        public DateTime PurchaseDate { get; set; }

        public Guid? VendorId { get; set; }
        public virtual Vendor? Vendor { get; set; }
        public string VendorName { get; set; } = string.Empty;

        // Categories: RawMaterial, Machine, OfficeAsset, OfficeExpense, Service, Maintenance, Utility, Vehicle, Software, Other
        public string PurchaseCategory { get; set; } = string.Empty;

        public string? InvoiceNumber { get; set; }
        public string? ReferenceNumber { get; set; }

        // Payment Details
        public string PaymentMethod { get; set; } = "Credit"; // Cash, BankAccount, Credit, UPI, Cheque
        public Guid? BankAccountId { get; set; }
        public virtual BankAccount? BankAccount { get; set; }
        public Guid? CashBookId { get; set; }
        public virtual CashBook? CashBook { get; set; }

        // Amounts
        public decimal SubTotal { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal OtherCharges { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal AmountPaid { get; set; }
        public decimal BalanceAmount { get; set; }

        // GST & Tax Breakdown Snapshot
        public string TaxMode { get; set; } = "GST"; // GST, NonGST
        public decimal GSTRate { get; set; } = 0m;
        public decimal TaxableAmount { get; set; } = 0m;
        public decimal CGSTAmount { get; set; } = 0m;
        public decimal SGSTAmount { get; set; } = 0m;
        public decimal IGSTAmount { get; set; } = 0m;
        public bool IsGstOverridden { get; set; } = false;
        public bool IsInclusiveTax { get; set; } = false;
        public bool IsInterState { get; set; } = false;

        // Status: Paid, PartiallyPaid, Unpaid, Cancelled
        public string PaymentStatus { get; set; } = "Unpaid";
        public bool IsCancelled { get; set; }
        public DateTime? CancelledAt { get; set; }
        public string? CancelledBy { get; set; }

        public string? Notes { get; set; }
        public string? AttachmentUrl { get; set; }

        // Asset Link (if Category is Machine or OfficeAsset)
        public Guid? AssetId { get; set; }
        public virtual Asset? Asset { get; set; }

        // Category-Specific Metadata JSON or fields
        public string? CategoryMetadataJson { get; set; }

        public virtual ICollection<PurchaseItem> Items { get; set; } = new List<PurchaseItem>();
        public virtual ICollection<PurchasePayment> Payments { get; set; } = new List<PurchasePayment>();
        public virtual ICollection<PurchaseTimelineEvent> TimelineEvents { get; set; } = new List<PurchaseTimelineEvent>();

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }

        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
