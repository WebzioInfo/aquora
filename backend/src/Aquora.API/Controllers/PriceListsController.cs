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
    public class PriceListsController : ControllerBase
    {
        private readonly IPriceListService _priceListService;

        public PriceListsController(IPriceListService priceListService)
        {
            _priceListService = priceListService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var result = await _priceListService.GetAllPriceListsAsync();
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var result = await _priceListService.GetPriceListByIdAsync(id);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create(PriceList priceList)
        {
            var result = await _priceListService.CreatePriceListAsync(priceList);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, PriceList priceList)
        {
            try
            {
                var result = await _priceListService.UpdatePriceListAsync(id, priceList);
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
            await _priceListService.DeletePriceListAsync(id);
            return NoContent();
        }
    }
}
