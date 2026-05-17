import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { FaHistory } from "react-icons/fa";

const LeaveHistory = () => {
    const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
    const [leaves, setLeaves] = useState([]);

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

    const statusBadge = s => {
        if (s === "APPROVED") return <span className="badge badge-green">✅ Đã duyệt</span>;
        if (s === "REJECTED") return <span className="badge badge-red">❌ Từ chối</span>;
        return <span className="badge badge-amber">⏳ Chờ duyệt</span>;
    };

    return (
        <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <FaHistory style={{ color: "var(--primary)" }} /> Lịch sử Nghỉ phép
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
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
                                            <td style={{ maxWidth: 300, fontSize: 13 }}>{l.reason}</td>
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
        </div>
    );
};
export default LeaveHistory;