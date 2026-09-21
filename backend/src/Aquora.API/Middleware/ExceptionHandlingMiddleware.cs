using System;
using System.Collections.Generic;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Aquora.Shared.Models;
using Npgsql;

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

            var rateLimitEx = exception as Aquora.Application.Common.Exceptions.OtpRateLimitException;
            var (isMissingRelation, relationName, schemaName, missingDetails) = DetectMissingDatabaseRelation(exception);

            var statusCode = exception switch
            {
                _ when rateLimitEx != null => HttpStatusCode.TooManyRequests,
                TimeoutException or TaskCanceledException or OperationCanceledException => HttpStatusCode.GatewayTimeout,
                _ when isUniqueViolation || isDuplicateEmailMsg => HttpStatusCode.Conflict,
                UnauthorizedAccessException => HttpStatusCode.Unauthorized,
                KeyNotFoundException => HttpStatusCode.NotFound,
                ArgumentException => HttpStatusCode.BadRequest,
                Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException => HttpStatusCode.Conflict,
                InvalidOperationException => HttpStatusCode.BadRequest,
                _ => HttpStatusCode.InternalServerError
            };

            if (rateLimitEx != null)
            {
                context.Response.Headers["Retry-After"] = rateLimitEx.RetryAfterSeconds.ToString();
            }

            context.Response.StatusCode = (int)statusCode;
            var traceId = context.TraceIdentifier;
            
            Console.WriteLine($"[EXCEPTION PIPELINE] Error: {exception.Message}\nStack: {exception.StackTrace}\nInner: {exception.InnerException?.Message}");

            string errorMessage;
            string errorCode;
            var errorDetails = new List<object>();

            if (rateLimitEx != null)
            {
                errorMessage = rateLimitEx.Message;
                errorCode = "OTP_RATE_LIMITED";
                errorDetails.Add(errorMessage);
            }
            else if (isMissingRelation)
            {
                errorMessage = $"Database schema error: Required database relation '{relationName ?? "table"}' does not exist in schema '{schemaName ?? "tenant"}'. Pending migrations need to be applied.";
                errorCode = "DATABASE_SCHEMA_MISSING_TABLE";
                errorDetails.Add(missingDetails ?? errorMessage);
                Console.Error.WriteLine($"[DATABASE SCHEMA ERROR] {missingDetails} (TraceId: {traceId})");
            }
            else if (exception is TimeoutException or TaskCanceledException or OperationCanceledException)
            {
                errorMessage = "Email service timed out while delivering the verification code. Please try again.";
                errorCode = "SMTP_TIMEOUT";
                errorDetails.Add(errorMessage);
            }
            else if (isUniqueViolation)
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

            if (rateLimitEx != null)
            {
                apiResponse.RetryAfterSeconds = rateLimitEx.RetryAfterSeconds;
            }

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

        private static (bool IsMissingRelation, string? RelationName, string? SchemaName, string? Details) DetectMissingDatabaseRelation(Exception ex)
        {
            var current = ex;
            while (current != null)
            {
                if (current is PostgresException pgEx)
                {
                    if (pgEx.SqlState == "42P01") // undefined_table
                    {
                        var rel = !string.IsNullOrWhiteSpace(pgEx.TableName) ? pgEx.TableName : pgEx.MessageText;
                        return (true, rel, pgEx.SchemaName, $"Database table or relation '{rel}' does not exist in schema '{pgEx.SchemaName ?? "tenant"}'. Database migrations may need to be applied.");
                    }
                    if (pgEx.SqlState == "42703") // undefined_column
                    {
                        var col = !string.IsNullOrWhiteSpace(pgEx.ColumnName) ? pgEx.ColumnName : pgEx.MessageText;
                        return (true, col, pgEx.SchemaName, $"Database column '{col}' does not exist in schema '{pgEx.SchemaName ?? "tenant"}'. Database migrations may need to be applied.");
                    }
                }

                var msg = current.Message ?? string.Empty;
                if (msg.Contains("42P01", StringComparison.OrdinalIgnoreCase) || 
                    (msg.Contains("relation", StringComparison.OrdinalIgnoreCase) && msg.Contains("does not exist", StringComparison.OrdinalIgnoreCase)))
                {
                    return (true, "table", null, $"Database table or relation does not exist: {msg}");
                }
                if (msg.Contains("42703", StringComparison.OrdinalIgnoreCase) || 
                    (msg.Contains("column", StringComparison.OrdinalIgnoreCase) && msg.Contains("does not exist", StringComparison.OrdinalIgnoreCase)))
                {
                    return (true, "column", null, $"Database column does not exist: {msg}");
                }

                current = current.InnerException;
            }
            return (false, null, null, null);
        }

        private static bool IsUniqueConstraintViolation(Microsoft.EntityFrameworkCore.DbUpdateException ex)
        {
            var current = ex.InnerException;
            while (current != null)
            {
                if (current is PostgresException pgEx && pgEx.SqlState == "23505")
                {
                    return true;
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
