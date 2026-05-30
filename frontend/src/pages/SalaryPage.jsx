import { useState, useEffect } from "react";
import { 
  FaCoins, FaCalculator, FaFileDownload, FaCheck, 
  FaRegClock, FaTable, FaFilter, FaFileInvoice, FaInfoCircle, FaSpinner
} from "react-icons/fa";
import { toast } from "react-toastify";

// Hàm format tiền tệ VNĐ
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN').format(amount) + " ₫";
};

// Hàm lấy chữ cái đầu của tên
const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();
};

// Hàm phát sinh màu ngẫu nhiên dựa vào ký tự tên
const getAvatarStyle = (name) => {
    const colors = ["#E0F2FE", "#D1FAE5", "#FEF3C7", "#F3E8FF", "#FFE4E6"];
    const textColors = ["#0284C7", "#059669", "#D97706", "#9333EA", "#E11D48"];
    const code = (name || "").charCodeAt(0) || 0;
    const idx = code % colors.length;
    return { bg: colors[idx], color: textColors[idx] };
};

const SalaryPage = () => {
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  
  const [invoiceModal, setInvoiceModal] = useState({ isOpen: false, data: null, penalties: [] });

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");

  // Phân quyền hiển thị
  const isStaff = currentUser.role === "STAFF";
  const isManager = currentUser.role === "MANAGER";
  const isDirector = currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN";
  const myPayroll = payrolls.find(p => p.user_id === currentUser.id);

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/salary_ser/${year}/${month}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPayrolls(data);
      } else {
        toast.error("Lỗi lấy dữ liệu bảng lương");
      }
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrolls();
  }, [month, year]);

  const handleCalculatePayroll = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn tính lại lương cho tháng ${month}/${year}? Dữ liệu nháp (DRAFT) sẽ bị ghi đè!`)) return;
    setCalculating(true);
    try {
      const res = await fetch(`/api/salary_ser/calculate/${year}/${month}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchPayrolls();
      } else {
        toast.error(data.message || "Tính lương thất bại");
      }
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setCalculating(false);
    }
  };

  const handleMarkAsPaid = async (id) => {
    if (!window.confirm("Xác nhận đã thanh toán lương cho nhân viên này?")) return;
    try {
      const res = await fetch(`/api/salary_ser/${id}/status`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Đã đánh dấu thanh toán thành công!");
        setPayrolls(payrolls.map(p => p.id === id ? { ...p, status: "PAID" } : p));
      } else {
        toast.error("Lỗi cập nhật trạng thái");
      }
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ");
    }
  };

  // --- XEM CHI TIẾT PHIẾU LƯƠNG ---
  const handleViewInvoice = async (row) => {
    try {
      const res = await fetch(`/api/salary_ser/${year}/${month}/${row.user_id}/penalties`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      let penalties = [];
      if (res.ok) {
        penalties = await res.json();
      }
      setInvoiceModal({ isOpen: true, data: row, penalties });
    } catch (err) {
      toast.error("Không thể lấy chi tiết phiếu lương");
    }
  };

  // --- TÍNH TOÁN THỐNG KÊ TỔNG QUAN ---
  const totalSalary = payrolls.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);
  const paidCount = payrolls.filter(p => p.status === "PAID").length;
  const draftCount = payrolls.filter(p => p.status === "DRAFT").length;

  return (
    <div>
      {/* ─── HEADER & CONTROLS ─── */}
      <div className="flex-between mb-16" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            <FaCoins style={{ color: "var(--primary)" }} /> {isStaff ? "Lương & Thưởng Cá Nhân" : isDirector ? "Quản Lý Quỹ Lương Tổng" : "Bảng Lương Phòng Ban"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 3 }}>
            {isStaff ? "Theo dõi chi tiết thu nhập, ngày công, thưởng phạt tự động của bạn." : "Quản lý thu nhập, phụ cấp, giải ngân và cấp vốn tự động."}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select className="form-control" style={{ width: "auto", padding: "6px 12px", height: "auto" }} value={month} onChange={e => setMonth(e.target.value)}>
            {[...Array(12).keys()].map(i => (
              <option key={i+1} value={i+1}>Tháng {i+1}</option>
            ))}
          </select>
          <select className="form-control" style={{ width: "auto", padding: "6px 12px", height: "auto" }} value={year} onChange={e => setYear(e.target.value)}>
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          
          {!isStaff && (
            <button className="btn btn-primary btn-sm" style={{ padding: "7px 14px" }} onClick={handleCalculatePayroll} disabled={calculating}>
              {calculating ? <FaSpinner className="fa-spin" /> : <FaCalculator size={12} />} 
              {calculating ? " Đang tính..." : " Tính lương tháng này"}
            </button>
          )}
          
          <button className="btn btn-secondary btn-sm" style={{ padding: "7px 14px", background: "#fff", border: "1px solid var(--border)" }}>
            <FaFileDownload size={12} /> Xuất Excel
          </button>
        </div>
      </div>

      {/* ─── THỐNG KÊ (STATS CARDS) ─── */}
      {!isStaff ? (
        <div className="salary-stats">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#EEF2FF", color: "var(--primary)" }}>
              <FaCoins />
            </div>
            <div className="stat-label">{isDirector ? "Tổng ngân sách cấp vốn" : "Tổng chi lương phòng ban"}</div>
            <div className="stat-val">{new Intl.NumberFormat('vi-VN').format(totalSalary)}</div>
            <div className="stat-sub">₫ — Tháng {month}/{year}</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#D1FAE5", color: "#065F46" }}>
              <FaCheck />
            </div>
            <div className="stat-label">{isDirector ? "Đã giải ngân" : "Đã trả lương"}</div>
            <div className="stat-val" style={{ color: "#059669" }}>{paidCount}</div>
            <div className="stat-sub">{isDirector ? "hồ sơ (Managers & NV)" : "nhân viên"}</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#FEF3C7", color: "#B45309" }}>
              <FaRegClock />
            </div>
            <div className="stat-label">Chờ duyệt / Cấp vốn</div>
            <div className="stat-val" style={{ color: "#B45309" }}>{draftCount}</div>
            <div className="stat-sub">hồ sơ</div>
          </div>
        </div>
      ) : (
        myPayroll && (
          <div className="salary-stats">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: "#EEF2FF", color: "var(--primary)" }}>
                <FaCoins />
              </div>
              <div className="stat-label">Thu nhập thực nhận</div>
              <div className="stat-val">{new Intl.NumberFormat('vi-VN').format(myPayroll.net_salary)}</div>
              <div className="stat-sub">₫ — Tháng {month}/{year}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: myPayroll.status === "PAID" ? "#D1FAE5" : "#FEF3C7", color: myPayroll.status === "PAID" ? "#065F46" : "#B45309" }}>
                {myPayroll.status === "PAID" ? <FaCheck /> : <FaRegClock />}
              </div>
              <div className="stat-label">Trạng thái</div>
              <div className="stat-val" style={{ color: myPayroll.status === "PAID" ? "#059669" : "#B45309" }}>
                {myPayroll.status === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"}
              </div>
              <div className="stat-sub">Từ phòng kế toán</div>
            </div>
          </div>
        )
      )}

      {/* ─── BẢNG TÍNH LƯƠNG ─── */}
      <div className="card p-0" style={{ overflow: "hidden", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            <FaTable style={{ color: "var(--primary)" }} /> Bảng lương tháng {month}/{year}
          </div>
          <button className="btn btn-secondary btn-sm" style={{ padding: "5px 12px", background: "#fff", border: "1px solid var(--border)" }}>
            <FaFilter size={11} /> Lọc
          </button>
        </div>

        <div className="table-wrap-scroll custom-scrollbar">
          <table className="salary-table">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Nhân viên</th>
                <th>Lương cơ bản</th>
                <th>Ngày công</th>
                <th style={{ textAlign: "center" }}>Nghỉ phép</th>
                <th>Thưởng</th>
                <th>Phạt / Khấu trừ</th>
                <th>Thực nhận</th>
                <th style={{ textAlign: "center" }}>Trạng thái</th>
                <th style={{ textAlign: "center" }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" style={{ textAlign: "center", padding: 30, color: "var(--text-light)" }}>Đang tải dữ liệu lương...</td></tr>
              ) : payrolls.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: "center", padding: 30, color: "var(--text-light)" }}>Tháng này chưa có dữ liệu tính lương. Hãy nhấn "Tính lương" để bắt đầu.</td></tr>
              ) : (
                payrolls.map((row) => {
                  const workDays = row.total_working_days || 0;
                  const standardDays = row.standard_work_days || 1;
                  const progress = Math.min((workDays / standardDays) * 100, 100);
                  const progressColor = progress >= 95 ? "#059669" : progress >= 80 ? "#F59E0B" : "#DC2626";
                  
                  const avatarStyle = getAvatarStyle(row.name);

                  return (
                    <tr key={row.id}>
                      {/* Cột 1: Thông tin nhân viên */}
                      <td>
                        <div className="cell-user" style={{ gap: 12 }}>
                          {row.avatar_url ? (
                            <img src={row.avatar_url} alt="avatar" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: avatarStyle.bg, color: avatarStyle.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                              {getInitials(row.name)}
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{row.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 2 }}>{row.role === "MANAGER" ? "Quản lý" : "Nhân viên"}</div>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Lương cơ bản */}
                      <td className="font-mono">{formatCurrency(row.base_salary)}</td>

                      {/* Cột 3: Ngày công */}
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{workDays}/{standardDays}</div>
                        <div style={{ height: 4, background: "#F1F5F9", borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${progress}%`, background: progressColor, borderRadius: 4 }} />
                        </div>
                      </td>

                      {/* Cột 4: Nghỉ phép */}
                      <td style={{ textAlign: "center", fontWeight: 500 }}>
                        {row.total_leave_days || 0}
                        {row.total_unpaid_leave_days > 0 && <span style={{ color: "#DC2626", fontSize: 11, marginLeft: 4 }}>(-{row.total_unpaid_leave_days} KP)</span>}
                      </td>

                      {/* Cột 5: Thưởng */}
                      <td style={{ color: "#059669", fontWeight: 600 }}>{row.total_bonus > 0 ? `+${new Intl.NumberFormat('vi-VN').format(row.total_bonus)}` : "0"}</td>

                      {/* Cột 6: Phạt */}
                      <td style={{ color: "#DC2626", fontWeight: 600 }}>
                        {row.total_penalty > 0 ? `-${new Intl.NumberFormat('vi-VN').format(row.total_penalty)}` : "0"}
                        {row.total_late_days > 0 && <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 400, marginTop: 2 }}>Trễ/Sớm {row.total_late_days} lần</div>}
                      </td>

                      {/* Cột 7: Thực nhận */}
                      <td className="font-mono" style={{ color: "var(--primary)", fontWeight: 700, fontSize: 14 }}>
                        {formatCurrency(row.net_salary)}
                      </td>

                      {/* Cột 8: Trạng thái */}
                      <td style={{ textAlign: "center" }}>
                        {row.status === "PAID" ? (
                          <span className="badge badge-green" style={{ padding: "4px 10px" }}>Đã trả</span>
                        ) : (
                          <span className="badge badge-amber" style={{ padding: "4px 10px", background: "#FEF3C7", color: "#92400E" }}>Bản nháp</span>
                        )}
                      </td>

                      {/* Cột 9: Hành động */}
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          {(currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN" || currentUser.role === "MANAGER") && row.status === "DRAFT" && (
                            <button onClick={() => handleMarkAsPaid(row.id)} className="btn btn-sm" style={{ background: "#D1FAE5", color: "#065F46", border: "1px solid #A7F3D0", padding: "4px 8px" }} title="Đánh dấu đã thanh toán">
                              <FaCheck size={11} style={{ marginRight: 4 }} /> Đã trả
                            </button>
                          )}
                          <button onClick={() => handleViewInvoice(row)} className="btn btn-sm" style={{ background: "#E0F2FE", color: "#0369A1", border: "1px solid #BAE6FD", padding: "4px 8px" }} title="Xem chi tiết phiếu lương">
                            <FaFileInvoice size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer tổng kết bảng */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC" }}>
          <div style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
            {isStaff ? "Dữ liệu lương cá nhân" : `${payrolls.length} nhân sự · ${paidCount} đã giải ngân · ${draftCount} chờ xử lý`}
          </div>
          {!isStaff && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <span style={{ color: "var(--text-sub)" }}>Tổng ngân sách:</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--primary)", fontFamily: "monospace" }}>
                {formatCurrency(totalSalary)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── GHI CHÚ (INFO ALERT) ─── */}
      <div style={{ marginTop: 16, padding: "12px 16px", background: "#F8FAFC", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12.5, color: "var(--text-sub)", display: "flex", alignItems: "center", gap: 10 }}>
        <FaInfoCircle size={16} style={{ color: "var(--text-light)", flexShrink: 0 }} />
        <span>
          <strong>Lương thực nhận</strong> = (Lương cơ bản ÷ Tổng ngày làm quy định) × Ngày công thực tế + Thưởng − Phạt / Khấu trừ. 
          <br/>Hệ thống tự động đồng bộ dữ liệu Đi muộn, Về sớm, Tăng ca từ phân hệ <strong>Chấm công</strong> và <strong>Nghỉ phép</strong>.
        </span>
      </div>

      {/* ─── MODAL CHI TIẾT PHIẾU LƯƠNG ─── */}
      {invoiceModal.isOpen && invoiceModal.data && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="modal-content" style={{ background: "white", padding: 24, borderRadius: 12, width: 500, maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                <FaFileInvoice style={{ color: "var(--primary)" }} /> Phiếu lương tháng {month}/{year}
              </h3>
              <button onClick={() => setInvoiceModal({ isOpen: false, data: null, penalties: [] })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: "var(--text-light)" }}>&times;</button>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text)" }}>{invoiceModal.data.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-sub)" }}>Vai trò: {invoiceModal.data.role === "MANAGER" ? "Quản lý" : "Nhân viên"}</div>
            </div>

            <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px dashed #E5E7EB" }}>
                  <td style={{ padding: "10px 0", color: "var(--text-sub)" }}>Lương cơ bản</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 500 }}>{formatCurrency(invoiceModal.data.base_salary)}</td>
                </tr>
                <tr style={{ borderBottom: "1px dashed #E5E7EB" }}>
                  <td style={{ padding: "10px 0", color: "var(--text-sub)" }}>Ngày công chuẩn</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 500 }}>{invoiceModal.data.standard_work_days} ngày</td>
                </tr>
                <tr style={{ borderBottom: "1px dashed #E5E7EB" }}>
                  <td style={{ padding: "10px 0", color: "var(--text-sub)" }}>Công thực tế (Làm việc + Có phép)</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 500 }}>{Number(invoiceModal.data.total_working_days) + Number(invoiceModal.data.total_leave_days)} ngày</td>
                </tr>
                <tr style={{ borderBottom: "1px dashed #E5E7EB" }}>
                  <td style={{ padding: "10px 0", color: "#059669" }}>Thưởng / Tăng ca</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600, color: "#059669" }}>+{formatCurrency(invoiceModal.data.total_bonus)}</td>
                </tr>
                <tr style={{ borderBottom: "1px dashed #E5E7EB" }}>
                  <td style={{ padding: "10px 0", color: "#DC2626" }}>Phạt / Khấu trừ</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600, color: "#DC2626" }}>-{formatCurrency(invoiceModal.data.total_penalty)}</td>
                </tr>
              </tbody>
            </table>

            {invoiceModal.penalties.length > 0 && (
              <div style={{ marginTop: 16, background: "#FEF2F2", padding: 12, borderRadius: 8, border: "1px solid #FCA5A5" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#991B1B", marginBottom: 8 }}>Chi tiết vi phạm:</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#991B1B" }}>
                  {invoiceModal.penalties.map((p, idx) => {
                    let reasonDetail = "";
                    if (p.late_minutes > 0 && p.early_leave_minutes > 0) reasonDetail = ` (Trễ ${p.late_minutes} phút, Sớm ${p.early_leave_minutes} phút)`;
                    else if (p.late_minutes > 0) reasonDetail = ` (Trễ ${p.late_minutes} phút)`;
                    else if (p.early_leave_minutes > 0) reasonDetail = ` (Sớm ${p.early_leave_minutes} phút)`;
                    
                    const isUnexcused = p.status.toLowerCase().includes('không phép') || p.status.toLowerCase().includes('vắng') || p.status === 'UNEXCUSED';
                    const penaltyAmount = isUnexcused ? "100.000" : "50.000";
                    let displayStatus = p.status;
                    if (displayStatus === 'Tan Làm' || displayStatus === 'Đang Làm') {
                        if (p.late_minutes > 0 && p.early_leave_minutes > 0) displayStatus = "Đi muộn & Về sớm";
                        else if (p.late_minutes > 0) displayStatus = "Đi muộn";
                        else if (p.early_leave_minutes > 0) displayStatus = "Về sớm";
                    }

                    return (
                      <li key={idx} style={{ marginBottom: 4, lineHeight: 1.5 }}>
                        Ngày {new Date(p.work_date).toLocaleDateString("vi-VN")}: <strong>{displayStatus}{reasonDetail}</strong> <span style={{fontWeight: 600, color: "#DC2626"}}>(-{penaltyAmount} ₫)</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 20, padding: 16, background: "#F8FAFC", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600, color: "var(--text)" }}>Thực nhận:</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--primary)" }}>{formatCurrency(invoiceModal.data.net_salary)}</div>
            </div>

            <div style={{ marginTop: 20, textAlign: "right" }}>
               <button className="btn btn-secondary" onClick={() => setInvoiceModal({ isOpen: false, data: null, penalties: [] })} style={{ padding: "8px 16px", background: "#E5E7EB", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Đóng lại</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryPage;