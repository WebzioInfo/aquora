using System;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Operations;

namespace Aquora.Application.Interfaces.Services
{
    public interface IOperationsIssueNotificationService
    {
        Task PublishIssueCreatedAsync(Guid tenantId, OperationsIssueDto issue);
        Task PublishIssueUpdatedAsync(Guid tenantId, OperationsIssueDto issue, string eventType = "operations-issue-updated");
    }
}
