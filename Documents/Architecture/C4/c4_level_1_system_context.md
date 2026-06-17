# 🗺️ C4 Level 1 – System Context Diagram

### 1. Overview
The HR Management System is a microservices-based enterprise platform providing role-based user management, time tracking, leave workflow orchestration, automated payroll, and real-time broadcasting.

### 2. Scope
*   **Internal:** Identity/Auth, Attendance Tracking, Leave Workflows, Salary Processing, Notifications.
*   **External Interfaces:** Prometheus/Grafana (Observability), Notification Providers (Email/SMTP - logical extension).
*   **Actors:** Staff (Employees), Managers (Department Heads), SuperAdmins (HR/System Admins).

### 3. PlantUML Diagram
```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-office/C4-PlantUML/master/C4_Context.puml

Person(staff, "Staff", "Clocks in/out, requests leave, checks salary.")
Person(manager, "Manager", "Approves leaves, views department attendance.")
Person(admin, "SuperAdmin", "Manages users, computes payroll, broadcasts alerts.")

System(hr_system, "HR Management System", "Microservices platform for human resource tracking and workflows.")
System_Ext(monitoring, "Prometheus & Grafana", "System health and metrics monitoring.")

Rel(staff, hr_system, "Uses the platform", "HTTPS/WSS")
Rel(manager, hr_system, "Manages department", "HTTPS/WSS")
Rel(admin, hr_system, "Configures & processes data", "HTTPS/WSS")

Rel(hr_system, monitoring, "Exposes health/metrics data", "HTTP /metrics")
@enduml
```