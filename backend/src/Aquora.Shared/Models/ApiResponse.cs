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

        public static ApiResponse<T> CreateSuccess(T data, string message = null)
        {
            return new ApiResponse<T>
            {
                Success = true,
                Data = data,
                Message = message
            };
        }

        public static ApiResponse<T> CreateFailure(List<object> errors, string message = "An error occurred", string traceId = null)
        {
            return new ApiResponse<T>
            {
                Success = false,
                Message = message,
                Errors = errors ?? new List<object>(),
                TraceId = traceId
            };
        }

        public static ApiResponse<T> CreateFailure(object error, string message = "An error occurred", string traceId = null)
        {
            return new ApiResponse<T>
            {
                Success = false,
                Message = message,
                Errors = new List<object> { error },
                TraceId = traceId
            };
        }
    }
}
