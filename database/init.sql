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
-- PHẦN 2: CHẤM CÔNG BẰNG GPS & BSSID/IP
-- ==========================================

CREATE TABLE IF NOT EXISTS office_locations (
    id SERIAL PRIMARY KEY,
    office_name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8),      
    longitude DECIMAL(11, 8),     
    allowed_radius INT DEFAULT 50, 
    allowed_bssid VARCHAR(50),    
    allowed_ip VARCHAR(50),       
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMP,
    check_in_ip VARCHAR(50),
    check_in_location VARCHAR(255), 
    check_out_time TIMESTAMP,
    check_out_ip VARCHAR(50),       
    check_out_location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ON_TIME', 
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
-- PHẦN 5: DỮ LIỆU KHỞI TẠO (SEED DATA)
-- ==========================================

-- 1. Tạo các Phòng Ban
INSERT INTO departments (name, description) VALUES 
('Giám Đốc', 'Quản lý điều hành chung toàn hệ thống'),
('Phòng IT', 'Phát triển phần mềm & Quản trị hệ thống mạng'),
('Phòng Hành Chính Nhân Sự', 'Quản trị nhân lực, chấm công & tiền lương');

-- 2. Tạo Tài khoản Superadmin mặc định (ID phòng: 1)
INSERT INTO users (username, password, full_name, email, role, status, base_salary, department_id) 
VALUES (
    'superadmin', 
    '$2b$10$/bKah2RLip2uUFFAE1vOIO8Ase7DDuTEnHnogZwVz5RCXeJBGDjGC', 
    'Giám Đốc Hệ Thống', 
    'hnd10112005@gmail.com', 
    'SUPERADMIN', 
    'ACTIVE', 
    50000000, 
    1
);

-- 3. Tạo Tài khoản Manager phòng Hành Chính Nhân Sự (ID phòng: 3)
INSERT INTO users (username, password, full_name, email, role, status, base_salary, department_id) 
VALUES (
    'manager_hcns', 
    crypt('23010243', gen_salt('bf', 10)), 
    'Trưởng Phòng Nhân Sự', 
    'managehcns@gmail.com', 
    'MANAGER', 
    'ACTIVE', 
    25000000, 
    3
);

-- 4. Tạo Tài khoản Manager phòng IT (ID phòng: 2)
INSERT INTO users (username, password, full_name, email, role, status, base_salary, department_id) 
VALUES (
    'manager_it', 
    crypt('23010243', gen_salt('bf', 10)), 
    'Trưởng Phòng IT', 
    'managerit@gmail.com', 
    'MANAGER', 
    'ACTIVE', 
    30000000, 
    2
);

-- 5. Tự động kết nối ID Trưởng phòng ngược lại vào bảng departments
UPDATE departments SET manager_id = (SELECT id FROM users WHERE username = 'manager_it') WHERE id = 2;
UPDATE departments SET manager_id = (SELECT id FROM users WHERE username = 'manager_hcns') WHERE id = 3;

-- 6. THÊM MỚI: 2 tài khoản nhân viên test (STAFF) - Mật khẩu: 12345678
-- Nhân viên 1: Thuộc phòng IT (department_id = 2)
INSERT INTO users (username, password, full_name, email, phone_number, role, status, base_salary, department_id)
VALUES (
    'hanknguyen',
    crypt('12345678', gen_salt('bf', 10)),
    'Hank Nguyễn',
    'hank@gmail.com',
    '09212821731',
    'STAFF',
    'ACTIVE',
    12000000,
    2
);

-- Nhân viên 2: Thuộc phòng HCNS (department_id = 3)
INSERT INTO users (username, password, full_name, email, phone_number, role, status, base_salary, department_id)
VALUES (
    'hanhnguyen',
    crypt('12345678', gen_salt('bf', 10)),
    'Hanh Nguyễn',
    'hanhnguyen@gmail.com',
    '0921715412',
    'STAFF',
    'ACTIVE',
    10000000,
    3
);