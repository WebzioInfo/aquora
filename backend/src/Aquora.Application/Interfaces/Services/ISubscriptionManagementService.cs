using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Subscriptions;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public interface ISubscriptionManagementService
    {
        Task<PagedResult<SubscriptionPlanDto>> GetPlansAsync(SubscriptionPlanListQuery query);
        Task<SubscriptionPlanDto> GetPlanByIdAsync(Guid planId);
        Task<Guid> CreatePlanAsync(CreateSubscriptionPlanRequest request, string performerUserId, string performerIp);
        Task<bool> UpdatePlanAsync(Guid planId, UpdateSubscriptionPlanRequest request, string performerUserId, string performerIp);
        Task<bool> DeletePlanAsync(Guid planId, string performerUserId, string performerIp);
        Task<Guid> DuplicatePlanAsync(Guid planId, string performerUserId, string performerIp);
        Task<bool> SetPlanStatusAsync(Guid planId, string status, string performerUserId, string performerIp);

        // Feature CRUD
        Task<SubscriptionFeatureDto> AddFeatureAsync(Guid planId, CreateSubscriptionFeatureRequest request, string performerUserId, string performerIp);
        Task<bool> UpdateFeatureAsync(Guid planId, Guid featureId, CreateSubscriptionFeatureRequest request, string performerUserId, string performerIp);
        Task<bool> DeleteFeatureAsync(Guid planId, Guid featureId, string performerUserId, string performerIp);

        // Limits CRUD
        Task<bool> UpdateLimitsAsync(Guid planId, SubscriptionPlanLimitsDto limitsDto, string performerUserId, string performerIp);

        // Tenant Assignment & History
        Task<TenantSubscriptionDto> AssignSubscriptionAsync(AssignTenantSubscriptionRequest request, string performerUserId, string performerIp);
        Task<List<TenantSubscriptionDto>> GetTenantSubscriptionHistoryAsync(Guid tenantId);

        // Analytics & KPIs
        Task<SubscriptionKpiDto> GetSubscriptionKpisAsync();
        Task<List<SubscriptionAuditLogDto>> GetAuditLogsAsync(Guid? planId = null, Guid? tenantId = null);
        Task SeedDefaultPlansAsync();
    }
}
