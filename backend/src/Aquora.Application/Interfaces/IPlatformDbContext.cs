using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using System.Threading;
using System.Threading.Tasks;
using Aquora.Domain.Entities;

namespace Aquora.Application.Interfaces
{
    public interface IPlatformDbContext
    {
        DbSet<Tenant> Tenants { get; }
        DbSet<User> Users { get; }
        DbSet<TenantDomain> TenantDomains { get; }
        DbSet<OTPVerification> OTPVerifications { get; }
        DbSet<PlatformAuditLog> PlatformAuditLogs { get; }
        DbSet<UserMembership> UserMemberships { get; }
        DbSet<TenantInvitation> TenantInvitations { get; }

        DatabaseFacade Database { get; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}
