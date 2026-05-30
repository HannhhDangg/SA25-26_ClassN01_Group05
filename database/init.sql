-- Dọn dẹp sạch sẽ CSDL cũ để tạo lại từ đầu (Rất tiện khi dựng lại hệ thống)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 🔥 BẬT TÍNH NĂNG MÃ HÓA BCRYPT TRỰC TIẾP TRÊN POSTGRESQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================
-- PHẦN 1: QUẢN LÝ TÀI KHOẢN, PHÒNG BAN & NGHỈ PHÉP
-- ==========================================

-- 1. Tạo bảng Phòng ban trước
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    manager_id INT, -- Sẽ được set khóa ngoại sau khi có bảng users
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tạo bảng Users (Có liên kết với Phòng ban)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, 
    full_name VARCHAR(100),
    email VARCHAR(100),
    phone_number VARCHAR(15),
    avatar_url VARCHAR(255),
    department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    max_leave_days INT DEFAULT 12, 
    role VARCHAR(20) DEFAULT 'STAFF', 
    status VARCHAR(20) DEFAULT 'PENDING_ADMIN', 
    otp_code VARCHAR(6),
    otp_expires_at TIMESTAMP,
    manager_id INTEGER REFERENCES users(id), 
    base_salary DECIMAL(15, 2) DEFAULT 0, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Cập nhật khóa ngoại Trưởng phòng cho bảng departments
ALTER TABLE departments 
ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- 4. Bảng Đơn xin nghỉ phép
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    leave_type VARCHAR(20) DEFAULT 'ANNUAL', -- 'ANNUAL', 'UNPAID', 'SICK'
    reason TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INT, 
    status VARCHAR(20) DEFAULT 'PENDING', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP, 
    approver_id INT REFERENCES users(id),
    rejection_reason TEXT 
);

-- ==========================================
-- PHẦN 2: CHẤM CÔNG BẰNG MÃ OTP & DEVICE ID
-- ==========================================

CREATE TABLE IF NOT EXISTS attendance_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMP,
    check_in_device_id VARCHAR(255),
    check_out_time TIMESTAMP,     
    check_out_device_id VARCHAR(255),
    late_minutes INT DEFAULT 0, 
    early_leave_minutes INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Chưa Vào Làm', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, work_date) 
);

-- ==========================================
-- PHẦN 3: LỊCH TRÌNH, CA LÀM VIỆC & LỊCH HỌP
-- ==========================================

CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    shift_name VARCHAR(50) NOT NULL, 
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    min_employees INT DEFAULT 3, 
    max_employees INT DEFAULT 5  
);

CREATE TABLE IF NOT EXISTS user_schedules (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    shift_id INT REFERENCES shifts(id),
    work_date DATE NOT NULL,
    UNIQUE(user_id, work_date, shift_id)
);

CREATE TABLE IF NOT EXISTS meetings (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    organizer_id INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meeting_attendees (
    meeting_id INT REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING', 
    PRIMARY KEY (meeting_id, user_id)
);

-- ==========================================
-- PHẦN 4: TÍNH LƯƠNG & THƯỞNG PHẠT
-- ==========================================

CREATE TABLE IF NOT EXISTS bonuses_penalties (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL, 
    amount DECIMAL(15, 2) NOT NULL,
    reason TEXT,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by INT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS monthly_payrolls (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    payroll_month INT NOT NULL, 
    payroll_year INT NOT NULL,  
    base_salary DECIMAL(15, 2), 
    standard_work_days INT NOT NULL, 
    total_working_days INT,     
    total_leave_days INT,        
    total_unpaid_leave_days INT DEFAULT 0,
    total_late_days INT DEFAULT 0,   
    total_unexcused_days INT DEFAULT 0,
    total_bonus DECIMAL(15, 2) DEFAULT 0,
    total_penalty DECIMAL(15, 2) DEFAULT 0, 
    net_salary DECIMAL(15, 2) NOT NULL, 
    status VARCHAR(20) DEFAULT 'DRAFT', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, payroll_month, payroll_year)
);

-- ==========================================
-- PHẦN THÊM: QUẢN LÝ THÔNG BÁO CHUNG (ANNOUNCEMENTS)
-- ==========================================

-- Bảng lưu nội dung các thông báo được phát đi
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    sender_id INT REFERENCES users(id) ON DELETE SET NULL, -- Người gửi
    target_type VARCHAR(20) NOT NULL, -- Các loại: 'ALL', 'ROLE', 'DEPT_STAFF', 'INDIVIDUAL'
    target_role VARCHAR(20),          -- Dành cho trường hợp target_type = 'ROLE' (VD: 'MANAGER')
    department_id INT REFERENCES departments(id) ON DELETE CASCADE, -- Dành cho target_type = 'DEPT_STAFF'
    target_email VARCHAR(100),        -- Dành cho target_type = 'INDIVIDUAL'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng lưu trạng thái "Đã đọc" của từng nhân viên đối với từng thông báo
CREATE TABLE IF NOT EXISTS announcement_reads (
    announcement_id INT REFERENCES announcements(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (announcement_id, user_id) -- Một người chỉ có 1 trạng thái đọc cho 1 thông báo
);

-- ==========================================
-- PHẦN THÊM: QUẢN LÝ CẤU HÌNH HỆ THỐNG (SETTINGS)
-- ==========================================
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (key, value) VALUES 
('attendance', '{"checkInTime": "08:30", "checkOutTime": "17:00", "gracePeriod": 10, "validIPs": ""}'),
('leaves', '{"defaultLeaveDays": 12, "holidays": "01-01: Tết Dương Lịch\n04-30: Giải Phóng Miền Nam\n05-01: Quốc Tế Lao Động\n09-02: Quốc Khánh\n2026-02-16: Nghỉ Tết Âm Lịch\n2026-02-17: Nghỉ Tết Âm Lịch\n2026-02-18: Nghỉ Tết Âm Lịch\n2026-02-19: Nghỉ Tết Âm Lịch\n2026-02-20: Nghỉ Tết Âm Lịch"}'),
('payroll', '{"latePenalty": 50000, "unexcusedPenalty": 100000, "otMultiplier": 1.5}'),
('general', '{"companyName": "HRM System", "logoUrl": "", "smtpHost": "smtp.gmail.com", "smtpPort": 587, "smtpUser": "hr@company.com"}')
ON CONFLICT (key) DO NOTHING;

-- ==========================================
-- PHẦN 5: DỮ LIỆU KHỞI TẠO (SEED DATA)
-- ==========================================

-- 1. Tạo các Phòng Ban
INSERT INTO departments (name, description) VALUES 
('Giám Đốc', 'Quản lý điều hành chung toàn hệ thống'),
('Phòng IT', 'Phát triển phần mềm & Quản trị hệ thống mạng'),
('Phòng Hành Chính Nhân Sự', 'Quản trị nhân lực, chấm công & tiền lương');

-- 2. Tạo Tài khoản Superadmin mặc định (ID phòng: 1)
INSERT INTO users (username, password, full_name, email, role, status, base_salary, department_id, created_at) 
VALUES (
    'superadmin', 
    '$2b$10$/bKah2RLip2uUFFAE1vOIO8Ase7DDuTEnHnogZwVz5RCXeJBGDjGC', 
    'Giám Đốc Hệ Thống', 
    'hnd10112005@gmail.com', 
    'SUPERADMIN', 
    'ACTIVE', 
    50000000, 
    1,
    '2026-01-01 00:00:00'
);

-- 3. Tạo Tài khoản Manager phòng Hành Chính Nhân Sự (ID phòng: 3)
INSERT INTO users (username, password, full_name, email, role, status, base_salary, department_id, created_at) 
VALUES (
    'manager_hcns', 
    crypt('23010243', gen_salt('bf', 10)), 
    'Trưởng Phòng Nhân Sự', 
    'managehcns@gmail.com', 
    'MANAGER', 
    'ACTIVE', 
    25000000, 
    3,
    '2026-01-01 00:00:00'
);

-- 4. Tạo Tài khoản Manager phòng IT (ID phòng: 2)
INSERT INTO users (username, password, full_name, email, role, status, base_salary, department_id, created_at) 
VALUES (
    'manager_it', 
    crypt('23010243', gen_salt('bf', 10)), 
    'Trưởng Phòng IT', 
    'managerit@gmail.com', 
    'MANAGER', 
    'ACTIVE', 
    30000000, 
    2,
    '2026-01-01 00:00:00'
);

-- 5. Tự động kết nối ID Trưởng phòng ngược lại vào bảng departments
UPDATE departments SET manager_id = (SELECT id FROM users WHERE username = 'manager_it') WHERE id = 2;
UPDATE departments SET manager_id = (SELECT id FROM users WHERE username = 'manager_hcns') WHERE id = 3;

-- 6. THÊM MỚI: 2 tài khoản nhân viên test (STAFF) - Mật khẩu: 12345678
-- Nhân viên 1: Thuộc phòng IT (department_id = 2)
INSERT INTO users (username, password, full_name, email, phone_number, role, status, base_salary, department_id, created_at)
VALUES (
    'hanknguyen',
    crypt('12345678', gen_salt('bf', 10)),
    'Hank Nguyễn',
    'hank@gmail.com',
    '09212821731',
    'STAFF',
    'ACTIVE',
    12000000,
    2,
    '2026-01-01 00:00:00'
);

-- Nhân viên 2: Thuộc phòng HCNS (department_id = 3)
INSERT INTO users (username, password, full_name, email, phone_number, role, status, base_salary, department_id, created_at)
VALUES (
    'hanhnguyen',
    crypt('12345678', gen_salt('bf', 10)),
    'Hanh Nguyễn',
    'hanhnguyen@gmail.com',
    '0921715412',
    'STAFF',
    'ACTIVE',
    10000000,
    3,
    '2026-01-01 00:00:00'
);

-- 7. THÊM MỚI: Dữ liệu Đơn nghỉ phép mẫu (Seed data)
INSERT INTO leave_requests (user_id, leave_type, reason, start_date, end_date, total_days, status, approver_id) VALUES
-- Đơn đã duyệt (Trong 14 ngày qua)
(4, 'SICK', 'Bị sốt siêu vi, xin nghỉ ở nhà điều trị', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE - INTERVAL '12 days', 1, 'APPROVED', 3),
(5, 'ANNUAL', 'Về quê có việc gia đình', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '9 days', 2, 'APPROVED', 2),
-- Đơn chờ duyệt (Để hiển thị ở phần duyệt đơn)
(4, 'ANNUAL', 'Xin nghỉ đi khám bệnh tổng quát', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days', 1, 'PENDING', NULL),
(5, 'UNPAID', 'Nhà có việc đột xuất', CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '3 days', 1, 'PENDING', NULL);

-- 8. THÊM MỚI: Dữ liệu Chấm công mẫu (Seed data)
INSERT INTO attendance_logs (user_id, work_date, check_in_time, check_out_time, status) VALUES
-- Nhân viên Hank Nguyễn (ID: 4)
(4, CURRENT_DATE - INTERVAL '8 days', NULL, NULL, 'Không phép'),
(4, CURRENT_DATE - INTERVAL '5 days', (CURRENT_DATE - INTERVAL '5 days') + TIME '08:15:00', (CURRENT_DATE - INTERVAL '5 days') + TIME '17:00:00', 'Đi Muộn'),
(4, CURRENT_DATE - INTERVAL '2 days', NULL, NULL, 'Vắng mặt'),

-- Nhân viên Hanh Nguyễn (ID: 5)
(5, CURRENT_DATE - INTERVAL '7 days', NULL, NULL, 'Không phép'),
(5, CURRENT_DATE - INTERVAL '4 days', (CURRENT_DATE - INTERVAL '4 days') + TIME '08:00:00', (CURRENT_DATE - INTERVAL '4 days') + TIME '17:00:00', 'Tan Làm'),
(5, CURRENT_DATE - INTERVAL '3 days', NULL, NULL, 'Vắng mặt');

-- 9. THÊM MỚI: Tự động seed dữ liệu đi làm đầy đủ, đúng giờ cho toàn bộ nhân viên
-- Từ 01/01/2026 đến ngày hiện tại. Bỏ qua Chủ Nhật và các ngày Lễ/Tết. Các dữ liệu seed thủ công ở trên (đi muộn, vắng mặt) sẽ KHÔNG bị ghi đè nhờ (ON CONFLICT DO NOTHING)
INSERT INTO attendance_logs (user_id, work_date, check_in_time, check_out_time, status)
SELECT 
    u.id, 
    d.work_date::DATE, 
    d.work_date + TIME '08:00:00', 
    d.work_date + TIME '17:00:00', 
    'Tan Làm'
FROM users u
CROSS JOIN generate_series('2026-01-01'::DATE, CURRENT_DATE, '1 day'::interval) AS d(work_date)
WHERE EXTRACT(DOW FROM d.work_date) != 0 -- Bỏ Chủ Nhật
  AND TO_CHAR(d.work_date, 'MM-DD') NOT IN ('01-01', '04-26', '04-30', '05-01', '09-02') -- Bỏ Lễ cố định
  AND d.work_date::DATE NOT BETWEEN '2026-02-16'::DATE AND '2026-02-20'::DATE -- Bỏ Tết Nguyên Đán Bính Ngọ 2026
ON CONFLICT (user_id, work_date) DO NOTHING;

-- 10. THÊM MỚI: Tự động TÍNH LƯƠNG cho các tháng đã qua để đảm bảo dữ liệu nhất quán
-- Logic này mô phỏng lại logic trong payroll.js, giả định các tháng đã qua đã được trả lương (status: PAID)

-- Bước 1: Tạo một CTE để định nghĩa các tháng trong quá khứ cần tính lương
WITH past_months AS (
    SELECT 
        EXTRACT(YEAR FROM month_series)::int AS payroll_year,
        EXTRACT(MONTH FROM month_series)::int AS payroll_month
    FROM generate_series(
        '2026-01-01'::date, 
        date_trunc('month', CURRENT_DATE) - interval '1 month', -- Chỉ tính đến tháng trước tháng hiện tại
        '1 month'::interval
    ) AS month_series
),

-- Bước 2: Tính ngày công chuẩn cho mỗi tháng trong quá khứ (Trừ Chủ Nhật và Ngày Lễ)
standard_days_per_month AS (
    SELECT
        p.payroll_year,
        p.payroll_month,
        COUNT(d.day)::int as standard_work_days
    FROM past_months p
    CROSS JOIN LATERAL generate_series(
        make_date(p.payroll_year, p.payroll_month, 1),
        (make_date(p.payroll_year, p.payroll_month, 1) + interval '1 month - 1 day')::date,
        '1 day'::interval
    ) AS d(day)
    WHERE EXTRACT(DOW FROM d.day) != 0 -- Bỏ Chủ Nhật
      AND TO_CHAR(d.day, 'MM-DD') NOT IN ('01-01', '04-26', '04-30', '05-01', '09-02')
      AND d.day::DATE NOT BETWEEN '2026-02-16'::DATE AND '2026-02-20'::DATE
    GROUP BY p.payroll_year, p.payroll_month
),

-- Bước 3: Tổng hợp dữ liệu chấm công cho từng user, từng tháng
payroll_data AS (
    SELECT
        u.id as user_id, pm.payroll_year, pm.payroll_month, u.base_salary,
        COALESCE(s.standard_work_days, 24) as standard_work_days,
        COALESCE(COUNT(al.id) FILTER (WHERE al.status IN ('Tan Làm', 'Đi Muộn', 'Về sớm')), 0)::int AS total_working_days,
        COALESCE(COUNT(al.id) FILTER (WHERE al.status IN ('Đi Muộn', 'Về sớm')), 0)::int AS total_late_days,
        COALESCE(COUNT(al.id) FILTER (WHERE al.status IN ('Không phép', 'Vắng mặt')), 0)::int AS total_unexcused_days
    FROM past_months pm
    CROSS JOIN users u
    LEFT JOIN standard_days_per_month s ON s.payroll_year = pm.payroll_year AND s.payroll_month = pm.payroll_month
    LEFT JOIN attendance_logs al ON al.user_id = u.id AND EXTRACT(YEAR FROM al.work_date) = pm.payroll_year AND EXTRACT(MONTH FROM al.work_date) = pm.payroll_month
    WHERE u.status = 'ACTIVE' AND u.created_at < make_date(pm.payroll_year, pm.payroll_month, 1) + interval '1 month'
    GROUP BY u.id, pm.payroll_year, pm.payroll_month, u.base_salary, s.standard_work_days
)

-- Bước 4: Tính toán lương và INSERT vào bảng monthly_payrolls
INSERT INTO monthly_payrolls (user_id, payroll_month, payroll_year, base_salary, standard_work_days, total_working_days, total_leave_days, total_unpaid_leave_days, total_late_days, total_unexcused_days, total_bonus, total_penalty, net_salary, status)
SELECT
    pd.user_id, pd.payroll_month, pd.payroll_year, pd.base_salary, pd.standard_work_days, pd.total_working_days,
    0, 0, pd.total_late_days, pd.total_unexcused_days, 0, (pd.total_late_days * 50000) + (pd.total_unexcused_days * 100000),
    GREATEST(0, CASE WHEN pd.standard_work_days > 0 THEN (pd.base_salary / pd.standard_work_days) * pd.total_working_days ELSE 0 END - ((pd.total_late_days * 50000) + (pd.total_unexcused_days * 100000)))::decimal(15,2),
    'PAID'
FROM payroll_data pd
ON CONFLICT (user_id, payroll_month, payroll_year) DO NOTHING;