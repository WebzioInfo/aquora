using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.DTOs.Operations;
using Aquora.Application.Interfaces.Services;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v1/company/operations-issues")]
    [Authorize]
    public class OperationsIssueController : ControllerBase
    {
        private readonly IOperationsIssueService _issueService;

        public OperationsIssueController(IOperationsIssueService issueService)
        {
            _issueService = issueService;
        }

        [HttpGet]
        public async Task<IActionResult> GetIssues(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] string? department = null,
            [FromQuery] string? category = null,
            [FromQuery] string? priority = null,
            [FromQuery] string? status = null,
            [FromQuery] Guid? machineId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            var result = await _issueService.GetIssuesAsync(pageNumber, pageSize, search, department, category, priority, status, machineId, startDate, endDate);
            return Ok(result);
        }

        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboard()
        {
            var dashboard = await _issueService.GetDashboardAsync();
            return Ok(dashboard);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetIssueById(Guid id)
        {
            var issue = await _issueService.GetIssueByIdAsync(id);
            if (issue == null) return NotFound();
            return Ok(issue);
        }

        [HttpPost]
        public async Task<IActionResult> CreateIssue([FromBody] CreateOperationsIssueRequest request)
        {
            var issue = await _issueService.CreateIssueAsync(request);
            return CreatedAtAction(nameof(GetIssueById), new { id = issue.Id }, issue);
        }

        [HttpPost("quick-report")]
        public async Task<IActionResult> QuickOperatorReport([FromBody] QuickOperatorReportRequest request)
        {
            var issue = await _issueService.QuickOperatorReportAsync(request);
            return CreatedAtAction(nameof(GetIssueById), new { id = issue.Id }, issue);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateIssue(Guid id, [FromBody] UpdateOperationsIssueRequest request)
        {
            var issue = await _issueService.UpdateIssueAsync(id, request);
            if (issue == null) return NotFound();
            return Ok(issue);
        }

        [HttpPost("{id}/status")]
        public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] ChangeIssueStatusRequest request)
        {
            var issue = await _issueService.ChangeStatusAsync(id, request);
            if (issue == null) return NotFound();
            return Ok(issue);
        }

        [HttpPost("{id}/assign")]
        public async Task<IActionResult> AssignIssue(Guid id, [FromBody] AssignIssueRequest request)
        {
            var issue = await _issueService.AssignIssueAsync(id, request);
            if (issue == null) return NotFound();
            return Ok(issue);
        }

        [HttpPost("{id}/comments")]
        public async Task<IActionResult> AddComment(Guid id, [FromBody] AddIssueCommentRequest request)
        {
            var comment = await _issueService.AddCommentAsync(id, request);
            if (comment == null) return NotFound();
            return Ok(comment);
        }

        [HttpPost("{id}/resolve")]
        public async Task<IActionResult> ResolveIssue(Guid id, [FromBody] ResolveIssueRequest request)
        {
            var issue = await _issueService.ResolveIssueAsync(id, request);
            if (issue == null) return NotFound();
            return Ok(issue);
        }

        [HttpPost("{id}/verify")]
        public async Task<IActionResult> VerifyAndCloseIssue(Guid id, [FromBody] string? note)
        {
            var issue = await _issueService.VerifyAndCloseIssueAsync(id, note);
            if (issue == null) return NotFound();
            return Ok(issue);
        }

        [HttpPost("{id}/create-work-order")]
        public async Task<IActionResult> CreateWorkOrder(Guid id)
        {
            var issue = await _issueService.CreateMaintenanceWorkOrderAsync(id);
            if (issue == null) return NotFound();
            return Ok(issue);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteIssue(Guid id)
        {
            var success = await _issueService.DeleteIssueAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}
