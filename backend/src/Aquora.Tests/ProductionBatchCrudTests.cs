using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Aquora.API.Controllers;
using Aquora.API.Hubs;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Aquora.Shared.Models;

namespace Aquora.Tests
{
    public class ProductionBatchCrudTests
    {
        private (TenantDbContext tenantContext, PlatformDbContext platformContext, ProductionController controller, Guid tenantId, Guid lineId) SetupController(string role = "CompanyAdmin")
        {
            var tenantId = Guid.NewGuid();
            var lineId = Guid.NewGuid();

            var tenantOptions = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("tenant_test");

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(c => c.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());
            mockCurrentUser.Setup(c => c.Email).Returns("admin@test.com");
            mockCurrentUser.Setup(c => c.Roles).Returns(new List<string> { role });

            var tenantContext = new TenantDbContext(tenantOptions, mockTenantProvider.Object, mockCurrentUser.Object);

            var defaultLine = new ProductionLine
            {
                Id = lineId,
                Name = "Default Line",
                Code = "DL-01",
                IsActive = true,
                TenantId = tenantId,
                CreatedBy = "Admin",
                CreatedAt = DateTime.UtcNow
            };
            tenantContext.ProductionLines.Add(defaultLine);
            tenantContext.SaveChanges();

            var platformOptions = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var platformContext = new PlatformDbContext(platformOptions);

            var mockHubContext = new Mock<IHubContext<DashboardHub>>();
            var mockClients = new Mock<IHubClients>();
            var mockClientProxy = new Mock<IClientProxy>();
            mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockClientProxy.Object);
            mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);

            var controller = new ProductionController(platformContext, tenantContext, mockHubContext.Object);

            var userClaims = new List<Claim>
            {
                new Claim("tenant_id", tenantId.ToString()),
                new Claim("user_id", Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Role, role),
                new Claim(ClaimTypes.Name, "Test User")
            };
            var identity = new ClaimsIdentity(userClaims, "TestAuth");
            var principal = new ClaimsPrincipal(identity);

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };

            return (tenantContext, platformContext, controller, tenantId, lineId);
        }

        private ProductionBatch CreateBatch(Guid tenantId, Guid lineId, string batchNumber, int targetQty = 1000, int producedQty = 0, string status = "Active")
        {
            return new ProductionBatch
            {
                Id = Guid.NewGuid(),
                BatchNumber = batchNumber,
                Product = "Aquora 500ml",
                Shift = "Morning",
                ProductionLineId = lineId,
                OperatorId = Guid.NewGuid(),
                OperatorName = "Operator Joe",
                TargetQuantity = targetQty,
                ProducedQuantity = producedQty,
                Status = status,
                TenantId = tenantId,
                CreatedBy = "Admin",
                CreatedAt = DateTime.UtcNow
            };
        }

        [Fact]
        public async Task UpdateBatch_ValidChanges_UpdatesBatchAndReturnsSuccess()
        {
            var (tenantDb, platformDb, controller, tenantId, lineId) = SetupController();
            var product = new Product { Id = Guid.NewGuid(), Name = "Aquora 500ml", SKU = "AQ-500", IsActive = true };
            var batch = CreateBatch(tenantId, lineId, "B-001");

            tenantDb.Products.Add(product);
            tenantDb.ProductionBatches.Add(batch);
            await tenantDb.SaveChangesAsync();

            var updateReq = new UpdateProductionBatchRequest
            {
                BatchNumber = "B-001-EDITED",
                Product = "Aquora 500ml",
                Shift = "Evening",
                TargetQuantity = 2500,
                Status = "Paused"
            };

            var actionResult = await controller.UpdateBatch(batch.Id, updateReq);
            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            var apiResponse = Assert.IsType<ApiResponse<object>>(okResult.Value);

            Assert.True(apiResponse.Success);

            var updated = await tenantDb.ProductionBatches.FirstAsync(b => b.Id == batch.Id);
            Assert.Equal("B-001-EDITED", updated.BatchNumber);
            Assert.Equal("Evening", updated.Shift);
            Assert.Equal(2500, updated.TargetQuantity);
            Assert.Equal("Paused", updated.Status);
        }

        [Fact]
        public async Task UpdateBatch_DuplicateBatchNumber_ReturnsConflict()
        {
            var (tenantDb, platformDb, controller, tenantId, lineId) = SetupController();
            var batch1 = CreateBatch(tenantId, lineId, "BATCH-ALPHA");
            var batch2 = CreateBatch(tenantId, lineId, "BATCH-BETA");

            tenantDb.ProductionBatches.AddRange(batch1, batch2);
            await tenantDb.SaveChangesAsync();

            var updateReq = new UpdateProductionBatchRequest
            {
                BatchNumber = "BATCH-ALPHA"
            };

            var actionResult = await controller.UpdateBatch(batch2.Id, updateReq);
            var statusResult = Assert.IsType<ObjectResult>(actionResult.Result);
            Assert.Equal(409, statusResult.StatusCode);
        }

        [Fact]
        public async Task UpdateBatch_NonExistentProduct_ReturnsBadRequest()
        {
            var (tenantDb, platformDb, controller, tenantId, lineId) = SetupController();
            var batch = CreateBatch(tenantId, lineId, "BATCH-01");
            tenantDb.ProductionBatches.Add(batch);
            await tenantDb.SaveChangesAsync();

            var updateReq = new UpdateProductionBatchRequest
            {
                Product = "FakeNonExistentProduct"
            };

            var actionResult = await controller.UpdateBatch(batch.Id, updateReq);
            var statusResult = Assert.IsType<ObjectResult>(actionResult.Result);
            Assert.Equal(400, statusResult.StatusCode);
        }

        [Fact]
        public async Task UpdateBatch_OwnerRole_ReturnsForbidden()
        {
            var (tenantDb, platformDb, controller, tenantId, lineId) = SetupController(role: "Owner");
            var batch = CreateBatch(tenantId, lineId, "BATCH-01");
            tenantDb.ProductionBatches.Add(batch);
            await tenantDb.SaveChangesAsync();

            var actionResult = await controller.UpdateBatch(batch.Id, new UpdateProductionBatchRequest { Shift = "Night" });
            var statusResult = Assert.IsType<ObjectResult>(actionResult.Result);
            Assert.Equal(403, statusResult.StatusCode);
        }

        [Fact]
        public async Task DeleteBatch_UnstartedBatch_SuccessfullySoftDeletes()
        {
            var (tenantDb, platformDb, controller, tenantId, lineId) = SetupController();
            var batch = CreateBatch(tenantId, lineId, "BATCH-UNSTARTED");

            tenantDb.ProductionBatches.Add(batch);
            await tenantDb.SaveChangesAsync();

            var actionResult = await controller.DeleteBatch(batch.Id);
            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            var apiResponse = Assert.IsType<ApiResponse<object?>>(okResult.Value);

            Assert.True(apiResponse.Success);

            var deletedBatch = await tenantDb.ProductionBatches.IgnoreQueryFilters().FirstAsync(b => b.Id == batch.Id);
            Assert.True(deletedBatch.IsDeleted);
            Assert.NotNull(deletedBatch.DeletedAt);
        }

        [Fact]
        public async Task DeleteBatch_WithProducedOutput_ReturnsBadRequest()
        {
            var (tenantDb, platformDb, controller, tenantId, lineId) = SetupController();
            var batch = CreateBatch(tenantId, lineId, "BATCH-PRODUCED", targetQty: 1000, producedQty: 350);

            tenantDb.ProductionBatches.Add(batch);
            await tenantDb.SaveChangesAsync();

            var actionResult = await controller.DeleteBatch(batch.Id);
            var statusResult = Assert.IsType<ObjectResult>(actionResult.Result);
            Assert.Equal(400, statusResult.StatusCode);

            var apiResponse = Assert.IsType<ApiResponse<object?>>(statusResult.Value);
            var errorsJoined = string.Join(" ", apiResponse.Errors);
            Assert.Contains("already been manufactured", errorsJoined);
        }

        [Fact]
        public async Task DeleteBatch_WithStationLogs_ReturnsBadRequest()
        {
            var (tenantDb, platformDb, controller, tenantId, lineId) = SetupController();
            var batch = CreateBatch(tenantId, lineId, "BATCH-STATION-TEST");

            var stationData = new ProductionStationData
            {
                Id = Guid.NewGuid(),
                ProductionBatchId = batch.Id,
                StationCode = "BLOW_MOULDING",
                OperatorName = "Station Operator",
                Timestamp = DateTime.UtcNow,
                InputQty = 100,
                OutputQty = 100,
                TenantId = tenantId,
                CreatedBy = "Admin",
                CreatedAt = DateTime.UtcNow
            };

            tenantDb.ProductionBatches.Add(batch);
            tenantDb.ProductionStationData.Add(stationData);
            await tenantDb.SaveChangesAsync();

            var actionResult = await controller.DeleteBatch(batch.Id);
            var statusResult = Assert.IsType<ObjectResult>(actionResult.Result);
            Assert.Equal(400, statusResult.StatusCode);

            var apiResponse = Assert.IsType<ApiResponse<object?>>(statusResult.Value);
            var errorsJoined = string.Join(" ", apiResponse.Errors);
            Assert.Contains("station process parameters have already been recorded", errorsJoined);
        }

        [Fact]
        public async Task DeleteBatch_OwnerRole_ReturnsForbidden()
        {
            var (tenantDb, platformDb, controller, tenantId, lineId) = SetupController(role: "Owner");
            var batch = CreateBatch(tenantId, lineId, "BATCH-READONLY");

            tenantDb.ProductionBatches.Add(batch);
            await tenantDb.SaveChangesAsync();

            var actionResult = await controller.DeleteBatch(batch.Id);
            var statusResult = Assert.IsType<ObjectResult>(actionResult.Result);
            Assert.Equal(403, statusResult.StatusCode);
        }

        [Fact]
        public async Task GetBatchEntries_WithLinkedEntries_ReturnsListSuccessfully()
        {
            var (tenantDb, platformDb, controller, tenantId, lineId) = SetupController();
            var batch = CreateBatch(tenantId, lineId, "BATCH-ENTRIES-TEST");

            var session = new ProductionSession
            {
                Id = batch.Id,
                TenantId = tenantId,
                CompanyId = Guid.NewGuid(),
                BatchNumber = batch.BatchNumber,
                ProductionLineId = lineId,
                OperatorId = batch.OperatorId,
                OperatorName = batch.OperatorName,
                Shift = batch.Shift,
                ProductId = Guid.NewGuid(),
                StartedAt = batch.StartedAt,
                Status = "Running",
                Remarks = "Test Session",
                TotalCasesProduced = 150,
                CreatedBy = "Admin",
                CreatedAt = DateTime.UtcNow
            };

            var product = new Product
            {
                Id = session.ProductId,
                Name = "Aquora 500ml",
                CreatedBy = "Admin",
                CreatedAt = DateTime.UtcNow
            };
            tenantDb.Products.Add(product);

            var entry1 = new ProductionEntry
            {
                Id = Guid.NewGuid(),
                ProductionSessionId = session.Id,
                ProductionLineId = lineId,
                OperatorId = batch.OperatorId,
                OperatorName = "Operator A",
                Shift = "Morning",
                Date = DateTime.UtcNow.Date,
                Time = DateTime.UtcNow.ToString("O"),
                ProductId = session.ProductId,
                CasesProduced = 100,
                TenantId = tenantId,
                CompanyId = session.CompanyId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-30),
                CreatedBy = "Admin"
            };

            var entry2 = new ProductionEntry
            {
                Id = Guid.NewGuid(),
                ProductionSessionId = session.Id,
                ProductionLineId = lineId,
                OperatorId = batch.OperatorId,
                OperatorName = "Operator B",
                Shift = "Morning",
                Date = DateTime.UtcNow.Date,
                Time = DateTime.UtcNow.ToString("O"),
                ProductId = session.ProductId,
                CasesProduced = 50,
                TenantId = tenantId,
                CompanyId = session.CompanyId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                CreatedBy = "Admin"
            };

            tenantDb.ProductionBatches.Add(batch);
            tenantDb.ProductionSessions.Add(session);
            tenantDb.ProductionEntries.AddRange(entry1, entry2);
            await tenantDb.SaveChangesAsync();

            var actionResult = await controller.GetBatchEntries(batch.Id);
            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            var apiResponse = Assert.IsType<ApiResponse<List<object>>>(okResult.Value);

            Assert.True(apiResponse.Success);
            Assert.Equal(2, apiResponse.Data.Count);

            // Also test GetBatchById returns EntryCount == 2
            var detailResult = await controller.GetBatchById(batch.Id);
            var detailOk = Assert.IsType<OkObjectResult>(detailResult.Result);
            var detailResponse = Assert.IsType<ApiResponse<object>>(detailOk.Value);
            Assert.True(detailResponse.Success);
        }

        [Fact]
        public async Task StopBatch_ClosesBatch_Atomically_And_Audits()
        {
            var (tenantDb, _, controller, tenantId, lineId) = SetupController();

            var batch = CreateBatch(tenantId, lineId, "BAT-STOP-01", targetQty: 1000, producedQty: 200, status: "Active");
            var session = new ProductionSession
            {
                Id = batch.Id,
                TenantId = tenantId,
                CompanyId = Guid.NewGuid(),
                BatchNumber = batch.BatchNumber,
                ProductionLineId = lineId,
                OperatorId = batch.OperatorId,
                OperatorName = batch.OperatorName,
                Shift = "Morning",
                ProductId = Guid.NewGuid(),
                StartedAt = DateTime.UtcNow.AddHours(-2),
                Status = "Running",
                TotalCasesProduced = 200,
                CreatedBy = "Admin",
                CreatedAt = DateTime.UtcNow.AddHours(-2)
            };

            var entry = new ProductionEntry
            {
                Id = Guid.NewGuid(),
                ProductionSessionId = session.Id,
                ProductionLineId = lineId,
                OperatorId = batch.OperatorId,
                OperatorName = batch.OperatorName,
                Shift = "Morning",
                Date = DateTime.UtcNow.Date,
                Time = DateTime.UtcNow.ToString("O"),
                ProductId = session.ProductId,
                CasesProduced = 250,
                TenantId = tenantId,
                CompanyId = session.CompanyId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-30),
                CreatedBy = "Admin"
            };

            tenantDb.ProductionBatches.Add(batch);
            tenantDb.ProductionSessions.Add(session);
            tenantDb.ProductionEntries.Add(entry);
            await tenantDb.SaveChangesAsync();

            var stopRequest = new StopProductionBatchRequest
            {
                Reason = "Shift ended",
                Remarks = "Normal completion"
            };

            var result = await controller.StopBatch(batch.Id, stopRequest);
            var okResult = Assert.IsType<OkObjectResult>(result.Result);
            var apiResponse = Assert.IsType<ApiResponse<object>>(okResult.Value);

            Assert.True(apiResponse.Success);

            // Verify batch is marked Completed with updated ProducedQuantity
            var updatedBatch = await tenantDb.ProductionBatches.FindAsync(batch.Id);
            Assert.NotNull(updatedBatch);
            Assert.Equal("Completed", updatedBatch.Status);
            Assert.NotNull(updatedBatch.CompletedAt);
            Assert.Equal(250, updatedBatch.ProducedQuantity);

            // Verify session is marked Completed
            var updatedSession = await tenantDb.ProductionSessions.FindAsync(session.Id);
            Assert.NotNull(updatedSession);
            Assert.Equal("Completed", updatedSession.Status);
            Assert.NotNull(updatedSession.EndedAt);

            // Verify Audit Log was recorded
            var auditLog = await tenantDb.AuditLogs.FirstOrDefaultAsync(a => a.PrimaryKey == batch.Id.ToString() && a.Action == "StopBatch");
            Assert.NotNull(auditLog);
            Assert.Equal("Production", auditLog.Module);
        }

        [Fact]
        public async Task StopBatch_RepeatedRequest_IsIdempotent()
        {
            var (tenantDb, _, controller, tenantId, lineId) = SetupController();

            var batch = CreateBatch(tenantId, lineId, "BAT-STOP-02", targetQty: 500, producedQty: 500, status: "Completed");
            batch.CompletedAt = DateTime.UtcNow.AddMinutes(-10);
            tenantDb.ProductionBatches.Add(batch);
            await tenantDb.SaveChangesAsync();

            var stopRequest = new StopProductionBatchRequest { Reason = "Shift ended" };

            // Repeating StopBatch on an already completed batch should return success gracefully
            var result = await controller.StopBatch(batch.Id, stopRequest);
            var okResult = Assert.IsType<OkObjectResult>(result.Result);
            var apiResponse = Assert.IsType<ApiResponse<object>>(okResult.Value);

            Assert.True(apiResponse.Success);
            Assert.Contains("already completed", apiResponse.Message, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task EndSession_ClosesSession_Atomically_And_Audits()
        {
            var tenantId = Guid.NewGuid();
            var lineId = Guid.NewGuid();

            var tenantOptions = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("tenant_test");

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(c => c.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());
            mockCurrentUser.Setup(c => c.Email).Returns("operator@test.com");
            mockCurrentUser.Setup(c => c.Roles).Returns(new List<string> { "Operator" });

            var tenantContext = new TenantDbContext(tenantOptions, mockTenantProvider.Object, mockCurrentUser.Object);

            var platformOptions = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            var platformContext = new PlatformDbContext(platformOptions);

            var mockHubContext = new Mock<IHubContext<DashboardHub>>();
            var mockClients = new Mock<IHubClients>();
            var mockClientProxy = new Mock<IClientProxy>();
            mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockClientProxy.Object);
            mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);

            var mockLogger = new Mock<Microsoft.Extensions.Logging.ILogger<ProductionEntriesController>>();
            var mockInvService = new Mock<IInventoryMovementService>();
            var mockProdService = new Mock<IProductionService>();

            var entriesController = new ProductionEntriesController(
                tenantContext,
                platformContext,
                mockLogger.Object,
                mockInvService.Object,
                mockProdService.Object,
                mockHubContext.Object
            );

            var userClaims = new List<Claim>
            {
                new Claim("tenant_id", tenantId.ToString()),
                new Claim("user_id", Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Role, "Operator"),
                new Claim(ClaimTypes.Name, "Operator Bob"),
                new Claim(ClaimTypes.Email, "operator@aquora.com")
            };
            entriesController.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(userClaims, "TestAuth")) }
            };

            var batchId = Guid.NewGuid();
            var batch = new ProductionBatch
            {
                Id = batchId,
                BatchNumber = "BAT-SESSION-01",
                Product = "Aquora 1L",
                Shift = "Morning",
                ProductionLineId = lineId,
                OperatorId = Guid.NewGuid(),
                OperatorName = "Operator Bob",
                TargetQuantity = 1000,
                ProducedQuantity = 100,
                Status = "Active",
                TenantId = tenantId,
                CreatedBy = "Operator",
                CreatedAt = DateTime.UtcNow.AddHours(-1)
            };

            var session = new ProductionSession
            {
                Id = batchId,
                TenantId = tenantId,
                CompanyId = Guid.NewGuid(),
                BatchNumber = batch.BatchNumber,
                ProductionLineId = lineId,
                OperatorId = batch.OperatorId,
                OperatorName = batch.OperatorName,
                Shift = "Morning",
                ProductId = Guid.NewGuid(),
                StartedAt = DateTime.UtcNow.AddHours(-1),
                Status = "Running",
                TotalCasesProduced = 100,
                CreatedBy = "Operator",
                CreatedAt = DateTime.UtcNow.AddHours(-1)
            };

            var entry = new ProductionEntry
            {
                Id = Guid.NewGuid(),
                ProductionSessionId = session.Id,
                ProductionLineId = lineId,
                OperatorId = batch.OperatorId,
                OperatorName = batch.OperatorName,
                Shift = "Morning",
                Date = DateTime.UtcNow.Date,
                Time = DateTime.UtcNow.ToString("O"),
                ProductId = session.ProductId,
                CasesProduced = 180,
                TenantId = tenantId,
                CompanyId = session.CompanyId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-15),
                CreatedBy = "Operator"
            };

            tenantContext.ProductionBatches.Add(batch);
            tenantContext.ProductionSessions.Add(session);
            tenantContext.ProductionEntries.Add(entry);
            await tenantContext.SaveChangesAsync();

            var endRequest = new ProductionEntriesController.EndProductionSessionRequest
            {
                SessionId = session.Id,
                Remarks = "Shift completed normally",
                ConfirmClose = true
            };

            var result = await entriesController.EndSession(endRequest);
            var okResult = Assert.IsType<OkObjectResult>(result.Result);
            var apiResponse = Assert.IsType<ApiResponse<object>>(okResult.Value);

            Assert.True(apiResponse.Success);

            // Verify session status and total cases
            var updatedSession = await tenantContext.ProductionSessions.FindAsync(session.Id);
            Assert.NotNull(updatedSession);
            Assert.Equal("Completed", updatedSession.Status);
            Assert.Equal(180, updatedSession.TotalCasesProduced);
            Assert.NotNull(updatedSession.EndedAt);

            // Verify batch updated
            var updatedBatch = await tenantContext.ProductionBatches.FindAsync(batch.Id);
            Assert.NotNull(updatedBatch);
            Assert.Equal("Completed", updatedBatch.Status);
            Assert.Equal(180, updatedBatch.ProducedQuantity);

            // Verify audit log
            var audit = await tenantContext.AuditLogs.FirstOrDefaultAsync(a => a.PrimaryKey == session.Id.ToString() && a.Action == "EndBatch");
            Assert.NotNull(audit);

            // Test idempotency on repeated request
            var repeatedResult = await entriesController.EndSession(endRequest);
            var repeatedOk = Assert.IsType<OkObjectResult>(repeatedResult.Result);
            var repeatedResponse = Assert.IsType<ApiResponse<object>>(repeatedOk.Value);
            Assert.True(repeatedResponse.Success);
            Assert.Contains("already closed", repeatedResponse.Message, StringComparison.OrdinalIgnoreCase);
        }
    }
}
