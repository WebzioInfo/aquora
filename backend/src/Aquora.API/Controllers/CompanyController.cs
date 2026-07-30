using System;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class CompanyController : ApiControllerBase
    {
        private readonly ITenantDbContext _tenantContext;
        private readonly IPlatformDbContext _platformContext;
        private readonly ICurrentUserContext _userContext;
        private readonly IStationConfigurationService _stationConfigService;

        public CompanyController(
            ITenantDbContext tenantContext,
            IPlatformDbContext platformContext,
            ICurrentUserContext userContext,
            IStationConfigurationService stationConfigService)
        {
            _tenantContext = tenantContext;
            _platformContext = platformContext;
            _userContext = userContext;
            _stationConfigService = stationConfigService;
        }

        private bool IsCompanyAdmin()
        {
            var roles = User.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value).ToList();
            return roles.Contains("CompanyAdmin") || roles.Contains("SuperAdmin") || roles.Contains("PlatformAdmin");
        }

        [HttpGet("settings")]
        public async Task<ActionResult<ApiResponse<object>>> GetSettings()
        {
            var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            if (company == null) return Failure<object>("Company not found.", "Not Found");

            var tenant = await _platformContext.Tenants.FirstOrDefaultAsync(t => t.Id == _userContext.TenantId);

            return Success<object>(new
            {
                company.Name,
                TenantId = tenant?.Id.ToString() ?? _userContext.TenantId.ToString(),
                TenantCode = tenant?.Code ?? company.Code,
                SchemaName = tenant?.SchemaName ?? "public",
                SubscriptionPlan = tenant?.SubscriptionPlan ?? "Starter",
                CreatedAt = company.CreatedAt
            }, "Company settings loaded successfully.");
        }

        [HttpPut("settings")]
        public async Task<ActionResult<ApiResponse<object>>> UpdateSettings([FromBody] UpdateSettingsRequest request)
        {
            if (!IsCompanyAdmin()) return StatusCode(403, Failure<object>("CompanyAdmin privileges required.", "Forbidden"));

            var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            if (company == null) return Failure<object>("Company not found.", "Not Found");

            company.Name = request.Name;

            // Sync with Platform DB Tenant record
            var tenant = await _platformContext.Tenants.FirstOrDefaultAsync(t => t.Id == _userContext.TenantId);
            if (tenant != null)
            {
                tenant.Name = request.Name;
                tenant.OwnerEmail = request.Email;
                tenant.OwnerPhone = request.Phone;
                tenant.GstNumber = request.GstNumber;
                tenant.Address = request.Address;
                tenant.Timezone = request.Timezone;
                tenant.Language = request.Language;
                tenant.LogoUrl = request.LogoUrl;
                await _platformContext.SaveChangesAsync();
            }

            await _tenantContext.SaveChangesAsync();
            return await GetSettings();
        }

        [HttpGet("security")]
        public async Task<ActionResult<ApiResponse<object>>> GetSecurity()
        {
            var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            if (company == null) return Failure<object>("Company not found.", "Not Found");

            return Success<object>(new
            {
                HasSecretKey = false, // Not supported in DB yet
                ApiKey = string.Empty // Not supported in DB yet
            }, "Security configuration loaded.");
        }

        [HttpPut("security")]
        public async Task<ActionResult<ApiResponse<object>>> UpdateSecurity([FromBody] UpdateSecurityRequest request)
        {
            if (!IsCompanyAdmin()) return StatusCode(403, Failure<object>("CompanyAdmin privileges required.", "Forbidden"));

            var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            if (company == null) return Failure<object>("Company not found.", "Not Found");

            // Database does not support SecretKeyHash and ApiKey yet.
            // Do not attempt to save them to the company entity until schema is updated.

            await _tenantContext.SaveChangesAsync();
            return await GetSecurity();
        }

        [HttpPost("security/regenerate-api-key")]
        public async Task<ActionResult<ApiResponse<object>>> RegenerateApiKey()
        {
            if (!IsCompanyAdmin()) return StatusCode(403, Failure<object>("CompanyAdmin privileges required.", "Forbidden"));

            var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            if (company == null) return Failure<object>("Company not found.", "Not Found");

            // Generate a secure API Key: aq_live_32chars
            var keyBytes = new byte[24];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(keyBytes);
            }
            var apiKey = "aq_live_" + Convert.ToHexString(keyBytes).ToLower();

            // Database does not support ApiKey yet. Cannot save to company.
            await _tenantContext.SaveChangesAsync();

            return Success<object>(new { apiKey }, "API Key regenerated successfully.");
        }

        [HttpGet("stations")]
        public async Task<ActionResult<ApiResponse<object>>> GetStations()
        {
            var result = await _stationConfigService.GetStationConfigurationsAsync(_userContext.TenantId);
            return Success<object>(result, "Stations loaded.");
        }

        [HttpPut("stations")]
        public async Task<ActionResult<ApiResponse<object>>> UpdateStations([FromBody] UpdateStationsRequest request)
        {
            if (!IsCompanyAdmin()) return StatusCode(403, Failure<object>("CompanyAdmin privileges required.", "Forbidden"));

            var configs = request.Stations.Select(s => new StationConfigDto
            {
                Name = s.Name,
                IsEnabled = s.IsEnabled
            }).ToList();

            await _stationConfigService.UpdateStationConfigurationsAsync(_userContext.TenantId, configs);
            return await GetStations();
        }

        [HttpGet("user-security")]
        public async Task<ActionResult<ApiResponse<object>>> GetUserSecurity()
        {
            var userMemberships = await _platformContext.UserMemberships
                .Where(m => m.TenantId == _userContext.TenantId)
                .Select(m => m.PlatformUserId)
                .ToListAsync();

            var totalEmployees = await _platformContext.Users
                .Where(u => userMemberships.Contains(u.Id) && !u.IsDeleted)
                .CountAsync();

            var activeEmployees = await _platformContext.Users
                .Where(u => userMemberships.Contains(u.Id) && u.IsActive && !u.IsDeleted)
                .CountAsync();

            var lockedUsers = await _platformContext.Users
                .Where(u => userMemberships.Contains(u.Id) && !u.IsActive && !u.IsDeleted)
                .CountAsync();

            var pendingInvitations = await _platformContext.TenantInvitations
                .Where(i => i.TenantId == _userContext.TenantId && i.Status == "Pending")
                .CountAsync();

            return Success<object>(new
            {
                TotalEmployees = totalEmployees,
                ActiveEmployees = activeEmployees,
                LockedUsers = lockedUsers,
                PendingInvitations = pendingInvitations
            }, "User security statistics loaded.");
        }
    }

    public class UpdateSettingsRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? GstNumber { get; set; }
        public string? Address { get; set; }
        public string Timezone { get; set; } = "UTC";
        public string Language { get; set; } = "en";
        public string DateFormat { get; set; } = "YYYY-MM-DD";
        public string? LogoUrl { get; set; }
    }

    public class UpdateSecurityRequest
    {
        public string? SecretKey { get; set; }
        public string? ConfirmSecret { get; set; }
        public string? ApiKey { get; set; }
    }

    public class UpdateStationsRequest
    {
        public StationReq[] Stations { get; set; } = Array.Empty<StationReq>();
    }

    public class StationReq
    {
        public string Name { get; set; } = string.Empty;
        public bool IsEnabled { get; set; }
    }
}
