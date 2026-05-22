import { useState, useEffect, useCallback } from "react";
import { FaHistory, FaAngleLeft, FaAngleRight } from "react-icons/fa";

const ITEMS_PER_PAGE = 10; // Giới hạn 10 đơn trên 1 trang

const LeaveHistory = () => {
    const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
    const [leaves, setLeaves] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchLeaves = useCallback(async () => {
        if (!user?.id) return;
        try {
            const token = localStorage.getItem("token"); // Bổ sung Token bảo mật
            const url = user.role === "STAFF" || user.role === "MANAGER"
                ? `/api/leave_ser/${user.id}`
                : `/api/users/${user.id}`;
            const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
            if (res.ok) {
                const d = await res.json();
                setLeaves(Array.isArray(d) ? d : []);
            }
        } catch { console.error("Lỗi tải lịch sử"); }
    }, [user?.id, user?.role]);

    useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

    const statusBadge = s => {
        if (s === "APPROVED") return <span style={{ padding: "6px 12px", borderRadius: 20, background: "#d1fae5", color: "#065f46", fontSize: 13, fontWeight: 600 }}>✅ Đã duyệt</span>;
        if (s === "REJECTED") return <span style={{ padding: "6px 12px", borderRadius: 20, background: "#fee2e2", color: "#991b1b", fontSize: 13, fontWeight: 600 }}>❌ Từ chối</span>;
        return <span style={{ padding: "6px 12px", borderRadius: 20, background: "#fef3c7", color: "#92400e", fontSize: 13, fontWeight: 600 }}>⏳ Chờ duyệt</span>;
    };

    // --- LOGIC PHÂN TRANG ---
    const totalPages = Math.ceil(leaves.length / ITEMS_PER_PAGE) || 1;
    const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
    const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
    const currentLeaves = leaves.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div style={{ padding: "20px", maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", marginBottom: 30, display: "flex", alignItems: "center", gap: 12 }}>
                <FaHistory style={{ color: "var(--primary)" }} /> Lịch Sử Xin Nghỉ Phép Của Tôi
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: "30px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
                {leaves.length === 0
                    ? <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-light)", fontSize: 16 }}>Bạn chưa gửi đơn nghỉ phép nào.</div>
                    : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                <thead>
                                    <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                                        <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569" }}>Thời gian nghỉ</th>
                                        <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569" }}>Lý do</th>
                                        <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569", textAlign: "center" }}>Số ngày</th>
                                        <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569" }}>Trạng thái</th>
                                        <th style={{ padding: "16px 20px", fontWeight: 600, color: "#475569" }}>Ngày gửi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentLeaves.map(l => (
                                        <tr key={l.id} style={{ borderBottom: "1px solid #F1F5F9", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <td style={{ padding: "16px 20px" }}>
                                                <div style={{ fontWeight: 600, color: "#1E293B", fontSize: 15 }}>{new Date(l.start_date).toLocaleDateString("vi-VN")}</div>
                                                <div style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>đến {new Date(l.end_date).toLocaleDateString("vi-VN")}</div>
                                            </td>
                                            <td style={{ padding: "16px 20px", maxWidth: 350, color: "#334155", fontSize: 15, lineHeight: 1.5 }}>{l.reason}</td>
                                            <td style={{ padding: "16px 20px", fontWeight: 700, color: "#0F172A", textAlign: "center", fontSize: 16 }}>{l.total_days}</td>
                                            <td style={{ padding: "16px 20px" }}>{statusBadge(l.status)}</td>
                                            <td style={{ padding: "16px 20px", fontSize: 14, color: "#64748B" }}>{new Date(l.created_at).toLocaleDateString("vi-VN")}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* THANH PHÂN TRANG */}
                            {leaves.length > ITEMS_PER_PAGE && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, padding: "0 10px" }}>
                                    <div style={{ fontSize: 13, color: "var(--text-sub)" }}>
                                        Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, leaves.length)}</b> trong tổng số <b>{leaves.length}</b> đơn
                                    </div>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <button
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(prev => prev - 1)}
                                            style={{ padding: "8px 12px", display: "flex", alignItems: "center", background: currentPage === 1 ? "#F1F5F9" : "#fff", cursor: currentPage === 1 ? "not-allowed" : "pointer", border: "1px solid #E2E8F0", borderRadius: 8, color: "#475569", fontWeight: 600 }}
                                        >
                                            <FaAngleLeft size={14} style={{ marginRight: 4 }} /> Trước
                                        </button>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--primary)", padding: "0 12px" }}>
                                            Trang {currentPage} / {totalPages}
                                        </span>
                                        <button
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(prev => prev + 1)}
                                            style={{ padding: "8px 12px", display: "flex", alignItems: "center", background: currentPage === totalPages ? "#F1F5F9" : "#fff", cursor: currentPage === totalPages ? "not-allowed" : "pointer", border: "1px solid #E2E8F0", borderRadius: 8, color: "#475569", fontWeight: 600 }}
                                        >
                                            Sau <FaAngleRight size={14} style={{ marginLeft: 4 }} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }
            </div>
        </div>
    );
};
export default LeaveHistory;