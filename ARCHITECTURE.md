# FlowMES Architecture

FlowMES follows a modern, modular design, utilizing Clean Architecture principles on the backend and a feature-based structure on the frontend.

## Backend Architecture (.NET 8)
The backend is split into distinct projects to enforce a strict dependency rule (inner layers do not depend on outer layers).

- **FlowMes.Domain**: Contains the core enterprise logic, entities (e.g. `Company`, `Plant`, `User`), interfaces, and domain-specific rules (like `IMultiTenant`, `IAuditable`).
- **FlowMes.Application**: Contains the business use cases, DTOs, service interfaces, validation, and CQRS handlers. Depends only on the Domain layer.
- **FlowMes.Infrastructure**: Implements the technical details like caching (Redis), token generation (JWT), and contextual user information resolution.
- **FlowMes.Persistence**: Handles data access using Entity Framework Core. Contains the `ApplicationDbContext`, database migrations, and EF Interceptors for Soft Delete, Auditing, and Multi-tenancy.
- **FlowMes.API**: The presentation layer. Exposes REST controllers, configures middleware (tenant resolution, error handling), and sets up SignalR Hubs.
- **FlowMes.Shared**: Common utilities, constants, and extensions used across multiple projects.

## Frontend Architecture (React + Vite)
The frontend relies on a clean, scalable feature structure.

- **`src/components/ui`**: Reusable, atomic UI elements (Buttons, Cards, Dialogs) styled with Tailwind CSS.
- **`src/layouts`**: Structural layout components wrapping specific pages (e.g., `DashboardLayout`, `AuthLayout`).
- **`src/pages`**: Higher-level views like `LoginPage` and `DashboardPage`.
- **`src/services`**: API interaction services, primarily leveraging Axios and TanStack Query for robust data fetching and caching.
- **`src/store`**: Global state management powered by Zustand (e.g., `useAuthStore`, `useNotificationStore`).

## Cross-Cutting Concerns
- **Multi-Tenancy**: The `TenantResolutionMiddleware` extracts the tenant context from the request header (`X-Tenant-Code`). The EF Core `ApplicationDbContext` automatically filters and assigns `TenantId` across all implementing entities.
- **Auditing**: Audit logs are generated automatically on `SaveChangesAsync()` through an interceptor, tracking changes at the field level.
- **Authentication/Authorization**: Secured via JWT, with fine-grained permission enforcement.
