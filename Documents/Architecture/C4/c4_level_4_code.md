# 💻 C4 Level 4 – Code Diagram (Attendance Service Internals)

### 1. Description
Visualize the internal logical flow within the `attendance.js` route file. This diagram focuses on how a single Express router file orchestrates database connections, observability registries, and request processing.

### 2. Code Component Description
*   **Dependencies:** `express`, `jsonwebtoken` (Security), `prom-client` (Observability), `pg` (Database).
*   **Registry & Metrics Setup:** Initializes counters and histograms directly at the file level.
*   **Endpoints:**
    *   `/verify-code`: Executes the core upsert logic (`ON CONFLICT (user_id, work_date) DO UPDATE`) to guarantee idempotency.
    *   `/history/:user_id`: Fetches data, dynamically applying date filters.
    *   `/health/ready`: Performs live pings to PostgreSQL, Redis, and checks Disk Space.

### 3. PlantUML Diagram
```plantuml
@startuml
title Internal Code Flow - attendance.js

skinparam class {
    BackgroundColor White
    ArrowColor #03428e
    BorderColor #03428e
}

package "routes/attendance.js" {
    
    class "Express Router" as router <<Router>> {
        +POST /verify-code
        +GET /history/:user_id
        +GET /team-today/:department_id
        +GET /health/ready
    }

    class "verifyToken" as auth <<Middleware>> {
        +validate JWT
        +attach req.user
    }

    class "Metrics Registry" as metrics <<Prometheus>> {
        +httpRequestDurationMicroseconds: Histogram
        +httpRequestsTotal: Counter
    }

    class "Database Operations" as db <<pg.Pool>> {
        +query(sql, params)
    }
}

router .right.> auth : uses for protected routes
router ..> metrics : intercepts res.on('finish')
router ..> db : executes SQL queries
@enduml
```