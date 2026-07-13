using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.Hierarchy
{
    public class HierarchyNodeDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string Code { get; set; }
        public string Type { get; set; } // Company, Plant, Department, ProductionLine, Station, Machine
        public Guid? ParentId { get; set; }
        public bool IsActive { get; set; }
        public List<HierarchyNodeDto> Children { get; set; } = new List<HierarchyNodeDto>();
    }
}
