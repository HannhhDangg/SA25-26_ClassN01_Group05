# 🏢 HỆ THỐNG QUẢN LÝ NHÂN SỰ HIỆN ĐẠI (HRM SYSTEM)

Một giải pháp Quản lý Nhân sự toàn diện được xây dựng trên nền tảng kiến trúc **Microservices** tiên tiến và có tính sẵn sàng cao (High Availability). Hệ thống tập trung vào việc tự động hóa quy trình nhân sự, xử lý bất đồng bộ, tính toán lương thưởng tự động, khả năng tương tác thời gian thực (Real-time) và giám sát hệ thống (Monitoring) chuẩn Enterprise.

---

## 📖 1. Lời nói đầu / Lý do chọn đề tài

Trong kỷ nguyên chuyển đổi số, việc quản lý nhân sự theo cách truyền thống (sử dụng giấy tờ, Excel, hay các công cụ rời rạc) đang bộc lộ nhiều điểm yếu chí mạng:
- **Thiếu minh bạch & dễ sai sót:** Chấm công và tính lương thủ công dễ dẫn đến sai lệch dữ liệu, gây bức xúc cho người lao động.
- **Quy trình chậm chạp:** Việc xin nghỉ phép, duyệt đơn phải qua nhiều khâu giấy tờ, tốn thời gian của cả nhân viên lẫn cấp quản lý.
- **Rủi ro dữ liệu:** Hệ thống nguyên khối (Monolith) cũ thường xuyên quá tải vào những ngày chốt công cuối tháng.

**HRM System** ra đời nhằm giải quyết triệt để các vấn đề trên. Bằng việc áp dụng kiến trúc **Microservices** kết hợp hạ tầng Cụm cơ sở dữ liệu (Cluster/Replica), hệ thống không chỉ giải quyết bài toán nghiệp vụ mà còn đảm bảo khả năng mở rộng (Scale) vô hạn, không bị gián đoạn dịch vụ (Zero Downtime) và trải nghiệm người dùng mượt mà nhất.

## 🎯 2. Mục tiêu dự án

1. **Số hóa toàn diện:** Đưa 100% quy trình từ Onboarding (đăng ký, duyệt tài khoản), Chấm công, Xin nghỉ phép đến Tính lương lên nền tảng số.
2. **Tự động hóa:** Hệ thống tự động đối soát lịch sử chấm công, cấu hình ngày lễ và đơn nghỉ phép để tính ra bảng lương cuối cùng (bao gồm thưởng OT, phạt đi muộn, vắng mặt).
3. **Real-time Interaction:** Loại bỏ độ trễ thông tin. Quản lý nhận được đơn xin phép ngay lập tức, nhân viên nhận kết quả duyệt đơn và thông báo trạm phát thanh theo thời gian thực thông qua WebSockets.
4. **Kiến trúc bền vững:** Xây dựng mô hình Microservices đằng sau API Gateway để dễ dàng bảo trì, nâng cấp từng module độc lập mà không ảnh hưởng toàn hệ thống.

---

## 🛠 3. Công nghệ & Công cụ sử dụng

Dự án tuân thủ triết lý **Polyglot Persistence** (Sử dụng nhiều loại cơ sở dữ liệu phù hợp với từng ngữ cảnh) và hệ sinh thái hiện đại:

### Giao diện (Frontend)
- **React.js (Vite):** Xây dựng Single Page Application (SPA) tốc độ cao với kiến trúc Component linh hoạt.
- **Tailwind CSS:** Thiết kế giao diện (UI) hiện đại, responsive.
- **Socket.io-client:** Kết nối WebSockets nhận dữ liệu thời gian thực.
- **React-Toastify:** Hiển thị thông báo (Popup) thân thiện.

### Máy chủ & Dịch vụ (Backend - Microservices)
- **Node.js & Express:** Xây dựng 5 dịch vụ độc lập (`auth_service`, `leave_service`, `attendance_service`, `noti_service`, `salary_service`).
- **Bcrypt & JWT:** Mã hóa mật khẩu bảo mật và xác thực không trạng thái (Stateless Authentication).
- **Nodemailer:** Gửi email tự động (OTP mã xác thực).
- **Prom-client:** Tích hợp xuất Metrics theo chuẩn Prometheus đo lường hiệu năng API.

### Cơ sở dữ liệu (Databases)
- **PostgreSQL HA (Spilo/Patroni + Etcd):** Cụm Database phân tán (1 Leader, 2 Replicas) chịu lỗi cao, lưu trữ dữ liệu cốt lõi (Tài khoản, Chấm công, Tiền lương).
- **MongoDB Replica Set:** Cụm 3 Node lưu trữ Log hệ thống (Audit Trail) cho các thao tác nhạy cảm nhờ tốc độ ghi cực nhanh.
- **Redis (với Redis Adapter):** 
  - Lưu trữ Cache OTP (Tự động xóa sau 5 phút).
  - Làm Message Broker (Pub/Sub) đồng bộ session của Socket.io trên nhiều Instance.

### Hạ tầng & DevOps
- **Kong API Gateway & Nginx:** Cửa ngõ duy nhất (Entry point), xử lý Rate-Limiting (chống DDoS) và định tuyến request (Routing).
- **HAProxy:** Load Balancer chuyên dụng điều phối truy cập vào đúng Node Leader của cụm PostgreSQL.
- **Docker & Docker Compose:** Container hóa toàn bộ ứng dụng, dễ dàng deploy và đồng bộ môi trường.
- **Monitoring Stack:** Prometheus, Grafana, Alertmanager cùng bộ Exporters (Node, Postgres, Redis, Mongo, Blackbox) giám sát độ trễ, cảnh báo lỗi và tài nguyên máy chủ theo thời gian thực.

---

## 🌟 4. Phân hệ chức năng tổng quan

Hệ thống được thiết kế theo mô hình phân quyền 3 cấp bám sát cấu trúc doanh nghiệp thực tế: **Giám Đốc (Superadmin) > Trưởng phòng (Manager) > Nhân viên (Staff)**.

### 🔑 Dịch vụ Xác thực & Quản trị (Auth Service)
- **Xác thực 2 lớp (OTP):** Đăng ký tài khoản yêu cầu xác nhận qua Email.
- **Kiểm duyệt tự động:** Tài khoản mới phải được Admin kích hoạt mới có hiệu lực.
- **Bảng Cấu hình Động (Settings):** Cho phép thay đổi Giờ vào/ra ca chuẩn, Mức phạt đi muộn, Quỹ phép năm, Danh sách ngày Lễ/Tết và thông số SMTP ngay trên giao diện UI mà không cần sửa Code.
- **Quản lý Nhân sự & Phòng ban:** Thiết lập sơ đồ tổ chức, gán Trưởng phòng điều hành và quản lý hồ sơ nhân sự (Lương cơ bản, Quỹ phép).

### ⏱ Dịch vụ Chấm công (Attendance Service)
- **Chấm công thông minh:** Kiểm tra mạng nội bộ công ty (Dựa trên cấu hình IP hợp lệ) và kiểm soát Device ID.
- **Phân tích dữ liệu tự động:** Tự tính toán số phút Đi muộn, Về sớm, đối chiếu Giờ cấu hình hệ thống để gán nhãn trạng thái chính xác.
- **Bảng theo dõi nhóm:** Quản lý lập tức theo dõi trạng thái hiện diện của các nhân sự trực thuộc phòng ban của mình trong ngày.

### 📅 Dịch vụ Quản lý Nghỉ phép (Leave Service)
- **Quản lý quỹ phép & Loại hình:** Xử lý linh hoạt Nghỉ phép năm, Nghỉ không lương, Nghỉ ốm đau. Chặn gửi đơn quá ngày quỹ phép cho phép.
- **Bảng điều phối ma trận (Grid Schedule):** Giao diện lịch trình trực quan theo tuần (Weekly), kết hợp liền mạch dữ liệu Đơn Nghỉ Phép + Ngày Lễ + Lịch sử Chấm Công thực tế.
- **Quy trình duyệt cấp bậc:** Trưởng phòng duyệt đơn của nhân viên. Giám đốc duyệt đơn của Trưởng phòng.

### 💰 Dịch vụ Tiền lương (Salary Service)
- **Tính lương One-Click:** Chỉ với 1 nút bấm, tự động trích xuất cấu hình Lương cơ bản, Ngày công chuẩn (trừ Chủ Nhật và Lễ), và phạt vi phạm (Muộn, Vắng) để sinh Bảng lương Nháp (DRAFT).
- **Phiếu lương minh bạch (Payslip):** Hệ thống có cơ chế bóc tách từng lỗi vi phạm của nhân sự trong tháng (kèm ngày, giờ, số phút trễ, lý do phạt) và hiển thị chi tiết số tiền bị trừ.

### 🔔 Dịch vụ Thông báo (Notification Service)
- **Trạm phát thanh nội bộ:** Cung cấp quyền phát thông báo khẩn cấp theo 4 cấp độ mục tiêu: Toàn bộ nhân sự (ALL), Chỉ cấp Quản lý (ROLE), Theo phòng ban (DEPT_STAFF) và Cá nhân (INDIVIDUAL).
- **Real-time Push & Tracking:** Bắn Notification ngay lập tức lên màn hình người nhận qua Socket.io và lưu vết Trạng thái "Chưa đọc/Đã đọc".

---

## 🚀 5. Điểm nhấn Kiến trúc (Architecture Highlights)

1. **Kong API Gateway & Rate Limiting:** Đóng vai trò lá chắn thép bảo vệ nội bộ. Tự động trả về lỗi 429 nếu có dấu hiệu spam API, bảo vệ cơ sở dữ liệu khỏi quá tải.
2. **High Availability (HA) Databases:** 
   - PostgreSQL được cài đặt dưới dạng Cluster với Spilo (Patroni + Etcd) tự động Failover (Chuyển đổi Leader) khi có sự cố.
   - MongoDB được cấu hình Replica Set (rs0) với tuỳ chọn Read Preference ưu tiên đọc từ Node Secondary để giảm tải.
3. **Giám sát thông minh (Prometheus + Grafana):** Thu thập Metrics HTTP (Request Rate, P99 Latency, Error Rate) trên từng Service, theo dõi sức khỏe CPU/RAM và dung lượng Redis/Database hiển thị trực quan qua Dashboard xịn sò.
4. **Bảo mật & Kiểm toán (Audit Logs):** Mọi hành động thao tác (Tính lương, Cập nhật thiết lập, Duyệt đơn) đều ghi vết (Log) vào hệ thống MongoDB để phục vụ truy xuất và kiểm toán doanh nghiệp.
5. **Script Khôi phục thảm họa:** Cung cấp công cụ Shell Script (`restore.sh`) khôi phục toàn bộ CSDL PostgreSQL và MongoDB thông qua file Logical Dump một cách nhanh chóng.
