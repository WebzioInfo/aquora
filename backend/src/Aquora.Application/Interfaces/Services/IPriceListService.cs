using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Domain.Entities;

namespace Aquora.Application.Interfaces.Services
{
    public interface IPriceListService
    {
        Task<IEnumerable<PriceList>> GetAllPriceListsAsync();
        Task<PriceList?> GetPriceListByIdAsync(Guid id);
        Task<PriceList> CreatePriceListAsync(PriceList priceList);
        Task<PriceList> UpdatePriceListAsync(Guid id, PriceList priceList);
        Task DeletePriceListAsync(Guid id);
    }
}
