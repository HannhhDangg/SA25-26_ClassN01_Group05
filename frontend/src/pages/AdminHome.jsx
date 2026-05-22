import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { FaUsers, FaCalendarTimes, FaClipboardCheck, FaFileAlt, FaCheck, FaTimes, FaExclamationTriangle, FaUserTie } from "react-icons/fa";

const AdminHome = () => {
  const navigate = useNavigate();
  const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
  const token = localStorage.getItem("token");

  // State cho phần Quản lý
  const [stats, setStats] = useState({ totalUsers: 0, absentToday: 0, checkedIn: 0, pendingLeaves: 0 });
  const [pending, setPending] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [shifts, setShifts] = useState([]);

  // State Dành cho thông tin cá nhân của Manager
  const [myProfile, setMyProfile] = useState(null);
  const [myLeaves, setMyLeaves] = useState([]);

  // 🔥 1. GỘP CHUNG HÀM LẤY VÀ TÍNH TOÁN 4 CHỈ SỐ THEO ĐÚNG QUY TẮC
  const fetchDashboardData = async () => {
    setLoadingPending(true);
    try {
      const headers = { "Authorization": `Bearer ${token}` };

      // Gọi API lấy toàn bộ dữ liệu (Users, Đơn phép, Thống kê cũ)
      const [resUsers, resLeaves, resStats] = await Promise.all([
        fetch("/api/auth_ser/users", { headers }),
        fetch("/api/leave_ser", { headers }),
        fetch("/api/leave_ser/stats/admin-summary", { headers })
      ]);

      const allUsers = resUsers.ok ? await resUsers.json() : [];
      const allLeaves = resLeaves.ok ? await resLeaves.json() : [];
      const backendStats = resStats.ok ? await resStats.json() : {};

      // LỌC NGHIÊM NGẶT THEO QUY TẮC PHÒNG BAN
      const isSuperAdmin = user.role === "SUPERADMIN" || user.role === "ADMIN";
      const isManager = user.role === "MANAGER";

      const validUsers = Array.isArray(allUsers) ? allUsers.filter(u => {
        if (isSuperAdmin) return true; // Giám đốc: Thấy tất cả
        if (isManager) {
          // Trưởng phòng: Thấy bản thân HOẶC người cùng phòng
          return String(u.id) === String(user.id) || (u.department_id && String(u.department_id) === String(user.department_id));
        }
        return String(u.id) === String(user.id);
      }) : [];

      // Lấy danh sách ID hợp lệ để lọc đơn nghỉ phép
      const validUserIds = validUsers.map(u => String(u.id));
      const validLeaves = Array.isArray(allLeaves) ? allLeaves.filter(l => validUserIds.includes(String(l.user_id))) : [];

      // TÍNH TOÁN 4 CON SỐ HIỂN THỊ
      const totalUsers = validUsers.length;

      // Đếm Vắng hôm nay
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let absentToday = 0;
      validLeaves.forEach(l => {
        if (l.status === "APPROVED") {
          const start = new Date(l.start_date); start.setHours(0, 0, 0, 0);
          const end = new Date(l.end_date); end.setHours(23, 59, 59, 999);
          if (today >= start && today <= end) absentToday++;
        }
      });

      // 🔥 LỌC CHỜ DUYỆT CHUẨN QUY TẮC HỆ THỐNG:
      const pendingList = validLeaves.filter(l => {
        if (l.status !== "PENDING") return false;

        const leaveOwner = validUsers.find(u => String(u.id) === String(l.user_id));
        if (!leaveOwner) return false;

        if (isSuperAdmin) {
          // Giám đốc CHỈ thấy đơn của Trưởng phòng (MANAGER)
          return leaveOwner.role === "MANAGER";
        }
        if (isManager) {
          // Trưởng phòng CHỈ thấy đơn của nhân viên phòng mình (Tuyệt đối không lấy đơn của chính mình)
          return String(leaveOwner.id) !== String(user.id);
        }
        return false;
      });

      setPending(pendingList.slice(0, 5));

      setStats({
        totalUsers: totalUsers,
        absentToday: absentToday,
        checkedIn: backendStats.checkedIn || 0,
        pendingLeaves: pendingList.length
      });

    } catch (error) {
      console.error("Lỗi tải dữ liệu dashboard:", error);
    } finally {
      setLoadingPending(false);
    }
  };

  // 🔥 2. API Lấy thông tin cá nhân (Chỉ lấy nếu là MANAGER)
  const fetchMyPersonalData = async () => {
    // Nếu là SUPERADMIN thì chặn đứng, không cần gọi API mất công
    if (user.role === "SUPERADMIN" || user.role === "ADMIN") return;

    try {
      const userRes = await fetch("/api/auth_ser/users", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (userRes.ok) {
        const usersList = await userRes.json();
        const me = usersList.find(u => String(u.id) === String(user.id));
        if (me) setMyProfile(me);
      }

      const leaveRes = await fetch(`/api/leave_ser/${user.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (leaveRes.ok) {
        const leavesData = await leaveRes.json();
        setMyLeaves(leavesData);
      }
    } catch (e) {
      console.error("Lỗi lấy dữ liệu cá nhân:", e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchMyPersonalData();

    const socket = io("/", { transports: ["websocket", "polling"], upgrade: true });
    socket.on("new_leave_request", data => {
      fetchDashboardData();
    });
    // Lắng nghe thêm việc đơn bị đổi trạng thái để load lại lịch sử cá nhân (nếu là manager)
    socket.on("leave_status_update", data => {
      fetchDashboardData();
      fetchMyPersonalData();
    });
    return () => socket.disconnect();
  }, []);

  const handleStatus = async (id, status, name) => {
    if (!window.confirm(`Xác nhận ${status === "APPROVED" ? "DUYỆT" : "TỪ CHỐI"} đơn của ${name}?`)) return;
    try {
      const res = await fetch(`/api/leave_ser/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        toast.success(`Đã ${status === "APPROVED" ? "duyệt" : "từ chối"} thành công!`);
        setPending(prevPending => prevPending.filter(req => req.id !== id));
        fetchDashboardData();
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
    { label: "Chờ duyệt", value: stats.pendingLeaves, sub: "Đơn nghỉ phép", color: "#B45309", bg: "#FEF3C7", icon: <FaFileAlt /> },
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
            <div className="table-wrap-scroll" style={{ maxHeight: 300 }}>
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

      {/* 🔥 CHỈ HIỂN THỊ KHU VỰC NÀY NẾU LÀ MANAGER 🔥 */}
      {user.role === "MANAGER" && (
        <div className="two-col" style={{ marginTop: 20 }}>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
              <FaUserTie style={{ color: "var(--primary)" }} /> Hồ sơ cá nhân của tôi
            </div>

            <div style={{ display: "flex", gap: 15 }}>
              <div style={{ flex: 1, padding: "16px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 500 }}>Lương cơ bản</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--primary)", marginTop: 6 }}>
                  {myProfile?.base_salary ? Number(myProfile.base_salary).toLocaleString("vi-VN") + " ₫" : "Chưa thiết lập"}
                </div>
              </div>

              <div style={{ flex: 1, padding: "16px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 500 }}>Quỹ phép tiêu chuẩn</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--primary)", marginTop: 6 }}>
                  {myProfile?.max_leave_days || 12} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-light)" }}>ngày / năm</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex-between" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 7 }}>
                <FaFileAlt style={{ color: "var(--primary)" }} /> Lịch sử đơn của tôi
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate("/admin/leaves/new")}>
                + Tạo đơn mới
              </button>
            </div>

            <div className="table-wrap-scroll" style={{ maxHeight: 150, border: "1px solid var(--border)", borderRadius: 8 }}>
              {myLeaves.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-light)", fontSize: 13 }}>
                  Bạn chưa gửi đơn nghỉ phép nào.
                </div>
              ) : (
                <table style={{ width: "100%", textAlign: "left", fontSize: 13, borderCollapse: "collapse" }}>
                  <tbody>
                    {myLeaves.map((req, idx) => (
                      <tr key={req.id} style={{ borderBottom: idx !== myLeaves.length - 1 ? "1px solid #E2E8F0" : "none" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text)" }}>
                          {new Date(req.start_date).toLocaleDateString("vi-VN")} - {new Date(req.end_date).toLocaleDateString("vi-VN")}
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-sub)" }}>{req.total_days} ngày</td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          {req.status === "APPROVED" ? <span className="badge badge-green">Đã duyệt</span> :
                            req.status === "REJECTED" ? <span className="badge badge-red">Từ chối</span> :
                              <span className="badge badge-amber">Chờ duyệt</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHome;