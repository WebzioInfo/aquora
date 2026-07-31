using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class SubscriptionPlanLimits : BaseEntity
    {
        public Guid PlanId { get; set; }
        public virtual SubscriptionPlan? Plan { get; set; }

        public int ProductionLines { get; set; } = 3; // -1 for unlimited
        public int Machines { get; set; } = 10;
        public int Employees { get; set; } = 25;
        public int Customers { get; set; } = 100;
        public int Suppliers { get; set; } = 50;
        public int Warehouses { get; set; } = 2;
        public int ProductionBatches { get; set; } = 500;
        public int Products { get; set; } = 100;
        public int RawMaterials { get; set; } = 200;
        public int StorageGB { get; set; } = 50;
        public int APIRequestsPerMin { get; set; } = 1000;
        public int FileUploadSizeMB { get; set; } = 25;
        public int DailyExports { get; set; } = 50;
        public int ConcurrentUsers { get; set; } = 10;
        public int SMSLimit { get; set; } = 100;
        public int EmailLimit { get; set; } = 1000;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
