# TEST PLAN - HRM SYSTEM

## 1. Mục đích
Tài liệu này xác định chiến lược kiểm thử, phạm vi, các loại kiểm thử và nguồn lực cần thiết để đảm bảo chất lượng cho Hệ thống Quản lý Nhân sự (HRM System) dựa trên kiến trúc Microservices.

## 2. Phạm vi kiểm thử (Scope)
**Trong phạm vi (In-Scope):**
- **FR-01: Xác thực & Phân quyền (Auth Service):** Đăng nhập, đăng ký, xác thực OTP, phân quyền 3 cấp (Superadmin, Manager, Staff).
- **FR-02: Chấm công (Attendance Service):** Check-in/Check-out, tính toán đi muộn/về sớm, bảo mật thiết bị/Token.
- **FR-03: Nghỉ phép (Leave Service):** Tạo đơn nghỉ phép, quy trình duyệt đơn, cập nhật số dư phép năm.
- **FR-04: Lương thưởng (Salary Service):** Tính lương tự động dựa trên chấm công và nghỉ phép.
- **FR-05: Thông báo (Notification Service):** Gửi và nhận thông báo Real-time qua Socket.io.
- **Bảo mật & Hiệu năng:** Kiểm tra xác thực JWT, Rate-limiting của Kong API Gateway.

**Ngoài phạm vi (Out-of-Scope):**
- Tích hợp với hệ thống kế toán bên thứ ba ngoài hệ thống.
- Cấu hình hạ tầng phần cứng vật lý.

## 3. Bảng phân loại kiểm thử (Test Classification)

| Phân loại (Classification) | Mô tả | Mức độ ưu tiên | Môi trường |
| :--- | :--- | :---: | :--- |
| **Functional Testing** | Kiểm tra các chức năng nghiệp vụ (Happy path, Error, Boundary). | Cao (High) | Môi trường dev/test (Docker local) |
| **Integration Testing** | Kiểm tra giao tiếp giữa các Microservices (vd: Salary gọi Attendance). | Cao (High) | Môi trường test |
| **Security Testing** | Kiểm tra bảo mật (Xác thực JWT, tấn công giả mạo user_id, Rate-limiting). | Cao (High) | Môi trường test |
| **Performance Testing** | Kiểm tra giới hạn chịu tải của API (đặc biệt qua Kong Gateway). | Trung bình (Medium)| Môi trường test |
| **UI/UX Testing** | Kiểm tra tính tương thích, responsive trên trình duyệt. | Thấp (Low) | Trình duyệt Client |

## 4. Môi trường và Công cụ
- **Backend:** Node.js, Express, PostgreSQL, MongoDB, Redis, Socket.io
- **API Gateway:** Kong
- **Công cụ Test:** Postman/cURL (API Testing), Jest (Unit Test - Optional), K6/JMeter (Performance).
- **Môi trường:** Local Docker containers.

## 5. Tiêu chí chấp nhận (Acceptance Criteria)
- 100% các Test Case nghiệp vụ cốt lõi (Mức độ Cao) phải PASS.
- Không có lỗi nghiêm trọng (Critical/High defects) liên quan đến bảo mật (như fake user_id) hay tính sai lương.
- Tính năng Real-time hoạt động ổn định không bị mất kết nối.
