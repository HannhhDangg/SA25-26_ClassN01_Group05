# 🏗️ C4 Level 2 – Container Diagram

### 1. Architecture
A decoupled microservices architecture utilizing Node.js, Express, and React, backed by highly available databases (PostgreSQL with Patroni, MongoDB Replica Set) and Redis for caching.

### 2. Core Containers
*   **Web App:** React frontend for Staff, Managers, and Admins.
*   **API Gateway:** Kong / Nginx acting as the entry point and load balancer.
*   **Auth Service:** Identity & RBAC (PostgreSQL).
*   **Attendance Service:** High-throughput time tracking & metrics (PostgreSQL + Redis).
*   **Leave Service:** Workflow orchestration (PostgreSQL + MongoDB for Audit).
*   **Salary Service:** Payroll aggregation engine.
*   **Notification Service:** Real-time WebSockets broadcaster (Socket.io + MongoDB).

### 3. PlantUML Diagram
```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-office/C4-PlantUML/master/C4_Container.puml
LAYOUT_WITH_LEGEND()

title Container Diagram - HR Management System

Person(user, "HR User", "Staff, Manager, or Admin")

System_Boundary(hr_boundary, "HR Management System") {
    
    Container(app, "Web/Mobile App", "React", "High-performance HR Dashboard")
    Container(gateway, "API Gateway / LB", "Kong & Nginx", "Routing and Load Balancing")
    
    ContainerDb(redis, "Global Cache", "Redis", "Session cache, rate limits, and hot queries")

    '--- Core Services ---
    Container(auth, "Auth Service", "Node.js/Express", "Identity, RBAC & Departments")
    Container(attendance, "Attendance Service", "Node.js/Express", "Time tracking & daily activity streams")
    Container(leave, "Leave Service", "Node.js/Express", "Leave request workflows")
    Container(salary, "Salary Service", "Node.js/Express", "Dynamic payroll aggregation")
    Container(notification, "Notification Service", "Node.js/Socket.io", "Real-time broadcasting")

    '--- Databases ---
    ContainerDb(pg_ha, "PostgreSQL HA", "Patroni/Spilo", "Relational data (Users, Attendance, Leaves)")
    ContainerDb(mongo_rep, "MongoDB Cluster", "Replica Set", "Audit logs & Notification histories")
}

System_Ext(prom, "Prometheus", "Metrics Scraper")

Rel(user, app, "Uses", "HTTPS")
Rel(app, gateway, "API & WebSocket Calls", "HTTPS / WSS")

Rel(gateway, auth, "Routes /api/auth", "HTTP")
Rel(gateway, attendance, "Routes /api/attendance", "HTTP")
Rel(gateway, notification, "Routes /api/noti & WebSockets", "HTTP/WSS")

Rel(attendance, pg_ha, "Upsert Logs", "TCP/5432")
Rel(notification, mongo_rep, "Save Audit Logs", "TCP/27017")
Rel(attendance, prom, "Exposes /metrics", "HTTP")

@enduml
```