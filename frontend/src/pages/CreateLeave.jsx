import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaRegCalendarPlus, FaPaperPlane } from "react-icons/fa";

const CreateLeave = () => {
    const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ reason: "", start_date: "", end_date: "" });
    const [totalDays, setTotalDays] = useState(0);
    const [loading, setLoading] = useState(false);

    // Tự động tính ngày
    useEffect(() => {
        if (formData.start_date && formData.end_date) {
            const diff = Math.ceil((new Date(formData.end_date) - new Date(formData.start_date)) / (1000 * 60 * 60 * 24)) + 1;
            setTotalDays(diff > 0 ? diff : 0);
        } else setTotalDays(0);
    }, [formData.start_date, formData.end_date]);

    // Xử lý gửi form
    const handleSubmit = async e => {
        e.preventDefault();
        if (totalDays <= 0) return toast.warning("Ngày kết thúc phải hợp lệ!");
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/leave_ser", {
                method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ user_id: user.id, ...formData, total_days: totalDays })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Gửi đơn thành công! 🚀");
                navigate("/employee/leaves/history"); // Chuyển thẳng sang trang lịch sử
            } else toast.error(data.message || "Lỗi gửi đơn");
        } catch { toast.error("Lỗi kết nối server"); }
        finally { setLoading(false); }
    };

    return (
        <div style={{ padding: "20px", maxWidth: 1200, margin: "0 auto" }}>

            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", marginBottom: 30, display: "flex", alignItems: "center", gap: 12 }}>
                <FaRegCalendarPlus style={{ color: "var(--primary)" }} /> Tạo Đơn Xin Nghỉ Phép
            </div>

            {/* Box Form Căn Giữa */}
            <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{
                    width: "100%", maxWidth: 850, background: "white",
                    padding: "45px", borderRadius: 16,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.05)", border: "1px solid #F1F5F9"
                }}>
                    <div style={{ textAlign: "center", marginBottom: 35 }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--primary)" }}>📝 Thông Tin Đơn Nghỉ</div>
                        <div style={{ fontSize: 15, color: "var(--text-sub)", marginTop: 8 }}>Vui lòng điền đầy đủ và chính xác thời gian bạn muốn xin nghỉ</div>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <div>
                            <label style={{ display: "block", fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#334155" }}>
                                Lý do xin nghỉ <span style={{ color: "#DC2626" }}>*</span>
                            </label>
                            <input
                                required
                                placeholder="VD: Nghỉ ốm, Có việc gia đình, Đi du lịch..."
                                value={formData.reason}
                                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                style={{ width: "100%", padding: "16px 20px", fontSize: 16, borderRadius: 12, border: "2px solid #E2E8F0", outline: "none", transition: "border-color 0.2s" }}
                                onFocus={e => e.target.style.borderColor = "var(--primary)"}
                                onBlur={e => e.target.style.borderColor = "#E2E8F0"}
                            />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                            <div>
                                <label style={{ display: "block", fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#334155" }}>
                                    Từ ngày <span style={{ color: "#DC2626" }}>*</span>
                                </label>
                                <input
                                    required type="date"
                                    value={formData.start_date}
                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    style={{ width: "100%", padding: "16px 20px", fontSize: 16, borderRadius: 12, border: "2px solid #E2E8F0", outline: "none", fontFamily: "inherit" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#334155" }}>
                                    Đến hết ngày <span style={{ color: "#DC2626" }}>*</span>
                                </label>
                                <input
                                    required type="date"
                                    value={formData.end_date} min={formData.start_date}
                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                    style={{ width: "100%", padding: "16px 20px", fontSize: 16, borderRadius: 12, border: "2px solid #E2E8F0", outline: "none", fontFamily: "inherit" }}
                                />
                            </div>
                        </div>

                        <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            background: "#F8FAFC", padding: "20px 24px", borderRadius: 12, marginTop: 10,
                            border: "1px dashed #CBD5E1"
                        }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>
                                Tổng thời gian nghỉ:{" "}
                                <span style={{ color: totalDays > 0 ? "#EF4444" : "#94A3B8", fontWeight: 800, fontSize: 24, marginLeft: 8 }}>{totalDays}</span>
                                <span style={{ color: "var(--text-sub)", fontSize: 15, marginLeft: 4 }}> ngày</span>
                            </div>
                            <button
                                type="submit"
                                disabled={loading || totalDays <= 0}
                                style={{
                                    background: (loading || totalDays <= 0) ? "#94A3B8" : "var(--primary)",
                                    color: "white", border: "none", padding: "14px 28px", borderRadius: 10,
                                    fontSize: 16, fontWeight: 700, cursor: (loading || totalDays <= 0) ? "not-allowed" : "pointer",
                                    display: "flex", alignItems: "center", gap: 10,
                                    transition: "all 0.2s"
                                }}
                            >
                                <FaPaperPlane /> {loading ? "Đang xử lý..." : "Gửi Đơn Ngay"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
export default CreateLeave;