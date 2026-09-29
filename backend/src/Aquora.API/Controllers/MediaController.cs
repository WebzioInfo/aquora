using System;
using System.IO;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.DTOs.Media;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class MediaController : ApiControllerBase
    {
        private readonly ICloudinaryMediaService _mediaService;
        private readonly ICurrentUserContext _userContext;

        public MediaController(
            ICloudinaryMediaService mediaService,
            ICurrentUserContext userContext)
        {
            _mediaService = mediaService;
            _userContext = userContext;
        }

        private Guid? GetCurrentUserId()
        {
            var val = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value ?? _userContext.UserId;
            return Guid.TryParse(val, out var guid) ? guid : null;
        }

        [HttpPost("upload")]
        [RequestSizeLimit(15 * 1024 * 1024)]
        public async Task<ActionResult<ApiResponse<MediaUploadResponseDto>>> UploadMedia(
            [FromForm] IFormFile file,
            [FromForm] MediaAssetType assetType = MediaAssetType.Attachment)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(Failure<MediaUploadResponseDto>("No file was provided for upload.", "Invalid File"));
            }

            var userId = GetCurrentUserId();
            var tenantId = _userContext.TenantId != Guid.Empty ? _userContext.TenantId : (Guid?)null;

            try
            {
                using var stream = file.OpenReadStream();
                CloudinaryUploadResult result;

                if (file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                {
                    result = await _mediaService.UploadImageAsync(
                        stream,
                        file.FileName,
                        file.ContentType,
                        assetType,
                        tenantId,
                        userId);
                }
                else
                {
                    result = await _mediaService.UploadRawFileAsync(
                        stream,
                        file.FileName,
                        file.ContentType,
                        assetType,
                        tenantId,
                        userId);
                }

                var response = new MediaUploadResponseDto
                {
                    Url = result.Url,
                    PublicId = result.PublicId,
                    Format = result.Format,
                    Bytes = result.Bytes,
                    Width = result.Width,
                    Height = result.Height,
                    AssetType = assetType.ToString()
                };

                return Success(response, "Media asset uploaded successfully to cloud storage.");
            }
            catch (Exception ex)
            {
                return Failure<MediaUploadResponseDto>(ex.Message, "Upload Failed");
            }
        }

        [HttpGet("transform")]
        public ActionResult<ApiResponse<string>> GetTransformedUrl(
            [FromQuery] string publicId,
            [FromQuery] int? width = null,
            [FromQuery] int? height = null,
            [FromQuery] string crop = "fill",
            [FromQuery] string quality = "auto")
        {
            if (string.IsNullOrWhiteSpace(publicId))
            {
                return BadRequest(Failure<string>("PublicId is required.", "Invalid Request"));
            }

            // Verify public ID belongs to the tenant's namespace if tenant is active
            if (_userContext.TenantId != Guid.Empty)
            {
                var expectedPrefix = $"aquzio/tenants/{_userContext.TenantId}";
                if (!publicId.StartsWith(expectedPrefix, StringComparison.OrdinalIgnoreCase) &&
                    !publicId.StartsWith("aquzio/platform", StringComparison.OrdinalIgnoreCase))
                {
                    return StatusCode(403, Failure<string>("Access to this asset namespace is forbidden.", "Forbidden"));
                }
            }

            var transformedUrl = _mediaService.GetTransformedImageUrl(publicId, width, height, crop, "auto", "auto", quality);
            return Success(transformedUrl, "Transformed URL generated.");
        }
    }
}
