using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.API.Controllers;
using Aquora.Application.DTOs.Payroll;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class SalaryPaymentsController : ApiControllerBase
    {
        private readonly IPayrollService _payrollService;
        private readonly Microsoft.Extensions.Logging.ILogger<SalaryPaymentsController> _logger;

        public SalaryPaymentsController(
            IPayrollService payrollService,
            Microsoft.Extensions.Logging.ILogger<SalaryPaymentsController> logger)
        {
            _payrollService = payrollService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<PagedResult<MonthlySalaryDirectoryDto>>>> GetSalaryPayments(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] string? month = null,
            [FromQuery] Guid? employeeId = null)
        {
            try
            {
                var filter = new PayrollFilterDto
                {
                    Search = search,
                    Month = month,
                    EmployeeId = employeeId
                };

                var result = await _payrollService.GetMonthlySalariesAsync(pageNumber, pageSize, filter);
                return Success(result, "Monthly salary entitlements loaded successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load monthly salary entitlements.");
                return Failure<PagedResult<MonthlySalaryDirectoryDto>>(ex.Message, "Failed to load monthly salary entitlements.");
            }
        }

        [HttpGet("metrics")]
        public async Task<ActionResult<ApiResponse<PayrollDashboardMetricsDto>>> GetPayrollMetrics([FromQuery] string? month = null)
        {
            try
            {
                var result = await _payrollService.GetPayrollDashboardMetricsAsync(month);
                return Success(result, "Payroll metrics loaded successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load payroll metrics.");
                return Failure<PayrollDashboardMetricsDto>(ex.Message, "Failed to load payroll metrics.");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<MonthlySalaryDetailsDto>>> GetSalaryPaymentById(Guid id)
        {
            try
            {
                var result = await _payrollService.GetMonthlySalaryByIdAsync(id);
                if (result == null)
                {
                    return NotFound(ApiResponse<MonthlySalaryDetailsDto>.CreateFailure("Monthly salary entitlement record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Success(result, "Monthly salary entitlement details loaded successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load monthly salary entitlement details for id {Id}.", id);
                return Failure<MonthlySalaryDetailsDto>(ex.Message, "Failed to load monthly salary entitlement details.");
            }
        }

        [HttpPost("entitlement")]
        [HttpPost("entitlements")]
        public async Task<ActionResult<ApiResponse<MonthlySalaryDetailsDto>>> CreateOrGetMonthlySalary([FromBody] CreateOrGetMonthlySalaryRequest request)
        {
            try
            {
                var result = await _payrollService.GetOrCreateMonthlySalaryAsync(request);
                return Success(result, "Monthly salary entitlement record processed successfully.");
            }
            catch (ArgumentException ex)
            {
                return Failure<MonthlySalaryDetailsDto>(ex.Message, "Validation Error");
            }
            catch (InvalidOperationException ex)
            {
                return Failure<MonthlySalaryDetailsDto>(ex.Message, "Validation Error");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process monthly salary entitlement.");
                return Failure<MonthlySalaryDetailsDto>(ex.Message, "Failed to process monthly salary entitlement.");
            }
        }

        [HttpPost("pay")]
        public async Task<ActionResult<ApiResponse<SalaryPaymentTransactionDto>>> ProcessSalaryPayment([FromBody] ProcessSalaryPaymentRequest request)
        {
            try
            {
                var result = await _payrollService.ProcessSalaryPaymentAsync(request);
                return Success(result, "Salary payment processed successfully.");
            }
            catch (ArgumentException ex)
            {
                return Failure<SalaryPaymentTransactionDto>(ex.Message, "Validation Error");
            }
            catch (InvalidOperationException ex)
            {
                return Failure<SalaryPaymentTransactionDto>(ex.Message, "Validation Error");
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<SalaryPaymentTransactionDto>.CreateFailure(ex.Message, "Not Found", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process salary payment for TraceId: {TraceId}", HttpContext.TraceIdentifier);
                return Failure<SalaryPaymentTransactionDto>(ex.Message, "Failed to process salary payment.");
            }
        }

        [HttpPost("finalize")]
        public async Task<ActionResult<ApiResponse<MonthlySalaryDetailsDto>>> FinalizeMonthlySalary([FromBody] FinalizeMonthlySalaryRequest request)
        {
            try
            {
                var result = await _payrollService.FinalizeMonthlySalaryAsync(request);
                return Success(result, "Payroll month finalized and closed successfully.");
            }
            catch (ArgumentException ex)
            {
                return Failure<MonthlySalaryDetailsDto>(ex.Message, "Validation Error");
            }
            catch (InvalidOperationException ex)
            {
                return Failure<MonthlySalaryDetailsDto>(ex.Message, "Validation Error");
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<MonthlySalaryDetailsDto>.CreateFailure(ex.Message, "Not Found", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to finalize payroll month for TraceId: {TraceId}", HttpContext.TraceIdentifier);
                return Failure<MonthlySalaryDetailsDto>(ex.Message, "Failed to finalize payroll month.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<SalaryPaymentDto>>> CreateSalaryPayment([FromBody] CreateSalaryPaymentRequest request)
        {
            try
            {
                var result = await _payrollService.CreateSalaryPaymentAsync(request);
                return Success(result, "Salary payment generated successfully.");
            }
            catch (ArgumentException ex)
            {
                return Failure<SalaryPaymentDto>(ex.Message, "Validation Error");
            }
            catch (Exception ex)
            {
                return Failure<SalaryPaymentDto>(ex.Message, "Failed to generate salary payment.");
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<ApiResponse<SalaryPaymentDto>>> UpdateSalaryPayment(Guid id, [FromBody] UpdateSalaryPaymentRequest request)
        {
            try
            {
                var result = await _payrollService.UpdateSalaryPaymentAsync(id, request);
                return Success(result, "Salary payment updated successfully.");
            }
            catch (ArgumentException ex)
            {
                return Failure<SalaryPaymentDto>(ex.Message, "Validation Error");
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<SalaryPaymentDto>.CreateFailure(ex.Message, "Not Found", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                return Failure<SalaryPaymentDto>(ex.Message, "Failed to update salary payment.");
            }
        }

        [HttpPut("transactions/{transactionId:guid}")]
        public async Task<ActionResult<ApiResponse<SalaryPaymentTransactionDto>>> UpdateSalaryPaymentTransaction(Guid transactionId, [FromBody] UpdateSalaryPaymentTransactionRequest request)
        {
            try
            {
                var result = await _payrollService.UpdateSalaryPaymentTransactionAsync(transactionId, request);
                return Success(result, "Salary payment transaction updated successfully.");
            }
            catch (ArgumentException ex)
            {
                return Failure<SalaryPaymentTransactionDto>(ex.Message, "Validation Error");
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<SalaryPaymentTransactionDto>.CreateFailure(ex.Message, "Not Found", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                return Failure<SalaryPaymentTransactionDto>(ex.Message, "Failed to update salary payment transaction.");
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteSalaryPayment(Guid id)
        {
            try
            {
                var result = await _payrollService.DeleteSalaryPaymentAsync(id);
                if (!result)
                {
                    return NotFound(ApiResponse<bool>.CreateFailure("Salary payment not found or failed to delete.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Success(true, "Salary payment transaction reversed successfully.");
            }
            catch (Exception ex)
            {
                return Failure<bool>(ex.Message, "Failed to delete salary payment.");
            }
        }

        [HttpDelete("transactions/{transactionId:guid}")]
        public async Task<ActionResult<ApiResponse<bool>>> ReverseSalaryPaymentTransaction(Guid transactionId)
        {
            try
            {
                var result = await _payrollService.ReverseSalaryPaymentTransactionAsync(transactionId);
                if (!result)
                {
                    return NotFound(ApiResponse<bool>.CreateFailure("Salary payment transaction not found or failed to reverse.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Success(true, "Salary payment transaction reversed successfully.");
            }
            catch (Exception ex)
            {
                return Failure<bool>(ex.Message, "Failed to reverse salary payment transaction.");
            }
        }

        [HttpGet("{id:guid}/history")]
        public async Task<ActionResult<ApiResponse<System.Collections.Generic.List<Aquora.Application.DTOs.SimpleAccounts.BankLedgerAuditEntryDto>>>> GetSalaryPaymentHistory(Guid id)
        {
            try
            {
                var result = await _payrollService.GetSalaryPaymentHistoryAsync(id);
                return Success(result, "Salary payment audit history loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<System.Collections.Generic.List<Aquora.Application.DTOs.SimpleAccounts.BankLedgerAuditEntryDto>>(ex.Message, "Failed to load salary payment audit history.");
            }
        }

        [HttpGet("employees/{employeeId:guid}/statement")]
        public async Task<ActionResult<ApiResponse<EmployeeSalaryStatementReportDto>>> GetEmployeeSalaryStatement(
            Guid employeeId,
            [FromQuery] string? month = null)
        {
            try
            {
                var result = await _payrollService.GetEmployeeSalaryStatementReportAsync(employeeId, month);
                return Success(result, "Employee salary statement and history loaded successfully.");
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<EmployeeSalaryStatementReportDto>.CreateFailure(ex.Message, "Not Found", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load employee salary statement for employee {EmployeeId}", employeeId);
                return Failure<EmployeeSalaryStatementReportDto>(ex.Message, "Failed to load employee salary statement.");
            }
        }
    }
}
