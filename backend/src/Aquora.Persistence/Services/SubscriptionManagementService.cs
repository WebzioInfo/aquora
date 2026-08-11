using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.DTOs.Subscriptions;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Aquora.Shared.Models;

namespace Aquora.Persistence.Services
{
    public class SubscriptionManagementService : ISubscriptionManagementService
    {
        private readonly PlatformDbContext _platformContext;

        public SubscriptionManagementService(PlatformDbContext platformContext)
        {
            _platformContext = platformContext;
        }

        public async Task<PagedResult<SubscriptionPlanDto>> GetPlansAsync(SubscriptionPlanListQuery query)
        {
            // Auto-seed if empty
            await SeedDefaultPlansAsync();
            await EnsureINRPlansAsync();

            var dbQuery = _platformContext.SubscriptionPlans
                .AsNoTracking()
                .Include(p => p.Features)
                .Include(p => p.Limits)
                .Where(p => !p.IsDeleted);

            // Filtering
            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                var s = query.Search.Trim().ToLower();
                dbQuery = dbQuery.Where(p =>
                    p.Name.ToLower().Contains(s) ||
                    p.Code.ToLower().Contains(s) ||
                    p.Description.ToLower().Contains(s) ||
                    p.Features.Any(f => f.FeatureName.ToLower().Contains(s)));
            }

            if (!string.IsNullOrWhiteSpace(query.StatusFilter))
            {
                var sf = query.StatusFilter.Trim();
                dbQuery = dbQuery.Where(p => p.Status.Equals(sf, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(query.BillingCycleFilter))
            {
                var bc = query.BillingCycleFilter.Trim();
                dbQuery = dbQuery.Where(p => p.BillingCycle.Equals(bc, StringComparison.OrdinalIgnoreCase));
            }

            if (query.IsPopularFilter.HasValue && query.IsPopularFilter.Value)
            {
                dbQuery = dbQuery.Where(p => p.IsPopular);
            }

            if (query.IsRecommendedFilter.HasValue && query.IsRecommendedFilter.Value)
            {
                dbQuery = dbQuery.Where(p => p.IsRecommended);
            }

            // Tenant counts per plan
            var companyCounts = await _platformContext.Tenants
                .AsNoTracking()
                .Where(t => !t.IsDeleted && t.IsActive)
                .GroupBy(t => t.SubscriptionPlan)
                .Select(g => new { PlanName = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.PlanName, x => x.Count, StringComparer.OrdinalIgnoreCase);

            // Sorting
            bool isDesc = string.Equals(query.SortOrder, "desc", StringComparison.OrdinalIgnoreCase);
            dbQuery = (query.SortBy?.ToLower()) switch
            {
                "price" => isDesc ? dbQuery.OrderByDescending(p => p.MonthlyPrice) : dbQuery.OrderBy(p => p.MonthlyPrice),
                "duration" => isDesc ? dbQuery.OrderByDescending(p => p.DurationDays) : dbQuery.OrderBy(p => p.DurationDays),
                "createdat" => isDesc ? dbQuery.OrderByDescending(p => p.CreatedAt) : dbQuery.OrderBy(p => p.CreatedAt),
                "updatedat" => isDesc ? dbQuery.OrderByDescending(p => p.UpdatedAt ?? p.CreatedAt) : dbQuery.OrderBy(p => p.UpdatedAt ?? p.CreatedAt),
                "name" => isDesc ? dbQuery.OrderByDescending(p => p.Name) : dbQuery.OrderBy(p => p.Name),
                _ => isDesc ? dbQuery.OrderByDescending(p => p.DisplayOrder) : dbQuery.OrderBy(p => p.DisplayOrder)
            };

            int totalCount = await dbQuery.CountAsync();
            int page = Math.Max(1, query.Page);
            int pageSize = Math.Clamp(query.PageSize, 1, 100);

            var plans = await dbQuery
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var items = plans.Select(p => MapToDto(p, companyCounts)).ToList();

            return new PagedResult<SubscriptionPlanDto>(items, totalCount, page, pageSize);
        }

        public async Task<SubscriptionPlanDto> GetPlanByIdAsync(Guid planId)
        {
            var p = await _platformContext.SubscriptionPlans
                .AsNoTracking()
                .Include(x => x.Features)
                .Include(x => x.Limits)
                .FirstOrDefaultAsync(x => x.Id == planId && !x.IsDeleted);

            if (p == null) throw new KeyNotFoundException($"Subscription Plan with ID '{planId}' was not found.");

            var companyCount = await _platformContext.Tenants
                .AsNoTracking()
                .CountAsync(t => !t.IsDeleted && t.SubscriptionPlan.Equals(p.Name, StringComparison.OrdinalIgnoreCase));

            var dict = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase) { [p.Name] = companyCount };
            return MapToDto(p, dict);
        }

        public async Task<Guid> CreatePlanAsync(CreateSubscriptionPlanRequest request, string performerUserId, string performerIp)
        {
            var code = string.IsNullOrWhiteSpace(request.Code) 
                ? request.Name.Trim().ToUpperInvariant().Replace(" ", "_")
                : request.Code.Trim().ToUpperInvariant();

            var exists = await _platformContext.SubscriptionPlans.AnyAsync(p => p.Code == code && !p.IsDeleted);
            if (exists)
            {
                throw new InvalidOperationException($"Subscription Plan Code '{code}' already exists.");
            }

            var plan = new SubscriptionPlan
            {
                Id = Guid.NewGuid(),
                Name = request.Name.Trim(),
                Code = code,
                Description = request.Description ?? string.Empty,
                MonthlyPrice = request.MonthlyPrice,
                YearlyPrice = request.YearlyPrice > 0 ? request.YearlyPrice : request.MonthlyPrice * 10,
                OfferPrice = request.OfferPrice,
                DiscountPercent = request.DiscountPercent,
                Currency = string.IsNullOrWhiteSpace(request.Currency) ? "USD" : request.Currency.Trim(),
                BillingCycle = string.IsNullOrWhiteSpace(request.BillingCycle) ? "Monthly" : request.BillingCycle.Trim(),
                TrialDays = request.TrialDays,
                DurationDays = request.DurationDays > 0 ? request.DurationDays : 30,
                DisplayOrder = request.DisplayOrder,
                IsPopular = request.IsPopular,
                IsRecommended = request.IsRecommended,
                Color = string.IsNullOrWhiteSpace(request.Color) ? "#3B82F6" : request.Color.Trim(),
                Status = string.IsNullOrWhiteSpace(request.Status) ? "Published" : request.Status.Trim(),
                TaxType = string.IsNullOrWhiteSpace(request.TaxType) ? "Tax Exclusive" : request.TaxType.Trim(),
                AutoActivateTrial = request.AutoActivateTrial,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = performerUserId,
                CreatedByIP = performerIp
            };

            _platformContext.SubscriptionPlans.Add(plan);

            // Resource limits
            var limitsDto = request.Limits ?? new SubscriptionPlanLimitsDto();
            var limits = new SubscriptionPlanLimits
            {
                Id = Guid.NewGuid(),
                PlanId = plan.Id,
                ProductionLines = limitsDto.ProductionLines,
                Machines = limitsDto.Machines,
                Employees = limitsDto.Employees,
                Customers = limitsDto.Customers,
                Suppliers = limitsDto.Suppliers,
                Warehouses = limitsDto.Warehouses,
                ProductionBatches = limitsDto.ProductionBatches,
                Products = limitsDto.Products,
                RawMaterials = limitsDto.RawMaterials,
                StorageGB = limitsDto.StorageGB,
                APIRequestsPerMin = limitsDto.APIRequestsPerMin,
                FileUploadSizeMB = limitsDto.FileUploadSizeMB,
                DailyExports = limitsDto.DailyExports,
                ConcurrentUsers = limitsDto.ConcurrentUsers,
                SMSLimit = limitsDto.SMSLimit,
                EmailLimit = limitsDto.EmailLimit,
                CreatedAt = DateTime.UtcNow
            };
            _platformContext.SubscriptionPlanLimits.Add(limits);

            // Features
            if (request.Features != null && request.Features.Any())
            {
                int order = 1;
                foreach (var f in request.Features)
                {
                    _platformContext.SubscriptionFeatures.Add(new SubscriptionFeature
                    {
                        Id = Guid.NewGuid(),
                        PlanId = plan.Id,
                        FeatureName = f.FeatureName.Trim(),
                        FeatureDescription = f.FeatureDescription,
                        FeatureCategory = string.IsNullOrWhiteSpace(f.FeatureCategory) ? "Core Modules" : f.FeatureCategory.Trim(),
                        FeatureValue = string.IsNullOrWhiteSpace(f.FeatureValue) ? "Yes" : f.FeatureValue.Trim(),
                        FeatureUnit = f.FeatureUnit,
                        DisplayOrder = f.DisplayOrder > 0 ? f.DisplayOrder : order++,
                        IsHighlighted = f.IsHighlighted,
                        IsUnlimited = f.IsUnlimited,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            // Audit log
            _platformContext.SubscriptionAuditLogs.Add(new SubscriptionAuditLog
            {
                Id = Guid.NewGuid(),
                PlanId = plan.Id,
                Action = "CREATE_PLAN",
                PerformerUserId = performerUserId,
                PerformerUserEmail = performerUserId.Contains("@") ? performerUserId : "system@aquora.local",
                NewValuesJson = JsonSerializer.Serialize(plan),
                Reason = $"Created subscription plan '{plan.Name}' ({plan.Code}) with price ${plan.MonthlyPrice}/mo.",
                Timestamp = DateTime.UtcNow,
                IpAddress = performerIp
            });

            await _platformContext.SaveChangesAsync();
            return plan.Id;
        }

        public async Task<bool> UpdatePlanAsync(Guid planId, UpdateSubscriptionPlanRequest request, string performerUserId, string performerIp)
        {
            var plan = await _platformContext.SubscriptionPlans
                .Include(p => p.Features)
                .Include(p => p.Limits)
                .FirstOrDefaultAsync(p => p.Id == planId && !p.IsDeleted);

            if (plan == null) throw new KeyNotFoundException("Subscription Plan not found.");

            var oldValues = JsonSerializer.Serialize(plan);

            plan.Name = request.Name.Trim();
            plan.Description = request.Description ?? string.Empty;
            plan.MonthlyPrice = request.MonthlyPrice;
            plan.YearlyPrice = request.YearlyPrice;
            plan.OfferPrice = request.OfferPrice;
            plan.DiscountPercent = request.DiscountPercent;
            plan.Currency = request.Currency;
            plan.BillingCycle = request.BillingCycle;
            plan.TrialDays = request.TrialDays;
            plan.DurationDays = request.DurationDays;
            plan.DisplayOrder = request.DisplayOrder;
            plan.IsPopular = request.IsPopular;
            plan.IsRecommended = request.IsRecommended;
            plan.Color = request.Color;
            plan.Status = request.Status;
            plan.TaxType = request.TaxType;
            plan.AutoActivateTrial = request.AutoActivateTrial;
            plan.UpdatedAt = DateTime.UtcNow;
            plan.UpdatedBy = performerUserId;

            if (request.Limits != null)
            {
                if (plan.Limits == null)
                {
                    plan.Limits = new SubscriptionPlanLimits { Id = Guid.NewGuid(), PlanId = plan.Id };
                    _platformContext.SubscriptionPlanLimits.Add(plan.Limits);
                }
                plan.Limits.ProductionLines = request.Limits.ProductionLines;
                plan.Limits.Machines = request.Limits.Machines;
                plan.Limits.Employees = request.Limits.Employees;
                plan.Limits.Customers = request.Limits.Customers;
                plan.Limits.Suppliers = request.Limits.Suppliers;
                plan.Limits.Warehouses = request.Limits.Warehouses;
                plan.Limits.ProductionBatches = request.Limits.ProductionBatches;
                plan.Limits.Products = request.Limits.Products;
                plan.Limits.RawMaterials = request.Limits.RawMaterials;
                plan.Limits.StorageGB = request.Limits.StorageGB;
                plan.Limits.APIRequestsPerMin = request.Limits.APIRequestsPerMin;
                plan.Limits.FileUploadSizeMB = request.Limits.FileUploadSizeMB;
                plan.Limits.DailyExports = request.Limits.DailyExports;
                plan.Limits.ConcurrentUsers = request.Limits.ConcurrentUsers;
                plan.Limits.SMSLimit = request.Limits.SMSLimit;
                plan.Limits.EmailLimit = request.Limits.EmailLimit;
                plan.Limits.UpdatedAt = DateTime.UtcNow;
            }

            // Features update
            if (request.Features != null)
            {
                _platformContext.SubscriptionFeatures.RemoveRange(plan.Features);
                int order = 1;
                foreach (var f in request.Features)
                {
                    _platformContext.SubscriptionFeatures.Add(new SubscriptionFeature
                    {
                        Id = Guid.NewGuid(),
                        PlanId = plan.Id,
                        FeatureName = f.FeatureName.Trim(),
                        FeatureDescription = f.FeatureDescription,
                        FeatureCategory = string.IsNullOrWhiteSpace(f.FeatureCategory) ? "Core Modules" : f.FeatureCategory.Trim(),
                        FeatureValue = string.IsNullOrWhiteSpace(f.FeatureValue) ? "Yes" : f.FeatureValue.Trim(),
                        FeatureUnit = f.FeatureUnit,
                        DisplayOrder = f.DisplayOrder > 0 ? f.DisplayOrder : order++,
                        IsHighlighted = f.IsHighlighted,
                        IsUnlimited = f.IsUnlimited,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            _platformContext.SubscriptionAuditLogs.Add(new SubscriptionAuditLog
            {
                Id = Guid.NewGuid(),
                PlanId = plan.Id,
                Action = "UPDATE_PLAN",
                PerformerUserId = performerUserId,
                PerformerUserEmail = performerUserId.Contains("@") ? performerUserId : "system@aquora.local",
                OldValuesJson = oldValues,
                NewValuesJson = JsonSerializer.Serialize(plan),
                Reason = $"Updated subscription plan '{plan.Name}'.",
                Timestamp = DateTime.UtcNow,
                IpAddress = performerIp
            });

            await _platformContext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeletePlanAsync(Guid planId, string performerUserId, string performerIp)
        {
            var plan = await _platformContext.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == planId && !p.IsDeleted);
            if (plan == null) throw new KeyNotFoundException("Subscription Plan not found.");

            // Validation: Prevent deleting plans currently assigned to active companies
            var assignedCompanies = await _platformContext.Tenants
                .AsNoTracking()
                .Where(t => !t.IsDeleted && t.IsActive && t.SubscriptionPlan != null && t.SubscriptionPlan.ToLower() == plan.Name.ToLower())
                .Select(t => t.Name)
                .ToListAsync();

            if (assignedCompanies.Any())
            {
                throw new InvalidOperationException("This subscription plan is currently assigned to active tenants and cannot be deleted.");
            }

            plan.IsDeleted = true;
            plan.DeletedAt = DateTime.UtcNow;
            plan.DeletedBy = performerUserId;

            _platformContext.SubscriptionAuditLogs.Add(new SubscriptionAuditLog
            {
                Id = Guid.NewGuid(),
                PlanId = plan.Id,
                Action = "DELETE_PLAN",
                PerformerUserId = performerUserId,
                PerformerUserEmail = performerUserId.Contains("@") ? performerUserId : "system@aquora.local",
                Reason = $"Soft-deleted plan '{plan.Name}'.",
                Timestamp = DateTime.UtcNow,
                IpAddress = performerIp
            });

            await _platformContext.SaveChangesAsync();
            return true;
        }

        public async Task<Guid> DuplicatePlanAsync(Guid planId, string performerUserId, string performerIp)
        {
            var original = await _platformContext.SubscriptionPlans
                .Include(p => p.Features)
                .Include(p => p.Limits)
                .FirstOrDefaultAsync(p => p.Id == planId && !p.IsDeleted);

            if (original == null) throw new KeyNotFoundException("Subscription Plan not found.");

            var newName = $"{original.Name} (Copy)";
            var newCode = $"{original.Code}_COPY_{DateTime.UtcNow:HHmmss}";

            var clone = new SubscriptionPlan
            {
                Id = Guid.NewGuid(),
                Name = newName,
                Code = newCode,
                Description = original.Description,
                MonthlyPrice = original.MonthlyPrice,
                YearlyPrice = original.YearlyPrice,
                OfferPrice = original.OfferPrice,
                DiscountPercent = original.DiscountPercent,
                Currency = original.Currency,
                BillingCycle = original.BillingCycle,
                TrialDays = original.TrialDays,
                DurationDays = original.DurationDays,
                DisplayOrder = original.DisplayOrder + 1,
                IsPopular = false,
                IsRecommended = false,
                Color = original.Color,
                Status = "Draft",
                TaxType = original.TaxType,
                AutoActivateTrial = original.AutoActivateTrial,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = performerUserId
            };

            _platformContext.SubscriptionPlans.Add(clone);

            if (original.Limits != null)
            {
                _platformContext.SubscriptionPlanLimits.Add(new SubscriptionPlanLimits
                {
                    Id = Guid.NewGuid(),
                    PlanId = clone.Id,
                    ProductionLines = original.Limits.ProductionLines,
                    Machines = original.Limits.Machines,
                    Employees = original.Limits.Employees,
                    Customers = original.Limits.Customers,
                    Suppliers = original.Limits.Suppliers,
                    Warehouses = original.Limits.Warehouses,
                    ProductionBatches = original.Limits.ProductionBatches,
                    Products = original.Limits.Products,
                    RawMaterials = original.Limits.RawMaterials,
                    StorageGB = original.Limits.StorageGB,
                    APIRequestsPerMin = original.Limits.APIRequestsPerMin,
                    FileUploadSizeMB = original.Limits.FileUploadSizeMB,
                    DailyExports = original.Limits.DailyExports,
                    ConcurrentUsers = original.Limits.ConcurrentUsers,
                    SMSLimit = original.Limits.SMSLimit,
                    EmailLimit = original.Limits.EmailLimit,
                    CreatedAt = DateTime.UtcNow
                });
            }

            foreach (var f in original.Features)
            {
                _platformContext.SubscriptionFeatures.Add(new SubscriptionFeature
                {
                    Id = Guid.NewGuid(),
                    PlanId = clone.Id,
                    FeatureName = f.FeatureName,
                    FeatureDescription = f.FeatureDescription,
                    FeatureCategory = f.FeatureCategory,
                    FeatureValue = f.FeatureValue,
                    FeatureUnit = f.FeatureUnit,
                    DisplayOrder = f.DisplayOrder,
                    IsHighlighted = f.IsHighlighted,
                    IsUnlimited = f.IsUnlimited,
                    CreatedAt = DateTime.UtcNow
                });
            }

            _platformContext.SubscriptionAuditLogs.Add(new SubscriptionAuditLog
            {
                Id = Guid.NewGuid(),
                PlanId = clone.Id,
                Action = "DUPLICATE_PLAN",
                PerformerUserId = performerUserId,
                PerformerUserEmail = performerUserId.Contains("@") ? performerUserId : "system@aquora.local",
                Reason = $"Duplicated plan '{original.Name}' to '{clone.Name}'.",
                Timestamp = DateTime.UtcNow,
                IpAddress = performerIp
            });

            await _platformContext.SaveChangesAsync();
            return clone.Id;
        }

        public async Task<bool> SetPlanStatusAsync(Guid planId, string status, string performerUserId, string performerIp)
        {
            var plan = await _platformContext.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == planId && !p.IsDeleted);
            if (plan == null) throw new KeyNotFoundException("Subscription Plan not found.");

            var oldStatus = plan.Status;
            plan.Status = status.Trim();
            plan.UpdatedAt = DateTime.UtcNow;
            plan.UpdatedBy = performerUserId;

            _platformContext.SubscriptionAuditLogs.Add(new SubscriptionAuditLog
            {
                Id = Guid.NewGuid(),
                PlanId = plan.Id,
                Action = $"{status.ToUpperInvariant()}_PLAN",
                PerformerUserId = performerUserId,
                PerformerUserEmail = performerUserId.Contains("@") ? performerUserId : "system@aquora.local",
                Reason = $"Changed status of plan '{plan.Name}' from '{oldStatus}' to '{plan.Status}'.",
                Timestamp = DateTime.UtcNow,
                IpAddress = performerIp
            });

            await _platformContext.SaveChangesAsync();
            return true;
        }

        public async Task<SubscriptionFeatureDto> AddFeatureAsync(Guid planId, CreateSubscriptionFeatureRequest request, string performerUserId, string performerIp)
        {
            var plan = await _platformContext.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == planId && !p.IsDeleted);
            if (plan == null) throw new KeyNotFoundException("Subscription Plan not found.");

            var feature = new SubscriptionFeature
            {
                Id = Guid.NewGuid(),
                PlanId = planId,
                FeatureName = request.FeatureName.Trim(),
                FeatureDescription = request.FeatureDescription,
                FeatureCategory = string.IsNullOrWhiteSpace(request.FeatureCategory) ? "Core Modules" : request.FeatureCategory.Trim(),
                FeatureValue = string.IsNullOrWhiteSpace(request.FeatureValue) ? "Yes" : request.FeatureValue.Trim(),
                FeatureUnit = request.FeatureUnit,
                DisplayOrder = request.DisplayOrder,
                IsHighlighted = request.IsHighlighted,
                IsUnlimited = request.IsUnlimited,
                CreatedAt = DateTime.UtcNow
            };

            _platformContext.SubscriptionFeatures.Add(feature);
            await _platformContext.SaveChangesAsync();

            return new SubscriptionFeatureDto
            {
                Id = feature.Id,
                PlanId = feature.PlanId,
                FeatureName = feature.FeatureName,
                FeatureDescription = feature.FeatureDescription,
                FeatureCategory = feature.FeatureCategory,
                FeatureValue = feature.FeatureValue,
                FeatureUnit = feature.FeatureUnit,
                DisplayOrder = feature.DisplayOrder,
                IsHighlighted = feature.IsHighlighted,
                IsUnlimited = feature.IsUnlimited
            };
        }

        public async Task<bool> UpdateFeatureAsync(Guid planId, Guid featureId, CreateSubscriptionFeatureRequest request, string performerUserId, string performerIp)
        {
            var f = await _platformContext.SubscriptionFeatures.FirstOrDefaultAsync(x => x.Id == featureId && x.PlanId == planId);
            if (f == null) throw new KeyNotFoundException("Feature not found for this plan.");

            f.FeatureName = request.FeatureName.Trim();
            f.FeatureDescription = request.FeatureDescription;
            f.FeatureCategory = request.FeatureCategory;
            f.FeatureValue = request.FeatureValue;
            f.FeatureUnit = request.FeatureUnit;
            f.DisplayOrder = request.DisplayOrder;
            f.IsHighlighted = request.IsHighlighted;
            f.IsUnlimited = request.IsUnlimited;

            await _platformContext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteFeatureAsync(Guid planId, Guid featureId, string performerUserId, string performerIp)
        {
            var f = await _platformContext.SubscriptionFeatures.FirstOrDefaultAsync(x => x.Id == featureId && x.PlanId == planId);
            if (f == null) throw new KeyNotFoundException("Feature not found.");

            _platformContext.SubscriptionFeatures.Remove(f);
            await _platformContext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UpdateLimitsAsync(Guid planId, SubscriptionPlanLimitsDto limitsDto, string performerUserId, string performerIp)
        {
            var limits = await _platformContext.SubscriptionPlanLimits.FirstOrDefaultAsync(l => l.PlanId == planId);
            if (limits == null)
            {
                limits = new SubscriptionPlanLimits { Id = Guid.NewGuid(), PlanId = planId };
                _platformContext.SubscriptionPlanLimits.Add(limits);
            }

            limits.ProductionLines = limitsDto.ProductionLines;
            limits.Machines = limitsDto.Machines;
            limits.Employees = limitsDto.Employees;
            limits.Customers = limitsDto.Customers;
            limits.Suppliers = limitsDto.Suppliers;
            limits.Warehouses = limitsDto.Warehouses;
            limits.ProductionBatches = limitsDto.ProductionBatches;
            limits.Products = limitsDto.Products;
            limits.RawMaterials = limitsDto.RawMaterials;
            limits.StorageGB = limitsDto.StorageGB;
            limits.APIRequestsPerMin = limitsDto.APIRequestsPerMin;
            limits.FileUploadSizeMB = limitsDto.FileUploadSizeMB;
            limits.DailyExports = limitsDto.DailyExports;
            limits.ConcurrentUsers = limitsDto.ConcurrentUsers;
            limits.SMSLimit = limitsDto.SMSLimit;
            limits.EmailLimit = limitsDto.EmailLimit;
            limits.UpdatedAt = DateTime.UtcNow;

            await _platformContext.SaveChangesAsync();
            return true;
        }

        public async Task<TenantSubscriptionDto> AssignSubscriptionAsync(AssignTenantSubscriptionRequest request, string performerUserId, string performerIp)
        {
            var tenant = await _platformContext.Tenants.FirstOrDefaultAsync(t => t.Id == request.TenantId && !t.IsDeleted);
            if (tenant == null) throw new KeyNotFoundException("Tenant not found.");

            var plan = await _platformContext.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == request.PlanId && !p.IsDeleted);
            if (plan == null) throw new KeyNotFoundException("Subscription Plan not found.");

            int duration = request.DurationDays ?? plan.DurationDays;
            if (duration <= 0) duration = 30;

            decimal price = request.CustomPrice ?? (request.BillingCycle.Equals("Yearly", StringComparison.OrdinalIgnoreCase) ? plan.YearlyPrice : plan.MonthlyPrice);

            var oldSub = await _platformContext.TenantSubscriptions
                .Where(s => s.TenantId == request.TenantId && s.Status == "Active")
                .FirstOrDefaultAsync();

            if (oldSub != null)
            {
                oldSub.Status = oldSub.PlanId == plan.Id ? "Renewed" : (price > oldSub.PricePaid ? "Upgraded" : "Downgraded");
                oldSub.UpdatedAt = DateTime.UtcNow;
            }

            var newSub = new TenantSubscription
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PlanId = plan.Id,
                PlanName = plan.Name,
                Status = request.StartTrial ? "Trial" : "Active",
                BillingCycle = request.BillingCycle,
                PricePaid = price,
                Currency = plan.Currency,
                StartDate = DateTime.UtcNow,
                EndDate = DateTime.UtcNow.AddDays(duration),
                TrialEndDate = request.StartTrial ? DateTime.UtcNow.AddDays(plan.TrialDays) : null,
                AutoRenew = request.AutoRenew,
                AssignedByUserId = performerUserId,
                CreatedAt = DateTime.UtcNow
            };

            _platformContext.TenantSubscriptions.Add(newSub);

            // Update Tenant entity
            tenant.SubscriptionPlan = plan.Name;

            _platformContext.SubscriptionAuditLogs.Add(new SubscriptionAuditLog
            {
                Id = Guid.NewGuid(),
                PlanId = plan.Id,
                TenantId = tenant.Id,
                Action = "ASSIGN_TENANT",
                PerformerUserId = performerUserId,
                PerformerUserEmail = performerUserId.Contains("@") ? performerUserId : "system@aquora.local",
                Reason = $"Assigned plan '{plan.Name}' to company '{tenant.Name}'. Price: ${price}, Duration: {duration} days.",
                Timestamp = DateTime.UtcNow,
                IpAddress = performerIp
            });

            await _platformContext.SaveChangesAsync();

            return new TenantSubscriptionDto
            {
                Id = newSub.Id,
                TenantId = newSub.TenantId,
                TenantName = tenant.Name,
                PlanId = newSub.PlanId,
                PlanName = newSub.PlanName,
                Status = newSub.Status,
                BillingCycle = newSub.BillingCycle,
                PricePaid = newSub.PricePaid,
                Currency = newSub.Currency,
                StartDate = newSub.StartDate,
                EndDate = newSub.EndDate,
                TrialEndDate = newSub.TrialEndDate,
                AutoRenew = newSub.AutoRenew,
                AssignedByUserId = newSub.AssignedByUserId,
                CreatedAt = newSub.CreatedAt
            };
        }

        public async Task<List<TenantSubscriptionDto>> GetTenantSubscriptionHistoryAsync(Guid tenantId)
        {
            var tenant = await _platformContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId);
            var tenantName = tenant?.Name ?? "Company";

            var subs = await _platformContext.TenantSubscriptions
                .AsNoTracking()
                .Where(s => s.TenantId == tenantId)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            return subs.Select(s => new TenantSubscriptionDto
            {
                Id = s.Id,
                TenantId = s.TenantId,
                TenantName = tenantName,
                PlanId = s.PlanId,
                PlanName = s.PlanName,
                Status = s.Status,
                BillingCycle = s.BillingCycle,
                PricePaid = s.PricePaid,
                Currency = s.Currency,
                StartDate = s.StartDate,
                EndDate = s.EndDate,
                TrialEndDate = s.TrialEndDate,
                AutoRenew = s.AutoRenew,
                AssignedByUserId = s.AssignedByUserId,
                CreatedAt = s.CreatedAt
            }).ToList();
        }

        public async Task<SubscriptionKpiDto> GetSubscriptionKpisAsync()
        {
            var totalPlans = await _platformContext.SubscriptionPlans.CountAsync(p => !p.IsDeleted);
            var publishedPlans = await _platformContext.SubscriptionPlans.CountAsync(p => !p.IsDeleted && p.Status == "Published");

            var activeSubs = await _platformContext.TenantSubscriptions.CountAsync(s => s.Status == "Active");
            var now = DateTime.UtcNow;
            var expiringSoon = await _platformContext.TenantSubscriptions.CountAsync(s => s.Status == "Active" && s.EndDate <= now.AddDays(7) && s.EndDate >= now);
            var trialPlans = await _platformContext.TenantSubscriptions.CountAsync(s => s.Status == "Trial");

            var totalRevenue = await _platformContext.TenantSubscriptions
                .Where(s => s.Status == "Active" || s.Status == "Renewed" || s.Status == "Upgraded")
                .SumAsync(s => s.PricePaid);

            return new SubscriptionKpiDto
            {
                TotalPlans = totalPlans,
                PublishedPlans = publishedPlans,
                ActiveSubscriptions = activeSubs,
                ExpiringSoonSubscriptions = expiringSoon,
                TrialPlans = trialPlans,
                TotalRevenue = totalRevenue
            };
        }

        public async Task<List<SubscriptionAuditLogDto>> GetAuditLogsAsync(Guid? planId = null, Guid? tenantId = null)
        {
            var query = _platformContext.SubscriptionAuditLogs.AsNoTracking().AsQueryable();
            if (planId.HasValue) query = query.Where(l => l.PlanId == planId.Value);
            if (tenantId.HasValue) query = query.Where(l => l.TenantId == tenantId.Value);

            var logs = await query.OrderByDescending(l => l.Timestamp).Take(50).ToListAsync();

            return logs.Select(l => new SubscriptionAuditLogDto
            {
                Id = l.Id,
                PlanId = l.PlanId,
                TenantId = l.TenantId,
                Action = l.Action,
                PerformerUserId = l.PerformerUserId,
                PerformerUserEmail = l.PerformerUserEmail,
                OldValuesJson = l.OldValuesJson,
                NewValuesJson = l.NewValuesJson,
                Reason = l.Reason,
                Timestamp = l.Timestamp,
                IpAddress = l.IpAddress
            }).ToList();
        }

        public async Task EnsureINRPlansAsync()
        {
            var plansToUpdate = await _platformContext.SubscriptionPlans
                .Where(p => !p.IsDeleted && (p.Currency == "USD" || p.MonthlyPrice == 199.00m || p.MonthlyPrice == 499.00m || p.MonthlyPrice == 999.00m || p.MonthlyPrice == 2499.00m))
                .ToListAsync();

            if (!plansToUpdate.Any()) return;

            foreach (var plan in plansToUpdate)
            {
                plan.Currency = "INR";
                if (string.Equals(plan.Name, "Starter", StringComparison.OrdinalIgnoreCase))
                {
                    plan.MonthlyPrice = 999.00m;
                    plan.YearlyPrice = 9990.00m;
                    plan.Description = "Ideal for small manufacturing businesses starting with Aquzio.";
                }
                else if (string.Equals(plan.Name, "Professional", StringComparison.OrdinalIgnoreCase))
                {
                    plan.MonthlyPrice = 2499.00m;
                    plan.YearlyPrice = 24990.00m;
                    plan.Description = "Perfect for growing manufacturers with multiple production lines and advanced reporting.";
                }
                else if (string.Equals(plan.Name, "Business", StringComparison.OrdinalIgnoreCase))
                {
                    plan.MonthlyPrice = 5999.00m;
                    plan.YearlyPrice = 59990.00m;
                    plan.Description = "Designed for large manufacturing companies requiring advanced ERP capabilities.";
                }
                else if (string.Equals(plan.Name, "Enterprise", StringComparison.OrdinalIgnoreCase))
                {
                    plan.MonthlyPrice = 0.00m;
                    plan.YearlyPrice = 0.00m;
                    plan.Description = "Tailored enterprise deployment with unlimited scalability and dedicated support.";
                }
            }

            await _platformContext.SaveChangesAsync();
        }

        public async Task SeedDefaultPlansAsync()
        {
            if (await _platformContext.SubscriptionPlans.AnyAsync(p => !p.IsDeleted))
                return;

            var starterId = Guid.NewGuid();
            var proId = Guid.NewGuid();
            var busId = Guid.NewGuid();
            var entId = Guid.NewGuid();

            var plans = new List<SubscriptionPlan>
            {
                new SubscriptionPlan
                {
                    Id = starterId,
                    Name = "Starter",
                    Code = "STARTER",
                    Description = "Ideal for small manufacturing businesses starting with Aquzio.",
                    MonthlyPrice = 999.00m,
                    YearlyPrice = 9990.00m,
                    OfferPrice = 799.00m,
                    DiscountPercent = 20,
                    Currency = "INR",
                    BillingCycle = "Monthly",
                    TrialDays = 14,
                    DurationDays = 30,
                    DisplayOrder = 1,
                    IsPopular = false,
                    IsRecommended = false,
                    Color = "#64748B",
                    Status = "Published",
                    TaxType = "Tax Exclusive",
                    AutoActivateTrial = true,
                    CreatedAt = DateTime.UtcNow
                },
                new SubscriptionPlan
                {
                    Id = proId,
                    Name = "Professional",
                    Code = "PRO",
                    Description = "Perfect for growing manufacturers with multiple production lines and advanced reporting.",
                    MonthlyPrice = 2499.00m,
                    YearlyPrice = 24990.00m,
                    OfferPrice = 1999.00m,
                    DiscountPercent = 20,
                    Currency = "INR",
                    BillingCycle = "Monthly",
                    TrialDays = 14,
                    DurationDays = 30,
                    DisplayOrder = 2,
                    IsPopular = true,
                    IsRecommended = true,
                    Color = "#2563EB",
                    Status = "Published",
                    TaxType = "Tax Exclusive",
                    AutoActivateTrial = true,
                    CreatedAt = DateTime.UtcNow
                },
                new SubscriptionPlan
                {
                    Id = busId,
                    Name = "Business",
                    Code = "BUSINESS",
                    Description = "Designed for large manufacturing companies requiring advanced ERP capabilities.",
                    MonthlyPrice = 5999.00m,
                    YearlyPrice = 59990.00m,
                    OfferPrice = 4999.00m,
                    DiscountPercent = 15,
                    Currency = "INR",
                    BillingCycle = "Monthly",
                    TrialDays = 14,
                    DurationDays = 30,
                    DisplayOrder = 3,
                    IsPopular = false,
                    IsRecommended = false,
                    Color = "#7C3AED",
                    Status = "Published",
                    TaxType = "Tax Exclusive",
                    AutoActivateTrial = true,
                    CreatedAt = DateTime.UtcNow
                },
                new SubscriptionPlan
                {
                    Id = entId,
                    Name = "Enterprise",
                    Code = "ENTERPRISE",
                    Description = "Tailored enterprise deployment with unlimited scalability and dedicated support.",
                    MonthlyPrice = 0.00m,
                    YearlyPrice = 0.00m,
                    OfferPrice = null,
                    DiscountPercent = null,
                    Currency = "INR",
                    BillingCycle = "Yearly",
                    TrialDays = 30,
                    DurationDays = 365,
                    DisplayOrder = 4,
                    IsPopular = false,
                    IsRecommended = false,
                    Color = "#059669",
                    Status = "Published",
                    TaxType = "Tax Exclusive",
                    AutoActivateTrial = true,
                    CreatedAt = DateTime.UtcNow
                }
            };

            _platformContext.SubscriptionPlans.AddRange(plans);

            // Default Limits
            _platformContext.SubscriptionPlanLimits.AddRange(new[]
            {
                new SubscriptionPlanLimits { Id = Guid.NewGuid(), PlanId = starterId, ProductionLines = 3, Machines = 10, Employees = 25, StorageGB = 50 },
                new SubscriptionPlanLimits { Id = Guid.NewGuid(), PlanId = proId, ProductionLines = 10, Machines = 50, Employees = 100, StorageGB = 250 },
                new SubscriptionPlanLimits { Id = Guid.NewGuid(), PlanId = busId, ProductionLines = 25, Machines = 150, Employees = 300, StorageGB = 1000 },
                new SubscriptionPlanLimits { Id = Guid.NewGuid(), PlanId = entId, ProductionLines = -1, Machines = -1, Employees = -1, StorageGB = -1 }
            });

            // Default Features
            var features = new List<SubscriptionFeature>
            {
                // Starter
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = starterId, FeatureName = "Production Lines", FeatureCategory = "Core Modules", FeatureValue = "3 Lines", DisplayOrder = 1 },
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = starterId, FeatureName = "Active Machines", FeatureCategory = "Core Modules", FeatureValue = "10 Machines", DisplayOrder = 2 },
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = starterId, FeatureName = "Basic Telemetry & Reports", FeatureCategory = "Analytics & Reports", FeatureValue = "Included", DisplayOrder = 3 },
                
                // Pro
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = proId, FeatureName = "Production Lines", FeatureCategory = "Core Modules", FeatureValue = "10 Lines", DisplayOrder = 1, IsHighlighted = true },
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = proId, FeatureName = "Active Machines", FeatureCategory = "Core Modules", FeatureValue = "50 Machines", DisplayOrder = 2, IsHighlighted = true },
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = proId, FeatureName = "Automated Checklists & Shift Logs", FeatureCategory = "Core Modules", FeatureValue = "Yes", DisplayOrder = 3 },
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = proId, FeatureName = "Custom Domain & Branding", FeatureCategory = "Integrations", FeatureValue = "Yes", DisplayOrder = 4 },

                // Business
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = busId, FeatureName = "Production Lines", FeatureCategory = "Core Modules", FeatureValue = "25 Lines", DisplayOrder = 1 },
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = busId, FeatureName = "Multi-Warehouse Inventory", FeatureCategory = "Core Modules", FeatureValue = "Yes", DisplayOrder = 2 },
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = busId, FeatureName = "Advanced ERP & Finance Sync", FeatureCategory = "Integrations", FeatureValue = "Full API Access", DisplayOrder = 3, IsHighlighted = true },

                // Enterprise
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = entId, FeatureName = "Unlimited Production Lines & Machines", FeatureCategory = "Core Modules", FeatureValue = "Unlimited", IsUnlimited = true, IsHighlighted = true, DisplayOrder = 1 },
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = entId, FeatureName = "Dedicated Database Cluster", FeatureCategory = "Security & Support", FeatureValue = "Isolated Schema", IsHighlighted = true, DisplayOrder = 2 },
                new SubscriptionFeature { Id = Guid.NewGuid(), PlanId = entId, FeatureName = "24/7 VIP SLA & Dedicated Account Manager", FeatureCategory = "Security & Support", FeatureValue = "Priority Support", DisplayOrder = 3 }
            };

            _platformContext.SubscriptionFeatures.AddRange(features);
            await _platformContext.SaveChangesAsync();
        }

        private static SubscriptionPlanDto MapToDto(SubscriptionPlan p, Dictionary<string, int> companyCounts)
        {
            var count = companyCounts.TryGetValue(p.Name, out var c) ? c : 0;

            var limits = p.Limits != null ? new SubscriptionPlanLimitsDto
            {
                Id = p.Limits.Id,
                PlanId = p.Limits.PlanId,
                ProductionLines = p.Limits.ProductionLines,
                Machines = p.Limits.Machines,
                Employees = p.Limits.Employees,
                Customers = p.Limits.Customers,
                Suppliers = p.Limits.Suppliers,
                Warehouses = p.Limits.Warehouses,
                ProductionBatches = p.Limits.ProductionBatches,
                Products = p.Limits.Products,
                RawMaterials = p.Limits.RawMaterials,
                StorageGB = p.Limits.StorageGB,
                APIRequestsPerMin = p.Limits.APIRequestsPerMin,
                FileUploadSizeMB = p.Limits.FileUploadSizeMB,
                DailyExports = p.Limits.DailyExports,
                ConcurrentUsers = p.Limits.ConcurrentUsers,
                SMSLimit = p.Limits.SMSLimit,
                EmailLimit = p.Limits.EmailLimit
            } : new SubscriptionPlanLimitsDto { PlanId = p.Id };

            var features = p.Features != null ? p.Features.OrderBy(f => f.DisplayOrder).Select(f => new SubscriptionFeatureDto
            {
                Id = f.Id,
                PlanId = f.PlanId,
                FeatureName = f.FeatureName,
                FeatureDescription = f.FeatureDescription,
                FeatureCategory = f.FeatureCategory,
                FeatureValue = f.FeatureValue,
                FeatureUnit = f.FeatureUnit,
                DisplayOrder = f.DisplayOrder,
                IsHighlighted = f.IsHighlighted,
                IsUnlimited = f.IsUnlimited
            }).ToList() : new List<SubscriptionFeatureDto>();

            return new SubscriptionPlanDto
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                Description = p.Description,
                MonthlyPrice = p.MonthlyPrice,
                YearlyPrice = p.YearlyPrice,
                OfferPrice = p.OfferPrice,
                DiscountPercent = p.DiscountPercent,
                Currency = p.Currency,
                BillingCycle = p.BillingCycle,
                TrialDays = p.TrialDays,
                DurationDays = p.DurationDays,
                DisplayOrder = p.DisplayOrder,
                IsPopular = p.IsPopular,
                IsRecommended = p.IsRecommended,
                Color = p.Color,
                Status = p.Status,
                TaxType = p.TaxType,
                AutoActivateTrial = p.AutoActivateTrial,
                CompaniesUsingCount = count,
                Features = features,
                Limits = limits,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt
            };
        }
    }
}
