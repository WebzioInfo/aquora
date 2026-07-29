using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Interfaces.Services;
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

        public DiscountGroupsController(IDiscountGroupService discountGroupService)
        {
            _discountGroupService = discountGroupService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var result = await _discountGroupService.GetAllDiscountGroupsAsync();
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
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, DiscountGroup discountGroup)
        {
            try
            {
                var result = await _discountGroupService.UpdateDiscountGroupAsync(id, discountGroup);
                return Ok(result);
            }
            catch (System.Collections.Generic.KeyNotFoundException)
            {
                return NotFound();
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            await _discountGroupService.DeleteDiscountGroupAsync(id);
            return NoContent();
        }
    }
}
