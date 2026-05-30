import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify"; // 1. Import Toastify

const EmployeeDashboard = () => {
  const [user] = useState(JSON.parse(localStorage.getItem("user")));

  // State form
  const [formData, setFormData] = useState({
    reason: "",
    start_date: "",
    end_date: "",
  });
  const [totalDays, setTotalDays] = useState(0);
  const [leaves, setLeaves] = useState([]);

  // ❌ ĐÃ XÓA: State thông báo cũ (notify)

  // Hàm tải danh sách
  const fetchLeaves = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/users/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setLeaves(data);
      }
    } catch (err) {
      console.error("Lỗi tải lịch sử:", err);
    }
  }, [user?.id]);

  // --- 🔥 KẾT NỐI SOCKET 🔥 ---
  useEffect(() => {
    fetchLeaves();

    const socket = io("/", {
      transports: ["websocket", "polling"],
      upgrade: true,
    });

    socket.on("leave_status_update", (data) => {
      // So sánh ID (dùng == cho an toàn)
      if (data.target_user_id == user.id) {
        console.log("🔔 CÓ TIN NHẮN TỪ SẾP:", data);

        // ✅ SỬ DỤNG TOASTIFY (Thay vì setNotify)
        if (data.status === "APPROVED") {
          toast.success(data.message);
        } else if (data.status === "REJECTED") {
          toast.error(data.message);
        } else {
          toast.info(data.message);
        }

        // Tự động load lại danh sách
        fetchLeaves();
      }
    });

    return () => socket.disconnect();
  }, [fetchLeaves, user.id]);

  // Tự động tính ngày
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const diffTime = end - start;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setTotalDays(diffDays > 0 ? diffDays : 0);
    }
  }, [formData.start_date, formData.end_date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalDays <= 0)
      return toast.warning("Ngày kết thúc phải sau ngày bắt đầu!");

    try {
      const res = await fetch("/api/leave_ser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          reason: formData.reason,
          start_date: formData.start_date,
          end_date: formData.end_date,
          total_days: totalDays,
        }),
      });

      if (res.ok) {
        toast.success("Gửi đơn thành công! 🚀"); // Thay alert bằng toast
        setFormData({ reason: "", start_date: "", end_date: "" });
        setTotalDays(0);
        fetchLeaves();
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Lỗi gửi đơn"); // Thay alert bằng toast
      }
    } catch (err) {
      toast.error("Lỗi kết nối server");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "APPROVED":
        return (
          <span
            style={{ ...styles.badge, background: "#d1fae5", color: "#065f46" }}
          >
            ✅ Đã duyệt
          </span>
        );
      case "REJECTED":
        return (
          <span
            style={{ ...styles.badge, background: "#fee2e2", color: "#991b1b" }}
          >
            ❌ Từ chối
          </span>
        );
      default:
        return (
          <span
            style={{ ...styles.badge, background: "#fef3c7", color: "#92400e" }}
          >
            ⏳ Chờ duyệt
          </span>
        );
    }
  };

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        paddingBottom: "50px",
        position: "relative",
      }}
    >
      {/* ❌ ĐÃ XÓA: Phần hiển thị notify cũ (div fixed) ở đây */}

      <div style={{
          borderBottom: "2px solid #ddd",
          paddingBottom: "15px",
          marginBottom: "30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
      }}>
        <h2 style={{ margin: 0 }}>
          Xin chào, {user?.full_name || "Nhân viên"} 👋
        </h2>
        <div style={{ background: "#F3F4F6", padding: "8px 16px", borderRadius: "8px", border: "1px solid #E5E7EB", fontWeight: "500" }}>
          <span style={{ color: "#6B7280", fontSize: "14px" }}>Phòng ban: </span>
          <span style={{ color: "#111827", fontSize: "15px", fontWeight: "bold" }}>
            {user?.department_id === 1 ? "Giám Đốc" : user?.department_id === 2 ? "Phòng IT" : user?.department_id === 3 ? "Phòng Hành Chính Nhân Sự" : "Chưa phân phòng"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
        {/* FORM GỬI ĐƠN */}
        <div style={styles.card}>
          <h3
            style={{
              marginTop: 0,
              color: "#2563eb",
              fontSize: "20px",
              borderBottom: "1px solid #eee",
              paddingBottom: "15px",
            }}
          >
            📝 Tạo Đơn Xin Nghỉ Mới
          </h3>
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              marginTop: "20px",
            }}
          >
            <div>
              <label style={styles.label}>Lý do nghỉ:</label>
              <input
                required
                type="text"
                placeholder="VD: Nghỉ ốm, Việc gia đình..."
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                style={styles.input}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "30px",
              }}
            >
              <div>
                <label style={styles.label}>Từ ngày:</label>
                <input
                  required
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Đến ngày:</label>
                <input
                  required
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  style={styles.input}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
                padding: "15px",
                borderRadius: "8px",
              }}
            >
              <div style={{ fontSize: "16px", fontWeight: "500" }}>
                Tổng số ngày nghỉ:{" "}
                <span
                  style={{ color: "red", fontWeight: "bold", fontSize: "20px" }}
                >
                  {totalDays} ngày
                </span>
              </div>
              <button type="submit" style={styles.button}>
                🚀 Gửi Đơn Ngay
              </button>
            </div>
          </form>
        </div>

        {/* LỊCH SỬ */}
        <div style={styles.card}>
          <h3
            style={{
              marginTop: 0,
              color: "#059669",
              fontSize: "20px",
              borderBottom: "1px solid #eee",
              paddingBottom: "15px",
            }}
          >
            🕒 Lịch Sử Các Đơn Đã Gửi
          </h3>
          <div style={{ overflowX: "auto" }}>
            {leaves.length === 0 ? (
              <p
                style={{ textAlign: "center", color: "#666", padding: "20px" }}
              >
                Bạn chưa có đơn nghỉ phép nào.
              </p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "16px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f1f5f9",
                      textAlign: "left",
                      color: "#475569",
                    }}
                  >
                    <th style={styles.th}>Thời gian</th>
                    <th style={styles.th}>Lý do</th>
                    <th style={styles.th}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((leave) => (
                    <tr
                      key={leave.id}
                      style={{ borderBottom: "1px solid #e2e8f0" }}
                    >
                      <td style={styles.td}>
                        {new Date(leave.start_date).toLocaleDateString("vi-VN")}
                        <br />
                        <small style={{ color: "#666" }}>
                          ({leave.total_days} ngày)
                        </small>
                      </td>
                      <td style={styles.td}>{leave.reason}</td>
                      <td style={styles.td}>{getStatusBadge(leave.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  card: {
    background: "white",
    padding: "30px",
    borderRadius: "12px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
  },
  input: {
    width: "100%",
    padding: "12px 15px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    outline: "none",
  },
  button: {
    padding: "12px 30px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "16px",
  },
  label: {
    fontWeight: "600",
    display: "block",
    marginBottom: "8px",
    fontSize: "15px",
    color: "#334155",
  },
  badge: {
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "bold",
    display: "inline-block",
  },
  th: { padding: "15px", fontWeight: "600", borderBottom: "2px solid #e2e8f0" },
  td: { padding: "15px", verticalAlign: "middle" },
};

export default EmployeeDashboard;
