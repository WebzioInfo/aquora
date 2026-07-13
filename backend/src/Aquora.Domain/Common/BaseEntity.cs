using System;

namespace Aquora.Domain.Common
{
    public abstract class BaseEntity<TId>
    {
        public TId Id { get; set; }
    }

    public abstract class BaseEntity : BaseEntity<Guid>
    {
        protected BaseEntity()
        {
            Id = Guid.NewGuid();
        }
    }
}
