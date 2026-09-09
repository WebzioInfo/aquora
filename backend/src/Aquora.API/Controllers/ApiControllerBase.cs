using System.Net;
using Microsoft.AspNetCore.Mvc;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    public abstract class ApiControllerBase : ControllerBase
    {
        protected ActionResult<ApiResponse<T>> Success<T>(T data, string? message = null)
        {
            var response = ApiResponse<T>.CreateSuccess(data, message);
            return Ok(response);
        }

        protected ActionResult<ApiResponse<T>> Failure<T>(string error, string message = "An error occurred", HttpStatusCode statusCode = HttpStatusCode.BadRequest)
        {
            var traceId = HttpContext?.TraceIdentifier ?? Guid.NewGuid().ToString();
            var response = ApiResponse<T>.CreateFailure(error, message, traceId);
            return StatusCode((int)statusCode, response);
        }

        protected ActionResult<ApiResponse<T>> Failure<T>(List<object> errors, string message = "An error occurred", HttpStatusCode statusCode = HttpStatusCode.BadRequest)
        {
            var traceId = HttpContext?.TraceIdentifier ?? Guid.NewGuid().ToString();
            var response = ApiResponse<T>.CreateFailure(errors, message, traceId);
            return StatusCode((int)statusCode, response);
        }

        protected ActionResult<ApiResponse<T>> ValidationError<T>(string field, string message, HttpStatusCode statusCode = HttpStatusCode.BadRequest)
        {
            var traceId = HttpContext?.TraceIdentifier ?? Guid.NewGuid().ToString();
            var errors = new List<object> { new { field, message } };
            var response = ApiResponse<T>.CreateFailure(errors, "Validation failed", traceId);
            return StatusCode((int)statusCode, response);
        }
    }
}
