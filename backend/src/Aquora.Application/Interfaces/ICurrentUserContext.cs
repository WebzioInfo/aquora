using System;
using System.Collections.Generic;

namespace Aquora.Application.Interfaces
{
    public interface ICurrentUserContext
    {
        string UserId { get; }
        string Email { get; }
        Guid TenantId { get; }
        IEnumerable<string> Roles { get; }
        IEnumerable<string> Permissions { get; }
        string IpAddress { get; }
        string UserAgent { get; }
        string Reason { get; }
        string Module { get; }
        bool IsAuthenticated { get; }
        bool HasPermission(string permission);
    }
}
