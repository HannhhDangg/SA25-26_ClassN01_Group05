import { useState, useEffect } from "react";
import { FaBuilding, FaCog, FaClock, FaCalendarAlt, FaPlus, FaEdit, FaTrash, FaMoneyBillWave } from "react-icons/fa";
import { toast } from "react-toastify";

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("departments");
  
  // State cho Phòng ban
  const [departments, setDepartments] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDeptId, setEditDeptId] = useState(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [editDeptDesc, setEditDeptDesc] = useState("");
  const [editDeptManagerId, setEditDeptManagerId] = useState(null);

  // States cho các cấu hình
  const [attendanceSettings, setAttendanceSettings] = useState({
    checkInTime: "08:30",
    checkOutTime: "17:00",
    gracePeriod: 10,
    validIPs: "192.168.1.1, 10.0.0.1"
  });

  const [leaveSettings, setLeaveSettings] = useState({
    defaultLeaveDays: 12,
    holidays: "01-01: Tết Dương Lịch\n04-26: Giỗ Tổ Hùng Vương\n04-30: Giải Phóng Miền Nam\n05-01: Quốc Tế Lao Động\n09-02: Quốc Khánh"
  });

  const [payrollSettings, setPayrollSettings] = useState({
    latePenalty: 50000,
    unexcusedPenalty: 100000,
    otMultiplier: 1.5
  });

  const [generalSettings, setGeneralSettings] = useState({
    companyName: "HRM System",
    logoUrl: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpUser: "hr@company.com"
  });

  useEffect(() => {
    if (activeTab === "departments") {
      fetchDepartments();
    } else {
      fetchSettings();
    }
  }, [activeTab]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/auth_ser/departments", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách phòng ban", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/auth_ser/settings/${activeTab}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Chỉ ghi đè State nếu API trả về dữ liệu
        if (activeTab === "attendance" && data && Object.keys(data).length > 0) setAttendanceSettings(data);
        if (activeTab === "leaves" && data && Object.keys(data).length > 0) setLeaveSettings(data);
        if (activeTab === "payroll" && data && Object.keys(data).length > 0) setPayrollSettings(data);
        if (activeTab === "general" && data && Object.keys(data).length > 0) setGeneralSettings(data);
      }
    } catch (err) {
      console.error(`Lỗi lấy cấu hình ${activeTab}`, err);
    }
  };

  const handleAddDepartment = async (e) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      toast.warning("Vui lòng nhập tên phòng ban!");
      return;
    }

    try {
      const res = await fetch("/api/auth_ser/departments", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ name: newDeptName, description: newDeptDesc })
      });

      if (res.ok) {
        toast.success("Thêm phòng ban thành công!");
        setShowAddModal(false);
        setNewDeptName("");
        setNewDeptDesc("");
        fetchDepartments();
      } else {
        const data = await res.json();
        toast.error(data.message || "Lỗi khi thêm phòng ban!");
      }
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ!");
    }
  };

  const handleEditClick = (dept) => {
    setEditDeptId(dept.id);
    setEditDeptName(dept.name);
    setEditDeptDesc(dept.description || "");
    setEditDeptManagerId(dept.manager_id || null);
    setShowEditModal(true);
  };

  const handleUpdateDepartment = async (e) => {
    e.preventDefault();
    if (!editDeptName.trim()) {
      toast.warning("Vui lòng nhập tên phòng ban!");
      return;
    }

    try {
      const res = await fetch(`/api/auth_ser/departments/${editDeptId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ name: editDeptName, description: editDeptDesc, manager_id: editDeptManagerId })
      });

      if (res.ok) {
        toast.success("Cập nhật phòng ban thành công!");
        setShowEditModal(false);
        fetchDepartments();
      } else {
        const data = await res.json();
        toast.error(data.message || "Lỗi khi cập nhật phòng ban!");
      }
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ!");
    }
  };

  const handleDeleteDepartment = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa phòng ban này? Hành động này không thể hoàn tác.")) return;
    try {
      const res = await fetch(`/api/auth_ser/departments/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) { toast.success("Xóa phòng ban thành công!"); fetchDepartments(); }
      else { const data = await res.json(); toast.error(data.message || "Lỗi khi xóa phòng ban!"); }
    } catch (err) { toast.error("Lỗi kết nối máy chủ!"); }
  };

  // Hàm xử lý lưu cấu hình chung (Gửi lên Backend)
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    
    let payload = {};
    if (activeTab === "attendance") payload = attendanceSettings;
    if (activeTab === "leaves") payload = leaveSettings;
    if (activeTab === "payroll") payload = payrollSettings;
    if (activeTab === "general") payload = generalSettings;

    try {
      const res = await fetch(`/api/auth_ser/settings/${activeTab}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("Đã lưu cấu hình thành công!");
      } else {
        const data = await res.json();
        toast.error(data.message || "Lỗi khi lưu cấu hình!");
      }
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ!");
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Cài đặt hệ thống</h1>
        <p style={{ color: "var(--text-sub)", fontSize: 14, margin: 0 }}>
          Quản lý các cấu hình cốt lõi của hệ thống nhân sự.
        </p>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {/* Cột danh mục Settings */}
        <div style={{ width: 250, display: "flex", flexDirection: "column", gap: 8 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", background: activeTab === "departments" ? "var(--primary-light)" : "#fff", color: activeTab === "departments" ? "var(--primary)" : "var(--text)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontWeight: 600, textAlign: "left", transition: "0.2s" }} onClick={() => setActiveTab("departments")}>
            <FaBuilding /> Quản lý phòng ban
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", background: activeTab === "attendance" ? "var(--primary-light)" : "#fff", color: activeTab === "attendance" ? "var(--primary)" : "var(--text)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontWeight: 600, textAlign: "left", transition: "0.2s" }} onClick={() => setActiveTab("attendance")}>
            <FaClock /> Cấu hình chấm công
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", background: activeTab === "leaves" ? "var(--primary-light)" : "#fff", color: activeTab === "leaves" ? "var(--primary)" : "var(--text)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontWeight: 600, textAlign: "left", transition: "0.2s" }} onClick={() => setActiveTab("leaves")}>
            <FaCalendarAlt /> Nghỉ phép & Lễ tết
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", background: activeTab === "payroll" ? "var(--primary-light)" : "#fff", color: activeTab === "payroll" ? "var(--primary)" : "var(--text)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontWeight: 600, textAlign: "left", transition: "0.2s" }} onClick={() => setActiveTab("payroll")}>
            <FaMoneyBillWave /> Cấu hình tính lương
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", background: activeTab === "general" ? "var(--primary-light)" : "#fff", color: activeTab === "general" ? "var(--primary)" : "var(--text)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontWeight: 600, textAlign: "left", transition: "0.2s" }} onClick={() => setActiveTab("general")}>
            <FaCog /> Hệ thống chung
          </button>
        </div>

        {/* Nội dung Settings */}
        <div className="card" style={{ flex: 1, minHeight: 400, minWidth: 300 }}>
          {activeTab === "departments" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text)" }}>Danh sách phòng ban</div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                  <FaPlus style={{ marginRight: 6 }} /> Thêm phòng ban
                </button>
              </div>

              <div className="table-wrap-scroll">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 60, fontSize: 14 }}>ID</th>
                      <th style={{ fontSize: 14 }}>Tên phòng ban</th>
                      <th style={{ fontSize: 14 }}>Mô tả</th>
                      <th style={{ width: 100, fontSize: 14 }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: "center", padding: 20, color: "var(--text-light)" }}>Chưa có dữ liệu phòng ban</td></tr>
                    ) : (
                      departments.map(dept => (
                        <tr key={dept.id}>
                          <td>{dept.id}</td>
                          <td style={{ fontWeight: 600 }}>{dept.name}</td>
                          <td style={{ color: "var(--text-sub)" }}>{dept.description || "---"}</td>
                          <td>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="btn btn-sm btn-icon" style={{ background: "#f1f5f9", color: "#3b82f6", border: "none", cursor: "pointer" }} title="Sửa" onClick={() => handleEditClick(dept)}><FaEdit /></button>
                              <button className="btn btn-sm btn-icon" style={{ background: "#fee2e2", color: "#ef4444", border: "none", cursor: "pointer" }} title="Xóa" onClick={() => handleDeleteDepartment(dept.id)}><FaTrash /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "attendance" && (
            <form onSubmit={handleSaveSettings} style={{ padding: "0 10px" }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "var(--text)" }}>Cấu hình chấm công & ca làm</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Giờ vào ca chuẩn</label>
                  <input type="time" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={attendanceSettings.checkInTime} onChange={e => setAttendanceSettings({...attendanceSettings, checkInTime: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Giờ tan ca chuẩn</label>
                  <input type="time" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={attendanceSettings.checkOutTime} onChange={e => setAttendanceSettings({...attendanceSettings, checkOutTime: e.target.value})} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Số phút cho phép đi muộn (Grace period)</label>
                <input type="number" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={attendanceSettings.gracePeriod} onChange={e => setAttendanceSettings({...attendanceSettings, gracePeriod: e.target.value})} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Danh sách địa chỉ IP / BSSID hợp lệ (cách nhau bởi dấu phẩy)</label>
                <textarea style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none", resize: "vertical" }} rows="3" value={attendanceSettings.validIPs} onChange={e => setAttendanceSettings({...attendanceSettings, validIPs: e.target.value})} placeholder="VD: 192.168.1.1, 10.0.0.1"></textarea>
                <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 5 }}>Chỉ nhân viên kết nối mạng nội bộ công ty mới có thể chấm công.</div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: "10px 20px" }}>Lưu thay đổi</button>
            </form>
          )}

          {activeTab === "leaves" && (
            <form onSubmit={handleSaveSettings} style={{ padding: "0 10px" }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "var(--text)" }}>Quy định nghỉ phép & Lễ tết</div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Quỹ phép năm tiêu chuẩn mặc định (ngày/năm)</label>
                <input type="number" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={leaveSettings.defaultLeaveDays} onChange={e => setLeaveSettings({...leaveSettings, defaultLeaveDays: e.target.value})} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Danh sách ngày nghỉ lễ cố định (MM-DD: Tên ngày lễ)</label>
                <textarea style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none", resize: "vertical" }} rows="6" value={leaveSettings.holidays} onChange={e => setLeaveSettings({...leaveSettings, holidays: e.target.value})} placeholder="01-01: Tết Dương Lịch&#10;04-30: Giải Phóng Miền Nam"></textarea>
                <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 5 }}>Mỗi dòng là một ngày lễ. Các ngày này nhân viên không cần đi làm vẫn được tính công đầy đủ.</div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: "10px 20px" }}>Lưu thay đổi</button>
            </form>
          )}

          {activeTab === "payroll" && (
            <form onSubmit={handleSaveSettings} style={{ padding: "0 10px" }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "var(--text)" }}>Cấu hình tính lương & thưởng phạt</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Phạt đi muộn / về sớm (VNĐ/lần)</label>
                  <input type="number" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={payrollSettings.latePenalty} onChange={e => setPayrollSettings({...payrollSettings, latePenalty: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Phạt nghỉ không phép (VNĐ/ngày)</label>
                  <input type="number" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={payrollSettings.unexcusedPenalty} onChange={e => setPayrollSettings({...payrollSettings, unexcusedPenalty: e.target.value})} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Hệ số lương tăng ca (OT)</label>
                <input type="number" step="0.1" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={payrollSettings.otMultiplier} onChange={e => setPayrollSettings({...payrollSettings, otMultiplier: e.target.value})} />
                <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 5 }}>Ví dụ: 1.5 nghĩa là làm thêm giờ sẽ nhận 150% mức lương tiêu chuẩn.</div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: "10px 20px" }}>Lưu thay đổi</button>
            </form>
          )}

          {activeTab === "general" && (
            <form onSubmit={handleSaveSettings} style={{ padding: "0 10px" }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "var(--text)" }}>Hệ thống chung</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Tên công ty hiển thị</label>
                  <input type="text" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={generalSettings.companyName} onChange={e => setGeneralSettings({...generalSettings, companyName: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>URL Logo giao diện</label>
                  <input type="text" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={generalSettings.logoUrl} onChange={e => setGeneralSettings({...generalSettings, logoUrl: e.target.value})} placeholder="https://..." />
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 30, marginBottom: 15, color: "var(--text)" }}>Cấu hình Máy chủ Email (SMTP)</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Máy chủ SMTP (Host)</label>
                  <input type="text" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={generalSettings.smtpHost} onChange={e => setGeneralSettings({...generalSettings, smtpHost: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Cổng (Port)</label>
                  <input type="number" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={generalSettings.smtpPort} onChange={e => setGeneralSettings({...generalSettings, smtpPort: e.target.value})} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Tài khoản Email</label>
                <input type="email" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} value={generalSettings.smtpUser} onChange={e => setGeneralSettings({...generalSettings, smtpUser: e.target.value})} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Mật khẩu ứng dụng (App Password)</label>
                <input type="password" style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }} placeholder="••••••••" />
                <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 5 }}>Mật khẩu ứng dụng chuyên biệt của Google Workspace hoặc Outlook.</div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: "10px 20px" }}>Lưu thay đổi</button>
            </form>
          )}
        </div>
      </div>

      {/* Modal Thêm Phòng Ban */}
      {showAddModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="card" style={{ width: "100%", maxWidth: 450, padding: 24 }}>
            <h3 style={{ marginTop: 0, marginBottom: 15, fontSize: 20 }}>Thêm phòng ban mới</h3>
            <form onSubmit={handleAddDepartment}>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: "block", marginBottom: 5, fontWeight: 500, fontSize: 14 }}>Tên phòng ban <span style={{color: "red"}}>*</span></label>
                <input 
                  type="text" 
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }}
                  placeholder="VD: Phòng IT" 
                  value={newDeptName} 
                  onChange={e => setNewDeptName(e.target.value)} 
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", marginBottom: 5, fontWeight: 500, fontSize: 14 }}>Mô tả</label>
                <textarea 
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none", resize: "vertical" }}
                  placeholder="Mô tả chức năng của phòng ban..." 
                  rows="3"
                  value={newDeptDesc} 
                  onChange={e => setNewDeptDesc(e.target.value)}
                ></textarea>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn" style={{ padding: "8px 16px", background: "#f1f5f9", color: "var(--text)", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }} onClick={() => setShowAddModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ padding: "8px 16px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>Xác nhận thêm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa Phòng Ban */}
      {showEditModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="card" style={{ width: "100%", maxWidth: 450, padding: 24 }}>
            <h3 style={{ marginTop: 0, marginBottom: 15, fontSize: 20 }}>Cập nhật phòng ban</h3>
            <form onSubmit={handleUpdateDepartment}>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: "block", marginBottom: 5, fontWeight: 500, fontSize: 14 }}>Tên phòng ban <span style={{color: "red"}}>*</span></label>
                <input 
                  type="text" 
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }}
                  value={editDeptName} 
                  onChange={e => setEditDeptName(e.target.value)} 
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", marginBottom: 5, fontWeight: 500, fontSize: 14 }}>Mô tả</label>
                <textarea 
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", outline: "none", resize: "vertical" }}
                  rows="3" value={editDeptDesc} onChange={e => setEditDeptDesc(e.target.value)}
                ></textarea>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn" style={{ padding: "8px 16px", background: "#f1f5f9", color: "var(--text)", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }} onClick={() => setShowEditModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ padding: "8px 16px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>Cập nhật</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;