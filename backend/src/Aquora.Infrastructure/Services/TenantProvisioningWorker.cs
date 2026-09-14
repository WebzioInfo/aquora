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
            _logger.LogInformation("[WORKER] Tenant Provisioning Background Worker started.");

            // Startup Orphaned Provisioning Recovery
            try
            {
                using (var scope = _scopeFactory.CreateScope())
                {
                    var platformContext = scope.ServiceProvider.GetRequiredService<IPlatformDbContext>();
                    var uninitializedTenants = await platformContext.Tenants
                        .Where(t => !t.IsDeleted && !t.IsInitialized && t.Status == "Provisioning")
                        .ToListAsync(stoppingToken);

                    foreach (var orphanedTenant in uninitializedTenants)
                    {
                        var ownerUser = await platformContext.Users.FirstOrDefaultAsync(u => u.TenantId == orphanedTenant.Id, stoppingToken);
                        if (ownerUser != null)
                        {
                            var enabledStations = await platformContext.TenantProductionConfigurations
                                .Where(c => c.TenantId == orphanedTenant.Id && c.IsEnabled)
                                .Select(c => c.StationName)
                                .ToListAsync(stoppingToken);

                            _logger.LogInformation($"[WORKER] Auto-recovering orphaned provisioning job for Tenant: {orphanedTenant.Id} ({orphanedTenant.Name})");
                            _queue.QueueProvisioning(new TenantProvisioningJob
                            {
                                TenantId = orphanedTenant.Id,
                                SchemaName = orphanedTenant.SchemaName,
                                CompanyName = orphanedTenant.Name,
                                CompanyCode = orphanedTenant.Code,
                                OwnerUserId = ownerUser.Id,
                                EnabledStations = enabledStations
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[WORKER] Error while recovering orphaned provisioning jobs on startup.");
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("[WORKER] Waiting for provisioning job...");
                    var job = await _queue.DequeueAsync(stoppingToken);
                    _logger.LogInformation($"[WORKER] Provisioning job received. Processing tenant {job.TenantId} ({job.CompanyName})");

                    await ProcessJobAsync(job, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[WORKER] Unhandled error in Tenant Provisioning Worker processing loop.");
                }
            }

            _logger.LogInformation("[WORKER] Tenant Provisioning Background Worker stopped.");
        }

        private async Task ProcessJobAsync(TenantProvisioningJob job, CancellationToken stoppingToken)
        {
            var stopwatch = Stopwatch.StartNew();
            
            // Set initial state matching pipeline step 1
            await UpdateProgressAsync(job.TenantId, 10, "TenantCreated", "Create Tenant Workspace Entry");
            await _progressReporter.ReportProgressAsync(job.OwnerUserId.ToString(), 10, "TenantCreated", "Create Tenant Workspace Entry");

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
                    // 2. Create UserMembership link in Platform Db (Idempotent)
                    await using (var transaction = await platformContext.Database.BeginTransactionAsync(stoppingToken))
                    {
                        try
                        {
                            var existingMembership = await platformContext.UserMemberships.FirstOrDefaultAsync(
                                m => m.PlatformUserId == job.OwnerUserId && m.TenantId == job.TenantId, stoppingToken);

                            if (existingMembership == null)
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
                            }
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
                        "ProvisioningCompleted", 
                        "Your workspace is ready!", 
                        isInitialized: true,
                        duration: stopwatch.Elapsed.TotalSeconds);
                    await _progressReporter.ReportProgressAsync(job.OwnerUserId.ToString(), 100, "ProvisioningCompleted", "Your workspace is ready!");

                    _logger.LogInformation($"[WORKER] [TENANT CREATION SUCCESS] Tenant: {job.CompanyName} (ID: {job.TenantId}) provisioned successfully in {stopwatch.ElapsedMilliseconds} ms.");
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                stopwatch.Stop();
                _logger.LogWarning(
                    "[WORKER] Tenant provisioning for {CompanyName} (ID: {TenantId}) was interrupted by host shutdown after {ElapsedMs}ms.",
                    job.CompanyName, job.TenantId, stopwatch.ElapsedMilliseconds);
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                
                var targetEx = ex.InnerException ?? ex;
                var exType = targetEx.GetType();
                string sqlState = exType.GetProperty("SqlState")?.GetValue(targetEx)?.ToString() ?? "UNKNOWN";
                string pgTable = exType.GetProperty("TableName")?.GetValue(targetEx)?.ToString() ?? "UNKNOWN";
                string pgColumn = exType.GetProperty("ColumnName")?.GetValue(targetEx)?.ToString() ?? "UNKNOWN";
                string pgDetail = exType.GetProperty("Detail")?.GetValue(targetEx)?.ToString() ?? "N/A";

                _logger.LogError(ex, 
                    "[WORKER] [PROVISIONING FAILURE] Tenant: {CompanyName} (ID: {TenantId}, Schema: {SchemaName}). " +
                    "Step: Failed, SQLSTATE: {SqlState}, Table: {Table}, Column: {Column}, Detail: {Detail}, Error: {Message}",
                    job.CompanyName, job.TenantId, job.SchemaName, sqlState, pgTable, pgColumn, pgDetail, ex.Message);
                
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
                        tenant.Status = isInitialized || progress >= 100 ? "Completed" : (failureReason != null ? "Failed" : "Provisioning");
                        
                        if (progress == 15)
                        {
                            tenant.StartedAt = DateTime.UtcNow;
                        }

                        if (isInitialized || progress >= 100)
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

                    // Ensure user's TenantId in the platform database remains associated with the failed tenant for status and retry
                    var user = await platformContext.Users.FirstOrDefaultAsync(u => u.Id == ownerUserId);
                    if (user != null && user.TenantId != tenantId)
                    {
                        user.TenantId = tenantId;
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
