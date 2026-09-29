using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using Aquora.Application.DTOs.Media;
using Aquora.Application.DTOs.User;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Infrastructure.Configuration;
using Aquora.Infrastructure.Services;
using Aquora.Persistence.Context;
using Aquora.Persistence.Services;

namespace Aquora.Tests
{
    public class CloudinaryMediaStorageTests
    {
        private readonly PlatformDbContext _platformContext;
        private readonly Mock<IPasswordHasher> _mockPasswordHasher;
        private readonly Mock<ICurrentUserContext> _mockCurrentUserContext;
        private readonly Mock<IServiceScopeFactory> _mockScopeFactory;
        private readonly IUserRoleResolver _roleResolver;
        private readonly Mock<ICloudinaryMediaService> _mockCloudinaryService;

        public CloudinaryMediaStorageTests()
        {
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: $"CloudinaryTestDb_{Guid.NewGuid()}")
                .Options;

            _platformContext = new PlatformDbContext(options);

            _mockPasswordHasher = new Mock<IPasswordHasher>();
            _mockPasswordHasher.Setup(h => h.HashPassword(It.IsAny<string>()))
                .Returns<string>(p => $"hashed_{p}");
            _mockPasswordHasher.Setup(h => h.VerifyPassword(It.IsAny<string>(), It.IsAny<string>()))
                .Returns<string, string>((pwd, hash) => hash == $"hashed_{pwd}" || hash == pwd);

            _mockCurrentUserContext = new Mock<ICurrentUserContext>();
            _mockCurrentUserContext.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());
            _mockCurrentUserContext.Setup(c => c.IpAddress).Returns("127.0.0.1");
            _mockCurrentUserContext.Setup(c => c.UserAgent).Returns("Mozilla/5.0 Test");

            _mockScopeFactory = new Mock<IServiceScopeFactory>();

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(Guid.NewGuid());
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("tenant_test");

            var tenantOptions = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: $"CloudinaryTenantTestDb_{Guid.NewGuid()}")
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            var tenantContext = new TenantDbContext(tenantOptions, mockTenantProvider.Object, _mockCurrentUserContext.Object);

            _roleResolver = new UserRoleResolver(_platformContext, tenantContext);
            _mockCloudinaryService = new Mock<ICloudinaryMediaService>();
        }

        [Fact]
        public void Test_FolderPathGeneration_SeparatesTenantsAndAssetTypes()
        {
            var options = Options.Create(new CloudinaryOptions
            {
                CloudName = "dhydmxcq2",
                ApiKey = "715391971962435",
                ApiSecret = "LSIRWQLv_QuFNQ99NaHKnutW_qk"
            });
            var mockLogger = new Mock<ILogger<CloudinaryMediaService>>();
            var service = new CloudinaryMediaService(options, mockLogger.Object);

            var tenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");
            var userId = Guid.Parse("22222222-2222-2222-2222-222222222222");

            // 1. User Profile Folder
            var userFolder = service.BuildFolderPath(MediaAssetType.UserProfilePhoto, tenantId, userId);
            Assert.Equal("aquzio/tenants/11111111-1111-1111-1111-111111111111/users/22222222-2222-2222-2222-222222222222/profile", userFolder);

            // 2. Company Logo Folder
            var logoFolder = service.BuildFolderPath(MediaAssetType.CompanyLogo, tenantId, userId);
            Assert.Equal("aquzio/tenants/11111111-1111-1111-1111-111111111111/company/logo", logoFolder);

            // 3. QC Signature Folder
            var sigFolder = service.BuildFolderPath(MediaAssetType.QcSignature, tenantId, userId);
            Assert.Equal("aquzio/tenants/11111111-1111-1111-1111-111111111111/qc/22222222-2222-2222-2222-222222222222/signature", sigFolder);

            // 4. Platform Admin (No Tenant)
            var platformUserFolder = service.BuildFolderPath(MediaAssetType.UserProfilePhoto, null, userId);
            Assert.Equal("aquzio/platform/users/22222222-2222-2222-2222-222222222222/profile", platformUserFolder);

            // 5. Documents Folder
            var docFolder = service.BuildFolderPath(MediaAssetType.Document, tenantId, null);
            Assert.Equal("aquzio/tenants/11111111-1111-1111-1111-111111111111/documents", docFolder);
        }

        [Fact]
        public async Task Test_UserProfileService_UploadAvatar_PersistsUrlAndPublicId()
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "analyst@aquzio.com",
                FirstName = "David",
                LastName = "Miller",
                PasswordHash = "hashed_pass",
                TenantId = Guid.NewGuid(),
                PhotoUrl = null,
                PhotoPublicId = null
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var expectedUrl = "https://res.cloudinary.com/dhydmxcq2/image/upload/v12345/aquzio/tenants/test/avatar.png";
            var expectedPublicId = "aquzio/tenants/test/avatar_123";

            _mockCloudinaryService.Setup(c => c.UploadImageAsync(
                It.IsAny<Stream>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                MediaAssetType.UserProfilePhoto,
                user.TenantId,
                user.Id,
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(new CloudinaryUploadResult
                {
                    Url = expectedUrl,
                    PublicId = expectedPublicId,
                    Format = "png",
                    Bytes = 1024,
                    Width = 400,
                    Height = 400
                });

            var service = new UserProfileService(
                _platformContext,
                _mockPasswordHasher.Object,
                _mockCurrentUserContext.Object,
                _mockScopeFactory.Object,
                _roleResolver,
                _mockCloudinaryService.Object);

            using var stream = new MemoryStream(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A });
            var result = await service.UploadAvatarAsync(user.Id.ToString(), stream, "avatar.png", "image/png");

            Assert.Equal(expectedUrl, result.PhotoUrl);
            Assert.Equal(expectedPublicId, result.PhotoPublicId);

            var dbUser = await _platformContext.Users.FindAsync(user.Id);
            Assert.NotNull(dbUser);
            Assert.Equal(expectedUrl, dbUser.PhotoUrl);
            Assert.Equal(expectedPublicId, dbUser.PhotoPublicId);
        }

        [Fact]
        public async Task Test_UserProfileService_ReplaceAvatar_TriggersCompensatingCleanupOfOldAsset()
        {
            var oldPublicId = "aquzio/tenants/test/old_photo_999";
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "manager@aquzio.com",
                PasswordHash = "hashed_pass",
                TenantId = Guid.NewGuid(),
                PhotoUrl = "https://res.cloudinary.com/dhydmxcq2/old.jpg",
                PhotoPublicId = oldPublicId
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var newPublicId = "aquzio/tenants/test/new_photo_111";
            var newUrl = "https://res.cloudinary.com/dhydmxcq2/new.jpg";

            _mockCloudinaryService.Setup(c => c.UploadImageAsync(
                It.IsAny<Stream>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                MediaAssetType.UserProfilePhoto,
                user.TenantId,
                user.Id,
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(new CloudinaryUploadResult
                {
                    Url = newUrl,
                    PublicId = newPublicId,
                    Format = "jpg",
                    Bytes = 2048,
                    Width = 400,
                    Height = 400
                });

            _mockCloudinaryService.Setup(c => c.DeleteAssetAsync(oldPublicId, "image", It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var service = new UserProfileService(
                _platformContext,
                _mockPasswordHasher.Object,
                _mockCurrentUserContext.Object,
                _mockScopeFactory.Object,
                _roleResolver,
                _mockCloudinaryService.Object);

            using var stream = new MemoryStream(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 });
            var result = await service.UploadAvatarAsync(user.Id.ToString(), stream, "new_photo.jpg", "image/jpeg");

            Assert.Equal(newUrl, result.PhotoUrl);
            Assert.Equal(newPublicId, result.PhotoPublicId);

            var dbUser = await _platformContext.Users.FindAsync(user.Id);
            Assert.NotNull(dbUser);
            Assert.Equal(newUrl, dbUser.PhotoUrl);
            Assert.Equal(newPublicId, dbUser.PhotoPublicId);
        }

        [Fact]
        public async Task Test_UserProfileService_RemoveAvatar_ClearsDbAndDeletesCloudinaryAsset()
        {
            var oldPublicId = "aquzio/tenants/test/photo_to_delete";
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "chemist@aquzio.com",
                PasswordHash = "hashed_pass",
                TenantId = Guid.NewGuid(),
                PhotoUrl = "https://res.cloudinary.com/dhydmxcq2/photo.jpg",
                PhotoPublicId = oldPublicId
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            _mockCloudinaryService.Setup(c => c.DeleteAssetAsync(oldPublicId, "image", It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var service = new UserProfileService(
                _platformContext,
                _mockPasswordHasher.Object,
                _mockCurrentUserContext.Object,
                _mockScopeFactory.Object,
                _roleResolver,
                _mockCloudinaryService.Object);

            var result = await service.RemoveAvatarAsync(user.Id.ToString());

            Assert.Null(result.PhotoUrl);
            Assert.Null(result.PhotoPublicId);

            var dbUser = await _platformContext.Users.FindAsync(user.Id);
            Assert.NotNull(dbUser);
            Assert.Null(dbUser.PhotoUrl);
            Assert.Null(dbUser.PhotoPublicId);

            _mockCloudinaryService.Verify(c => c.DeleteAssetAsync(oldPublicId, "image", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Test_UserProfileService_UploadSignature_PersistsSignatureUrlAndPublicId()
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "qc_analyst@aquzio.com",
                PasswordHash = "hashed_pass",
                TenantId = Guid.NewGuid(),
                SignatureUrl = null,
                SignaturePublicId = null
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var expectedUrl = "https://res.cloudinary.com/dhydmxcq2/image/upload/v12345/aquzio/tenants/qc/signature.png";
            var expectedPublicId = "aquzio/tenants/qc/signature_456";

            _mockCloudinaryService.Setup(c => c.UploadImageAsync(
                It.IsAny<Stream>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                MediaAssetType.QcSignature,
                user.TenantId,
                user.Id,
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(new CloudinaryUploadResult
                {
                    Url = expectedUrl,
                    PublicId = expectedPublicId,
                    Format = "png",
                    Bytes = 512,
                    Width = 600,
                    Height = 300
                });

            var service = new UserProfileService(
                _platformContext,
                _mockPasswordHasher.Object,
                _mockCurrentUserContext.Object,
                _mockScopeFactory.Object,
                _roleResolver,
                _mockCloudinaryService.Object);

            using var stream = new MemoryStream(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A });
            var result = await service.UploadSignatureAsync(user.Id.ToString(), stream, "sig.png", "image/png");

            Assert.Equal(expectedUrl, result.SignatureUrl);
            Assert.Equal(expectedPublicId, result.SignaturePublicId);

            var dbUser = await _platformContext.Users.FindAsync(user.Id);
            Assert.NotNull(dbUser);
            Assert.Equal(expectedUrl, dbUser.SignatureUrl);
            Assert.Equal(expectedPublicId, dbUser.SignaturePublicId);
        }
    }
}
