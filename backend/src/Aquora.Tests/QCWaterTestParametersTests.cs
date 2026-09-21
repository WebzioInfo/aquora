using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using Aquora.Application.DTOs.QC;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.QC;
using Aquora.Persistence.Context;
using Aquora.Persistence.Services;

namespace Aquora.Tests
{
    public class QCWaterTestParametersTests
    {
        private TenantDbContext CreateInMemoryTenantContext(Guid tenantId, string schemaName = "tenant_test")
        {
            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns(schemaName);

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(c => c.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());
            mockCurrentUser.Setup(c => c.Email).Returns("qc@aquora.com");
            mockCurrentUser.Setup(c => c.Roles).Returns(new List<string> { "QC", "CompanyAdmin" });

            return new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUser.Object);
        }

        [Fact]
        public void QCDefaultParameters_Catalog_ShouldHaveExact17CanonicalParameters()
        {
            var catalog = QCDefaultParameters.Catalog;

            Assert.Equal(17, catalog.Count);

            var physChem = catalog.Where(p => p.Category == "PHYSICAL" || p.Category == "CHEMICAL").ToList();
            Assert.Equal(10, physChem.Count);

            var micro = catalog.Where(p => p.Category == "MICROBIOLOGY").ToList();
            Assert.Equal(7, micro.Count);

            // Verify all 10 Physical/Chemical names
            var expectedPhysChem = new[]
            {
                "pH", "TDS", "Turbidity", "Sulphate", "Colour", "Odour", "Taste",
                "Residual Free Chlorine", "Alkalinity", "Chloride"
            };
            foreach (var name in expectedPhysChem)
            {
                Assert.Contains(physChem, p => p.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            }

            // Verify all 7 Microbiological names
            var expectedMicro = new[]
            {
                "E.coli", "Coliform", "Pseudomonas", "Clostridia",
                "Aerobic Microbial Count 22°C", "Aerobic Microbial Count 37°C", "Yeast & Mold"
            };
            foreach (var name in expectedMicro)
            {
                Assert.Contains(micro, p => p.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            }
        }

        [Fact]
        public async Task QCDataSeeder_OnEmptyTenantSchema_ShouldSeedAll17ParametersAndQCSettings()
        {
            var tenantId = Guid.NewGuid();
            using var context = CreateInMemoryTenantContext(tenantId);

            var company = new Company
            {
                Id = Guid.NewGuid(),
                Name = "Gangothri Water",
                Code = "GANGOTHRI",
                TenantId = tenantId,
                IsActive = true
            };
            context.Companies.Add(company);
            await context.SaveChangesAsync();

            var addedCount = await QCDataSeeder.SeedQCDefaultParametersAsync(context, "Test Seeder");

            Assert.Equal(17, addedCount);
            var seededParams = await context.WaterTestParameters.ToListAsync();
            Assert.Equal(17, seededParams.Count);
            Assert.All(seededParams, p => Assert.True(p.IsActive));

            var settings = await context.QCSettings.FirstOrDefaultAsync();
            Assert.NotNull(settings);
            Assert.Equal(tenantId, settings.TenantId);
            Assert.Equal(company.Id, settings.CompanyId);
        }

        [Fact]
        public async Task QCDataSeeder_OnExistingTenantSchema_ShouldBeIdempotentAndPreventDuplicates()
        {
            var tenantId = Guid.NewGuid();
            using var context = CreateInMemoryTenantContext(tenantId);

            var company = new Company
            {
                Id = Guid.NewGuid(),
                Name = "Gangothri Water",
                Code = "GANGOTHRI",
                TenantId = tenantId,
                IsActive = true
            };
            context.Companies.Add(company);
            await context.SaveChangesAsync();

            // Run 1: seeds 17
            var count1 = await QCDataSeeder.SeedQCDefaultParametersAsync(context, "Run 1");
            Assert.Equal(17, count1);

            // Run 2: seeds 0, no duplicates
            var count2 = await QCDataSeeder.SeedQCDefaultParametersAsync(context, "Run 2");
            Assert.Equal(0, count2);

            var totalParams = await context.WaterTestParameters.ToListAsync();
            Assert.Equal(17, totalParams.Count);
        }

        [Fact]
        public async Task QCDataSeeder_OnIncompleteOrDefectiveParameters_ShouldRepairMetadataSafely()
        {
            var tenantId = Guid.NewGuid();
            using var context = CreateInMemoryTenantContext(tenantId);

            // Simulate broken tenant parameter with missing unit and wrong category
            context.WaterTestParameters.Add(new WaterTestParameter
            {
                Id = Guid.NewGuid(),
                Name = "TDS",
                Category = "PHYSICAL",
                Unit = "—", // Broken unit
                MinAcceptable = null,
                MaxAcceptable = null,
                IsActive = false // Inactive
            });
            await context.SaveChangesAsync();

            var addedCount = await QCDataSeeder.SeedQCDefaultParametersAsync(context, "Repair");

            Assert.Equal(16, addedCount); // 1 repaired + 16 new = 17 total

            var tds = await context.WaterTestParameters.FirstOrDefaultAsync(p => p.Name == "TDS");
            Assert.NotNull(tds);
            Assert.True(tds.IsActive);
            Assert.Equal("mg/L", tds.Unit);
            Assert.Equal(0, tds.MinAcceptable);
            Assert.Equal(500, tds.MaxAcceptable);

            var totalParams = await context.WaterTestParameters.ToListAsync();
            Assert.Equal(17, totalParams.Count);
        }

        [Fact]
        public async Task TenantDatabaseService_ProvisionTenant_ShouldAutomaticallySeedAll17QCParameters()
        {
            var tenantId = Guid.NewGuid();
            var schemaName = "aquora_tenant_future_test";

            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns(schemaName);

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(c => c.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());
            mockCurrentUser.Setup(c => c.Email).Returns("owner@test.com");
            mockCurrentUser.Setup(c => c.Roles).Returns(new List<string> { "Owner" });

            using var tenantContext = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUser.Object);

            var platformOptions = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            using var platformContext = new PlatformDbContext(platformOptions);

            var mockScopeFactory = new Mock<IServiceScopeFactory>();
            var mockScope = new Mock<IServiceScope>();
            var mockServiceProvider = new Mock<IServiceProvider>();

            mockServiceProvider.Setup(sp => sp.GetService(typeof(TenantDbContext))).Returns(tenantContext);
            mockServiceProvider.Setup(sp => sp.GetService(typeof(ITenantDbContext))).Returns(tenantContext);
            mockServiceProvider.Setup(sp => sp.GetService(typeof(ITenantProvider))).Returns(mockTenantProvider.Object);
            mockScope.Setup(s => s.ServiceProvider).Returns(mockServiceProvider.Object);
            mockScopeFactory.Setup(sf => sf.CreateScope()).Returns(mockScope.Object);

            var service = new TenantDatabaseService(platformContext, mockScopeFactory.Object);

            var result = await service.ProvisionTenantAsync(
                tenantId,
                schemaName,
                "Future Water Co",
                "FUTURE",
                Guid.NewGuid()
            );

            Assert.NotNull(result);

            var paramsInTenant = await tenantContext.WaterTestParameters.ToListAsync();
            Assert.Equal(17, paramsInTenant.Count);

            var settings = await tenantContext.QCSettings.FirstOrDefaultAsync();
            Assert.NotNull(settings);
        }

        [Fact]
        public async Task WaterTestService_GetWaterTestParameters_ShouldReturnAll17ParametersInCorrectCatalogOrder()
        {
            var tenantId = Guid.NewGuid();
            using var tenantContext = CreateInMemoryTenantContext(tenantId, "aquora_tenant_gangothri_2");

            var company = new Company
            {
                Id = Guid.NewGuid(),
                Name = "Gangothri Packaged Drinking Water",
                Code = "GANGOTHRI",
                TenantId = tenantId,
                IsActive = true
            };
            tenantContext.Companies.Add(company);
            await tenantContext.SaveChangesAsync();

            var platformOptions = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            using var platformContext = new PlatformDbContext(platformOptions);

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("aquora_tenant_gangothri_2");

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(c => c.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());

            var evalService = new QualityEvaluationService();
            var mockPdf = new Mock<IQCPdfCertificateService>();
            var mockLogger = new Mock<ILogger<WaterTestService>>();

            var waterTestService = new WaterTestService(
                tenantContext,
                platformContext,
                mockTenantProvider.Object,
                mockCurrentUser.Object,
                evalService,
                mockPdf.Object,
                mockLogger.Object
            );

            // Act: Call GetWaterTestParametersAsync (auto-seeds if missing)
            var parameters = await waterTestService.GetWaterTestParametersAsync();

            // Assert
            Assert.Equal(17, parameters.Count);
            Assert.Equal("pH", parameters[0].Name);
            Assert.Equal("TDS", parameters[1].Name);
            Assert.Equal("Turbidity", parameters[2].Name);
            Assert.Equal("Sulphate", parameters[3].Name);
            Assert.Equal("Colour", parameters[4].Name);
            Assert.Equal("Odour", parameters[5].Name);
            Assert.Equal("Taste", parameters[6].Name);
            Assert.Equal("Residual Free Chlorine", parameters[7].Name);
            Assert.Equal("Alkalinity", parameters[8].Name);
            Assert.Equal("Chloride", parameters[9].Name);
            Assert.Equal("E.coli", parameters[10].Name);
            Assert.Equal("Coliform", parameters[11].Name);
            Assert.Equal("Pseudomonas", parameters[12].Name);
            Assert.Equal("Clostridia", parameters[13].Name);
            Assert.Equal("Aerobic Microbial Count 22°C", parameters[14].Name);
            Assert.Equal("Aerobic Microbial Count 37°C", parameters[15].Name);
            Assert.Equal("Yeast & Mold", parameters[16].Name);
        }

        [Fact]
        public async Task TenantRepair_For_aquora_tenant_gangothri_2_ShouldSeedCompleteParametersDirectly()
        {
            var tenantId = Guid.NewGuid();
            using var tenantContext = CreateInMemoryTenantContext(tenantId, "aquora_tenant_gangothri_2");

            var company = new Company
            {
                Id = Guid.NewGuid(),
                Name = "Gangothri 2",
                Code = "GANGOTHRI2",
                TenantId = tenantId,
                IsActive = true
            };
            tenantContext.Companies.Add(company);
            await tenantContext.SaveChangesAsync();

            // Seed into current tenant schema only
            var seededCount = await QCDataSeeder.SeedQCDefaultParametersAsync(tenantContext, "CurrentTenantRepair_Gangothri_2");

            Assert.Equal(17, seededCount);

            var parameters = await tenantContext.WaterTestParameters.ToListAsync();
            Assert.Equal(17, parameters.Count);
            Assert.Equal(10, parameters.Count(p => p.Category == "PHYSICAL" || p.Category == "CHEMICAL"));
            Assert.Equal(7, parameters.Count(p => p.Category == "MICROBIOLOGY"));
        }

        [Fact]
        public void QualityEvaluationService_FourTierLimits_ShouldEvaluateExactSpecificationValues()
        {
            var evaluationService = new QualityEvaluationService();
            var parameter = new WaterTestParameter
            {
                Id = Guid.NewGuid(),
                Name = "Custom Test Parameter",
                Category = "PHYSICAL",
                Unit = "mg/L",
                MinWarning = 100,
                MinAcceptable = 150,
                MaxAcceptable = 200,
                MaxWarning = 250,
                IsActive = true
            };

            // Test exact 9 required boundary values:
            // 99 => FAIL
            Assert.Equal("FAIL", evaluationService.EvaluateParameter(parameter, 99, null));

            // 100 => WARNING (inclusive boundary: value >= MinWarning && value < MinAcceptable)
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 100, null));

            // 149 => WARNING
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 149, null));

            // 150 => PASS (inclusive boundary: value >= MinAcceptable && value <= MaxAcceptable)
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 150, null));

            // 175 => PASS
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 175, null));

            // 200 => PASS
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 200, null));

            // 201 => WARNING (value > MaxAcceptable && value <= MaxWarning)
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 201, null));

            // 250 => WARNING (inclusive upper warning boundary)
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 250, null));

            // 251 => FAIL (value > MaxWarning)
            Assert.Equal("FAIL", evaluationService.EvaluateParameter(parameter, 251, null));
        }

        [Fact]
        public void QualityEvaluationService_PhWarningRange_ShouldEvaluateSixAsWarning()
        {
            var evaluationService = new QualityEvaluationService();
            var parameter = new WaterTestParameter
            {
                Id = Guid.NewGuid(),
                Name = "pH",
                Category = "PHYSICAL",
                Unit = "—",
                MinWarning = 5.5,
                MinAcceptable = 6.8,
                MaxAcceptable = 8.5,
                MaxWarning = 9.0,
                IsActive = true
            };

            // value < 5.5 => FAIL
            Assert.Equal("FAIL", evaluationService.EvaluateParameter(parameter, 5.4, null));

            // value >= 5.5 and value < 6.8 => WARNING (entering 6 must show WARNING)
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 5.5, null));
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 6.0, null));
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 6.79, null));

            // value >= 6.8 and value <= 8.5 => PASS
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 6.8, null));
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 7.5, null));
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 8.5, null));

            // value > 8.5 and value <= 9.0 => WARNING
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 8.51, null));
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 9.0, null));

            // value > 9.0 => FAIL
            Assert.Equal("FAIL", evaluationService.EvaluateParameter(parameter, 9.1, null));
        }

        [Fact]
        public void QualityEvaluationService_PromptExactSpecification_ShouldEvaluateExactStatus()
        {
            var evaluationService = new QualityEvaluationService();
            var parameter = new WaterTestParameter
            {
                Id = Guid.NewGuid(),
                Name = "pH",
                Category = "PHYSICAL",
                Unit = "—",
                MinWarning = 5.5,
                MinAcceptable = 6.0,
                MaxAcceptable = 8.5,
                MaxWarning = 9.0,
                IsActive = true
            };

            // Entered Value -> Status
            // 5.4 -> FAIL
            Assert.Equal("FAIL", evaluationService.EvaluateParameter(parameter, 5.4, null));
            // 5.5 -> WARNING
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 5.5, null));
            // 5.9 -> WARNING
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 5.9, null));
            // 6 -> PASS
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 6.0, null));
            // 7 -> PASS
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 7.0, null));
            // 8.5 -> PASS
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 8.5, null));
            // 8.6 -> WARNING
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 8.6, null));
            // 9 -> WARNING
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 9.0, null));
            // 9.1 -> FAIL
            Assert.Equal("FAIL", evaluationService.EvaluateParameter(parameter, 9.1, null));
        }

        [Fact]
        public void QualityEvaluationService_OneSidedUpperLimitWithWarning_ShouldEvaluateCorrectly()
        {
            var evaluationService = new QualityEvaluationService();
            var parameter = new WaterTestParameter
            {
                Id = Guid.NewGuid(),
                Name = "Turbidity",
                Category = "PHYSICAL",
                Unit = "NTU",
                MinWarning = 0,
                MinAcceptable = 0,
                MaxAcceptable = 1.0,
                MaxWarning = 3.0,
                IsActive = true
            };

            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 0.5, null));
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 1.0, null));
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 1.5, null));
            Assert.Equal("WARNING", evaluationService.EvaluateParameter(parameter, 3.0, null));
            Assert.Equal("FAIL", evaluationService.EvaluateParameter(parameter, 3.1, null));
        }

        [Fact]
        public void QualityEvaluationService_BackwardCompatibility_NullWarningLimits_ShouldPreserveStandardPassFail()
        {
            var evaluationService = new QualityEvaluationService();
            var parameter = new WaterTestParameter
            {
                Id = Guid.NewGuid(),
                Name = "Legacy Parameter",
                Category = "CHEMICAL",
                Unit = "mg/L",
                MinWarning = null,
                MinAcceptable = 6.0,
                MaxAcceptable = 8.5,
                MaxWarning = null,
                IsActive = true
            };

            Assert.Equal("FAIL", evaluationService.EvaluateParameter(parameter, 5.9, null));
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 6.0, null));
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 7.2, null));
            Assert.Equal("PASS", evaluationService.EvaluateParameter(parameter, 8.5, null));
            Assert.Equal("FAIL", evaluationService.EvaluateParameter(parameter, 8.6, null));
        }

        [Fact]
        public async Task WaterTestService_CreateOrUpdateParameter_ShouldAllowArbitraryLimitConfigurationAndPersist()
        {
            var tenantId = Guid.NewGuid();
            using var tenantContext = CreateInMemoryTenantContext(tenantId);
            using var platformContext = new PlatformDbContext(new DbContextOptionsBuilder<PlatformDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("tenant_test");

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(c => c.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());

            var service = new WaterTestService(
                tenantContext,
                platformContext,
                mockTenantProvider.Object,
                mockCurrentUser.Object,
                new QualityEvaluationService(),
                new Mock<IQCPdfCertificateService>().Object,
                new Mock<ILogger<WaterTestService>>().Object
            );

            // 1. Parameter creation with standard four limits
            var validRequest = new WaterTestParameterDto
            {
                Name = "Mineral Salt",
                Category = "CHEMICAL",
                Unit = "mg/L",
                MinWarning = 100,
                MinAcceptable = 150,
                MaxAcceptable = 200,
                MaxWarning = 250
            };
            var created = await service.CreateOrUpdateParameterAsync(validRequest);

            Assert.NotNull(created);
            Assert.Equal(100, created.MinWarning);
            Assert.Equal(150, created.MinAcceptable);
            Assert.Equal(200, created.MaxAcceptable);
            Assert.Equal(250, created.MaxWarning);

            var dbRecord = await tenantContext.WaterTestParameters.FindAsync(created.Id);
            Assert.NotNull(dbRecord);
            Assert.Equal(100, dbRecord.MinWarning);
            Assert.Equal(150, dbRecord.MinAcceptable);
            Assert.Equal(200, dbRecord.MaxAcceptable);
            Assert.Equal(250, dbRecord.MaxWarning);

            // 2. Update existing parameter with new warning limits
            created.MinWarning = 90;
            created.MaxWarning = 260;
            var updated = await service.CreateOrUpdateParameterAsync(created);

            Assert.Equal(90, updated.MinWarning);
            Assert.Equal(260, updated.MaxWarning);

            // 3. Verify parameter create does not block on range ordering (no ArgumentException)
            var flexibleParam = new WaterTestParameterDto
            {
                Name = "Flexible Parameter",
                Category = "PHYSICAL",
                Unit = "mg/L",
                MinWarning = 200,
                MinAcceptable = 100,
                MaxAcceptable = null,
                MaxWarning = null
            };
            var flexibleCreated = await service.CreateOrUpdateParameterAsync(flexibleParam);
            Assert.NotNull(flexibleCreated);
            Assert.Equal(200, flexibleCreated.MinWarning);
            Assert.Equal(100, flexibleCreated.MinAcceptable);
        }

        [Fact]
        public async Task WaterTestService_GetWaterTestReports_ShouldHandleNullFieldsAndPaginationGracefully()
        {
            var tenantId = Guid.NewGuid();
            var companyId = Guid.NewGuid();
            using var tenantContext = CreateInMemoryTenantContext(tenantId);
            using var platformContext = new PlatformDbContext(new DbContextOptionsBuilder<PlatformDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

            var company = new Company
            {
                Id = companyId,
                TenantId = tenantId,
                Name = "Aqua Test Co",
                Code = "ATC",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "System"
            };
            tenantContext.Companies.Add(company);

            // Add report with null/empty fields
            var report1 = new WaterTestReport
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                BatchNumber = "BATCH-2026-001",
                SampleNumber = "SMPL-001",
                ReportType = "DAILY",
                Status = "PASS",
                SampleTime = DateTime.UtcNow.AddHours(-2),
                TestedBy = "Analyst John",
                CreatedBy = "UserA",
                CreatedAt = DateTime.UtcNow.AddHours(-2),
                IsDeleted = false
            };

            var report2 = new WaterTestReport
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                BatchNumber = "BATCH-2026-002",
                SampleNumber = null,
                ReportType = "WEEKLY",
                Status = "WARNING",
                SampleTime = DateTime.UtcNow.AddHours(-1),
                TestedBy = null,
                CreatedBy = "", // empty string creator
                CreatedAt = DateTime.UtcNow.AddHours(-1),
                IsDeleted = false
            };

            tenantContext.WaterTestReports.AddRange(report1, report2);
            await tenantContext.SaveChangesAsync();

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("tenant_test");

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(c => c.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(c => c.UserId).Returns("UserA");

            var service = new WaterTestService(
                tenantContext,
                platformContext,
                mockTenantProvider.Object,
                mockCurrentUser.Object,
                new QualityEvaluationService(),
                new Mock<IQCPdfCertificateService>().Object,
                new Mock<ILogger<WaterTestService>>().Object
            );

            // 1. Zero filters query
            var result = await service.GetWaterTestReportsAsync(1, 10, null, null, null, null, null);
            Assert.NotNull(result);
            Assert.Equal(2, result.TotalCount);
            Assert.Equal(2, result.Items.Count);

            // 2. Boundary safety (pageNumber = 0, pageSize = -5)
            var boundedResult = await service.GetWaterTestReportsAsync(0, -5, null, null, null, null, null);
            Assert.NotNull(boundedResult);
            Assert.Equal(2, boundedResult.TotalCount);

            // 3. Search filter by Batch
            var searchResult = await service.GetWaterTestReportsAsync(1, 10, "BATCH-2026-001", null, null, null, null);
            Assert.Single(searchResult.Items);
            Assert.Equal("BATCH-2026-001", searchResult.Items[0].BatchNumber);

            // 4. Report Type filter
            var typeResult = await service.GetWaterTestReportsAsync(1, 10, null, "WEEKLY", null, null, null);
            Assert.Single(typeResult.Items);
            Assert.Equal("BATCH-2026-002", typeResult.Items[0].BatchNumber);

            // 5. Status filter
            var statusResult = await service.GetWaterTestReportsAsync(1, 10, null, null, "PASS", null, null);
            Assert.Single(statusResult.Items);
            Assert.Equal("BATCH-2026-001", statusResult.Items[0].BatchNumber);
        }

        [Fact]
        public async Task QCPdfCertificateService_ShouldGenerateValidPdfBinaryWithPdfSignature()
        {
            var pdfService = new QCPdfCertificateService();
            var report = new WaterTestReport
            {
                Id = Guid.NewGuid(),
                BatchNumber = "BATCH-2026-099",
                SampleNumber = "F201F54D",
                ReportType = "DAILY",
                Status = "PASS",
                SampleTime = DateTime.UtcNow,
                TestedBy = "Senior Chemist John Doe",
                VerifiedBy = "Quality Assurance Manager Jane Smith",
                Remarks = "Water quality meets all BIS IS 14543 parameters with zero microbiological growth.",
                Results = new List<WaterTestResult>
                {
                    new WaterTestResult
                    {
                        Id = Guid.NewGuid(),
                        Value = 7.15,
                        IsPass = true,
                        QualityStatus = "PASS",
                        Parameter = new WaterTestParameter
                        {
                            Id = Guid.NewGuid(),
                            Name = "pH",
                            Category = "CHEMICAL",
                            Unit = "—",
                            MinAcceptable = 6.5,
                            MaxAcceptable = 8.5
                        }
                    },
                    new WaterTestResult
                    {
                        Id = Guid.NewGuid(),
                        Value = 42.5,
                        IsPass = true,
                        QualityStatus = "PASS",
                        Parameter = new WaterTestParameter
                        {
                            Id = Guid.NewGuid(),
                            Name = "TDS",
                            Category = "PHYSICAL",
                            Unit = "ppm",
                            MaxAcceptable = 500
                        }
                    },
                    new WaterTestResult
                    {
                        Id = Guid.NewGuid(),
                        StringValue = "Absent",
                        IsPass = true,
                        QualityStatus = "PASS",
                        Parameter = new WaterTestParameter
                        {
                            Id = Guid.NewGuid(),
                            Name = "E.coli",
                            Category = "MICROBIOLOGY",
                            Unit = "MPN/100ml"
                        }
                    },
                    new WaterTestResult
                    {
                        Id = Guid.NewGuid(),
                        StringValue = "0",
                        IsPass = true,
                        QualityStatus = "PASS",
                        Parameter = new WaterTestParameter
                        {
                            Id = Guid.NewGuid(),
                            Name = "Aerobic Microbial Count 22°C",
                            Category = "MICROBIOLOGY",
                            Unit = "CFU/ml"
                        }
                    }
                }
            };

            var pdfBytes = await pdfService.GenerateCertificatePdfAsync(report, "AQUZIO PURIFIED WATER CO.", "Industrial Area, Kalamassery, Kochi, Kerala - 682022");

            Assert.NotNull(pdfBytes);
            Assert.True(pdfBytes.Length > 200, "PDF byte array must contain substantial binary data.");

            string pdfString = System.Text.Encoding.ASCII.GetString(pdfBytes);

            // Phase 3 Acceptance: Verify PDF magic bytes signature '%PDF-'
            Assert.StartsWith("%PDF-", pdfString);
            Assert.Contains("%%EOF", pdfString);
            Assert.Contains("/Type /Catalog", pdfString);
            Assert.Contains("WATER TEST REPORT", pdfString);
            Assert.Contains("F201F54D", pdfString);
            Assert.Contains("AQUZIO PURIFIED WATER CO.", pdfString);
            Assert.Contains("Industrial Area, Kalamassery, Kochi, Kerala - 682022", pdfString);
            Assert.Contains("pH", pdfString);
            Assert.Contains("TDS", pdfString);
        }

        [Fact]
        public async Task WaterTestService_CreateAndEditReport_ShouldSucceedOnFirstAndSecondEditAndDetectGenuineConcurrencyConflict()
        {
            var tenantId = Guid.NewGuid();
            var companyId = Guid.NewGuid();
            using var tenantContext = CreateInMemoryTenantContext(tenantId);
            using var platformContext = new PlatformDbContext(new DbContextOptionsBuilder<PlatformDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

            var company = new Company
            {
                Id = companyId,
                TenantId = tenantId,
                Name = "Aquzio Bottling",
                Code = "AQUZIO",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "System"
            };
            tenantContext.Companies.Add(company);
            await tenantContext.SaveChangesAsync();

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("tenant_test");

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(c => c.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(c => c.UserId).Returns("QC_User_1");

            var service = new WaterTestService(
                tenantContext,
                platformContext,
                mockTenantProvider.Object,
                mockCurrentUser.Object,
                new QualityEvaluationService(),
                new Mock<IQCPdfCertificateService>().Object,
                new Mock<ILogger<WaterTestService>>().Object
            );

            // 1. CREATE TEST REPORT
            var createRequest = new CreateWaterTestReportRequest
            {
                BatchNumber = "BATCH-INIT-001",
                SampleNumber = "SMPL-101",
                ReportType = "DAILY",
                Status = "DRAFT",
                ProductionDate = DateTime.UtcNow,
                SampleTime = DateTime.UtcNow,
                TestedBy = "Analyst Alpha",
                Remarks = "Initial draft",
                Results = new List<CreateWaterTestResultRequest>
                {
                    new() { ParameterId = "pH", Value = 7.0 }
                }
            };

            var createdReport = await service.CreateWaterTestReportAsync(createRequest);
            Assert.NotNull(createdReport);
            Assert.False(string.IsNullOrWhiteSpace(createdReport.ConcurrencyToken));
            Assert.Equal("BATCH-INIT-001", createdReport.BatchNumber);
            var resultId = Assert.Single(createdReport.Results).Id;

            // 2. FIRST EDIT
            var firstEditToken = createdReport.ConcurrencyToken;
            var updateRequest1 = new CreateWaterTestReportRequest
            {
                BatchNumber = "BATCH-EDIT-001",
                SampleNumber = "SMPL-101",
                ReportType = "DAILY",
                Status = "SUBMITTED",
                Remarks = "First update remarks",
                ConcurrencyToken = firstEditToken,
                Results = new List<CreateWaterTestResultRequest>
                {
                    new() { Id = resultId.ToString(), ParameterId = "pH", Value = 7.2 },
                    // No ID: this must be inserted as a new tracked WaterTestResult.
                    new() { ParameterId = "TDS", Value = 120.0 }
                }
            };

            var firstUpdatedReport = await service.UpdateWaterTestReportAsync(createdReport.Id, updateRequest1);
            Assert.NotNull(firstUpdatedReport);
            Assert.Equal("BATCH-EDIT-001", firstUpdatedReport.BatchNumber);
            Assert.Equal("First update remarks", firstUpdatedReport.Remarks);
            Assert.False(string.IsNullOrWhiteSpace(firstUpdatedReport.ConcurrencyToken));
            Assert.NotEqual(firstEditToken, firstUpdatedReport.ConcurrencyToken);
            Assert.Equal(2, firstUpdatedReport.Results.Count);
            var firstUpdatedResult = Assert.Single(firstUpdatedReport.Results.Where(r => r.Id == resultId));
            Assert.Equal(resultId, firstUpdatedResult.Id);
            Assert.Equal(7.2, firstUpdatedResult.Value);
            var insertedResult = Assert.Single(firstUpdatedReport.Results.Where(r => r.ParameterName == "TDS"));
            Assert.NotEqual(Guid.Empty, insertedResult.Id);
            Assert.Equal(120.0, insertedResult.Value);

            // 3. SECOND EDIT USING NEW TOKEN
            var secondEditToken = firstUpdatedReport.ConcurrencyToken;
            var updateRequest2 = new CreateWaterTestReportRequest
            {
                BatchNumber = "BATCH-EDIT-002",
                SampleNumber = "SMPL-102",
                ReportType = "DAILY",
                Status = "APPROVED",
                Remarks = "Second update remarks",
                ConcurrencyToken = secondEditToken,
                Results = new List<CreateWaterTestResultRequest>
                {
                    new() { Id = resultId.ToString(), ParameterId = "pH", Value = 7.4 },
                    new() { Id = insertedResult.Id.ToString(), ParameterId = "TDS", Value = 125.0 }
                }
            };

            var secondUpdatedReport = await service.UpdateWaterTestReportAsync(createdReport.Id, updateRequest2);
            Assert.NotNull(secondUpdatedReport);
            Assert.Equal("BATCH-EDIT-002", secondUpdatedReport.BatchNumber);
            Assert.Equal("Second update remarks", secondUpdatedReport.Remarks);
            Assert.Equal(2, secondUpdatedReport.Results.Count);
            var secondUpdatedResult = Assert.Single(secondUpdatedReport.Results.Where(r => r.Id == resultId));
            Assert.Equal(resultId, secondUpdatedResult.Id);
            Assert.Equal(7.4, secondUpdatedResult.Value);
            Assert.Equal(125.0, Assert.Single(secondUpdatedReport.Results.Where(r => r.Id == insertedResult.Id)).Value);

            // 4. GENUINE CONCURRENCY CONFLICT TEST (User B attempts update with STALE token `firstEditToken`)
            var staleUpdateRequest = new CreateWaterTestReportRequest
            {
                BatchNumber = "BATCH-STALE",
                ConcurrencyToken = firstEditToken,
                Results = new List<CreateWaterTestResultRequest>()
            };

            await Assert.ThrowsAsync<Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException>(async () =>
            {
                await service.UpdateWaterTestReportAsync(createdReport.Id, staleUpdateRequest);
            });
        }
    }
}
