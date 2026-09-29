using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class Asset : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        // Identification
        public string AssetCode { get; set; } = string.Empty; // e.g. AST-2026-00001
        public string AssetTag { get; set; } = string.Empty; // Unique tag e.g. MCH-001
        public string AssetName { get; set; } = string.Empty;
        public string AssetCategory { get; set; } = string.Empty; // Machinery, Vehicles, Computers, Laptops, Furniture, Office Equipment, Buildings, Other
        public string? AssetType { get; set; }
        public string? SerialNumber { get; set; }
        public string? ModelNumber { get; set; }
        public string? Manufacturer { get; set; }
        public string? Description { get; set; }

        // Purchase & Financials
        public DateTime PurchaseDate { get; set; }
        public decimal PurchasePrice { get; set; } // Base Purchase Cost
        public Guid? SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public string? PurchaseInvoiceNumber { get; set; }
        public string? PurchaseOrderNumber { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal FreightCost { get; set; }
        public decimal InstallationCost { get; set; }
        public decimal OtherCapitalizedCost { get; set; }
        public decimal TotalCapitalizedCost { get; set; } // Calculated: PurchasePrice + Tax + Freight + Installation + Other

        // Depreciation
        public string DepreciationMethod { get; set; } = "StraightLine"; // StraightLine, WrittenDownValue, None
        public decimal UsefulLifeYears { get; set; } = 5;
        public decimal ResidualValue { get; set; } = 0;
        public DateTime? DepreciationStartDate { get; set; }
        public string DepreciationFrequency { get; set; } = "Yearly"; // Monthly, Yearly
        public decimal DepreciationRate { get; set; }
        public decimal AccumulatedDepreciation { get; set; }
        public decimal CurrentValue { get; set; } // Current Book Value = TotalCapitalizedCost - AccumulatedDepreciation

        // Location & Assignment
        public string? Location { get; set; } // Plant A, Branch B, Head Office
        public string? Department { get; set; } // Production, IT, Accounts, Maintenance
        public Guid? AssignedEmployeeId { get; set; }
        public string? AssignedEmployeeName { get; set; }
        public DateTime? AssignedDate { get; set; }

        // Status & Condition
        public string CurrentStatus { get; set; } = "Active"; // Active, InUse, Available, UnderMaintenance, Damaged, Lost, UnderTransfer, Idle, Disposed, Retired
        public string Condition { get; set; } = "Good"; // Excellent, Good, Fair, NeedsRepair, Damaged, Critical

        // Warranty
        public string? WarrantyDetails { get; set; }
        public DateTime? WarrantyStartDate { get; set; }
        public DateTime? WarrantyEndDate { get; set; }
        public string? WarrantyProvider { get; set; }
        public string? WarrantyNumber { get; set; }
        public string? WarrantyNotes { get; set; }

        // Maintenance Summary
        public DateTime? LastMaintenanceDate { get; set; }
        public DateTime? NextMaintenanceDate { get; set; }
        public decimal TotalMaintenanceCost { get; set; }

        // Disposal / Retirement
        public DateTime? DisposalDate { get; set; }
        public string? DisposalMethod { get; set; } // Sold, Scrapped, WrittenOff, Donated, Lost, Other
        public string? DisposalReason { get; set; }
        public decimal SaleValue { get; set; }
        public decimal DisposalCost { get; set; }
        public string? BuyerParty { get; set; }
        public string? DisposalRefNo { get; set; }
        public string? DisposedBy { get; set; }

        // Attachments / Notes
        public string? Notes { get; set; }
        public string? PhotoUrl { get; set; }
        public string? DocumentUrl { get; set; }

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        [System.ComponentModel.DataAnnotations.ConcurrencyCheck]
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
        
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
