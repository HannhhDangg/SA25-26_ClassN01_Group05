# System Overview: HRM Microservices Ecosystem

### 1. Architectural Philosophy
The HRM platform follows a highly available, event-driven Microservices Architecture. The core philosophy centers around **Scalability, Polyglot Persistence, High Availability (Zero Downtime)**, and **Real-time Interaction**. The system is decomposed into autonomous, domain-specific services to ensure that heavy processes (like payroll calculation) do not bottleneck core operations (like daily attendance).

### 2. Core Components
*   **Auth Service:** Identity, Security, OTP Authentication (2FA), and Role-Based Access Control (RBAC).
*   **Attendance Service:** Time Tracking, Check-in/Check-out management, and automated late/early leave calculation.
*   **Leave Service:** Leave Requests, hierarchical Approvals, and Weekly Matrix Schedule generation.
*   **Salary Service:** Automated Payroll Calculation, Penalties, Overtime Bonuses, and Payslip generation.
*   **Notification Service:** Internal Broadcasting, alerting, and real-time engagement via WebSockets.

### 3. Communication Patterns
*   **Synchronous (Request/Response):** 
    *   Managed via **Kong API Gateway** for external routing and rate-limiting. 
    *   Inter-service data aggregation (e.g., Salary Service fetching records from Attendance and Leave databases) is handled via optimized concurrent API fetches (`Promise.all`).
*   **Asynchronous (Event-Driven):** 
    *   Powered by **Redis Pub/Sub** and **Socket.io** for decoupling interactions and providing real-time frontend updates.
    *   Example: Leave request submissions alerting managers instantly without blocking the main thread.