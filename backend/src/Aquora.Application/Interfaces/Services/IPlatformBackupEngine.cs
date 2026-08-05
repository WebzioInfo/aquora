using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Administration;

namespace Aquora.Application.Interfaces.Services
{
    public interface IPlatformBackupEngine
    {
        Task<byte[]> BuildPlatformBackupZipAsync(
            Guid jobId,
            Guid backupId,
            string backupName,
            string createdUserId,
            string createdUserName,
            List<string> targetSchemas,
            bool includePublic,
            bool encrypt
        );

        Task<PlatformBackupManifestDto?> ReadManifestFromZipAsync(byte[] zipBytes);
        Task<bool> VerifyZipChecksumAsync(byte[] zipBytes);
        Task RestorePlatformZipAsync(byte[] zipBytes, List<string> targetSchemasToRestore);
    }
}
