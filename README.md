# 🏢 HỆ THỐNG QUẢN LÝ NHÂN SỰ HIỆN ĐẠI (HRM SYSTEM)

Một giải pháp Quản lý Nhân sự toàn diện được xây dựng trên nền tảng kiến trúc **Microservices** tiên tiến. Hệ thống tập trung vào việc tự động hóa quy trình nhân sự, xử lý bất đồng bộ, tính toán lương thưởng tự động và khả năng tương tác thời gian thực (Real-time).

---

## 📖 1. Lời nói đầu / Lý do chọn đề tài

Trong kỷ nguyên chuyển đổi số, việc quản lý nhân sự theo cách truyền thống (sử dụng giấy tờ, Excel, hay các công cụ rời rạc) đang bộc lộ nhiều điểm yếu chí mạng:
- **Thiếu minh bạch & dễ sai sót:** Chấm công và tính lương thủ công dễ dẫn đến sai lệch dữ liệu, gây bức xúc cho người lao động.
- **Quy trình chậm chạp:** Việc xin nghỉ phép, duyệt đơn phải qua nhiều khâu giấy tờ, tốn thời gian của cả nhân viên lẫn cấp quản lý.
- **Rủi ro dữ liệu:** Hệ thống nguyên khối (Monolith) cũ thường xuyên quá tải vào những ngày chốt công cuối tháng.

**HRM System** ra đời nhằm giải quyết triệt để các vấn đề trên. Bằng việc áp dụng kiến trúc **Microservices**, hệ thống không chỉ giải quyết bài toán nghiệp vụ mà còn đảm bảo khả năng mở rộng (Scale) vô hạn, tính sẵn sàng cao (High Availability) và trải nghiệm người dùng mượt mà nhất.

## 🎯 2. Mục tiêu dự án

1. **Số hóa toàn diện:** Đưa 100% quy trình từ Onboarding (đăng ký, duyệt tài khoản), Chấm công, Xin nghỉ phép đến Tính lương lên nền tảng số.
2. **Tự động hóa:** Hệ thống tự động đối soát lịch sử chấm công và đơn nghỉ phép để tính ra bảng lương cuối cùng (bao gồm thưởng, phạt đi muộn, vắng mặt).
3. **Real-time Interaction:** Loại bỏ độ trễ thông tin. Quản lý nhận được đơn xin phép ngay lập tức, nhân viên nhận được kết quả duyệt đơn và thông báo công ty theo thời gian thực.
4. **Kiến trúc bền vững:** Xây dựng mô hình Microservices đằng sau API Gateway để dễ dàng bảo trì, nâng cấp từng module độc lập mà không ảnh hưởng toàn hệ thống.

---

## 🛠 3. Công nghệ & Công cụ sử dụng

Dự án tuân thủ triết lý **Polyglot Persistence** (Sử dụng nhiều loại cơ sở dữ liệu phù hợp với từng ngữ cảnh) và hệ sinh thái hiện đại:

### Giao diện (Frontend)
- **React.js (Vite):** Tạo Single Page Application (SPA) tốc độ cao.
- **Tailwind CSS:** Thiết kế giao diện (UI) hiện đại, responsive.
- **Socket.io-client:** Kết nối WebSockets nhận dữ liệu thời gian thực.
- **React-Toastify:** Hiển thị thông báo (Popup) thân thiện.

### Máy chủ & Dịch vụ (Backend - Microservices)
- **Node.js & Express:** Xây dựng các dịch vụ độc lập (Auth, Leave, Attendance, Noti, Salary).
- **Bcrypt & JWT:** Mã hóa mật khẩu bảo mật và xác thực không trạng thái (Stateless Authentication).
- **Nodemailer:** Gửi email tự động (OTP mã xác thực).

### Cơ sở dữ liệu (Databases)
- **PostgreSQL:** Lưu trữ dữ liệu có cấu trúc, quan hệ chặt chẽ (Users, Departments, Payroll, Attendance logs) đảm bảo tính ACID.
- **MongoDB:** Lưu trữ Log hệ thống (Audit Trail) cho các thao tác nhạy cảm (Duyệt đơn, Đổi cấu hình, Tính lương) nhờ tốc độ ghi cực nhanh.
- **Redis:** 
  - Lưu trữ Cache OTP (Tự động xóa sau 5 phút).
  - Làm Message Broker (Pub/Sub) cho Socket.io để đồng bộ event giữa các Microservices.

### Hạ tầng & DevOps
- **Kong API Gateway:** Đóng vai trò là cửa ngõ duy nhất (Entry point), xử lý Rate-Limiting (chống DDoS), định tuyến (Routing) request đến các dịch vụ bên dưới.
- **Docker & Docker Compose:** Container hóa toàn bộ ứng dụng, dễ dàng deploy và đồng bộ môi trường.

---

## 🌟 4. Phân hệ chức năng tổng quan

Hệ thống được thiết kế theo mô hình phân quyền 3 cấp bám sát cấu trúc doanh nghiệp thực tế: **Giám Đốc (Superadmin) > Trưởng phòng (Manager) > Nhân viên (Staff)**.

### 🔑 Dịch vụ Xác thực & Quản trị (Auth Service)
- **Xác thực 2 lớp (OTP):** Đăng ký tài khoản yêu cầu xác nhận qua Email.
- **Kiểm duyệt tự động:** Tài khoản mới phải được Admin kích hoạt mới có hiệu lực.
- **Cấu hình động:** Quản lý linh hoạt Giờ vào ca, Mức phạt đi muộn, Quỹ phép năm, Danh sách ngày Lễ/Tết ngay trên UI.

### ⏱ Dịch vụ Chấm công (Attendance Service)
- **Chấm công thông minh:** Tự động bắt tọa độ/IP (BSSID) tránh gian lận.
- **Phân tích dữ liệu:** Hệ thống tự bóc tách trạng thái (Đi muộn, Về sớm, Tăng ca, Vắng mặt) và cảnh báo người dùng.

### 📅 Dịch vụ Quản lý Nghỉ phép (Leave Service)
- **Quản lý quỹ phép:** Tự động trừ phép khi đơn được duyệt. Có nhiều loại nghỉ: Phép năm, Nghỉ không lương, Ốm đau.
- **Bảng điều phối lịch trực (Schedule):** Tự động sinh ma trận lịch làm việc của toàn công ty, kết hợp dữ liệu chấm công và ngày lễ. Cảnh báo thiếu quân số trực.
- **Quy trình duyệt cấp bậc:** Trưởng phòng duyệt đơn của nhân viên. Giám đốc duyệt đơn của Trưởng phòng.

### 💰 Dịch vụ Tiền lương (Salary Service)
- **Tính lương One-Click:** Tự động thu thập dữ liệu đi làm, đi muộn, vắng mặt, tăng ca và nghỉ phép để xuất ra bảng lương nháp.
- **In phiếu lương (Payslip):** Nhân viên có thể xem chi tiết từng ngày bị phạt, lý do phạt và số tiền thực nhận minh bạch.

### 🔔 Dịch vụ Thông báo (Notification Service)
- **Trạm phát thanh nội bộ:** Admin/Manager có thể phát thông báo khẩn cấp tới Toàn công ty, 1 Phòng ban cụ thể hoặc 1 Cá nhân.
- **Real-time Alert:** Kết hợp Socket.io, các tương tác như gửi đơn, duyệt đơn, thông báo đều hiện quả chuông đỏ và Push Notification tức thì.

---

## 🚀 5. Điểm nhấn Kiến trúc (Architecture Highlights)

1. **Kong API Gateway:** Toàn bộ request từ React gửi đến `/api/*` đều phải đi qua Kong. Kong chặn các truy cập rác bằng Plugin Rate-Limiting (giới hạn 60-100 request/phút/IP), bảo vệ các dịch vụ phía sau.
2. **Microservices Communication:** Các service giao tiếp và đánh thức nhau thông qua sự kiện Redis. Khi Salary Service tính lương, nó sẽ "hỏi" Attendance Service và Leave Service lấy dữ liệu thay vì thao tác chéo DB trực tiếp.
3. **Bảo mật dữ liệu nhạy cảm (Audit Log):** Mọi thao tác đổi lương, duyệt đơn của Manager/Admin đều lưu "vết" không thể xóa sửa vào MongoDB, đáp ứng tiêu chuẩn kiểm toán doanh nghiệp.
