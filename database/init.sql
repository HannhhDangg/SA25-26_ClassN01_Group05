-- ==========================================
-- PHẦN 1: QUẢN LÝ TÀI KHOẢN & NGHỈ PHÉP
-- ==========================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, 
    full_name VARCHAR(100),
    email VARCHAR(100),
    phone_number VARCHAR(15),
    avatar_url VARCHAR(255),
    max_leave_days INT DEFAULT 12, 
    role VARCHAR(20) DEFAULT 'STAFF', 
    status VARCHAR(20) DEFAULT 'PENDING_ADMIN', 
    otp_code VARCHAR(6),
    otp_expires_at TIMESTAMP,
    manager_id INTEGER REFERENCES users(id), 
    base_salary DECIMAL(15, 2) DEFAULT 0, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    leave_type VARCHAR(20) DEFAULT 'ANNUAL', -- THÊM: 'ANNUAL' (Phép năm có lương), 'UNPAID' (Không lương), 'SICK' (Ốm)
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
    check_out_ip VARCHAR(50),       -- THÊM: Lưu IP lúc về
    check_out_location VARCHAR(255),-- THÊM: Lưu tọa độ lúc về
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

-- THÊM MỚI: Bảng người tham gia cuộc họp
CREATE TABLE IF NOT EXISTS meeting_attendees (
    meeting_id INT REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'DECLINED'
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
    total_working_days INT,     
    total_leave_days INT,       
    total_unpaid_leave_days INT DEFAULT 0, -- THÊM: Để trừ lương chính xác
    total_bonus DECIMAL(15, 2) DEFAULT 0,
    total_penalty DECIMAL(15, 2) DEFAULT 0,
    net_salary DECIMAL(15, 2) NOT NULL, 
    status VARCHAR(20) DEFAULT 'DRAFT', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, payroll_month, payroll_year)
);

-- ==========================================
-- TÀI KHOẢN MẶC ĐỊNH
-- ==========================================
INSERT INTO users (username, password, full_name, email, role, status, base_salary) 
VALUES (
    'superadmin', 
    '$2b$10$/bKah2RLip2uUFFAE1vOIO8Ase7DDuTEnHnogZwVz5RCXeJBGDjGC', 
    'Giám Đốc Hệ Thống', 
    'hnd10112005@gmail.com', 
    'SUPERADMIN', 
    'ACTIVE', 
    50000000
);