using System.Collections.Generic;

namespace Aquora.Shared.Models
{
    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public T Data { get; set; }
        public string Message { get; set; }
        public List<object> Errors { get; set; } = new List<object>();
        public string TraceId { get; set; }
        public int? RetryAfterSeconds { get; set; }
        
        private string _code;
        public string Code
        {
            get => _code ?? AutoDetermineCode(Message);
            set => _code = value;
        }

        private static string AutoDetermineCode(string msg)
        {
            if (string.IsNullOrWhiteSpace(msg)) return "UNKNOWN_ERROR";
            var msgLower = msg.ToLowerInvariant();
            if (msgLower.Contains("username is already taken") || msgLower.Contains("username already exists")) return "USERNAME_EXISTS";
            if (msgLower.Contains("email") && (msgLower.Contains("registered") || msgLower.Contains("exists") || msgLower.Contains("taken"))) return "EMAIL_EXISTS";
            if (msgLower.Contains("phone") && (msgLower.Contains("registered") || msgLower.Contains("exists"))) return "PHONE_EXISTS";
            if (msgLower.Contains("pin") || msgLower.Contains("password") || msgLower.Contains("credentials")) return "INVALID_CREDENTIALS";
            if (msgLower.Contains("permission") || msgLower.Contains("forbidden") || msgLower.Contains("authorized")) return "PERMISSION_DENIED";
            if (msgLower.Contains("not found")) return "NOT_FOUND";
            if (msgLower.Contains("stock") || msgLower.Contains("inventory")) return "INSUFFICIENT_STOCK";
            if (msgLower.Contains("already exists") || msgLower.Contains("duplicate") || msgLower.Contains("already taken")) return "DUPLICATE_RECORD";
            if (msgLower.Contains("delete") && (msgLower.Contains("referenced") || msgLower.Contains("used by other") || msgLower.Contains("cannot delete"))) return "DELETE_RESTRICTION";
            if (msgLower.Contains("validation") || msgLower.Contains("required") || msgLower.Contains("invalid")) return "VALIDATION_ERROR";
            return "ERROR";
        }

        public static ApiResponse<T> CreateSuccess(T data, string? message = null)
        {
            return new ApiResponse<T>
            {
                Success = true,
                Data = data,
                Message = message ?? "Success",
                Code = "SUCCESS"
            };
        }

        public static ApiResponse<T> CreateFailure(List<object> errors, string message = "An error occurred", string? traceId = null)
        {
            var finalMessage = message;
            if (errors != null && errors.Count > 0 && (message == "An error occurred" || message == "Validation Error" || message == "Error occurred" || string.IsNullOrWhiteSpace(message)))
            {
                var firstError = errors[0]?.ToString();
                if (!string.IsNullOrWhiteSpace(firstError))
                {
                    finalMessage = firstError;
                }
            }

            return new ApiResponse<T>
            {
                Success = false,
                Message = finalMessage,
                Errors = errors ?? new List<object>(),
                TraceId = traceId ?? string.Empty
            };
        }

        public static ApiResponse<T> CreateFailure(object error, string message = "An error occurred", string? traceId = null)
        {
            var finalMessage = message;
            var finalErrors = new List<object>();

            if (error != null)
            {
                finalErrors.Add(error);
                if (error is string errorStr && (message == "An error occurred" || message == "Validation Error" || message == "Error occurred" || string.IsNullOrWhiteSpace(message)))
                {
                    finalMessage = errorStr;
                }
            }

            return new ApiResponse<T>
            {
                Success = false,
                Message = finalMessage,
                Errors = finalErrors,
                TraceId = traceId
            };
        }
    }
}
