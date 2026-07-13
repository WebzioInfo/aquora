using System;
using System.Collections.Generic;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Aquora.Shared.Models;

namespace Aquora.API.Middleware
{
    public class ExceptionHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionHandlingMiddleware> _logger;

        public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unhandled exception occurred in the API pipeline.");
                await HandleExceptionAsync(context, ex);
            }
        }

        private static Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            context.Response.ContentType = "application/json";
            
             var statusCode = exception switch
             {
                 UnauthorizedAccessException => HttpStatusCode.Unauthorized,
                 KeyNotFoundException => HttpStatusCode.NotFound,
                 ArgumentException => HttpStatusCode.BadRequest,
                 InvalidOperationException => exception.Message == "ALREADY_VERIFIED" ? HttpStatusCode.Conflict : HttpStatusCode.BadRequest,
                 _ => HttpStatusCode.InternalServerError
             };

            context.Response.StatusCode = (int)statusCode;

            var traceId = context.TraceIdentifier;
            
            Console.WriteLine($"[EXCEPTION PIPELINE] Error: {exception.Message}\nStack: {exception.StackTrace}\nInner: {exception.InnerException?.Message}");

            // Build standardized error response
            var apiResponse = ApiResponse<object>.CreateFailure(
                exception.Message, 
                exception.ToString(), 
                traceId);

            var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            var result = JsonSerializer.Serialize(apiResponse, options);

            return context.Response.WriteAsync(result);
        }
    }
}
