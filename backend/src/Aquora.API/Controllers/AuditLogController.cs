using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.API.Authorization;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities;
using Aquora.Shared.Constants;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class AuditLogController : ApiControllerBase
    {
        private readonly ITenantDbContext _context;

        public AuditLogController(ITenantDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [HasPermission(Permissions.AuditRead)]
        public async Task<ActionResult<ApiResponse<List<AuditLog>>>> GetLogs()
        {
            var logs = await _context.AuditLogs
                .OrderByDescending(a => a.Timestamp)
                .Take(200)
                .ToListAsync();

            return Success(logs, "Audit logs loaded successfully.");
        }
    }
}
