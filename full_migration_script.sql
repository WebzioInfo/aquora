DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'aquora_tenant_greenmount_aqua') THEN
        CREATE SCHEMA aquora_tenant_greenmount_aqua;
    END IF;
END $EF$;
CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;
DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'aquora_tenant_greenmount_aqua') THEN
        CREATE SCHEMA aquora_tenant_greenmount_aqua;
    END IF;
END $EF$;

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."AuditLogs" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "UserId" text,
    "UserEmail" text,
    "Action" text,
    "TableName" text,
    "PrimaryKey" text,
    "OldValues" text,
    "NewValues" text,
    "Timestamp" timestamp with time zone NOT NULL,
    "IpAddress" text,
    "Device" text,
    "Reason" text,
    "Module" text,
    CONSTRAINT "PK_AuditLogs" PRIMARY KEY ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Companies" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Companies" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Companies_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Permissions" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    CONSTRAINT "PK_Permissions" PRIMARY KEY ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Roles" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "TenantId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Roles" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Roles_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."TenantDomain" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "Domain" text NOT NULL,
    "IsPrimary" boolean NOT NULL,
    "IsActive" boolean NOT NULL,
    CONSTRAINT "PK_TenantDomain" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_TenantDomain_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Plants" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Plants" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Plants_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Plants_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."RolePermissions" (
    "Id" uuid NOT NULL,
    "RoleId" uuid NOT NULL,
    "PermissionId" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    CONSTRAINT "PK_RolePermissions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_RolePermissions_Permissions_PermissionId" FOREIGN KEY ("PermissionId") REFERENCES aquora_tenant_greenmount_aqua."Permissions" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_RolePermissions_Roles_RoleId" FOREIGN KEY ("RoleId") REFERENCES aquora_tenant_greenmount_aqua."Roles" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_RolePermissions_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."UserRoles" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "RoleId" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    CONSTRAINT "PK_UserRoles" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_UserRoles_Roles_RoleId" FOREIGN KEY ("RoleId") REFERENCES aquora_tenant_greenmount_aqua."Roles" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_UserRoles_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_UserRoles_Users_UserId" FOREIGN KEY ("UserId") REFERENCES public."Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Departments" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "PlantId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Departments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Departments_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Departments_Plants_PlantId" FOREIGN KEY ("PlantId") REFERENCES aquora_tenant_greenmount_aqua."Plants" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Departments_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."ProductionLines" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "PlantId" uuid NOT NULL,
    "DepartmentId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_ProductionLines" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProductionLines_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionLines_Departments_DepartmentId" FOREIGN KEY ("DepartmentId") REFERENCES aquora_tenant_greenmount_aqua."Departments" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionLines_Plants_PlantId" FOREIGN KEY ("PlantId") REFERENCES aquora_tenant_greenmount_aqua."Plants" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionLines_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Stations" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "PlantId" uuid NOT NULL,
    "ProductionLineId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Stations" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Stations_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Stations_Plants_PlantId" FOREIGN KEY ("PlantId") REFERENCES aquora_tenant_greenmount_aqua."Plants" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Stations_ProductionLines_ProductionLineId" FOREIGN KEY ("ProductionLineId") REFERENCES aquora_tenant_greenmount_aqua."ProductionLines" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Stations_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Machines" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "PlantId" uuid NOT NULL,
    "StationId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Machines" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Machines_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Machines_Plants_PlantId" FOREIGN KEY ("PlantId") REFERENCES aquora_tenant_greenmount_aqua."Plants" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Machines_Stations_StationId" FOREIGN KEY ("StationId") REFERENCES aquora_tenant_greenmount_aqua."Stations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Machines_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_Companies_TenantId" ON aquora_tenant_greenmount_aqua."Companies" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_Departments_CompanyId" ON aquora_tenant_greenmount_aqua."Departments" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_Departments_PlantId" ON aquora_tenant_greenmount_aqua."Departments" ("PlantId");

CREATE INDEX IF NOT EXISTS "IX_Departments_TenantId" ON aquora_tenant_greenmount_aqua."Departments" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_Machines_CompanyId" ON aquora_tenant_greenmount_aqua."Machines" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_Machines_PlantId" ON aquora_tenant_greenmount_aqua."Machines" ("PlantId");

CREATE INDEX IF NOT EXISTS "IX_Machines_StationId" ON aquora_tenant_greenmount_aqua."Machines" ("StationId");

CREATE INDEX IF NOT EXISTS "IX_Machines_TenantId" ON aquora_tenant_greenmount_aqua."Machines" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_Plants_CompanyId" ON aquora_tenant_greenmount_aqua."Plants" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_Plants_TenantId" ON aquora_tenant_greenmount_aqua."Plants" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_ProductionLines_CompanyId" ON aquora_tenant_greenmount_aqua."ProductionLines" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_ProductionLines_DepartmentId" ON aquora_tenant_greenmount_aqua."ProductionLines" ("DepartmentId");

CREATE INDEX IF NOT EXISTS "IX_ProductionLines_PlantId" ON aquora_tenant_greenmount_aqua."ProductionLines" ("PlantId");

CREATE INDEX IF NOT EXISTS "IX_ProductionLines_TenantId" ON aquora_tenant_greenmount_aqua."ProductionLines" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_RolePermissions_PermissionId" ON aquora_tenant_greenmount_aqua."RolePermissions" ("PermissionId");

CREATE INDEX IF NOT EXISTS "IX_RolePermissions_RoleId_PermissionId" ON aquora_tenant_greenmount_aqua."RolePermissions" ("RoleId", "PermissionId");

CREATE INDEX IF NOT EXISTS "IX_RolePermissions_TenantId" ON aquora_tenant_greenmount_aqua."RolePermissions" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_Roles_TenantId" ON aquora_tenant_greenmount_aqua."Roles" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_Stations_CompanyId" ON aquora_tenant_greenmount_aqua."Stations" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_Stations_PlantId" ON aquora_tenant_greenmount_aqua."Stations" ("PlantId");

CREATE INDEX IF NOT EXISTS "IX_Stations_ProductionLineId" ON aquora_tenant_greenmount_aqua."Stations" ("ProductionLineId");

CREATE INDEX IF NOT EXISTS "IX_Stations_TenantId" ON aquora_tenant_greenmount_aqua."Stations" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_TenantDomain_TenantId" ON aquora_tenant_greenmount_aqua."TenantDomain" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_UserRoles_RoleId" ON aquora_tenant_greenmount_aqua."UserRoles" ("RoleId");

CREATE INDEX IF NOT EXISTS "IX_UserRoles_TenantId" ON aquora_tenant_greenmount_aqua."UserRoles" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_UserRoles_UserId_RoleId" ON aquora_tenant_greenmount_aqua."UserRoles" ("UserId", "RoleId");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260627064756_InitialTenant', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP CONSTRAINT IF EXISTS "FK_Companies_Tenants_TenantId";

ALTER TABLE aquora_tenant_greenmount_aqua."Departments" DROP CONSTRAINT IF EXISTS "FK_Departments_Tenants_TenantId";

ALTER TABLE aquora_tenant_greenmount_aqua."Machines" DROP CONSTRAINT IF EXISTS "FK_Machines_Tenants_TenantId";

ALTER TABLE aquora_tenant_greenmount_aqua."Plants" DROP CONSTRAINT IF EXISTS "FK_Plants_Tenants_TenantId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionLines" DROP CONSTRAINT IF EXISTS "FK_ProductionLines_Tenants_TenantId";

ALTER TABLE aquora_tenant_greenmount_aqua."RolePermissions" DROP CONSTRAINT IF EXISTS "FK_RolePermissions_Tenants_TenantId";

ALTER TABLE aquora_tenant_greenmount_aqua."Roles" DROP CONSTRAINT IF EXISTS "FK_Roles_Tenants_TenantId";

ALTER TABLE aquora_tenant_greenmount_aqua."Stations" DROP CONSTRAINT IF EXISTS "FK_Stations_Tenants_TenantId";

ALTER TABLE aquora_tenant_greenmount_aqua."TenantDomain" DROP CONSTRAINT IF EXISTS "FK_TenantDomain_Tenants_TenantId";

ALTER TABLE aquora_tenant_greenmount_aqua."UserRoles" DROP CONSTRAINT IF EXISTS "FK_UserRoles_Tenants_TenantId";

ALTER TABLE aquora_tenant_greenmount_aqua."UserRoles" DROP CONSTRAINT IF EXISTS "FK_UserRoles_Users_UserId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_UserRoles_TenantId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_Stations_TenantId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_Roles_TenantId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_RolePermissions_TenantId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_ProductionLines_TenantId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_Plants_TenantId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_Machines_TenantId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_Departments_TenantId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_Companies_TenantId";

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260627110913_TenantModelSync', '10.0.9');

COMMIT;

START TRANSACTION;
CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."ProductionBatches" (
    "Id" uuid NOT NULL,
    "BatchNumber" text NOT NULL,
    "Product" text NOT NULL,
    "Shift" text NOT NULL,
    "ProductionLineId" uuid NOT NULL,
    "OperatorId" uuid NOT NULL,
    "OperatorName" text NOT NULL,
    "StartedAt" timestamp with time zone NOT NULL,
    "CompletedAt" timestamp with time zone,
    "Status" text NOT NULL,
    "TargetQuantity" integer NOT NULL,
    "ProducedQuantity" integer NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "PlantId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_ProductionBatches" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProductionBatches_ProductionLines_ProductionLineId" FOREIGN KEY ("ProductionLineId") REFERENCES aquora_tenant_greenmount_aqua."ProductionLines" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."ProductionStationData" (
    "Id" uuid NOT NULL,
    "ProductionBatchId" uuid NOT NULL,
    "StationCode" text NOT NULL,
    "OperatorName" text NOT NULL,
    "Timestamp" timestamp with time zone NOT NULL,
    "InputQty" integer NOT NULL,
    "OutputQty" integer NOT NULL,
    "WastageQty" integer NOT NULL,
    "Efficiency" double precision NOT NULL,
    "AdditionalData" text,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "PlantId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_ProductionStationData" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProductionStationData_ProductionBatches_ProductionBatchId" FOREIGN KEY ("ProductionBatchId") REFERENCES aquora_tenant_greenmount_aqua."ProductionBatches" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_ProductionBatches_ProductionLineId" ON aquora_tenant_greenmount_aqua."ProductionBatches" ("ProductionLineId");

CREATE INDEX IF NOT EXISTS "IX_ProductionStationData_ProductionBatchId" ON aquora_tenant_greenmount_aqua."ProductionStationData" ("ProductionBatchId");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260629105023_AddProductionBatches', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."Machines" DROP CONSTRAINT IF EXISTS "FK_Machines_Plants_PlantId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionLines" DROP CONSTRAINT IF EXISTS "FK_ProductionLines_Departments_DepartmentId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionLines" DROP CONSTRAINT IF EXISTS "FK_ProductionLines_Plants_PlantId";

ALTER TABLE aquora_tenant_greenmount_aqua."Stations" DROP CONSTRAINT IF EXISTS "FK_Stations_Plants_PlantId";

DROP TABLE IF EXISTS aquora_tenant_greenmount_aqua."Departments";

DROP TABLE IF EXISTS aquora_tenant_greenmount_aqua."Plants";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_Stations_PlantId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_ProductionLines_DepartmentId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_ProductionLines_PlantId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_Machines_PlantId";

ALTER TABLE aquora_tenant_greenmount_aqua."Stations" DROP COLUMN IF EXISTS "PlantId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionStationData" DROP COLUMN IF EXISTS "PlantId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionLines" DROP COLUMN IF EXISTS "DepartmentId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionLines" DROP COLUMN IF EXISTS "PlantId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionBatches" DROP COLUMN IF EXISTS "PlantId";

ALTER TABLE aquora_tenant_greenmount_aqua."Machines" DROP COLUMN IF EXISTS "PlantId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionLines" ADD COLUMN IF NOT EXISTS "Description" text;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260630050627_RemovePlantAndDepartment', '10.0.9');

COMMIT;

START TRANSACTION;
CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."CaseConfigurations" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_CaseConfigurations" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_CaseConfigurations_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."RawMaterials" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "Category" text NOT NULL,
    "Unit" text NOT NULL,
    "BaseUnit" text NOT NULL,
    "ConversionFactor" numeric NOT NULL,
    "CurrentStock" numeric NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_RawMaterials" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_RawMaterials_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."SkuProducts" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_SkuProducts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SkuProducts_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."InventoryMovements" (
    "Id" uuid NOT NULL,
    "RawMaterialId" uuid NOT NULL,
    "Quantity" numeric NOT NULL,
    "ReferenceType" text NOT NULL,
    "ReferenceId" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_InventoryMovements" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_InventoryMovements_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_InventoryMovements_RawMaterials_RawMaterialId" FOREIGN KEY ("RawMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."ProductionEntries" (
    "Id" uuid NOT NULL,
    "OperatorId" uuid NOT NULL,
    "OperatorName" text NOT NULL,
    "ProductionLineId" uuid NOT NULL,
    "Shift" text NOT NULL,
    "Date" timestamp with time zone NOT NULL,
    "Time" text NOT NULL,
    "SkuProductId" uuid NOT NULL,
    "CaseConfigurationId" uuid NOT NULL,
    "CasesProduced" integer NOT NULL,
    "PreformMaterialId" uuid NOT NULL,
    "PreformUsage" numeric NOT NULL,
    "PreformWastage" numeric NOT NULL,
    "LabelMaterialId" uuid NOT NULL,
    "LabelUsage" numeric NOT NULL,
    "LabelWastage" numeric NOT NULL,
    "ShrinkMaterialId" uuid NOT NULL,
    "ShrinkUsage" numeric NOT NULL,
    "ShrinkWastage" numeric NOT NULL,
    "GlueMaterialId" uuid,
    "GlueUsage" numeric,
    "InkUsed" boolean NOT NULL,
    "MakeupUsed" boolean NOT NULL,
    "InventoryMovementIds" text NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_ProductionEntries" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProductionEntries_CaseConfigurations_CaseConfigurationId" FOREIGN KEY ("CaseConfigurationId") REFERENCES aquora_tenant_greenmount_aqua."CaseConfigurations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionEntries_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionEntries_ProductionLines_ProductionLineId" FOREIGN KEY ("ProductionLineId") REFERENCES aquora_tenant_greenmount_aqua."ProductionLines" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionEntries_RawMaterials_GlueMaterialId" FOREIGN KEY ("GlueMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id"),
    CONSTRAINT "FK_ProductionEntries_RawMaterials_LabelMaterialId" FOREIGN KEY ("LabelMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionEntries_RawMaterials_PreformMaterialId" FOREIGN KEY ("PreformMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionEntries_RawMaterials_ShrinkMaterialId" FOREIGN KEY ("ShrinkMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionEntries_SkuProducts_SkuProductId" FOREIGN KEY ("SkuProductId") REFERENCES aquora_tenant_greenmount_aqua."SkuProducts" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_CaseConfigurations_CompanyId" ON aquora_tenant_greenmount_aqua."CaseConfigurations" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_InventoryMovements_CompanyId" ON aquora_tenant_greenmount_aqua."InventoryMovements" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_InventoryMovements_RawMaterialId" ON aquora_tenant_greenmount_aqua."InventoryMovements" ("RawMaterialId");

CREATE INDEX IF NOT EXISTS "IX_ProductionEntries_CaseConfigurationId" ON aquora_tenant_greenmount_aqua."ProductionEntries" ("CaseConfigurationId");

CREATE INDEX IF NOT EXISTS "IX_ProductionEntries_CompanyId" ON aquora_tenant_greenmount_aqua."ProductionEntries" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_ProductionEntries_GlueMaterialId" ON aquora_tenant_greenmount_aqua."ProductionEntries" ("GlueMaterialId");

CREATE INDEX IF NOT EXISTS "IX_ProductionEntries_LabelMaterialId" ON aquora_tenant_greenmount_aqua."ProductionEntries" ("LabelMaterialId");

CREATE INDEX IF NOT EXISTS "IX_ProductionEntries_PreformMaterialId" ON aquora_tenant_greenmount_aqua."ProductionEntries" ("PreformMaterialId");

CREATE INDEX IF NOT EXISTS "IX_ProductionEntries_ProductionLineId" ON aquora_tenant_greenmount_aqua."ProductionEntries" ("ProductionLineId");

CREATE INDEX IF NOT EXISTS "IX_ProductionEntries_ShrinkMaterialId" ON aquora_tenant_greenmount_aqua."ProductionEntries" ("ShrinkMaterialId");

CREATE INDEX IF NOT EXISTS "IX_ProductionEntries_SkuProductId" ON aquora_tenant_greenmount_aqua."ProductionEntries" ("SkuProductId");

CREATE INDEX IF NOT EXISTS "IX_RawMaterials_CompanyId" ON aquora_tenant_greenmount_aqua."RawMaterials" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_SkuProducts_CompanyId" ON aquora_tenant_greenmount_aqua."SkuProducts" ("CompanyId");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260702102023_AddOperatorTerminal', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD COLUMN IF NOT EXISTS "ProductionSessionId" uuid;

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."ProductionSessions" (
    "Id" uuid NOT NULL,
    "BatchNumber" text NOT NULL,
    "ProductionLineId" uuid NOT NULL,
    "OperatorId" uuid NOT NULL,
    "OperatorName" text NOT NULL,
    "Shift" text NOT NULL,
    "SkuProductId" uuid NOT NULL,
    "CaseConfigurationId" uuid NOT NULL,
    "StartedAt" timestamp with time zone NOT NULL,
    "EndedAt" timestamp with time zone,
    "Status" text NOT NULL,
    "Remarks" text,
    "TotalCasesProduced" integer NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_ProductionSessions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProductionSessions_CaseConfigurations_CaseConfigurationId" FOREIGN KEY ("CaseConfigurationId") REFERENCES aquora_tenant_greenmount_aqua."CaseConfigurations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionSessions_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionSessions_ProductionLines_ProductionLineId" FOREIGN KEY ("ProductionLineId") REFERENCES aquora_tenant_greenmount_aqua."ProductionLines" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductionSessions_SkuProducts_SkuProductId" FOREIGN KEY ("SkuProductId") REFERENCES aquora_tenant_greenmount_aqua."SkuProducts" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_ProductionEntries_ProductionSessionId" ON aquora_tenant_greenmount_aqua."ProductionEntries" ("ProductionSessionId");

CREATE INDEX IF NOT EXISTS "IX_ProductionSessions_CaseConfigurationId" ON aquora_tenant_greenmount_aqua."ProductionSessions" ("CaseConfigurationId");

CREATE INDEX IF NOT EXISTS "IX_ProductionSessions_CompanyId" ON aquora_tenant_greenmount_aqua."ProductionSessions" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_ProductionSessions_ProductionLineId" ON aquora_tenant_greenmount_aqua."ProductionSessions" ("ProductionLineId");

CREATE INDEX IF NOT EXISTS "IX_ProductionSessions_SkuProductId" ON aquora_tenant_greenmount_aqua."ProductionSessions" ("SkuProductId");

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD CONSTRAINT "FK_ProductionEntries_ProductionSessions_ProductionSessionId" FOREIGN KEY ("ProductionSessionId") REFERENCES aquora_tenant_greenmount_aqua."ProductionSessions" ("Id");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260702104109_AddProductionSession', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."RawMaterials" ADD COLUMN IF NOT EXISTS "IsActive" boolean NOT NULL DEFAULT TRUE;


                CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Brands" (
                    "Id" uuid NOT NULL,
                    "Name" text NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "CreatedBy" text NOT NULL,
                    "UpdatedAt" timestamp with time zone,
                    "UpdatedBy" text,
                    "IsDeleted" boolean NOT NULL,
                    "DeletedAt" timestamp with time zone,
                    "DeletedBy" text,
                    CONSTRAINT "PK_Brands" PRIMARY KEY ("Id")
                );
            


                CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Products" (
                    "Id" uuid NOT NULL,
                    "Name" text NOT NULL,
                    "BrandId" uuid NOT NULL,
                    "SKU" text,
                    "IsActive" boolean NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "CreatedBy" text NOT NULL,
                    "UpdatedAt" timestamp with time zone,
                    "UpdatedBy" text,
                    "IsDeleted" boolean NOT NULL,
                    "DeletedAt" timestamp with time zone,
                    "DeletedBy" text,
                    CONSTRAINT "PK_Products" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_Products_Brands_BrandId" FOREIGN KEY ("BrandId") REFERENCES aquora_tenant_greenmount_aqua."Brands" ("Id") ON DELETE CASCADE
                );
            

CREATE INDEX IF NOT EXISTS "IX_RawMaterials_Category" ON aquora_tenant_greenmount_aqua."RawMaterials" ("Category");

CREATE UNIQUE INDEX IF NOT EXISTS "IX_RawMaterials_Name" ON aquora_tenant_greenmount_aqua."RawMaterials" ("Name");

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Brands_Name" ON aquora_tenant_greenmount_aqua."Brands" ("Name");

CREATE INDEX IF NOT EXISTS "IX_Products_BrandId" ON aquora_tenant_greenmount_aqua."Products" ("BrandId");

CREATE INDEX IF NOT EXISTS "IX_Products_Name" ON aquora_tenant_greenmount_aqua."Products" ("Name");

CREATE INDEX IF NOT EXISTS "IX_Products_Name_BrandId" ON aquora_tenant_greenmount_aqua."Products" ("Name", "BrandId");

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Products_SKU" ON aquora_tenant_greenmount_aqua."Products" ("SKU") WHERE "SKU" IS NOT NULL;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260703081504_AddInventoryMasterData', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."Brands" ALTER COLUMN "Name" TYPE character varying(150);

ALTER TABLE aquora_tenant_greenmount_aqua."Brands" ADD COLUMN IF NOT EXISTS "Code" character varying(50);

ALTER TABLE aquora_tenant_greenmount_aqua."Brands" ADD COLUMN IF NOT EXISTS "Description" character varying(500);

ALTER TABLE aquora_tenant_greenmount_aqua."Brands" ADD COLUMN IF NOT EXISTS "IsActive" boolean NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Brands_Code" ON aquora_tenant_greenmount_aqua."Brands" ("Code");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260703093829_UpdateBrandEntity_V2', '10.0.9');

COMMIT;

START TRANSACTION;

                ALTER TABLE aquora_tenant_greenmount_aqua."Brands" DROP COLUMN IF EXISTS "TenantId" CASCADE;
                ALTER TABLE aquora_tenant_greenmount_aqua."Brands" DROP COLUMN IF EXISTS "CompanyId" CASCADE;
                ALTER TABLE aquora_tenant_greenmount_aqua."Products" DROP COLUMN IF EXISTS "TenantId" CASCADE;
                ALTER TABLE aquora_tenant_greenmount_aqua."Products" DROP COLUMN IF EXISTS "CompanyId" CASCADE;
            

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260704083504_RemoveGhostColumns', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" DROP CONSTRAINT IF EXISTS "FK_ProductionEntries_CaseConfigurations_CaseConfigurationId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionSessions" DROP CONSTRAINT IF EXISTS "FK_ProductionSessions_CaseConfigurations_CaseConfigurationId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_ProductionSessions_CaseConfigurationId";

DROP INDEX IF EXISTS aquora_tenant_greenmount_aqua."IX_ProductionEntries_CaseConfigurationId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionSessions" DROP COLUMN IF EXISTS "CaseConfigurationId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" DROP COLUMN IF EXISTS "CaseConfigurationId";

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260710044543_RemoveCaseConfigurationLink', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" DROP CONSTRAINT IF EXISTS "FK_ProductionEntries_SkuProducts_SkuProductId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionSessions" DROP CONSTRAINT IF EXISTS "FK_ProductionSessions_SkuProducts_SkuProductId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionSessions" RENAME COLUMN "SkuProductId" TO "ProductId";

ALTER INDEX aquora_tenant_greenmount_aqua."IX_ProductionSessions_SkuProductId" RENAME TO "IX_ProductionSessions_ProductId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" RENAME COLUMN "SkuProductId" TO "ProductId";

ALTER INDEX aquora_tenant_greenmount_aqua."IX_ProductionEntries_SkuProductId" RENAME TO "IX_ProductionEntries_ProductId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD CONSTRAINT "FK_ProductionEntries_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES aquora_tenant_greenmount_aqua."Products" ("Id") ON DELETE CASCADE;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionSessions" ADD CONSTRAINT "FK_ProductionSessions_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES aquora_tenant_greenmount_aqua."Products" ("Id") ON DELETE CASCADE;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260710053938_LinkSessionToProduct', '10.0.9');

COMMIT;

START TRANSACTION;
INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260711054828_AddOperatorContextLog', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD COLUMN IF NOT EXISTS "CapMaterialId" uuid;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD COLUMN IF NOT EXISTS "CapUsage" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD COLUMN IF NOT EXISTS "CapWastage" numeric NOT NULL DEFAULT 0.0;

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperatorContextLogs" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "OldLineId" uuid,
    "NewLineId" uuid NOT NULL,
    "ChangedAt" timestamp with time zone NOT NULL,
    "Device" text NOT NULL,
    "IPAddress" text NOT NULL,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_OperatorContextLogs" PRIMARY KEY ("Id")
);

CREATE INDEX IF NOT EXISTS "IX_ProductionEntries_CapMaterialId" ON aquora_tenant_greenmount_aqua."ProductionEntries" ("CapMaterialId");

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD CONSTRAINT "FK_ProductionEntries_RawMaterials_CapMaterialId" FOREIGN KEY ("CapMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260711120118_AddCapToProductionEntry', '10.0.9');

COMMIT;

START TRANSACTION;
CREATE INDEX IF NOT EXISTS "IX_InventoryMovements_CreatedAt" ON aquora_tenant_greenmount_aqua."InventoryMovements" ("CreatedAt");

CREATE INDEX IF NOT EXISTS "IX_InventoryMovements_ReferenceType_ReferenceId" ON aquora_tenant_greenmount_aqua."InventoryMovements" ("ReferenceType", "ReferenceId");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260713090818_AddInventoryPerformanceIndexes', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."InventoryMovements" ADD COLUMN IF NOT EXISTS "Notes" text;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260714060850_AddNotesToInventoryMovements', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."InventoryMovements" DROP CONSTRAINT IF EXISTS "FK_InventoryMovements_RawMaterials_RawMaterialId";

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "CurrentStock" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."InventoryMovements" ALTER COLUMN "RawMaterialId" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."InventoryMovements" ADD COLUMN IF NOT EXISTS "InventoryType" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."InventoryMovements" ADD COLUMN IF NOT EXISTS "ProductId" uuid;

CREATE INDEX IF NOT EXISTS "IX_InventoryMovements_InventoryType" ON aquora_tenant_greenmount_aqua."InventoryMovements" ("InventoryType");

CREATE INDEX IF NOT EXISTS "IX_InventoryMovements_ProductId" ON aquora_tenant_greenmount_aqua."InventoryMovements" ("ProductId");

ALTER TABLE aquora_tenant_greenmount_aqua."InventoryMovements" ADD CONSTRAINT "FK_InventoryMovements_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES aquora_tenant_greenmount_aqua."Products" ("Id");

ALTER TABLE aquora_tenant_greenmount_aqua."InventoryMovements" ADD CONSTRAINT "FK_InventoryMovements_RawMaterials_RawMaterialId" FOREIGN KEY ("RawMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260714062349_AddProductStockAndMovements', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" DROP CONSTRAINT IF EXISTS "FK_ProductionEntries_RawMaterials_LabelMaterialId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" DROP CONSTRAINT IF EXISTS "FK_ProductionEntries_RawMaterials_PreformMaterialId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" DROP CONSTRAINT IF EXISTS "FK_ProductionEntries_RawMaterials_ShrinkMaterialId";

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ALTER COLUMN "ShrinkMaterialId" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ALTER COLUMN "PreformMaterialId" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ALTER COLUMN "LabelMaterialId" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD CONSTRAINT "FK_ProductionEntries_RawMaterials_LabelMaterialId" FOREIGN KEY ("LabelMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id");

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD CONSTRAINT "FK_ProductionEntries_RawMaterials_PreformMaterialId" FOREIGN KEY ("PreformMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id");

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD CONSTRAINT "FK_ProductionEntries_RawMaterials_ShrinkMaterialId" FOREIGN KEY ("ShrinkMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260716054445_MakeProductionEntryMaterialsNullable', '10.0.9');

COMMIT;

START TRANSACTION;
CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Customers" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "CustomerCode" character varying(50) NOT NULL,
    "CustomerType" text NOT NULL,
    "CustomerName" character varying(150) NOT NULL,
    "BusinessName" text,
    "ContactPerson" text,
    "Phone" character varying(20) NOT NULL,
    "AlternatePhone" text,
    "Email" text,
    "GSTNumber" text,
    "PANNumber" text,
    "BusinessType" text,
    "GSTState" text,
    "AddressLine1" text NOT NULL,
    "AddressLine2" text,
    "City" text NOT NULL,
    "District" text NOT NULL,
    "State" text NOT NULL,
    "Country" text NOT NULL,
    "PinCode" text NOT NULL,
    "OpeningBalance" numeric NOT NULL,
    "BalanceType" text NOT NULL,
    "CreditLimit" numeric NOT NULL,
    "PaymentTerms" text NOT NULL,
    "Status" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "Remarks" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Customers" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Customers_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_Customers_BusinessName" ON aquora_tenant_greenmount_aqua."Customers" ("BusinessName");

CREATE INDEX IF NOT EXISTS "IX_Customers_City" ON aquora_tenant_greenmount_aqua."Customers" ("City");

CREATE INDEX IF NOT EXISTS "IX_Customers_CompanyId" ON aquora_tenant_greenmount_aqua."Customers" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_Customers_CustomerName" ON aquora_tenant_greenmount_aqua."Customers" ("CustomerName");

CREATE INDEX IF NOT EXISTS "IX_Customers_CustomerType" ON aquora_tenant_greenmount_aqua."Customers" ("CustomerType");

CREATE INDEX IF NOT EXISTS "IX_Customers_State" ON aquora_tenant_greenmount_aqua."Customers" ("State");

CREATE INDEX IF NOT EXISTS "IX_Customers_Status" ON aquora_tenant_greenmount_aqua."Customers" ("Status");

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Customers_TenantId_CustomerCode" ON aquora_tenant_greenmount_aqua."Customers" ("TenantId", "CustomerCode") WHERE "IsDeleted" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Customers_TenantId_GSTNumber" ON aquora_tenant_greenmount_aqua."Customers" ("TenantId", "GSTNumber") WHERE "IsDeleted" = false AND "GSTNumber" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Customers_TenantId_Phone" ON aquora_tenant_greenmount_aqua."Customers" ("TenantId", "Phone") WHERE "IsDeleted" = false;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260716092526_AddCustomerTable', '10.0.9');

COMMIT;

START TRANSACTION;
DROP TABLE IF EXISTS aquora_tenant_greenmount_aqua."Machines";

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."SalesTransactions" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "TransactionNumber" character varying(50) NOT NULL,
    "CustomerId" uuid NOT NULL,
    "ProductId" uuid NOT NULL,
    "Cases" numeric NOT NULL,
    "TransactionType" character varying(50) NOT NULL,
    "TransactionDate" timestamp with time zone NOT NULL,
    "ReferenceNumber" text,
    "Remarks" text,
    "Status" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_SalesTransactions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SalesTransactions_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_SalesTransactions_Customers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES aquora_tenant_greenmount_aqua."Customers" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_SalesTransactions_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES aquora_tenant_greenmount_aqua."Products" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_SalesTransactions_CompanyId" ON aquora_tenant_greenmount_aqua."SalesTransactions" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_SalesTransactions_CreatedAt" ON aquora_tenant_greenmount_aqua."SalesTransactions" ("CreatedAt");

CREATE INDEX IF NOT EXISTS "IX_SalesTransactions_CustomerId" ON aquora_tenant_greenmount_aqua."SalesTransactions" ("CustomerId");

CREATE INDEX IF NOT EXISTS "IX_SalesTransactions_ProductId" ON aquora_tenant_greenmount_aqua."SalesTransactions" ("ProductId");

CREATE INDEX IF NOT EXISTS "IX_SalesTransactions_TransactionDate" ON aquora_tenant_greenmount_aqua."SalesTransactions" ("TransactionDate");

CREATE INDEX IF NOT EXISTS "IX_SalesTransactions_TransactionType" ON aquora_tenant_greenmount_aqua."SalesTransactions" ("TransactionType");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260716114233_AddSalesTransactionTable', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "AccountingPlaceholder" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "AddressesJson" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "AssignedDriver" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "AssignedRoute" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "AssignedSalesExecutive" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "AssignedVehicle" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "BusinessCategory" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "BusinessRegistration" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "CommissionPercentage" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "ContactsJson" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "DefaultDeliveryPriority" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "DeliveryFrequency" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "DiscountGroup" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "DistributorType" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "DocumentsJson" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "EmergencyDelivery" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "Industry" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "JarDeposit" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "LedgerPlaceholder" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "MaxJarLimit" integer NOT NULL DEFAULT 0;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "MonthlySalary" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "OutstandingJars" integer NOT NULL DEFAULT 0;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "OutstandingPlaceholder" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "PhotoUrl" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "PreferredCapMaterial" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "PreferredDeliveryTime" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "PreferredDeliveryWindow" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "PreferredJarBrand" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "PreferredProductsJson" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "PriceList" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "PriorityCustomer" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "SealRequired" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "SecurityDeposit" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "TaxCategory" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "TaxExempt" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "TradeLicense" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "Website" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "WhatsApp" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "WorkingArea" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "WorkingDays" text;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260717061727_AddBusinessPartnerFields', '10.0.9');

COMMIT;

START TRANSACTION;
CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsFillingQueues" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "DistributorId" uuid NOT NULL,
    "BrandId" uuid NOT NULL,
    "Priority" text NOT NULL,
    "RequestedQuantity" integer NOT NULL,
    "RemainingQuantity" integer NOT NULL,
    "CompletedQuantity" integer NOT NULL,
    "Status" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OperationsFillingQueues" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsFillingQueues_Brands_BrandId" FOREIGN KEY ("BrandId") REFERENCES aquora_tenant_greenmount_aqua."Brands" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OperationsFillingQueues_Customers_DistributorId" FOREIGN KEY ("DistributorId") REFERENCES aquora_tenant_greenmount_aqua."Customers" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsVisits" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "ArrivalTime" timestamp with time zone NOT NULL,
    "VehicleNumber" text NOT NULL,
    "DriverName" text NOT NULL,
    "DistributorId" uuid NOT NULL,
    "ExpectedCollectionTime" timestamp with time zone,
    "Priority" text NOT NULL,
    "Remarks" text,
    "Status" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OperationsVisits" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsVisits_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OperationsVisits_Customers_DistributorId" FOREIGN KEY ("DistributorId") REFERENCES aquora_tenant_greenmount_aqua."Customers" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsJarConditions" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "VisitId" uuid NOT NULL,
    "ConditionType" text NOT NULL,
    "Quantity" integer NOT NULL,
    "DamageLocation" text,
    "Responsibility" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OperationsJarConditions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsJarConditions_OperationsVisits_VisitId" FOREIGN KEY ("VisitId") REFERENCES aquora_tenant_greenmount_aqua."OperationsVisits" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsLoadings" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "VisitId" uuid NOT NULL,
    "ProductId" uuid NOT NULL,
    "BrandId" uuid NOT NULL,
    "BatchNumber" text NOT NULL,
    "CapMaterialId" uuid,
    "SealMaterialId" uuid,
    "SealRequired" boolean NOT NULL,
    "QuantityLoaded" integer NOT NULL,
    "LoadedBy" text NOT NULL,
    "LoadingTime" timestamp with time zone NOT NULL,
    "VehicleNumber" text NOT NULL,
    "Remarks" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OperationsLoadings" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsLoadings_Brands_BrandId" FOREIGN KEY ("BrandId") REFERENCES aquora_tenant_greenmount_aqua."Brands" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OperationsLoadings_OperationsVisits_VisitId" FOREIGN KEY ("VisitId") REFERENCES aquora_tenant_greenmount_aqua."OperationsVisits" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OperationsLoadings_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES aquora_tenant_greenmount_aqua."Products" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OperationsLoadings_RawMaterials_CapMaterialId" FOREIGN KEY ("CapMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id"),
    CONSTRAINT "FK_OperationsLoadings_RawMaterials_SealMaterialId" FOREIGN KEY ("SealMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsQuarantines" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "VisitId" uuid NOT NULL,
    "Reason" text NOT NULL,
    "HoldDurationHours" integer NOT NULL,
    "Quantity" integer NOT NULL,
    "Status" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OperationsQuarantines" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsQuarantines_OperationsVisits_VisitId" FOREIGN KEY ("VisitId") REFERENCES aquora_tenant_greenmount_aqua."OperationsVisits" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsUnloadings" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "VisitId" uuid NOT NULL,
    "BrandId" uuid NOT NULL,
    "ReturnedEmptyCount" integer NOT NULL,
    "ImmediateRequirement" integer NOT NULL,
    "LaterRequirement" integer NOT NULL,
    "ScheduledRequirement" integer NOT NULL,
    "ScheduledDate" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OperationsUnloadings" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsUnloadings_Brands_BrandId" FOREIGN KEY ("BrandId") REFERENCES aquora_tenant_greenmount_aqua."Brands" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OperationsUnloadings_OperationsVisits_VisitId" FOREIGN KEY ("VisitId") REFERENCES aquora_tenant_greenmount_aqua."OperationsVisits" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_OperationsFillingQueues_BrandId" ON aquora_tenant_greenmount_aqua."OperationsFillingQueues" ("BrandId");

CREATE INDEX IF NOT EXISTS "IX_OperationsFillingQueues_DistributorId" ON aquora_tenant_greenmount_aqua."OperationsFillingQueues" ("DistributorId");

CREATE INDEX IF NOT EXISTS "IX_OperationsFillingQueues_Priority" ON aquora_tenant_greenmount_aqua."OperationsFillingQueues" ("Priority");

CREATE INDEX IF NOT EXISTS "IX_OperationsFillingQueues_Status" ON aquora_tenant_greenmount_aqua."OperationsFillingQueues" ("Status");

CREATE INDEX IF NOT EXISTS "IX_OperationsJarConditions_ConditionType" ON aquora_tenant_greenmount_aqua."OperationsJarConditions" ("ConditionType");

CREATE INDEX IF NOT EXISTS "IX_OperationsJarConditions_VisitId" ON aquora_tenant_greenmount_aqua."OperationsJarConditions" ("VisitId");

CREATE INDEX IF NOT EXISTS "IX_OperationsLoadings_BatchNumber" ON aquora_tenant_greenmount_aqua."OperationsLoadings" ("BatchNumber");

CREATE INDEX IF NOT EXISTS "IX_OperationsLoadings_BrandId" ON aquora_tenant_greenmount_aqua."OperationsLoadings" ("BrandId");

CREATE INDEX IF NOT EXISTS "IX_OperationsLoadings_CapMaterialId" ON aquora_tenant_greenmount_aqua."OperationsLoadings" ("CapMaterialId");

CREATE INDEX IF NOT EXISTS "IX_OperationsLoadings_ProductId" ON aquora_tenant_greenmount_aqua."OperationsLoadings" ("ProductId");

CREATE INDEX IF NOT EXISTS "IX_OperationsLoadings_SealMaterialId" ON aquora_tenant_greenmount_aqua."OperationsLoadings" ("SealMaterialId");

CREATE INDEX IF NOT EXISTS "IX_OperationsLoadings_VisitId" ON aquora_tenant_greenmount_aqua."OperationsLoadings" ("VisitId");

CREATE INDEX IF NOT EXISTS "IX_OperationsQuarantines_Status" ON aquora_tenant_greenmount_aqua."OperationsQuarantines" ("Status");

CREATE INDEX IF NOT EXISTS "IX_OperationsQuarantines_VisitId" ON aquora_tenant_greenmount_aqua."OperationsQuarantines" ("VisitId");

CREATE INDEX IF NOT EXISTS "IX_OperationsUnloadings_BrandId" ON aquora_tenant_greenmount_aqua."OperationsUnloadings" ("BrandId");

CREATE INDEX IF NOT EXISTS "IX_OperationsUnloadings_VisitId" ON aquora_tenant_greenmount_aqua."OperationsUnloadings" ("VisitId");

CREATE INDEX IF NOT EXISTS "IX_OperationsVisits_ArrivalTime" ON aquora_tenant_greenmount_aqua."OperationsVisits" ("ArrivalTime");

CREATE INDEX IF NOT EXISTS "IX_OperationsVisits_CompanyId" ON aquora_tenant_greenmount_aqua."OperationsVisits" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_OperationsVisits_DistributorId" ON aquora_tenant_greenmount_aqua."OperationsVisits" ("DistributorId");

CREATE INDEX IF NOT EXISTS "IX_OperationsVisits_Status" ON aquora_tenant_greenmount_aqua."OperationsVisits" ("Status");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260717070916_Add20LOperations', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."UserRoles" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."UserRoles" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Stations" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Stations" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."SkuProducts" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."SkuProducts" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Roles" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Roles" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."RolePermissions" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."RolePermissions" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."RawMaterials" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."RawMaterials" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionStationData" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionStationData" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionSessions" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionSessions" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionLines" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionLines" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionEntries" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionBatches" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionBatches" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Permissions" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Permissions" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsVisits" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsVisits" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsUnloadings" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsUnloadings" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsQuarantines" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsQuarantines" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsLoadings" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsLoadings" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsJarConditions" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsJarConditions" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsFillingQueues" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsFillingQueues" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsFillingQueues" ADD COLUMN IF NOT EXISTS "VisitId" uuid;

ALTER TABLE aquora_tenant_greenmount_aqua."InventoryMovements" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."InventoryMovements" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."CaseConfigurations" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."CaseConfigurations" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Brands" ADD COLUMN IF NOT EXISTS "CreatedByIP" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Brands" ADD COLUMN IF NOT EXISTS "UpdatedByIP" text;

CREATE INDEX IF NOT EXISTS "IX_OperationsFillingQueues_VisitId" ON aquora_tenant_greenmount_aqua."OperationsFillingQueues" ("VisitId");

ALTER TABLE aquora_tenant_greenmount_aqua."OperationsFillingQueues" ADD CONSTRAINT "FK_OperationsFillingQueues_OperationsVisits_VisitId" FOREIGN KEY ("VisitId") REFERENCES aquora_tenant_greenmount_aqua."OperationsVisits" ("Id");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260717095201_AddIPAuditFields', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."InventoryMovements" ADD COLUMN IF NOT EXISTS "BalanceAfter" numeric NOT NULL DEFAULT 0.0;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260717125318_AddBalanceAfterToInventoryMovement', '10.0.9');

COMMIT;

START TRANSACTION;
CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."ProductionShifts" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "StartTime" text NOT NULL,
    "EndTime" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "CreatedBy" text,
    "UpdatedBy" text,
    "DeletedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "DeletedByIP" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "DeletedAt" timestamp with time zone,
    "IsDeleted" boolean NOT NULL,
    CONSTRAINT "PK_ProductionShifts" PRIMARY KEY ("Id")
);

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260722064128_AddProductionShifts', '10.0.9');

COMMIT;

START TRANSACTION;

            CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."ProductionShifts" (
                "Id" uuid NOT NULL,
                "Name" text NOT NULL,
                "StartTime" text NOT NULL,
                "EndTime" text NOT NULL,
                "IsActive" boolean NOT NULL,
                "TenantId" uuid NOT NULL,
                "CompanyId" uuid NOT NULL,
                "CreatedBy" text NULL,
                "UpdatedBy" text NULL,
                "DeletedBy" text NULL,
                "CreatedByIP" text NULL,
                "UpdatedByIP" text NULL,
                "DeletedByIP" text NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NULL,
                "DeletedAt" timestamp with time zone NULL,
                "IsDeleted" boolean NOT NULL,
                CONSTRAINT "PK_ProductionShifts" PRIMARY KEY ("Id")
            );

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260722070755_FixProductionShiftsSchema', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "BottleSize" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "Category" text NOT NULL DEFAULT 'Bottle';

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "DisplayOrder" integer NOT NULL DEFAULT 0;

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "ImageUrl" text;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionShifts" ALTER COLUMN "UpdatedByIP" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionShifts" ALTER COLUMN "UpdatedBy" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionShifts" ALTER COLUMN "DeletedByIP" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionShifts" ALTER COLUMN "DeletedBy" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionShifts" ALTER COLUMN "CreatedByIP" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionShifts" ALTER COLUMN "CreatedBy" DROP NOT NULL;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260723051101_AddProductCategoryAndDisplayOrder', '10.0.9');

COMMIT;

START TRANSACTION;
CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsFillingLogs" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "ProductId" uuid NOT NULL,
    "BrandId" uuid NOT NULL,
    "FilledCount" integer NOT NULL,
    "RejectedCount" integer NOT NULL,
    "LeakageCount" integer NOT NULL,
    "CapFailureCount" integer NOT NULL,
    "SealFailureCount" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OperationsFillingLogs" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsFillingLogs_Brands_BrandId" FOREIGN KEY ("BrandId") REFERENCES aquora_tenant_greenmount_aqua."Brands" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OperationsFillingLogs_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OperationsFillingLogs_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES aquora_tenant_greenmount_aqua."Products" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsReservedJars" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "DistributorId" uuid NOT NULL,
    "Quantity" integer NOT NULL,
    "Type" text NOT NULL,
    "Reason" text NOT NULL,
    "Status" text NOT NULL,
    "ClaimedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OperationsReservedJars" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsReservedJars_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OperationsReservedJars_Customers_DistributorId" FOREIGN KEY ("DistributorId") REFERENCES aquora_tenant_greenmount_aqua."Customers" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsWashingLogs" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "WashedCount" integer NOT NULL,
    "RejectedCount" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OperationsWashingLogs" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsWashingLogs_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_OperationsFillingLogs_BrandId" ON aquora_tenant_greenmount_aqua."OperationsFillingLogs" ("BrandId");

CREATE INDEX IF NOT EXISTS "IX_OperationsFillingLogs_CompanyId" ON aquora_tenant_greenmount_aqua."OperationsFillingLogs" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_OperationsFillingLogs_ProductId" ON aquora_tenant_greenmount_aqua."OperationsFillingLogs" ("ProductId");

CREATE INDEX IF NOT EXISTS "IX_OperationsReservedJars_CompanyId" ON aquora_tenant_greenmount_aqua."OperationsReservedJars" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_OperationsReservedJars_DistributorId" ON aquora_tenant_greenmount_aqua."OperationsReservedJars" ("DistributorId");

CREATE INDEX IF NOT EXISTS "IX_OperationsWashingLogs_CompanyId" ON aquora_tenant_greenmount_aqua."OperationsWashingLogs" ("CompanyId");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260723054126_AddJarOperationsRedesign', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "ReservedEmptyJars" integer NOT NULL DEFAULT 0;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260723100216_AddReservedEmptyJars', '10.0.9');

COMMIT;

START TRANSACTION;
CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."DiscountGroups" (
    "Id" uuid NOT NULL,
    "Code" text NOT NULL,
    "Description" text,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "CreatedByIP" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_DiscountGroups" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_DiscountGroups_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."PriceLists" (
    "Id" uuid NOT NULL,
    "Code" text NOT NULL,
    "Description" text,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "CreatedByIP" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_PriceLists" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PriceLists_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_DiscountGroups_TenantId" ON aquora_tenant_greenmount_aqua."DiscountGroups" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_PriceLists_TenantId" ON aquora_tenant_greenmount_aqua."PriceLists" ("TenantId");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260725073524_AddPriceListAndDiscountGroup', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."Customers" DROP COLUMN IF EXISTS "PaymentTerms";

ALTER TABLE aquora_tenant_greenmount_aqua."PriceLists" ADD COLUMN IF NOT EXISTS "DeletedAt" timestamp with time zone;

ALTER TABLE aquora_tenant_greenmount_aqua."PriceLists" ADD COLUMN IF NOT EXISTS "DeletedBy" text;

ALTER TABLE aquora_tenant_greenmount_aqua."PriceLists" ADD COLUMN IF NOT EXISTS "IsDeleted" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."DiscountGroups" ADD COLUMN IF NOT EXISTS "DeletedAt" timestamp with time zone;

ALTER TABLE aquora_tenant_greenmount_aqua."DiscountGroups" ADD COLUMN IF NOT EXISTS "DeletedBy" text;

ALTER TABLE aquora_tenant_greenmount_aqua."DiscountGroups" ADD COLUMN IF NOT EXISTS "IsDeleted" boolean NOT NULL DEFAULT FALSE;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260725074530_RemovePaymentTerms', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."RawMaterials" ADD COLUMN IF NOT EXISTS "RowVersion" bytea NOT NULL DEFAULT BYTEA E'\\x';

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "RowVersion" bytea NOT NULL DEFAULT BYTEA E'\\x';

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260725103118_AddConcurrencyTokens', '10.0.9');

COMMIT;

START TRANSACTION;
CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."AccountGroups" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "Name" text NOT NULL,
    "Type" text NOT NULL,
    "Code" text NOT NULL,
    "ParentGroupId" uuid,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_AccountGroups" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_AccountGroups_AccountGroups_ParentGroupId" FOREIGN KEY ("ParentGroupId") REFERENCES aquora_tenant_greenmount_aqua."AccountGroups" ("Id"),
    CONSTRAINT "FK_AccountGroups_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Assets" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "AssetName" text NOT NULL,
    "AssetCategory" text NOT NULL,
    "SerialNumber" text,
    "PurchaseDate" timestamp with time zone NOT NULL,
    "PurchasePrice" numeric NOT NULL,
    "SupplierId" uuid,
    "WarrantyDetails" text,
    "CurrentStatus" text NOT NULL,
    "Location" text,
    "AssignedEmployeeId" uuid,
    "DepreciationRate" numeric NOT NULL,
    "CurrentValue" numeric NOT NULL,
    "Notes" text,
    "PhotoUrl" text,
    "DocumentUrl" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Assets" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Assets_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."JournalEntries" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "VoucherNumber" text NOT NULL,
    "TransactionDate" timestamp with time zone NOT NULL,
    "VoucherType" text NOT NULL,
    "ReferenceNumber" text,
    "Remarks" text,
    "TotalAmount" numeric NOT NULL,
    "Status" text NOT NULL,
    "ApprovedById" uuid,
    "ApprovedAt" timestamp with time zone,
    "SourceSalesTransactionId" uuid,
    "SourcePurchaseId" uuid,
    "SourceExpenseId" uuid,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_JournalEntries" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_JournalEntries_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_JournalEntries_Users_ApprovedById" FOREIGN KEY ("ApprovedById") REFERENCES public."Users" ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."PettyCashSessions" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "SessionDate" timestamp with time zone NOT NULL,
    "OpeningBalance" numeric NOT NULL,
    "CashReceived" numeric NOT NULL,
    "CashSpent" numeric NOT NULL,
    "ClosingBalance" numeric NOT NULL,
    "Status" text NOT NULL,
    "VerifiedById" uuid,
    "Remarks" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_PettyCashSessions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PettyCashSessions_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Accounts" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "AccountName" text NOT NULL,
    "AccountCode" text NOT NULL,
    "AccountGroupId" uuid NOT NULL,
    "OpeningBalance" numeric NOT NULL,
    "BalanceType" text NOT NULL,
    "CurrentBalance" numeric NOT NULL,
    "IsActive" boolean NOT NULL,
    "LinkedCustomerId" uuid,
    "LinkedSupplierId" uuid,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Accounts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Accounts_AccountGroups_AccountGroupId" FOREIGN KEY ("AccountGroupId") REFERENCES aquora_tenant_greenmount_aqua."AccountGroups" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Accounts_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Accounts_Customers_LinkedCustomerId" FOREIGN KEY ("LinkedCustomerId") REFERENCES aquora_tenant_greenmount_aqua."Customers" ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."ExpenseRecords" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "Category" text NOT NULL,
    "Amount" numeric NOT NULL,
    "GSTAmount" numeric NOT NULL,
    "TotalAmount" numeric NOT NULL,
    "ExpenseDate" timestamp with time zone NOT NULL,
    "PaymentMethod" text NOT NULL,
    "VendorName" text,
    "InvoiceNumber" text,
    "Remarks" text,
    "BillAttachmentUrl" text,
    "Status" text NOT NULL,
    "ApprovedById" uuid,
    "LinkedJournalEntryId" uuid,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_ExpenseRecords" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ExpenseRecords_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ExpenseRecords_JournalEntries_LinkedJournalEntryId" FOREIGN KEY ("LinkedJournalEntryId") REFERENCES aquora_tenant_greenmount_aqua."JournalEntries" ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."BankAccounts" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "BankName" text NOT NULL,
    "AccountName" text NOT NULL,
    "AccountNumber" text NOT NULL,
    "AccountType" text NOT NULL,
    "Branch" text,
    "IFSC" text,
    "LinkedLedgerAccountId" uuid NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_BankAccounts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_BankAccounts_Accounts_LinkedLedgerAccountId" FOREIGN KEY ("LinkedLedgerAccountId") REFERENCES aquora_tenant_greenmount_aqua."Accounts" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_BankAccounts_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."JournalEntryLines" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "JournalEntryId" uuid NOT NULL,
    "AccountId" uuid NOT NULL,
    "Description" text NOT NULL,
    "DebitAmount" numeric NOT NULL,
    "CreditAmount" numeric NOT NULL,
    CONSTRAINT "PK_JournalEntryLines" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_JournalEntryLines_Accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES aquora_tenant_greenmount_aqua."Accounts" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_JournalEntryLines_JournalEntries_JournalEntryId" FOREIGN KEY ("JournalEntryId") REFERENCES aquora_tenant_greenmount_aqua."JournalEntries" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_AccountGroups_CompanyId" ON aquora_tenant_greenmount_aqua."AccountGroups" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_AccountGroups_ParentGroupId" ON aquora_tenant_greenmount_aqua."AccountGroups" ("ParentGroupId");

CREATE INDEX IF NOT EXISTS "IX_Accounts_AccountGroupId" ON aquora_tenant_greenmount_aqua."Accounts" ("AccountGroupId");

CREATE INDEX IF NOT EXISTS "IX_Accounts_CompanyId" ON aquora_tenant_greenmount_aqua."Accounts" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_Accounts_LinkedCustomerId" ON aquora_tenant_greenmount_aqua."Accounts" ("LinkedCustomerId");

CREATE INDEX IF NOT EXISTS "IX_Assets_CompanyId" ON aquora_tenant_greenmount_aqua."Assets" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_BankAccounts_CompanyId" ON aquora_tenant_greenmount_aqua."BankAccounts" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_BankAccounts_LinkedLedgerAccountId" ON aquora_tenant_greenmount_aqua."BankAccounts" ("LinkedLedgerAccountId");

CREATE INDEX IF NOT EXISTS "IX_ExpenseRecords_CompanyId" ON aquora_tenant_greenmount_aqua."ExpenseRecords" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_ExpenseRecords_LinkedJournalEntryId" ON aquora_tenant_greenmount_aqua."ExpenseRecords" ("LinkedJournalEntryId");

CREATE INDEX IF NOT EXISTS "IX_JournalEntries_ApprovedById" ON aquora_tenant_greenmount_aqua."JournalEntries" ("ApprovedById");

CREATE INDEX IF NOT EXISTS "IX_JournalEntries_CompanyId" ON aquora_tenant_greenmount_aqua."JournalEntries" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_JournalEntryLines_AccountId" ON aquora_tenant_greenmount_aqua."JournalEntryLines" ("AccountId");

CREATE INDEX IF NOT EXISTS "IX_JournalEntryLines_JournalEntryId" ON aquora_tenant_greenmount_aqua."JournalEntryLines" ("JournalEntryId");

CREATE INDEX IF NOT EXISTS "IX_PettyCashSessions_CompanyId" ON aquora_tenant_greenmount_aqua."PettyCashSessions" ("CompanyId");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260729191421_AddFinanceModule', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "SellingPrice" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "UnitCost" numeric NOT NULL DEFAULT 0.0;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260729200058_AddProductPricing', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."RawMaterials" DROP COLUMN IF EXISTS "RowVersion";

ALTER TABLE aquora_tenant_greenmount_aqua."Products" DROP COLUMN IF EXISTS "RowVersion";

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260730071552_RemoveRowVersion', '10.0.9');

COMMIT;

START TRANSACTION;
INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260730073628_AddProductSellingPrice', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "Address" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "ApiKey" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "AutoBatchNumber" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "AutoProductionNumber" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "AutoSKU" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "Currency" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "DateFormat" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "DefaultDispatchMethod" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "DefaultProductionLineId" uuid;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "DefaultShiftId" uuid;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "DefaultWarehouseId" uuid;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "DisplayName" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "Email" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "GstNumber" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "Language" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "LogoUrl" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "Phone" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "SecretKeyHash" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "Timezone" text NOT NULL DEFAULT '';

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260730091552_AddCompanyProfileAndApiKey', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."Products" DROP COLUMN IF EXISTS "SellingPrice";

ALTER TABLE aquora_tenant_greenmount_aqua."Products" DROP COLUMN IF EXISTS "UnitCost";

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260730101010_RemoveObsoleteProductPricing', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."BankAccounts" DROP CONSTRAINT IF EXISTS "FK_BankAccounts_Accounts_LinkedLedgerAccountId";

ALTER TABLE aquora_tenant_greenmount_aqua."PriceLists" DROP COLUMN IF EXISTS "DeletedAt";

ALTER TABLE aquora_tenant_greenmount_aqua."PriceLists" DROP COLUMN IF EXISTS "DeletedBy";

ALTER TABLE aquora_tenant_greenmount_aqua."PriceLists" DROP COLUMN IF EXISTS "IsDeleted";

ALTER TABLE aquora_tenant_greenmount_aqua."DiscountGroups" DROP COLUMN IF EXISTS "DeletedAt";

ALTER TABLE aquora_tenant_greenmount_aqua."DiscountGroups" DROP COLUMN IF EXISTS "DeletedBy";

ALTER TABLE aquora_tenant_greenmount_aqua."DiscountGroups" DROP COLUMN IF EXISTS "IsDeleted";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "Address";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "ApiKey";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "AutoBatchNumber";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "AutoProductionNumber";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "AutoSKU";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "Currency";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "DateFormat";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "DefaultDispatchMethod";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "DefaultProductionLineId";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "DefaultShiftId";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "DefaultWarehouseId";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "DisplayName";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "Email";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "GstNumber";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "Language";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "LogoUrl";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "Phone";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "SecretKeyHash";

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" DROP COLUMN IF EXISTS "Timezone";

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "AdjustmentAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "AmountReceived" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "DamageCost" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "DamageReason" text;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "IsReplacementRequired" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "OutstandingAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "PaymentStatus" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "ProductValue" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "RefundAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "ReturnType" text;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "ReturnedAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "TotalAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."RawMaterials" ADD COLUMN IF NOT EXISTS "CostPerUnit" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "CostPrice" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "SellingPrice" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."ProductionShifts" ADD COLUMN IF NOT EXISTS "Description" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ADD COLUMN IF NOT EXISTS "PaymentTerms" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."BankAccounts" ALTER COLUMN "LinkedLedgerAccountId" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."BankAccounts" ADD COLUMN IF NOT EXISTS "CurrentBalance" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."BankAccounts" ADD COLUMN IF NOT EXISTS "DeletedAt" timestamp with time zone;

ALTER TABLE aquora_tenant_greenmount_aqua."BankAccounts" ADD COLUMN IF NOT EXISTS "DeletedBy" text;

ALTER TABLE aquora_tenant_greenmount_aqua."BankAccounts" ADD COLUMN IF NOT EXISTS "IfscCode" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."BankAccounts" ADD COLUMN IF NOT EXISTS "IsDeleted" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."BankAccounts" ADD COLUMN IF NOT EXISTS "Notes" text;

ALTER TABLE aquora_tenant_greenmount_aqua."BankAccounts" ADD COLUMN IF NOT EXISTS "OpeningBalance" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."BankAccounts" ADD COLUMN IF NOT EXISTS "Status" text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."BankLedgerEntries" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "BankAccountId" uuid NOT NULL,
    "TransactionDate" timestamp with time zone NOT NULL,
    "ReferenceNumber" text NOT NULL,
    "TransactionType" text NOT NULL,
    "Description" text NOT NULL,
    "Debit" numeric NOT NULL,
    "Credit" numeric NOT NULL,
    "RunningBalance" numeric NOT NULL,
    "RelatedEntityId" uuid,
    "RelatedEntityType" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_BankLedgerEntries" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_BankLedgerEntries_BankAccounts_BankAccountId" FOREIGN KEY ("BankAccountId") REFERENCES aquora_tenant_greenmount_aqua."BankAccounts" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_BankLedgerEntries_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Owners" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "Name" text NOT NULL,
    "Phone" text NOT NULL,
    "Email" text,
    "OwnershipPercentage" numeric NOT NULL,
    "InitialInvestment" numeric NOT NULL,
    "CurrentInvestment" numeric NOT NULL,
    "Notes" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Owners" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Owners_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."SimpleExpenses" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "ExpenseNumber" text NOT NULL,
    "ExpenseDate" timestamp with time zone NOT NULL,
    "Category" text NOT NULL,
    "Vendor" text,
    "Description" text NOT NULL,
    "Amount" numeric NOT NULL,
    "PaymentMethod" text NOT NULL,
    "BankAccountId" uuid,
    "Notes" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_SimpleExpenses" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SimpleExpenses_BankAccounts_BankAccountId" FOREIGN KEY ("BankAccountId") REFERENCES aquora_tenant_greenmount_aqua."BankAccounts" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_SimpleExpenses_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OwnerInvestmentTransactions" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "OwnerId" uuid NOT NULL,
    "TransactionDate" timestamp with time zone NOT NULL,
    "Amount" numeric NOT NULL,
    "TransactionType" text NOT NULL,
    "Notes" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OwnerInvestmentTransactions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OwnerInvestmentTransactions_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OwnerInvestmentTransactions_Owners_OwnerId" FOREIGN KEY ("OwnerId") REFERENCES aquora_tenant_greenmount_aqua."Owners" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_BankAccounts_TenantId" ON aquora_tenant_greenmount_aqua."BankAccounts" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_BankAccountId" ON aquora_tenant_greenmount_aqua."BankLedgerEntries" ("BankAccountId");

CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_CompanyId" ON aquora_tenant_greenmount_aqua."BankLedgerEntries" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_TenantId" ON aquora_tenant_greenmount_aqua."BankLedgerEntries" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_TransactionDate" ON aquora_tenant_greenmount_aqua."BankLedgerEntries" ("TransactionDate");

CREATE INDEX IF NOT EXISTS "IX_OwnerInvestmentTransactions_CompanyId" ON aquora_tenant_greenmount_aqua."OwnerInvestmentTransactions" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_OwnerInvestmentTransactions_OwnerId" ON aquora_tenant_greenmount_aqua."OwnerInvestmentTransactions" ("OwnerId");

CREATE INDEX IF NOT EXISTS "IX_Owners_CompanyId" ON aquora_tenant_greenmount_aqua."Owners" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_Owners_TenantId" ON aquora_tenant_greenmount_aqua."Owners" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_BankAccountId" ON aquora_tenant_greenmount_aqua."SimpleExpenses" ("BankAccountId");

CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_Category" ON aquora_tenant_greenmount_aqua."SimpleExpenses" ("Category");

CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_CompanyId" ON aquora_tenant_greenmount_aqua."SimpleExpenses" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_ExpenseDate" ON aquora_tenant_greenmount_aqua."SimpleExpenses" ("ExpenseDate");

CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_TenantId" ON aquora_tenant_greenmount_aqua."SimpleExpenses" ("TenantId");

ALTER TABLE aquora_tenant_greenmount_aqua."BankAccounts" ADD CONSTRAINT "FK_BankAccounts_Accounts_LinkedLedgerAccountId" FOREIGN KEY ("LinkedLedgerAccountId") REFERENCES aquora_tenant_greenmount_aqua."Accounts" ("Id");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260803073729_AddBankLedgerEntry', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."Customers" ALTER COLUMN "PaymentTerms" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."BankLedgerAuditEntries" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "BankLedgerEntryId" uuid NOT NULL,
    "Action" text NOT NULL,
    "OldAmount" numeric NOT NULL,
    "NewAmount" numeric NOT NULL,
    "Remarks" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_BankLedgerAuditEntries" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_BankLedgerAuditEntries_BankLedgerEntries_BankLedgerEntryId" FOREIGN KEY ("BankLedgerEntryId") REFERENCES aquora_tenant_greenmount_aqua."BankLedgerEntries" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_BankLedgerAuditEntries_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_BankLedgerAuditEntries_BankLedgerEntryId" ON aquora_tenant_greenmount_aqua."BankLedgerAuditEntries" ("BankLedgerEntryId");

CREATE INDEX IF NOT EXISTS "IX_BankLedgerAuditEntries_CompanyId" ON aquora_tenant_greenmount_aqua."BankLedgerAuditEntries" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_BankLedgerAuditEntries_TenantId" ON aquora_tenant_greenmount_aqua."BankLedgerAuditEntries" ("TenantId");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260803102810_AddBankLedgerAuditEntry', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "TotalAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "AmountReceived" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "OutstandingAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "PaymentStatus" text NOT NULL DEFAULT 'Pending';

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "ReturnedAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "RefundAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "AdjustmentAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "ReturnType" text;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "IsReplacementRequired" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "ProductValue" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "DamageCost" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "DamageReason" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "SellingPrice" numeric NOT NULL DEFAULT 15.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Products" ADD COLUMN IF NOT EXISTS "CostPrice" numeric NOT NULL DEFAULT 10.0;

ALTER TABLE aquora_tenant_greenmount_aqua."RawMaterials" ADD COLUMN IF NOT EXISTS "CostPerUnit" numeric NOT NULL DEFAULT 5.0;

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."SimpleExpenses" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "ExpenseNumber" text NOT NULL,
    "ExpenseDate" timestamp with time zone NOT NULL,
    "Category" text NOT NULL,
    "Vendor" text,
    "Description" text NOT NULL,
    "Amount" numeric NOT NULL,
    "PaymentMethod" text NOT NULL,
    "Notes" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_SimpleExpenses" PRIMARY KEY ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Owners" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "Name" text NOT NULL,
    "Phone" text NOT NULL,
    "Email" text,
    "OwnershipPercentage" numeric NOT NULL,
    "InitialInvestment" numeric NOT NULL,
    "CurrentInvestment" numeric NOT NULL,
    "Notes" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Owners" PRIMARY KEY ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OwnerInvestmentTransactions" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "OwnerId" uuid NOT NULL,
    "TransactionDate" timestamp with time zone NOT NULL,
    "Amount" numeric NOT NULL,
    "TransactionType" text NOT NULL,
    "Notes" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OwnerInvestmentTransactions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OwnerInvestmentTransactions_Owners_OwnerId" FOREIGN KEY ("OwnerId") REFERENCES aquora_tenant_greenmount_aqua."Owners" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_Category" ON aquora_tenant_greenmount_aqua."SimpleExpenses" ("Category");

CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_ExpenseDate" ON aquora_tenant_greenmount_aqua."SimpleExpenses" ("ExpenseDate");

CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_TenantId" ON aquora_tenant_greenmount_aqua."SimpleExpenses" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_Owners_TenantId" ON aquora_tenant_greenmount_aqua."Owners" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_OwnerInvestmentTransactions_OwnerId" ON aquora_tenant_greenmount_aqua."OwnerInvestmentTransactions" ("OwnerId");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260803120000_AddSimpleAccountsModule', '10.0.9');

COMMIT;

START TRANSACTION;

                ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts"
                    ALTER COLUMN "OpeningBalance" DROP DEFAULT,
                    ALTER COLUMN "OpeningBalance" TYPE numeric USING COALESCE(NULLIF(trim("OpeningBalance"::text), ''), '0')::numeric,
                    ALTER COLUMN "OpeningBalance" SET DEFAULT 0.0,
                    ALTER COLUMN "OpeningBalance" SET NOT NULL;

                ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts"
                    ALTER COLUMN "CurrentBalance" DROP DEFAULT,
                    ALTER COLUMN "CurrentBalance" TYPE numeric USING COALESCE(NULLIF(trim("CurrentBalance"::text), ''), '0')::numeric,
                    ALTER COLUMN "CurrentBalance" SET DEFAULT 0.0,
                    ALTER COLUMN "CurrentBalance" SET NOT NULL;
            

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260803143000_FixBankAccountBalanceColumnTypes', '10.0.9');

COMMIT;

START TRANSACTION;

                CREATE TABLE IF NOT EXISTS "aquora_tenant_greenmount_aqua"."SimpleExpenses" (
                    "Id" uuid NOT NULL,
                    "TenantId" uuid NOT NULL,
                    "CompanyId" uuid NOT NULL,
                    "ExpenseNumber" text NOT NULL,
                    "ExpenseDate" timestamp with time zone NOT NULL,
                    "Category" text NOT NULL,
                    "Vendor" text NULL,
                    "Description" text NOT NULL,
                    "Amount" numeric NOT NULL DEFAULT 0.0,
                    "PaymentMethod" text NOT NULL DEFAULT 'Cash',
                    "BankAccountId" uuid NULL,
                    "Notes" text NULL,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "CreatedBy" text NOT NULL DEFAULT 'System',
                    "UpdatedAt" timestamp with time zone NULL,
                    "UpdatedBy" text NULL,
                    "CreatedByIP" text NULL,
                    "UpdatedByIP" text NULL,
                    "IsDeleted" boolean NOT NULL DEFAULT false,
                    "DeletedAt" timestamp with time zone NULL,
                    "DeletedBy" text NULL,
                    CONSTRAINT "PK_SimpleExpenses" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "aquora_tenant_greenmount_aqua"."BankAccounts" (
                    "Id" uuid NOT NULL,
                    "TenantId" uuid NOT NULL,
                    "CompanyId" uuid NOT NULL,
                    "BankName" text NOT NULL,
                    "AccountName" text NOT NULL,
                    "AccountNumber" text NOT NULL,
                    "AccountType" text NOT NULL DEFAULT 'Current',
                    "Branch" text NULL,
                    "IFSC" text NULL,
                    "IfscCode" text NOT NULL DEFAULT '',
                    "OpeningBalance" numeric NOT NULL DEFAULT 0.0,
                    "CurrentBalance" numeric NOT NULL DEFAULT 0.0,
                    "Notes" text NULL,
                    "Status" text NOT NULL DEFAULT 'Active',
                    "LinkedLedgerAccountId" uuid NULL,
                    "IsActive" boolean NOT NULL DEFAULT true,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "CreatedBy" text NOT NULL DEFAULT 'System',
                    "UpdatedAt" timestamp with time zone NULL,
                    "UpdatedBy" text NULL,
                    "CreatedByIP" text NULL,
                    "UpdatedByIP" text NULL,
                    "IsDeleted" boolean NOT NULL DEFAULT false,
                    "DeletedAt" timestamp with time zone NULL,
                    "DeletedBy" text NULL,
                    CONSTRAINT "PK_BankAccounts" PRIMARY KEY ("Id")
                );
                CREATE TABLE IF NOT EXISTS "aquora_tenant_greenmount_aqua"."BankLedgerEntries" (
                    "Id" uuid NOT NULL,
                    "TenantId" uuid NOT NULL,
                    "CompanyId" uuid NOT NULL,
                    "BankAccountId" uuid NOT NULL,
                    "TransactionDate" timestamp with time zone NOT NULL,
                    "ReferenceNumber" text NOT NULL,
                    "TransactionType" text NOT NULL,
                    "Description" text NOT NULL,
                    "Debit" numeric NOT NULL DEFAULT 0.0,
                    "Credit" numeric NOT NULL DEFAULT 0.0,
                    "RunningBalance" numeric NOT NULL DEFAULT 0.0,
                    "RelatedEntityId" uuid NULL,
                    "RelatedEntityType" text NULL,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "CreatedBy" text NOT NULL DEFAULT 'System',
                    "UpdatedAt" timestamp with time zone NULL,
                    "UpdatedBy" text NULL,
                    "CreatedByIP" text NULL,
                    "UpdatedByIP" text NULL,
                    CONSTRAINT "PK_BankLedgerEntries" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "aquora_tenant_greenmount_aqua"."BankLedgerAuditEntries" (
                    "Id" uuid NOT NULL,
                    "TenantId" uuid NOT NULL,
                    "CompanyId" uuid NOT NULL,
                    "BankLedgerEntryId" uuid NOT NULL,
                    "Action" text NOT NULL,
                    "OldAmount" numeric NOT NULL DEFAULT 0.0,
                    "NewAmount" numeric NOT NULL DEFAULT 0.0,
                    "Remarks" text NULL,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "CreatedBy" text NOT NULL DEFAULT 'System',
                    "UpdatedAt" timestamp with time zone NULL,
                    "UpdatedBy" text NULL,
                    "CreatedByIP" text NULL,
                    "UpdatedByIP" text NULL,
                    CONSTRAINT "PK_BankLedgerAuditEntries" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "aquora_tenant_greenmount_aqua"."Owners" (
                    "Id" uuid NOT NULL,
                    "TenantId" uuid NOT NULL,
                    "CompanyId" uuid NOT NULL,
                    "Name" text NOT NULL,
                    "Phone" text NOT NULL,
                    "Email" text NULL,
                    "OwnershipPercentage" numeric NOT NULL DEFAULT 0.0,
                    "InitialInvestment" numeric NOT NULL DEFAULT 0.0,
                    "CurrentInvestment" numeric NOT NULL DEFAULT 0.0,
                    "Notes" text NULL,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "CreatedBy" text NOT NULL DEFAULT 'System',
                    "UpdatedAt" timestamp with time zone NULL,
                    "UpdatedBy" text NULL,
                    "CreatedByIP" text NULL,
                    "UpdatedByIP" text NULL,
                    "IsDeleted" boolean NOT NULL DEFAULT false,
                    "DeletedAt" timestamp with time zone NULL,
                    "DeletedBy" text NULL,
                    CONSTRAINT "PK_Owners" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "aquora_tenant_greenmount_aqua"."OwnerInvestmentTransactions" (
                    "Id" uuid NOT NULL,
                    "TenantId" uuid NOT NULL,
                    "CompanyId" uuid NOT NULL,
                    "OwnerId" uuid NOT NULL,
                    "TransactionDate" timestamp with time zone NOT NULL,
                    "Amount" numeric NOT NULL DEFAULT 0.0,
                    "TransactionType" text NOT NULL DEFAULT 'Investment',
                    "Notes" text NULL,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "CreatedBy" text NOT NULL DEFAULT 'System',
                    "UpdatedAt" timestamp with time zone NULL,
                    "UpdatedBy" text NULL,
                    "CreatedByIP" text NULL,
                    "UpdatedByIP" text NULL,
                    "IsDeleted" boolean NOT NULL DEFAULT false,
                    "DeletedAt" timestamp with time zone NULL,
                    "DeletedBy" text NULL,
                    CONSTRAINT "PK_OwnerInvestmentTransactions" PRIMARY KEY ("Id")
                );

                ALTER TABLE "aquora_tenant_greenmount_aqua"."SimpleExpenses" ADD COLUMN IF NOT EXISTS "BankAccountId" uuid NULL;
                ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts" ADD COLUMN IF NOT EXISTS "OpeningBalance" numeric NOT NULL DEFAULT 0.0;
                ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts" ADD COLUMN IF NOT EXISTS "CurrentBalance" numeric NOT NULL DEFAULT 0.0;
                ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts" ADD COLUMN IF NOT EXISTS "Notes" text NULL;
                ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts" ADD COLUMN IF NOT EXISTS "Status" text NOT NULL DEFAULT 'Active';
                ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts" ADD COLUMN IF NOT EXISTS "IsDeleted" boolean NOT NULL DEFAULT false;
                ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts" ADD COLUMN IF NOT EXISTS "DeletedAt" timestamp with time zone NULL;
                ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts" ADD COLUMN IF NOT EXISTS "DeletedBy" text NULL;

                ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts"
                    ALTER COLUMN "OpeningBalance" TYPE numeric USING COALESCE(NULLIF(trim("OpeningBalance"::text), ''), '0')::numeric,
                    ALTER COLUMN "CurrentBalance" TYPE numeric USING COALESCE(NULLIF(trim("CurrentBalance"::text), ''), '0')::numeric;

                CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_BankAccountId" ON "aquora_tenant_greenmount_aqua"."SimpleExpenses" ("BankAccountId");
                CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_Category" ON "aquora_tenant_greenmount_aqua"."SimpleExpenses" ("Category");
                CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_CompanyId" ON "aquora_tenant_greenmount_aqua"."SimpleExpenses" ("CompanyId");
                CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_ExpenseDate" ON "aquora_tenant_greenmount_aqua"."SimpleExpenses" ("ExpenseDate");
                CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_TenantId" ON "aquora_tenant_greenmount_aqua"."SimpleExpenses" ("TenantId");
                CREATE INDEX IF NOT EXISTS "IX_BankAccounts_CompanyId" ON "aquora_tenant_greenmount_aqua"."BankAccounts" ("CompanyId");
                CREATE INDEX IF NOT EXISTS "IX_BankAccounts_LinkedLedgerAccountId" ON "aquora_tenant_greenmount_aqua"."BankAccounts" ("LinkedLedgerAccountId");
                CREATE INDEX IF NOT EXISTS "IX_BankAccounts_TenantId" ON "aquora_tenant_greenmount_aqua"."BankAccounts" ("TenantId");
                CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_BankAccountId" ON "aquora_tenant_greenmount_aqua"."BankLedgerEntries" ("BankAccountId");
                CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_CompanyId" ON "aquora_tenant_greenmount_aqua"."BankLedgerEntries" ("CompanyId");
                CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_TenantId" ON "aquora_tenant_greenmount_aqua"."BankLedgerEntries" ("TenantId");
                CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_TransactionDate" ON "aquora_tenant_greenmount_aqua"."BankLedgerEntries" ("TransactionDate");
                CREATE INDEX IF NOT EXISTS "IX_BankLedgerAuditEntries_BankLedgerEntryId" ON "aquora_tenant_greenmount_aqua"."BankLedgerAuditEntries" ("BankLedgerEntryId");
                CREATE INDEX IF NOT EXISTS "IX_BankLedgerAuditEntries_CompanyId" ON "aquora_tenant_greenmount_aqua"."BankLedgerAuditEntries" ("CompanyId");
                CREATE INDEX IF NOT EXISTS "IX_BankLedgerAuditEntries_TenantId" ON "aquora_tenant_greenmount_aqua"."BankLedgerAuditEntries" ("TenantId");
                CREATE INDEX IF NOT EXISTS "IX_OwnerInvestmentTransactions_CompanyId" ON "aquora_tenant_greenmount_aqua"."OwnerInvestmentTransactions" ("CompanyId");
                CREATE INDEX IF NOT EXISTS "IX_OwnerInvestmentTransactions_OwnerId" ON "aquora_tenant_greenmount_aqua"."OwnerInvestmentTransactions" ("OwnerId");
                CREATE INDEX IF NOT EXISTS "IX_Owners_CompanyId" ON "aquora_tenant_greenmount_aqua"."Owners" ("CompanyId");
                CREATE INDEX IF NOT EXISTS "IX_Owners_TenantId" ON "aquora_tenant_greenmount_aqua"."Owners" ("TenantId");
            


                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = 'FK_BankAccounts_Accounts_LinkedLedgerAccountId'
                          AND n.nspname = 'aquora_tenant_greenmount_aqua'
                    ) THEN
                        ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts"
                        ADD CONSTRAINT "FK_BankAccounts_Accounts_LinkedLedgerAccountId"
                        FOREIGN KEY ("LinkedLedgerAccountId")
                        REFERENCES "aquora_tenant_greenmount_aqua"."Accounts" ("Id")
                        ON DELETE NO ACTION;
                    END IF;
                END $$;
            


                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = 'FK_BankAccounts_Companies_CompanyId'
                          AND n.nspname = 'aquora_tenant_greenmount_aqua'
                    ) THEN
                        ALTER TABLE "aquora_tenant_greenmount_aqua"."BankAccounts"
                        ADD CONSTRAINT "FK_BankAccounts_Companies_CompanyId"
                        FOREIGN KEY ("CompanyId")
                        REFERENCES "aquora_tenant_greenmount_aqua"."Companies" ("Id")
                        ON DELETE CASCADE;
                    END IF;
                END $$;
            


                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = 'FK_BankLedgerAuditEntries_BankLedgerEntries_BankLedgerEntryId'
                          AND n.nspname = 'aquora_tenant_greenmount_aqua'
                    ) THEN
                        ALTER TABLE "aquora_tenant_greenmount_aqua"."BankLedgerAuditEntries"
                        ADD CONSTRAINT "FK_BankLedgerAuditEntries_BankLedgerEntries_BankLedgerEntryId"
                        FOREIGN KEY ("BankLedgerEntryId")
                        REFERENCES "aquora_tenant_greenmount_aqua"."BankLedgerEntries" ("Id")
                        ON DELETE CASCADE;
                    END IF;
                END $$;
            


                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = 'FK_BankLedgerAuditEntries_Companies_CompanyId'
                          AND n.nspname = 'aquora_tenant_greenmount_aqua'
                    ) THEN
                        ALTER TABLE "aquora_tenant_greenmount_aqua"."BankLedgerAuditEntries"
                        ADD CONSTRAINT "FK_BankLedgerAuditEntries_Companies_CompanyId"
                        FOREIGN KEY ("CompanyId")
                        REFERENCES "aquora_tenant_greenmount_aqua"."Companies" ("Id")
                        ON DELETE CASCADE;
                    END IF;
                END $$;
            


                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = 'FK_BankLedgerEntries_BankAccounts_BankAccountId'
                          AND n.nspname = 'aquora_tenant_greenmount_aqua'
                    ) THEN
                        ALTER TABLE "aquora_tenant_greenmount_aqua"."BankLedgerEntries"
                        ADD CONSTRAINT "FK_BankLedgerEntries_BankAccounts_BankAccountId"
                        FOREIGN KEY ("BankAccountId")
                        REFERENCES "aquora_tenant_greenmount_aqua"."BankAccounts" ("Id")
                        ON DELETE RESTRICT;
                    END IF;
                END $$;
            


                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = 'FK_BankLedgerEntries_Companies_CompanyId'
                          AND n.nspname = 'aquora_tenant_greenmount_aqua'
                    ) THEN
                        ALTER TABLE "aquora_tenant_greenmount_aqua"."BankLedgerEntries"
                        ADD CONSTRAINT "FK_BankLedgerEntries_Companies_CompanyId"
                        FOREIGN KEY ("CompanyId")
                        REFERENCES "aquora_tenant_greenmount_aqua"."Companies" ("Id")
                        ON DELETE CASCADE;
                    END IF;
                END $$;
            


                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = 'FK_SimpleExpenses_BankAccounts_BankAccountId'
                          AND n.nspname = 'aquora_tenant_greenmount_aqua'
                    ) THEN
                        ALTER TABLE "aquora_tenant_greenmount_aqua"."SimpleExpenses"
                        ADD CONSTRAINT "FK_SimpleExpenses_BankAccounts_BankAccountId"
                        FOREIGN KEY ("BankAccountId")
                        REFERENCES "aquora_tenant_greenmount_aqua"."BankAccounts" ("Id")
                        ON DELETE SET NULL;
                    END IF;
                END $$;
            


                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = 'FK_SimpleExpenses_Companies_CompanyId'
                          AND n.nspname = 'aquora_tenant_greenmount_aqua'
                    ) THEN
                        ALTER TABLE "aquora_tenant_greenmount_aqua"."SimpleExpenses"
                        ADD CONSTRAINT "FK_SimpleExpenses_Companies_CompanyId"
                        FOREIGN KEY ("CompanyId")
                        REFERENCES "aquora_tenant_greenmount_aqua"."Companies" ("Id")
                        ON DELETE CASCADE;
                    END IF;
                END $$;
            


                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = 'FK_Owners_Companies_CompanyId'
                          AND n.nspname = 'aquora_tenant_greenmount_aqua'
                    ) THEN
                        ALTER TABLE "aquora_tenant_greenmount_aqua"."Owners"
                        ADD CONSTRAINT "FK_Owners_Companies_CompanyId"
                        FOREIGN KEY ("CompanyId")
                        REFERENCES "aquora_tenant_greenmount_aqua"."Companies" ("Id")
                        ON DELETE CASCADE;
                    END IF;
                END $$;
            


                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = 'FK_OwnerInvestmentTransactions_Companies_CompanyId'
                          AND n.nspname = 'aquora_tenant_greenmount_aqua'
                    ) THEN
                        ALTER TABLE "aquora_tenant_greenmount_aqua"."OwnerInvestmentTransactions"
                        ADD CONSTRAINT "FK_OwnerInvestmentTransactions_Companies_CompanyId"
                        FOREIGN KEY ("CompanyId")
                        REFERENCES "aquora_tenant_greenmount_aqua"."Companies" ("Id")
                        ON DELETE CASCADE;
                    END IF;
                END $$;
            


                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = 'FK_OwnerInvestmentTransactions_Owners_OwnerId'
                          AND n.nspname = 'aquora_tenant_greenmount_aqua'
                    ) THEN
                        ALTER TABLE "aquora_tenant_greenmount_aqua"."OwnerInvestmentTransactions"
                        ADD CONSTRAINT "FK_OwnerInvestmentTransactions_Owners_OwnerId"
                        FOREIGN KEY ("OwnerId")
                        REFERENCES "aquora_tenant_greenmount_aqua"."Owners" ("Id")
                        ON DELETE CASCADE;
                    END IF;
                END $$;
            

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260803170000_SynchronizeAccountsSchema', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."SimpleExpenses" ADD COLUMN IF NOT EXISTS "CashBookId" uuid;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "DateFormat" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "TimeFormat" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "TimeZone" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."BankLedgerEntries" ALTER COLUMN "BankAccountId" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."BankLedgerEntries" ADD COLUMN IF NOT EXISTS "CashBookId" uuid;

ALTER TABLE aquora_tenant_greenmount_aqua."BankLedgerEntries" ADD COLUMN IF NOT EXISTS "LedgerAccountType" text;

ALTER TABLE aquora_tenant_greenmount_aqua."BankLedgerEntries" ADD COLUMN IF NOT EXISTS "LedgerSequence" integer GENERATED BY DEFAULT AS IDENTITY;

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."AssetHistories" (
    "Id" uuid NOT NULL,
    "AssetId" uuid NOT NULL,
    "Date" timestamp with time zone NOT NULL,
    "Action" text NOT NULL,
    "PerformedBy" text NOT NULL,
    "PreviousValue" text,
    "NewValue" text,
    "Remarks" text,
    CONSTRAINT "PK_AssetHistories" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_AssetHistories_Assets_AssetId" FOREIGN KEY ("AssetId") REFERENCES aquora_tenant_greenmount_aqua."Assets" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."CashBooks" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "Name" text NOT NULL,
    "Description" text,
    "OpeningBalance" numeric NOT NULL,
    "CurrentBalance" numeric NOT NULL,
    "Status" text NOT NULL,
    "Notes" text,
    "IsActive" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_CashBooks" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_CashBooks_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."SalaryPayments" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "SalaryNo" text NOT NULL,
    "EmployeeId" uuid NOT NULL,
    "SalaryMonth" text NOT NULL,
    "MonthlySalary" numeric NOT NULL,
    "WorkingDays" integer NOT NULL,
    "DaysWorked" integer NOT NULL,
    "DailySalary" numeric NOT NULL,
    "GrossSalary" numeric NOT NULL,
    "Bonus" numeric NOT NULL,
    "AdvanceDeduction" numeric NOT NULL,
    "OtherDeduction" numeric NOT NULL,
    "NetSalary" numeric NOT NULL,
    "PaymentMethod" text NOT NULL,
    "BankAccountId" uuid,
    "CashBookId" uuid,
    "PaymentDate" timestamp with time zone NOT NULL,
    "Remarks" text,
    "Status" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_SalaryPayments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SalaryPayments_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_SalaryPayments_Users_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES public."Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Vendors" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "VendorCode" text,
    "Name" text NOT NULL,
    "Phone" text,
    "Email" text,
    "GST" text,
    "Address" text,
    "OpeningBalance" numeric NOT NULL,
    "CurrentBalance" numeric NOT NULL,
    "CreditLimit" numeric NOT NULL,
    "IsActive" boolean NOT NULL,
    "Notes" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Vendors" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Vendors_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."Purchases" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "PurchaseNo" text NOT NULL,
    "PurchaseDate" timestamp with time zone NOT NULL,
    "VendorId" uuid,
    "VendorName" text NOT NULL,
    "PurchaseCategory" text NOT NULL,
    "InvoiceNumber" text,
    "ReferenceNumber" text,
    "PaymentMethod" text NOT NULL,
    "BankAccountId" uuid,
    "CashBookId" uuid,
    "SubTotal" numeric NOT NULL,
    "TaxAmount" numeric NOT NULL,
    "DiscountAmount" numeric NOT NULL,
    "OtherCharges" numeric NOT NULL,
    "GrandTotal" numeric NOT NULL,
    "AmountPaid" numeric NOT NULL,
    "BalanceAmount" numeric NOT NULL,
    "PaymentStatus" text NOT NULL,
    "IsCancelled" boolean NOT NULL,
    "CancelledAt" timestamp with time zone,
    "CancelledBy" text,
    "Notes" text,
    "AttachmentUrl" text,
    "AssetId" uuid,
    "CategoryMetadataJson" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_Purchases" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Purchases_Assets_AssetId" FOREIGN KEY ("AssetId") REFERENCES aquora_tenant_greenmount_aqua."Assets" ("Id"),
    CONSTRAINT "FK_Purchases_BankAccounts_BankAccountId" FOREIGN KEY ("BankAccountId") REFERENCES aquora_tenant_greenmount_aqua."BankAccounts" ("Id"),
    CONSTRAINT "FK_Purchases_CashBooks_CashBookId" FOREIGN KEY ("CashBookId") REFERENCES aquora_tenant_greenmount_aqua."CashBooks" ("Id"),
    CONSTRAINT "FK_Purchases_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Purchases_Vendors_VendorId" FOREIGN KEY ("VendorId") REFERENCES aquora_tenant_greenmount_aqua."Vendors" ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."PurchaseItems" (
    "Id" uuid NOT NULL,
    "PurchaseId" uuid NOT NULL,
    "RawMaterialId" uuid,
    "ItemName" text NOT NULL,
    "Quantity" numeric NOT NULL,
    "Unit" text NOT NULL,
    "UnitPrice" numeric NOT NULL,
    "GSTPercent" numeric NOT NULL,
    "DiscountAmount" numeric NOT NULL,
    "TotalAmount" numeric NOT NULL,
    CONSTRAINT "PK_PurchaseItems" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PurchaseItems_Purchases_PurchaseId" FOREIGN KEY ("PurchaseId") REFERENCES aquora_tenant_greenmount_aqua."Purchases" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_PurchaseItems_RawMaterials_RawMaterialId" FOREIGN KEY ("RawMaterialId") REFERENCES aquora_tenant_greenmount_aqua."RawMaterials" ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."PurchasePayments" (
    "Id" uuid NOT NULL,
    "PurchaseId" uuid NOT NULL,
    "PaymentDate" timestamp with time zone NOT NULL,
    "PaymentMethod" text NOT NULL,
    "BankAccountId" uuid,
    "CashBookId" uuid,
    "Amount" numeric NOT NULL,
    "ReferenceNo" text,
    "Notes" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    CONSTRAINT "PK_PurchasePayments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PurchasePayments_BankAccounts_BankAccountId" FOREIGN KEY ("BankAccountId") REFERENCES aquora_tenant_greenmount_aqua."BankAccounts" ("Id"),
    CONSTRAINT "FK_PurchasePayments_CashBooks_CashBookId" FOREIGN KEY ("CashBookId") REFERENCES aquora_tenant_greenmount_aqua."CashBooks" ("Id"),
    CONSTRAINT "FK_PurchasePayments_Purchases_PurchaseId" FOREIGN KEY ("PurchaseId") REFERENCES aquora_tenant_greenmount_aqua."Purchases" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."PurchaseTimelineEvents" (
    "Id" uuid NOT NULL,
    "PurchaseId" uuid NOT NULL,
    "EventDate" timestamp with time zone NOT NULL,
    "Action" text NOT NULL,
    "PerformedBy" text NOT NULL,
    "Details" text NOT NULL,
    "Notes" text,
    CONSTRAINT "PK_PurchaseTimelineEvents" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PurchaseTimelineEvents_Purchases_PurchaseId" FOREIGN KEY ("PurchaseId") REFERENCES aquora_tenant_greenmount_aqua."Purchases" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_SimpleExpenses_CashBookId" ON aquora_tenant_greenmount_aqua."SimpleExpenses" ("CashBookId");

CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_CashBookId" ON aquora_tenant_greenmount_aqua."BankLedgerEntries" ("CashBookId");

CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_LedgerAccountType" ON aquora_tenant_greenmount_aqua."BankLedgerEntries" ("LedgerAccountType");

CREATE INDEX IF NOT EXISTS "IX_AssetHistories_AssetId" ON aquora_tenant_greenmount_aqua."AssetHistories" ("AssetId");

CREATE INDEX IF NOT EXISTS "IX_CashBooks_CompanyId" ON aquora_tenant_greenmount_aqua."CashBooks" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_CashBooks_TenantId" ON aquora_tenant_greenmount_aqua."CashBooks" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_PurchaseItems_PurchaseId" ON aquora_tenant_greenmount_aqua."PurchaseItems" ("PurchaseId");

CREATE INDEX IF NOT EXISTS "IX_PurchaseItems_RawMaterialId" ON aquora_tenant_greenmount_aqua."PurchaseItems" ("RawMaterialId");

CREATE INDEX IF NOT EXISTS "IX_PurchasePayments_BankAccountId" ON aquora_tenant_greenmount_aqua."PurchasePayments" ("BankAccountId");

CREATE INDEX IF NOT EXISTS "IX_PurchasePayments_CashBookId" ON aquora_tenant_greenmount_aqua."PurchasePayments" ("CashBookId");

CREATE INDEX IF NOT EXISTS "IX_PurchasePayments_PurchaseId" ON aquora_tenant_greenmount_aqua."PurchasePayments" ("PurchaseId");

CREATE INDEX IF NOT EXISTS "IX_Purchases_AssetId" ON aquora_tenant_greenmount_aqua."Purchases" ("AssetId");

CREATE INDEX IF NOT EXISTS "IX_Purchases_BankAccountId" ON aquora_tenant_greenmount_aqua."Purchases" ("BankAccountId");

CREATE INDEX IF NOT EXISTS "IX_Purchases_CashBookId" ON aquora_tenant_greenmount_aqua."Purchases" ("CashBookId");

CREATE INDEX IF NOT EXISTS "IX_Purchases_CompanyId" ON aquora_tenant_greenmount_aqua."Purchases" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_Purchases_VendorId" ON aquora_tenant_greenmount_aqua."Purchases" ("VendorId");

CREATE INDEX IF NOT EXISTS "IX_PurchaseTimelineEvents_PurchaseId" ON aquora_tenant_greenmount_aqua."PurchaseTimelineEvents" ("PurchaseId");

CREATE INDEX IF NOT EXISTS "IX_SalaryPayments_CompanyId" ON aquora_tenant_greenmount_aqua."SalaryPayments" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_SalaryPayments_EmployeeId" ON aquora_tenant_greenmount_aqua."SalaryPayments" ("EmployeeId");

CREATE INDEX IF NOT EXISTS "IX_SalaryPayments_SalaryMonth" ON aquora_tenant_greenmount_aqua."SalaryPayments" ("SalaryMonth");

CREATE INDEX IF NOT EXISTS "IX_SalaryPayments_TenantId" ON aquora_tenant_greenmount_aqua."SalaryPayments" ("TenantId");

CREATE INDEX IF NOT EXISTS "IX_Vendors_CompanyId" ON aquora_tenant_greenmount_aqua."Vendors" ("CompanyId");

ALTER TABLE aquora_tenant_greenmount_aqua."BankLedgerEntries" ADD CONSTRAINT "FK_BankLedgerEntries_CashBooks_CashBookId" FOREIGN KEY ("CashBookId") REFERENCES aquora_tenant_greenmount_aqua."CashBooks" ("Id") ON DELETE RESTRICT;

ALTER TABLE aquora_tenant_greenmount_aqua."SimpleExpenses" ADD CONSTRAINT "FK_SimpleExpenses_CashBooks_CashBookId" FOREIGN KEY ("CashBookId") REFERENCES aquora_tenant_greenmount_aqua."CashBooks" ("Id") ON DELETE SET NULL;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260804090455_AddCompanyTimezoneAndFormats', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "BankAccountId" uuid;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "CGST" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "CashBookId" uuid;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "DiscountAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "IGST" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "MetadataJson" text;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "PaymentMethod" text;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "SGST" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "TaxAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "UnitPrice" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ALTER COLUMN "TimeZone" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ALTER COLUMN "TimeFormat" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ALTER COLUMN "DateFormat" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."BackupHistories" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "SchemaName" text NOT NULL,
    "BackupName" text NOT NULL,
    "Description" text NOT NULL,
    "BackupSize" bigint NOT NULL,
    "RecordCount" integer NOT NULL,
    "Checksum" text NOT NULL,
    "Hash" text NOT NULL,
    "FilePath" text NOT NULL,
    "Status" text NOT NULL,
    "DownloadCount" integer NOT NULL,
    "LastDownloaded" timestamp with time zone,
    "CanRestore" boolean NOT NULL,
    "IsEmergencyBackup" boolean NOT NULL,
    "IncludeAttachments" boolean NOT NULL,
    "IncludeAuditLogs" boolean NOT NULL,
    "IncludeUsers" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_BackupHistories" PRIMARY KEY ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."QCAuditLogs" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "ReportId" uuid,
    "ReportNumber" text,
    "Action" text NOT NULL,
    "PerformedBy" text NOT NULL,
    "UserRole" text,
    "Timestamp" timestamp with time zone NOT NULL,
    "Details" text NOT NULL,
    "OldValues" text,
    "NewValues" text,
    "IPAddress" text,
    "UserAgent" text,
    CONSTRAINT "PK_QCAuditLogs" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_QCAuditLogs_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."QCSettings" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "AutoGenerateCAPAOnFailure" boolean NOT NULL,
    "RequireVerificationBeforeSubmit" boolean NOT NULL,
    "StandardComplianceType" text NOT NULL,
    "DigitalSignatureTitle" text NOT NULL,
    "LabAddress" text NOT NULL,
    "ContactEmail" text NOT NULL,
    "NotificationRecipients" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_QCSettings" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_QCSettings_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."RestoreHistories" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "BackupId" uuid NOT NULL,
    "SchemaName" text NOT NULL,
    "StartedBy" text NOT NULL,
    "StartedAt" timestamp with time zone NOT NULL,
    "CompletedAt" timestamp with time zone,
    "DurationMs" bigint NOT NULL,
    "Status" text NOT NULL,
    "IPAddress" text NOT NULL,
    "Details" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_RestoreHistories" PRIMARY KEY ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."WaterTestParameters" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Category" text NOT NULL,
    "Unit" text NOT NULL,
    "MinAcceptable" double precision,
    "MaxAcceptable" double precision,
    "IsActive" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_WaterTestParameters" PRIMARY KEY ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."WaterTestReports" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "BatchNumber" text NOT NULL,
    "SampleNumber" text,
    "ProductionDate" timestamp with time zone,
    "ReportType" text NOT NULL,
    "Status" text NOT NULL,
    "SampleTime" timestamp with time zone,
    "TestedBy" text,
    "CollectedBy" text,
    "VerifiedBy" text,
    "Remarks" text,
    "Attachments" text,
    "IsActive" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_WaterTestReports" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_WaterTestReports_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."ComplianceRecords" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "ReportId" uuid,
    "ReferenceNumber" text NOT NULL,
    "Type" text NOT NULL,
    "Severity" text NOT NULL,
    "Status" text NOT NULL,
    "ParameterName" text NOT NULL,
    "BatchNumber" text NOT NULL,
    "DefectDescription" text NOT NULL,
    "MeasuredValue" text,
    "ExpectedRange" text,
    "RootCauseAnalysis" text,
    "CorrectiveAction" text,
    "PreventiveAction" text,
    "AssignedTo" text NOT NULL,
    "TargetResolutionDate" timestamp with time zone,
    "ResolvedAt" timestamp with time zone,
    "ResolvedBy" text,
    "ResolutionNotes" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_ComplianceRecords" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ComplianceRecords_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ComplianceRecords_WaterTestReports_ReportId" FOREIGN KEY ("ReportId") REFERENCES aquora_tenant_greenmount_aqua."WaterTestReports" ("Id")
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."WaterTestResults" (
    "Id" uuid NOT NULL,
    "ReportId" uuid NOT NULL,
    "ParameterId" uuid NOT NULL,
    "Value" double precision,
    "StringValue" text,
    "IsPass" boolean NOT NULL,
    "QualityStatus" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    CONSTRAINT "PK_WaterTestResults" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_WaterTestResults_WaterTestParameters_ParameterId" FOREIGN KEY ("ParameterId") REFERENCES aquora_tenant_greenmount_aqua."WaterTestParameters" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_WaterTestResults_WaterTestReports_ReportId" FOREIGN KEY ("ReportId") REFERENCES aquora_tenant_greenmount_aqua."WaterTestReports" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_ComplianceRecords_CompanyId" ON aquora_tenant_greenmount_aqua."ComplianceRecords" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_ComplianceRecords_ReportId" ON aquora_tenant_greenmount_aqua."ComplianceRecords" ("ReportId");

CREATE INDEX IF NOT EXISTS "IX_QCAuditLogs_CompanyId" ON aquora_tenant_greenmount_aqua."QCAuditLogs" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_QCSettings_CompanyId" ON aquora_tenant_greenmount_aqua."QCSettings" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_WaterTestReports_CompanyId" ON aquora_tenant_greenmount_aqua."WaterTestReports" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_WaterTestResults_ParameterId" ON aquora_tenant_greenmount_aqua."WaterTestResults" ("ParameterId");

CREATE UNIQUE INDEX IF NOT EXISTS "IX_WaterTestResults_ReportId_ParameterId" ON aquora_tenant_greenmount_aqua."WaterTestResults" ("ReportId", "ParameterId");

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260805105308_AddBackupRestoreModule', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ADD COLUMN IF NOT EXISTS "Format" text NOT NULL DEFAULT '';

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260805112017_AddBackupFormatColumn', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ADD COLUMN IF NOT EXISTS "Encryption" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ADD COLUMN IF NOT EXISTS "EngineVersion" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ADD COLUMN IF NOT EXISTS "RestoreCount" integer NOT NULL DEFAULT 0;

ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ADD COLUMN IF NOT EXISTS "TableCount" integer NOT NULL DEFAULT 0;

ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ADD COLUMN IF NOT EXISTS "TenantName" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ADD COLUMN IF NOT EXISTS "Version" text NOT NULL DEFAULT '';

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260805113323_EnterpriseBackupRedesign', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ALTER COLUMN "Version" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ALTER COLUMN "TenantName" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ALTER COLUMN "Format" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ALTER COLUMN "EngineVersion" DROP NOT NULL;

ALTER TABLE aquora_tenant_greenmount_aqua."BackupHistories" ALTER COLUMN "Encryption" DROP NOT NULL;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260805115320_MakeBackupHistoryFieldsNullable', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."WaterTestReports" ADD COLUMN IF NOT EXISTS "ConcurrencyToken" text NOT NULL DEFAULT (md5(random()::text || clock_timestamp()::text));

ALTER TABLE aquora_tenant_greenmount_aqua."SalaryPayments" ADD COLUMN IF NOT EXISTS "Amount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."SalaryPayments" ADD COLUMN IF NOT EXISTS "MonthlySalaryId" uuid;

ALTER TABLE aquora_tenant_greenmount_aqua."SalaryPayments" ADD COLUMN IF NOT EXISTS "PaymentType" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "AdminPinHash" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Companies" ADD COLUMN IF NOT EXISTS "ApiKey" text;

ALTER TABLE aquora_tenant_greenmount_aqua."BankLedgerEntries" ADD COLUMN IF NOT EXISTS "AuditNotes" text;

ALTER TABLE aquora_tenant_greenmount_aqua."BankLedgerEntries" ADD COLUMN IF NOT EXISTS "EventLabel" text;

ALTER TABLE aquora_tenant_greenmount_aqua."BankLedgerEntries" ADD COLUMN IF NOT EXISTS "EventType" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "AccumulatedDepreciation" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "AssetCode" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "AssetTag" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "AssetType" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "AssignedDate" timestamp with time zone;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "AssignedEmployeeName" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "BuyerParty" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "Condition" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "Department" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "DepreciationFrequency" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "DepreciationMethod" text NOT NULL DEFAULT '';

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "DepreciationStartDate" timestamp with time zone;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "Description" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "DisposalCost" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "DisposalDate" timestamp with time zone;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "DisposalMethod" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "DisposalReason" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "DisposalRefNo" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "DisposedBy" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "FreightCost" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "InstallationCost" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "LastMaintenanceDate" timestamp with time zone;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "Manufacturer" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "ModelNumber" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "NextMaintenanceDate" timestamp with time zone;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "OtherCapitalizedCost" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "PurchaseInvoiceNumber" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "PurchaseOrderNumber" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "ResidualValue" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "SaleValue" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "SupplierName" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "TaxAmount" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "TotalCapitalizedCost" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "TotalMaintenanceCost" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "UsefulLifeYears" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "WarrantyEndDate" timestamp with time zone;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "WarrantyNotes" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "WarrantyNumber" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "WarrantyProvider" text;

ALTER TABLE aquora_tenant_greenmount_aqua."Assets" ADD COLUMN IF NOT EXISTS "WarrantyStartDate" timestamp with time zone;

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."AssetMaintenanceRecords" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "AssetId" uuid NOT NULL,
    "MaintenanceType" text NOT NULL,
    "MaintenanceDate" timestamp with time zone NOT NULL,
    "ServiceProvider" text NOT NULL,
    "Description" text NOT NULL,
    "PartsCost" numeric NOT NULL,
    "LabourCost" numeric NOT NULL,
    "OtherCost" numeric NOT NULL,
    "TotalCost" numeric NOT NULL,
    "NextMaintenanceDate" timestamp with time zone,
    "IsWarrantyClaim" boolean NOT NULL,
    "TechnicianName" text,
    "Notes" text,
    "AttachmentUrl" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    CONSTRAINT "PK_AssetMaintenanceRecords" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_AssetMaintenanceRecords_Assets_AssetId" FOREIGN KEY ("AssetId") REFERENCES aquora_tenant_greenmount_aqua."Assets" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."MonthlySalaries" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "SalaryNo" text NOT NULL,
    "EmployeeId" uuid NOT NULL,
    "SalaryMonth" text NOT NULL,
    "BaseSalary" numeric NOT NULL,
    "WorkingDays" integer NOT NULL,
    "DaysWorked" integer NOT NULL,
    "DailySalary" numeric NOT NULL,
    "GrossSalary" numeric NOT NULL,
    "Bonus" numeric NOT NULL,
    "AdvanceDeduction" numeric NOT NULL,
    "OtherDeduction" numeric NOT NULL,
    "NetSalaryEntitlement" numeric NOT NULL,
    "TotalPaid" numeric NOT NULL,
    "RemainingBalance" numeric NOT NULL,
    "Status" text NOT NULL,
    "Remarks" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_MonthlySalaries" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_MonthlySalaries_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_MonthlySalaries_Users_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES public."Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsIssues" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "IssueNumber" text NOT NULL,
    "Title" text NOT NULL,
    "Description" text NOT NULL,
    "Department" text NOT NULL,
    "Category" text NOT NULL,
    "Priority" text NOT NULL,
    "Status" text NOT NULL,
    "ReportedByUserId" text NOT NULL,
    "ReportedByName" text NOT NULL,
    "AssignedToUserId" text,
    "AssignedToName" text,
    "MachineId" uuid,
    "MachineName" text,
    "ProductionLineId" uuid,
    "ProductionLineName" text,
    "BatchId" uuid,
    "BatchNumber" text,
    "ProductId" uuid,
    "ProductName" text,
    "StationId" uuid,
    "StationName" text,
    "ProductionSessionId" uuid,
    "ShiftId" uuid,
    "RequiresImmediateStop" boolean NOT NULL,
    "ReportedAt" timestamp with time zone NOT NULL,
    "DueDate" timestamp with time zone,
    "ResolvedAt" timestamp with time zone,
    "ClosedAt" timestamp with time zone,
    "VerifiedAt" timestamp with time zone,
    "IsRead" boolean NOT NULL,
    "ReadAt" timestamp with time zone,
    "ReadBy" text,
    "EstimatedCost" numeric,
    "ActualCost" numeric,
    "DowntimeMinutes" integer,
    "RequiresMaintenance" boolean NOT NULL,
    "MaintenanceWorkOrderId" uuid,
    "RootCause" text,
    "CorrectiveAction" text,
    "PreventiveAction" text,
    "Attachments" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "CreatedByIP" text,
    "UpdatedByIP" text,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp with time zone,
    "DeletedBy" text,
    CONSTRAINT "PK_OperationsIssues" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsIssues_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES aquora_tenant_greenmount_aqua."Companies" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsIssueAffectedMachines" (
    "Id" uuid NOT NULL,
    "IssueId" uuid NOT NULL,
    "MachineId" uuid NOT NULL,
    "MachineName" text NOT NULL,
    "MachineCode" text,
    CONSTRAINT "PK_OperationsIssueAffectedMachines" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsIssueAffectedMachines_OperationsIssues_IssueId" FOREIGN KEY ("IssueId") REFERENCES aquora_tenant_greenmount_aqua."OperationsIssues" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsIssueComments" (
    "Id" uuid NOT NULL,
    "IssueId" uuid NOT NULL,
    "AuthorId" text NOT NULL,
    "AuthorName" text NOT NULL,
    "AuthorRole" text NOT NULL,
    "Message" text NOT NULL,
    "AttachmentUrl" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_OperationsIssueComments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsIssueComments_OperationsIssues_IssueId" FOREIGN KEY ("IssueId") REFERENCES aquora_tenant_greenmount_aqua."OperationsIssues" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aquora_tenant_greenmount_aqua."OperationsIssueHistories" (
    "Id" uuid NOT NULL,
    "IssueId" uuid NOT NULL,
    "PerformedBy" text NOT NULL,
    "Action" text NOT NULL,
    "Details" text,
    "Timestamp" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_OperationsIssueHistories" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OperationsIssueHistories_OperationsIssues_IssueId" FOREIGN KEY ("IssueId") REFERENCES aquora_tenant_greenmount_aqua."OperationsIssues" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_SalaryPayments_MonthlySalaryId" ON aquora_tenant_greenmount_aqua."SalaryPayments" ("MonthlySalaryId");

CREATE INDEX IF NOT EXISTS "IX_Purchases_TenantId_IsDeleted_PurchaseDate_CreatedAt" ON aquora_tenant_greenmount_aqua."Purchases" ("TenantId", "IsDeleted", "PurchaseDate", "CreatedAt");

CREATE INDEX IF NOT EXISTS "IX_Purchases_TenantId_VendorId_IsDeleted" ON aquora_tenant_greenmount_aqua."Purchases" ("TenantId", "VendorId", "IsDeleted");

CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_TenantId_BankAccountId_TransactionDate_Cr~" ON aquora_tenant_greenmount_aqua."BankLedgerEntries" ("TenantId", "BankAccountId", "TransactionDate", "CreatedAt");

CREATE INDEX IF NOT EXISTS "IX_BankLedgerEntries_TenantId_CashBookId_LedgerAccountType_Tra~" ON aquora_tenant_greenmount_aqua."BankLedgerEntries" ("TenantId", "CashBookId", "LedgerAccountType", "TransactionDate", "CreatedAt");

CREATE INDEX IF NOT EXISTS "IX_AssetMaintenanceRecords_AssetId" ON aquora_tenant_greenmount_aqua."AssetMaintenanceRecords" ("AssetId");

CREATE INDEX IF NOT EXISTS "IX_MonthlySalaries_CompanyId" ON aquora_tenant_greenmount_aqua."MonthlySalaries" ("CompanyId");

CREATE INDEX IF NOT EXISTS "IX_MonthlySalaries_EmployeeId" ON aquora_tenant_greenmount_aqua."MonthlySalaries" ("EmployeeId");

CREATE INDEX IF NOT EXISTS "IX_MonthlySalaries_TenantId_CompanyId_EmployeeId_SalaryMonth_I~" ON aquora_tenant_greenmount_aqua."MonthlySalaries" ("TenantId", "CompanyId", "EmployeeId", "SalaryMonth", "IsDeleted");

CREATE UNIQUE INDEX IF NOT EXISTS "IX_OperationsIssueAffectedMachines_IssueId_MachineId" ON aquora_tenant_greenmount_aqua."OperationsIssueAffectedMachines" ("IssueId", "MachineId");

CREATE INDEX IF NOT EXISTS "IX_OperationsIssueComments_IssueId" ON aquora_tenant_greenmount_aqua."OperationsIssueComments" ("IssueId");

CREATE INDEX IF NOT EXISTS "IX_OperationsIssueHistories_IssueId" ON aquora_tenant_greenmount_aqua."OperationsIssueHistories" ("IssueId");

CREATE INDEX IF NOT EXISTS "IX_OperationsIssues_CompanyId" ON aquora_tenant_greenmount_aqua."OperationsIssues" ("CompanyId");

ALTER TABLE aquora_tenant_greenmount_aqua."SalaryPayments" ADD CONSTRAINT "FK_SalaryPayments_MonthlySalaries_MonthlySalaryId" FOREIGN KEY ("MonthlySalaryId") REFERENCES aquora_tenant_greenmount_aqua."MonthlySalaries" ("Id") ON DELETE CASCADE;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260817110405_AddMonthlySalaryEntitlements', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."MonthlySalaries" ADD COLUMN IF NOT EXISTS "CalculatedEntitlement" numeric NOT NULL DEFAULT 0.0;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260817112832_AddCalculatedEntitlementToMonthlySalary', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD COLUMN IF NOT EXISTS "ParentTransactionId" uuid;

ALTER TABLE aquora_tenant_greenmount_aqua."MonthlySalaries" ADD COLUMN IF NOT EXISTS "FinalizedAt" timestamp with time zone;

ALTER TABLE aquora_tenant_greenmount_aqua."MonthlySalaries" ADD COLUMN IF NOT EXISTS "FinalizedBy" text;

ALTER TABLE aquora_tenant_greenmount_aqua."MonthlySalaries" ADD COLUMN IF NOT EXISTS "IsFinalized" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE aquora_tenant_greenmount_aqua."CaseConfigurations" ADD COLUMN IF NOT EXISTS "ProductId" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE aquora_tenant_greenmount_aqua."CaseConfigurations" ADD COLUMN IF NOT EXISTS "UnitsPerCase" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "IX_SalesTransactions_ParentTransactionId" ON aquora_tenant_greenmount_aqua."SalesTransactions" ("ParentTransactionId");

CREATE INDEX IF NOT EXISTS "IX_CaseConfigurations_ProductId" ON aquora_tenant_greenmount_aqua."CaseConfigurations" ("ProductId");

CREATE INDEX IF NOT EXISTS "IX_CaseConfigurations_TenantId_ProductId_IsDeleted_IsActive" ON aquora_tenant_greenmount_aqua."CaseConfigurations" ("TenantId", "ProductId", "IsDeleted", "IsActive");

ALTER TABLE aquora_tenant_greenmount_aqua."CaseConfigurations" ADD CONSTRAINT "FK_CaseConfigurations_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES aquora_tenant_greenmount_aqua."Products" ("Id") ON DELETE RESTRICT;

ALTER TABLE aquora_tenant_greenmount_aqua."SalesTransactions" ADD CONSTRAINT "FK_SalesTransactions_SalesTransactions_ParentTransactionId" FOREIGN KEY ("ParentTransactionId") REFERENCES aquora_tenant_greenmount_aqua."SalesTransactions" ("Id") ON DELETE RESTRICT;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260819092641_AddParentTransactionIdToSalesTransactions', '10.0.9');

COMMIT;

START TRANSACTION;
ALTER TABLE "aquora_tenant_greenmount_aqua"."Companies" ADD COLUMN IF NOT EXISTS "IsBiodropsProduction" boolean NOT NULL DEFAULT false;

INSERT INTO aquora_tenant_greenmount_aqua."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260826001400_AddBiodropsProductionToTenant', '10.0.9');

COMMIT;

