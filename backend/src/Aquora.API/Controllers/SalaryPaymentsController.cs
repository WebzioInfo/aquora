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

        public SalaryPaymentsController(IPayrollService payrollService)
        {
            _payrollService = payrollService;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<PagedResult<SalaryPaymentDto>>>> GetSalaryPayments(
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

                var result = await _payrollService.GetSalaryPaymentsAsync(pageNumber, pageSize, filter);
                return Success(result, "Salary payments loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<PagedResult<SalaryPaymentDto>>(ex.Message, "Failed to load salary payments.");
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ApiResponse<SalaryPaymentDetailsDto>>> GetSalaryPaymentById(Guid id)
        {
            try
            {
                var result = await _payrollService.GetSalaryPaymentByIdAsync(id);
                if (result == null)
                {
                    return NotFound(ApiResponse<SalaryPaymentDetailsDto>.CreateFailure("Salary payment not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Success(result, "Salary payment details loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<SalaryPaymentDetailsDto>(ex.Message, "Failed to load salary payment details.");
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
                return Success(true, "Salary payment deleted successfully.");
            }
            catch (Exception ex)
            {
                return Failure<bool>(ex.Message, "Failed to delete salary payment.");
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
    }
}
