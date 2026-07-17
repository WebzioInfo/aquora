using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Platform
{
    /// <inheritdoc />
    public partial class UpdateOTPVerificationSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Code",
                schema: "public",
                table: "OTPVerifications",
                newName: "RequestId");

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: "public",
                table: "OTPVerifications",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "OtpHash",
                schema: "public",
                table: "OTPVerifications",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: "public",
                table: "OTPVerifications");

            migrationBuilder.DropColumn(
                name: "OtpHash",
                schema: "public",
                table: "OTPVerifications");

            migrationBuilder.RenameColumn(
                name: "RequestId",
                schema: "public",
                table: "OTPVerifications",
                newName: "Code");
        }
    }
}
