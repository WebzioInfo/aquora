using System;

namespace Aquora.Application.DTOs.Employees
{
    public class EmployeeDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; }
        public string Username { get; set; }
        public string RoleName { get; set; }
        public string RoleCode { get; set; }
        public string Department { get; set; }
        public decimal CurrentSalary { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastLogin { get; set; }
    }
}
