using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Domain.Common;
using Aquora.Domain.Entities;

namespace Aquora.Persistence.Context
{
    public class PlatformDbContext : DbContext, IPlatformDbContext
    {
        public PlatformDbContext(DbContextOptions<PlatformDbContext> options) : base(options)
        {
        }

        public DbSet<Tenant> Tenants => Set<Tenant>();
        public DbSet<User> Users => Set<User>();
        public DbSet<TenantDomain> TenantDomains => Set<TenantDomain>();
        public DbSet<OTPVerification> OTPVerifications => Set<OTPVerification>();
        public DbSet<PlatformAuditLog> PlatformAuditLogs => Set<PlatformAuditLog>();
        public DbSet<UserMembership> UserMemberships => Set<UserMembership>();
        public DbSet<TenantInvitation> TenantInvitations => Set<TenantInvitation>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure platform tables to reside in the "public" schema
            modelBuilder.HasDefaultSchema("public");

            modelBuilder.Entity<Tenant>()
                .HasIndex(t => t.Code)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasIndex(u => new { u.Username, u.TenantId })
                .IsUnique();

            modelBuilder.Entity<TenantDomain>()
                .HasIndex(td => td.Domain)
                .IsUnique();

            modelBuilder.Entity<OTPVerification>()
                .HasIndex(ov => ov.Email);

            modelBuilder.Entity<UserMembership>()
                .HasIndex(um => new { um.PlatformUserId, um.TenantId })
                .IsUnique();

            modelBuilder.Entity<TenantInvitation>()
                .HasIndex(ti => ti.Token)
                .IsUnique();

            modelBuilder.Entity<TenantInvitation>()
                .HasIndex(ti => new { ti.TenantId, ti.Email, ti.Status });
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var entry in ChangeTracker.Entries())
            {
                if (entry.Entity is IAuditable auditableEntity)
                {
                    if (entry.State == EntityState.Added)
                    {
                        auditableEntity.CreatedAt = System.DateTime.UtcNow;
                        auditableEntity.CreatedBy = "System";
                    }
                    else if (entry.State == EntityState.Modified)
                    {
                        auditableEntity.UpdatedAt = System.DateTime.UtcNow;
                        auditableEntity.UpdatedBy = "System";
                    }
                }
            }
            return await base.SaveChangesAsync(cancellationToken);
        }
    }
}
