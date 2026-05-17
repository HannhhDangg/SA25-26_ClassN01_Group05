import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { FaCalendarAlt, FaPlus, FaHistory } from "react-icons/fa";

const LeavePage = () => {
  const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.defaultTab || "new");
  const [leaves, setLeaves] = useState([]);
  const [totalDays, setTotalDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ reason: "", start_date: "", end_date: "" });

  useEffect(() => {
    if (location.state?.defaultTab) {
      setTab(location.state.defaultTab);
    }
  }, [location.state?.defaultTab]);

  const fetchLeaves = useCallback(async () => {
    if (!user?.id) return;
    try {
      const url = user.role === "STAFF" || user.role === "MANAGER"
        ? `/api/leave_ser/${user.id}`
        : `/api/users/${user.id}`;
      const res = await fetch(url);
      if (res.ok) { const d = await res.json(); setLeaves(Array.isArray(d) ? d : []); }
    } catch { console.error("Lỗi tải lịch sử"); }
  }, [user?.id, user?.role]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  useEffect(() => {
    const socket = io("/", { transports: ["websocket", "polling"], upgrade: true });
    socket.on("leave_status_update", data => {
      if (data.target_user_id == user.id) {
        data.status === "APPROVED" ? toast.success(data.message) : data.status === "REJECTED" ? toast.error(data.message) : toast.info(data.message);
        fetchLeaves();
      }
    });
    return () => socket.disconnect();
  }, [fetchLeaves, user.id]);

  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const diff = Math.ceil((new Date(formData.end_date) - new Date(formData.start_date)) / (1000 * 60 * 60 * 24)) + 1;
      setTotalDays(diff > 0 ? diff : 0);
    } else setTotalDays(0);
  }, [formData.start_date, formData.end_date]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (totalDays <= 0) return toast.warning("Ngày kết thúc phải hợp lệ!");
    setLoading(true);
    try {
      const res = await fetch("/api/leave_ser", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, ...formData, total_days: totalDays })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Gửi đơn thành công! 🚀");
        setFormData({ reason: "", start_date: "", end_date: "" });
        setTotalDays(0);
        fetchLeaves();
        setTab("history");
      } else toast.error(data.message || "Lỗi gửi đơn");
    } catch { toast.error("Lỗi kết nối server"); }
    finally { setLoading(false); }
  };

  const statusBadge = s => {
    if (s === "APPROVED") return <span className="badge badge-green">✅ Đã duyệt</span>;
    if (s === "REJECTED") return <span className="badge badge-red">❌ Từ chối</span>;
    return <span className="badge badge-amber">⏳ Chờ duyệt</span>;
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
        <FaCalendarAlt style={{ color: "var(--primary)" }} /> Quản lý Nghỉ phép
      </div>

      <div className="tab-bar">
        <button className={`tab-item${tab === "new" ? " active" : ""}`} onClick={() => setTab("new")}>
          <FaPlus size={11} /> Tạo đơn mới
        </button>
        <button className={`tab-item${tab === "history" ? " active" : ""}`} onClick={() => setTab("history")}>
          <FaHistory size={11} /> Lịch sử đơn ({leaves.length})
        </button>
      </div>

      {tab === "new" && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--primary)", marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
            📝 Tạo Đơn Xin Nghỉ Mới
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Lý do nghỉ <span style={{ color: "#DC2626" }}>*</span></label>
              <input className="form-control" required placeholder="VD: Nghỉ ốm, Việc gia đình..." value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Từ ngày <span style={{ color: "#DC2626" }}>*</span></label>
                <input className="form-control" required type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Đến ngày <span style={{ color: "#DC2626" }}>*</span></label>
                <input className="form-control" required type="date" value={formData.end_date} min={formData.start_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-page)", padding: "12px 16px", borderRadius: "var(--r-md)", marginTop: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                Tổng số ngày nghỉ:{" "}
                <span style={{ color: totalDays > 0 ? "#EF4444" : "var(--text-light)", fontWeight: 700, fontSize: 18 }}>{totalDays}</span>
                <span style={{ color: "var(--text-sub)", fontSize: 13 }}> ngày</span>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading || totalDays <= 0}>
                {loading ? "Đang gửi..." : "🚀 Gửi Đơn Ngay"}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === "history" && (
        <div className="table-wrap">
          {leaves.length === 0
            ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-light)" }}>Bạn chưa có đơn nghỉ phép nào.</div>
            : (
              <div className="table-wrap-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Lý do</th>
                      <th>Số ngày</th>
                      <th>Trạng thái</th>
                      <th>Ngày gửi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map(l => (
                      <tr key={l.id}>
                        <td style={{ fontSize: 13 }}>
                          <div style={{ fontWeight: 500 }}>{new Date(l.start_date).toLocaleDateString("vi-VN")}</div>
                          <div className="cell-sub">đến {new Date(l.end_date).toLocaleDateString("vi-VN")}</div>
                        </td>
                        <td style={{ maxWidth: 240, fontSize: 13 }}>{l.reason}</td>
                        <td style={{ fontWeight: 600 }}>{l.total_days}</td>
                        <td>{statusBadge(l.status)}</td>
                        <td style={{ fontSize: 12, color: "var(--text-sub)" }}>{new Date(l.created_at).toLocaleDateString("vi-VN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}
    </div>
  );
};
export default LeavePage;