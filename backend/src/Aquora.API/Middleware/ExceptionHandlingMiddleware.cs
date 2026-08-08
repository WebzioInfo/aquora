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
            
            bool isUniqueViolation = exception is Microsoft.EntityFrameworkCore.DbUpdateException dbEx && IsUniqueConstraintViolation(dbEx);
            bool isDuplicateEmailMsg = exception is InvalidOperationException invEx && 
                (invEx.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase) || 
                 invEx.Message.Contains("already registered", StringComparison.OrdinalIgnoreCase) ||
                 invEx.Message == "ALREADY_VERIFIED");

            var statusCode = exception switch
            {
                _ when isUniqueViolation || isDuplicateEmailMsg => HttpStatusCode.Conflict,
                UnauthorizedAccessException => HttpStatusCode.Unauthorized,
                KeyNotFoundException => HttpStatusCode.NotFound,
                ArgumentException => HttpStatusCode.BadRequest,
                Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException => HttpStatusCode.Conflict,
                InvalidOperationException => HttpStatusCode.BadRequest,
                _ => HttpStatusCode.InternalServerError
            };

            context.Response.StatusCode = (int)statusCode;
            var traceId = context.TraceIdentifier;
            
            Console.WriteLine($"[EXCEPTION PIPELINE] Error: {exception.Message}\nStack: {exception.StackTrace}\nInner: {exception.InnerException?.Message}");

            string errorMessage;
            string errorCode;
            var errorDetails = new List<object>();

            if (isUniqueViolation)
            {
                if (IsUserEmailConstraintViolation(exception))
                {
                    errorMessage = "An account with this email already exists.";
                    errorCode = "EMAIL_EXISTS";
                }
                else
                {
                    errorMessage = "A record with this information already exists. Please check for duplicate entries.";
                    errorCode = "DUPLICATE_RECORD";
                }
                errorDetails.Add(errorMessage);
            }
            else if (statusCode == HttpStatusCode.InternalServerError)
            {
                // Never expose details of internal server errors/crashes
                errorMessage = "Unable to complete your request. Please try again later.";
                errorCode = "INTERNAL_SERVER_ERROR";
                errorDetails.Add("Unable to complete your request. Please try again later.");
            }
            else
            {
                errorMessage = exception.Message;
                errorCode = exception switch
                {
                    _ when isDuplicateEmailMsg => "EMAIL_EXISTS",
                    UnauthorizedAccessException => "UNAUTHORIZED",
                    KeyNotFoundException => "NOT_FOUND",
                    Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException => "CONCURRENCY_CONFLICT",
                    InvalidOperationException => "INVALID_OPERATION",
                    _ => "BAD_REQUEST"
                };

                if (IsTechnicalErrorString(errorMessage))
                {
                    errorMessage = "We couldn't complete your request right now. Please try again in a few moments.";
                    errorCode = "SERVER_ERROR";
                }
                errorDetails.Add(errorMessage);
            }

            // Build standardized error response
            var apiResponse = ApiResponse<object>.CreateFailure(errorDetails, errorMessage, traceId);
            apiResponse.Code = errorCode;

            var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            var result = JsonSerializer.Serialize(apiResponse, options);

            return context.Response.WriteAsync(result);
        }

        private static bool IsUserEmailConstraintViolation(Exception ex)
        {
            var current = ex;
            while (current != null)
            {
                if (current.Message.Contains("IX_Users_Email", StringComparison.OrdinalIgnoreCase) ||
                    current.Message.Contains("users_email", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
                current = current.InnerException;
            }
            return false;
        }

        private static bool IsTechnicalErrorString(string? msg)
        {
            if (string.IsNullOrWhiteSpace(msg)) return false;
            var lower = msg.ToLowerInvariant();
            return lower.Contains("23505") || lower.Contains("ix_users_") || lower.Contains("npgsql") ||
                   lower.Contains("postgres") || lower.Contains("dbupdate") || lower.Contains("nullreference") ||
                   lower.Contains("object reference") || lower.Contains("connection refused") || lower.Contains("econnrefused") ||
                   lower.Contains("an error occurred while saving the entity changes");
        }

        private static bool IsUniqueConstraintViolation(Microsoft.EntityFrameworkCore.DbUpdateException ex)
        {
            var current = ex.InnerException;
            while (current != null)
            {
                if (current.GetType().Name.Equals("PostgresException", StringComparison.OrdinalIgnoreCase))
                {
                    var sqlStateProp = current.GetType().GetProperty("SqlState");
                    var sqlState = sqlStateProp?.GetValue(current)?.ToString();
                    if (sqlState == "23505") return true;
                }
                if (current.Message.Contains("23505") || current.Message.Contains("IX_Users_Email") || current.Message.Contains("duplicate key"))
                {
                    return true;
                }
                current = current.InnerException;
            }
            return ex.Message.Contains("23505") || ex.Message.Contains("IX_Users_Email");
        }
    }
}
