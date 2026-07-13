# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /app

# Copy csproj and slnx files for restore caching
COPY Aquora.slnx ./
COPY src/Aquora.Domain/Aquora.Domain.csproj src/Aquora.Domain/
COPY src/Aquora.Application/Aquora.Application.csproj src/Aquora.Application/
COPY src/Aquora.Infrastructure/Aquora.Infrastructure.csproj src/Aquora.Infrastructure/
COPY src/Aquora.Persistence/Aquora.Persistence.csproj src/Aquora.Persistence/
COPY src/Aquora.Shared/Aquora.Shared.csproj src/Aquora.Shared/
COPY src/Aquora.API/Aquora.API.csproj src/Aquora.API/
COPY src/Aquora.Tests/Aquora.Tests.csproj src/Aquora.Tests/

# Restore dependencies
RUN dotnet restore Aquora.slnx

# Copy remainders and publish
COPY . ./
RUN dotnet publish src/Aquora.API/Aquora.API.csproj -c Release -o out

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build-env /app/out .
EXPOSE 80
EXPOSE 443
ENV ASPNETCORE_URLS=http://+:80
ENTRYPOINT ["dotnet", "Aquora.API.dll"]
