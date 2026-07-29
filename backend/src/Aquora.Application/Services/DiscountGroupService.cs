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
    public class DiscountGroupService : IDiscountGroupService
    {
        private readonly ITenantDbContext _context;
        private readonly ICurrentUserContext _currentUserContext;

        public DiscountGroupService(ITenantDbContext context, ICurrentUserContext currentUserContext)
        {
            _context = context;
            _currentUserContext = currentUserContext;
        }

        public async Task<IEnumerable<DiscountGroup>> GetAllDiscountGroupsAsync()
        {
            return await _context.DiscountGroups
                .Where(x => !x.IsDeleted)
                .OrderBy(x => x.Code)
                .ToListAsync();
        }

        public async Task<DiscountGroup?> GetDiscountGroupByIdAsync(Guid id)
        {
            return await _context.DiscountGroups
                .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
        }

        public async Task<DiscountGroup> CreateDiscountGroupAsync(DiscountGroup discountGroup)
        {
            if (discountGroup.TenantId == Guid.Empty && _currentUserContext.TenantId != Guid.Empty)
            {
                discountGroup.TenantId = _currentUserContext.TenantId;
            }

            _context.DiscountGroups.Add(discountGroup);
            await _context.SaveChangesAsync();
            return discountGroup;
        }

        public async Task<DiscountGroup> UpdateDiscountGroupAsync(Guid id, DiscountGroup discountGroup)
        {
            var existing = await _context.DiscountGroups
                .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

            if (existing == null)
                throw new KeyNotFoundException("Discount group not found.");

            existing.Code = discountGroup.Code;
            existing.Description = discountGroup.Description;
            existing.IsActive = discountGroup.IsActive;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task DeleteDiscountGroupAsync(Guid id)
        {
            var existing = await _context.DiscountGroups
                .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

            if (existing != null)
            {
                existing.IsDeleted = true;
                await _context.SaveChangesAsync();
            }
        }
    }
}
