# Use Case Specification - HR Management System (HRM System)

This document details the 25 core Use Cases of the Microservices architecture system following the standard template.

---

## 1. Authentication & Authorization Service (Auth Service - UC1 to UC6)

### UC1: Register (Account Registration)
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Register new personnel account |
| **2. Use Case ID** | UC_001 |
| **3. Actors** | Guest / New Employee |
| **4. Brief Description** | Allows users to register an account and request an OTP code via Email. |
| **5. Preconditions** | User accesses the Registration screen. |
| **6. Postconditions** | OTP code is saved in Redis and sent via Email. |
| **7. Main Flow** | Step 1: User enters username, email, password.<br>Step 2: System validates info, checks for duplicates.<br>Step 3: Hash password using Bcrypt.<br>Step 4: Generate 6-digit OTP, save to Redis (TTL 5 mins).<br>Step 5: Send OTP via Nodemailer.<br>Step 6: Return success message. |
| **8. Exception Flow** | At step 2: Username or Email already exists -> Return error. |
| **9. Business Rules** | Password must be strong. Rate-limiting enforced on Kong API Gateway (prevent OTP spam). |

### UC2: Verify OTP & Create Account
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Verify OTP & Create Account |
| **2. Use Case ID** | UC_002 |
| **3. Actors** | Guest / New Employee |
| **4. Brief Description** | Enter OTP to complete registration. Account will be in pending approval status. |
| **5. Preconditions** | UC1 executed successfully. |
| **6. Postconditions** | User is saved in PostgreSQL with `PENDING_ADMIN` status. |
| **7. Main Flow** | Step 1: User enters 6-digit OTP.<br>Step 2: System checks OTP in Redis.<br>Step 3: Save user to PostgreSQL.<br>Step 4: Delete OTP in Redis.<br>Step 5: Emit `new_user_registered` event to notify Admin. |
| **8. Exception Flow** | At step 2: Incorrect or expired OTP -> Return error "Invalid/Expired OTP". |
| **9. Business Rules** | Newly created accounts default to `STAFF` role and `PENDING_ADMIN` status. |

### UC3: Login
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | System Login |
| **2. Use Case ID** | UC_003 |
| **3. Actors** | Staff, Manager, Superadmin |
| **4. Brief Description** | Authenticate user and issue JWT. |
| **5. Preconditions** | Account must be in `ACTIVE` status. |
| **6. Postconditions** | JWT token is issued, session is saved in Redis. |
| **7. Main Flow** | Step 1: Enter username and password.<br>Step 2: Retrieve user data from DB.<br>Step 3: Use Bcrypt to compare passwords.<br>Step 4: Issue JWT (containing id, role, dept).<br>Step 5: Save session in Redis (TTL 1 day). |
| **8. Exception Flow** | Step 2: `PENDING_ADMIN` account -> Return inactive error.<br>Step 3: Incorrect password -> Return login info error. |
| **9. Business Rules** | Password is never returned to the Client. |

### UC4: Logout
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Logout |
| **2. Use Case ID** | UC_004 |
| **3. Actors** | Logged-in User |
| **4. Brief Description** | Invalidate the current session. |
| **5. Preconditions** | Header contains a valid JWT. |
| **6. Postconditions** | Session is removed from cache. |
| **7. Main Flow** | Step 1: Click "Logout".<br>Step 2: System extracts `user_id` from JWT.<br>Step 3: Delete the corresponding session key in Redis (Token Blacklisting).<br>Step 4: Client clears local storage. |
| **8. Exception Flow** | None. |
| **9. Business Rules** | Even if JWT is not expired, authentication is blocked at middleware if the session is no longer in Redis. |

### UC5: Password Reset
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Forgot / Reset Password |
| **2. Use Case ID** | UC_005 |
| **3. Actors** | User |
| **4. Brief Description** | Reset password via OTP verification code sent to Email. |
| **5. Preconditions** | Email is registered in the system. |
| **6. Postconditions** | New password is updated. |
| **7. Main Flow** | Step 1: Enter email to reset, receive OTP (Similar to UC1).<br>Step 2: Enter OTP and New Password.<br>Step 3: System checks Redis OTP.<br>Step 4: Hash new password and UPDATE `users` table.<br>Step 5: Delete OTP. |
| **8. Exception Flow** | Incorrect/Expired OTP. |
| **9. Business Rules** | Do not store plain-text passwords. |

### UC6: Approve Account
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Activate employee account |
| **2. Use Case ID** | UC_006 |
| **3. Actors** | Superadmin, Admin |
| **4. Brief Description** | Change account status from PENDING to ACTIVE. |
| **5. Preconditions** | Admin logged in successfully. |
| **6. Postconditions** | Employee can log in. |
| **7. Main Flow** | Step 1: Go to HR Management.<br>Step 2: Find user with `PENDING_ADMIN` status.<br>Step 3: Click Activate.<br>Step 4: Update PostgreSQL status. |
| **8. Exception Flow** | None. |
| **9. Business Rules** | Only `SUPERADMIN` or `ADMIN` roles have permission to execute. |

---

## 2. Attendance Service (UC7 to UC9)

### UC7: Check-in / Check-out
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Daily Attendance (Check-in/out) |
| **2. Use Case ID** | UC_007 |
| **3. Actors** | All employees |
| **4. Brief Description** | Record clock-in and clock-out times, automatically calculate late minutes. |
| **5. Preconditions** | Valid JWT. |
| **6. Postconditions** | `attendance_logs` table is updated. |
| **7. Main Flow** | Step 1: User clicks Check-in/Check-out.<br>Step 2: Extract `user_id` from Token (Prevent ID faking).<br>Step 3: Record actual time.<br>Step 4: Use SQL `ON CONFLICT DO UPDATE` to overwrite the day's log if clicked multiple times.<br>Step 5: Prometheus records metrics. |
| **8. Exception Flow** | DB Error -> Return 500 System Error. |
| **9. Business Rules** | Idempotency: 1 user has only 1 attendance record per day. |

### UC8: View Attendance History
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | View personal attendance history |
| **2. Use Case ID** | UC_008 |
| **3. Actors** | All employees |
| **4. Brief Description** | Review own clock-in/out data. |
| **5. Preconditions** | Logged in successfully. |
| **6. Postconditions** | Return history JSON. |
| **7. Main Flow** | Step 1: Access Attendance screen.<br>Step 2: Send GET request to `/history/:user_id`.<br>Step 3: Return max 30 records or by date range. |
| **8. Exception Flow** | None. |
| **9. Business Rules** | Sort by date descending (Newest first). |

### UC9: View Team Attendance
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Monitor department attendance |
| **2. Use Case ID** | UC_009 |
| **3. Actors** | Manager, Superadmin |
| **4. Brief Description** | View current status (Working/Left/Not In) of all employees in the department today. |
| **5. Preconditions** | User has `MANAGER` role. |
| **6. Postconditions** | List of employees and today's logs. |
| **7. Main Flow** | Step 1: Call API GET `/team-today/:dept_id`.<br>Step 2: System JOINs `users` and `attendance_logs` tables with condition `CURRENT_DATE`.<br>Step 3: Return list. |
| **8. Exception Flow** | None. |
| **9. Business Rules** | Only show `STAFF` role of the corresponding department. |

---

## 3. Leave Management Service (Leave Service - UC10 to UC15)

### UC10: Submit Leave Request
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Submit leave request |
| **2. Use Case ID** | UC_010 |
| **3. Actors** | Staff, Manager |
| **4. Brief Description** | Register for leave (Annual, Sick, Unpaid). |
| **5. Preconditions** | Logged in successfully. |
| **6. Postconditions** | Request saved with `PENDING` status, Manager receives notification. |
| **7. Main Flow** | Step 1: Fill in reason, start, and end dates.<br>Step 2: Check consecutive logic (<= 3 days).<br>Step 3: Check limit logic (Does not exceed remaining days).<br>Step 4: Check absence count logic (Under 5 people/day).<br>Step 5: Save to DB and write MongoDB Audit Log.<br>Step 6: Emit `new_leave_request` Socket.io event. |
| **8. Exception Flow** | Step 2,3,4 violated -> System returns error and blocks request creation. |
| **9. Business Rules** | Integrity: Do not allow request creation if business rules are violated. |

### UC11: Check Leave Balance
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | View annual leave balance |
| **2. Use Case ID** | UC_011 |
| **3. Actors** | All employees |
| **4. Brief Description** | Get total max leave days, used, and remaining. |
| **5. Preconditions** | Logged in successfully. |
| **6. Postconditions** | Return object {max, used, remaining}. |
| **7. Main Flow** | Step 1: Provide `user_id`.<br>Step 2: Check IDOR (Staff cannot view others).<br>Step 3: SUM total days with `APPROVED` status in current year.<br>Step 4: Return calculated result. |
| **8. Exception Flow** | Send `user_id` of another person while being `STAFF` -> 403 Error. |
| **9. Business Rules** | Default leave days taken from `max_leave_days` column (usually 12). |

### UC12: View Leave History
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Leave request history |
| **2. Use Case ID** | UC_012 |
| **3. Actors** | All employees |
| **4. Brief Description** | List created requests and statuses. |
| **5. Preconditions** | Logged in successfully. |
| **6. Postconditions** | List of requests. |
| **7. Main Flow** | Step 1: Call API GET `/:user_id`.<br>Step 2: Check IDOR.<br>Step 3: Retrieve data and sort by creation date. |
| **8. Exception Flow** | Fail IDOR check -> 403 Error. |
| **9. Business Rules** | Users cannot delete approved requests themselves. |

### UC13: Approve/Reject Leave
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Review leave requests |
| **2. Use Case ID** | UC_013 |
| **3. Actors** | Manager, Superadmin |
| **4. Brief Description** | Approve or reject subordinate's leave request. |
| **5. Preconditions** | Pending request exists under their authority. |
| **6. Postconditions** | Status updated, notification generated, log written. |
| **7. Main Flow** | Step 1: Manager views PENDING list.<br>Step 2: Click approve/reject.<br>Step 3: Check permissions (Cannot approve cross-department or for Boss).<br>Step 4: Update PostgreSQL to `APPROVED`/`REJECTED`.<br>Step 5: Write MongoDB Audit.<br>Step 6: Write SQL Announcements for requester.<br>Step 7: Emit 2 Socket.io events (update request UI & bell notification). |
| **8. Exception Flow** | Manager tries to approve other dept's request -> 403 Error. |
| **9. Business Rules** | Extremely strict logging of all actions (Who approved, at what time). |

### UC14: Get Weekly Schedule
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Working schedule matrix (Aggregator) |
| **2. Use Case ID** | UC_014 |
| **3. Actors** | All employees |
| **4. Brief Description** | Aggregator API drawing a 7-day grid including weekends, holidays, and attendance. |
| **5. Preconditions** | Logged in successfully. |
| **6. Postconditions** | JSON Matrix Data. |
| **7. Main Flow** | Step 1: Determine User set based on Role.<br>Step 2: Use `generate_series` for 7-day sequence.<br>Step 3: Fetch Leaves (APPROVED), Attendance Logs, and Holidays Config.<br>Step 4: Backend Map data: Loop and compare each day to see if it's HOLIDAY, LEAVE, WEEKEND, or WORKING.<br>Step 5: Return aggregated JSON. |
| **8. Exception Flow** | SQL Error -> 500 Error. |
| **9. Business Rules** | Staff only see themselves; Manager sees entire dept; Director sees all managers. |

### UC15: Admin Dashboard Stats
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Get Dashboard metrics |
| **2. Use Case ID** | UC_015 |
| **3. Actors** | Manager, Admin |
| **4. Brief Description** | Get total users, absent count, pending requests count. |
| **5. Preconditions** | Logged in successfully. |
| **6. Postconditions** | JSON counts. |
| **7. Main Flow** | Run parallel SQL COUNT commands based on Role. |
| **8. Exception Flow** | None. |
| **9. Business Rules** | Managers only count data within their department scope. |

---

## 4. Payroll Service (Salary Service - UC16 to UC19)

### UC16: Auto-calculate Payroll
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Sync & Auto-calculate Payroll |
| **2. Use Case ID** | UC_016 |
| **3. Actors** | System, Manager, Admin |
| **4. Brief Description** | Payroll engine scans all attendance logs, leaves, and holidays to output net salary. |
| **5. Preconditions** | Select month and year. |
| **6. Postconditions** | `monthly_payrolls` table updated with `DRAFT` status. |
| **7. Main Flow** | Step 1: Get standard work days (excluding Sundays).<br>Step 2: Parallel query Users, Logs, Leaves, Settings.<br>Step 3: Delete old DRAFTs.<br>Step 4: Loop per user -> Loop per day: Calculate Penalty (late, absent) and Bonus (OT).<br>Step 5: Insert ON CONFLICT DO UPDATE into PostgreSQL. |
| **8. Exception Flow** | User has `PAID` payroll -> Skip, absolutely no overwriting. |
| **9. Business Rules** | Paid leave days are not deducted; holidays count as 1 workday; Net salary cannot be < 0. |

### UC17: View Payroll List
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | View payroll list |
| **2. Use Case ID** | UC_017 |
| **3. Actors** | All employees |
| **4. Brief Description** | Display payslip or department payroll list. |
| **5. Preconditions** | Call API `GET /:year/:month`. |
| **6. Postconditions** | JSON payroll data. |
| **7. Main Flow** | Step 1: System IMPLICITLY CALLS `syncPayrollRealtime` (UC16) to ensure latest data.<br>Step 2: Select data by Role (Personal/Dept/Company).<br>Step 3: Sort by descending salary. |
| **8. Exception Flow** | None. |
| **9. Business Rules** | Data is auto-calculated (Real-time aggregation) upon opening the page. |

### UC18: Finalize Payroll
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Finalize payroll payment |
| **2. Use Case ID** | UC_018 |
| **3. Actors** | Manager, Admin |
| **4. Brief Description** | Mark payroll as paid, lock data. |
| **5. Preconditions** | Payroll is in `DRAFT` status. |
| **6. Postconditions** | Payroll changes to `PAID` and log is written. |
| **7. Main Flow** | Step 1: Click "Mark as Paid".<br>Step 2: Check Role.<br>Step 3: UPDATE DB to `PAID`.<br>Step 4: Write Audit Log to MongoDB (Action: FINALIZE_PAYROLL). |
| **8. Exception Flow** | Role = STAFF -> Return 403. |
| **9. Business Rules** | `PAID` data is immutable. |

### UC19: View Penalties Details
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | View penalty/deduction details |
| **2. Use Case ID** | UC_019 |
| **3. Actors** | User |
| **4. Brief Description** | List late, early leave, absent days for cross-checking. |
| **5. Preconditions** | Has user ID. |
| **6. Postconditions** | List of violation logs. |
| **7. Main Flow** | Step 1: Call API.<br>Step 2: Check IDOR.<br>Step 3: Filter DB for days with late_minutes > 0 or violation status.<br>Step 4: Return to client. |
| **8. Exception Flow** | Fail IDOR check -> 403 Error. |
| **9. Business Rules** | Transparency in financial data. |

---

## 5. Notification Service (UC20 to UC25)

### UC20: Broadcast Announcement
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Broadcast internal announcement |
| **2. Use Case ID** | UC_020 |
| **3. Actors** | Manager, Admin |
| **4. Brief Description** | Send real-time broadcast messages. |
| **5. Preconditions** | Enter title and content. |
| **6. Postconditions** | Announcement saved to DB, recipients see Pop-up. |
| **7. Main Flow** | Step 1: Select Target (ALL, ROLE, DEPT, INDIVIDUAL).<br>Step 2: Insert into PostgreSQL.<br>Step 3: Insert "SENT" Audit Log to MongoDB.<br>Step 4: Emit Socket.io `new_announcement`.<br>Step 5: Auto-mark as read for sender. |
| **8. Exception Flow** | None. |
| **9. Business Rules** | Manager can only broadcast to DEPT and Individual. Admin can broadcast ALL. |

### UC21: View Notifications
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | View notification inbox |
| **2. Use Case ID** | UC_021 |
| **3. Actors** | All employees |
| **4. Brief Description** | Get list of received notifications. |
| **5. Preconditions** | Logged in successfully. |
| **6. Postconditions** | Notification data, including `is_read` variable. |
| **7. Main Flow** | Step 1: Query SQL with complex OR conditions (Target = ALL or Role matches, Dept matches, Email matches).<br>Step 2: Left JOIN `announcement_reads` to determine read status.<br>Step 3: Return JSON. |
| **8. Exception Flow** | None. |
| **9. Business Rules** | Display data sorted by sent date descending. |

### UC22: Mark as Read
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Mark as read |
| **2. Use Case ID** | UC_022 |
| **3. Actors** | All employees |
| **4. Brief Description** | Record user action of clicking to view a notification. |
| **5. Preconditions** | Notification is in unread status. |
| **6. Postconditions** | DB updated, badge count decreased. |
| **7. Main Flow** | Step 1: Click on notification.<br>Step 2: Insert into `announcement_reads` ON CONFLICT DO NOTHING.<br>Step 3: Write `READ` action log to MongoDB for high-speed tracking. |
| **8. Exception Flow** | None. |
| **9. Business Rules** | MongoDB logging ensures accurate tracking of when the user viewed the message. |

### UC23: View Sent History
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | View sent history |
| **2. Use Case ID** | UC_023 |
| **3. Actors** | Manager, Admin |
| **4. Brief Description** | Review announcements sent by oneself. |
| **5. Preconditions** | Role = Admin/Manager. |
| **6. Postconditions** | List of announcements. |
| **7. Main Flow** | Step 1: Get list of announcements filtered by `sender_id`.<br>Step 2: Return data for UI display. |
| **8. Exception Flow** | STAFF role calls API -> 403 Error. |
| **9. Business Rules** | Only management roles can view the broadcasting station. |

### UC24: Real-time UI Update
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Real-time UI update |
| **2. Use Case ID** | UC_024 |
| **3. Actors** | Client Browser (React) |
| **4. Brief Description** | Client listens to Socket stream to handle pop-up display. |
| **5. Preconditions** | Socket connected successfully. |
| **6. Postconditions** | UI updates automatically. |
| **7. Main Flow** | Step 1: Client listens to `new_announcement` or `leave_status_update` event.<br>Step 2: Use IF logic to check if target payload matches own role/dept.<br>Step 3: Trigger Toast pop-up and call getList API to refresh bell. |
| **8. Exception Flow** | Network loss -> Fallback to Polling. |
| **9. Business Rules** | Display routing calculations happen right at the frontend to reduce load. |

### UC25: Write Audit Log
| Item | Details |
| :--- | :--- |
| **1. Use Case Name** | Write system log (Polyglot) |
| **2. Use Case ID** | UC_025 |
| **3. Actors** | System (Background) |
| **4. Brief Description** | Immutable storage of actions like create/approve leave, finalize payroll, send notification. |
| **5. Preconditions** | API Controller executes business logic successfully. |
| **6. Postconditions** | Record created in MongoDB. |
| **7. Main Flow** | Step 1: Finish SQL execution.<br>Step 2: Call Mongoose `Model.create()` to push unstructured JSON to MongoDB.<br>Step 3: Return response to Client without waiting for MongoDB response (Async). |
| **8. Exception Flow** | MongoDB down -> Print to console.error (Main app doesn't crash). |
| **9. Business Rules** | Ensure Write-heavy performance doesn't bottleneck PostgreSQL. |