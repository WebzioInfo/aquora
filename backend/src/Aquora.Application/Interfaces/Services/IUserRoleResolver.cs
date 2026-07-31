using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Domain.Entities;

namespace Aquora.Application.Interfaces.Services
{
    public interface IUserRoleResolver
    {
        Task<string> ResolveUserRoleAsync(User user, Guid? tenantId = null);
        Task<Dictionary<Guid, string>> ResolveUsersRolesAsync(IEnumerable<User> users, Guid? tenantId = null);
        Task SynchronizeUserRoleAsync(Guid userId, string newRoleName, Guid? tenantId = null);
    }
}
