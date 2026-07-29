using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities;
using Microsoft.AspNetCore.Authorization;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DiscountGroupsController : ControllerBase
    {
        private readonly IDiscountGroupService _discountGroupService;
        private readonly ICacheService _cacheService;
        private readonly ICurrentUserContext _currentUserContext;

        public DiscountGroupsController(IDiscountGroupService discountGroupService, ICacheService cacheService, ICurrentUserContext currentUserContext)
        {
            _discountGroupService = discountGroupService;
            _cacheService = cacheService;
            _currentUserContext = currentUserContext;
        }

        private string GetCacheKey() => $"discount_groups_{_currentUserContext.TenantId}";

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var cacheKey = GetCacheKey();
            var cached = await _cacheService.GetAsync<System.Collections.Generic.IEnumerable<DiscountGroup>>(cacheKey);
            if (cached != null) return Ok(cached);

            var result = await _discountGroupService.GetAllDiscountGroupsAsync();
            await _cacheService.SetAsync(cacheKey, result, TimeSpan.FromMinutes(15));
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var result = await _discountGroupService.GetDiscountGroupByIdAsync(id);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create(DiscountGroup discountGroup)
        {
            var result = await _discountGroupService.CreateDiscountGroupAsync(discountGroup);
            await _cacheService.RemoveAsync(GetCacheKey());
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, DiscountGroup discountGroup)
        {
            var result = await _discountGroupService.UpdateDiscountGroupAsync(id, discountGroup);
            await _cacheService.RemoveAsync(GetCacheKey());
            return Ok(result);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            await _discountGroupService.DeleteDiscountGroupAsync(id);
            await _cacheService.RemoveAsync(GetCacheKey());
            return NoContent();
        }
    }
}
