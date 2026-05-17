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
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)" }}>Xin chào, {user.full_name || user.username}! 👋</div>
        <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 3 }}>Chúc bạn một ngày làm việc hiệu quả!</div>
      </div>

      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="stat-card-icon" style={{ background: "#E0F2FE", color: "#0284C7", width: 48, height: 48, fontSize: 22, flexShrink: 0 }}><FaCalendarAlt /></div>
          <div style={{ flex: 1 }}>
            <div className="stat-card-label">Số người nghỉ hôm nay</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <div className="stat-card-value" style={{ color: "#0284C7" }}>{leaveCount}</div>
              <div style={{ fontSize: 14, color: "#7DD3FC" }}>/5</div>
            </div>
            {leaveCount >= 5
              ? <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 500, marginTop: 2 }}>⚠️ Đã đầy lịch!</div>
              : <div style={{ fontSize: 12, color: "#16A34A", fontWeight: 500, marginTop: 2 }}>✅ Có thể xin nghỉ</div>
            }
          </div>
        </div>

        <div className="stat-card" style={{ border: "1px solid #D8B4FE" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div className="stat-card-icon" style={{ background: "#F3E8FF", color: "#9333EA", width: 40, height: 40, fontSize: 18, flexShrink: 0 }}><FaChartPie /></div>
            <div>
              <div className="stat-card-label">Quỹ phép năm nay</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: "#9333EA" }}>{balance.used}</span>
                <span style={{ fontSize: 13, color: "#D8B4FE" }}>/ {balance.max}</span>
              </div>
            </div>
          </div>
          <div className="progress-bar" style={{ background: "#E9D5FF" }}>
            <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? "#EF4444" : "#A855F7" }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#6B21A8" }}>Còn lại: <b>{balance.remaining}</b> ngày</div>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Thao tác nhanh</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { icon: <FaPlusCircle />, label: "Tạo đơn nghỉ phép", color: "var(--primary)", bg: "var(--primary-light)", path: "/employee/leaves/new" },
          { icon: <FaClipboardList />, label: "Lịch sử đơn nghỉ", color: "var(--success)", bg: "var(--success-bg)", path: "/employee/leaves/history" },
          { icon: <FaCalendarAlt />, label: "Xem lịch làm việc", color: "var(--warning)", bg: "var(--warning-bg)", path: "/employee/schedule" },
        ].map((a, i) => (
          <button key={i} onClick={() => navigate(a.path)} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 18px", borderRadius: "var(--r-md)",
            background: a.bg, color: a.color, border: "none", cursor: "pointer",
            fontWeight: 500, fontSize: 13.5, fontFamily: "var(--font)",
            transition: "filter 0.15s"
          }} onMouseEnter={e => e.currentTarget.style.filter = "brightness(0.95)"}
            onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}>
            {a.icon}{a.label}
          </button>
        ))}
      </div>
    </div>
  );
};
export default EmployeeHome;