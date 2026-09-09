using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.DTOs.Hierarchy;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;

namespace Aquora.Application.Services
{
    public class HierarchyService : IHierarchyService
    {
        private readonly ITenantDbContext _context;
        private readonly ITenantProvider _tenantProvider;

        public HierarchyService(ITenantDbContext context, ITenantProvider tenantProvider)
        {
            _context = context;
            _tenantProvider = tenantProvider;
        }

        public async Task<List<HierarchyNodeDto>> GetFullTreeAsync()
        {
            var tenantId = _tenantProvider.TenantId;

            // Load all database entities in memory (filtered by TenantId automatically via Global Query Filters)
            var companies = await _context.Companies.Where(c => !c.IsDeleted).ToListAsync();
            var lines = await _context.ProductionLines.Where(l => !l.IsDeleted).ToListAsync();
            var stations = await _context.Stations.Where(s => !s.IsDeleted).ToListAsync();

            var stationDtos = stations.Select(s => new HierarchyNodeDto
            {
                Id = s.Id,
                Name = s.Name,
                Code = s.Code,
                Type = "Station",
                ParentId = s.ProductionLineId,
                IsActive = s.IsActive,
                Children = new List<HierarchyNodeDto>()
            }).ToList();

            var lineDtos = lines.Select(l => new HierarchyNodeDto
            {
                Id = l.Id,
                Name = l.Name,
                Code = l.Code,
                Type = "ProductionLine",
                ParentId = l.CompanyId,
                IsActive = l.IsActive,
                Children = stationDtos.Where(s => s.ParentId == l.Id).ToList()
            }).ToList();

            var companyDtos = companies.Select(c => new HierarchyNodeDto
            {
                Id = c.Id,
                Name = c.Name,
                Code = c.Code,
                Type = "Company",
                ParentId = null,
                IsActive = c.IsActive,
                Children = lineDtos.Where(l => l.ParentId == c.Id).ToList()
            }).ToList();

            return companyDtos;
        }

        public async Task<HierarchyNodeDto> CreateNodeAsync(string type, HierarchyNodeDto nodeDto)
        {
            var tenantId = _tenantProvider.TenantId;

            switch (type.ToLower())
            {
                case "company":
                    throw new InvalidOperationException("A tenant workspace contains exactly one company root. Additional companies cannot be created.");

                case "productionline":
                    if (nodeDto.ParentId == null) throw new ArgumentException("Parent Company ID is required.");
                    var parentCompany = await _context.Companies.FindAsync(nodeDto.ParentId.Value);
                    if (parentCompany == null) throw new KeyNotFoundException("Company not found.");
                    var line = new ProductionLine
                    {
                        Name = nodeDto.Name,
                        Code = nodeDto.Code,
                        IsActive = nodeDto.IsActive,
                        CompanyId = nodeDto.ParentId.Value,
                        TenantId = tenantId
                    };
                    _context.ProductionLines.Add(line);
                    await _context.SaveChangesAsync();
                    nodeDto.Id = line.Id;
                    break;

                case "station":
                    if (nodeDto.ParentId == null) throw new ArgumentException("Parent ProductionLine ID is required.");
                    var parentLine = await _context.ProductionLines.FindAsync(nodeDto.ParentId.Value);
                    if (parentLine == null) throw new KeyNotFoundException("ProductionLine not found.");
                    var station = new Station
                    {
                        Name = nodeDto.Name,
                        Code = nodeDto.Code,
                        IsActive = nodeDto.IsActive,
                        ProductionLineId = nodeDto.ParentId.Value,
                        CompanyId = parentLine.CompanyId,
                        TenantId = tenantId
                    };
                    _context.Stations.Add(station);
                    await _context.SaveChangesAsync();
                    nodeDto.Id = station.Id;
                    break;

                default:
                    throw new ArgumentException("Invalid node type.");
            }

            return nodeDto;
        }

        public async Task<HierarchyNodeDto> UpdateNodeAsync(Guid id, string type, HierarchyNodeDto nodeDto)
        {
            switch (type.ToLower())
            {
                case "company":
                    var company = await _context.Companies.FindAsync(id);
                    if (company == null) throw new KeyNotFoundException();
                    company.Name = nodeDto.Name;
                    company.Code = nodeDto.Code;
                    company.IsActive = nodeDto.IsActive;
                    break;

                case "productionline":
                    var line = await _context.ProductionLines.FindAsync(id);
                    if (line == null) throw new KeyNotFoundException();
                    line.Name = nodeDto.Name;
                    line.Code = nodeDto.Code;
                    line.IsActive = nodeDto.IsActive;
                    break;

                case "station":
                    var station = await _context.Stations.FindAsync(id);
                    if (station == null) throw new KeyNotFoundException();
                    station.Name = nodeDto.Name;
                    station.Code = nodeDto.Code;
                    station.IsActive = nodeDto.IsActive;
                    break;

                default:
                    throw new ArgumentException("Invalid node type.");
            }

            await _context.SaveChangesAsync();
            return nodeDto;
        }

        public async Task<bool> DeleteNodeAsync(Guid id, string type)
        {
            switch (type.ToLower())
            {
                case "company":
                    throw new InvalidOperationException("The company root cannot be deleted from the tenant workspace.");

                case "productionline":
                    var line = await _context.ProductionLines.FindAsync(id);
                    if (line == null) return false;
                    _context.ProductionLines.Remove(line);
                    break;

                case "station":
                    var station = await _context.Stations.FindAsync(id);
                    if (station == null) return false;
                    _context.Stations.Remove(station);
                    break;



                default:
                    return false;
            }

            await _context.SaveChangesAsync();
            return true;
        }
    }
}
