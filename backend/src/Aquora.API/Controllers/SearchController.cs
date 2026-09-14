using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Aquora.Application.DTOs.Search;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class SearchController : ApiControllerBase
    {
        private readonly IGlobalSearchService _searchService;
        private readonly ILogger<SearchController> _logger;

        public SearchController(IGlobalSearchService searchService, ILogger<SearchController> logger)
        {
            _searchService = searchService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<GlobalSearchResponseDto>>> Search(
            [FromQuery] string? q,
            [FromQuery] string? scope,
            [FromQuery] Guid? distributorId,
            [FromQuery] int limit = 5,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var request = new GlobalSearchRequestDto
                {
                    Query = q ?? string.Empty,
                    Scope = scope ?? "all",
                    DistributorId = distributorId,
                    LimitPerCategory = limit
                };

                var results = await _searchService.SearchAsync(request, cancellationToken);
                return Success(results, "Search completed successfully");
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, ApiResponse<GlobalSearchResponseDto>.CreateFailure("Client closed connection", "Request cancelled"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Global search failed for query: {Query}", q);
                return Failure<GlobalSearchResponseDto>("Search couldn't be completed. Please try again with a different query.", "Search Failed");
            }
        }
    }
}
