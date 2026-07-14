using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Domain.Common;
using Aquora.Domain.Entities;

namespace Aquora.Persistence.Context
{
    public class TenantDbContext : DbContext, ITenantDbContext
    {
        private readonly ITenantProvider _tenantProvider;
        private readonly ICurrentUserContext _currentUserContext;

        public string SchemaName => !string.IsNullOrWhiteSpace(_tenantProvider.TenantSchemaName)
            ? _tenantProvider.TenantSchemaName
            : "public";

        public TenantDbContext(
            DbContextOptions<TenantDbContext> options,
            ITenantProvider tenantProvider,
            ICurrentUserContext currentUserContext) : base(options)
        {
            _tenantProvider = tenantProvider;
            _currentUserContext = currentUserContext;
        }

        public DbSet<Company> Companies => Set<Company>();
        public DbSet<ProductionLine> ProductionLines => Set<ProductionLine>();
        public DbSet<Station> Stations => Set<Station>();
        public DbSet<Machine> Machines => Set<Machine>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<Permission> Permissions => Set<Permission>();
        public DbSet<UserRole> UserRoles => Set<UserRole>();
        public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
        public DbSet<ProductionBatch> ProductionBatches => Set<ProductionBatch>();
        public DbSet<ProductionStationData> ProductionStationData => Set<ProductionStationData>();
        public DbSet<SkuProduct> SkuProducts => Set<SkuProduct>();
        public DbSet<CaseConfiguration> CaseConfigurations => Set<CaseConfiguration>();
        public DbSet<RawMaterial> RawMaterials => Set<RawMaterial>();
        public DbSet<InventoryMovement> InventoryMovements => Set<InventoryMovement>();
        public DbSet<ProductionEntry> ProductionEntries => Set<ProductionEntry>();
        public DbSet<ProductionSession> ProductionSessions => Set<ProductionSession>();
        public DbSet<Brand> Brands => Set<Brand>();
        public DbSet<Product> Products => Set<Product>();
        public DbSet<OperatorContextLog> OperatorContextLogs => Set<OperatorContextLog>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Dynamically set schema for all entities in this context
            modelBuilder.HasDefaultSchema(SchemaName);

            // Explicitly map platform entities referenced via navigation to their correct table/schema
            modelBuilder.Entity<Tenant>()
                .ToTable("Tenants", "public", t => t.ExcludeFromMigrations());

            modelBuilder.Entity<User>()
                .ToTable("Users", "public", t => t.ExcludeFromMigrations());

            modelBuilder.Entity<TenantDomain>()
                .ToTable("TenantDomains", "public", t => t.ExcludeFromMigrations());

            modelBuilder.Entity<UserRole>()
                .HasIndex(ur => new { ur.UserId, ur.RoleId });

            modelBuilder.Entity<RolePermission>()
                .HasIndex(rp => new { rp.RoleId, rp.PermissionId });

            // Brand configuration
            modelBuilder.Entity<Brand>()
                .Property(b => b.Name)
                .HasMaxLength(150)
                .IsRequired();

            modelBuilder.Entity<Brand>()
                .HasIndex(b => b.Name)
                .IsUnique();

            modelBuilder.Entity<Brand>()
                .Property(b => b.Code)
                .HasMaxLength(50);

            modelBuilder.Entity<Brand>()
                .HasIndex(b => b.Code)
                .IsUnique();

            modelBuilder.Entity<Brand>()
                .Property(b => b.Description)
                .HasMaxLength(500);

            modelBuilder.Entity<Brand>()
                .Property(b => b.IsActive)
                .HasDefaultValue(true);

            // Product configuration
            modelBuilder.Entity<Product>()
                .HasIndex(p => p.Name);

            modelBuilder.Entity<Product>()
                .HasIndex(p => p.BrandId);

            modelBuilder.Entity<Product>()
                .HasIndex(p => new { p.Name, p.BrandId });

            modelBuilder.Entity<Product>()
                .HasIndex(p => p.SKU)
                .IsUnique();

            // RawMaterial configuration
            modelBuilder.Entity<RawMaterial>()
                .HasIndex(rm => rm.Name)
                .IsUnique();

            modelBuilder.Entity<RawMaterial>()
                .HasIndex(rm => rm.Category);

            // InventoryMovement query indexing optimizations
            modelBuilder.Entity<InventoryMovement>()
                .HasIndex(im => im.CreatedAt);
            modelBuilder.Entity<InventoryMovement>()
                .HasIndex(im => new { im.ReferenceType, im.ReferenceId });
            modelBuilder.Entity<InventoryMovement>()
                .HasIndex(im => im.RawMaterialId);
            modelBuilder.Entity<InventoryMovement>()
                .HasIndex(im => im.ProductId);
            modelBuilder.Entity<InventoryMovement>()
                .HasIndex(im => im.InventoryType);
            modelBuilder.Entity<InventoryMovement>()
                .HasIndex(im => im.CompanyId);

            // ProductionEntry query indexing optimizations
            modelBuilder.Entity<ProductionEntry>()
                .HasIndex(pe => pe.ProductId);
            modelBuilder.Entity<ProductionEntry>()
                .HasIndex(pe => pe.ProductionSessionId);

            // Apply soft delete query filters
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                var type = entityType.ClrType;
                if (typeof(ISoftDelete).IsAssignableFrom(type))
                {
                    var method = typeof(TenantDbContext)
                        .GetMethod(nameof(ApplySoftDeleteFilter), System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                        ?.MakeGenericMethod(type);
                    method?.Invoke(this, new object[] { modelBuilder });
                }
            }
        }

        private void ApplySoftDeleteFilter<T>(ModelBuilder modelBuilder) where T : class, ISoftDelete
        {
            modelBuilder.Entity<T>().HasQueryFilter(e => !e.IsDeleted);
        }

        private void LogDatabaseContextState()
        {
            try
            {
                var tenantId = _tenantProvider.TenantId;
                var companyId = ChangeTracker.Entries()
                    .Where(e => e.Entity is ICompanySpecific)
                    .Select(e => ((ICompanySpecific)e.Entity).CompanyId)
                    .FirstOrDefault();

                var schemaName = SchemaName;
                var dbConnection = Database.GetDbConnection();
                var connectionString = dbConnection?.ConnectionString ?? "None";
                
                // Sanitize connection string to protect secrets in logs
                if (connectionString != "None")
                {
                    try
                    {
                        var builder = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
                        if (!string.IsNullOrEmpty(builder.Password))
                        {
                            builder.Password = "********";
                        }
                        connectionString = builder.ToString();
                    }
                    catch
                    {
                        connectionString = "[Sanitized]";
                    }
                }

                var dbContextType = GetType().Name;
                string searchPath = schemaName;
                
                if (dbConnection != null && dbConnection.State == System.Data.ConnectionState.Open)
                {
                    try
                    {
                        using (var cmd = dbConnection.CreateCommand())
                        {
                            cmd.CommandText = "SHOW search_path;";
                            searchPath = cmd.ExecuteScalar()?.ToString() ?? schemaName;
                        }
                    }
                    catch
                    {
                        searchPath = schemaName;
                    }
                }

                Console.WriteLine($"[SCHEMA RESOLUTION]: TenantId={tenantId}, CompanyId={(companyId == Guid.Empty ? "Not Found" : companyId.ToString())}, ResolvedSchema={schemaName}, DbContext={dbContextType}, ConnectionString={connectionString}, SearchPath={searchPath}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SCHEMA RESOLUTION LOGGER ERROR]: {ex.Message}");
            }
        }

        public override int SaveChanges()
        {
            LogDatabaseContextState();
            return base.SaveChanges();
        }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            LogDatabaseContextState();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            LogDatabaseContextState();
            var currentUserId = _currentUserContext.UserId ?? "System";
            var currentTenantId = _tenantProvider.TenantId;

            foreach (var entry in ChangeTracker.Entries())
            {
                if (entry.State == EntityState.Added && entry.Entity is IMultiTenant multiTenantEntity)
                {
                    if (multiTenantEntity.TenantId == Guid.Empty)
                    {
                        multiTenantEntity.TenantId = currentTenantId;
                    }
                }

                if (entry.State == EntityState.Deleted && entry.Entity is ISoftDelete softDeleteEntity)
                {
                    entry.State = EntityState.Modified;
                    softDeleteEntity.IsDeleted = true;
                    softDeleteEntity.DeletedAt = DateTime.UtcNow;
                    softDeleteEntity.DeletedBy = currentUserId;
                }

                if (entry.Entity is IAuditable auditableEntity)
                {
                    if (entry.State == EntityState.Added)
                    {
                        auditableEntity.CreatedAt = DateTime.UtcNow;
                        auditableEntity.CreatedBy = currentUserId;
                    }
                    else if (entry.State == EntityState.Modified)
                    {
                        auditableEntity.UpdatedAt = DateTime.UtcNow;
                        auditableEntity.UpdatedBy = currentUserId;
                    }
                }
            }

            if (AuditState.IsDisabled)
            {
                return await base.SaveChangesAsync(cancellationToken);
            }

            var auditLogs = GenerateAuditLogs(currentUserId, currentTenantId);

            var result = await base.SaveChangesAsync(cancellationToken);

            if (auditLogs.Any())
            {
                foreach (var log in auditLogs)
                {
                    try
                    {
                        var logJson = System.Text.Json.JsonSerializer.Serialize(log, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                        Console.WriteLine($"[AUDIT LOG INSERTING]:\n{logJson}");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Failed to serialize audit log for console output: {ex.Message}");
                    }
                }

                AuditLogs.AddRange(auditLogs);
                try
                {
                    await base.SaveChangesAsync(cancellationToken);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AUDIT LOG FAILURE - NON-BLOCKING]: Failed to save audit logs to database: {ex.Message}");
                    foreach (var log in auditLogs)
                    {
                        Entry(log).State = EntityState.Detached;
                    }
                }
            }

            return result;
        }

        private System.Collections.Generic.List<AuditLog> GenerateAuditLogs(string userId, Guid tenantId)
        {
            ChangeTracker.DetectChanges();
            var logs = new System.Collections.Generic.List<AuditLog>();

            foreach (var entry in ChangeTracker.Entries())
            {
                if (entry.Entity is AuditLog || entry.State == EntityState.Detached || entry.State == EntityState.Unchanged)
                    continue;

                var auditEntry = new AuditEntry(entry)
                {
                    TableName = entry.Entity.GetType().Name,
                    UserId = userId,
                    UserEmail = _currentUserContext.Email ?? "system@aquora.com",
                    TenantId = tenantId,
                    IpAddress = _currentUserContext.IpAddress ?? "127.0.0.1",
                    Device = _currentUserContext.UserAgent ?? "Unknown",
                    Reason = _currentUserContext.Reason ?? "System Operation",
                    Module = _currentUserContext.Module ?? "Default"
                };

                foreach (var property in entry.Properties)
                {
                    string propertyName = property.Metadata.Name;
                    
                    if (propertyName.Equals("PasswordHash", StringComparison.OrdinalIgnoreCase) ||
                        propertyName.Equals("RefreshToken", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    if (property.Metadata.IsPrimaryKey())
                    {
                        auditEntry.KeyValues[propertyName] = property.CurrentValue;
                        continue;
                    }

                    switch (entry.State)
                    {
                        case EntityState.Added:
                            auditEntry.AuditType = "Insert";
                            auditEntry.NewValues[propertyName] = property.CurrentValue;
                            break;

                        case EntityState.Deleted:
                            auditEntry.AuditType = "Delete";
                            auditEntry.OldValues[propertyName] = property.OriginalValue;
                            break;

                        case EntityState.Modified:
                            if (property.IsModified)
                            {
                                auditEntry.AuditType = "Update";
                                auditEntry.OldValues[propertyName] = property.OriginalValue;
                                auditEntry.NewValues[propertyName] = property.CurrentValue;
                            }
                            break;
                    }
                }

                logs.Add(auditEntry.ToAudit());
            }

            return logs;
        }
    }
}
