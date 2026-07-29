using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Aquora.Application.Interfaces.Services
{
    public interface IProductionService
    {
        Task<List<object>> GetTodayEntriesAsync(Guid lineId, string? shift);
        Task<List<object>> GetSessionEntriesAsync(Guid sessionId);
    }
}
