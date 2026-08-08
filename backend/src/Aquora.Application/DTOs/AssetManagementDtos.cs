using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs
{
    public class DetailedAssetDto
    {
        public Guid Id { get; set; }
        public string AssetCode { get; set; } = string.Empty;
        public string AssetTag { get; set; } = string.Empty;
        public string AssetName { get; set; } = string.Empty;
        public string AssetCategory { get; set; } = string.Empty;
        public string? AssetType { get; set; }
        public string? SerialNumber { get; set; }
        public string? ModelNumber { get; set; }
        public string? Manufacturer { get; set; }
        public string? Description { get; set; }

        public DateTime PurchaseDate { get; set; }
        public decimal PurchasePrice { get; set; }
        public Guid? SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public string? PurchaseInvoiceNumber { get; set; }
        public string? PurchaseOrderNumber { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal FreightCost { get; set; }
        public decimal InstallationCost { get; set; }
        public decimal OtherCapitalizedCost { get; set; }
        public decimal TotalCapitalizedCost { get; set; }

        public string DepreciationMethod { get; set; } = "StraightLine";
        public decimal UsefulLifeYears { get; set; } = 5;
        public decimal ResidualValue { get; set; } = 0;
        public DateTime? DepreciationStartDate { get; set; }
        public string DepreciationFrequency { get; set; } = "Yearly";
        public decimal DepreciationRate { get; set; }
        public decimal AccumulatedDepreciation { get; set; }
        public decimal CurrentValue { get; set; }

        public string? Location { get; set; }
        public string? Department { get; set; }
        public Guid? AssignedEmployeeId { get; set; }
        public string? AssignedEmployeeName { get; set; }
        public DateTime? AssignedDate { get; set; }

        public string CurrentStatus { get; set; } = "Active";
        public string Condition { get; set; } = "Good";

        public string? WarrantyDetails { get; set; }
        public DateTime? WarrantyStartDate { get; set; }
        public DateTime? WarrantyEndDate { get; set; }
        public string? WarrantyProvider { get; set; }
        public string? WarrantyNumber { get; set; }
        public string? WarrantyNotes { get; set; }
        public bool IsWarrantyActive { get; set; }
        public bool IsWarrantyExpiringSoon { get; set; }

        public DateTime? LastMaintenanceDate { get; set; }
        public DateTime? NextMaintenanceDate { get; set; }
        public decimal TotalMaintenanceCost { get; set; }

        public DateTime? DisposalDate { get; set; }
        public string? DisposalMethod { get; set; }
        public string? DisposalReason { get; set; }
        public decimal SaleValue { get; set; }
        public decimal DisposalCost { get; set; }
        public string? BuyerParty { get; set; }
        public string? DisposalRefNo { get; set; }
        public string? DisposedBy { get; set; }

        public string? Notes { get; set; }
        public string? PhotoUrl { get; set; }
        public string? DocumentUrl { get; set; }

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
    }

    public class CreateAssetRequest
    {
        public string? AssetTag { get; set; }
        public string AssetName { get; set; } = string.Empty;
        public string AssetCategory { get; set; } = string.Empty;
        public string? AssetType { get; set; }
        public string? SerialNumber { get; set; }
        public string? ModelNumber { get; set; }
        public string? Manufacturer { get; set; }
        public string? Description { get; set; }

        public DateTime PurchaseDate { get; set; } = DateTime.UtcNow;
        public decimal PurchasePrice { get; set; }
        public Guid? SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public string? PurchaseInvoiceNumber { get; set; }
        public string? PurchaseOrderNumber { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal FreightCost { get; set; }
        public decimal InstallationCost { get; set; }
        public decimal OtherCapitalizedCost { get; set; }

        public string DepreciationMethod { get; set; } = "StraightLine";
        public decimal UsefulLifeYears { get; set; } = 5;
        public decimal ResidualValue { get; set; } = 0;
        public DateTime? DepreciationStartDate { get; set; }
        public string DepreciationFrequency { get; set; } = "Yearly";

        public string? Location { get; set; }
        public string? Department { get; set; }
        public Guid? AssignedEmployeeId { get; set; }
        public string? AssignedEmployeeName { get; set; }

        public string Condition { get; set; } = "Good";

        public DateTime? WarrantyStartDate { get; set; }
        public DateTime? WarrantyEndDate { get; set; }
        public string? WarrantyProvider { get; set; }
        public string? WarrantyNumber { get; set; }
        public string? WarrantyNotes { get; set; }

        public string? Notes { get; set; }
    }

    public class UpdateAssetRequest
    {
        public string AssetName { get; set; } = string.Empty;
        public string AssetCategory { get; set; } = string.Empty;
        public string? AssetType { get; set; }
        public string? SerialNumber { get; set; }
        public string? ModelNumber { get; set; }
        public string? Manufacturer { get; set; }
        public string? Description { get; set; }
        public string? Location { get; set; }
        public string? Department { get; set; }
        public string Condition { get; set; } = "Good";
        public string CurrentStatus { get; set; } = "Active";
        public string? Notes { get; set; }
    }

    public class AssignAssetRequest
    {
        public Guid? EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string? Department { get; set; }
        public DateTime AssignmentDate { get; set; } = DateTime.UtcNow;
        public string? Notes { get; set; }
    }

    public class TransferAssetRequest
    {
        public string FromLocation { get; set; } = string.Empty;
        public string ToLocation { get; set; } = string.Empty;
        public string? FromEmployee { get; set; }
        public string? ToEmployee { get; set; }
        public DateTime TransferDate { get; set; } = DateTime.UtcNow;
        public string Reason { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }

    public class RecordMaintenanceRequest
    {
        public string MaintenanceType { get; set; } = "Preventive"; // Scheduled, Preventive, Corrective, Repair
        public DateTime MaintenanceDate { get; set; } = DateTime.UtcNow;
        public string ServiceProvider { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal PartsCost { get; set; }
        public decimal LabourCost { get; set; }
        public decimal OtherCost { get; set; }
        public DateTime? NextMaintenanceDate { get; set; }
        public bool IsWarrantyClaim { get; set; }
        public string? TechnicianName { get; set; }
        public string? Notes { get; set; }
    }

    public class AssetMaintenanceRecordDto
    {
        public Guid Id { get; set; }
        public Guid AssetId { get; set; }
        public string MaintenanceType { get; set; } = string.Empty;
        public DateTime MaintenanceDate { get; set; }
        public string ServiceProvider { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal PartsCost { get; set; }
        public decimal LabourCost { get; set; }
        public decimal OtherCost { get; set; }
        public decimal TotalCost { get; set; }
        public DateTime? NextMaintenanceDate { get; set; }
        public bool IsWarrantyClaim { get; set; }
        public string? TechnicianName { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
    }

    public class DisposeAssetRequest
    {
        public DateTime DisposalDate { get; set; } = DateTime.UtcNow;
        public string DisposalMethod { get; set; } = "Scrapped"; // Sold, Scrapped, WrittenOff, Donated, Lost, Other
        public string Reason { get; set; } = string.Empty;
        public decimal SaleValue { get; set; }
        public decimal DisposalCost { get; set; }
        public string? BuyerParty { get; set; }
        public string? ReferenceNumber { get; set; }
        public string? Notes { get; set; }
    }

    public class BulkAssetStatusRequest
    {
        public List<Guid> AssetIds { get; set; } = new();
        public string Status { get; set; } = "Active";
        public string? Location { get; set; }
        public string? Reason { get; set; }
    }

    public class AssetKpiSummaryDto
    {
        public int TotalAssetsCount { get; set; }
        public int ActiveAssetsCount { get; set; }
        public decimal TotalAssetValue { get; set; }
        public decimal CurrentBookValue { get; set; }
        public decimal AccumulatedDepreciation { get; set; }
        public int UnderMaintenanceCount { get; set; }
        public int DisposedCount { get; set; }
        public int WarrantyExpiringCount { get; set; }
    }

    public class AssetImportRow
    {
        public string AssetName { get; set; } = string.Empty;
        public string AssetCategory { get; set; } = string.Empty;
        public string? AssetTag { get; set; }
        public string? SerialNumber { get; set; }
        public decimal PurchaseCost { get; set; }
        public string? PurchaseDate { get; set; }
        public string? Location { get; set; }
        public string? Department { get; set; }
        public string? Status { get; set; }
        public string? Condition { get; set; }
    }

    public class AssetImportResult
    {
        public int TotalRows { get; set; }
        public int ImportedCount { get; set; }
        public List<string> RowErrors { get; set; } = new();
    }

    public class AssetPagedResultDto
    {
        public List<DetailedAssetDto> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
    }
}
