# Event-Driven Architecture (EDA) & Messaging

### 1. Interaction Model
The HRM System utilizes an Event-Driven model primarily driven by **Node.js Event Emitters**, **Socket.io**, and **Redis Pub/Sub Adapter**. This ensures eventual consistency across the frontend UI and high responsiveness without requiring clients to poll the server.

### 2. Key Business Flows

**A. Leave Request & Approval Flow**
1.  *Staff* submits a leave request via the Leave Service.
2.  Leave Service writes the request to PostgreSQL and an Audit Log to MongoDB.
3.  Leave Service emits a `new_leave_request` event via Socket.io.
4.  *Consumer (Manager's UI):* Instantly receives a push notification and updates the pending request counter (Red Bell Icon).
5.  *Manager* approves the request. The service updates the DB and emits `leave_status_update`.
6.  *Consumer (Staff's UI):* Receives a real-time Toast notification indicating approval.

**B. Real-Time Internal Broadcasting**
1.  *Admin* publishes a new announcement via the Notification Service.
2.  The content is saved in PostgreSQL and an action log is sent to MongoDB.
3.  The system emits a `new_announcement` event through the Redis message broker.
4.  *Consumers (Targeted Employees):* Socket.io filters the target audience (All, Dept, Role, or Individual) and triggers a real-time popup on their screens.

**C. Automated Payroll Aggregation (Batch/Sync)**
1.  *Manager* triggers payroll calculation.
2.  Salary Service performs concurrent requests to fetch Attendance Logs and Leave records.
3.  It automatically calculates penalties (late/unexcused) and bonuses (overtime) based on System Settings.
4.  Results are upserted (`ON CONFLICT DO UPDATE`) as `DRAFT` in Postgres to ensure idempotency.

### 3. Reliability Patterns

*   **Idempotency & Upserts:** 
    *   Critical endpoints (like Attendance Check-in and Payroll Calculation) use PostgreSQL's `ON CONFLICT DO UPDATE` constraints. This ensures that no matter how many times a user clicks a button, duplicate records are never created.
*   **Polyglot Fallbacks:** 
    *   Non-critical operations (like writing MongoDB audit logs) are executed asynchronously. If MongoDB experiences downtime, it logs an error to the console but allows the primary PostgreSQL transaction to succeed, preventing system-wide crashes.
*   **High Availability Failover:** 
    *   The PostgreSQL cluster utilizes `etcd` and `Patroni` for automatic Leader Election. If the master node fails, a replica is instantly promoted, and `HAProxy` reroutes traffic with near-zero downtime.