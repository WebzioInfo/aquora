using System;
using System.Threading.Tasks;
using Npgsql;

class Program
{
    static async Task Main(string[] args)
    {
        string connStr = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";

        await using var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        string sql = @"
            SELECT ""Id"", ""TransactionType"", ""TransactionDate"", ""CreatedAt"", ""Credit"", ""Debit"", ""Description""
            FROM ""aquora_tenant_sinan_company"".""BankLedgerEntries""
            ORDER BY ""TransactionDate"" DESC, ""CreatedAt"" DESC;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync();

        Console.WriteLine("================================================================================");
        Console.WriteLine("BankLedgerEntries in aquora_tenant_sinan_company:");
        Console.WriteLine("================================================================================");

        while (await reader.ReadAsync())
        {
            var txDate = reader.GetDateTime(2);
            var createdAt = reader.GetDateTime(3);
            Console.WriteLine($"Txn: {reader["TransactionType"]} | TxDate: {txDate:O} (Kind: {txDate.Kind}) | CreatedAt: {createdAt:O} (Kind: {createdAt.Kind}) | Cr: {reader["Credit"]} | Dr: {reader["Debit"]} | Desc: {reader["Description"]}");
        }
    }
}
