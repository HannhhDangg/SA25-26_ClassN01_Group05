# TEST RESULT SUMMARY (BÁO CÁO KẾT QUẢ KIỂM THỬ)

## 1. Tổng quan (Overview)
Báo cáo này tổng hợp kết quả của đợt kiểm thử tích hợp và kiểm thử chức năng cho hệ thống HRM System. Đợt kiểm thử tập trung vào 5 phân hệ chính: Auth, Attendance, Leave, Salary và Notification.

## 2. Số liệu thống kê (Pass/Fail Rate)

| Phân hệ (FR) | Tổng số Test Cases | PASS | FAIL | BLOCKED | Pass Rate |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **FR-01: Auth Service** | 8 | 8 | 0 | 0 | 100% |
| **FR-02: Attendance Service** | 7 | 7 | 0 | 0 | 100% |
| **FR-03: Leave Service** | 7 | 7 | 0 | 0 | 100% |
| **FR-04: Salary Service** | 7 | 7 | 0 | 0 | 100% |
| **FR-05: System & Notification**| 6 | 6 | 0 | 0 | 100% |
| **TỔNG CỘNG** | **35** | **35** | **0** | **0** | **100%** |

*Ghi chú: Lỗi hổng bảo mật giả mạo user_id trong Attendance Service đã được phát hiện ở giai đoạn Test và đã được vá triệt để bằng JWT Middleware trước khi chốt báo cáo này.*

## 3. Phân tích theo Loại Test (Test Type Analysis)
- **Happy Path (HP):** 16/16 PASS
- **Error (ERR):** 11/11 PASS
- **Boundary (BND):** 8/8 PASS

## 4. Kết quả Kiểm thử Hiệu năng & Bảo mật (Performance/Security Summary)

### 4.1. Security Testing (Bảo mật)
- **Xác thực API (JWT):** Đã kiểm tra tất cả các endpoint yêu cầu quyền truy cập. Hệ thống trả về `401 Unauthorized` nếu không có token hoặc token sai/hết hạn. Lấy dữ liệu định danh từ Payload của Token thay vì Client gửi lên.
- **Phân quyền (RBAC):** Đã kiểm thử ranh giới giữa STAFF, MANAGER và SUPERADMIN. Đảm bảo STAFF không thể gọi API duyệt đơn hay tính lương.
- **Chống Brute-force & DDoS:** Kong API Gateway đã kích hoạt plugin `rate-limiting`.
  - Auth Service: 100 req/min/IP.
  - Các service khác: 60 req/min/IP.
  - Vượt ngưỡng sẽ bị chặn và nhận HTTP 429.

### 4.2. Performance Testing (Hiệu năng)
- **Tải bình thường:** Hệ thống phản hồi các API cơ bản trong < 200ms.
- **Tải tính lương (Batch Processing):** API tính lương cho toàn công ty mất khoảng ~2-3 giây (Do cần Query chéo dữ liệu Attendance và Leave). Hệ thống Database PostgreSQL HA (Patroni) đáp ứng tốt lượng read/write lớn.
- **Tải Real-time:** Socket.io sử dụng Redis Adapter hoạt động mượt mà, thông báo push nổ popup gần như tức thì (< 50ms) sau khi có action (như duyệt đơn).

## 5. Kết luận
Hệ thống đạt tiêu chuẩn để đưa vào sử dụng thực tế (Production-ready). Các luồng nghiệp vụ hoạt động đúng như thiết kế, xử lý tốt các trường hợp lỗi (Error) và đường biên (Boundary). Bảo mật được gia cố chặt chẽ ở cấp độ Gateway (Kong) và Application (JWT Middleware).
