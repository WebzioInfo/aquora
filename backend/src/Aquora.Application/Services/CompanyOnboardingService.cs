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

            if (user.TenantId.HasValue)
            {
                var existingTenant = await _platformContext.Tenants.FirstOrDefaultAsync(t => t.Id == user.TenantId.Value && !t.IsDeleted);
                if (existingTenant != null)
                {
                    if (existingTenant.IsInitialized || existingTenant.Status == "Completed")
                    {
                        Console.WriteLine($"[ONBOARDING]: User {userId} requested onboarding but Tenant {existingTenant.Id} is already initialized.");
                        var defaultRoles = new System.Collections.Generic.List<string> { "CompanyAdmin" };
                        var defaultPerms = new System.Collections.Generic.List<string> { Permissions.DashboardRead };
                        var accToken = _tokenService.GenerateAccessToken(user, defaultRoles, defaultPerms);
                        var refToken = _tokenService.GenerateRefreshToken();
                        return new CompanyOnboardingResponse
                        {
                            TenantId = existingTenant.Id,
                            CompanyName = existingTenant.Name,
                            SchemaName = existingTenant.SchemaName,
                            OwnerRole = "CompanyAdmin",
                            ProvisioningStatus = "Completed",
                            AccessToken = accToken,
                            RefreshToken = refToken,
                            ExpiresIn = 3600,
                            Permissions = defaultPerms
                        };
                    }
                    else
                    {
                        // Provisioning in progress — return active state without duplicating tenant entry
                        var defaultRoles = new System.Collections.Generic.List<string> { "CompanyAdmin" };
                        var defaultPerms = new System.Collections.Generic.List<string>();
                        var accToken = _tokenService.GenerateAccessToken(user, defaultRoles, defaultPerms);
                        var refToken = _tokenService.GenerateRefreshToken();
                        return new CompanyOnboardingResponse
                        {
                            TenantId = existingTenant.Id,
                            CompanyName = existingTenant.Name,
                            SchemaName = existingTenant.SchemaName,
                            OwnerRole = "CompanyAdmin",
                            ProvisioningStatus = existingTenant.Status ?? "Provisioning",
                            AccessToken = accToken,
                            RefreshToken = refToken,
                            ExpiresIn = 3600,
                            Permissions = defaultPerms
                        };
                    }
                }
            }

            var companyCode = await GenerateUniqueCompanyCodeAsync(request.CompanyName);

            var tenantId = Guid.NewGuid();
            var schemaName = await _schemaNameGenerator.GenerateSchemaNameAsync(request.CompanyName);
            var subdomain = companyCode.ToLowerInvariant();

            // 1. Commit Tenant Creation in Platform Db
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
                        CurrentStep = "Queueing provisioning",
                        StartedAt = DateTime.UtcNow
                    };

                    _platformContext.Tenants.Add(tenant);
                    user.TenantId = tenant.Id;
                    await _platformContext.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }

            // 2. Queue Background Tenant Provisioning
            _queue.QueueProvisioning(new TenantProvisioningJob
            {
                TenantId = tenantId,
                SchemaName = schemaName,
                CompanyName = request.CompanyName.Trim(),
                CompanyCode = companyCode,
                OwnerUserId = user.Id,
                EnabledStations = request.EnabledStations
            });

            // 3. Generate dynamic token with default role and permission claims during provisioning
            var roles = new System.Collections.Generic.List<string> { "CompanyAdmin" };
            var permissions = new System.Collections.Generic.List<string>
            {
                Permissions.TenantRead, Permissions.TenantWrite,
                Permissions.UsersRead, Permissions.UsersWrite,
                Permissions.RolesRead, Permissions.RolesWrite,
                Permissions.AuditRead,
                Permissions.HierarchyRead, Permissions.HierarchyWrite,
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
                OwnerRole = "CompanyAdmin",
                ProvisioningStatus = "Provisioning",
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresIn = 3600,
                Permissions = permissions
            };
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

            if (!user.TenantId.HasValue)
            {
                throw new InvalidOperationException("No company associated with this account. Please initialize first.");
            }

            var tenant = await _platformContext.Tenants.FirstOrDefaultAsync(t => t.Id == user.TenantId.Value);
            if (tenant == null)
            {
                throw new InvalidOperationException("Associated company details not found.");
            }

            if (tenant.Status != "Failed")
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
            tenant.Progress = 5;
            tenant.CurrentStep = "Workspace Created";
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
            var roles = new System.Collections.Generic.List<string> { "CompanyAdmin" };
            var permissions = new System.Collections.Generic.List<string>
            {
                Permissions.TenantRead, Permissions.TenantWrite,
                Permissions.UsersRead, Permissions.UsersWrite,
                Permissions.RolesRead, Permissions.RolesWrite,
                Permissions.AuditRead,
                Permissions.HierarchyRead, Permissions.HierarchyWrite,
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
                OwnerRole = "CompanyAdmin",
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

            if (!user.TenantId.HasValue)
            {
                return new
                {
                    Status = "Pending",
                    Progress = 0,
                    Step = (string?)null,
                    Message = "No workspace created yet.",
                    FailureReason = (string?)null
                };
            }

            var tenant = await _platformContext.Tenants.FindAsync(user.TenantId.Value);
            if (tenant == null)
            {
                return new
                {
                    Status = "Pending",
                    Progress = 0,
                    Step = (string?)null,
                    Message = "Workspace record not found.",
                    FailureReason = (string?)null
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
            int calculatedProgress = isDone ? 100 : (int)Math.Round((double)completedCount / pipelineSteps.Length * 100);

            return new
            {
                TenantId = tenant.Id,
                Status = isDone ? "Completed" : (isFailed ? "Failed" : "Provisioning"),
                Progress = calculatedProgress,
                CurrentStep = currentStepKey,
                Message = isDone ? "Your workspace is ready!" : (isFailed ? (tenant.FailureReason ?? "Provisioning failed.") : $"{pipelineSteps[currentStepIndex].name}..."),
                FailureReason = tenant.FailureReason,
                Steps = stepsResult,
                EstimatedRemainingSeconds = isDone ? 0 : Math.Max(3, (pipelineSteps.Length - completedCount) * 2)
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
