using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;

namespace Aquora.Application.Services
{
    public class StationConfigurationService : IStationConfigurationService
    {
        private readonly IPlatformDbContext _platformContext;

        public StationConfigurationService(IPlatformDbContext platformContext)
        {
            _platformContext = platformContext;
        }

        private string NormalizeStationName(string stationName)
        {
            if (string.Equals(stationName, "Labelling", StringComparison.OrdinalIgnoreCase))
                return "Labeling";
            return stationName;
        }

        public async Task<bool> IsStationEnabledAsync(Guid tenantId, string stationName)
        {
            var normalizedName = NormalizeStationName(stationName);
            var config = await _platformContext.TenantProductionConfigurations
                .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.StationName == normalizedName);

            // Default to true if no configuration exists yet
            return config == null || config.IsEnabled;
        }

        public async Task<List<StationConfigDto>> GetStationConfigurationsAsync(Guid tenantId)
        {
            var allowedStations = new[] { "Blowing", "Filling", "Labeling", "Packing" };

            var configurations = await _platformContext.TenantProductionConfigurations
                .Where(c => c.TenantId == tenantId && allowedStations.Contains(c.StationName))
                .ToListAsync();

            return allowedStations.Select(name =>
            {
                var config = configurations.FirstOrDefault(c => c.StationName == name);
                // Map "Labeling" back to UI spelling "Labelling"
                var uiName = name == "Labeling" ? "Labelling" : name;
                return new StationConfigDto
                {
                    Name = uiName,
                    IsEnabled = config == null || config.IsEnabled
                };
            }).ToList();
        }

        public async Task UpdateStationConfigurationsAsync(Guid tenantId, List<StationConfigDto> configs)
        {
            foreach (var req in configs)
            {
                var normalizedName = NormalizeStationName(req.Name);
                var config = await _platformContext.TenantProductionConfigurations
                    .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.StationName == normalizedName);

                if (config == null)
                {
                    config = new TenantProductionConfiguration
                    {
                        TenantId = tenantId,
                        StationName = normalizedName,
                        IsEnabled = req.IsEnabled
                    };
                    _platformContext.TenantProductionConfigurations.Add(config);
                }
                else
                {
                    config.IsEnabled = req.IsEnabled;
                }
            }

            await _platformContext.SaveChangesAsync();
        }
    }
}
