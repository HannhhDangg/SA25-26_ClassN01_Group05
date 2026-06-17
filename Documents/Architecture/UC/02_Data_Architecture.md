# Data Architecture: Polyglot Persistence

The HR Management System utilizes the "Right Tool for the Right Job" principle for data storage, ensuring high availability, performance, and scalability across different microservices.

### 1. Storage Selection

**PostgreSQL (RMDB - High Availability Cluster):**
*   **Used for:** Identity (Users, Departments), Time Tracking (Attendance Logs), Workflow (Leave Requests), and Financials (Payrolls).
*   **Reasoning:** Requires strict ACID compliance, complex relational queries (e.g., joining Attendance, Leaves, and Users to aggregate monthly payroll), and transactional integrity. Implemented as a Highly Available (HA) cluster using Patroni, Etcd, and HAProxy to eliminate single points of failure.

**MongoDB (NoSQL - Replica Set):**
*   **Used for:** Audit Trails (LeaveLog, PayrollLog) and Notification Logs.
*   **Reasoning:** Handles high-volume, semi-structured data and extreme write throughput. Logging every system action (READ, SENT, APPROVED) in MongoDB ensures that the primary PostgreSQL database is not bottlenecked by heavy insert operations. Implemented as a 3-node Replica Set (`rs0`) for fault tolerance.

**Redis (In-Memory Cache & Message Broker):**
*   **Used for:** Ephemeral state (OTP caching with TTL), Session Management (JWT blacklisting), and real-time Event-Driven communication (Pub/Sub for Socket.io).
*   **Reasoning:** Provides ultra-low latency for frequent lookups and acts as a lightning-fast intermediary for inter-service communication.

### 2. Consistency Model

*   **Strong Consistency:** Maintained within a single domain service using PostgreSQL. For instance, the Attendance Service uses `ON CONFLICT (user_id, work_date) DO UPDATE` to ensure an employee can never have duplicate attendance records for the same day, regardless of concurrent check-in clicks.
*   **Eventual Consistency:** Applied across service boundaries. For example, when a Leave Request is approved, the PostgreSQL transaction completes immediately, while the Audit Log is written to MongoDB asynchronously. Real-time updates via Redis/Socket.io ensure the client UI reaches consistency with the backend within milliseconds.

### 3. Optimization Techniques

**Indexing Strategy:**
*   **Postgres:** 
    *   B-Tree indexes on foreign keys (`department_id`, `manager_id`).
    *   Unique composite indexes `(user_id, work_date)` for attendance idempotency and `(user_id, payroll_month, payroll_year)` for payroll conflict resolution.
*   **Mongo:** 
    *   Compound indexes on `(announcement_id, user_id)` and `(action, created_at)` to optimize high-speed log retrieval and auditing.

**Connection Pooling:**
*   Using the `pg` library pool directly connected to HAProxy (`port 5000`) to multiplex queries effectively across the PostgreSQL Patroni cluster.

**Future Optimizations (Scalability Scope):**
*   **Read/Write Splitting:** Routing heavy analytical queries (e.g., generating year-end HR reports) to PostgreSQL read replicas (`postgres-2`, `postgres-3`), leaving `postgres-1` (Master) dedicated to write operations.
*   **Data Partitioning/Sharding:** Partitioning the `attendance_logs` table by year and month. As the company grows, historical attendance data becomes massive; partitioning will keep daily Check-in/Check-out queries instantaneous.
*   **Cache-Aside Pattern:** Implementing Redis caching for the `/leaves/schedule/weekly` endpoint, as holiday settings and past attendance logs rarely change.