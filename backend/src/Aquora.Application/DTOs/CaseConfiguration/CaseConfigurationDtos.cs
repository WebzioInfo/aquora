using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.CaseConfiguration
{
    public class CaseConfigurationDto
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? ProductSku { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int UnitsPerCase { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreateCaseConfigurationDto
    {
        [Required(ErrorMessage = "Product is required.")]
        public Guid ProductId { get; set; }

        public string? Name { get; set; }

        public string? Description { get; set; }

        [Required(ErrorMessage = "Units per case is required.")]
        [Range(1, 100000, ErrorMessage = "Bottles per case must be a positive integer greater than 0.")]
        public int UnitsPerCase { get; set; }

        public bool IsActive { get; set; } = true;
    }

    public class UpdateCaseConfigurationDto
    {
        public Guid? ProductId { get; set; }

        public string? Name { get; set; }

        public string? Description { get; set; }

        [Required(ErrorMessage = "Units per case is required.")]
        [Range(1, 100000, ErrorMessage = "Bottles per case must be a positive integer greater than 0.")]
        public int UnitsPerCase { get; set; }

        public bool? IsActive { get; set; }
    }
}
