using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.Search
{
    public class GlobalSearchRequestDto
    {
        public string Query { get; set; } = string.Empty;
        public string? Scope { get; set; } = "all"; // all, customers, distributors, vehicles, routes, people, 20l, inventory, production, finance, qc, actions, navigation
        public Guid? DistributorId { get; set; }
        public int LimitPerCategory { get; set; } = 5;
    }

    public class GlobalSearchResultDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Subtitle { get; set; }
        public string Category { get; set; } = string.Empty; // Customers, Distributors, Vehicles, Drivers, 20L Operations, Inventory, Production, Finance, QC, Navigation, Actions
        public string Type { get; set; } = string.Empty; // customer, distributor, vehicle, driver, supply, delivery, product, batch, purchase, test_report, page, action
        public string RouteUrl { get; set; } = string.Empty;
        public string? Status { get; set; }
        public string? Icon { get; set; }
        public int Score { get; set; } = 0; // Relevance score for ordering
        public Dictionary<string, string?> Metadata { get; set; } = new();
        public List<GlobalSearchActionDto> Actions { get; set; } = new();
    }

    public class GlobalSearchActionDto
    {
        public string Label { get; set; } = string.Empty;
        public string RouteUrl { get; set; } = string.Empty;
        public string? Icon { get; set; }
        public string? Permission { get; set; }
    }

    public class GlobalSearchGroupDto
    {
        public string Type { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
        public int TotalCount { get; set; }
        public List<GlobalSearchResultDto> Results { get; set; } = new();
    }

    public class GlobalSearchResponseDto
    {
        public string Query { get; set; } = string.Empty;
        public int TotalMatches { get; set; }
        public List<GlobalSearchGroupDto> Groups { get; set; } = new();
        public long ExecutionTimeMs { get; set; }
    }
}
