import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBuilding, FaArrowRight, FaCheck, FaClock, FaCalendarAlt, FaCoins, FaShieldAlt } from "react-icons/fa";
import OtpInput from "../components/OtpInput";

// ─── Step bar 3 bước ────────────────────────────────────────
const StepBar = ({ current }) => {
  const steps = ["Thông tin", "Xác thực OTP", "Hoàn tất"];
  return (
    <div className="step-bar">
      {steps.map((label, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div className={`step${isDone ? " done" : ""}${isActive ? " active" : ""}`}>
              <div className="step-num">
                {isDone ? <FaCheck size={9} /> : i + 1}
              </div>
              {label}
            </div>
            {i < steps.length - 1 && (
              <div className={`step-line${isDone ? " done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Cột trái Brand Panel ────────────────────────────────────
// Hiển thị logo + tagline + 4 tính năng nổi bật
const BrandPanel = () => (
  <div className="login-left">
    {/* Logo */}
    <div className="login-brand">
      <div className="login-brand-icon"><FaBuilding size={22} /></div>
      <div>
        <div className="login-brand-name">HRM System</div>
        <div className="login-brand-sub">Hệ thống quản lý nhân sự</div>
      </div>
    </div>

    {/* Tagline */}
    <p className="login-tagline">
      Nền tảng quản lý nhân sự tập trung, hiện đại và dễ sử dụng cho doanh nghiệp.
    </p>

    {/* 4 tính năng */}
    <div className="login-features">
      <div className="login-feature">
        <div className="login-feature-icon"><FaClock size={15} /></div>
        Chấm công GPS & mạng nội bộ (BSSID)
      </div>
      <div className="login-feature">
        <div className="login-feature-icon"><FaCalendarAlt size={15} /></div>
        Quản lý nghỉ phép & lịch ca làm việc
      </div>
      <div className="login-feature">
        <div className="login-feature-icon"><FaCoins size={15} /></div>
        Tính lương tự động từ chấm công
      </div>
      <div className="login-feature">
        <div className="login-feature-icon"><FaShieldAlt size={15} /></div>
        Phân quyền 3 cấp bảo mật JWT
      </div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════
const Login = () => {
  const navigate = useNavigate();

  // mode: "login" | "register" | "otp" | "success"
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "", password: "",
    fullName: "", email: "", phone: "", role: "STAFF",
  });

  const set = (field) => (e) => setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // ── Đăng nhập ────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth_ser/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: formData.username, password: formData.password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        if (["SUPERADMIN", "ADMIN", "MANAGER"].includes(data.user.role)) {
          navigate("/admin");
        } else {
          navigate("/employee");
        }
      } else {
        alert(data.message || "Sai thông tin đăng nhập");
      }
    } catch {
      alert("Lỗi kết nối Server!");
    } finally {
      setLoading(false);
    }
  };

  // ── Bước 1: Gửi OTP ──────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/otp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });
      const data = await res.json();
      if (res.ok) {
        setMode("otp");
      } else {
        alert(data.message || "Không thể gửi mã OTP");
      }
    } catch {
      alert("Lỗi kết nối Server!");
    } finally {
      setLoading(false);
    }
  };

  // ── Bước 2: OTP xong → Register ──────────────────────────
  const handleVerifySuccess = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth_ser/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setMode("success");
      } else {
        alert(data.message || "Lỗi đăng ký");
      }
    } catch {
      alert("Lỗi hệ thống!");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ username: "", password: "", fullName: "", email: "", phone: "", role: "STAFF" });
    setMode("login");
  };

  return (
    <div className="login-page">
      {/* ── Cột trái: Brand ──────────────────────────────── */}
      <BrandPanel />

      {/* ── Cột phải: Form ───────────────────────────────── */}
      <div className="login-right">

        {/* ══ ĐĂNG NHẬP ══ */}
        {mode === "login" && (
          <>
            <div className="login-form-title">Chào mừng trở lại</div>
            <div className="login-form-sub">Đăng nhập để tiếp tục sử dụng hệ thống</div>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column" }}>
              <label className="form-label">Tên đăng nhập</label>
              <input
                className="login-input"
                placeholder="Nhập tên đăng nhập"
                value={formData.username}
                onChange={set("username")}
                required autoFocus
              />
              <label className="form-label">Mật khẩu</label>
              <input
                className="login-input"
                type="password"
                placeholder="Nhập mật khẩu"
                value={formData.password}
                onChange={set("password")}
                required
              />
              <span className="login-forgot">Quên mật khẩu?</span>
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "Đang xử lý..." : <>{`Đăng nhập`} <FaArrowRight size={12} /></>}
              </button>
            </form>

            <div className="login-switch">
              Chưa có tài khoản?{" "}
              <span onClick={() => setMode("register")}>Đăng ký ngay</span>
            </div>
          </>
        )}

        {/* ══ ĐĂNG KÝ — Bước 1 ══ */}
        {mode === "register" && (
          <>
            <StepBar current={0} />
            <div className="login-form-title">Tạo tài khoản mới</div>
            <div className="login-form-sub" style={{ marginBottom: 18 }}>Điền đầy đủ thông tin để tiếp tục</div>

            <form onSubmit={handleRequestOtp} style={{ display: "flex", flexDirection: "column" }}>
              <label className="form-label">Họ và tên <span style={{ color: "#DC2626" }}>*</span></label>
              <input className="login-input" placeholder="VD: Nguyễn Văn An" value={formData.fullName} onChange={set("fullName")} required />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Tên đăng nhập <span style={{ color: "#DC2626" }}>*</span></label>
                  <input className="login-input" style={{ marginBottom: 0 }} placeholder="VD: nguyenvanan" value={formData.username} onChange={set("username")} required />
                </div>
                <div>
                  <label className="form-label">Số điện thoại</label>
                  <input className="login-input" style={{ marginBottom: 0 }} placeholder="0901 234 567" value={formData.phone} onChange={set("phone")} />
                </div>
              </div>

              <label className="form-label">
                Email <span style={{ color: "#DC2626" }}>*</span>
                <span style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 400 }}> — dùng để nhận mã OTP</span>
              </label>
              <input className="login-input" type="email" placeholder="email@congty.vn" value={formData.email} onChange={set("email")} required />

              <label className="form-label">Mật khẩu <span style={{ color: "#DC2626" }}>*</span></label>
              <input className="login-input" type="password" placeholder="Tối thiểu 8 ký tự" value={formData.password} onChange={set("password")} required minLength={8} />

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "Đang gửi OTP..." : <>{`Tiếp tục — Nhận mã OTP`} <FaArrowRight size={12} /></>}
              </button>
            </form>

            <div className="login-switch">
              Đã có tài khoản? <span onClick={() => setMode("login")}>Đăng nhập</span>
            </div>
          </>
        )}

        {/* ══ OTP — Bước 2 ══ */}
        {mode === "otp" && (
          <>
            <StepBar current={1} />
            <div className="info-box">
              Mã OTP gồm <b>6 chữ số</b> đã được gửi đến email <b>{formData.email}</b>.<br />
              Mã có hiệu lực trong <b>5 phút</b>. Kiểm tra cả hộp thư Spam nếu không thấy.
            </div>
            <OtpInput email={formData.email} onVerifySuccess={handleVerifySuccess} />
            <div className="login-switch" style={{ marginTop: 16 }}>
              <span onClick={() => setMode("register")}>← Quay lại sửa thông tin</span>
            </div>
          </>
        )}

        {/* ══ Thành công — Bước 3 ══ */}
        {mode === "success" && (
          <>
            <StepBar current={2} />
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "var(--success-bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 18px",
              }}>
                <FaCheck size={28} color="var(--success)" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
                Đăng ký thành công!
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text-sub)", lineHeight: 1.75, maxWidth: 300, margin: "0 auto 28px" }}>
                Tài khoản đang chờ <b style={{ color: "var(--text)" }}>Admin xét duyệt</b> kích hoạt.<br />
                Bạn sẽ nhận thông báo qua email khi được duyệt.
              </div>
              <button className="login-btn" style={{ maxWidth: 220, margin: "0 auto" }} onClick={resetForm}>
                Về trang đăng nhập
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;