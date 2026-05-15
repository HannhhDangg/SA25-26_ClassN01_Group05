import { useState, useRef } from "react";
import axios from "axios";

// ── OtpInput: nhận email và callback khi xác thực thành công ──
const OtpInput = ({ email, onVerifySuccess }) => {
  const [otp, setOtp] = useState(new Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef([]);

  // Khi nhập vào ô, chỉ cho nhập số và tự nhảy sang ô tiếp theo
  const handleChange = (element, index) => {
    if (isNaN(element.value)) return;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    // Tự động focus sang ô tiếp theo nếu đã nhập
    if (element.value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Xóa ngược khi bấm Backspace
  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Paste toàn bộ mã OTP vào cùng lúc (UX tốt hơn)
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const newOtp = [...otp];
    text.split("").forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    // Focus vào ô cuối cùng đã điền
    const lastIndex = Math.min(text.length - 1, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  // Gọi API xác thực OTP
  const handleVerify = async () => {
    const otpCode = otp.join("");
    if (otpCode.length < 6) {
      setError("Vui lòng nhập đủ 6 chữ số");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await axios.post("/api/otp/verify-otp", { email, otp: otpCode });
      if (res.data.success) {
        onVerifySuccess(); // Báo cho trang cha biết đã xác thực xong
      }
    } catch (err) {
      setError(err.response?.data?.message || "Mã OTP không đúng hoặc đã hết hạn");
      // Reset OTP để nhập lại
      setOtp(new Array(6).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="otp-container">
      <div style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 4 }}>
        Nhập mã xác thực
      </div>

      {/* 6 ô nhập OTP */}
      <div className="otp-inputs">
        {otp.map((data, index) => (
          <input
            key={index}
            type="text"
            inputMode="numeric"
            maxLength="1"
            className="otp-field"
            ref={(el) => (inputRefs.current[index] = el)}
            value={data}
            onChange={(e) => handleChange(e.target, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            style={{
              /* Ô đã có giá trị: đổi màu border và nền */
              borderColor: data ? "var(--primary)" : undefined,
              background: data ? "var(--primary-light)" : undefined,
              color: data ? "var(--primary)" : undefined,
            }}
          />
        ))}
      </div>

      {/* Thông báo lỗi */}
      {error && <p className="error-text">{error}</p>}

      {/* Nút xác nhận */}
      <button
        className="verify-btn"
        onClick={handleVerify}
        disabled={loading || otp.join("").length < 6}
      >
        {loading ? "Đang xác thực..." : "Xác nhận mã OTP"}
      </button>

      {/* Gửi lại mã */}
      <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--text-light)" }}>
        Không nhận được mã?{" "}
        <span
          style={{ color: "var(--primary)", cursor: "pointer", fontWeight: 500 }}
          onClick={async () => {
            try {
              await axios.post("/api/otp/send-otp", { email });
              setError("");
              setOtp(new Array(6).fill(""));
              inputRefs.current[0]?.focus();
              alert("Đã gửi lại mã OTP mới!");
            } catch {
              alert("Không thể gửi lại. Thử lại sau.");
            }
          }}
        >
          Gửi lại
        </span>
      </div>
    </div>
  );
};

export default OtpInput;