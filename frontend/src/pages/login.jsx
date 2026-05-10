import { useState } from "react";
import { useNavigate } from "react-router-dom";
// Thay vì ./components/OtpInput, bạn phải lùi ra một cấp thư mục bằng ../
import OtpInput from "../components/OtpInput";

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [isOtpStep, setIsOtpStep] = useState(false); // Trạng thái chuyển sang nhập OTP
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // State form
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    phone: "",
    role: "STAFF",
  });

  // --- BƯỚC 1: GỬI MÃ OTP (DÀNH CHO ĐĂNG KÝ) ---
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
        alert("Mã OTP đã được gửi vào Email của bạn!");
        setIsOtpStep(true); // Chuyển sang giao diện nhập OTP
      } else {
        alert(data.message || "Không thể gửi mã OTP");
      }
    } catch (err) {
      alert("Lỗi kết nối Server!");
    } finally {
      setLoading(false);
    }
  };

  // --- BƯỚC 2: XÁC THỰC OTP THÀNH CÔNG THÌ MỚI GỌI REGISTER ---
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
        alert("Đăng ký thành công! Vui lòng chờ Admin xét duyệt.");
        setIsRegister(false);
        setIsOtpStep(false);
      } else {
        alert(data.message || "Lỗi đăng ký");
      }
    } catch (err) {
      alert("Lỗi hệ thống!");
    } finally {
      setLoading(false);
    }
  };

  // --- LUỒNG ĐĂNG NHẬP THÔNG THƯỜNG ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth_ser/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.user.role === "SUPERADMIN" || data.user.role === "MANAGER") {
          navigate("/admin");
        } else {
          navigate("/employee");
        }
      } else {
        alert(data.message || "Sai thông tin đăng nhập");
      }
    } catch (err) {
      alert("Lỗi kết nối Server!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2
          style={{ textAlign: "center", color: "#333", marginBottom: "20px" }}
        >
          {isRegister
            ? isOtpStep
              ? "Xác thực mã OTP"
              : "Đăng Ký Tài Khoản"
            : "Đăng Nhập"}

          {/* {!isRegister && !isForgotPassword && (
            <p style={styles.link} onClick={() => setIsForgotPassword(true)}>
              Quên mật khẩu?
            </p>
          )} */}
        </h2>

        {/* HIỂN THỊ Ô NHẬP OTP NẾU ĐANG Ở BƯỚC OTP */}
        {isRegister && isOtpStep ? (
          <OtpInput
            email={formData.email}
            onVerifySuccess={handleVerifySuccess}
          />
        ) : (
          <form
            onSubmit={isRegister ? handleRequestOtp : handleLogin}
            style={styles.form}
          >
            {isRegister && (
              <>
                <input
                  required
                  placeholder="Họ và tên"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  style={styles.input}
                />
                <input
                  required
                  placeholder="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  style={styles.input}
                />
                <input
                  required
                  placeholder="Số điện thoại"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  style={styles.input}
                />
              </>
            )}

            <input
              required
              placeholder="Tên đăng nhập"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              style={styles.input}
            />
            <input
              required
              placeholder="Mật khẩu"
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              style={styles.input}
            />

            <button type="submit" disabled={loading} style={styles.button}>
              {loading
                ? "Đang xử lý..."
                : isRegister
                  ? "Tiếp tục"
                  : "Đăng Nhập"}
            </button>
          </form>
        )}

        {/* NÚT QUAY LẠI / CHUYỂN FORM */}
        {!isOtpStep && (
          <p style={styles.link} onClick={() => setIsRegister(!isRegister)}>
            {isRegister
              ? "Đã có tài khoản? Đăng nhập ngay"
              : "Chưa có tài khoản? Đăng ký tại đây"}
          </p>
        )}

        {isOtpStep && (
          <p style={styles.link} onClick={() => setIsOtpStep(false)}>
            Quay lại sửa thông tin
          </p>
        )}
      </div>
    </div>
  );
};

// Styles giữ nguyên như bản cũ của bạn
const styles = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f0f2f5",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    background: "white",
    padding: "40px",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    width: "100%",
    maxWidth: "400px",
  },
  form: { display: "flex", flexDirection: "column", gap: "15px" },
  input: {
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid #ddd",
    fontSize: "16px",
    outline: "none",
  },
  button: {
    padding: "12px",
    background: "#1890ff",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
  },
  link: {
    textAlign: "center",
    marginTop: "20px",
    color: "#1890ff",
    cursor: "pointer",
    fontSize: "14px",
  },
};

export default Login;
