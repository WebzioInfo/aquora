using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Purchase
{
    public class PurchaseCategoryDto
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Treatment { get; set; } = "Expense"; // "Inventory", "Asset", "Expense"
        public bool IsSystem { get; set; }
        public bool IsActive { get; set; }

        // Category Configuration Architecture
        public string? DefaultLedgerAccount { get; set; }
        public bool AffectsInventory { get; set; }
        public bool RequiresAsset { get; set; }
        public bool RequiresExpense { get; set; }
        public bool AffectsVendorLedger { get; set; } = true;
        public bool IsGstApplicable { get; set; } = true;
        public decimal DefaultGstRate { get; set; } = 18.0m;
        public bool AllowGstRateChange { get; set; } = true;
        public bool AllowCustomGstRate { get; set; } = true;
        public bool RequireQuantity { get; set; }
        public bool RequireUnit { get; set; }
        public bool RequireItem { get; set; }
        public bool RequireServiceDescription { get; set; }
        public bool RequireAssetDetails { get; set; }
        public bool RequireInvoiceNumber { get; set; }
        public bool RequireVendor { get; set; } = true;
        public bool RequirePaymentDetails { get; set; } = true;

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreatePurchaseCategoryRequest
    {
        [Required(ErrorMessage = "Category name is required.")]
        [StringLength(100, ErrorMessage = "Category name cannot exceed 100 characters.")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Purchase treatment is required.")]
        [RegularExpression("^(Inventory|Asset|Expense)$", ErrorMessage = "Treatment must be 'Inventory', 'Asset', or 'Expense'.")]
        public string Treatment { get; set; } = "Expense";

        public string? Description { get; set; }

        public string? DefaultLedgerAccount { get; set; }
        public bool AffectsInventory { get; set; } = false;
        public bool RequiresAsset { get; set; } = false;
        public bool RequiresExpense { get; set; } = false;
        public bool AffectsVendorLedger { get; set; } = true;
        public bool IsGstApplicable { get; set; } = true;
        public decimal DefaultGstRate { get; set; } = 18.0m;
        public bool AllowGstRateChange { get; set; } = true;
        public bool AllowCustomGstRate { get; set; } = true;
        public bool RequireQuantity { get; set; } = false;
        public bool RequireUnit { get; set; } = false;
        public bool RequireItem { get; set; } = false;
        public bool RequireServiceDescription { get; set; } = false;
        public bool RequireAssetDetails { get; set; } = false;
        public bool RequireInvoiceNumber { get; set; } = false;
        public bool RequireVendor { get; set; } = true;
        public bool RequirePaymentDetails { get; set; } = true;
    }

    public class UpdatePurchaseCategoryRequest
    {
        [Required(ErrorMessage = "Category name is required.")]
        [StringLength(100, ErrorMessage = "Category name cannot exceed 100 characters.")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Purchase treatment is required.")]
        [RegularExpression("^(Inventory|Asset|Expense)$", ErrorMessage = "Treatment must be 'Inventory', 'Asset', or 'Expense'.")]
        public string Treatment { get; set; } = "Expense";

        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;

        public string? DefaultLedgerAccount { get; set; }
        public bool AffectsInventory { get; set; } = false;
        public bool RequiresAsset { get; set; } = false;
        public bool RequiresExpense { get; set; } = false;
        public bool AffectsVendorLedger { get; set; } = true;
        public bool IsGstApplicable { get; set; } = true;
        public decimal DefaultGstRate { get; set; } = 18.0m;
        public bool AllowGstRateChange { get; set; } = true;
        public bool AllowCustomGstRate { get; set; } = true;
        public bool RequireQuantity { get; set; } = false;
        public bool RequireUnit { get; set; } = false;
        public bool RequireItem { get; set; } = false;
        public bool RequireServiceDescription { get; set; } = false;
        public bool RequireAssetDetails { get; set; } = false;
        public bool RequireInvoiceNumber { get; set; } = false;
        public bool RequireVendor { get; set; } = true;
        public bool RequirePaymentDetails { get; set; } = true;
    }
}
