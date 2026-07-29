using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Aquora.Application.DTOs;
using System.Collections.Generic;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class PayrollController : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            // Scaffolded Data
            return Ok(new { Data = new List<PayslipDto>() });
        }
    }
}
