import os

file_path = r"backend\src\Aquora.Persistence\Migrations\Tenant\20260627064756_InitialTenant.cs"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

output = []
for i, line in enumerate(lines):
    # Fix import lines
    if "`n" in line or "using Aquora.Persistence.Context;" in line:
        continue
    
    # Replace schema: "public"
    line = line.replace('schema: "public"', 'schema: _schema')
    line = line.replace('name: "public"', 'name: _schema')
    
    # Check for principalSchema
    if 'principalSchema: "public"' in line:
        # Find principalTable in the next few lines
        is_platform = False
        for j in range(1, 5):
            if i + j < len(lines):
                next_line = lines[i + j]
                if 'principalTable: "Tenants"' in next_line or 'principalTable: "Users"' in next_line:
                    is_platform = True
                    break
        if not is_platform:
            line = line.replace('principalSchema: "public"', 'principalSchema: _schema')
            
    output.append(line)

# Add imports and fields clean
result = "using System;\nusing Microsoft.EntityFrameworkCore.Migrations;\nusing Aquora.Persistence.Context;\n"
body_started = False
for line in output:
    if "namespace Aquora.Persistence.Migrations.Tenant" in line:
        body_started = True
    if body_started:
        if "public partial class InitialTenant : Migration" in line:
            result += "    public partial class InitialTenant : Migration\n    {\n        private readonly string _schema = TenantSchemaResolver.CurrentSchemaName ?? \"public\";\n"
            continue
        result += line

with open(file_path, "w", encoding="utf-8") as f:
    f.write(result)

print("Patch applied successfully!")
