using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.DTOs.Operations;
using Aquora.Application.Interfaces.Services;

using Microsoft.AspNetCore.SignalR;
using Aquora.API.Hubs;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v1/company/operations-issues")]
    [Authorize]
    public class OperationsIssueController : ControllerBase
    {
        private readonly IOperationsIssueService _issueService;
        private readonly IHubContext<DashboardHub> _dashboardHub;

        public OperationsIssueController(
            IOperationsIssueService issueService,
            IHubContext<DashboardHub> dashboardHub)
        {
            _issueService = issueService;
            _dashboardHub = dashboardHub;
        }

        private async Task NotifyIssueUpdatedAsync(string eventName = "operations-issue-updated")
        {
            try
            {
                await _dashboardHub.Clients.All.SendAsync("DashboardEvent", new
                {
                    event_type = eventName,
                    timestamp = DateTime.UtcNow
                });
            }
            catch { /* Ignore SignalR broadcast error */ }
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
            await NotifyIssueUpdatedAsync("operations-issue-created");
            return CreatedAtAction(nameof(GetIssueById), new { id = issue.Id }, issue);
        }

        [HttpPost("quick-report")]
        public async Task<IActionResult> QuickOperatorReport([FromBody] QuickOperatorReportRequest request)
        {
            var issue = await _issueService.QuickOperatorReportAsync(request);
            await NotifyIssueUpdatedAsync("operations-issue-created");
            return CreatedAtAction(nameof(GetIssueById), new { id = issue.Id }, issue);
        }

        [HttpPost("batch-report")]
        public async Task<IActionResult> ReportOperatorBatchIssue([FromBody] OperatorBatchReportIssueRequest request)
        {
            var issue = await _issueService.ReportOperatorBatchIssueAsync(request);
            await NotifyIssueUpdatedAsync("operations-issue-created");
            return CreatedAtAction(nameof(GetIssueById), new { id = issue.Id }, issue);
        }

        [HttpGet("batch/{batchNumber}")]
        public async Task<IActionResult> GetIssuesForBatch(string batchNumber)
        {
            var issues = await _issueService.GetIssuesForBatchAsync(batchNumber);
            return Ok(issues);
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

        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var count = await _issueService.GetUnreadCountAsync();
            return Ok(new { unreadCount = count });
        }

        [HttpGet("latest-notifications")]
        public async Task<IActionResult> GetLatestNotifications([FromQuery] int take = 5)
        {
            var notifications = await _issueService.GetLatestNotificationsAsync(take);
            return Ok(notifications);
        }

        [HttpPost("{id}/mark-read")]
        public async Task<IActionResult> MarkIssueAsRead(Guid id)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "system";
            var userName = User.FindFirst("name")?.Value ?? User.Identity?.Name ?? "Admin User";
            var success = await _issueService.MarkIssueAsReadAsync(id, userId, userName);
            if (!success) return NotFound();
            await NotifyIssueUpdatedAsync("operations-issue-read");
            return Ok(new { message = "Issue marked as read." });
        }

        [HttpPost("mark-all-read")]
        public async Task<IActionResult> MarkAllIssuesAsRead()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "system";
            var userName = User.FindFirst("name")?.Value ?? User.Identity?.Name ?? "Admin User";
            var count = await _issueService.MarkAllIssuesAsReadAsync(userId, userName);
            await NotifyIssueUpdatedAsync("operations-issue-read");
            return Ok(new { message = $"{count} issues marked as read.", count });
        }
    }
}
