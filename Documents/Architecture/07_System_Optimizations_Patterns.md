# System Optimizations & Architectural Patterns

### 1. Concurrent API Fetching (Frontend Aggregation)
*   **Logic:** To display complex views like the Admin Dashboard, the React frontend uses `Promise.all` to fetch data from the Auth Service (Users) and Leave Service (Stats) simultaneously.
*   **Benefit:** Reduces total network latency to the duration of the slowest single request, preventing UI blocking.

### 2. Event-Driven Architecture (EDA) & WebSockets
*   **Broker:** Redis Pub/Sub + Socket.io.
*   **Key Flows:**
    *   **Leave Request:** `leave_service` receives a request -> Validates & inserts to DB -> Emits `new_leave_request` -> `Socket.io` pushes a Red Bell notification instantly to the Manager's screen.
    *   **Announcements:** `noti_service` broadcasts -> targeted users receive a real-time toast notification.
*   **Benefit:** Highly responsive User Experience (UX) without the overhead of HTTP Long Polling.

### 3. Polyglot Persistence
*   **Postgres (ACID):** Used for core logic. Features `ON CONFLICT DO UPDATE` ensuring Idempotency (preventing duplicate attendance logs or payroll records).
*   **MongoDB (Schema-less Logs):** Used for Audit Trails. High-speed `Mongoose.create()` executes without blocking the main HTTP response loop.

### 4. Payroll Calculation Engine (Batch Aggregation)
*   **Service:** Salary Service.
*   **Logic:** Fetches settings (Penalties, standard days) and dynamically loops through `attendance_logs` and `leave_requests`. 
*   **Optimization:** Aggregates penalties, late minutes, and unexcused absences purely in backend memory, resulting in a single `DRAFT` record inserted into PostgreSQL. Avoids the "N+1 query problem" by batching the data fetching phase.

### 5. Access Control via API Gateway & Middleware
*   **Stateless Authentication:** JWT validation is done at the microservice middleware level. 
*   **Security:** System strictly uses `user_id` decoded from the JWT payload for all core queries (Check-ins, Leave balance). This structurally eliminates **IDOR (Insecure Direct Object Reference)** vulnerabilities, making it impossible for a staff member to spoof attendance for a colleague.

### 6. Automated Infrastructure Configuration
*   **Database Seeding:** `init.sql` automatically provisions schemas, tables, cross-references (foreign keys), and injects mock history data (Payrolls, Leaves) the moment the Docker environment is built. 
*   **Benefit:** Zero-configuration setup for new developers joining the project.