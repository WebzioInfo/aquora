using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Operations
{
    public class OperationsIssueAffectedMachine : BaseEntity
    {
        public Guid IssueId { get; set; }
        public virtual OperationsIssue Issue { get; set; } = null!;

        public Guid MachineId { get; set; }
        public string MachineName { get; set; } = string.Empty;
        public string? MachineCode { get; set; }
    }
}
