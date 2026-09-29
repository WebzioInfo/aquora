using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Media;

namespace Aquora.Application.Interfaces.Services
{
    public interface ICloudinaryMediaService
    {
        Task<CloudinaryUploadResult> UploadImageAsync(
            Stream fileStream,
            string fileName,
            string contentType,
            MediaAssetType assetType,
            Guid? tenantId = null,
            Guid? userId = null,
            CancellationToken cancellationToken = default);

        Task<CloudinaryUploadResult> UploadRawFileAsync(
            Stream fileStream,
            string fileName,
            string contentType,
            MediaAssetType assetType,
            Guid? tenantId = null,
            Guid? userId = null,
            CancellationToken cancellationToken = default);

        Task<bool> DeleteAssetAsync(
            string publicId,
            string resourceType = "image",
            CancellationToken cancellationToken = default);

        string GetTransformedImageUrl(
            string publicId,
            int? width = null,
            int? height = null,
            string crop = "fill",
            string gravity = "auto",
            string format = "auto",
            string quality = "auto");

        string BuildFolderPath(MediaAssetType assetType, Guid? tenantId, Guid? userId);
    }
}
