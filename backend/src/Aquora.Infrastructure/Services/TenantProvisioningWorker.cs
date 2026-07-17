using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;

namespace Aquora.Infrastructure.Services
{
    public class TenantProvisioningWorker : BackgroundService
    {
        private readonly ITenantProvisioningQueue _queue;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<TenantProvisioningWorker> _logger;
        private readonly IProvisioningProgressReporter _progressReporter;

        public TenantProvisioningWorker(
            ITenantProvisioningQueue queue,
            IServiceScopeFactory scopeFactory,
            ILogger<TenantProvisioningWorker> logger,
            IProvisioningProgressReporter progressReporter)
        {
            _queue = queue;
            _scopeFactory = scopeFactory;
            _logger = logger;
            _progressReporter = progressReporter;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Tenant Provisioning Background Worker started.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var job = await _queue.DequeueAsync(stoppingToken);
                    _logger.LogInformation($"Dequeued tenant provisioning job for Tenant: {job.TenantId} ({job.CompanyName})");

                    await ProcessJobAsync(job, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unhandled error in Tenant Provisioning Worker processing loop.");
                }
            }

            _logger.LogInformation("Tenant Provisioning Background Worker stopped.");
        }

        private async Task ProcessJobAsync(TenantProvisioningJob job, CancellationToken stoppingToken)
        {
            var stopwatch = Stopwatch.StartNew();
            
            // Set initial state
            await UpdateProgressAsync(job.TenantId, 5, "Starting", "Getting things ready...");
            await _progressReporter.ReportProgressAsync(job.OwnerUserId.ToString(), 5, "Starting", "Getting things ready...");

            try
            {
                using (var scope = _scopeFactory.CreateScope())
                {
                    var tenantDatabaseService = scope.ServiceProvider.GetRequiredService<ITenantDatabaseService>();
                    var platformContext = scope.ServiceProvider.GetRequiredService<IPlatformDbContext>();

                    // 1. Execute Provisioning
                    var provisioningResult = await tenantDatabaseService.ProvisionTenantAsync(
                        job.TenantId,
                        job.SchemaName,
                        job.CompanyName,
                        job.CompanyCode,
                        job.OwnerUserId,
                        job.EnabledStations,
                        async (progress, step, status) =>
                        {
                            await UpdateProgressAsync(job.TenantId, progress, step, status);
                            await _progressReporter.ReportProgressAsync(job.OwnerUserId.ToString(), progress, step, status);
                        });

                    // 2. Create UserMembership link in Platform Db
                    await using (var transaction = await platformContext.Database.BeginTransactionAsync(stoppingToken))
                    {
                        try
                        {
                            var membership = new UserMembership
                            {
                                PlatformUserId = job.OwnerUserId,
                                TenantId = job.TenantId,
                                RoleId = provisioningResult.OwnerRoleId,
                                Status = "Active",
                                JoinedAt = DateTime.UtcNow
                            };

                            platformContext.UserMemberships.Add(membership);
                            await platformContext.SaveChangesAsync(stoppingToken);
                            await transaction.CommitAsync(stoppingToken);
                        }
                        catch (Exception ex)
                        {
                            await transaction.RollbackAsync(stoppingToken);
                            throw new InvalidOperationException("Failed to commit user platform membership details.", ex);
                        }
                    }

                    // 3. Complete and mark as Ready
                    stopwatch.Stop();
                    await UpdateProgressAsync(
                        job.TenantId, 
                        100, 
                        "Complete", 
                        "Your workspace is ready!", 
                        isInitialized: true,
                        duration: stopwatch.Elapsed.TotalSeconds);
                    await _progressReporter.ReportProgressAsync(job.OwnerUserId.ToString(), 100, "Complete", "Your workspace is ready!");

                    _logger.LogInformation($"[TENANT CREATION SUCCESS] Tenant: {job.CompanyName} (ID: {job.TenantId}) provisioned successfully in {stopwatch.ElapsedMilliseconds} ms.");
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                stopwatch.Stop();
                _logger.LogWarning(
                    "Tenant provisioning for {CompanyName} (ID: {TenantId}) was interrupted by host shutdown after {ElapsedMs}ms. " +
                    "Tenant remains in current state and can be retried.",
                    job.CompanyName, job.TenantId, stopwatch.ElapsedMilliseconds);
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                _logger.LogError(ex, $"Failed to provision tenant: {job.CompanyName} (ID: {job.TenantId}). Attempting cleanup...");
                
                await HandleFailureAsync(job.TenantId, job.SchemaName, job.OwnerUserId, ex, stopwatch.Elapsed.TotalSeconds);
            }
        }

        private async Task UpdateProgressAsync(
            Guid tenantId, 
            int progress, 
            string step, 
            string status, 
            string? failureReason = null,
            bool isInitialized = false,
            double? duration = null)
        {
            try
            {
                using (var scope = _scopeFactory.CreateScope())
                {
                    var platformContext = scope.ServiceProvider.GetRequiredService<IPlatformDbContext>();
                    var tenant = await platformContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId);
                    if (tenant != null)
                    {
                        tenant.Progress = progress;
                        tenant.CurrentStep = step;
                        tenant.Status = status;
                        
                        if (progress == 15)
                        {
                            tenant.StartedAt = DateTime.UtcNow;
                        }

                        if (isInitialized)
                        {
                            tenant.IsInitialized = true;
                            tenant.InitializedAt = DateTime.UtcNow;
                            tenant.InitializedBy = "SystemWorker";
                            tenant.CompletedAt = DateTime.UtcNow;
                        }

                        if (failureReason != null)
                        {
                            tenant.FailureReason = failureReason;
                        }

                        if (duration.HasValue)
                        {
                            tenant.Duration = duration.Value;
                        }

                        await platformContext.SaveChangesAsync();
                    }
                }
            }
            catch (Exception updateEx)
            {
                _logger.LogError(updateEx, $"Error updating progress in database for Tenant: {tenantId}");
            }
        }

        private async Task HandleFailureAsync(
            Guid tenantId, 
            string schemaName, 
            Guid ownerUserId, 
            Exception ex,
            double duration)
        {
            try
            {
                using (var scope = _scopeFactory.CreateScope())
                {
                    var platformContext = scope.ServiceProvider.GetRequiredService<IPlatformDbContext>();
                    var tenantDatabaseService = scope.ServiceProvider.GetRequiredService<ITenantDatabaseService>();

                    // Clean up/Drop schema if failed
                    try
                    {
                        await tenantDatabaseService.DropTenantSchemaAsync(schemaName);
                    }
                    catch (Exception dropEx)
                    {
                        _logger.LogError(dropEx, $"Failed to drop schema: {schemaName} during failure rollback");
                    }

                    // Update tenant record status to Failed instead of deleting to allow observability & retry
                    var tenant = await platformContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId);
                    if (tenant != null)
                    {
                        tenant.Status = "Failed";
                        tenant.FailureReason = ex.ToString();
                        tenant.RetryCount++;
                        tenant.Duration = duration;
                        tenant.CompletedAt = DateTime.UtcNow;
                        await platformContext.SaveChangesAsync();
                    }

                    // Reset user's TenantId in the platform database so they don't block
                    var user = await platformContext.Users.FirstOrDefaultAsync(u => u.Id == ownerUserId);
                    if (user != null)
                    {
                        user.TenantId = null;
                        await platformContext.SaveChangesAsync();
                    }

                    // Report failure live via SignalR
                    await _progressReporter.ReportFailureAsync(ownerUserId.ToString(), tenant?.CurrentStep ?? "Provisioning", ex.Message);
                }
            }
            catch (Exception rollbackEx)
            {
                _logger.LogError(rollbackEx, $"Critical error during onboarding failure rollback for Tenant: {tenantId}");
            }
        }
    }
}
