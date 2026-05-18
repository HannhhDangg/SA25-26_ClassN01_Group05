import { useState, useEffect, useCallback } from "react";
import { FaHistory, FaCheck, FaTimes } from "react-icons/fa";

const ManagerLeaveHistory = () => {
  const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
  const [leaves, setLeaves] = useState([]);

  // ── State Phân trang & Bộ lọc ──────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState("desc"); // desc: mới nhất -> cũ nhất, asc: cũ nhất -> mới nhất
  const itemsPerPage = 10;

  // Lấy toàn bộ danh sách đơn nghỉ phép của phòng ban gửi tới Manager
  const fetchManagerLeaves = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Điểm tiếp nhận dữ liệu danh sách đơn cần xử lý của Trưởng phòng
      const url = "/api/leave_ser";
      const token = localStorage.getItem("token");
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setLeaves(Array.isArray(d) ? d : []);
      }
    } catch {
      console.error("Lỗi tải danh sách quản lý nghỉ phép");
    }
  }, [user?.id]);

  useEffect(() => {
    fetchManagerLeaves();
  }, [fetchManagerLeaves]);

  // Xử lý cập nhật trạng thái đơn (Duyệt / Từ chối)
  const handleUpdateStatus = async (id, status) => {
    const actionText = status === "APPROVED" ? "DUYỆT" : "TỪ CHỐI";
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} đơn nghỉ phép này không?`)) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/leave_ser/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchManagerLeaves(); // Tải lại danh sách để đồng bộ số liệu và trạng thái mới
      }
    } catch {
      console.error("Lỗi cập nhật trạng thái đơn");
    }
  };

  // ════ LOGIC BỘ LỌC SẮP XẾP (Theo thời gian gửi đơn created_at) ════
  const sortedLeaves = [...leaves].sort((a, b) => {
    const dateA = new Date(a.created_at || a.start_date);
    const dateB = new Date(b.created_at || b.start_date);
    return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
  });

  // ════ LOGIC PHÂN TRANG (10 ĐƠN / TRANG) ════
  const totalPages = Math.ceil(sortedLeaves.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLeaves = sortedLeaves.slice(indexOfFirstItem, indexOfLastItem);

  const statusBadge = s => {
    if (s === "APPROVED") return <span style={{ padding: "6px 12px", borderRadius: 20, background: "#d1fae5", color: "#065f46", fontSize: 13, fontWeight: 600 }}>✅ Đã duyệt</span>;
    if (s === "REJECTED") return <span style={{ padding: "6px 12px", borderRadius: 20, background: "#fee2e2", color: "#991b1b", fontSize: 13, fontWeight: 600 }}>❌ Từ chối</span>;
    return <span style={{ padding: "6px 12px", borderRadius: 20, background: "#fef3c7", color: "#92400e", fontSize: 13, fontWeight: 600 }}>⏳ Chờ duyệt</span>;
  };

  return (
    <div style={{ padding: "20px", maxWidth: 1200, margin: "0 auto" }}>

      {/* ── Tiêu đề & Bộ lọc Sắp xếp ────────────────────────────────── */}
      <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", marginBottom: 30, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <FaHistory style={{ color: "var(--primary)" }} /> Lịch Sử & Duyệt Nghỉ Phép
        </div>

        {/* Thanh điều hướng bộ lọc thời gian */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 500 }}>
          <span style={{ color: "#64748B" }}>Bộ lọc:</span>
          <select
            value={sortOrder}
            onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#fff", cursor: "pointer", fontWeight: 600, color: "#1E293B", outline: "none" }}
          >
            <option value="desc">🆕 Mới nhất đến cũ nhất</option>
            <option value="asc">⏳ Cũ nhất đến mới nhất</option>
          </select>
        </div>
      </div>

      {/* ── Bảng Dữ Liệu ─────────────────────────────────────────── */}
      <div style={{ background: "white", borderRadius: 16, padding: "30px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
        {currentLeaves.length === 0
          ? <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-light)", fontSize: 16 }}>Không có đơn xin nghỉ phép nào cần xử lý.</div>
          : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                      <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569" }}>Nhân viên</th>
                      <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569" }}>Thời gian nghỉ</th>
                      <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569" }}>Lý do</th>
                      <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569", textAlign: "center" }}>Số ngày</th>
                      <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569" }}>Trạng thái</th>
                      <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569" }}>Ngày gửi</th>
                      <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569", textAlign: "center" }}>Tác vụ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentLeaves.map(l => (
                      <tr key={l.id} style={{ borderBottom: "1px solid #F1F5F9", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

                        {/* Hiển thị thông tin nhân viên gửi đơn */}
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ fontWeight: 600, color: "#1E293B", fontSize: 15 }}>{l.full_name || l.username || `ID: ${l.user_id}`}</div>
                        </td>

                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ fontWeight: 600, color: "#1E293B", fontSize: 15 }}>{new Date(l.start_date).toLocaleDateString("vi-VN")}</div>
                          <div style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>đến {new Date(l.end_date).toLocaleDateString("vi-VN")}</div>
                        </td>
                        <td style={{ padding: "16px 20px", maxWidth: 250, color: "#334155", fontSize: 15, lineHeight: 1.5 }}>{l.reason}</td>
                        <td style={{ padding: "16px 20px", fontWeight: 700, color: "#0F172A", textAlign: "center", fontSize: 16 }}>{l.total_days}</td>
                        <td style={{ padding: "16px 20px" }}>{statusBadge(l.status)}</td>
                        <td style={{ padding: "16px 20px", fontSize: 14, color: "#64748B" }}>{new Date(l.created_at).toLocaleDateString("vi-VN")}</td>

                        {/* Cột xử lý chức năng Duyệt/Từ chối của Trưởng phòng */}
                        <td style={{ padding: "16px 20px", textAlign: "center" }}>
                          {l.status === "PENDING" ? (
                            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                              <button
                                onClick={() => handleUpdateStatus(l.id, "APPROVED")}
                                style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", background: "#10B981", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "opacity 0.2s" }}
                                onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                              >
                                <FaCheck size={11} /> Duyệt
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(l.id, "REJECTED")}
                                style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", background: "#EF4444", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "opacity 0.2s" }}
                                onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                              >
                                <FaTimes size={11} /> Từ chối
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "#94A3B8", fontSize: 13, fontStyle: "italic" }}>Hoàn thành</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Thanh Điều Hướng Phân Trang ──────────────────────────────── */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 30 }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #CBD5E1", background: currentPage === 1 ? "#F1F5F9" : "white", color: currentPage === 1 ? "#94A3B8" : "#1E293B", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14 }}
                  >
                    Trước
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "1px solid " + (currentPage === page ? "var(--primary)" : "#CBD5E1"),
                        background: currentPage === page ? "var(--primary)" : "white",
                        color: currentPage === page ? "white" : "#1E293B",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 14
                      }}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #CBD5E1", background: currentPage === totalPages ? "#F1F5F9" : "white", color: currentPage === totalPages ? "#94A3B8" : "#1E293B", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14 }}
                  >
                    Sau
                  </button>
                </div>
              )}
            </>
          )
        }
      </div>
    </div>
  );
};

export default ManagerLeaveHistory;