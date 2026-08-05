using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Operations
{
    public class OperationsIssueComment : BaseEntity
    {
        public Guid IssueId { get; set; }
        public virtual OperationsIssue Issue { get; set; } = null!;

        public string AuthorId { get; set; } = string.Empty;
        public string AuthorName { get; set; } = string.Empty;
        public string AuthorRole { get; set; } = string.Empty;

        public string Message { get; set; } = string.Empty;
        public string? AttachmentUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
