# DANH SÁCH TEST CASES (TEST_CASES.md)

## Phân loại loại Test (Type):
- **HP**: Happy Path (Luồng chuẩn)
- **ERR**: Error (Luồng lỗi/Bảo mật)
- **BND**: Boundary (Biên/Giới hạn)

---

### FR-01: Xác thực & Phân quyền (Auth Service)

| Test Case ID | FR-XX | Type | Tên Test Case | Điều kiện tiền quyết (Precondition) | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-AUTH-01 | FR-01 | HP | Đăng nhập thành công với tài khoản hợp lệ | User có tài khoản ACTIVE | Nhập đúng username và password -> Click Đăng nhập | Trả về thông báo thành công và Token JWT | PASS |
| TC-AUTH-02 | FR-01 | ERR | Đăng nhập sai mật khẩu | User tồn tại | Nhập đúng username, sai password -> Click Đăng nhập | Báo lỗi "Sai tên đăng nhập hoặc mật khẩu", không cấp Token | PASS |
| TC-AUTH-03 | FR-01 | ERR | Đăng nhập với tài khoản chưa kích hoạt | User ở trạng thái PENDING_ADMIN | Nhập username và password đúng -> Click Đăng nhập | Báo lỗi "Tài khoản chưa được kích hoạt" | PASS |
| TC-AUTH-04 | FR-01 | BND | Đăng ký tài khoản với mật khẩu 7 ký tự | Hệ thống yêu cầu MK > 8 | Điền form đăng ký, set password = "1234567" | Form báo lỗi độ dài mật khẩu tối thiểu 8 ký tự | PASS |
| TC-AUTH-05 | FR-01 | HP | Đăng ký tài khoản thành công | Chưa có tài khoản | Điền form hợp lệ -> Gửi OTP -> Nhập đúng OTP 6 số | Đăng ký thành công, trạng thái PENDING_ADMIN | PASS |
| TC-AUTH-06 | FR-01 | ERR | Xác thực OTP sai | Đã yêu cầu OTP | Nhập OTP sai 6 số | Báo lỗi "Mã OTP không chính xác" | PASS |
| TC-AUTH-07 | FR-01 | BND | Xác thực OTP quá hạn | Đã gửi OTP cách đây > 5 phút | Nhập đúng mã OTP nhưng sau 5 phút | Báo lỗi "Mã OTP đã hết hạn" | PASS |
| TC-AUTH-08 | FR-01 | ERR | Truy cập API Admin bằng tài khoản Staff | Đăng nhập với quyền STAFF | Gọi API dành riêng cho SUPERADMIN (vd: duyệt user) | Trả về lỗi 403 Forbidden | PASS |

---

### FR-02: Chấm công (Attendance Service)

| Test Case ID | FR-XX | Type | Tên Test Case | Điều kiện tiền quyết (Precondition) | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-ATT-01 | FR-02 | HP | Chấm công Check-in thành công | User có Token hợp lệ, chưa check-in hôm nay | Gọi API `/verify-code` loại check-in kèm JWT | Ghi nhận thời gian Check-in, trạng thái "Đang làm" | PASS |
| TC-ATT-02 | FR-02 | ERR | Chấm công không có JWT Token | Bỏ Authorization Header | Gọi API `/verify-code` loại check-in | Báo lỗi 401 "Từ chối truy cập!" | PASS |
| TC-ATT-03 | FR-02 | ERR | Chấm công giả mạo user_id (Security) | User A có Token | Gọi API `/verify-code` kèm Token của A nhưng body truyền `user_id` của B | Hệ thống bỏ qua `user_id` trong body, chỉ ghi nhận cho User A | PASS |
| TC-ATT-04 | FR-02 | HP | Chấm công Check-out thành công | User đã check-in | Gọi API `/verify-code` loại check-out kèm JWT | Cập nhật thời gian Check-out, trạng thái "Tan làm" | PASS |
| TC-ATT-05 | FR-02 | BND | Check-in đúng giờ biên (08:30:00) | Giờ chuẩn là 08:30 | Gọi API Check-in đúng 08:30:00 | Ghi nhận late_minutes = 0 | PASS |
| TC-ATT-06 | FR-02 | BND | Check-in trễ (08:31:00) | Giờ chuẩn là 08:30 | Gọi API Check-in lúc 08:31:00 | Ghi nhận late_minutes > 0 | PASS |
| TC-ATT-07 | FR-02 | HP | Chấm công lại đè lên giờ cũ | User đã check-in trước đó | Gọi lại API check-in | Cập nhật `check_in_time` mới dựa vào ON CONFLICT | PASS |

---

### FR-03: Nghỉ phép (Leave Service)

| Test Case ID | FR-XX | Type | Tên Test Case | Điều kiện tiền quyết (Precondition) | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-LEV-01 | FR-03 | HP | Staff tạo đơn nghỉ phép thành công | Đăng nhập tài khoản STAFF | Điền lý do, ngày bắt đầu, ngày kết thúc -> Submit | Lưu đơn trạng thái PENDING, bắn Socket báo Manager | PASS |
| TC-LEV-02 | FR-03 | BND | Xin nghỉ nhiều hơn số phép dư | Dư 2 ngày phép | Tạo đơn nghỉ 3 ngày (Leave type: ANNUAL) | Hệ thống cảnh báo/chặn không cho tạo đơn ANNUAL (hoặc chuyển thành UNPAID) | PASS |
| TC-LEV-03 | FR-03 | ERR | Ngày kết thúc nhỏ hơn ngày bắt đầu | | Tạo đơn: Start = 15/06, End = 10/06 | Báo lỗi logic ngày tháng | PASS |
| TC-LEV-04 | FR-03 | HP | Manager duyệt đơn thành công | Đăng nhập MANAGER, có đơn PENDING | Chọn duyệt đơn của STAFF | Đơn chuyển APPROVED, trừ quỹ phép của STAFF, bắn Socket cho STAFF | PASS |
| TC-LEV-05 | FR-03 | HP | Manager từ chối đơn | Đăng nhập MANAGER, có đơn PENDING | Nhập lý do từ chối -> Reject | Đơn chuyển REJECTED, quỹ phép không đổi | PASS |
| TC-LEV-06 | FR-03 | ERR | Staff duyệt đơn của chính mình | Đăng nhập STAFF | Gọi API duyệt đơn nghỉ phép của mình | Báo lỗi 403 Forbidden | PASS |
| TC-LEV-07 | FR-03 | BND | Xin nghỉ phép vào ngày nghỉ (T7, CN) | | Chọn ngày nghỉ là Thứ 7, CN | Hệ thống tự động bỏ qua T7, CN khi tính tổng số ngày xin nghỉ | PASS |

---

### FR-04: Lương thưởng (Salary Service)

| Test Case ID | FR-XX | Type | Tên Test Case | Điều kiện tiền quyết (Precondition) | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-SAL-01 | FR-04 | HP | Tính lương một nhân viên đi làm đủ | Tháng chốt công đã qua | Gọi API tính lương | Tính ra chuẩn `net_salary` = `base_salary`, không phạt | PASS |
| TC-SAL-02 | FR-04 | HP | Tính lương nhân viên đi trễ | Có record đi trễ trong `attendance_logs` | Gọi API tính lương | Tính lương trừ khoản phạt đi trễ (Late Penalty) | PASS |
| TC-SAL-03 | FR-04 | HP | Tính lương nhân viên có nghỉ phép có lương | Có `APPROVED` leave `ANNUAL` | Gọi API tính lương | Ngày nghỉ vẫn được tính là working days, không trừ lương | PASS |
| TC-SAL-04 | FR-04 | HP | Tính lương nhân viên nghỉ không lương | Có `APPROVED` leave `UNPAID` | Gọi API tính lương | Bị trừ lương theo số ngày Unpaid Leave | PASS |
| TC-SAL-05 | FR-04 | BND | Lương bị trừ âm do phạt quá nhiều | Tiền phạt > Lương cơ bản | Tính lương cho nhân viên | `net_salary` không được < 0 (Trả về 0) | PASS |
| TC-SAL-06 | FR-04 | ERR | Tính lương tháng tương lai | Tháng chưa kết thúc | Truyền tham số tháng là tương lai | Báo lỗi không cho phép tính lương tháng tương lai | PASS |
| TC-SAL-07 | FR-04 | HP | Xem Phiếu lương (Payslip) | Đã có lương DRAFT/PAID | User xem lịch sử lương của mình | Hiển thị đầy đủ thông tin: Lương CB, Ngày công, Thưởng, Phạt, Thực nhận | PASS |

---

### FR-05: Thông báo & Hệ thống (Notification & System)

| Test Case ID | FR-XX | Type | Tên Test Case | Điều kiện tiền quyết (Precondition) | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-SYS-01 | FR-05 | HP | Gửi thông báo toàn hệ thống | Đăng nhập Admin | Đăng thông báo loại "ALL" | Mọi User đang online nhận được Socket popup | PASS |
| TC-SYS-02 | FR-05 | HP | Đếm chuông thông báo (Badge) | Có thông báo chưa đọc | Xem góc phải màn hình | Icon chuông đỏ tăng số lượng tương ứng | PASS |
| TC-SYS-03 | FR-05 | ERR | Rate Limiting Kong Gateway (DDoS test) | | Bắn > 100 requests / 1 phút vào API Auth | Kong trả về 429 Too Many Requests | PASS |
| TC-SYS-04 | FR-05 | BND | Token hết hạn (1 ngày) | Đã login cách đây > 24h | Gọi API bất kỳ yêu cầu auth | Báo lỗi 401 "Token expired" | PASS |
| TC-SYS-05 | FR-05 | HP | Tự động cập nhật DB Health check | Services đang chạy | Gọi API `/health/ready` | Trả về status UP, db UP, redis UP | PASS |
| TC-SYS-06 | FR-05 | ERR | Redis mất kết nối (Fall-back) | Tắt Redis container | Chạy API hệ thống | Socketio cảnh báo, nhưng API HTTP cơ bản vẫn hoạt động bình thường | PASS |

---

### Khả năng sẵn sàng & Phục hồi (Availability Test)

| Test Case ID | FR-XX | Type | Tên Test Case | Điều kiện tiền quyết (Precondition) | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-AVAIL-01 | N/A | ERR | Tự động phục hồi khi Service crash | Hệ thống đang hoạt động bình thường | Kill process của service (vd: `attendance_service`) | Docker Compose tự động restart container, API phục hồi trong <10s | PASS |
| TC-AVAIL-02 | N/A | ERR | Database Failover/Re-connect | Các service đang kết nối DB | Stop Postgres/MongoDB container vài giây rồi start lại | Các service tự động reconnect thành công, không cần khởi động lại Node.js | PASS |
| TC-AVAIL-03 | N/A | BND | Chịu tải cao đột ngột (Spike) | Hệ thống chạy bình thường | Gửi 500 requests đồng thời trong 1 giây vào API Check-in | API có thể phản hồi chậm nhưng không sập, Kong Gateway điều phối ổn định (Rate limit) | PASS |

