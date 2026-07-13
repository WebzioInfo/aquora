using System;

namespace Aquora.Domain.Common
{
    public interface ICompanySpecific
    {
        Guid CompanyId { get; set; }
    }
}
