-- ==========================================
-- PHẦN 1: QUẢN LÝ TÀI KHOẢN & NGHỈ PHÉP (Dữ liệu cốt lõi)
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
    manager_id INTEGER REFERENCES users(id), -- ID của người quản lý trực tiếp
    base_salary DECIMAL(15, 2) DEFAULT 0, -- Lương cơ bản phục vụ tính lương sau này
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
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

-- Lưu trữ tọa độ văn phòng và thông tin mạng nội bộ
CREATE TABLE IF NOT EXISTS office_locations (
    id SERIAL PRIMARY KEY,
    office_name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8),      -- Vĩ độ
    longitude DECIMAL(11, 8),     -- Kinh độ
    allowed_radius INT DEFAULT 50, -- Bán kính cho phép (mét)
    allowed_bssid VARCHAR(50),    -- Địa chỉ MAC Wifi
    allowed_ip VARCHAR(50),       -- IP mạng nội bộ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ghi nhận lịch sử vào/ra
CREATE TABLE IF NOT EXISTS attendance_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    check_in_ip VARCHAR(50),
    check_in_location VARCHAR(255), -- Lưu "lat,long" để đối soát
    status VARCHAR(20) DEFAULT 'ON_TIME', -- 'ON_TIME', 'LATE', 'ABSENT'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, work_date) -- Đảm bảo 1 người chỉ có 1 record mỗi ngày
);

-- ==========================================
-- PHẦN 3: LỊCH TRÌNH, CA LÀM VIỆC & LỊCH HỌP
-- ==========================================

-- Cấu hình ca làm việc (để backend check ràng buộc 3-5 người)
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    shift_name VARCHAR(50) NOT NULL, -- VD: Ca Sáng, Ca Chiều
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    min_employees INT DEFAULT 3, -- Tối thiểu 3 nhân viên
    max_employees INT DEFAULT 5  -- Tối đa 5 nhân viên
);

-- Phân ca làm việc cho nhân viên theo ngày (Thứ 2 - Thứ 6)
CREATE TABLE IF NOT EXISTS user_schedules (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    shift_id INT REFERENCES shifts(id),
    work_date DATE NOT NULL,
    UNIQUE(user_id, work_date, shift_id)
);

-- Quản lý lịch họp
CREATE TABLE IF NOT EXISTS meetings (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    organizer_id INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- PHẦN 4: TÍNH LƯƠNG & THƯỞNG PHẠT
-- ==========================================

-- Ghi nhận các khoản thưởng/phạt phát sinh trong tháng
CREATE TABLE IF NOT EXISTS bonuses_penalties (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL, -- 'BONUS' hoặc 'PENALTY'
    amount DECIMAL(15, 2) NOT NULL,
    reason TEXT,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by INT REFERENCES users(id)
);

-- Tổng hợp lương tháng
CREATE TABLE IF NOT EXISTS monthly_payrolls (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    payroll_month INT NOT NULL, -- Tháng (1-12)
    payroll_year INT NOT NULL,  -- Năm
    base_salary DECIMAL(15, 2), -- Lương cơ bản lúc tính
    total_working_days INT,     -- Số ngày đi làm thực tế
    total_leave_days INT,       -- Số ngày nghỉ (có phép/không phép)
    total_bonus DECIMAL(15, 2) DEFAULT 0,
    total_penalty DECIMAL(15, 2) DEFAULT 0,
    net_salary DECIMAL(15, 2) NOT NULL, -- Lương thực nhận (Công thức tính sẽ nằm ở Backend)
    status VARCHAR(20) DEFAULT 'DRAFT', -- 'DRAFT', 'PAID'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, payroll_month, payroll_year)
);

-- Tai khoan admin mac dinh (sau khi chay init.sql, nhớ update password bang hash cua ban vao day)
INSERT INTO users (username, password, full_name, email, role, status, base_salary) 
VALUES (
    'superadmin', 
    '$2b$10$/bKah2RLip2uUFFAE1vOIO8Ase7DDuTEnHnogZwVz5RCXeJBGDjGC', -- Hash của "admin123"
    'Giám Đốc Hệ Thống', 
    'hnd10112005@gmail.com', 
    'SUPERADMIN', 
    'ACTIVE', 
    50000000
);