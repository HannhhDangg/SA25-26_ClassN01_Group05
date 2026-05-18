import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { FaCalendarAlt, FaChartPie, FaPlusCircle, FaClipboardList } from "react-icons/fa";

const EmployeeHome = () => {
  const navigate = useNavigate();
  const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
  const [leaveCount, setLeaveCount] = useState(0);
  const [balance, setBalance] = useState({ used: 0, max: 12, remaining: 12 });

  const fetchData = useCallback(() => {
    fetch("/api/leave_ser/stats/today").then(r => r.json()).then(d => setLeaveCount(d.count || 0)).catch(() => { });
    if (user?.id) {
      fetch(`/api/leave_ser/balance/${user.id}`).then(r => r.json()).then(d => setBalance(d)).catch(() => { });
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const socket = io("/", { transports: ["websocket", "polling"], upgrade: true });
    socket.on("leave_status_update", data => {
      if (data.target_user_id == user.id) {
        data.status === "APPROVED" ? toast.success(data.message) : data.status === "REJECTED" ? toast.error(data.message) : toast.info(data.message);
        fetchData();
      }
    });
    return () => socket.disconnect();
  }, [user.id, fetchData]);

  const pct = Math.min((balance.used / balance.max) * 100, 100);

  return (
    <div style={{ padding: "10px 20px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{ marginBottom: 30, borderBottom: "1px solid var(--border)", paddingBottom: 15 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text)" }}>Xin chào, {user.full_name || user.username}! 👋</div>
        <div style={{ fontSize: 16, color: "var(--text-sub)", marginTop: 6 }}>Chúc bạn một ngày làm việc hiệu quả và tràn đầy năng lượng!</div>
      </div>

      {/* STATS SECTION */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 24, marginBottom: 40 }}>
        {/* Card 1 */}
        <div style={{ background: "white", borderRadius: 16, padding: 24, display: "flex", alignItems: "center", gap: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
          <div style={{ background: "#E0F2FE", color: "#0284C7", width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>
            <FaCalendarAlt />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: 0.5 }}>Nhân sự nghỉ hôm nay</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: "#0284C7" }}>{leaveCount}</span>
              <span style={{ fontSize: 16, color: "#7DD3FC", fontWeight: 500 }}>/ 5 người</span>
            </div>
            {leaveCount >= 5
              ? <div style={{ fontSize: 14, color: "#EF4444", fontWeight: 600, marginTop: 6 }}>⚠️ Đã đầy lịch nghỉ!</div>
              : <div style={{ fontSize: 14, color: "#16A34A", fontWeight: 600, marginTop: 6 }}>✅ Vẫn có thể xin nghỉ</div>
            }
          </div>
        </div>

        {/* Card 2 */}
        <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", borderTop: "4px solid #A855F7" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 15 }}>
            <div style={{ background: "#F3E8FF", color: "#9333EA", width: 50, height: 50, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
              <FaChartPie />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: 0.5 }}>Quỹ phép năm nay</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: "#9333EA" }}>{balance.used}</span>
                <span style={{ fontSize: 15, color: "#D8B4FE", fontWeight: 500 }}>/ {balance.max} ngày</span>
              </div>
            </div>
          </div>
          <div style={{ width: "100%", height: 8, background: "#E9D5FF", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "#EF4444" : "#A855F7", borderRadius: 10, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 15, color: "#6B21A8", textAlign: "right", fontWeight: 500 }}>Còn lại: <b>{balance.remaining}</b> ngày phép</div>
        </div>
      </div>

      {/* QUICK ACTIONS SECTION */}
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}> Thao tác nhanh</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {[
          {
            icon: <FaPlusCircle size={32} />,
            title: "Tạo Đơn Mới",
            desc: "Xin nghỉ phép, nghỉ ốm, thai sản...",
            color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE",
            path: "/employee/leaves/new" // ✅ Đã sửa chuẩn đường dẫn
          },
          {
            icon: <FaClipboardList size={32} />,
            title: "Lịch Sử Đơn",
            desc: "Theo dõi tiến độ duyệt đơn của bạn",
            color: "#059669", bg: "#F0FDF4", border: "#BBF7D0",
            path: "/employee/leaves/history" // ✅ Đã sửa chuẩn đường dẫn
          },
          {
            icon: <FaCalendarAlt size={32} />,
            title: "Lịch Làm Việc",
            desc: "Xem lịch trực và lịch công ty",
            color: "#D97706", bg: "#FFFBEB", border: "#FDE68A",
            path: "/employee/schedule"
          },
        ].map((btn, i) => (
          <div
            key={i}
            onClick={() => navigate(btn.path)} // ✅ Chuyển hướng trực tiếp không cần truyền state
            style={{
              background: btn.bg,
              border: `2px solid ${btn.border}`,
              borderRadius: 16,
              padding: "24px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
              boxShadow: "0 4px 6px rgba(0,0,0,0.02)"
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.boxShadow = "0 10px 25px rgba(0,0,0,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.02)"; }}
          >
            <div style={{ color: btn.color, marginBottom: 12 }}>{btn.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{btn.title}</div>
            <div style={{ fontSize: 14, color: "var(--text-sub)", lineHeight: 1.4 }}>{btn.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmployeeHome;