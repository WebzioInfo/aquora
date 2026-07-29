using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/production-configuration")]
    public class ProductionConfigurationController : ApiControllerBase
    {
        private readonly IPlatformDbContext _platformContext;
        private readonly ICurrentUserContext _currentUserContext;

        public ProductionConfigurationController(
            IPlatformDbContext platformContext,
            ICurrentUserContext currentUserContext)
        {
            _platformContext = platformContext;
            _currentUserContext = currentUserContext;
        }

        private Guid GetTenantId()
        {
            var claim = User.FindFirst("tenant_id")?.Value;
            if (string.IsNullOrEmpty(claim) || !Guid.TryParse(claim, out var tenantId))
            {
                throw new UnauthorizedAccessException("Tenant context is missing or invalid.");
            }
            return tenantId;
        }

        private string GetCurrentUserId()
        {
            return User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "System";
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<string>>>> GetEnabledStations()
        {
            try
            {
                var tenantId = GetTenantId();
                var configs = await _platformContext.TenantProductionConfigurations
                    .Where(c => c.TenantId == tenantId)
                    .ToListAsync();

                var allStations = new[] { "Blowing", "Filling", "Labeling", "Packing" };
                var enabledStations = new List<string>();

                foreach (var station in allStations)
                {
                    var isEnabled = !configs.Any(c => c.StationName.Equals(station, StringComparison.OrdinalIgnoreCase) && !c.IsEnabled);
                    if (isEnabled)
                    {
                        enabledStations.Add(station);
                    }
                }

                return Success(enabledStations, "Enabled production stations retrieved successfully.");
            }
            catch (Exception)
            {
                return Failure<List<string>>("An internal error occurred.", "Failed to retrieve production configurations.");
            }
        }

        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<TenantProductionConfigurationDto>>>> GetAllStations()
        {
            try
            {
                var tenantId = GetTenantId();
                var configs = await _platformContext.TenantProductionConfigurations
                    .Where(c => c.TenantId == tenantId)
                    .ToListAsync();

                var allStations = new[] { "Blowing", "Filling", "Labeling", "Packing" };
                var result = new List<TenantProductionConfigurationDto>();

                foreach (var station in allStations)
                {
                    var config = configs.FirstOrDefault(c => c.StationName.Equals(station, StringComparison.OrdinalIgnoreCase));
                    result.Add(new TenantProductionConfigurationDto
                    {
                        StationName = station,
                        IsEnabled = config == null || config.IsEnabled
                    });
                }

                return Success(result, "All production station configurations retrieved successfully.");
            }
            catch (Exception)
            {
                return Failure<List<TenantProductionConfigurationDto>>("An internal error occurred.", "Failed to retrieve production configurations.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<bool>>> UpdateConfigurations([FromBody] List<UpdateProductionConfigurationRequest> requests)
        {
            try
            {
                var allowedRoles = new[] { "CompanyAdmin", "SuperAdmin", "PlatformAdmin" };
                if (!_currentUserContext.Roles.Any(r => allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase)))
                {
                    return Forbid();
                }

                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();

                foreach (var req in requests)
                {
                    var config = await _platformContext.TenantProductionConfigurations
                        .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.StationName.ToLower() == req.StationName.ToLower());

                    if (config == null)
                    {
                        config = new TenantProductionConfiguration
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            StationName = req.StationName,
                            IsEnabled = req.IsEnabled,
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = currentUserId
                        };
                        _platformContext.TenantProductionConfigurations.Add(config);
                    }
                    else
                    {
                        config.IsEnabled = req.IsEnabled;
                        config.UpdatedAt = DateTime.UtcNow;
                        config.UpdatedBy = currentUserId;
                    }
                }

                await _platformContext.SaveChangesAsync();
                return Success(true, "Production station configurations updated successfully.");
            }
            catch (Exception)
            {
                return Failure<bool>("An internal error occurred.", "Failed to update production configurations.");
            }
        }
    }

    public class TenantProductionConfigurationDto
    {
        public string StationName { get; set; } = string.Empty;
        public bool IsEnabled { get; set; }
    }

    public class UpdateProductionConfigurationRequest
    {
        public string StationName { get; set; } = string.Empty;
        public bool IsEnabled { get; set; }
    }
}
