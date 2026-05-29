import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { FaBroadcastTower, FaPaperPlane, FaHistory, FaBell, FaCheckDouble } from "react-icons/fa";

const AnnouncementPage = () => {
    const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}"));

    // Phân quyền hiển thị
    const isSuperAdmin = user.role === "SUPERADMIN" || user.role === "ADMIN";
    const isManager = user.role === "MANAGER";
    const canSendAnnouncement = isSuperAdmin || isManager;

    // --- STATE TẠO THÔNG BÁO ---
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [targetType, setTargetType] = useState("ALL");
    const [targetRole, setTargetRole] = useState(isSuperAdmin ? "MANAGER" : "STAFF");
    const [targetEmail, setTargetEmail] = useState("");
    const [loadingSend, setLoadingSend] = useState(false);

    // --- STATE DỮ LIỆU ---
    const [history, setHistory] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [userList, setUserList] = useState([]);

    const [filter, setFilter] = useState("ALL");
    const [loadingList, setLoadingList] = useState(true);

    // 1. Fetch User cho Dropdown
    const fetchUsersForDropdown = async () => {
        if (!canSendAnnouncement) return;
        try {
            const res = await fetch("/api/auth_ser/users", {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            if (res.ok) {
                let usersData = await res.json();
                if (isSuperAdmin) {
                    usersData = usersData.filter(u => u.role === "MANAGER");
                } else if (isManager) {
                    usersData = usersData.filter(u => u.role === "STAFF" && u.department_id === user.department_id);
                }
                setUserList(usersData);
            }
        } catch { console.error("Lỗi tải danh sách users"); }
    };

    // 2. Fetch danh sách nhận
    const fetchAnnouncements = async () => {
        setLoadingList(true);
        try {
            // 🔥 ĐÃ FIX: Đổi sang /noti_ser
            const res = await fetch(`/api/noti_ser/announcements?role=${user.role}&email=${user.email}&department_id=${user.department_id}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            if (res.ok) {
                const d = await res.json();
                setAnnouncements(Array.isArray(d) ? d : []);
            }
        } catch { console.error("Lỗi tải thông báo nhận"); }
        finally { setLoadingList(false); }
    };

    // 3. Fetch lịch sử gửi
    const fetchHistory = async () => {
        if (!canSendAnnouncement) return;
        try {
            // 🔥 ĐÃ FIX: Đổi sang /noti_ser
            const res = await fetch(`/api/noti_ser/announcements/history?sender_id=${user.id}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            if (res.ok) {
                const d = await res.json();
                setHistory(Array.isArray(d) ? d : []);
            }
        } catch { console.error("Lỗi tải lịch sử gửi"); }
    };

    useEffect(() => {
        fetchAnnouncements();
        if (canSendAnnouncement) {
            fetchHistory();
            fetchUsersForDropdown();
        }

        const socket = io("/", { transports: ["websocket", "polling"], upgrade: true });
        socket.on("new_announcement", (data) => {
            let shouldShow = false;
            if (data.target_type === "ALL") shouldShow = true;
            if (data.target_type === "ROLE" && data.target_role === user.role) shouldShow = true;
            if (data.target_type === "DEPT_STAFF" && user.role === "STAFF" && String(data.department_id) === String(user.department_id)) shouldShow = true;
            if (data.target_type === "INDIVIDUAL" && data.target_email === user.email) shouldShow = true;

            if (shouldShow) {
                toast.info(`🔔 ${data.title}`);
                fetchAnnouncements();
            }
        });

        return () => socket.disconnect();
    }, []);

    // 4. Gửi thông báo
    const handleSend = async (e) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return toast.warning("Vui lòng nhập đủ Tiêu đề và Nội dung!");

        if (targetType === "INDIVIDUAL" && !targetEmail) {
            return toast.warning("Vui lòng chọn một Email người nhận!");
        }

        setLoadingSend(true);
        let payload = { title, content, sender_id: user.id, sender_name: user.full_name || user.username };

        if (isSuperAdmin) {
            if (targetType === "ALL") {
                payload = { ...payload, target_type: "ALL" };
            } else if (targetType === "ROLE") {
                payload = { ...payload, target_type: "ROLE", target_role: "MANAGER" };
            } else {
                payload = { ...payload, target_type: "INDIVIDUAL", target_email: targetEmail };
            }
        } else if (isManager) {
            if (targetType === "ALL") {
                payload = { ...payload, target_type: "DEPT_STAFF", department_id: user.department_id };
            } else {
                payload = { ...payload, target_type: "INDIVIDUAL", target_email: targetEmail };
            }
        }

        try {
            // 🔥 ĐÃ FIX: Đổi sang /noti_ser
            const res = await fetch("/api/noti_ser/announcements", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                toast.success("Gửi thông báo thành công! 🚀");
                setTitle(""); setContent(""); setTargetEmail("");
                fetchHistory();
                fetchAnnouncements();
            } else {
                const d = await res.json();
                toast.error(d.message || "Lỗi gửi thông báo");
            }
        } catch { toast.error("Lỗi kết nối server!"); }
        finally { setLoadingSend(false); }
    };

    // 5. Đánh dấu đọc
    const markRead = async (id) => {
        try {
            // 🔥 ĐÃ FIX: Đổi sang /noti_ser
            await fetch(`/api/noti_ser/announcements/${id}/read`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
        } catch { console.error("Lỗi đánh dấu đã đọc"); }
    };

    const renderTargetBadge = (h) => {
        if (h.target_type === "ALL") return <span className="badge badge-purple">Toàn bộ nhân sự</span>;
        if (h.target_type === "ROLE" && h.target_role === "MANAGER") return <span className="badge badge-amber">Tất cả Quản lý</span>;
        if (h.target_type === "DEPT_STAFF") return <span className="badge badge-blue">Toàn bộ nhân viên phòng</span>;
        if (h.target_type === "INDIVIDUAL") return <span className="badge badge-green">Cá nhân: {h.target_email}</span>;
        return <span className="badge badge-blue">{h.target_type}</span>;
    };

    const unreadCount = announcements.filter(a => !a.is_read).length;
    const filteredAnnouncements = filter === "UNREAD" ? announcements.filter(a => !a.is_read) : announcements;

    return (
        <div>
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 10 }}>
                        {canSendAnnouncement ? <FaBroadcastTower style={{ color: "var(--primary)" }} /> : <FaBell style={{ color: "var(--primary)" }} />}
                        Trạm Thông Báo
                    </div>
                    <div style={{ fontSize: 13.5, color: "var(--text-sub)", marginTop: 6 }}>
                        {isSuperAdmin ? "Điều hành và truyền đạt thông tin toàn hệ thống"
                            : isManager ? "Quản lý và thông báo cho nhân viên nội bộ phòng ban"
                                : "Cập nhật các thông báo mới nhất từ Ban quản lý"}
                    </div>
                </div>
            </div>

            {canSendAnnouncement ? (
                <div className="two-col">
                    <div className="card">
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--primary)", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                            <FaPaperPlane size={14} /> Phát tín hiệu mới
                        </div>

                        <form onSubmit={handleSend}>
                            <div className="form-group">
                                <label className="form-label">Phạm vi gửi <span style={{ color: "#DC2626" }}>*</span></label>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                                    {isSuperAdmin && (
                                        <>
                                            <button type="button" className={`btn btn-sm ${targetType === "ALL" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTargetType("ALL")}>Tất cả nhân sự</button>
                                            <button type="button" className={`btn btn-sm ${targetType === "ROLE" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTargetType("ROLE")}>Tất cả Quản lý</button>
                                            <button type="button" className={`btn btn-sm ${targetType === "INDIVIDUAL" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTargetType("INDIVIDUAL")}>Gửi riêng (Email)</button>
                                        </>
                                    )}
                                    {isManager && (
                                        <>
                                            <button type="button" className={`btn btn-sm ${targetType === "ALL" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTargetType("ALL")}>Tất cả NV phòng</button>
                                            <button type="button" className={`btn btn-sm ${targetType === "INDIVIDUAL" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTargetType("INDIVIDUAL")}>Gửi riêng (Email)</button>
                                        </>
                                    )}
                                </div>

                                {targetType === "INDIVIDUAL" && (
                                    <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                                        <label className="form-label" style={{ fontSize: 12 }}>Chọn người nhận đích danh:</label>
                                        <select className="form-control" value={targetEmail} onChange={e => setTargetEmail(e.target.value)} required>
                                            <option value="">-- Vui lòng chọn người nhận --</option>
                                            {userList.map(u => (
                                                <option key={u.id} value={u.email}>{u.full_name || u.username} ({u.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Tiêu đề <span style={{ color: "#DC2626" }}>*</span></label>
                                <input className="form-control" placeholder="Nhập tiêu đề ngắn gọn..." value={title} onChange={e => setTitle(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nội dung <span style={{ color: "#DC2626" }}>*</span></label>
                                <textarea
                                    className="form-control"
                                    placeholder="Nhập nội dung chi tiết..."
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    required
                                    style={{ minHeight: 140, resize: "vertical", lineHeight: 1.6 }}
                                />
                            </div>

                            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={loadingSend}>
                                    <FaPaperPlane size={13} style={{ marginRight: 6 }} /> {loadingSend ? "Đang phát..." : "Phát thông báo"}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {isManager && (
                            <div className="card" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#166534", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><FaBell size={13} /> Hòm thư đến</span>
                                    {unreadCount > 0 && <span className="badge badge-red">{unreadCount} mới</span>}
                                </div>
                                <div style={{ maxHeight: 250, overflowY: "auto", paddingRight: 4 }} className="custom-scrollbar">
                                    {filteredAnnouncements.length === 0 ? (
                                        <div style={{ textAlign: "center", padding: 20, color: "#166534", opacity: 0.7, fontSize: 13 }}>Không có thông báo mới.</div>
                                    ) : (
                                        filteredAnnouncements.map(a => (
                                            <div key={a.id} onClick={() => { if (!a.is_read) markRead(a.id); }} style={{ padding: "10px 12px", background: "#fff", borderRadius: 8, marginBottom: 8, cursor: "pointer", borderLeft: a.is_read ? "none" : "3px solid #22C55E", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginBottom: 4 }}>{a.title}</div>
                                                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{a.content}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="card" style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
                                <FaHistory size={13} style={{ color: "var(--text-sub)" }} /> Lịch sử phát đi
                            </div>
                            <div style={{ maxHeight: "calc(100vh - 250px)", overflowY: "auto", paddingRight: 4 }} className="custom-scrollbar">
                                {history.length === 0 ? (
                                    <div style={{ textAlign: "center", padding: 32, color: "var(--text-light)" }}>Trạm chưa phát tín hiệu nào.</div>
                                ) : (
                                    history.map(h => (
                                        <div key={h.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border-light)" }}>
                                            <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)", marginBottom: 4 }}>{h.title}</div>
                                            <div style={{ fontSize: 12.5, color: "var(--text-sub)", marginBottom: 8, lineHeight: 1.5 }}>{h.content?.slice(0, 100)}...</div>
                                            <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 11, color: "var(--text-light)" }}>
                                                <span>{new Date(h.created_at).toLocaleString("vi-VN")}</span>
                                                {renderTargetBadge(h)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                        <div className="tab-bar" style={{ marginBottom: 0 }}>
                            <button className={`tab-item${filter === "ALL" ? " active" : ""}`} onClick={() => setFilter("ALL")}>Tất cả ({announcements.length})</button>
                            <button className={`tab-item${filter === "UNREAD" ? " active" : ""}`} onClick={() => setFilter("UNREAD")}>Chưa đọc {unreadCount > 0 && <span style={{ color: "red", marginLeft: 4 }}>({unreadCount})</span>}</button>
                        </div>
                        {unreadCount > 0 && (
                            <button className="btn btn-sm btn-secondary" onClick={() => announcements.filter(a => !a.is_read).forEach(a => markRead(a.id))}>
                                <FaCheckDouble size={12} /> Đánh dấu đọc hết
                            </button>
                        )}
                    </div>

                    {loadingList ? (
                        <div style={{ textAlign: "center", padding: 60, color: "var(--text-light)" }}>Đang kiểm tra hòm thư...</div>
                    ) : filteredAnnouncements.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 60, color: "var(--text-light)", background: "#F8FAFC", borderRadius: 12 }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                            {filter === "UNREAD" ? "Bạn đã đọc hết mọi thông báo." : "Hòm thư của bạn đang trống."}
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {filteredAnnouncements.map(a => (
                                <div
                                    key={a.id}
                                    style={{
                                        padding: "16px 20px",
                                        background: a.is_read ? "#F8FAFC" : "#fff",
                                        border: "1px solid",
                                        borderColor: a.is_read ? "#E2E8F0" : "#93C5FD",
                                        borderRadius: 12,
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        boxShadow: a.is_read ? "none" : "0 4px 6px rgba(59, 130, 246, 0.1)"
                                    }}
                                    onClick={() => { if (!a.is_read) markRead(a.id); }}
                                >
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                                        <div style={{
                                            width: 42, height: 42, borderRadius: "50%",
                                            background: a.sender_role === "SUPERADMIN" ? "var(--primary)" : "#0284C7",
                                            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 14, fontWeight: 700, flexShrink: 0,
                                        }}>
                                            {a.sender_role === "SUPERADMIN" ? "SA" : "QL"}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                                <div style={{ fontWeight: 600, fontSize: 15, color: a.is_read ? "#475569" : "#0F172A" }}>{a.title}</div>
                                                <div style={{ fontSize: 12, color: "#94A3B8" }}>{new Date(a.created_at).toLocaleString("vi-VN")}</div>
                                            </div>
                                            <div style={{ fontSize: 14, color: a.is_read ? "#64748B" : "#334155", lineHeight: 1.6, whiteSpace: "pre-line", marginBottom: 12 }}>
                                                {a.content}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#94A3B8" }}>
                                                <span>Phát từ: <b>{a.sender_name}</b></span>
                                                {a.target_type === "INDIVIDUAL" && <span className="badge badge-green" style={{ fontSize: 10 }}>Tin nhắn riêng mật</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AnnouncementPage;