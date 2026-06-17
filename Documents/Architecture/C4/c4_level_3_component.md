# 🧩 C4 Level 3 – Component Diagram (Attendance Service)

### 1. Description
Visualize the internal architecture of the **Attendance Service**, a critical high-write throughput service. This diagram emphasizes the request flow through security middleware, observability middleware, and the core routing logic.

### 2. Technical Components Description
*   **Express Router:** The entry point for `/verify-code` and `/history` endpoints.
*   **Auth Middleware (`verifyToken`):** Validates the JWT parsed from headers before any domain logic executes.
*   **Metrics Middleware (`prom-client`):** Wraps around the router to intercept `res.on('finish')` and record `http_request_duration_seconds` to Prometheus.
*   **DB Client (`pg pool`):** Handles connection pooling to the highly available PostgreSQL cluster.
*   **Redis Client:** Validates readiness and handles potential cache queries for historical data.

### 3. PlantUML Diagram
```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-office/C4-PlantUML/master/C4_Component.puml
LAYOUT_WITH_LEGEND()

title Component Diagram: Attendance Service

Container(gateway, "API Gateway", "Kong", "Entry Point")
ContainerDb(pg_ha, "PostgreSQL HA", "Patroni", "Primary HR Data")
ContainerDb(redis, "Redis Cache", "Redis", "Performance Caching")
System_Ext(prom, "Prometheus", "Metrics Scraper")

Container_Boundary(attendance_svc, "Attendance Service") {
    
    Component(router, "Express Router", "Express.js", "Routes incoming attendance requests")
    
    Component(auth_mid, "Auth Middleware", "verifyToken function", "Validates JWTs and extracts user_id")
    Component(metrics_mid, "Metrics Middleware", "prom-client", "Calculates request duration & throughput")
    
    Component(controller, "Attendance Logic", "Route Handlers", "Executes ON CONFLICT DO UPDATE upserts")
    
    Component(pg_pool, "PG Pool", "pg library", "Manages database connections")
    Component(redis_client, "Redis Client", "redis library", "Manages cache & readiness state")
}

Rel(gateway, router, "API Requests (/verify-code, /history)", "HTTP/JSON")

Rel(router, metrics_mid, "Intercepts for metrics")
Rel(router, auth_mid, "1. Authenticates Request")
Rel(auth_mid, controller, "2. Passes user_id context")

Rel(controller, pg_pool, "3. Executes DB Queries")
Rel(controller, redis_client, "Reads/Writes Cache")

Rel(pg_pool, pg_ha, "Read/Write", "TCP/5432")
Rel(redis_client, redis, "Check Readiness", "RESP/6379")
Rel(prom, metrics_mid, "Scrapes /metrics", "HTTP")
@enduml
```