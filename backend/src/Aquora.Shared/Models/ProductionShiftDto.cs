using System;

namespace Aquora.Shared.Models
{
    public class ProductionShiftDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string StartTime { get; set; }
        public string EndTime { get; set; }
        public bool IsActive { get; set; }
        public Guid TenantId { get; set; }
        public DateTime CreatedAt { get; set; }
    }
    
    public class CreateProductionShiftDto
    {
        public string Name { get; set; }
        public string StartTime { get; set; }
        public string EndTime { get; set; }
        public bool IsActive { get; set; } = true;
    }
    
    public class UpdateProductionShiftDto
    {
        public string Name { get; set; }
        public string StartTime { get; set; }
        public string EndTime { get; set; }
        public bool IsActive { get; set; }
    }
}
