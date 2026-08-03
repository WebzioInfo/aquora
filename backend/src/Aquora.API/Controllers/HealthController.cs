using System;
using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [AllowAnonymous]
    [ApiController]
    [Route("api/v1/[controller]")]
    [Route("api/[controller]")]
    public class HealthController : ApiControllerBase
    {
        private readonly IHealthService _healthService;

        public HealthController(IHealthService healthService)
        {
            _healthService = healthService;
        }

        /// <summary>
        /// Gets detailed system health status including database connectivity, memory, and uptime.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<ApiResponse<HealthStatusDto>>> GetHealth()
        {
            var health = await _healthService.GetSystemHealthAsync();

            if (health.Status == "Unhealthy")
            {
                var failureResponse = ApiResponse<HealthStatusDto>.CreateFailure(
                    error: health.Database.Error ?? "System is unhealthy.",
                    message: "Health check failed: One or more critical components are unhealthy.",
                    traceId: HttpContext.TraceIdentifier
                );
                failureResponse.Data = health;
                failureResponse.Code = "HEALTH_CHECK_FAILED";
                return StatusCode((int)HttpStatusCode.ServiceUnavailable, failureResponse);
            }

            return Success(health, "Health check executed successfully.");
        }

        /// <summary>
        /// Liveness probe - returns 200 OK if the API application process is alive.
        /// </summary>
        [HttpGet("liveness")]
        [HttpGet("live")]
        [HttpGet("ping")]
        public IActionResult Liveness()
        {
            return Ok(new
            {
                status = "Healthy",
                service = "Aquora.API",
                timestamp = DateTime.UtcNow
            });
        }

        /// <summary>
        /// Readiness probe - checks if essential dependencies (database) are ready to accept traffic.
        /// </summary>
        [HttpGet("readiness")]
        [HttpGet("ready")]
        public async Task<IActionResult> Readiness()
        {
            bool isDbHealthy = await _healthService.IsDatabaseHealthyAsync();
            if (!isDbHealthy)
            {
                return StatusCode((int)HttpStatusCode.ServiceUnavailable, new
                {
                    status = "Unhealthy",
                    service = "Aquora.API",
                    reason = "Database connection failed",
                    timestamp = DateTime.UtcNow
                });
            }

            return Ok(new
            {
                status = "Healthy",
                service = "Aquora.API",
                ready = true,
                timestamp = DateTime.UtcNow
            });
        }
    }
}
