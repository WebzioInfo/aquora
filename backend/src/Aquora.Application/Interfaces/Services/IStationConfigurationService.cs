using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Aquora.Application.Interfaces.Services
{
    public interface IStationConfigurationService
    {
        Task<bool> IsStationEnabledAsync(Guid tenantId, string stationName);
        Task<List<StationConfigDto>> GetStationConfigurationsAsync(Guid tenantId);
        Task UpdateStationConfigurationsAsync(Guid tenantId, List<StationConfigDto> configs);
    }

    public class StationConfigDto
    {
        public string Name { get; set; } = string.Empty;
        public bool IsEnabled { get; set; }
    }
}
