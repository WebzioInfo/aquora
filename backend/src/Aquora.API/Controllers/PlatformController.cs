using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class PlatformController : ApiControllerBase
    {
        private readonly IPlatformManagementService _platformService;

        public PlatformController(IPlatformManagementService platformService)
        {
            _platformService = platformService;
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

        private string GetBrowserInfo()
        {
            return Request.Headers["User-Agent"].ToString() ?? "Platform Client Browser";
        }

        #region Tenant Endpoints

        [HttpGet("tenants")]
        public async Task<ActionResult<ApiResponse<PagedResult<PlatformTenantDto>>>> GetTenants([FromQuery] PlatformTenantListQuery query)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<PagedResult<PlatformTenantDto>>("SuperAdmin privileges required.", "Forbidden"));

            var result = await _platformService.GetTenantsAsync(query);
            return Success(result, "Tenants loaded successfully.");
        }

        [HttpGet("tenants/{id:guid}")]
        public async Task<ActionResult<ApiResponse<PlatformTenantDto>>> GetTenantById(Guid id)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<PlatformTenantDto>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var result = await _platformService.GetTenantByIdAsync(id);
                return Success(result, "Tenant details loaded.");
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(Failure<PlatformTenantDto>(ex.Message, "Not Found"));
            }
        }

        [HttpPost("tenants")]
        public async Task<ActionResult<ApiResponse<Guid>>> CreateTenant([FromBody] CreateTenantRequest request)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<Guid>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var tenantId = await _platformService.CreateTenantAsync(request, GetUserId(), GetClientIp());
                return Success(tenantId, "Tenant and database schema provisioned successfully.");
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(Failure<Guid>(ex.Message, "Tenant Creation Conflict"));
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<Guid>(ex.Message, "Tenant Creation Failed"));
            }
        }

        [HttpPut("tenants/{id:guid}")]
        public async Task<ActionResult<ApiResponse<bool>>> UpdateTenant(Guid id, [FromBody] UpdateTenantRequest request)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<bool>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var success = await _platformService.UpdateTenantAsync(id, request, GetUserId(), GetClientIp());
                return Success(success, "Tenant updated successfully.");
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(Failure<bool>(ex.Message, "Tenant Update Conflict"));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(Failure<bool>(ex.Message, "Tenant Not Found"));
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<bool>(ex.Message, "Tenant Update Failed"));
            }
        }

        [HttpDelete("tenants/{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteTenant(string id, [FromQuery] string reason = "Platform Admin Manual Deletion")
        {
            Serilog.Log.Information("[TENANT DELETE ROUTE HIT] DeleteTenant action triggered on PlatformController for raw ID: '{RawId}', Reason: '{Reason}'", id, reason);

            if (!Guid.TryParse(id, out var tenantId))
            {
                Serilog.Log.Warning("[TENANT DELETE ROUTE MATCH ERROR] Provided ID '{RawId}' is not a valid GUID.", id);
                return BadRequest(Failure<bool>($"The provided tenant ID '{id}' is not a valid GUID.", "Invalid Tenant ID"));
            }

            // CRITICAL SECURITY RULE: Only Platform Super Admin may delete tenants.
            if (!IsSuperAdmin())
            {
                Serilog.Log.Warning("[UNAUTHORIZED DELETE ATTEMPT] User {UserId} attempted to delete tenant {TenantId} without SuperAdmin rights.", GetUserId(), tenantId);
                return StatusCode(403, Failure<bool>("Access denied. Only Platform Super Admins can physically drop tenant database schemas.", "Forbidden"));
            }

            try
            {
                Serilog.Log.Information("[TENANT DELETE EXECUTING] Starting hard delete workflow for Tenant ID: {TenantId}", tenantId);
                var success = await _platformService.DeleteTenantAsync(tenantId, reason, GetUserId(), GetClientIp(), GetBrowserInfo());
                Serilog.Log.Information("[TENANT DELETE SUCCESS] Hard delete workflow completed for Tenant ID: {TenantId}", tenantId);
                return Success(success, "Tenant physically deleted and PostgreSQL schema dropped successfully.");
            }
            catch (KeyNotFoundException ex)
            {
                Serilog.Log.Warning(ex, "[TENANT DELETE NOT FOUND] Tenant ID {TenantId} not found in database.", tenantId);
                return NotFound(Failure<bool>(ex.Message, "Tenant Not Found"));
            }
            catch (InvalidOperationException ex)
            {
                Serilog.Log.Warning(ex, "[TENANT DELETE CONFLICT] Conflict during tenant deletion for ID {TenantId}.", tenantId);
                return Conflict(Failure<bool>(ex.Message, "Tenant Delete Conflict"));
            }
            catch (Exception ex)
            {
                Serilog.Log.Error(ex, "[TENANT HARD DELETE ERROR] Failed to delete tenant {TenantId}.", tenantId);
                return BadRequest(Failure<bool>(ex.Message, "Tenant Delete Failed"));
            }
        }

        [HttpPost("tenants/export")]
        public async Task<IActionResult> ExportTenants([FromBody] PlatformTenantListQuery query)
        {
            if (!IsSuperAdmin()) return StatusCode(403);
            var fileBytes = await _platformService.ExportTenantsCsvAsync(query);
            return File(fileBytes, "text/csv", $"tenants_export_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv");
        }

        [HttpPost("tenants/import")]
        public async Task<ActionResult<ApiResponse<ImportResultDto>>> ImportTenants([FromBody] ImportTenantPayload payload)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<ImportResultDto>("SuperAdmin privileges required.", "Forbidden"));

            var result = await _platformService.ImportTenantsAsync(payload.Records, payload.Commit, GetUserId());
            return Success(result, payload.Commit ? "Tenants imported successfully." : "Import preview generated.");
        }

        #endregion

        #region User Directory Endpoints

        [HttpGet("users")]
        public async Task<ActionResult<ApiResponse<PagedResult<PlatformUserDto>>>> GetUsers([FromQuery] PlatformUserListQuery query)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<PagedResult<PlatformUserDto>>("SuperAdmin privileges required.", "Forbidden"));

            var result = await _platformService.GetUsersAsync(query);
            return Success(result, "Users loaded successfully.");
        }

        [HttpGet("users/{id:guid}")]
        public async Task<ActionResult<ApiResponse<PlatformUserDto>>> GetUserById(Guid id)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<PlatformUserDto>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var result = await _platformService.GetUserByIdAsync(id);
                return Success(result, "User details loaded.");
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(Failure<PlatformUserDto>(ex.Message, "Not Found"));
            }
        }

        [HttpPost("users")]
        public async Task<ActionResult<ApiResponse<Guid>>> CreateUser([FromBody] CreateUserRequest request)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<Guid>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var userId = await _platformService.CreateUserAsync(request, GetUserId(), GetClientIp());
                return Success(userId, "User created successfully.");
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<Guid>(ex.Message, "User Creation Failed"));
            }
        }

        [HttpPut("users/{id:guid}")]
        public async Task<ActionResult<ApiResponse<bool>>> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<bool>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var success = await _platformService.UpdateUserAsync(id, request, GetUserId(), GetClientIp());
                return Success(success, "User updated successfully.");
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<bool>(ex.Message, "User Update Failed"));
            }
        }

        [HttpDelete("users/{id:guid}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteUser(Guid id)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<bool>("SuperAdmin privileges required.", "Forbidden"));

            try
            {
                var success = await _platformService.DeleteUserAsync(id, GetUserId(), GetClientIp());
                return Success(success, "User deleted successfully.");
            }
            catch (Exception ex)
            {
                return BadRequest(Failure<bool>(ex.Message, "User Delete Failed"));
            }
        }

        [HttpPost("users/bulk")]
        public async Task<ActionResult<ApiResponse<bool>>> BulkUserOperation([FromBody] BulkUserOperationRequest request)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<bool>("SuperAdmin privileges required.", "Forbidden"));

            var success = await _platformService.BulkUserOperationsAsync(request, GetUserId(), GetClientIp());
            return Success(success, "Bulk user operation executed.");
        }

        [HttpPost("users/export")]
        public async Task<IActionResult> ExportUsers([FromBody] PlatformUserListQuery query)
        {
            if (!IsSuperAdmin()) return StatusCode(403);
            var fileBytes = await _platformService.ExportUsersCsvAsync(query);
            return File(fileBytes, "text/csv", $"users_export_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv");
        }

        [HttpPost("users/import")]
        public async Task<ActionResult<ApiResponse<ImportResultDto>>> ImportUsers([FromBody] ImportUserPayload payload)
        {
            if (!IsSuperAdmin()) return StatusCode(403, Failure<ImportResultDto>("SuperAdmin privileges required.", "Forbidden"));

            var result = await _platformService.ImportUsersAsync(payload.Records, payload.Commit, GetUserId());
            return Success(result, payload.Commit ? "Users imported successfully." : "Import preview generated.");
        }

        #endregion
    }

    public class ImportTenantPayload
    {
        public List<Dictionary<string, string>> Records { get; set; } = new List<Dictionary<string, string>>();
        public bool Commit { get; set; } = false;
    }

    public class ImportUserPayload
    {
        public List<Dictionary<string, string>> Records { get; set; } = new List<Dictionary<string, string>>();
        public bool Commit { get; set; } = false;
    }
}
