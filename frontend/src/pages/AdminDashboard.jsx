import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { FaCalendarAlt, FaSearch, FaSync, FaCheck, FaTimes, FaAngleLeft, FaAngleRight } from "react-icons/fa";

const TABS = ["Tất cả", "Chờ duyệt", "Đã duyệt", "Từ chối"];
const ITEMS_PER_PAGE = 10; // Giới hạn 10 đơn trên 1 trang

const AdminDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Tất cả");

  const [currentPage, setCurrentPage] = useState(1);

  // 🔥 LẤY TOKEN ĐỂ CHỨNG MINH DANH TÍNH VỚI BACKEND
  const token = localStorage.getItem("token");

  const formatID = id => `HD${String(id).padStart(2, "0")}`;

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // 🔥 ĐÍNH KÈM TOKEN VÀO ĐÂY ĐỂ KHÔNG BỊ LỖI 401 UNAUTHORIZED NỮA
      const res = await fetch("/api/leave_ser", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch { toast.error("Không thể tải dữ liệu!"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchRequests();
    const socket = io("/", { transports: ["websocket", "polling"], upgrade: true });
    socket.on("new_leave_request", data => { fetchRequests(); });
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search]);

  const handleStatus = async (id, status, name) => {
    const label = status === "APPROVED" ? "DUYỆT" : "TỪ CHỐI";
    if (!window.confirm(`Xác nhận ${label} đơn của ${name}?`)) return;
    try {
      // 🔥 ĐÍNH KÈM TOKEN VÀO ĐÂY ĐỂ CÓ QUYỀN DUYỆT ĐƠN
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
        fetchRequests();
      }
      else toast.error("Lỗi xử lý!");
    } catch { toast.error("Lỗi kết nối!"); }
  };

  const filtered = requests.filter(r => {
    const term = search.toLowerCase();
    const matchSearch =
      (r.full_name?.toLowerCase() || "").includes(term) ||
      (r.username?.toLowerCase() || "").includes(term) ||
      formatID(r.user_id).toLowerCase().includes(term);
    const matchTab =
      activeTab === "Tất cả" ? true :
        activeTab === "Chờ duyệt" ? r.status === "PENDING" :
          activeTab === "Đã duyệt" ? r.status === "APPROVED" :
            r.status === "REJECTED";
    return matchSearch && matchTab;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);

  const counts = {
    "Tất cả": requests.length,
    "Chờ duyệt": requests.filter(r => r.status === "PENDING").length,
    "Đã duyệt": requests.filter(r => r.status === "APPROVED").length,
    "Từ chối": requests.filter(r => r.status === "REJECTED").length,
  };

  const statusBadge = s => {
    if (s === "APPROVED") return <span className="badge badge-green">Đã duyệt</span>;
    if (s === "REJECTED") return <span className="badge badge-red">Từ chối</span>;
    return <span className="badge badge-amber">Chờ duyệt</span>;
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <FaCalendarAlt style={{ color: "var(--primary)" }} /> Quản lý Đơn Nghỉ Phép
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="search-box">
            <FaSearch />
            <input placeholder="Tìm mã NV, tên..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-sm" onClick={fetchRequests}><FaSync size={12} /> Làm mới</button>
        </div>
      </div>

      <div className="tab-bar">
        {TABS.map(tab => (
          <button key={tab} className={`tab-item${activeTab === tab ? " active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab} ({counts[tab]})
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-light)" }}>Đang tải dữ liệu...</div> : (
          <div className="table-wrap-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Lý do &amp; Thời gian</th>
                  <th>Số ngày</th>
                  <th>Trạng thái</th>
                  <th>Thời gian duyệt</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-light)" }}>
                    {search ? "Không tìm thấy kết quả." : "Không có đơn nào."}
                  </td></tr>
                )}
                {currentItems.map(req => (
                  <tr key={req.id}>
                    <td>
                      <div className="cell-user">
                        <img src={req.avatar_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} onError={e => { e.target.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png" }} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }} alt="" />
                        <div>
                          <div className="cell-name">{req.full_name || req.username}</div>
                          <div className="id-chip">{formatID(req.user_id)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{req.reason}</div>
                      <div className="cell-sub">
                        {new Date(req.start_date).toLocaleDateString("vi-VN")} – {new Date(req.end_date).toLocaleDateString("vi-VN")}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--text)" }}>{req.total_days}</td>
                    <td>{statusBadge(req.status)}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
                      {req.approved_at ? new Date(req.approved_at).toLocaleString("vi-VN") : <span style={{ color: "var(--text-light)" }}>—</span>}
                    </td>
                    <td>
                      {req.status === "PENDING" ? (
                        <div style={{ display: "flex", gap: 5 }}>
                          <button className="btn btn-success btn-sm" onClick={() => handleStatus(req.id, "APPROVED", req.full_name)}><FaCheck size={11} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleStatus(req.id, "REJECTED", req.full_name)}><FaTimes size={11} /></button>
                        </div>
                      ) : <span style={{ fontSize: 12, color: "var(--text-light)" }}>Đã xử lý</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > ITEMS_PER_PAGE && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, padding: "0 4px" }}>
          <div style={{ fontSize: 13, color: "var(--text-sub)" }}>
            Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, filtered.length)}</b> trong tổng số <b>{filtered.length}</b> đơn
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="btn btn-sm"
              style={{ padding: "6px 10px", display: "flex", alignItems: "center", background: currentPage === 1 ? "var(--bg-page)" : "#fff", cursor: currentPage === 1 ? "not-allowed" : "pointer", border: "1px solid var(--border)" }}
            >
              <FaAngleLeft size={14} /> Trước
            </button>

            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", padding: "0 8px" }}>
              Trang {currentPage} / {totalPages}
            </span>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="btn btn-sm"
              style={{ padding: "6px 10px", display: "flex", alignItems: "center", background: currentPage === totalPages ? "var(--bg-page)" : "#fff", cursor: currentPage === totalPages ? "not-allowed" : "pointer", border: "1px solid var(--border)" }}
            >
              Sau <FaAngleRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminDashboard;