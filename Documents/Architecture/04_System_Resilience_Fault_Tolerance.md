# System Resilience & Fault Tolerance

### 1. Bulkhead & Isolation
Services are strictly isolated by container processes and dedicated resources (Docker). A sudden memory leak or failure in the **Salary Service** (e.g., during heavy end-of-month batch processing) does not block employees from performing their daily check-ins via the **Attendance Service**.

### 2. High Availability Failover (Database Level)
*   **Monitoring:** `etcd` continuously observes the health of the PostgreSQL nodes.
*   **State Switch (Leader Election):** Implemented via **Patroni / Spilo**. If the primary master node (`postgres-1`) crashes, the cluster automatically promotes a replica (`postgres-2` or `postgres-3`) to Master.
*   **Traffic Routing:** **HAProxy** dynamically detects the new Master and redirects all write operations with near-zero downtime, preventing upstream services from failing.

### 3. Graceful Fallbacks
When a non-critical infrastructure component is unavailable, the system degrades gracefully rather than crashing completely.
*   **Message Broker Outage:** If Redis disconnects, the real-time WebSocket (`Socket.io`) functionalities will display a warning or fallback to HTTP polling, but the core REST APIs (like HTTP POST `/api/leaves`) will still function normally and write to the database (Verified in Test Case `TC-SYS-06`).
*   **Audit Logging Fallback:** If MongoDB is down, the system prints an error to the console but allows the primary PostgreSQL transaction to succeed, ensuring users can still complete their workflows.

### 4. Rate Limiting & API Gateway Protection
*   **Gateway Level:** **Kong API Gateway** acts as the shield against abusive traffic.
*   **Logic:** 
    *   **Anti-Brute-Force:** Limits Auth endpoints (`/api/auth`) to **100 requests/minute/IP**.
    *   **Anti-DDoS:** Limits general business APIs (Leave, Attendance) to **60 requests/minute/IP**.
    *   Violations immediately return an `HTTP 429 Too Many Requests` response.

### 5. Idempotent Operations
*   **Concurrency Handling:** Uses PostgreSQL's `ON CONFLICT DO UPDATE` constraints. 
*   **Example:** If a user clicks the "Check-in" button 5 times simultaneously, the Attendance Service guarantees that only one record is created for that date, preventing duplicate data anomalies.

### 6. Observability
*   **Logs:** Standardized application logs output to `/dev/stdout` and captured by Docker. Kong Gateway provides detailed Access and Admin logs.