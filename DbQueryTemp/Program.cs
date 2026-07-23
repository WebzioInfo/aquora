using System;
using Npgsql;

var connString = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";
await using var conn = new NpgsqlConnection(connString);
await conn.OpenAsync();

var schemas = new[] {
    "aquora_tenant_code_company",
    "aquora_tenant_developer_company",
    "aquora_tenant_developer_company_2",
    "aquora_tenant_developer_company_3",
    "aquora_tenant_test_company",
    "aquora_tenant_test_company_2"
};

foreach (var s in schemas)
{
    Console.WriteLine($"\n--- Checking schema: {s} ---");
    try
    {
        await using var cmd = new NpgsqlCommand($"SELECT \"Id\", \"Code\", \"Name\", \"IsActive\", \"IsDeleted\", \"CreatedAt\" FROM \"{s}\".\"ProductionLines\"", conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        bool found = false;
        while (await reader.ReadAsync())
        {
            found = true;
            Console.WriteLine($"Id: {reader["Id"]}, Code: {reader["Code"]}, Name: {reader["Name"]}, IsActive: {reader["IsActive"]}, IsDeleted: {reader["IsDeleted"]}, CreatedAt: {reader["CreatedAt"]}");
        }
        if (!found) Console.WriteLine("No records found.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error: {ex.Message}");
    }
}
