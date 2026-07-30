using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    [DbContext(typeof(TenantDbContext))]
    [Migration("20260730101010_RemoveObsoleteProductPricing")]
    partial class RemoveObsoleteProductPricing
    {
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            // Left intentionally blank because the full snapshot handles the state
            // The EF Core runtime only checks the [Migration] attribute and Up/Down methods.
#pragma warning restore 612, 618
        }
    }
}
