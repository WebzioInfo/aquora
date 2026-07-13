using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.API.Authorization;
using Aquora.Application.DTOs.Hierarchy;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Constants;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class HierarchyController : ApiControllerBase
    {
        private readonly IHierarchyService _hierarchyService;

        public HierarchyController(IHierarchyService _hierarchyService)
        {
            this._hierarchyService = _hierarchyService;
        }

        [HttpGet]
        [HasPermission(Permissions.HierarchyRead)]
        public async Task<ActionResult<ApiResponse<List<HierarchyNodeDto>>>> GetTree()
        {
            var result = await _hierarchyService.GetFullTreeAsync();
            return Success(result, "Hierarchy tree loaded successfully.");
        }

        [HttpPost("{type}")]
        [HasPermission(Permissions.HierarchyWrite)]
        public async Task<ActionResult<ApiResponse<HierarchyNodeDto>>> CreateNode(
            [FromRoute] string type, 
            [FromBody] HierarchyNodeDto nodeDto)
        {
            var result = await _hierarchyService.CreateNodeAsync(type, nodeDto);
            return Success(result, $"{type} node created successfully.");
        }

        [HttpPut("{type}/{id}")]
        [HasPermission(Permissions.HierarchyWrite)]
        public async Task<ActionResult<ApiResponse<HierarchyNodeDto>>> UpdateNode(
            [FromRoute] string type, 
            [FromRoute] Guid id, 
            [FromBody] HierarchyNodeDto nodeDto)
        {
            var result = await _hierarchyService.UpdateNodeAsync(id, type, nodeDto);
            return Success(result, $"{type} node updated successfully.");
        }

        [HttpDelete("{type}/{id}")]
        [HasPermission(Permissions.HierarchyWrite)]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteNode(
            [FromRoute] string type, 
            [FromRoute] Guid id)
        {
            var result = await _hierarchyService.DeleteNodeAsync(id, type);
            if (!result)
            {
                return Failure<bool>("Node not found.", $"Failed to delete {type} node.");
            }
            return Success(true, $"{type} node deleted successfully.");
        }
    }
}
