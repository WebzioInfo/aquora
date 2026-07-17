using System;

namespace Aquora.Domain.Common
{
    public interface IAuditable
    {
        DateTime CreatedAt { get; set; }
        string CreatedBy { get; set; }
        string? CreatedByIP { get; set; }
        DateTime? UpdatedAt { get; set; }
        string? UpdatedBy { get; set; }
        string? UpdatedByIP { get; set; }
    }
}
