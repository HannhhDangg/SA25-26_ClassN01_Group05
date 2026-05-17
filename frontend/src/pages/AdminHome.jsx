import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { FaUsers, FaCalendarTimes, FaClipboardCheck, FaFileAlt, FaCheck, FaTimes, FaExclamationTriangle } from "react-icons/fa";

const AdminHome = () => {
  const navigate = useNavigate();
  const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
  const [stats, setStats] = useState({ totalUsers: 0, absentToday: 0, checkedIn: 0, pendingLeaves: 0 });
  const [pending, setPending] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);

  // State lưu ca làm (Hiện tại rỗng vì chưa kéo từ DB)
  const [shifts, setShifts] = useState([]);

  const fetchStats = () =>
    fetch("/api/leave_ser/stats/admin-summary").then(r => r.json()).then(d => setStats(d)).catch(() => { });

  const fetchPending = () => {
    setLoadingPending(true);
    // Bắt buộc Backend trả về mảng, ta sẽ tự lọc tiếp ở Frontend để chắc chắn 100%
    fetch("/api/leave_ser?status=PENDING")
      .then(r => r.json())
      .then(d => {
        // Lọc TẤT CẢ những đơn không phải PENDING ra khỏi danh sách
        const filteredPending = Array.isArray(d) ? d.filter(item => item.status === "PENDING").slice(0, 5) : [];
        setPending(filteredPending);
      })
      .catch(() => { })
      .finally(() => setLoadingPending(false));
  };

  useEffect(() => {
    fetchStats(); fetchPending();
    const socket = io("/", { transports: ["websocket", "polling"], upgrade: true });
    socket.on("new_leave_request", data => {
      toast.info("🔔 " + data.message);
      fetchStats(); fetchPending();
    });
    return () => socket.disconnect();
  }, []);

  const handleStatus = async (id, status, name) => {
    if (!window.confirm(`Xác nhận ${status === "APPROVED" ? "DUYỆT" : "TỪ CHỐI"} đơn của ${name}?`)) return;
    try {
      const res = await fetch(`/api/leave_ser/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        toast.success(`Đã ${status === "APPROVED" ? "duyệt" : "từ chối"} thành công!`);

        // CẬP NHẬT LẠC QUAN: Xóa ngay đơn vừa duyệt khỏi màn hình
        setPending(prevPending => prevPending.filter(req => req.id !== id));

        // Gọi lại thống kê
        fetchStats();
      } else {
        toast.error("Lỗi xử lý từ Server!");
      }
    } catch (error) {
      toast.error("Lỗi kết nối mạng!");
    }
  };

  const formatID = id => `HD${String(id).padStart(2, "0")}`;

  const cards = [
    { label: "Tổng nhân sự", value: stats.totalUsers, sub: "Đang hoạt động", color: "#1C3FAA", bg: "#EEF2FF", icon: <FaUsers /> },
    { label: "Vắng hôm nay", value: stats.absentToday, sub: "Đang nghỉ phép", color: "#B91C1C", bg: "#FEE2E2", icon: <FaCalendarTimes /> },
    { label: "Đã chấm công", value: stats.checkedIn || 0, sub: "Hôm nay", color: "#059669", bg: "#D1FAE5", icon: <FaClipboardCheck /> },
    { label: "Chờ duyệt", value: stats.pendingLeaves || pending.length, sub: "Đơn nghỉ phép", color: "#B45309", bg: "#FEF3C7", icon: <FaFileAlt /> },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)" }}>Xin chào, {user.full_name || "Admin"}! 👋</div>
        <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 3 }}>Đây là tình hình nhân sự hôm nay.</div>
      </div>

      <div className="stats-grid">
        {cards.map((c, i) => (
          <div key={i} className="stat-card">
            <div className="stat-card-icon" style={{ background: c.bg, color: c.color }}>{c.icon}</div>
            <div className="stat-card-label">{c.label}</div>
            <div className="stat-card-value" style={{ color: c.color }}>{c.value}</div>
            <div className="stat-card-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="table-wrap">
          <div className="table-header">
            <div className="table-title"><FaFileAlt style={{ color: "var(--primary)" }} /> Đơn nghỉ phép chờ duyệt</div>
            <button className="btn btn-sm" onClick={() => navigate("/admin/leaves")}>Xem tất cả →</button>
          </div>
          {loadingPending ? <div style={{ padding: 20, textAlign: "center", color: "var(--text-light)" }}>Đang tải...</div> : (
            <div className="table-wrap-scroll">
              <table>
                <thead><tr><th>Nhân viên</th><th>Thời gian</th><th>Trạng thái</th><th></th></tr></thead>
                <tbody>
                  {pending.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "var(--text-light)" }}>Hiện không có đơn nào chờ duyệt</td></tr>}
                  {pending.map(req => (
                    <tr key={req.id}>
                      <td>
                        <div className="cell-user">
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                            {(req.full_name || req.username || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="cell-name">{req.full_name || req.username}</div>
                            <div className="cell-sub">{formatID(req.user_id)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{new Date(req.start_date).toLocaleDateString("vi-VN")} – {new Date(req.end_date).toLocaleDateString("vi-VN")}</div>
                        <div className="cell-sub">{req.total_days} ngày</div>
                      </td>
                      <td><span className="badge badge-amber">Chờ duyệt</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-success btn-sm btn-icon" onClick={() => handleStatus(req.id, "APPROVED", req.full_name)} title="Duyệt"><FaCheck size={11} /></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleStatus(req.id, "REJECTED", req.full_name)} title="Từ chối"><FaTimes size={11} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
            <FaClipboardCheck style={{ color: "var(--primary)" }} /> Ca làm hôm nay
          </div>

          {shifts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-light)", fontSize: 13 }}>
              Chưa có dữ liệu xếp ca ngày hôm nay.
            </div>
          ) : (
            shifts.map((ca, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{ca.label}</span>
                  <span className={`badge ${ca.ok ? "badge-green" : "badge-amber"}`}>{ca.count}/{ca.max} người</span>
                </div>
                <div style={{ height: 5, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(ca.count / ca.max) * 100}%`, height: "100%", background: ca.ok ? "var(--success)" : "#F59E0B", borderRadius: 3, transition: "width .4s" }} />
                </div>
                {!ca.ok && (
                  <div className="alert-warning" style={{ marginTop: 8, fontSize: 12 }}>
                    <FaExclamationTriangle size={13} /> Ca này thiếu nhân sự — dưới mức tối thiểu
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
export default AdminHome;