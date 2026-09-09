using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/production-configuration")]
    public class ProductionConfigurationController : ApiControllerBase
    {
        private readonly IStationConfigurationService _stationConfigService;
        private readonly ICurrentUserContext _currentUserContext;

        public ProductionConfigurationController(
            IStationConfigurationService stationConfigService,
            ICurrentUserContext currentUserContext)
        {
            _stationConfigService = stationConfigService;
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

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<string>>>> GetEnabledStations()
        {
            try
            {
                var tenantId = GetTenantId();
                var configs = await _stationConfigService.GetStationConfigurationsAsync(tenantId);
                var enabled = configs.Where(c => c.IsEnabled).Select(c => c.Name).ToList();
                
                // Add alternate spelling for UI safety
                if (enabled.Contains("Labelling") && !enabled.Contains("Labeling"))
                {
                    enabled.Add("Labeling");
                }
                else if (enabled.Contains("Labeling") && !enabled.Contains("Labelling"))
                {
                    enabled.Add("Labelling");
                }

                return Success(enabled, "Enabled production stations retrieved successfully.");
            }
            catch (Exception ex)
            {
                return Failure<List<string>>(ex.Message, "Failed to retrieve production configurations.");
            }
        }

        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<TenantProductionConfigurationDto>>>> GetAllStations()
        {
            try
            {
                var tenantId = GetTenantId();
                var configs = await _stationConfigService.GetStationConfigurationsAsync(tenantId);
                var result = configs.Select(c => new TenantProductionConfigurationDto
                {
                    StationName = c.Name,
                    IsEnabled = c.IsEnabled
                }).ToList();

                return Success(result, "All production station configurations retrieved successfully.");
            }
            catch (Exception ex)
            {
                return Failure<List<TenantProductionConfigurationDto>>(ex.Message, "Failed to retrieve production configurations.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<bool>>> UpdateConfigurations([FromBody] List<UpdateProductionConfigurationRequest> requests)
        {
            try
            {
                var allowedRoles = new[] { "CompanyAdmin", "Accountant", "SuperAdmin", "PlatformAdmin" };
                if (!_currentUserContext.Roles.Any(r => allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase)))
                {
                    return Forbid();
                }

                var tenantId = GetTenantId();
                var configsDto = requests.Select(r => new StationConfigDto
                {
                    Name = r.StationName,
                    IsEnabled = r.IsEnabled
                }).ToList();

                await _stationConfigService.UpdateStationConfigurationsAsync(tenantId, configsDto);
                return Success(true, "Production station configurations updated successfully.");
            }
            catch (Exception ex)
            {
                return Failure<bool>(ex.Message, "Failed to update production configurations.");
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
