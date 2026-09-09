using Aquora.Domain.Common;

namespace Aquora.Domain.Entities;

/// <summary>
/// 20L-specific commercial profile for a customer acting as a distributor.
/// This deliberately extends Customer instead of creating a second party master.
/// </summary>
public class TwentyLDistributorProfile : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public string DistributorType { get; set; } = "EXTERNAL";
    public string JarOwnershipModel { get; set; } = "MIXED";
    public string VehicleOwnership { get; set; } = "DISTRIBUTOR";
    public string RouteOwnership { get; set; } = "DISTRIBUTOR";
    public string PricingModel { get; set; } = "RATE_CARD";
    public string CommissionModel { get; set; } = "NONE";
    public decimal CreditLimit { get; set; }
    public decimal SecurityDeposit { get; set; }
    public string? PaymentTerms { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
    public string? AgreementReference { get; set; }
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

/// <summary>
/// Immutable 20L container ledger. Quantity is always positive; From/To describe the movement.
/// Owner and holder are intentionally independent.
/// </summary>
public class TwentyLJarMovement : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid? ProductId { get; set; }
    public Guid? OwnerCustomerId { get; set; }
    public Guid? FromCustomerId { get; set; }
    public Guid? ToCustomerId { get; set; }
    public string OwnerType { get; set; } = "COMPANY";
    // Holder is the responsible party; location is the physical place. They may differ (e.g. distributor-owned vehicle).
    public string HolderType { get; set; } = "COMPANY";
    public Guid? HolderCustomerId { get; set; }
    public string FromLocationType { get; set; } = "PLANT";
    public string ToLocationType { get; set; } = "PLANT";
    public string? FromLocationReference { get; set; }
    public string? ToLocationReference { get; set; }
    public string MovementType { get; set; } = string.Empty;
    public string ContainerStatus { get; set; } = "EMPTY";
    public int Quantity { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? ReferenceType { get; set; }
    public DateTime OccurredAt { get; set; }
    public string? Reason { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public string? CreatedByIP { get; set; }
    public string? UpdatedByIP { get; set; }
}

/// <summary>Current 20L position projection. It is lockable; the movement ledger remains immutable history.</summary>
public class TwentyLJarPosition : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public string PositionKey { get; set; } = string.Empty;
    public Guid? ProductId { get; set; }
    public string OwnerType { get; set; } = "COMPANY";
    public Guid? OwnerCustomerId { get; set; }
    public string HolderType { get; set; } = "COMPANY";
    public Guid? HolderCustomerId { get; set; }
    public string LocationType { get; set; } = "PLANT";
    public string? LocationReference { get; set; }
    public string ContainerStatus { get; set; } = "EMPTY";
    public int Quantity { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public string? CreatedByIP { get; set; }
    public string? UpdatedByIP { get; set; }
}

/// <summary>Effective-dated rate card. Orders/deliveries retain the resolved rate, never a live lookup.</summary>
public class TwentyLRateRule : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? CustomerId { get; set; }
    public string PartyType { get; set; } = "ANY";
    public string RefillType { get; set; } = "COMPANY_TO_DISTRIBUTOR";
    public string JarOwnerType { get; set; } = "ANY";
    public decimal MinimumQuantity { get; set; } = 1;
    public int Priority { get; set; }
    public decimal UnitRate { get; set; }
    public decimal? DiscountRate { get; set; }
    public decimal? TaxRate { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public bool RequiresAuthorization { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
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

/// <summary>Delivery execution record, separate from a commercial sales transaction.</summary>
public class TwentyLDelivery : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid? DistributorId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? RateRuleId { get; set; }
    public Guid? SalesTransactionId { get; set; }
    public string RefillType { get; set; } = "DIRECT_CUSTOMER_REFILL";
    public string JarOwnerType { get; set; } = "COMPANY";
    public int OrderedQuantity { get; set; }
    public int FilledDeliveredQuantity { get; set; }
    public int EmptyCollectedQuantity { get; set; }
    public int FailedQuantity { get; set; }
    public decimal AppliedUnitRate { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal AmountCollected { get; set; }
    public string PaymentMode { get; set; } = "CREDIT";
    public string Status { get; set; } = "COMPLETED";
    public string? RouteReference { get; set; }
    public string? VehicleReference { get; set; }
    public string? DriverReference { get; set; }
    public DateTime DeliveredAt { get; set; }
    public string? FailureReason { get; set; }
    public string? Notes { get; set; }
    public string? IdempotencyKey { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public string? CreatedByIP { get; set; }
    public string? UpdatedByIP { get; set; }
}

/// <summary>Effective-dated, 20L-only commission rule. It is deliberately separate from legacy customer percentages.</summary>
public class TwentyLCommissionRule : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid? BeneficiaryCustomerId { get; set; }
    public Guid? ProductId { get; set; }
    public string BeneficiaryType { get; set; } = "EMPLOYEE";
    public string CalculationType { get; set; } = "PERCENTAGE";
    public decimal Value { get; set; }
    public decimal MinimumQuantity { get; set; } = 0;
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public int Priority { get; set; }
    public bool IsActive { get; set; } = true;
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

/// <summary>Frozen commission or reversal linked to a delivery; never recomputed in place.</summary>
public class TwentyLCommissionTransaction : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid DeliveryId { get; set; }
    public Guid? RuleId { get; set; }
    public Guid? BeneficiaryCustomerId { get; set; }
    public string BeneficiaryType { get; set; } = "EMPLOYEE";
    public string TransactionType { get; set; } = "EARNED";
    public decimal Amount { get; set; }
    public DateTime OccurredAt { get; set; }
    public Guid? ReversalOfId { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public string? CreatedByIP { get; set; }
    public string? UpdatedByIP { get; set; }
}

/// <summary>
/// First-class 20L Trip entity capturing vehicle/driver multi-stop routes from loading to plant reconciliation.
/// Invariant: Loaded + Collected == Delivered + Damaged + Lost + Returned
/// </summary>
public class TwentyLTrip : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public string TripNumber { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public Guid? DriverCustomerId { get; set; }
    public string VehicleNumber { get; set; } = string.Empty;
    public string? RouteCode { get; set; }
    public DateTime PlannedDate { get; set; }
    public string Status { get; set; } = "PLANNED"; // PLANNED, LOADED, DISPATCHED, IN_TRANSIT, COMPLETED, CANCELLED, RECONCILED
    
    // Physical Jar Balances
    public int LoadedFilledJars { get; set; }
    public int LoadedEmptyJars { get; set; }
    public int DeliveredFilledJars { get; set; }
    public int CollectedEmptyJars { get; set; }
    public int ReturnedFilledJars { get; set; }
    public int ReturnedEmptyJars { get; set; }
    public int DamagedJarsCount { get; set; }
    public int LostJarsCount { get; set; }
    public int CondemnedJarsCount { get; set; }

    // Commercial totals
    public decimal TotalTripRevenue { get; set; }
    public decimal TotalCashCollected { get; set; }

    // Reconciliation & Audit
    public string ReconciliationStatus { get; set; } = "PENDING"; // PENDING, RECONCILED, DISCREPANCY
    public string? DiscrepancyNotes { get; set; }
    public DateTime? DispatchedAt { get; set; }
    public DateTime? ReturnedAt { get; set; }
    public DateTime? ReconciledAt { get; set; }
    public string? ReconciledBy { get; set; }

    public ICollection<TwentyLTripStop> Stops { get; set; } = new List<TwentyLTripStop>();

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

/// <summary>
/// Individual customer stop within a 20L Trip. Supports partial and failed deliveries with explicit reasons.
/// </summary>
public class TwentyLTripStop : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid TripId { get; set; }
    public TwentyLTrip Trip { get; set; } = null!;
    public int StopSequence { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public Guid? ProductId { get; set; }

    public int PlannedFilledJars { get; set; }
    public int DeliveredFilledJars { get; set; }
    public int CollectedEmptyJars { get; set; }
    public int DamagedEmptyJars { get; set; }
    public int LostJars { get; set; }

    public decimal UnitRate { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal AmountCollected { get; set; }
    public string PaymentMode { get; set; } = "CREDIT";
    public string PaymentStatus { get; set; } = "PENDING"; // PENDING, PARTIAL, PAID

    public string Status { get; set; } = "PENDING"; // PENDING, ARRIVED, DELIVERED, PARTIAL, FAILED, SKIPPED
    public string? FailureReason { get; set; }
    public string? Notes { get; set; }
    public DateTime? DeliveredAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public string? CreatedByIP { get; set; }
    public string? UpdatedByIP { get; set; }
}

/// <summary>
/// Generic 20L Business Operation entity representing any physical or commercial event.
/// </summary>
public class TwentyLOperation : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public string OperationNumber { get; set; } = string.Empty;
    public string OperationType { get; set; } = string.Empty; // PLANT_LOADING, DELIVERY, CUSTOMER_RETURN, DISTRIBUTOR_TRANSFER, DRIVER_HANDOVER, PLANT_RETURN, RECEIVING, DAMAGE_LOG, LOSS_LOG, CONDEMNATION, ADJUSTMENT
    public string Stage { get; set; } = "COMPLETED"; // PLANNED, LOADED, DISPATCHED, IN_TRANSIT, ARRIVED, UNLOADING, DELIVERED, EMPTY_COLLECTION, RETURNED, RECEIVED, INSPECTED, COMPLETED, FAILED, CANCELLED

    public Guid? TripId { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? DistributorId { get; set; }
    public string? DriverName { get; set; }
    public string? VehicleNumber { get; set; }
    public Guid? ProductId { get; set; }

    public int QuantityFilled { get; set; }
    public int QuantityEmpty { get; set; }
    public int QuantityDamaged { get; set; }
    public int QuantityLost { get; set; }
    public int QuantityCondemned { get; set; }

    public decimal AppliedRate { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal AmountCollected { get; set; }
    public string PaymentStatus { get; set; } = "PENDING";

    public string Status { get; set; } = "COMPLETED";
    public string? ReferenceNumber { get; set; }
    public string? Reason { get; set; }
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public string? CreatedByIP { get; set; }
    public string? UpdatedByIP { get; set; }
}

/// <summary>
/// Jar Quality & Inspection record for damage assessment, quarantine, repair, or condemnation.
/// </summary>
public class TwentyLJarInspection : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public string InspectionNumber { get; set; } = string.Empty;
    public string ReferenceType { get; set; } = string.Empty; // TRIP, RETURN, RECEIVING, QUARANTINE
    public Guid? ReferenceId { get; set; }

    public string SourceHolderType { get; set; } = "DRIVER"; // DRIVER, CUSTOMER, DISTRIBUTOR, PLANT
    public Guid? SourceHolderId { get; set; }
    public string? SourceHolderName { get; set; }

    public int InspectedCount { get; set; }
    public int ReusableCount { get; set; }
    public int DamagedCount { get; set; }
    public int CondemnedCount { get; set; }

    public string InspectionOutcome { get; set; } = "PASSED"; // PASSED, DAMAGED_QUARANTINE, CONDEMNED, REPAIRED_TO_STOCK
    public string? ResponsibleParty { get; set; } // DRIVER, CUSTOMER, DISTRIBUTOR, PLANT
    public string? DamageReason { get; set; } // CRACKED_NECK, PUNCTURE, CONTAMINATED, SUN_DAMAGED, BROKEN_HANDLE, OTHER
    public string? CondemnationReason { get; set; }
    public string? AuthorizedBy { get; set; }
    public string? DisposalReference { get; set; }
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public string? CreatedByIP { get; set; }
    public string? UpdatedByIP { get; set; }
}

/// <summary>
/// Upstream company-to-distributor supply/refill record.
/// Models the commercial and physical transfer from Aquzio Plant to Distributor.
/// </summary>
public class TwentyLDistributorSupply : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public string SupplyNumber { get; set; } = string.Empty;
    public Guid DistributorId { get; set; }
    public string DistributorName { get; set; } = string.Empty;
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = "20L Water Jar";
    public string Stage { get; set; } = "COMPLETED"; // CREATED, LOADING, DISPATCHED, RECEIVED, COMPLETED, CANCELLED
    public int QuantityRequested { get; set; }
    public int QuantitySupplied { get; set; } // Filled jars supplied
    public int QuantityEmptyReturned { get; set; } // Empty jars returned by distributor to plant
    public int QuantityDamaged { get; set; } // Damaged jars returned/found
    public decimal AppliedRate { get; set; } // Company Refill Rate ₹X
    public decimal TotalAmount { get; set; } // QuantitySupplied * AppliedRate
    public decimal AmountPaid { get; set; }
    public string PaymentStatus { get; set; } = "PENDING"; // PENDING, PARTIAL, PAID
    public string? PaymentMode { get; set; }
    public string? VehicleNumber { get; set; }
    public string? DriverName { get; set; }
    public string? DispatcherNotes { get; set; }
    public string? ReceiverNotes { get; set; }
    public DateTime? DispatchedAt { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public string? CreatedByIP { get; set; }
    public string? UpdatedByIP { get; set; }
}

/// <summary>
/// Routes owned and managed by a distributor for downstream customer distribution.
/// </summary>
public class TwentyLDistributorRoute : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid DistributorId { get; set; }
    public string RouteCode { get; set; } = string.Empty;
    public string RouteName { get; set; } = string.Empty;
    public string? AreaDescription { get; set; }
    public string? DefaultDriverName { get; set; }
    public string? DefaultVehicleNumber { get; set; }
    public string ScheduleDays { get; set; } = "DAILY";
    public bool IsActive { get; set; } = true;
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

/// <summary>
/// Fleet vehicles owned or operated by a distributor.
/// </summary>
public class TwentyLDistributorVehicle : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid DistributorId { get; set; }
    public string RegistrationNumber { get; set; } = string.Empty;
    public string VehicleType { get; set; } = "MINI_TRUCK"; // MINI_TRUCK, AUTO_RICKSHAW, VAN, TATA_ACE, PICKUP
    public int CapacityJars { get; set; } = 50;
    public string? AssignedDriverName { get; set; }
    public bool IsActive { get; set; } = true;
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

/// <summary>
/// Delivery drivers employed by or associated with a distributor.
/// </summary>
public class TwentyLDistributorDriver : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid DistributorId { get; set; }
    public string DriverName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? LicenseNumber { get; set; }
    public string? AssignedVehicleNumber { get; set; }
    public Guid? CurrentRouteId { get; set; }
    public bool IsActive { get; set; } = true;
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

/// <summary>
/// Downstream customers belonging exclusively to a distributor.
/// </summary>
public class TwentyLDistributorCustomer : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid DistributorId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Area { get; set; }
    public Guid? RouteId { get; set; }
    public string? RouteName { get; set; }
    public string DeliveryFrequency { get; set; } = "DAILY"; // DAILY, ALTERNATE_DAYS, WEEKLY, ON_DEMAND
    public decimal DefaultRate { get; set; } = 40; // Distributor Selling Rate ₹Y
    public string? AssignedDriverName { get; set; }
    public string? AssignedVehicleNumber { get; set; }
    public int FilledJarsHeld { get; set; }
    public int EmptyJarsHeld { get; set; }
    public decimal SecurityDeposit { get; set; }
    public decimal OutstandingBalance { get; set; }
    public bool IsActive { get; set; } = true;
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

/// <summary>
/// Downstream delivery record from Distributor to their Customer.
/// Records the distributor selling rate, cost snapshot, and gross margin.
/// </summary>
public class TwentyLDistributorDelivery : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public string DeliveryNumber { get; set; } = string.Empty;
    public Guid DistributorId { get; set; }
    public Guid DistributorCustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public Guid? RouteId { get; set; }
    public string? RouteName { get; set; }
    public string? DriverName { get; set; }
    public string? VehicleNumber { get; set; }
    public Guid? ProductId { get; set; }
    public int QuantityFilledDelivered { get; set; }
    public int QuantityEmptyCollected { get; set; }
    public int QuantityDamaged { get; set; }
    public decimal SellingRate { get; set; } // ₹Y (what customer pays distributor)
    public decimal CompanyRefillRate { get; set; } // ₹X (company supply rate snapshot)
    public decimal TotalAmount { get; set; } // QuantityFilledDelivered * SellingRate
    public decimal AmountCollected { get; set; }
    public string PaymentMode { get; set; } = "CASH";
    public string PaymentStatus { get; set; } = "PAID";
    public decimal GrossMargin { get; set; } // (SellingRate - CompanyRefillRate) * QuantityFilledDelivered
    public DateTime DeliveryDate { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public string? CreatedByIP { get; set; }
    public string? UpdatedByIP { get; set; }
}


