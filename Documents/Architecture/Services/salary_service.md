# 💰 Salary Service (Payroll): Financial Aggregation & Idempotency

### 1. Domain
Acts as the automated "Chief Accountant". Consumes data from all other modules (Standard Work Days, Actual Attendance, Late Penalties, Approved Leaves) to automatically compute the final Net Salary.

### 2. Integrity & Reliability
*   **Real-time Calculation Engine:** Instead of hardcoding payroll tables, the `syncPayrollRealtime()` function dynamically computes the salary every time a user accesses the payroll page for that month (excluding Sundays, factoring in Holidays, deducting late fines, adding OT bonuses).
*   **Data Integrity (State Lock):** Payroll records have two states: `DRAFT` and `PAID`. If the accountant has finalized the payroll (`PAID`), the calculation loop will actively `continue;` and skip that user to avoid distorting financial history, even if HR modifies past attendance logs.

### 3. Audit & Traceability
*   Accurately stores granular details regarding penalty days and violation types (`total_unexcused_days`, `total_late_days`) allowing employees to call the `/penalties` API for transparent cross-checking of every late minute.

```plantuml
@startuml
participant Admin
participant SalaryService
database PostgreSQL (Attendance/Leave)
database MongoDB (PayrollLog)

Admin -> SalaryService: Trigger Calculate Payroll (Month, Year)
SalaryService -> PostgreSQL: Fetch Users, Attendance, Leaves
SalaryService -> SalaryService: Execute syncPayrollRealtime()
SalaryService -> PostgreSQL: DELETE old DRAFT -> INSERT new DRAFT
SalaryService -> MongoDB: Write Audit Log (CALCULATE_PAYROLL)
SalaryService -> Admin: "Payroll calculated successfully!"
@enduml
```