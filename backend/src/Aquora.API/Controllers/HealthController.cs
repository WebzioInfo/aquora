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

        /// <summary>
        /// Safe configuration diagnostic endpoint reporting boolean status of critical configuration without exposing secrets.
        /// </summary>
        [HttpGet("config-status")]
        public async Task<IActionResult> GetConfigStatus([FromServices] IConfiguration config, [FromServices] IEmailService emailService)
        {
            var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
            var dbConn = config.GetConnectionString("DefaultConnection") ?? config["ConnectionStrings:DefaultConnection"];
            var jwtSecret = config["JwtSettings:Secret"] ?? config["JWT_SECRET"];
            var frontendUrl = config["FRONTEND_URL"] ?? config["ALLOWED_ORIGINS"];
            var (smtpSuccess, smtpMsg) = await emailService.VerifySmtpConfigurationAsync();

            return Ok(new
            {
                environment = env,
                apiConfigured = true,
                databaseConfigured = !string.IsNullOrWhiteSpace(dbConn),
                jwtConfigured = !string.IsNullOrWhiteSpace(jwtSecret),
                smtpConfigured = smtpSuccess,
                smtpDiagnostic = smtpMsg,
                frontendUrlConfigured = !string.IsNullOrWhiteSpace(frontendUrl),
                timestamp = DateTime.UtcNow
            });
        }

        /// <summary>
        /// Diagnostic endpoint testing DNS and TCP egress connectivity to smtp.gmail.com ports 587 and 465.
        /// </summary>
        [HttpGet("smtp-diagnostic")]
        public async Task<IActionResult> SmtpNetworkDiagnostic()
        {
            var host = "smtp.gmail.com";
            var dnsPass = false;
            var dnsIps = "";
            var tcp587Pass = false;
            var tcp465Pass = false;
            var diagnosticLog = new System.Collections.Generic.List<string>();

            // 1. DNS Resolution Test
            try
            {
                var ips = await System.Net.Dns.GetHostAddressesAsync(host);
                dnsPass = ips.Length > 0;
                dnsIps = string.Join(", ", System.Linq.Enumerable.Select(ips, ip => ip.ToString()));
                diagnosticLog.Add($"DNS: Successfully resolved {host} to [{dnsIps}]");
            }
            catch (Exception ex)
            {
                diagnosticLog.Add($"DNS FAIL: Could not resolve {host}: {ex.Message}");
            }

            // 2. TCP Port 587 Test
            try
            {
                using var client587 = new System.Net.Sockets.TcpClient();
                var connectTask = client587.ConnectAsync(host, 587);
                var timeoutTask = Task.Delay(4000);
                var completed = await Task.WhenAny(connectTask, timeoutTask);
                if (completed == connectTask && client587.Connected)
                {
                    tcp587Pass = true;
                    diagnosticLog.Add($"TCP 587: Successfully connected to {host}:587");
                }
                else
                {
                    diagnosticLog.Add($"TCP 587 FAIL: Connection to {host}:587 timed out after 4000ms. Outbound port 587 is blocked by hosting environment.");
                }
            }
            catch (Exception ex)
            {
                diagnosticLog.Add($"TCP 587 ERROR: {ex.Message}");
            }

            // 3. TCP Port 465 Test (Alternative SSL Port)
            try
            {
                using var client465 = new System.Net.Sockets.TcpClient();
                var connectTask = client465.ConnectAsync(host, 465);
                var timeoutTask = Task.Delay(4000);
                var completed = await Task.WhenAny(connectTask, timeoutTask);
                if (completed == connectTask && client465.Connected)
                {
                    tcp465Pass = true;
                    diagnosticLog.Add($"TCP 465: Successfully connected to {host}:465");
                }
                else
                {
                    diagnosticLog.Add($"TCP 465 FAIL: Connection to {host}:465 timed out after 4000ms. Outbound port 465 is blocked by hosting environment.");
                }
            }
            catch (Exception ex)
            {
                diagnosticLog.Add($"TCP 465 ERROR: {ex.Message}");
            }

            return Ok(new
            {
                targetHost = host,
                dnsResolution = dnsPass ? "PASS" : "FAIL",
                resolvedIpAddresses = dnsIps,
                tcpPort587 = tcp587Pass ? "PASS" : "FAIL",
                tcpPort465 = tcp465Pass ? "PASS" : "FAIL",
                diagnostics = diagnosticLog,
                timestamp = DateTime.UtcNow
            });
        }
    }
}

