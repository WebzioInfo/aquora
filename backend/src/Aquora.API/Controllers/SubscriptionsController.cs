using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.DTOs.Subscriptions;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class SubscriptionsController : ApiControllerBase
    {
        private readonly ISubscriptionManagementService _subscriptionService;

        public SubscriptionsController(ISubscriptionManagementService subscriptionService)
        {
            _subscriptionService = subscriptionService;
        }

        private bool IsSuperAdmin()
        {
            var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
            var isPlatformAdminClaim = User.FindFirst("isPlatformAdmin")?.Value;
            return roles.Contains("SuperAdmin") || roles.Contains("PlatformAdmin") || isPlatformAdminClaim == "True";
        }

        private string GetUserId()
        {
            return User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value ?? "System";
        }

        private string GetClientIp()
        {
            return HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        }

        [HttpGet("plans")]
        public async Task<ActionResult<ApiResponse<PagedResult<SubscriptionPlanDto>>>> GetPlans([FromQuery] SubscriptionPlanListQuery query)
        {
            var result = await _subscriptionService.GetPlansAsync(query);
            return Success(result, "Subscription plans loaded successfully.");
        }

        [HttpGet("plans/{id:guid}")]
        public async Task<ActionResult<ApiResponse<SubscriptionPlanDto>>> GetPlanById(Guid id)
        {
            try
            {
                var result = await _subscriptionService.GetPlanByIdAsync(id);
                return Success(result, "Subscription plan details loaded.");
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(Failure<SubscriptionPlanDto>(ex.Message, "Not Found"));
            }
        }

        [HttpPost("plans")]
        public async Task<ActionResult<ApiResponse<Guid>>> CreatePlan([FromBody] CreateSubscriptionPlanRequest request)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<Guid>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var planId = await _subscriptionService.CreatePlanAsync(request, GetUserId(), GetClientIp());
                return Success(planId, "Subscription plan created successfully.");
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(Failure<Guid>(ex.Message, "Plan Conflict"));
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<Guid>(ex.Message, "Plan Creation Failed"));
            }
        }

        [HttpPut("plans/{id:guid}")]
        public async Task<ActionResult<ApiResponse<bool>>> UpdatePlan(Guid id, [FromBody] UpdateSubscriptionPlanRequest request)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<bool>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var success = await _subscriptionService.UpdatePlanAsync(id, request, GetUserId(), GetClientIp());
                return Success(success, "Subscription plan updated successfully.");
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(Failure<bool>(ex.Message, "Plan Not Found"));
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<bool>(ex.Message, "Plan Update Failed"));
            }
        }

        [HttpDelete("plans/{id:guid}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeletePlan(Guid id)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<bool>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var success = await _subscriptionService.DeletePlanAsync(id, GetUserId(), GetClientIp());
                return Success(success, "Subscription plan deleted successfully.");
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(Failure<bool>(ex.Message, "Plan In Use Exception"));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(Failure<bool>(ex.Message, "Plan Not Found"));
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<bool>(ex.Message, "Plan Delete Failed"));
            }
        }

        [HttpPost("plans/{id:guid}/duplicate")]
        public async Task<ActionResult<ApiResponse<Guid>>> DuplicatePlan(Guid id)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<Guid>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var newPlanId = await _subscriptionService.DuplicatePlanAsync(id, GetUserId(), GetClientIp());
                return Success(newPlanId, "Subscription plan duplicated successfully.");
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<Guid>(ex.Message, "Plan Duplication Failed"));
            }
        }

        [HttpPatch("plans/{id:guid}/status")]
        public async Task<ActionResult<ApiResponse<bool>>> SetPlanStatus(Guid id, [FromQuery] string status)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<bool>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var success = await _subscriptionService.SetPlanStatusAsync(id, status, GetUserId(), GetClientIp());
                return Success(success, $"Plan status set to '{status}'.");
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<bool>(ex.Message, "Set Plan Status Failed"));
            }
        }

        [HttpPost("plans/{planId:guid}/features")]
        public async Task<ActionResult<ApiResponse<SubscriptionFeatureDto>>> AddFeature(Guid planId, [FromBody] CreateSubscriptionFeatureRequest request)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<SubscriptionFeatureDto>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var feature = await _subscriptionService.AddFeatureAsync(planId, request, GetUserId(), GetClientIp());
                return Success(feature, "Feature added successfully.");
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<SubscriptionFeatureDto>(ex.Message, "Add Feature Failed"));
            }
        }

        [HttpPut("plans/{planId:guid}/features/{featureId:guid}")]
        public async Task<ActionResult<ApiResponse<bool>>> UpdateFeature(Guid planId, Guid featureId, [FromBody] CreateSubscriptionFeatureRequest request)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<bool>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var success = await _subscriptionService.UpdateFeatureAsync(planId, featureId, request, GetUserId(), GetClientIp());
                return Success(success, "Feature updated successfully.");
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<bool>(ex.Message, "Update Feature Failed"));
            }
        }

        [HttpDelete("plans/{planId:guid}/features/{featureId:guid}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteFeature(Guid planId, Guid featureId)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<bool>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var success = await _subscriptionService.DeleteFeatureAsync(planId, featureId, GetUserId(), GetClientIp());
                return Success(success, "Feature deleted successfully.");
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<bool>(ex.Message, "Delete Feature Failed"));
            }
        }

        [HttpPut("plans/{planId:guid}/limits")]
        public async Task<ActionResult<ApiResponse<bool>>> UpdateLimits(Guid planId, [FromBody] SubscriptionPlanLimitsDto limitsDto)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<bool>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var success = await _subscriptionService.UpdateLimitsAsync(planId, limitsDto, GetUserId(), GetClientIp());
                return Success(success, "Plan limits updated successfully.");
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<bool>(ex.Message, "Update Limits Failed"));
            }
        }

        [HttpPost("assign")]
        public async Task<ActionResult<ApiResponse<TenantSubscriptionDto>>> AssignSubscription([FromBody] AssignTenantSubscriptionRequest request)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<TenantSubscriptionDto>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var result = await _subscriptionService.AssignSubscriptionAsync(request, GetUserId(), GetClientIp());
                return Success(result, "Subscription plan assigned to tenant successfully.");
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<TenantSubscriptionDto>(ex.Message, "Assign Subscription Failed"));
            }
        }

        [HttpGet("tenants/{tenantId:guid}/history")]
        public async Task<ActionResult<ApiResponse<List<TenantSubscriptionDto>>>> GetTenantHistory(Guid tenantId)
        {
            var result = await _subscriptionService.GetTenantSubscriptionHistoryAsync(tenantId);
            return Success(result, "Tenant subscription history loaded.");
        }

        [HttpGet("kpis")]
        public async Task<ActionResult<ApiResponse<SubscriptionKpiDto>>> GetKpis()
        {
            var result = await _subscriptionService.GetSubscriptionKpisAsync();
            return Success(result, "Subscription KPIs loaded.");
        }

        [HttpGet("audit-logs")]
        public async Task<ActionResult<ApiResponse<List<SubscriptionAuditLogDto>>>> GetAuditLogs([FromQuery] Guid? planId, [FromQuery] Guid? tenantId)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<List<SubscriptionAuditLogDto>>("SuperAdmin privileges required.", "Forbidden"));

            var result = await _subscriptionService.GetAuditLogsAsync(planId, tenantId);
            return Success(result, "Subscription audit logs loaded.");
        }
    }
}
