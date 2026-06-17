# Microservice Infrastructure: Core Pillars

The HRM platform relies on a robust, containerized infrastructure designed for high availability, fault tolerance, and comprehensive observability.

### 1. Intelligent API Gateway & Load Balancing
*   **Technology:** Kong API Gateway (v3.4) & Nginx
*   **Role:** The single entry point for all client requests (React SPA).
*   **Core Functions:**
    *   **Dynamic Routing:** Routes traffic to specific microservices (e.g., `/api/auth` to Auth Service, `/api/leaves` to Leave Service).
    *   **Global Security:** Enforces Rate Limiting (100 req/min for Auth, 60 req/min for others) to prevent DDoS and Brute-force attacks.
    *   **Load Balancing:** Nginx acts as a reverse proxy on Port 80, distributing traffic smoothly.

### 2. Polyglot Persistence Layer
We use a "Right Tool for the Right Job" database strategy, tailoring storage to specific domain needs:
*   **PostgreSQL (Relational - HA Cluster):** Managed via Patroni/Spilo & HAProxy. Used for core business entities (Users, Attendance Logs, Leave Requests, Payrolls) requiring strict ACID compliance, complex JOINs, and transactional integrity.
*   **MongoDB (NoSQL - Replica Set):** Used for **Audit Trails** (LeaveLog, PayrollLog) and Notification tracking. It handles high-volume, unstructured write operations without slowing down the primary relational database.
*   **Redis (In-Memory Cache & Message Broker):** 
    *   Temporary storage for OTP codes (with a 5-minute TTL).
    *   Session blacklisting for secure logouts.
    *   Pub/Sub broker for Socket.io state synchronization.

### 3. Containerization & Orchestration
*   **Runtime:** Docker & Docker Compose
*   **Role:** Ensures environment parity and orchestrates over 20+ interconnected containers.
*   **Configuration:** Services are decoupled using Docker networks, utilizing environment variables (`.env`) for centralized, decoupled configuration instead of a dedicated config server.

### 4. Monitoring & Observability
*   **Technology:** Prometheus, Grafana, Alertmanager, Blackbox Exporter.
*   **Role:** Comprehensive system health tracking.
*   **Features:** Dashboards track HTTP request rates, P99 latency, error rates, CPU/Memory per host, and database health (Postgres, Mongo, Redis).