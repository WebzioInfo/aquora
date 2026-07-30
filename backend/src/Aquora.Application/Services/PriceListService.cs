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
    public class PriceListService : IPriceListService
    {
        private readonly ITenantDbContext _context;
        private readonly ICurrentUserContext _currentUserContext;

        public PriceListService(ITenantDbContext context, ICurrentUserContext currentUserContext)
        {
            _context = context;
            _currentUserContext = currentUserContext;
        }

        public async Task<IEnumerable<PriceList>> GetAllPriceListsAsync()
        {
            return await _context.PriceLists
                .OrderBy(x => x.Code)
                .ToListAsync();
        }

        public async Task<PriceList?> GetPriceListByIdAsync(Guid id)
        {
            return await _context.PriceLists
                .FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<PriceList> CreatePriceListAsync(PriceList priceList)
        {
            if (priceList.TenantId == Guid.Empty && _currentUserContext.TenantId != Guid.Empty)
            {
                priceList.TenantId = _currentUserContext.TenantId;
            }

            _context.PriceLists.Add(priceList);
            await _context.SaveChangesAsync();
            return priceList;
        }

        public async Task<PriceList> UpdatePriceListAsync(Guid id, PriceList priceList)
        {
            var existing = await _context.PriceLists
                .FirstOrDefaultAsync(x => x.Id == id);

            if (existing == null)
                throw new KeyNotFoundException("Price list not found.");

            existing.Code = priceList.Code;
            existing.Description = priceList.Description;
            existing.IsActive = priceList.IsActive;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task DeletePriceListAsync(Guid id)
        {
            var existing = await _context.PriceLists
                .FirstOrDefaultAsync(x => x.Id == id);

            if (existing != null)
            {
                _context.PriceLists.Remove(existing);
                await _context.SaveChangesAsync();
            }
        }
    }
}
