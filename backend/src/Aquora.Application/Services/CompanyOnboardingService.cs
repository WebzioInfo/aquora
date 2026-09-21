using System;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Aquora.Application.DTOs.Auth;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Shared.Constants;

namespace Aquora.Application.Services
{
    public class CompanyOnboardingService : ICompanyOnboardingService
    {
        private readonly IPlatformDbContext _platformContext;
        private readonly ITenantDatabaseService _tenantDatabaseService;
        private readonly ITokenService _tokenService;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ISchemaNameGenerator _schemaNameGenerator;
        private readonly ITenantProvisioningQueue _queue;

        public CompanyOnboardingService(
            IPlatformDbContext platformContext,
            ITenantDatabaseService tenantDatabaseService,
            ITokenService tokenService,
            IServiceScopeFactory scopeFactory,
            ISchemaNameGenerator schemaNameGenerator,
            ITenantProvisioningQueue queue)
        {
            _platformContext = platformContext;
            _tenantDatabaseService = tenantDatabaseService;
            _tokenService = tokenService;
            _scopeFactory = scopeFactory;
            _schemaNameGenerator = schemaNameGenerator;
            _queue = queue;
        }

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<Guid, SemaphoreSlim> _userLocks = new();

        public async Task<CompanyOnboardingResponse> OnboardCompanyAsync(Guid userId, CompanyOnboardingRequest request)
        {
            if (userId == Guid.Empty)
            {
                throw new UnauthorizedAccessException("Invalid user.");
            }

            if (request == null)
            {
                throw new ArgumentNullException(nameof(request));
            }

            Validate(request);

            // Concurrency protection: prevent race condition from rapid double-clicks or multiple tabs
            var userLock = _userLocks.GetOrAdd(userId, _ => new SemaphoreSlim(1, 1));
            await userLock.WaitAsync();
            try
            {
                var user = await _platformContext.Users
                    .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted && u.IsActive);
                if (user == null)
                {
                    throw new UnauthorizedAccessException("User not found.");
                }

                if (!user.EmailVerified)
                {
                    throw new InvalidOperationException("Email verification is required before company onboarding.");
                }

                // -------------------------------------------------------------
                // MULTI-FACTOR EXISTING TENANT RESOLUTION (IDEMPOTENCY)
                // -------------------------------------------------------------
                Tenant? existingTenant = null;

                // 1. Direct link on user
                if (user.TenantId.HasValue)
                {
                    existingTenant = await _platformContext.Tenants
                        .FirstOrDefaultAsync(t => t.Id == user.TenantId.Value && !t.IsDeleted);
                }

                // 2. Unfinished/failed tenant owned by this user (email or createdBy match)
                if (existingTenant == null)
                {
                    var normalizedEmail = user.Email.Trim().ToLowerInvariant();
                    var userGuidStr = user.Id.ToString();
                    existingTenant = await _platformContext.Tenants
                        .OrderByDescending(t => t.CreatedAt)
                        .FirstOrDefaultAsync(t => !t.IsDeleted &&
                            (t.OwnerEmail == normalizedEmail || t.CreatedBy == userGuidStr) &&
                            (t.Status == "Failed" || t.Status == "Provisioning" || t.Status == "Pending" || !t.IsInitialized));
                }

                // 3. Matching company name previously created by this owner
                if (existingTenant == null)
                {
                    var normalizedEmail = user.Email.Trim().ToLowerInvariant();
                    var userGuidStr = user.Id.ToString();
                    var normalizedCompanyName = request.CompanyName.Trim().ToLowerInvariant();
                    existingTenant = await _platformContext.Tenants
                        .OrderByDescending(t => t.CreatedAt)
                        .FirstOrDefaultAsync(t => !t.IsDeleted &&
                            (t.OwnerEmail == normalizedEmail || t.CreatedBy == userGuidStr) &&
                            t.Name.ToLower() == normalizedCompanyName);
                }

                // 4. Fallback: UserMembership link in platform database
                if (existingTenant == null)
                {
                    var membership = await _platformContext.UserMemberships
                        .OrderByDescending(m => m.CreatedAt)
                        .FirstOrDefaultAsync(m => m.PlatformUserId == user.Id);

                    if (membership != null)
                    {
                        existingTenant = await _platformContext.Tenants
                            .FirstOrDefaultAsync(t => t.Id == membership.TenantId && !t.IsDeleted);
                    }
                }

                if (existingTenant != null)
                {
                    Console.WriteLine($"[ONBOARDING IDEMPOTENCY]: Found existing tenant {existingTenant.Id} ('{existingTenant.Name}', Status: {existingTenant.Status}) for user {userId}. Reusing existing tenant.");

                    // Self-heal relationship
                    if (user.TenantId != existingTenant.Id)
                    {
                        user.TenantId = existingTenant.Id;
                    }
                    if (string.IsNullOrWhiteSpace(existingTenant.OwnerEmail))
                    {
                        existingTenant.OwnerEmail = user.Email.Trim().ToLowerInvariant();
                    }
                    if (string.IsNullOrWhiteSpace(existingTenant.OwnerName))
                    {
                        existingTenant.OwnerName = $"{user.FirstName} {user.LastName}".Trim();
                    }
                    if (string.IsNullOrWhiteSpace(existingTenant.CreatedBy))
                    {
                        existingTenant.CreatedBy = user.Id.ToString();
                    }
                    await _platformContext.SaveChangesAsync();

                    if (existingTenant.IsInitialized || existingTenant.Status == "Completed")
                    {
                        Console.WriteLine($"[ONBOARDING]: User {userId} requested onboarding but Tenant {existingTenant.Id} is already initialized.");
                        var defaultRoles = new System.Collections.Generic.List<string> { "Owner" };
                        var defaultPerms = new System.Collections.Generic.List<string> { Permissions.DashboardRead };
                        var accToken = _tokenService.GenerateAccessToken(user, defaultRoles, defaultPerms);
                        var refToken = _tokenService.GenerateRefreshToken();
                        return new CompanyOnboardingResponse
                        {
                            TenantId = existingTenant.Id,
                            CompanyName = existingTenant.Name,
                            SchemaName = existingTenant.SchemaName,
                            OwnerRole = "Owner",
                            ProvisioningStatus = "Completed",
                            AccessToken = accToken,
                            RefreshToken = refToken,
                            ExpiresIn = 3600,
                            Permissions = defaultPerms
                        };
                    }

                    if (existingTenant.Status == "Failed")
                    {
                        // Safely reset failed tenant status and re-queue provisioning using the SAME tenant and schema
                        Console.WriteLine($"[ONBOARDING RETRY]: Reusing failed tenant {existingTenant.Id} and schema {existingTenant.SchemaName} for user {userId}.");
                        existingTenant.Name = request.CompanyName.Trim();
                        existingTenant.Status = "Provisioning";
                        existingTenant.Progress = 10;
                        existingTenant.CurrentStep = "TenantCreated";
                        existingTenant.FailureReason = null;
                        existingTenant.StartedAt = DateTime.UtcNow;
                        await _platformContext.SaveChangesAsync();

                        _queue.QueueProvisioning(new TenantProvisioningJob
                        {
                            TenantId = existingTenant.Id,
                            SchemaName = existingTenant.SchemaName,
                            CompanyName = existingTenant.Name,
                            CompanyCode = existingTenant.Code,
                            OwnerUserId = user.Id,
                            EnabledStations = request.EnabledStations
                        });

                        var defaultRoles = new System.Collections.Generic.List<string> { "Owner" };
                        var defaultPerms = new System.Collections.Generic.List<string>
                        {
                            Permissions.TenantRead,
                            Permissions.UsersRead,
                            Permissions.RolesRead,
                            Permissions.AuditRead,
                            Permissions.HierarchyRead,
                            Permissions.DashboardRead
                        };
                        var accToken = _tokenService.GenerateAccessToken(user, defaultRoles, defaultPerms);
                        var refToken = _tokenService.GenerateRefreshToken();
                        return new CompanyOnboardingResponse
                        {
                            TenantId = existingTenant.Id,
                            CompanyName = existingTenant.Name,
                            SchemaName = existingTenant.SchemaName,
                            OwnerRole = "Owner",
                            ProvisioningStatus = "Provisioning",
                            AccessToken = accToken,
                            RefreshToken = refToken,
                            ExpiresIn = 3600,
                            Permissions = defaultPerms
                        };
                    }
                    else
                    {
                        // Provisioning in progress — return active state without duplicating tenant entry
                        var defaultRoles = new System.Collections.Generic.List<string> { "Owner" };
                        var defaultPerms = new System.Collections.Generic.List<string>
                        {
                            Permissions.TenantRead,
                            Permissions.UsersRead,
                            Permissions.RolesRead,
                            Permissions.AuditRead,
                            Permissions.HierarchyRead,
                            Permissions.DashboardRead
                        };
                        var accToken = _tokenService.GenerateAccessToken(user, defaultRoles, defaultPerms);
                        var refToken = _tokenService.GenerateRefreshToken();
                        return new CompanyOnboardingResponse
                        {
                            TenantId = existingTenant.Id,
                            CompanyName = existingTenant.Name,
                            SchemaName = existingTenant.SchemaName,
                            OwnerRole = "Owner",
                            ProvisioningStatus = existingTenant.Status ?? "Provisioning",
                            AccessToken = accToken,
                            RefreshToken = refToken,
                            ExpiresIn = 3600,
                            Permissions = defaultPerms
                        };
                    }
                }

                Console.WriteLine($"[ONBOARDING] No existing tenant found. Creating fresh tenant for user {userId} ({request.CompanyName})");

                var companyCode = await GenerateUniqueCompanyCodeAsync(request.CompanyName);
                var tenantId = Guid.NewGuid();
                var schemaName = await _schemaNameGenerator.GenerateSchemaNameAsync(request.CompanyName);
                var subdomain = companyCode.ToLowerInvariant();

                Console.WriteLine($"[ONBOARDING] Tenant record created with TenantId: {tenantId}, Schema: {schemaName}, Code: {companyCode}");

                // 1. Commit Tenant Creation in Platform Db with authoritative owner metadata
                await using (var transaction = await _platformContext.Database.BeginTransactionAsync())
                {
                    try
                    {
                        var tenant = new Tenant
                        {
                            Id = tenantId,
                            Name = request.CompanyName.Trim(),
                            Code = companyCode.ToUpperInvariant(),
                            SchemaName = schemaName,
                            Subdomain = subdomain,
                            IsInitialized = false,
                            Status = "Provisioning",
                            Progress = 10,
                            CurrentStep = "TenantCreated",
                            StartedAt = DateTime.UtcNow,
                            OwnerEmail = user.Email.Trim().ToLowerInvariant(),
                            OwnerName = $"{user.FirstName} {user.LastName}".Trim(),
                            CreatedBy = user.Id.ToString(),
                            CreatedAt = DateTime.UtcNow
                        };

                        _platformContext.Tenants.Add(tenant);
                        user.TenantId = tenant.Id;
                        await _platformContext.SaveChangesAsync();
                        await transaction.CommitAsync();
                        Console.WriteLine($"[ONBOARDING] Tenant committed and user linked to TenantId: {tenant.Id}");
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync();
                        Console.WriteLine($"[ONBOARDING] Transaction rolled back during tenant creation: {ex.Message}");
                        throw;
                    }
                }

                // 2. Queue Background Tenant Provisioning
                Console.WriteLine($"[ONBOARDING] Provisioning job enqueue attempted for Tenant: {tenantId}");
                _queue.QueueProvisioning(new TenantProvisioningJob
                {
                    TenantId = tenantId,
                    SchemaName = schemaName,
                    CompanyName = request.CompanyName.Trim(),
                    CompanyCode = companyCode,
                    OwnerUserId = user.Id,
                    EnabledStations = request.EnabledStations
                });
                Console.WriteLine($"[ONBOARDING] Provisioning job enqueue succeeded for Tenant: {tenantId}");

                // 3. Generate dynamic token with default role and permission claims during provisioning
                var roles = new System.Collections.Generic.List<string> { "Owner" };
                var permissions = new System.Collections.Generic.List<string>
                {
                    Permissions.TenantRead,
                    Permissions.UsersRead,
                    Permissions.RolesRead,
                    Permissions.AuditRead,
                    Permissions.HierarchyRead,
                    Permissions.DashboardRead
                };

                var accessToken = _tokenService.GenerateAccessToken(user, roles, permissions);
                var refreshToken = _tokenService.GenerateRefreshToken();

                user.RefreshToken = refreshToken;
                user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
                await _platformContext.SaveChangesAsync();

                return new CompanyOnboardingResponse
                {
                    TenantId = tenantId,
                    CompanyId = Guid.Empty, // Created asynchronously in background
                    CompanyName = request.CompanyName.Trim(),
                    SchemaName = schemaName,
                    OwnerRole = "Owner",
                    ProvisioningStatus = "Provisioning",
                    AccessToken = accessToken,
                    RefreshToken = refreshToken,
                    ExpiresIn = 3600,
                    Permissions = permissions
                };
            }
            finally
            {
                userLock.Release();
            }
        }

        public async Task<CompanyOnboardingResponse> RetryOnboardingAsync(Guid userId)
        {
            if (userId == Guid.Empty)
            {
                throw new UnauthorizedAccessException("Invalid user.");
            }

            var user = await _platformContext.Users
                .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted && u.IsActive);
            if (user == null)
            {
                throw new UnauthorizedAccessException("User not found.");
            }

            // Self-heal: If user.TenantId is missing, resolve by owner identity or memberships
            if (!user.TenantId.HasValue)
            {
                var normalizedEmail = user.Email.Trim().ToLowerInvariant();
                var userGuidStr = user.Id.ToString();
                var existingTenant = await _platformContext.Tenants
                    .OrderByDescending(t => t.CreatedAt)
                    .FirstOrDefaultAsync(t => !t.IsDeleted &&
                        (t.OwnerEmail == normalizedEmail || t.CreatedBy == userGuidStr));

                if (existingTenant == null)
                {
                    var membership = await _platformContext.UserMemberships
                        .OrderByDescending(m => m.CreatedAt)
                        .FirstOrDefaultAsync(m => m.PlatformUserId == user.Id);

                    if (membership != null)
                    {
                        existingTenant = await _platformContext.Tenants
                            .FirstOrDefaultAsync(t => t.Id == membership.TenantId && !t.IsDeleted);
                    }
                }

                if (existingTenant != null)
                {
                    user.TenantId = existingTenant.Id;
                    await _platformContext.SaveChangesAsync();
                }
            }

            if (!user.TenantId.HasValue)
            {
                throw new InvalidOperationException("No company associated with this account. Please initialize first.");
            }

            var tenant = await _platformContext.Tenants.FirstOrDefaultAsync(t => t.Id == user.TenantId.Value && !t.IsDeleted);
            if (tenant == null)
            {
                throw new InvalidOperationException("Associated company details not found.");
            }

            if (tenant.Status != "Failed" && (tenant.Status != "Provisioning" || tenant.IsInitialized))
            {
                throw new InvalidOperationException($"Cannot retry onboarding. Current status is '{tenant.Status}'.");
            }

            // Load previously enabled stations
            var enabledStations = await _platformContext.TenantProductionConfigurations
                .Where(c => c.TenantId == tenant.Id && c.IsEnabled)
                .Select(c => c.StationName)
                .ToListAsync();

            // Reset user tenant ID mapping in case it got cleared
            user.TenantId = tenant.Id;

            // Reset tenant status in platform DB
            tenant.Status = "Provisioning";
            tenant.Progress = 10;
            tenant.CurrentStep = "TenantCreated";
            tenant.FailureReason = null;
            tenant.StartedAt = DateTime.UtcNow;

            await _platformContext.SaveChangesAsync();

            // Queue Background Tenant Provisioning
            _queue.QueueProvisioning(new TenantProvisioningJob
            {
                TenantId = tenant.Id,
                SchemaName = tenant.SchemaName,
                CompanyName = tenant.Name,
                CompanyCode = tenant.Code,
                OwnerUserId = user.Id,
                EnabledStations = enabledStations
            });

            // Generate dynamic token
            var roles = new System.Collections.Generic.List<string> { "Owner" };
            var permissions = new System.Collections.Generic.List<string>
            {
                Permissions.TenantRead,
                Permissions.UsersRead,
                Permissions.RolesRead,
                Permissions.AuditRead,
                Permissions.HierarchyRead,
                Permissions.DashboardRead
            };

            var accessToken = _tokenService.GenerateAccessToken(user, roles, permissions);
            var refreshToken = _tokenService.GenerateRefreshToken();

            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            await _platformContext.SaveChangesAsync();

            return new CompanyOnboardingResponse
            {
                TenantId = tenant.Id,
                CompanyId = Guid.Empty,
                CompanyName = tenant.Name,
                SchemaName = tenant.SchemaName,
                OwnerRole = "Owner",
                ProvisioningStatus = "Provisioning",
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresIn = 3600,
                Permissions = permissions
            };
        }

        public async Task<object> GetProvisioningStatusAsync(Guid userId)
        {
            if (userId == Guid.Empty)
                throw new UnauthorizedAccessException("Invalid user.");

            var user = await _platformContext.Users
                .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);
            if (user == null)
                throw new UnauthorizedAccessException("User not found.");

            // Self-heal: If user.TenantId is missing, resolve by owner identity or memberships
            if (!user.TenantId.HasValue)
            {
                var normalizedEmail = user.Email.Trim().ToLowerInvariant();
                var userGuidStr = user.Id.ToString();
                var fallbackTenant = await _platformContext.Tenants
                    .OrderByDescending(t => t.CreatedAt)
                    .FirstOrDefaultAsync(t => !t.IsDeleted &&
                        (t.OwnerEmail == normalizedEmail || t.CreatedBy == userGuidStr));

                if (fallbackTenant == null)
                {
                    var membership = await _platformContext.UserMemberships
                        .OrderByDescending(m => m.CreatedAt)
                        .FirstOrDefaultAsync(m => m.PlatformUserId == user.Id);

                    if (membership != null)
                    {
                        fallbackTenant = await _platformContext.Tenants
                            .FirstOrDefaultAsync(t => t.Id == membership.TenantId && !t.IsDeleted);
                    }
                }

                if (fallbackTenant != null)
                {
                    user.TenantId = fallbackTenant.Id;
                    await _platformContext.SaveChangesAsync();
                }
            }

            if (!user.TenantId.HasValue)
            {
                return new
                {
                    TenantId = (Guid?)null,
                    Status = "Pending",
                    Progress = 0,
                    CurrentStep = (string?)null,
                    Message = "No workspace created yet.",
                    FailureReason = (string?)null,
                    Steps = Array.Empty<object>(),
                    EstimatedRemainingSeconds = 0
                };
            }

            var tenant = await _platformContext.Tenants.FindAsync(user.TenantId.Value);
            if (tenant == null || tenant.IsDeleted)
            {
                return new
                {
                    TenantId = (Guid?)null,
                    Status = "Pending",
                    Progress = 0,
                    CurrentStep = (string?)null,
                    Message = "Workspace record not found.",
                    FailureReason = (string?)null,
                    Steps = Array.Empty<object>(),
                    EstimatedRemainingSeconds = 0
                };
            }

            var isDone = tenant.IsInitialized || tenant.Status == "Completed";
            var currentStepKey = tenant.CurrentStep ?? (isDone ? "ProvisioningCompleted" : "TenantCreated");
            var isFailed = tenant.Status == "Failed";

            var pipelineSteps = new[]
            {
                new { key = "TenantCreated", name = "Create Tenant Workspace Entry" },
                new { key = "DatabaseCreated", name = "Create Multi-Tenant Database Schema" },
                new { key = "SchemaMigrationsRun", name = "Run Core System Migrations" },
                new { key = "SystemDataSeeded", name = "Seed Master System Data" },
                new { key = "DefaultRolesCreated", name = "Create Default Roles & Permissions" },
                new { key = "AdministratorUserInitialized", name = "Initialize Company Admin Account" },
                new { key = "ManufacturingModulesInitialized", name = "Configure Bottling & Production Lines" },
                new { key = "TenantSettingsSaved", name = "Configure Regional & Industrial Settings" },
                new { key = "ProvisioningCompleted", name = "Finalize Workspace Initialization" },
            };

            int currentStepIndex = Array.FindIndex(pipelineSteps, s => s.key.Equals(currentStepKey, StringComparison.OrdinalIgnoreCase));
            if (currentStepIndex < 0) currentStepIndex = isDone ? pipelineSteps.Length - 1 : 0;

            var stepsResult = pipelineSteps.Select((s, index) =>
            {
                string status = "Pending";
                if (isDone || index < currentStepIndex)
                {
                    status = "Completed";
                }
                else if (index == currentStepIndex)
                {
                    status = isFailed ? "Failed" : (isDone ? "Completed" : "Running");
                }

                return new
                {
                    key = s.key,
                    name = s.name,
                    status,
                    errorMessage = (status == "Failed") ? tenant.FailureReason : null
                };
            }).ToList();

            int completedCount = stepsResult.Count(s => s.status == "Completed");
            int calculatedProgress = isDone ? 100 : Math.Max(tenant.Progress, (int)Math.Round((double)completedCount / pipelineSteps.Length * 100));

            return new
            {
                TenantId = tenant.Id,
                Status = isDone ? "Completed" : (isFailed ? "Failed" : "Provisioning"),
                Progress = calculatedProgress,
                CurrentStep = currentStepKey,
                FailedStep = isFailed ? currentStepKey : (string?)null,
                Message = isDone ? "Your workspace is ready!" : (isFailed ? (tenant.FailureReason ?? "Provisioning failed.") : $"{pipelineSteps[currentStepIndex].name}..."),
                FailureReason = tenant.FailureReason,
                Steps = stepsResult,
                EstimatedRemainingSeconds = (isDone || isFailed) ? (int?)null : Math.Max(3, (pipelineSteps.Length - completedCount) * 2)
            };
        }

        private static void Validate(CompanyOnboardingRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CompanyName))
            {
                throw new ArgumentException("Company name is required.", nameof(request.CompanyName));
            }

            if (request.EmployeeCount <= 0)
            {
                throw new ArgumentException("Employee count must be greater than zero.", nameof(request.EmployeeCount));
            }

            if (string.IsNullOrWhiteSpace(request.HowDidYouHearAboutUs))
            {
                throw new ArgumentException("How did you hear about us is required.", nameof(request.HowDidYouHearAboutUs));
            }
        }

        private async Task<string> GenerateUniqueCompanyCodeAsync(string companyName)
        {
            var baseCode = NormalizeCode(companyName);
            var code = baseCode;
            var suffix = 1;

            while (await _platformContext.Tenants.AnyAsync(t => t.Code == code && !t.IsDeleted))
            {
                code = $"{baseCode}_{suffix}";
                suffix++;
            }

            return code;
        }

        private static string NormalizeCode(string code)
        {
            var normalized = Regex.Replace(code.Trim().ToUpperInvariant(), "[^A-Z0-9]+", "_").Trim('_');
            return string.IsNullOrWhiteSpace(normalized) ? $"COMPANY_{Guid.NewGuid():N}" : normalized;
        }

        private async Task<(System.Collections.Generic.List<string> Roles, System.Collections.Generic.List<string> Permissions)> GetUserRolesAndPermissionsAsync(User user, string schemaName)
        {
            var roles = new System.Collections.Generic.List<string>();
            var permissions = new System.Collections.Generic.List<string>();

            if (user.IsPlatformAdmin)
            {
                roles.Add("SuperAdmin");
                permissions.Add("*:*");
                return (roles, permissions);
            }

            try
            {
                using (var scope = _scopeFactory.CreateScope())
                {
                    var tenantProvider = scope.ServiceProvider.GetRequiredService<ITenantProvider>();
                    tenantProvider.SetTenantId(user.TenantId.Value);
                    tenantProvider.SetTenantSchemaName(schemaName);

                    var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantDbContext>();

                    var userRoles = await tenantContext.UserRoles
                        .Where(ur => ur.UserId == user.Id)
                        .Include(ur => ur.Role)
                        .ToListAsync();

                    foreach (var ur in userRoles)
                    {
                        if (ur.Role != null)
                        {
                            roles.Add(ur.Role.Name);
                            
                            var rolePerms = await tenantContext.RolePermissions
                                .Where(rp => rp.RoleId == ur.RoleId)
                                .Include(rp => rp.Permission)
                                .ToListAsync();

                            foreach (var rp in rolePerms)
                            {
                                if (rp.Permission != null)
                                {
                                    permissions.Add(rp.Permission.Code);
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading user roles/permissions during onboarding token gen: {ex.Message}");
            }

            return (roles, permissions);
        }
    }
}
