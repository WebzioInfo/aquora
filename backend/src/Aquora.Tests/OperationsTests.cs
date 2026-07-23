using System;
using Xunit;
using Aquora.Domain.Entities;

namespace Aquora.Tests
{
    public class OperationsTests
    {
        [Fact]
        public void OperationsReservedJar_ShouldInstantiateWithDefaultValues()
        {
            // Arrange & Act
            var reservedJar = new OperationsReservedJar
            {
                DistributorId = Guid.NewGuid(),
                Quantity = 50,
                Type = "Empty",
                Reason = "Distributor requested holding jars",
                Status = "Pending"
            };

            // Assert
            Assert.Equal("Empty", reservedJar.Type);
            Assert.Equal("Pending", reservedJar.Status);
            Assert.Equal(50, reservedJar.Quantity);
            Assert.Equal("Distributor requested holding jars", reservedJar.Reason);
            Assert.False(reservedJar.IsDeleted);
        }

        [Fact]
        public void OperationsWashingLog_ShouldCaptureWashedAndRejectedCounts()
        {
            // Arrange & Act
            var washingLog = new OperationsWashingLog
            {
                WashedCount = 200,
                RejectedCount = 5
            };

            // Assert
            Assert.Equal(200, washingLog.WashedCount);
            Assert.Equal(5, washingLog.RejectedCount);
            Assert.False(washingLog.IsDeleted);
        }

        [Fact]
        public void OperationsFillingLog_ShouldCaptureFillingMetrics()
        {
            // Arrange & Act
            var fillingLog = new OperationsFillingLog
            {
                ProductId = Guid.NewGuid(),
                BrandId = Guid.NewGuid(),
                FilledCount = 180,
                RejectedCount = 2,
                LeakageCount = 1,
                CapFailureCount = 1,
                SealFailureCount = 0
            };

            // Assert
            Assert.Equal(180, fillingLog.FilledCount);
            Assert.Equal(2, fillingLog.RejectedCount);
            Assert.Equal(1, fillingLog.LeakageCount);
            Assert.Equal(1, fillingLog.CapFailureCount);
            Assert.Equal(0, fillingLog.SealFailureCount);
            Assert.False(fillingLog.IsDeleted);
        }
    }
}
