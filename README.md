# FlowMES ERP Foundation

A modern, multi-tenant Manufacturing Execution System (MES) and Enterprise Resource Planning (ERP) foundation.

## Tech Stack
- **Backend**: .NET Core, Clean Architecture, Entity Framework Core (PostgreSQL).
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, TanStack Query.
- **Infrastructure**: Docker, Docker Compose, Redis (Caching), JWT Auth.

## Project Structure
- `backend/` - The .NET Web API and Domain/Application layers.
- `frontend/` - The React Vite application.
- `docker-compose.yml` - Orchestrates the complete environment (Postgres, Redis, Backend API, Frontend).

## Getting Started

### Prerequisites
- Docker and Docker Compose
- .NET 8 SDK (for local development)
- Node.js 20+ (for local frontend development)

### Running with Docker (Recommended)
You can spin up the entire application stack using Docker Compose:

```bash
docker-compose up -d --build
```
This will start:
- Frontend on `http://localhost:3000`
- Backend API on `http://localhost:5000`
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

### Running Locally without Docker

1. **Start the Backend**:
   Ensure you have a local PostgreSQL instance running and configured in `appsettings.Development.json`.
   ```bash
   cd backend/src/FlowMes.API
   dotnet run
   ```

2. **Start the Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Key Features Implemented
- **Multi-Tenant Architecture**: Data segregation based on Tenant ID.
- **Soft Deletes & Auditing**: Automatic logging of changes and logical deletions via Entity Framework Interceptors.
- **Responsive UI Kit**: Custom glass-morphism themed UI components (`Card`, `Dialog`, `Alert`, `Button`, `Input`).
- **Organization Hierarchy**: Manage Companies, Plants, Departments, Lines, Stations, and Machines.

## License
MIT
