using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Aquora.Application.DTOs.Search;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;

namespace Aquora.Application.Services
{
    public class GlobalSearchService : IGlobalSearchService
    {
        private readonly ITenantDbContext _tenantContext;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly ILogger<GlobalSearchService> _logger;

        public GlobalSearchService(
            ITenantDbContext tenantContext,
            ICurrentUserContext currentUserContext,
            ILogger<GlobalSearchService> logger)
        {
            _tenantContext = tenantContext;
            _currentUserContext = currentUserContext;
            _logger = logger;
        }

        public async Task<GlobalSearchResponseDto> SearchAsync(GlobalSearchRequestDto request, CancellationToken cancellationToken = default)
        {
            var sw = Stopwatch.StartNew();
            var rawQuery = (request.Query ?? string.Empty).Trim();
            var scope = (request.Scope ?? "all").ToLowerInvariant();
            var limit = Math.Clamp(request.LimitPerCategory, 1, 20);

            var response = new GlobalSearchResponseDto
            {
                Query = rawQuery,
                Groups = new List<GlobalSearchGroupDto>()
            };

            if (string.IsNullOrWhiteSpace(rawQuery))
            {
                // Return Navigation and Quick Actions when query is empty
                var emptyNavGroup = GetNavigationResults(string.Empty, limit);
                var emptyActionGroup = GetActionResults(string.Empty, limit);

                if (emptyNavGroup.Results.Count > 0) response.Groups.Add(emptyNavGroup);
                if (emptyActionGroup.Results.Count > 0) response.Groups.Add(emptyActionGroup);

                sw.Stop();
                response.TotalMatches = response.Groups.Sum(g => g.Results.Count);
                response.ExecutionTimeMs = sw.ElapsedMilliseconds;
                return response;
            }

            var cleanQuery = rawQuery.ToLowerInvariant();
            var normalizedDigits = Regex.Replace(rawQuery, @"[^\d]", "");
            var normalizedAlphaNum = Regex.Replace(rawQuery, @"[^a-zA-Z0-9]", "").ToLowerInvariant();

            var roles = _currentUserContext.Roles?.ToList() ?? new List<string>();
            var isDistributor = roles.Any(r => r.Equals("Distributor", StringComparison.OrdinalIgnoreCase));
            var isOperator = roles.Any(r => r.Equals("Operator", StringComparison.OrdinalIgnoreCase) || r.Equals("Worker", StringComparison.OrdinalIgnoreCase));
            var isFinanceAuthorized = !isOperator && !isDistributor; // Owners, Admins, Managers, Accountants

            // Check if user is restricted to a specific distributor
            Guid? effectiveDistributorId = request.DistributorId;

            var tasks = new List<Task<GlobalSearchGroupDto?>>();

            // 1. Navigation & Actions (Always available, filtered by role)
            if (scope == "all" || scope == "navigation")
            {
                tasks.Add(Task.FromResult<GlobalSearchGroupDto?>(GetNavigationResults(cleanQuery, limit)));
            }
            if (scope == "all" || scope == "actions")
            {
                tasks.Add(Task.FromResult<GlobalSearchGroupDto?>(GetActionResults(cleanQuery, limit)));
            }

            // 2. Distributors (Tier 1 Upstream)
            if (!isDistributor && (scope == "all" || scope == "distributors"))
            {
                tasks.Add(SearchDistributorsAsync(cleanQuery, normalizedDigits, limit, cancellationToken));
            }

            // 3. 20L Distributor Routes
            if (scope == "all" || scope == "routes" || scope == "20l")
            {
                tasks.Add(SearchDistributorRoutesAsync(cleanQuery, effectiveDistributorId, limit, cancellationToken));
            }

            // 4. 20L Distributor Vehicles
            if (scope == "all" || scope == "vehicles" || scope == "20l")
            {
                tasks.Add(SearchDistributorVehiclesAsync(cleanQuery, normalizedAlphaNum, effectiveDistributorId, limit, cancellationToken));
            }

            // 5. 20L Drivers & Team Members
            if (scope == "all" || scope == "people" || scope == "drivers" || scope == "20l")
            {
                tasks.Add(SearchPeopleAndDriversAsync(cleanQuery, normalizedDigits, effectiveDistributorId, limit, cancellationToken));
            }

            // 6. Customers (Direct & Distributor Customers)
            if (scope == "all" || scope == "customers")
            {
                tasks.Add(SearchCustomersAsync(cleanQuery, normalizedDigits, effectiveDistributorId, isDistributor, limit, cancellationToken));
            }

            // 7. 20L Operations (Supplies, Deliveries, Trips)
            if (scope == "all" || scope == "20l" || scope == "operations")
            {
                tasks.Add(SearchTwentyLOperationsAsync(cleanQuery, normalizedAlphaNum, effectiveDistributorId, isDistributor, limit, cancellationToken));
            }

            // 8. Products & Inventory
            if (!isDistributor && (scope == "all" || scope == "inventory" || scope == "products"))
            {
                tasks.Add(SearchProductsAndInventoryAsync(cleanQuery, limit, cancellationToken));
            }

            // 9. Production Batches
            if (!isDistributor && (scope == "all" || scope == "production"))
            {
                tasks.Add(SearchProductionBatchesAsync(cleanQuery, limit, cancellationToken));
            }

            // 10. Finance & Transactions (Protected)
            if (isFinanceAuthorized && (scope == "all" || scope == "finance"))
            {
                tasks.Add(SearchFinanceAsync(cleanQuery, normalizedDigits, limit, cancellationToken));
            }

            // 11. QC & Water Test Reports
            if (!isDistributor && (scope == "all" || scope == "qc"))
            {
                tasks.Add(SearchQCReportsAsync(cleanQuery, limit, cancellationToken));
            }

            var groupResults = await Task.WhenAll(tasks);

            foreach (var group in groupResults)
            {
                if (group != null && group.Results.Count > 0)
                {
                    // Sort results within group by relevance score descending
                    group.Results = group.Results.OrderByDescending(r => r.Score).ToList();
                    response.Groups.Add(group);
                }
            }

            sw.Stop();
            response.TotalMatches = response.Groups.Sum(g => g.Results.Count);
            response.ExecutionTimeMs = sw.ElapsedMilliseconds;

            return response;
        }

        #region Search Resolvers

        private async Task<GlobalSearchGroupDto?> SearchDistributorsAsync(string query, string digits, int limit, CancellationToken ct)
        {
            try
            {
                var queryable = _tenantContext.TwentyLDistributorProfiles
                    .AsNoTracking()
                    .Include(d => d.Customer)
                    .Where(d => d.IsActive && !d.IsDeleted);

                var matches = await queryable
                    .Where(d => EF.Functions.Like(d.Customer.CustomerName.ToLower(), $"%{query}%") ||
                                EF.Functions.Like(d.Customer.CustomerCode.ToLower(), $"%{query}%") ||
                                (!string.IsNullOrEmpty(d.Customer.BusinessName) && EF.Functions.Like(d.Customer.BusinessName.ToLower(), $"%{query}%")) ||
                                (!string.IsNullOrEmpty(digits) && EF.Functions.Like(d.Customer.Phone.ToLower(), $"%{digits}%")))
                    .Take(limit * 2)
                    .Select(d => new
                    {
                        d.Id,
                        d.CustomerId,
                        CustomerName = d.Customer.CustomerName,
                        BusinessName = d.Customer.BusinessName ?? d.Customer.CustomerName,
                        DistributorCode = d.Customer.CustomerCode,
                        Phone = d.Customer.Phone,
                        City = d.Customer.City,
                        State = d.Customer.State,
                        Balance = d.Customer.OpeningBalance,
                        d.IsActive
                    })
                    .ToListAsync(ct);

                if (!matches.Any()) return null;

                var results = matches.Select(d =>
                {
                    int score = 50;
                    if (d.DistributorCode.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 100;
                    else if (d.BusinessName.Equals(query, StringComparison.OrdinalIgnoreCase) || d.CustomerName.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 95;
                    else if (d.BusinessName.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 80;

                    return new GlobalSearchResultDto
                    {
                        Id = d.Id.ToString(),
                        Title = d.BusinessName,
                        Subtitle = $"{d.DistributorCode} • Contact: {d.CustomerName} • {d.Phone}",
                        Category = "Distributors",
                        Type = "distributor",
                        RouteUrl = $"/company/operations?tab=distributors&distributorId={d.Id}",
                        Status = d.IsActive ? "Active" : "Inactive",
                        Icon = "Building2",
                        Score = score,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["Code"] = d.DistributorCode,
                            ["Phone"] = d.Phone,
                            ["Location"] = $"{d.City}, {d.State}"
                        },
                        Actions = new List<GlobalSearchActionDto>
                        {
                            new() { Label = "View Portal", RouteUrl = $"/company/operations?tab=distributors&distributorId={d.Id}", Icon = "ExternalLink" },
                            new() { Label = "New Supply", RouteUrl = $"/company/operations?tab=distributor-supplies&createFor={d.Id}", Icon = "Plus" }
                        }
                    };
                }).Take(limit).ToList();

                return new GlobalSearchGroupDto
                {
                    Type = "distributors",
                    Label = "Distributors",
                    Icon = "Building2",
                    TotalCount = results.Count,
                    Results = results
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error searching distributors for query: {Query}", query);
                return null;
            }
        }

        private async Task<GlobalSearchGroupDto?> SearchDistributorRoutesAsync(string query, Guid? distributorId, int limit, CancellationToken ct)
        {
            try
            {
                var queryable = _tenantContext.TwentyLDistributorRoutes
                    .AsNoTracking()
                    .Where(r => r.IsActive && !r.IsDeleted);

                if (distributorId.HasValue)
                {
                    queryable = queryable.Where(r => r.DistributorId == distributorId.Value);
                }

                var matches = await queryable
                    .Where(r => EF.Functions.Like(r.RouteName.ToLower(), $"%{query}%") ||
                                EF.Functions.Like(r.RouteCode.ToLower(), $"%{query}%") ||
                                (r.AreaDescription != null && EF.Functions.Like(r.AreaDescription.ToLower(), $"%{query}%")) ||
                                (r.DefaultDriverName != null && EF.Functions.Like(r.DefaultDriverName.ToLower(), $"%{query}%")))
                    .Take(limit * 2)
                    .Select(r => new
                    {
                        r.Id,
                        r.DistributorId,
                        r.RouteCode,
                        r.RouteName,
                        r.AreaDescription,
                        r.DefaultDriverName,
                        r.DefaultVehicleNumber,
                        r.ScheduleDays
                    })
                    .ToListAsync(ct);

                if (!matches.Any()) return null;

                var results = matches.Select(r =>
                {
                    int score = 40;
                    if (r.RouteCode.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 100;
                    else if (r.RouteName.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 90;
                    else if (r.RouteName.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 75;

                    return new GlobalSearchResultDto
                    {
                        Id = r.Id.ToString(),
                        Title = $"{r.RouteCode} — {r.RouteName}",
                        Subtitle = $"Area: {r.AreaDescription ?? "General"} • Driver: {r.DefaultDriverName ?? "Unassigned"} ({r.DefaultVehicleNumber ?? "No Vehicle"})",
                        Category = "Routes",
                        Type = "route",
                        RouteUrl = $"/company/operations?tab=distributors&distributorId={r.DistributorId}&subtab=routes",
                        Status = "Active",
                        Icon = "MapPin",
                        Score = score,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["Driver"] = r.DefaultDriverName,
                            ["Vehicle"] = r.DefaultVehicleNumber,
                            ["Schedule"] = r.ScheduleDays
                        },
                        Actions = new List<GlobalSearchActionDto>
                        {
                            new() { Label = "View Route", RouteUrl = $"/company/operations?tab=distributors&distributorId={r.DistributorId}&subtab=routes", Icon = "Map" }
                        }
                    };
                }).Take(limit).ToList();

                return new GlobalSearchGroupDto
                {
                    Type = "routes",
                    Label = "Routes",
                    Icon = "MapPin",
                    TotalCount = results.Count,
                    Results = results
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error searching routes for query: {Query}", query);
                return null;
            }
        }

        private async Task<GlobalSearchGroupDto?> SearchDistributorVehiclesAsync(string query, string alphaNum, Guid? distributorId, int limit, CancellationToken ct)
        {
            try
            {
                var queryable = _tenantContext.TwentyLDistributorVehicles
                    .AsNoTracking()
                    .Where(v => v.IsActive && !v.IsDeleted);

                if (distributorId.HasValue)
                {
                    queryable = queryable.Where(v => v.DistributorId == distributorId.Value);
                }

                var wildcardPattern = !string.IsNullOrEmpty(alphaNum) && alphaNum.Length >= 3 ? string.Join("%", alphaNum.ToCharArray()) : query;

                var matches = await queryable
                    .Where(v => EF.Functions.Like(v.RegistrationNumber.ToLower(), $"%{query}%") ||
                                (!string.IsNullOrEmpty(wildcardPattern) && EF.Functions.Like(v.RegistrationNumber.ToLower(), $"%{wildcardPattern}%")) ||
                                (v.AssignedDriverName != null && EF.Functions.Like(v.AssignedDriverName.ToLower(), $"%{query}%")) ||
                                EF.Functions.Like(v.VehicleType.ToLower(), $"%{query}%"))
                    .Take(limit * 2)
                    .Select(v => new
                    {
                        v.Id,
                        v.DistributorId,
                        v.RegistrationNumber,
                        v.VehicleType,
                        v.CapacityJars,
                        v.AssignedDriverName,
                        v.IsActive
                    })
                    .ToListAsync(ct);

                if (!matches.Any()) return null;

                var results = matches.Select(v =>
                {
                    int score = 45;
                    var cleanReg = Regex.Replace(v.RegistrationNumber, @"[^a-zA-Z0-9]", "");
                    if (cleanReg.Equals(alphaNum, StringComparison.OrdinalIgnoreCase)) score = 100;
                    else if (v.RegistrationNumber.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 95;
                    else if (v.RegistrationNumber.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 80;

                    return new GlobalSearchResultDto
                    {
                        Id = v.Id.ToString(),
                        Title = v.RegistrationNumber,
                        Subtitle = $"{v.VehicleType} • Capacity: {v.CapacityJars} jars • Driver: {v.AssignedDriverName ?? "Unassigned"}",
                        Category = "Vehicles",
                        Type = "vehicle",
                        RouteUrl = $"/company/operations?tab=distributors&distributorId={v.DistributorId}&subtab=vehicles",
                        Status = v.IsActive ? "Active" : "Inactive",
                        Icon = "Truck",
                        Score = score,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["Type"] = v.VehicleType,
                            ["Capacity"] = $"{v.CapacityJars} jars",
                            ["Driver"] = v.AssignedDriverName
                        },
                        Actions = new List<GlobalSearchActionDto>
                        {
                            new() { Label = "View Vehicle", RouteUrl = $"/company/operations?tab=distributors&distributorId={v.DistributorId}&subtab=vehicles", Icon = "Truck" }
                        }
                    };
                }).Take(limit).ToList();

                return new GlobalSearchGroupDto
                {
                    Type = "vehicles",
                    Label = "Vehicles",
                    Icon = "Truck",
                    TotalCount = results.Count,
                    Results = results
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error searching vehicles for query: {Query}", query);
                return null;
            }
        }

        private async Task<GlobalSearchGroupDto?> SearchPeopleAndDriversAsync(string query, string digits, Guid? distributorId, int limit, CancellationToken ct)
        {
            try
            {
                var results = new List<GlobalSearchResultDto>();

                // 1. Distributor Drivers
                var driversQueryable = _tenantContext.TwentyLDistributorDrivers
                    .AsNoTracking()
                    .Where(d => d.IsActive && !d.IsDeleted);

                if (distributorId.HasValue)
                {
                    driversQueryable = driversQueryable.Where(d => d.DistributorId == distributorId.Value);
                }

                var driverMatches = await driversQueryable
                    .Where(d => EF.Functions.Like(d.DriverName.ToLower(), $"%{query}%") ||
                                (!string.IsNullOrEmpty(digits) && EF.Functions.Like(d.Phone.ToLower(), $"%{digits}%")) ||
                                (d.LicenseNumber != null && EF.Functions.Like(d.LicenseNumber.ToLower(), $"%{query}%")) ||
                                (d.AssignedVehicleNumber != null && EF.Functions.Like(d.AssignedVehicleNumber.ToLower(), $"%{query}%")))
                    .Take(limit)
                    .Select(d => new
                    {
                        d.Id,
                        d.DistributorId,
                        d.DriverName,
                        d.Phone,
                        d.LicenseNumber,
                        d.AssignedVehicleNumber
                    })
                    .ToListAsync(ct);

                foreach (var d in driverMatches)
                {
                    int score = 50;
                    if (d.DriverName.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 95;
                    else if (d.DriverName.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 80;

                    results.Add(new GlobalSearchResultDto
                    {
                        Id = d.Id.ToString(),
                        Title = d.DriverName,
                        Subtitle = $"Driver • Phone: {d.Phone} • Vehicle: {d.AssignedVehicleNumber ?? "None"}",
                        Category = "People",
                        Type = "driver",
                        RouteUrl = $"/company/operations?tab=distributors&distributorId={d.DistributorId}&subtab=drivers",
                        Status = "Active",
                        Icon = "UserCheck",
                        Score = score,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["Role"] = "Distributor Driver",
                            ["Phone"] = d.Phone,
                            ["Vehicle"] = d.AssignedVehicleNumber,
                            ["License"] = d.LicenseNumber
                        },
                        Actions = new List<GlobalSearchActionDto>
                        {
                            new() { Label = "View Driver", RouteUrl = $"/company/operations?tab=distributors&distributorId={d.DistributorId}&subtab=drivers", Icon = "User" }
                        }
                    });
                }

                // 2. Company Employees / Users (if authorized)
                if (!distributorId.HasValue)
                {
                    var userMatches = await _tenantContext.Users
                        .AsNoTracking()
                        .Where(u => u.IsActive && (
                            EF.Functions.Like(u.FirstName.ToLower(), $"%{query}%") ||
                            EF.Functions.Like(u.LastName.ToLower(), $"%{query}%") ||
                            EF.Functions.Like(u.Email.ToLower(), $"%{query}%") ||
                            (!string.IsNullOrEmpty(digits) && u.Phone != null && EF.Functions.Like(u.Phone.ToLower(), $"%{digits}%")) ||
                            (u.RoleName != null && EF.Functions.Like(u.RoleName.ToLower(), $"%{query}%"))))
                        .Take(limit)
                        .Select(u => new
                        {
                            u.Id,
                            u.FirstName,
                            u.LastName,
                            u.Email,
                            u.Phone,
                            u.RoleName,
                            u.Designation
                        })
                        .ToListAsync(ct);

                    foreach (var u in userMatches)
                    {
                        var fullName = $"{u.FirstName} {u.LastName}".Trim();
                        int score = 45;
                        if (fullName.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 95;
                        else if (fullName.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 80;

                        results.Add(new GlobalSearchResultDto
                        {
                            Id = u.Id.ToString(),
                            Title = fullName,
                            Subtitle = $"{u.RoleName ?? u.Designation ?? "Employee"} • {u.Email}",
                            Category = "People",
                            Type = "employee",
                            RouteUrl = "/company/employees",
                            Status = "Active",
                            Icon = "User",
                            Score = score,
                            Metadata = new Dictionary<string, string?>
                            {
                                ["Role"] = u.RoleName,
                                ["Email"] = u.Email,
                                ["Phone"] = u.Phone
                            }
                        });
                    }
                }

                if (!results.Any()) return null;

                return new GlobalSearchGroupDto
                {
                    Type = "people",
                    Label = "People & Drivers",
                    Icon = "Users",
                    TotalCount = results.Count,
                    Results = results.Take(limit).ToList()
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error searching people for query: {Query}", query);
                return null;
            }
        }

        private async Task<GlobalSearchGroupDto?> SearchCustomersAsync(string query, string digits, Guid? distributorId, bool isDistributor, int limit, CancellationToken ct)
        {
            try
            {
                var results = new List<GlobalSearchResultDto>();

                // 1. Distributor Customers (Tier 2)
                var distCustQueryable = _tenantContext.TwentyLDistributorCustomers
                    .AsNoTracking()
                    .Where(c => c.IsActive && !c.IsDeleted);

                if (distributorId.HasValue)
                {
                    distCustQueryable = distCustQueryable.Where(c => c.DistributorId == distributorId.Value);
                }

                var distCustMatches = await distCustQueryable
                    .Where(c => EF.Functions.Like(c.CustomerName.ToLower(), $"%{query}%") ||
                                (!string.IsNullOrEmpty(digits) && EF.Functions.Like(c.Phone.ToLower(), $"%{digits}%")) ||
                                (c.Area != null && EF.Functions.Like(c.Area.ToLower(), $"%{query}%")) ||
                                (c.Address != null && EF.Functions.Like(c.Address.ToLower(), $"%{query}%")))
                    .Take(limit)
                    .Select(c => new
                    {
                        c.Id,
                        c.DistributorId,
                        c.CustomerName,
                        c.Phone,
                        c.Area,
                        c.DefaultRate,
                        c.FilledJarsHeld,
                        c.EmptyJarsHeld,
                        c.OutstandingBalance
                    })
                    .ToListAsync(ct);

                foreach (var c in distCustMatches)
                {
                    int score = 50;
                    if (c.CustomerName.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 95;
                    else if (c.CustomerName.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 80;

                    results.Add(new GlobalSearchResultDto
                    {
                        Id = c.Id.ToString(),
                        Title = c.CustomerName,
                        Subtitle = $"Distributor Customer • Phone: {c.Phone} • {c.Area ?? "General Area"}",
                        Category = "Customers",
                        Type = "distributor_customer",
                        RouteUrl = $"/company/operations?tab=distributors&distributorId={c.DistributorId}&subtab=customers",
                        Status = "Active",
                        Icon = "User",
                        Score = score,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["Phone"] = c.Phone,
                            ["Rate"] = $"₹{c.DefaultRate:N2}",
                            ["Filled Held"] = $"{c.FilledJarsHeld} jars",
                            ["Empty Held"] = $"{c.EmptyJarsHeld} jars",
                            ["Balance"] = $"₹{c.OutstandingBalance:N2}"
                        },
                        Actions = new List<GlobalSearchActionDto>
                        {
                            new() { Label = "View Customer", RouteUrl = $"/company/operations?tab=distributors&distributorId={c.DistributorId}&subtab=customers", Icon = "ExternalLink" }
                        }
                    });
                }

                // 2. Direct Plant Customers (Company Level)
                if (!isDistributor)
                {
                    var directCustMatches = await _tenantContext.Customers
                        .AsNoTracking()
                        .Where(c => !c.IsDeleted && (
                            EF.Functions.Like(c.CustomerName.ToLower(), $"%{query}%") ||
                            EF.Functions.Like(c.CustomerCode.ToLower(), $"%{query}%") ||
                            (!string.IsNullOrEmpty(digits) && EF.Functions.Like(c.Phone.ToLower(), $"%{digits}%")) ||
                            (c.Email != null && EF.Functions.Like(c.Email.ToLower(), $"%{query}%")) ||
                            (!string.IsNullOrEmpty(c.AddressLine1) && EF.Functions.Like(c.AddressLine1.ToLower(), $"%{query}%")) ||
                            (!string.IsNullOrEmpty(c.City) && EF.Functions.Like(c.City.ToLower(), $"%{query}%"))))
                        .Take(limit)
                        .Select(c => new
                        {
                            c.Id,
                            c.CustomerName,
                            c.CustomerCode,
                            c.Phone,
                            c.Email,
                            c.CustomerType,
                            c.City,
                            c.OpeningBalance
                        })
                        .ToListAsync(ct);

                    foreach (var c in directCustMatches)
                    {
                        int score = 48;
                        if (c.CustomerCode.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 100;
                        else if (c.CustomerName.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 95;
                        else if (c.CustomerName.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 80;

                        results.Add(new GlobalSearchResultDto
                        {
                            Id = c.Id.ToString(),
                            Title = c.CustomerName,
                            Subtitle = $"{c.CustomerCode} • {c.CustomerType} • Phone: {c.Phone} • {c.City}",
                            Category = "Customers",
                            Type = "customer",
                            RouteUrl = $"/company/customers/profile/{c.Id}",
                            Status = "Active",
                            Icon = "Users",
                            Score = score,
                            Metadata = new Dictionary<string, string?>
                            {
                                ["Type"] = c.CustomerType,
                                ["Phone"] = c.Phone,
                                ["Balance"] = $"₹{c.OpeningBalance:N2}"
                            },
                            Actions = new List<GlobalSearchActionDto>
                            {
                                new() { Label = "View Profile", RouteUrl = $"/company/customers/profile/{c.Id}", Icon = "User" }
                            }
                        });
                    }
                }

                if (!results.Any()) return null;

                return new GlobalSearchGroupDto
                {
                    Type = "customers",
                    Label = "Customers",
                    Icon = "Users",
                    TotalCount = results.Count,
                    Results = results.Take(limit).ToList()
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error searching customers for query: {Query}", query);
                return null;
            }
        }

        private async Task<GlobalSearchGroupDto?> SearchTwentyLOperationsAsync(string query, string alphaNum, Guid? distributorId, bool isDistributor, int limit, CancellationToken ct)
        {
            try
            {
                var results = new List<GlobalSearchResultDto>();

                // 1. Upstream Supplies (Company -> Distributor)
                if (!isDistributor)
                {
                    var supplyMatches = await _tenantContext.TwentyLDistributorSupplies
                        .AsNoTracking()
                        .Where(s => EF.Functions.Like(s.SupplyNumber.ToLower(), $"%{query}%") ||
                                    (!string.IsNullOrEmpty(alphaNum) && EF.Functions.Like(s.SupplyNumber.ToLower(), $"%{alphaNum}%")) ||
                                    (s.DriverName != null && EF.Functions.Like(s.DriverName.ToLower(), $"%{query}%")) ||
                                    (s.VehicleNumber != null && EF.Functions.Like(s.VehicleNumber.ToLower(), $"%{query}%")))
                        .Take(limit)
                        .Select(s => new
                        {
                            s.Id,
                            s.SupplyNumber,
                            s.DistributorId,
                            s.QuantitySupplied,
                            s.QuantityEmptyReturned,
                            s.TotalAmount,
                            s.Stage,
                            s.VehicleNumber,
                            s.DriverName,
                            s.DispatchedAt
                        })
                        .ToListAsync(ct);

                    foreach (var s in supplyMatches)
                    {
                        int score = 60;
                        if (s.SupplyNumber.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 100;
                        else if (s.SupplyNumber.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 85;

                        results.Add(new GlobalSearchResultDto
                        {
                            Id = s.Id.ToString(),
                            Title = $"Supply #{s.SupplyNumber}",
                            Subtitle = $"20L Company Supply • {s.QuantitySupplied} filled • Stage: {s.Stage} • Vehicle: {s.VehicleNumber ?? "N/A"}",
                            Category = "20L Operations",
                            Type = "supply",
                            RouteUrl = "/company/operations?tab=distributor-supplies",
                            Status = s.Stage,
                            Icon = "Droplets",
                            Score = score,
                            Metadata = new Dictionary<string, string?>
                            {
                                ["Quantity"] = $"{s.QuantitySupplied} filled",
                                ["Empties Returned"] = $"{s.QuantityEmptyReturned}",
                                ["Total Amount"] = $"₹{s.TotalAmount:N2}",
                                ["Driver"] = s.DriverName
                            }
                        });
                    }
                }

                // 2. Downstream Deliveries (Distributor -> Customer)
                var deliveryQueryable = _tenantContext.TwentyLDistributorDeliveries
                    .AsNoTracking();

                if (distributorId.HasValue)
                {
                    deliveryQueryable = deliveryQueryable.Where(d => d.DistributorId == distributorId.Value);
                }

                var deliveryMatches = await deliveryQueryable
                    .Where(d => EF.Functions.Like(d.DeliveryNumber.ToLower(), $"%{query}%") ||
                                (!string.IsNullOrEmpty(alphaNum) && EF.Functions.Like(d.DeliveryNumber.ToLower(), $"%{alphaNum}%")) ||
                                (d.DriverName != null && EF.Functions.Like(d.DriverName.ToLower(), $"%{query}%")) ||
                                (d.VehicleNumber != null && EF.Functions.Like(d.VehicleNumber.ToLower(), $"%{query}%")))
                    .Take(limit)
                    .Select(d => new
                    {
                        d.Id,
                        d.DeliveryNumber,
                        d.DistributorId,
                        d.QuantityFilledDelivered,
                        d.QuantityEmptyCollected,
                        d.TotalAmount,
                        d.PaymentStatus,
                        d.DeliveryDate
                    })
                    .ToListAsync(ct);

                foreach (var d in deliveryMatches)
                {
                    int score = 55;
                    if (d.DeliveryNumber.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 100;
                    else if (d.DeliveryNumber.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 85;

                    results.Add(new GlobalSearchResultDto
                    {
                        Id = d.Id.ToString(),
                        Title = $"Delivery #{d.DeliveryNumber}",
                        Subtitle = $"Customer Delivery • {d.QuantityFilledDelivered} filled delivered • {d.QuantityEmptyCollected} empties • Total: ₹{d.TotalAmount:N2}",
                        Category = "20L Operations",
                        Type = "delivery",
                        RouteUrl = $"/company/operations?tab=distributors&distributorId={d.DistributorId}&subtab=deliveries",
                        Status = d.PaymentStatus,
                        Icon = "PackageCheck",
                        Score = score,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["Delivered"] = $"{d.QuantityFilledDelivered} filled",
                            ["Collected"] = $"{d.QuantityEmptyCollected} empties",
                            ["Amount"] = $"₹{d.TotalAmount:N2}"
                        }
                    });
                }

                if (!results.Any()) return null;

                return new GlobalSearchGroupDto
                {
                    Type = "20l_operations",
                    Label = "20L Operations",
                    Icon = "Droplet",
                    TotalCount = results.Count,
                    Results = results.Take(limit).ToList()
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error searching 20L operations for query: {Query}", query);
                return null;
            }
        }

        private async Task<GlobalSearchGroupDto?> SearchProductsAndInventoryAsync(string query, int limit, CancellationToken ct)
        {
            try
            {
                var matches = await _tenantContext.Products
                    .AsNoTracking()
                    .Where(p => p.IsActive && !p.IsDeleted && (
                        EF.Functions.Like(p.Name.ToLower(), $"%{query}%") ||
                        (p.SKU != null && EF.Functions.Like(p.SKU.ToLower(), $"%{query}%")) ||
                        (p.Category != null && EF.Functions.Like(p.Category.ToLower(), $"%{query}%"))))
                    .Take(limit)
                    .Select(p => new
                    {
                        p.Id,
                        p.Name,
                        p.SKU,
                        p.Category,
                        p.BottleSize,
                        p.SellingPrice,
                        p.CurrentStock
                    })
                    .ToListAsync(ct);

                if (!matches.Any()) return null;

                var results = matches.Select(p =>
                {
                    int score = 50;
                    if (p.Name.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 95;
                    else if (p.SKU != null && p.SKU.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 100;
                    else if (p.Name.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 80;

                    return new GlobalSearchResultDto
                    {
                        Id = p.Id.ToString(),
                        Title = p.Name,
                        Subtitle = $"SKU: {p.SKU ?? "N/A"} • Category: {p.Category} • Stock: {p.CurrentStock} • Price: ₹{p.SellingPrice:N2}",
                        Category = "Inventory",
                        Type = "product",
                        RouteUrl = "/company/inventory",
                        Status = p.CurrentStock > 0 ? "In Stock" : "Out of Stock",
                        Icon = "Package",
                        Score = score,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["SKU"] = p.SKU,
                            ["BottleSize"] = p.BottleSize,
                            ["Stock"] = p.CurrentStock.ToString(),
                            ["Price"] = $"₹{p.SellingPrice:N2}"
                        },
                        Actions = new List<GlobalSearchActionDto>
                        {
                            new() { Label = "View Inventory", RouteUrl = "/company/inventory", Icon = "Package" }
                        }
                    };
                }).ToList();

                return new GlobalSearchGroupDto
                {
                    Type = "inventory",
                    Label = "Products & Inventory",
                    Icon = "Package",
                    TotalCount = results.Count,
                    Results = results
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error searching products for query: {Query}", query);
                return null;
            }
        }

        private async Task<GlobalSearchGroupDto?> SearchProductionBatchesAsync(string query, int limit, CancellationToken ct)
        {
            try
            {
                var matches = await _tenantContext.ProductionBatches
                    .AsNoTracking()
                    .Where(b => !b.IsDeleted && (
                        EF.Functions.Like(b.BatchNumber.ToLower(), $"%{query}%") ||
                        EF.Functions.Like(b.Product.ToLower(), $"%{query}%") ||
                        (b.Shift != null && EF.Functions.Like(b.Shift.ToLower(), $"%{query}%")) ||
                        (b.OperatorName != null && EF.Functions.Like(b.OperatorName.ToLower(), $"%{query}%"))))
                    .Take(limit)
                    .Select(b => new
                    {
                        b.Id,
                        b.BatchNumber,
                        b.Product,
                        b.Status,
                        b.Shift,
                        b.TargetQuantity,
                        b.ProducedQuantity,
                        b.StartedAt,
                        b.OperatorName
                    })
                    .ToListAsync(ct);

                if (!matches.Any()) return null;

                var results = matches.Select(b =>
                {
                    int score = 50;
                    if (b.BatchNumber.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 100;
                    else if (b.BatchNumber.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 85;

                    return new GlobalSearchResultDto
                    {
                        Id = b.Id.ToString(),
                        Title = $"Batch #{b.BatchNumber}",
                        Subtitle = $"Product: {b.Product} • Status: {b.Status} • Produced: {b.ProducedQuantity} / {b.TargetQuantity} • Operator: {b.OperatorName}",
                        Category = "Production",
                        Type = "production_batch",
                        RouteUrl = $"/company/production/batches/{b.Id}",
                        Status = b.Status,
                        Icon = "Layers",
                        Score = score,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["Product"] = b.Product,
                            ["Status"] = b.Status,
                            ["Produced"] = b.ProducedQuantity.ToString(),
                            ["Date"] = b.StartedAt.ToString("dd MMM yyyy")
                        },
                        Actions = new List<GlobalSearchActionDto>
                        {
                            new() { Label = "Batch Details", RouteUrl = $"/company/production/batches/{b.Id}", Icon = "Layers" }
                        }
                    };
                }).ToList();

                return new GlobalSearchGroupDto
                {
                    Type = "production",
                    Label = "Production Batches",
                    Icon = "Layers",
                    TotalCount = results.Count,
                    Results = results
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error searching production batches for query: {Query}", query);
                return null;
            }
        }

        private async Task<GlobalSearchGroupDto?> SearchFinanceAsync(string query, string digits, int limit, CancellationToken ct)
        {
            try
            {
                var results = new List<GlobalSearchResultDto>();

                // 1. Vendors
                var vendorMatches = await _tenantContext.Vendors
                    .AsNoTracking()
                    .Where(v => !v.IsDeleted && (
                        EF.Functions.Like(v.Name.ToLower(), $"%{query}%") ||
                        (!string.IsNullOrEmpty(v.VendorCode) && EF.Functions.Like(v.VendorCode.ToLower(), $"%{query}%")) ||
                        (!string.IsNullOrEmpty(digits) && v.Phone != null && EF.Functions.Like(v.Phone.ToLower(), $"%{digits}%"))))
                    .Take(limit)
                    .Select(v => new
                    {
                        v.Id,
                        v.Name,
                        v.VendorCode,
                        v.Phone,
                        v.CurrentBalance
                    })
                    .ToListAsync(ct);

                foreach (var v in vendorMatches)
                {
                    int score = 45;
                    if (v.Name.Equals(query, StringComparison.OrdinalIgnoreCase)) score = 95;
                    else if (v.Name.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 80;

                    results.Add(new GlobalSearchResultDto
                    {
                        Id = v.Id.ToString(),
                        Title = v.Name,
                        Subtitle = $"Vendor ({v.VendorCode ?? "N/A"}) • Phone: {v.Phone ?? "N/A"} • Balance: ₹{v.CurrentBalance:N2}",
                        Category = "Finance",
                        Type = "vendor",
                        RouteUrl = $"/company/accounts/vendors/{v.Id}",
                        Status = "Active",
                        Icon = "Store",
                        Score = score,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["Code"] = v.VendorCode,
                            ["Phone"] = v.Phone,
                            ["Balance"] = $"₹{v.CurrentBalance:N2}"
                        }
                    });
                }

                // 2. Purchases & Purchase Orders
                var purchaseMatches = await _tenantContext.Purchases
                    .AsNoTracking()
                    .Where(p => !p.IsDeleted && (
                        EF.Functions.Like(p.PurchaseNo.ToLower(), $"%{query}%") ||
                        (p.InvoiceNumber != null && EF.Functions.Like(p.InvoiceNumber.ToLower(), $"%{query}%")) ||
                        (p.ReferenceNumber != null && EF.Functions.Like(p.ReferenceNumber.ToLower(), $"%{query}%")) ||
                        (!string.IsNullOrEmpty(p.VendorName) && EF.Functions.Like(p.VendorName.ToLower(), $"%{query}%"))))
                    .Take(limit)
                    .Select(p => new
                    {
                        p.Id,
                        p.PurchaseNo,
                        p.InvoiceNumber,
                        p.VendorName,
                        p.GrandTotal,
                        p.PaymentStatus,
                        p.PurchaseDate
                    })
                    .ToListAsync(ct);

                foreach (var p in purchaseMatches)
                {
                    int score = 55;
                    if (p.PurchaseNo.Equals(query, StringComparison.OrdinalIgnoreCase) ||
                        (p.InvoiceNumber != null && p.InvoiceNumber.Equals(query, StringComparison.OrdinalIgnoreCase))) score = 100;

                    results.Add(new GlobalSearchResultDto
                    {
                        Id = p.Id.ToString(),
                        Title = $"Purchase #{p.PurchaseNo}",
                        Subtitle = $"Vendor: {p.VendorName} • Invoice: {p.InvoiceNumber ?? "Pending"} • Total: ₹{p.GrandTotal:N2} • Status: {p.PaymentStatus}",
                        Category = "Finance",
                        Type = "purchase",
                        RouteUrl = $"/company/accounts/purchases/{p.Id}",
                        Status = p.PaymentStatus,
                        Icon = "Receipt",
                        Score = score,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["Vendor"] = p.VendorName,
                            ["Invoice"] = p.InvoiceNumber,
                            ["Total"] = $"₹{p.GrandTotal:N2}"
                        }
                    });
                }

                // 3. Bank Accounts
                var bankMatches = await _tenantContext.BankAccounts
                    .AsNoTracking()
                    .Where(b => b.IsActive && !b.IsDeleted && (
                        EF.Functions.Like(b.AccountName.ToLower(), $"%{query}%") ||
                        EF.Functions.Like(b.AccountNumber.ToLower(), $"%{query}%") ||
                        EF.Functions.Like(b.BankName.ToLower(), $"%{query}%")))
                    .Take(limit)
                    .Select(b => new
                    {
                        b.Id,
                        b.AccountName,
                        b.AccountNumber,
                        b.BankName,
                        b.CurrentBalance
                    })
                    .ToListAsync(ct);

                foreach (var b in bankMatches)
                {
                    results.Add(new GlobalSearchResultDto
                    {
                        Id = b.Id.ToString(),
                        Title = $"{b.BankName} — {b.AccountName}",
                        Subtitle = $"A/C: {b.AccountNumber} • Balance: ₹{b.CurrentBalance:N2}",
                        Category = "Finance",
                        Type = "bank_account",
                        RouteUrl = $"/company/accounts/bank-accounts/{b.Id}",
                        Status = "Active",
                        Icon = "CreditCard",
                        Score = 50,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["Bank"] = b.BankName,
                            ["A/C"] = b.AccountNumber,
                            ["Balance"] = $"₹{b.CurrentBalance:N2}"
                        }
                    });
                }

                if (!results.Any()) return null;

                return new GlobalSearchGroupDto
                {
                    Type = "finance",
                    Label = "Finance & Accounts",
                    Icon = "PieChart",
                    TotalCount = results.Count,
                    Results = results.Take(limit).ToList()
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error searching finance for query: {Query}", query);
                return null;
            }
        }

        private async Task<GlobalSearchGroupDto?> SearchQCReportsAsync(string query, int limit, CancellationToken ct)
        {
            try
            {
                var matches = await _tenantContext.WaterTestReports
                    .AsNoTracking()
                    .Where(r => !r.IsDeleted && (
                        EF.Functions.Like(r.BatchNumber.ToLower(), $"%{query}%") ||
                        (r.SampleNumber != null && EF.Functions.Like(r.SampleNumber.ToLower(), $"%{query}%")) ||
                        (r.TestedBy != null && EF.Functions.Like(r.TestedBy.ToLower(), $"%{query}%")) ||
                        EF.Functions.Like(r.Status.ToLower(), $"%{query}%")))
                    .Take(limit)
                    .Select(r => new
                    {
                        r.Id,
                        r.BatchNumber,
                        r.SampleNumber,
                        r.Status,
                        r.ReportType,
                        r.CreatedAt,
                        r.TestedBy
                    })
                    .ToListAsync(ct);

                if (!matches.Any()) return null;

                var results = matches.Select(r =>
                {
                    int score = 50;
                    if (r.BatchNumber.Equals(query, StringComparison.OrdinalIgnoreCase) ||
                        (r.SampleNumber != null && r.SampleNumber.Equals(query, StringComparison.OrdinalIgnoreCase))) score = 100;
                    else if (r.BatchNumber.StartsWith(query, StringComparison.OrdinalIgnoreCase)) score = 85;

                    return new GlobalSearchResultDto
                    {
                        Id = r.Id.ToString(),
                        Title = $"Water Test — Batch #{r.BatchNumber}",
                        Subtitle = $"Sample: {r.SampleNumber ?? "N/A"} • Type: {r.ReportType} • Status: {r.Status} • Tester: {r.TestedBy ?? "Lab"}",
                        Category = "QC",
                        Type = "qc_report",
                        RouteUrl = $"/company/qc/water-test/{r.Id}",
                        Status = r.Status,
                        Icon = "Beaker",
                        Score = score,
                        Metadata = new Dictionary<string, string?>
                        {
                            ["Status"] = r.Status,
                            ["Sample"] = r.SampleNumber,
                            ["Date"] = r.CreatedAt.ToString("dd MMM yyyy")
                        },
                        Actions = new List<GlobalSearchActionDto>
                        {
                            new() { Label = "View Report", RouteUrl = $"/company/qc/water-test/{r.Id}", Icon = "FileText" }
                        }
                    };
                }).ToList();

                return new GlobalSearchGroupDto
                {
                    Type = "qc",
                    Label = "Quality Control Reports",
                    Icon = "Beaker",
                    TotalCount = results.Count,
                    Results = results
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error searching QC reports for query: {Query}", query);
                return null;
            }
        }

        private GlobalSearchGroupDto GetNavigationResults(string query, int limit)
        {
            var navItems = new List<GlobalSearchResultDto>
            {
                new() { Id = "nav-dashboard", Title = "Company Dashboard", Subtitle = "Overview & Key Metrics", Category = "Navigation", Type = "page", RouteUrl = "/company/dashboard", Icon = "LayoutDashboard", Score = 70 },
                new() { Id = "nav-20l", Title = "20L Operations Hub", Subtitle = "Plant Stock, Distributor Supplies, Fleet & Driver Tracking", Category = "Navigation", Type = "page", RouteUrl = "/company/operations", Icon = "Droplet", Score = 85 },
                new() { Id = "nav-distributors", Title = "20L Distributors Management", Subtitle = "Distributor Portals, Routes, Vehicles, Customers", Category = "Navigation", Type = "page", RouteUrl = "/company/operations?tab=distributors", Icon = "Building2", Score = 80 },
                new() { Id = "nav-supplies", Title = "20L Distributor Supplies", Subtitle = "Upstream Jar Dispatches & Returns", Category = "Navigation", Type = "page", RouteUrl = "/company/operations?tab=distributor-supplies", Icon = "Droplets", Score = 75 },
                new() { Id = "nav-production", Title = "Production Batches", Subtitle = "Active Sessions, Batch Tracking & Filling", Category = "Navigation", Type = "page", RouteUrl = "/company/production", Icon = "Layers", Score = 75 },
                new() { Id = "nav-production-setup", Title = "Production Setup", Subtitle = "Production Lines & Station Setup", Category = "Navigation", Type = "page", RouteUrl = "/company/production-setup", Icon = "Sliders", Score = 65 },
                new() { Id = "nav-inventory", Title = "Products & Inventory", Subtitle = "Stock Balances, SKUs, Raw Materials", Category = "Navigation", Type = "page", RouteUrl = "/company/inventory", Icon = "Package", Score = 75 },
                new() { Id = "nav-customers", Title = "Customers Directory", Subtitle = "Commercial & Residential Client Profiles", Category = "Navigation", Type = "page", RouteUrl = "/company/customers", Icon = "Users", Score = 75 },
                new() { Id = "nav-sales", Title = "Sales Transactions", Subtitle = "Invoices, Counter Sales & Deliveries", Category = "Navigation", Type = "page", RouteUrl = "/company/sales", Icon = "ShoppingCart", Score = 70 },
                new() { Id = "nav-accounts", Title = "Accounts Dashboard", Subtitle = "Financial Overview, Expenses, Ledger", Category = "Navigation", Type = "page", RouteUrl = "/company/accounts/dashboard", Icon = "PieChart", Score = 70 },
                new() { Id = "nav-expenses", Title = "Expense Management", Subtitle = "Company Expenses & Petty Cash", Category = "Navigation", Type = "page", RouteUrl = "/company/accounts/expenses", Icon = "Receipt", Score = 70 },
                new() { Id = "nav-purchases", Title = "Purchase Management", Subtitle = "Purchase Orders, Bills & Vendor History", Category = "Navigation", Type = "page", RouteUrl = "/company/accounts/purchases", Icon = "ShoppingCart", Score = 70 },
                new() { Id = "nav-vendors", Title = "Vendors & Suppliers", Subtitle = "Vendor Balances & Purchase History", Category = "Navigation", Type = "page", RouteUrl = "/company/accounts/vendors", Icon = "Store", Score = 65 },
                new() { Id = "nav-payroll", Title = "Payroll & Salaries", Subtitle = "Monthly Salaries & Staff Payouts", Category = "Navigation", Type = "page", RouteUrl = "/company/accounts/payroll", Icon = "Wallet", Score = 65 },
                new() { Id = "nav-bank-accounts", Title = "Bank Accounts & Cash Books", Subtitle = "Bank Ledgers & Cash Logs", Category = "Navigation", Type = "page", RouteUrl = "/company/accounts/ledger/bank-accounts", Icon = "CreditCard", Score = 65 },
                new() { Id = "nav-qc", Title = "Water Test Reports", Subtitle = "Quality Control, Lab Tests & Compliance", Category = "Navigation", Type = "page", RouteUrl = "/company/qc/water-test", Icon = "Beaker", Score = 70 },
                new() { Id = "nav-employees", Title = "Employees & Team", Subtitle = "Staff Directory & Access Roles", Category = "Navigation", Type = "page", RouteUrl = "/company/employees", Icon = "IdCard", Score = 65 },
                new() { Id = "nav-settings", Title = "Company Settings", Subtitle = "General Settings, Preferences & Branding", Category = "Navigation", Type = "page", RouteUrl = "/company/settings", Icon = "Settings", Score = 60 },
                new() { Id = "nav-backups", Title = "Backup & Restore", Subtitle = "Tenant Data Snapshots & Recovery", Category = "Navigation", Type = "page", RouteUrl = "/company/backups", Icon = "Database", Score = 60 }
            };

            var filtered = string.IsNullOrWhiteSpace(query)
                ? navItems.Take(limit).ToList()
                : navItems.Where(n => n.Title.ToLowerInvariant().Contains(query) ||
                                      (n.Subtitle != null && n.Subtitle.ToLowerInvariant().Contains(query)))
                          .Take(limit)
                          .ToList();

            return new GlobalSearchGroupDto
            {
                Type = "navigation",
                Label = "Navigation",
                Icon = "Compass",
                TotalCount = filtered.Count,
                Results = filtered
            };
        }

        private GlobalSearchGroupDto GetActionResults(string query, int limit)
        {
            var actions = new List<GlobalSearchResultDto>
            {
                new() { Id = "act-new-supply", Title = "Create 20L Distributor Supply", Subtitle = "Dispatch filled 20L jars to distributor vehicle", Category = "Actions", Type = "action", RouteUrl = "/company/operations?tab=distributor-supplies&action=new", Icon = "PlusCircle", Score = 90 },
                new() { Id = "act-new-customer", Title = "Create New Customer", Subtitle = "Add a new client profile with pricing terms", Category = "Actions", Type = "action", RouteUrl = "/company/customers?action=new", Icon = "UserPlus", Score = 85 },
                new() { Id = "act-new-distributor", Title = "Add 20L Distributor", Subtitle = "Register a new water distribution partner", Category = "Actions", Type = "action", RouteUrl = "/company/operations?tab=distributors&action=new", Icon = "Building2", Score = 85 },
                new() { Id = "act-new-purchase", Title = "Create Purchase Order", Subtitle = "Record a raw material / equipment purchase", Category = "Actions", Type = "action", RouteUrl = "/company/accounts/purchases/new", Icon = "Receipt", Score = 80 },
                new() { Id = "act-record-expense", Title = "Record Expense", Subtitle = "Log business expense or cash disbursement", Category = "Actions", Type = "action", RouteUrl = "/company/accounts/expenses?action=new", Icon = "Wallet", Score = 80 },
                new() { Id = "act-new-water-test", Title = "New Water Test Report", Subtitle = "Log laboratory batch QC inspection", Category = "Actions", Type = "action", RouteUrl = "/company/qc/water-test/new", Icon = "Beaker", Score = 80 },
                new() { Id = "act-new-batch", Title = "Start Production Batch", Subtitle = "Initiate a production run on assigned line", Category = "Actions", Type = "action", RouteUrl = "/company/production?action=new", Icon = "Play", Score = 80 },
                new() { Id = "act-invite-team", Title = "Invite Team Member", Subtitle = "Send invitation email for operator/manager", Category = "Actions", Type = "action", RouteUrl = "/invite-team", Icon = "Mail", Score = 70 }
            };

            var filtered = string.IsNullOrWhiteSpace(query)
                ? actions.Take(limit).ToList()
                : actions.Where(a => a.Title.ToLowerInvariant().Contains(query) ||
                                      (a.Subtitle != null && a.Subtitle.ToLowerInvariant().Contains(query)))
                          .Take(limit)
                          .ToList();

            return new GlobalSearchGroupDto
            {
                Type = "actions",
                Label = "Quick Actions",
                Icon = "Zap",
                TotalCount = filtered.Count,
                Results = filtered
            };
        }

        #endregion
    }
}
