# Multi-stage Dockerfile for ASP.NET Core API Deployment on Railway

# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files for dependency restore caching
COPY backend/Aquora.slnx backend/
COPY backend/src/Aquora.Domain/Aquora.Domain.csproj backend/src/Aquora.Domain/
COPY backend/src/Aquora.Application/Aquora.Application.csproj backend/src/Aquora.Application/
COPY backend/src/Aquora.Infrastructure/Aquora.Infrastructure.csproj backend/src/Aquora.Infrastructure/
COPY backend/src/Aquora.Persistence/Aquora.Persistence.csproj backend/src/Aquora.Persistence/
COPY backend/src/Aquora.Shared/Aquora.Shared.csproj backend/src/Aquora.Shared/
COPY backend/src/Aquora.API/Aquora.API.csproj backend/src/Aquora.API/
COPY backend/src/Aquora.Tests/Aquora.Tests.csproj backend/src/Aquora.Tests/

# Restore dependencies
RUN dotnet restore backend/Aquora.slnx

# Copy the rest of the backend source code
COPY backend/ backend/

# Build and Publish in Release configuration
WORKDIR /src/backend/src/Aquora.API
RUN dotnet build Aquora.API.csproj -c Release --no-restore
RUN dotnet publish Aquora.API.csproj -c Release --no-build -o /app/publish

# Stage 2: Production Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Copy published binaries
COPY --from=build /app/publish .

# Environment Defaults for Production
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

# Dynamic PORT binding for Railway (binds to PORT provided by Railway or 8080 by default)
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} exec dotnet Aquora.API.dll"]
