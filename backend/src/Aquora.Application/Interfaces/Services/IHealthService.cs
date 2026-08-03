using System.Threading.Tasks;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public interface IHealthService
    {
        Task<HealthStatusDto> GetSystemHealthAsync();
        Task<bool> IsDatabaseHealthyAsync();
    }
}
