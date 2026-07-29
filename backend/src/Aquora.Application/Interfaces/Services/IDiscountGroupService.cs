using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Domain.Entities;

namespace Aquora.Application.Interfaces.Services
{
    public interface IDiscountGroupService
    {
        Task<IEnumerable<DiscountGroup>> GetAllDiscountGroupsAsync();
        Task<DiscountGroup?> GetDiscountGroupByIdAsync(Guid id);
        Task<DiscountGroup> CreateDiscountGroupAsync(DiscountGroup discountGroup);
        Task<DiscountGroup> UpdateDiscountGroupAsync(Guid id, DiscountGroup discountGroup);
        Task DeleteDiscountGroupAsync(Guid id);
    }
}
