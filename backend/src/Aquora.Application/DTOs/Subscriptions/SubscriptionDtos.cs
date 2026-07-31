using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.Subscriptions
{
    public class SubscriptionPlanListQuery
    {
        public string? Search { get; set; }
        public string? StatusFilter { get; set; } // Published, Draft, Archived, Inactive, Expired, Hidden
        public string? BillingCycleFilter { get; set; } // Monthly, Yearly
        public bool? IsPopularFilter { get; set; }
        public bool? IsRecommendedFilter { get; set; }
        public string? SortBy { get; set; } = "DisplayOrder"; // Price, Duration, CreatedAt, UpdatedAt, CompaniesUsing, Name, DisplayOrder
        public string? SortOrder { get; set; } = "asc";
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class SubscriptionFeatureDto
    {
        public Guid Id { get; set; }
        public Guid PlanId { get; set; }
        public string FeatureName { get; set; } = string.Empty;
        public string? FeatureDescription { get; set; }
        public string FeatureCategory { get; set; } = "Core Modules";
        public string FeatureValue { get; set; } = "Yes";
        public string? FeatureUnit { get; set; }
        public int DisplayOrder { get; set; } = 1;
        public bool IsHighlighted { get; set; }
        public bool IsUnlimited { get; set; }
    }

    public class SubscriptionPlanLimitsDto
    {
        public Guid Id { get; set; }
        public Guid PlanId { get; set; }
        public int ProductionLines { get; set; } = 3;
        public int Machines { get; set; } = 10;
        public int Employees { get; set; } = 25;
        public int Customers { get; set; } = 100;
        public int Suppliers { get; set; } = 50;
        public int Warehouses { get; set; } = 2;
        public int ProductionBatches { get; set; } = 500;
        public int Products { get; set; } = 100;
        public int RawMaterials { get; set; } = 200;
        public int StorageGB { get; set; } = 50;
        public int APIRequestsPerMin { get; set; } = 1000;
        public int FileUploadSizeMB { get; set; } = 25;
        public int DailyExports { get; set; } = 50;
        public int ConcurrentUsers { get; set; } = 10;
        public int SMSLimit { get; set; } = 100;
        public int EmailLimit { get; set; } = 1000;
    }

    public class SubscriptionPlanDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        public decimal MonthlyPrice { get; set; }
        public decimal YearlyPrice { get; set; }
        public decimal? OfferPrice { get; set; }
        public decimal? DiscountPercent { get; set; }

        public string Currency { get; set; } = "USD";
        public string BillingCycle { get; set; } = "Monthly";
        public int TrialDays { get; set; } = 14;
        public int DurationDays { get; set; } = 30;

        public int DisplayOrder { get; set; } = 1;
        public bool IsPopular { get; set; }
        public bool IsRecommended { get; set; }
        public string Color { get; set; } = "#3B82F6";

        public string Status { get; set; } = "Published";
        public string TaxType { get; set; } = "Tax Exclusive";
        public bool AutoActivateTrial { get; set; } = true;

        public int CompaniesUsingCount { get; set; }
        public List<SubscriptionFeatureDto> Features { get; set; } = new List<SubscriptionFeatureDto>();
        public SubscriptionPlanLimitsDto Limits { get; set; } = new SubscriptionPlanLimitsDto();

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreateSubscriptionPlanRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        public decimal MonthlyPrice { get; set; }
        public decimal YearlyPrice { get; set; }
        public decimal? OfferPrice { get; set; }
        public decimal? DiscountPercent { get; set; }

        public string Currency { get; set; } = "USD";
        public string BillingCycle { get; set; } = "Monthly";
        public int TrialDays { get; set; } = 14;
        public int DurationDays { get; set; } = 30;

        public int DisplayOrder { get; set; } = 1;
        public bool IsPopular { get; set; }
        public bool IsRecommended { get; set; }
        public string Color { get; set; } = "#3B82F6";

        public string Status { get; set; } = "Published";
        public string TaxType { get; set; } = "Tax Exclusive";
        public bool AutoActivateTrial { get; set; } = true;

        public List<CreateSubscriptionFeatureRequest>? Features { get; set; }
        public SubscriptionPlanLimitsDto? Limits { get; set; }
    }

    public class UpdateSubscriptionPlanRequest : CreateSubscriptionPlanRequest
    {
    }

    public class CreateSubscriptionFeatureRequest
    {
        public string FeatureName { get; set; } = string.Empty;
        public string? FeatureDescription { get; set; }
        public string FeatureCategory { get; set; } = "Core Modules";
        public string FeatureValue { get; set; } = "Yes";
        public string? FeatureUnit { get; set; }
        public int DisplayOrder { get; set; } = 1;
        public bool IsHighlighted { get; set; }
        public bool IsUnlimited { get; set; }
    }

    public class TenantSubscriptionDto
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public Guid PlanId { get; set; }
        public string PlanName { get; set; } = string.Empty;
        public string Status { get; set; } = "Active";
        public string BillingCycle { get; set; } = "Monthly";
        public decimal PricePaid { get; set; }
        public string Currency { get; set; } = "USD";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public DateTime? TrialEndDate { get; set; }
        public bool AutoRenew { get; set; } = true;
        public string? AssignedByUserId { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class AssignTenantSubscriptionRequest
    {
        public Guid TenantId { get; set; }
        public Guid PlanId { get; set; }
        public string BillingCycle { get; set; } = "Monthly";
        public decimal? CustomPrice { get; set; }
        public int? DurationDays { get; set; }
        public bool AutoRenew { get; set; } = true;
        public bool StartTrial { get; set; } = false;
    }

    public class SubscriptionKpiDto
    {
        public int TotalPlans { get; set; }
        public int PublishedPlans { get; set; }
        public int ActiveSubscriptions { get; set; }
        public int ExpiringSoonSubscriptions { get; set; }
        public int TrialPlans { get; set; }
        public decimal TotalRevenue { get; set; }
    }

    public class SubscriptionAuditLogDto
    {
        public Guid Id { get; set; }
        public Guid? PlanId { get; set; }
        public Guid? TenantId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string PerformerUserId { get; set; } = string.Empty;
        public string PerformerUserEmail { get; set; } = string.Empty;
        public string? OldValuesJson { get; set; }
        public string? NewValuesJson { get; set; }
        public string Reason { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public string IpAddress { get; set; } = string.Empty;
    }
}
