# 📂 UC (Use Case & Workflows) - Architecture Diagrams

This folder contains all detailed design diagrams (Sequence Diagrams and Activity Diagrams) illustrating the core business flows of the HRM System. It includes a total of **15 diagrams** covering 100% of the critical features.

## 📊 1. Sequence Diagrams
Sequence diagrams illustrate how system components (Client, API Gateway, Microservices, Database, Redis, Socket) interact with each other over time.

* **Auth Service (Authentication & Identity):**
  * `seq_auth_registration.puml`: Account registration flow, sending OTP via Nodemailer and storing it in Redis.
  * `seq_auth_login.puml`: Login flow, comparing Bcrypt hash, issuing JWT, and storing Session.
  * `seq_password_reset.puml`: OTP request, verification, and new password reset flow.
  * `seq_auth_logout.puml`: Logout flow and Token Invalidation (Blacklisting) in Redis.

* **Attendance Service (Time Tracking):**
  * `seq_attendance_checkin.puml`: Check-in/Check-out flow, calculating late/early time, using `ON CONFLICT` for Idempotency, and collecting metrics (Prometheus).

* **Leave Service (Leave Management):**
  * `seq_submit_leave_request.puml`: Employee leave request submission flow, checking leave balance, logging to MongoDB Audit, and pushing Socket.io event to Manager.
  * `seq_approve_leave.puml`: Manager approve/reject flow, updating status, broadcasting Real-time notifications bi-directionally.
  * `seq_weekly_schedule.puml`: Aggregator flow synthesizing a 7-day working schedule matrix from Users, Attendance, Leaves, and Holidays configuration.

* **Salary Service (Payroll):**
  * `seq_sync_payroll.puml`: Automated synchronization and draft payroll calculation flow (Concurrent fetching).
  * `seq_finalize_payroll.puml`: Manager finalizing payroll (PAID) and writing to Audit Log.

* **Notification Service (Broadcasting):**
  * `seq_realtime_notification.puml`: Admin sending notifications (by Role/Department/Individual) and broadcasting via Socket.io.
  * `seq_mark_notification_read.puml`: Marking notifications as read and logging user action (READ) to MongoDB.

## 🔄 2. Activity Diagrams
Activity diagrams focus on branching logic (If/Else) and the end-to-end execution process of business rules.

* `act_registration.puml`: Process from entering registration info -> OTP verification -> Admin approval -> Account activation.
* `act_leave_approval.puml`: Submission process -> System barrier checks -> Manager decision -> Leave balance update.
* `act_calc_payroll.puml`: Nested loop algorithm for automated payroll calculation per employee (Standard workdays, late penalties, absences, OT bonuses).

---

## 💡 How to preview and export diagrams in VS Code

To render these `.puml` files into beautiful `.png` images to insert into Word reports, follow these steps:

1. Open **Extensions** in VS Code (`Ctrl + Shift + X`).
2. Search and install the **PlantUML** extension (by *jebbs*).
3. **Preview:** Open any `.puml` file, press `Alt + D` (or `Option + D` on Mac). A right panel will show the visual diagram.
4. **Export:** 
   * Open the Command Palette (`Ctrl + Shift + P`).
   * Type `PlantUML: Export Current Diagram` (to export the active file) or `PlantUML: Export Workspace Diagrams` (to export all 15 files to PNG at once).