# 20L PostgreSQL ledger integration tests

The `TwentyLPostgresIntegrationTests` class is tagged `PostgresIntegration` and executes the real Npgsql advisory-lock code path only when `AQUORA_20L_TEST_CONNECTION` is set. It must point to a disposable PostgreSQL database, never a shared or production database.

Create the database with PostgreSQL, set the connection string, apply tenant migrations, then run:

```powershell
$env:AQUORA_20L_TEST_CONNECTION = 'Host=localhost;Port=5432;Database=aquora_20l_tests;Username=postgres;Password=postgres'
dotnet ef database update --project ..\Aquora.Persistence\Aquora.Persistence.csproj --startup-project ..\Aquora.API\Aquora.API.csproj --context TenantDbContext
dotnet test Aquora.Tests.csproj --filter Category=PostgresIntegration
dotnet test Aquora.Tests.csproj
```

Each test uses unique tenant, company and product identifiers, so its position rows and advisory-lock keys are isolated from other tests. The test database should be recreated or reset before a CI run; migrations are the only schema initializer.
