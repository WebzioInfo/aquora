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
            var machines = await _context.Machines.Where(m => !m.IsDeleted).ToListAsync();

            // Project to DTOs
            var machineDtos = machines.Select(m => new HierarchyNodeDto
            {
                Id = m.Id,
                Name = m.Name,
                Code = m.Code,
                Type = "Machine",
                ParentId = m.StationId,
                IsActive = m.IsActive
            }).ToList();

            var stationDtos = stations.Select(s => new HierarchyNodeDto
            {
                Id = s.Id,
                Name = s.Name,
                Code = s.Code,
                Type = "Station",
                ParentId = s.ProductionLineId,
                IsActive = s.IsActive,
                Children = machineDtos.Where(m => m.ParentId == s.Id).ToList()
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
                    var company = new Company
                    {
                        Name = nodeDto.Name,
                        Code = nodeDto.Code,
                        IsActive = nodeDto.IsActive,
                        TenantId = tenantId
                    };
                    _context.Companies.Add(company);
                    await _context.SaveChangesAsync();
                    nodeDto.Id = company.Id;
                    break;

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

                case "machine":
                    if (nodeDto.ParentId == null) throw new ArgumentException("Parent Station ID is required.");
                    var parentStation = await _context.Stations.FindAsync(nodeDto.ParentId.Value);
                    if (parentStation == null) throw new KeyNotFoundException("Station not found.");
                    var machine = new Machine
                    {
                        Name = nodeDto.Name,
                        Code = nodeDto.Code,
                        IsActive = nodeDto.IsActive,
                        StationId = nodeDto.ParentId.Value,
                        CompanyId = parentStation.CompanyId,
                        TenantId = tenantId
                    };
                    _context.Machines.Add(machine);
                    await _context.SaveChangesAsync();
                    nodeDto.Id = machine.Id;
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

                case "machine":
                    var machine = await _context.Machines.FindAsync(id);
                    if (machine == null) throw new KeyNotFoundException();
                    machine.Name = nodeDto.Name;
                    machine.Code = nodeDto.Code;
                    machine.IsActive = nodeDto.IsActive;
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
                    var company = await _context.Companies.FindAsync(id);
                    if (company == null) return false;
                    _context.Companies.Remove(company);
                    break;

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

                case "machine":
                    var machine = await _context.Machines.FindAsync(id);
                    if (machine == null) return false;
                    _context.Machines.Remove(machine);
                    break;

                default:
                    return false;
            }

            await _context.SaveChangesAsync();
            return true;
        }
    }
}
