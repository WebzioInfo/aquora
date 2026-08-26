using System;
using System.Text.Json.Serialization;

namespace Aquora.Application.DTOs.Public
{
    public class PublicBatchVerificationResponseDto
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("verified")]
        public bool Verified { get; set; }

        [JsonPropertyName("code")]
        public string? Code { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }

        [JsonPropertyName("data")]
        public PublicBatchVerificationDataDto? Data { get; set; }
    }

    public class PublicBatchVerificationDataDto
    {
        [JsonPropertyName("batchNumber")]
        public string BatchNumber { get; set; } = string.Empty;

        [JsonPropertyName("manufacturer")]
        public PublicManufacturerDto Manufacturer { get; set; } = new();

        [JsonPropertyName("manufacturing")]
        public PublicManufacturingDto Manufacturing { get; set; } = new();

        [JsonPropertyName("expiry")]
        public PublicExpiryDto Expiry { get; set; } = new();

        [JsonPropertyName("licenses")]
        public PublicLicensesDto Licenses { get; set; } = new();

        [JsonPropertyName("waterQuality")]
        public PublicWaterQualityDto WaterQuality { get; set; } = new();

        [JsonPropertyName("report")]
        public PublicReportDto Report { get; set; } = new();
    }

    public class PublicManufacturingDto
    {
        [JsonPropertyName("manufacturedDate")]
        public string? ManufacturedDate { get; set; }
    }

    public class PublicExpiryDto
    {
        [JsonPropertyName("bestBefore")]
        public string? BestBefore { get; set; }

        [JsonPropertyName("shelfLifeMonths")]
        public int ShelfLifeMonths { get; set; } = 6;
    }

    public class PublicLicensesDto
    {
        [JsonPropertyName("fssai")]
        public string? Fssai { get; set; }

        [JsonPropertyName("bis")]
        public string? Bis { get; set; }
    }

    public class PublicWaterQualityDto
    {
        [JsonPropertyName("ph")]
        public string? Ph { get; set; }

        [JsonPropertyName("tds")]
        public string? Tds { get; set; }

        [JsonPropertyName("turbidity")]
        public string? Turbidity { get; set; }

        [JsonPropertyName("microbiology")]
        public string? Microbiology { get; set; }

        [JsonPropertyName("sterilization")]
        public string? Sterilization { get; set; }
    }

    public class PublicReportDto
    {
        [JsonPropertyName("available")]
        public bool Available { get; set; }

        [JsonPropertyName("publicDownloadAvailable")]
        public bool PublicDownloadAvailable { get; set; } = false;
    }
}
