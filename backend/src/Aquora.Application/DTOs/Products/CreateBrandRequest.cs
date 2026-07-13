using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Products
{
    public class CreateBrandRequest
    {
        [Required(ErrorMessage = "Brand name is required")]
        [MaxLength(150, ErrorMessage = "Brand name cannot exceed 150 characters")]
        public string Name { get; set; } = string.Empty;

        [MaxLength(50, ErrorMessage = "Brand code cannot exceed 50 characters")]
        public string? Code { get; set; }

        [MaxLength(500, ErrorMessage = "Description cannot exceed 500 characters")]
        public string? Description { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
