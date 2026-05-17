import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaCalendarPlus } from "react-icons/fa";

const CreateLeave = () => {
    const navigate = useNavigate();
    const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
    const [totalDays, setTotalDays] = useState(0);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ reason: "", start_date: "", end_date: "" });

    // Tự động tính số ngày
    useEffect(() => {
        if (formData.start_date && formData.end_date) {
            const diff = Math.ceil((new Date(formData.end_date) - new Date(formData.start_date)) / (1000 * 60 * 60 * 24)) + 1;
            setTotalDays(diff > 0 ? diff : 0);
        } else {
            setTotalDays(0);
        }
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
                // Chuyển hướng thẳng sang trang Lịch sử sau khi gửi
                navigate("/employee/leaves/history");
            } else {
                toast.error(data.message || "Lỗi gửi đơn");
            }
        } catch {
            toast.error("Lỗi kết nối server");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <FaCalendarPlus style={{ color: "var(--primary)" }} /> Tạo Đơn Xin Nghỉ Phép
            </div>

            <div className="card" style={{ maxWidth: 700 }}>
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

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-page)", padding: "16px", borderRadius: "var(--r-md)", marginTop: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                            Tổng số ngày nghỉ:{" "}
                            <span style={{ color: totalDays > 0 ? "#EF4444" : "var(--text-light)", fontWeight: 700, fontSize: 20 }}>{totalDays}</span>
                            <span style={{ color: "var(--text-sub)", fontSize: 13 }}> ngày</span>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading || totalDays <= 0} style={{ padding: "10px 24px" }}>
                            {loading ? "Đang gửi..." : "🚀 Gửi Đơn Ngay"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default CreateLeave;