import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { FaCalendarAlt, FaPlus, FaHistory, FaPaperPlane, FaTasks, FaCheck, FaTimes } from "react-icons/fa";

const LeavePage = () => {
  const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
  const token = localStorage.getItem("token");
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.defaultTab || "new");

  // State chứa ĐƠN CỦA TÔI
  const [myLeaves, setMyLeaves] = useState([]);

  // State chứa ĐƠN CHỜ DUYỆT (Dành cho Sếp)
  const [pendingLeaves, setPendingLeaves] = useState([]);

  const [totalDays, setTotalDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ reason: "", start_date: "", end_date: "" });

  const formatID = id => `HD${String(id).padStart(2, "0")}`;

  // Tải danh sách đơn cá nhân
  const fetchMyLeaves = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/leave_ser/${user.id}`, { headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setMyLeaves(Array.isArray(d) ? d : []); }
    } catch { console.error("Lỗi tải lịch sử"); }
  }, [user?.id, token]);

  // Tải danh sách đơn chờ duyệt
  const fetchPendingLeaves = useCallback(async () => {
    if (user.role === "STAFF" || !user.role) return;
    try {
      const res = await fetch("/api/leave_ser", { headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        // Lọc hiển thị những đơn đang Pending
        setPendingLeaves(Array.isArray(d) ? d.filter(l => l.status === "PENDING") : []);
      }
    } catch { console.error("Lỗi tải danh sách duyệt đơn"); }
  }, [user.role, token]);

  useEffect(() => {
    fetchMyLeaves();
    fetchPendingLeaves();
  }, [fetchMyLeaves, fetchPendingLeaves]);

  useEffect(() => {
    const socket = io("/", { transports: ["websocket", "polling"], upgrade: true });

    // Nghe thông báo có đơn mới -> Load lại bảng duyệt đơn
    socket.on("new_leave_request", data => {
      fetchPendingLeaves();
    });

    // Nghe thông báo sếp đã duyệt đơn của mình -> Load lại lịch sử cá nhân
    socket.on("leave_status_update", data => {
      if (String(data.target_user_id) === String(user.id)) {
        data.status === "APPROVED" ? toast.success(data.message) : data.status === "REJECTED" ? toast.error(data.message) : toast.info(data.message);
        fetchMyLeaves();
      }
    });

    return () => socket.disconnect();
  }, [fetchMyLeaves, fetchPendingLeaves, user.id]);

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
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ user_id: user.id, ...formData, total_days: totalDays })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Gửi đơn xin nghỉ thành công! 🚀");
        setFormData({ reason: "", start_date: "", end_date: "" });
        setTotalDays(0);
        fetchMyLeaves();
        setTab("history");
      } else toast.error(data.message || "Lỗi gửi đơn");
    } catch { toast.error("Lỗi kết nối server"); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id, status, name) => {
    if (!window.confirm(`Xác nhận ${status === "APPROVED" ? "DUYỆT" : "TỪ CHỐI"} đơn của ${name}?`)) return;
    try {
      const res = await fetch(`/api/leave_ser/${id}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Đã ${status === "APPROVED" ? "duyệt" : "từ chối"} thành công!`);
        fetchPendingLeaves();
      } else {
        toast.error("Lỗi xử lý từ Server!");
      }
    } catch (error) { toast.error("Lỗi kết nối mạng!"); }
  };

  const statusBadge = s => {
    if (s === "APPROVED") return <span className="badge badge-green">Đã duyệt</span>;
    if (s === "REJECTED") return <span className="badge badge-red">Từ chối</span>;
    return <span className="badge badge-amber">Chờ duyệt</span>;
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "10px 20px" }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", marginBottom: 25, display: "flex", alignItems: "center", gap: 12 }}>
        <FaCalendarAlt style={{ color: "var(--primary)" }} /> Quản lý Nghỉ phép
      </div>

      <div style={{ display: "flex", gap: 15, marginBottom: 30, borderBottom: "2px solid #E2E8F0", paddingBottom: 10 }}>
        <button
          onClick={() => setTab("new")}
          style={{
            background: tab === "new" ? "var(--primary)" : "transparent",
            color: tab === "new" ? "white" : "var(--text-sub)",
            border: "none", padding: "12px 24px", borderRadius: 8,
            fontSize: 16, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s"
          }}
        >
          <FaPlus /> Tạo đơn mới
        </button>
        <button
          onClick={() => setTab("history")}
          style={{
            background: tab === "history" ? "var(--primary)" : "transparent",
            color: tab === "history" ? "white" : "var(--text-sub)",
            border: "none", padding: "12px 24px", borderRadius: 8,
            fontSize: 16, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s"
          }}
        >
          <FaHistory /> Đơn của tôi ({myLeaves.length})
        </button>

        {/* Tab đặc quyền hiển thị riêng cho Sếp để xét duyệt đơn */}
        {(user.role === "MANAGER" || user.role === "SUPERADMIN") && (
          <button
            onClick={() => setTab("approval")}
            style={{
              background: tab === "approval" ? "var(--primary)" : "transparent",
              color: tab === "approval" ? "white" : "var(--text-sub)",
              border: "none", padding: "12px 24px", borderRadius: 8,
              fontSize: 16, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s"
            }}
          >
            <FaTasks /> Chờ duyệt ({pendingLeaves.length})
          </button>
        )}
      </div>

      {/* CONTENT: TẠO ĐƠN MỚI */}
      {tab === "new" && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 750, background: "white", padding: "40px", borderRadius: 16, boxShadow: "0 10px 25px rgba(0,0,0,0.08)", border: "1px solid #F1F5F9" }}>
            <div style={{ textAlign: "center", marginBottom: 30 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--primary)" }}>📝 Mẫu Đơn Xin Nghỉ Phép</div>
              <div style={{ fontSize: 15, color: "var(--text-sub)", marginTop: 8 }}>Vui lòng điền đầy đủ thông tin bên dưới</div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <label style={{ display: "block", fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#334155" }}>
                  Lý do xin nghỉ <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input required placeholder="VD: Nghỉ ốm, Có việc gia đình..." value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} style={{ width: "100%", padding: "14px 16px", fontSize: 16, borderRadius: 10, border: "2px solid #E2E8F0", outline: "none" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <label style={{ display: "block", fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#334155" }}>Từ ngày <span style={{ color: "#DC2626" }}>*</span></label>
                  <input required type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} style={{ width: "100%", padding: "14px 16px", fontSize: 16, borderRadius: 10, border: "2px solid #E2E8F0", outline: "none", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#334155" }}>Đến hết ngày <span style={{ color: "#DC2626" }}>*</span></label>
                  <input required type="date" value={formData.end_date} min={formData.start_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} style={{ width: "100%", padding: "14px 16px", fontSize: 16, borderRadius: 10, border: "2px solid #E2E8F0", outline: "none", fontFamily: "inherit" }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC", padding: "20px 24px", borderRadius: 12, border: "1px dashed #CBD5E1" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>
                  Tổng thời gian: <span style={{ color: totalDays > 0 ? "#EF4444" : "#94A3B8", fontWeight: 800, fontSize: 24, marginLeft: 8 }}>{totalDays}</span> ngày
                </div>
                <button type="submit" disabled={loading || totalDays <= 0} className="btn-primary" style={{ background: (loading || totalDays <= 0) ? "#94A3B8" : "var(--primary)" }}>
                  <FaPaperPlane /> {loading ? "Đang xử lý..." : "Gửi Đơn"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTENT: LỊCH SỬ ĐƠN CÁ NHÂN */}
      {tab === "history" && (
        <div style={{ background: "white", borderRadius: 16, padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
          {myLeaves.length === 0 ? <div style={{ padding: "60px", textAlign: "center" }}>Bạn chưa gửi đơn nào.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                  <th style={{ padding: "16px" }}>Thời gian nghỉ</th><th style={{ padding: "16px" }}>Lý do</th><th style={{ padding: "16px" }}>Số ngày</th><th style={{ padding: "16px" }}>Trạng thái</th><th style={{ padding: "16px" }}>Ngày gửi</th>
                </tr>
              </thead>
              <tbody>
                {myLeaves.map(l => (
                  <tr key={l.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "16px", fontWeight: 600 }}>{new Date(l.start_date).toLocaleDateString("vi-VN")} đến {new Date(l.end_date).toLocaleDateString("vi-VN")}</td>
                    <td style={{ padding: "16px" }}>{l.reason}</td>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{l.total_days}</td>
                    <td style={{ padding: "16px" }}>{statusBadge(l.status)}</td>
                    <td style={{ padding: "16px" }}>{new Date(l.created_at).toLocaleDateString("vi-VN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* CONTENT: MÀN HÌNH XÉT DUYỆT CỦA SẾP */}
      {tab === "approval" && (
        <div style={{ background: "white", borderRadius: 16, padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
          {pendingLeaves.length === 0 ? <div style={{ padding: "60px", textAlign: "center" }}>Hiện không có đơn nào đang chờ duyệt.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                  <th style={{ padding: "16px" }}>Người gửi</th><th style={{ padding: "16px" }}>Thời gian</th><th style={{ padding: "16px" }}>Lý do</th><th style={{ padding: "16px", textAlign: "center" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {pendingLeaves.map(req => (
                  <tr key={req.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "16px" }}>
                      <div style={{ fontWeight: 600 }}>{req.full_name || req.username}</div>
                      <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{formatID(req.user_id)}</div>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ fontWeight: 600 }}>{new Date(req.start_date).toLocaleDateString("vi-VN")} - {new Date(req.end_date).toLocaleDateString("vi-VN")}</div>
                      <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{req.total_days} ngày</div>
                    </td>
                    <td style={{ padding: "16px", maxWidth: 200 }}>{req.reason}</td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <button className="btn btn-success btn-sm btn-icon" onClick={() => handleApprove(req.id, "APPROVED", req.full_name)} style={{ marginRight: 8 }}><FaCheck /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleApprove(req.id, "REJECTED", req.full_name)}><FaTimes /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default LeavePage;