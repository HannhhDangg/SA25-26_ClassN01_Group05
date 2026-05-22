import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { FaUsers, FaSearch, FaUserPlus, FaEdit, FaTimes, FaTrashAlt, FaCheck } from "react-icons/fa";

const ROLES = ["Tất cả", "SUPERADMIN", "MANAGER", "STAFF"];

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("Tất cả");

  const token = localStorage.getItem("token");
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const formatID = id => `HD${String(id).padStart(2, "0")}`;

  const fetchData = async () => {
    setLoading(true);
    setIsRateLimited(false);
    try {
      const [resUsers, resDepts] = await Promise.all([
        fetch("/api/auth_ser/users", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/auth_ser/departments", { headers: { "Authorization": `Bearer ${token}` } })
      ]);

      if (resUsers.status === 429 || resDepts.status === 429) {
        setIsRateLimited(true);
        setLoading(false);
        return;
      }

      if (!resUsers.ok || !resDepts.ok) {
        toast.error("Lỗi khi tải dữ liệu từ máy chủ.");
        setLoading(false);
        return;
      }

      const dataUsers = await resUsers.json();
      const dataDepts = await resDepts.json();

      setUsers(Array.isArray(dataUsers) ? dataUsers : []);
      setDepartments(Array.isArray(dataDepts) ? dataDepts : []);
    } catch {
      toast.error("Không thể kết nối đến máy chủ!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const socket = io("/", { transports: ["websocket", "polling"], upgrade: true });
    socket.on("new_leave_request", d => toast.info("🔔 " + d.message));
    socket.on("new_user_registered", d => {
      fetchData();
    });
    return () => socket.disconnect();
  }, []);

  const handleApprove = async (userId) => {
    if (!window.confirm("Bạn có chắc chắn muốn duyệt và kích hoạt tài khoản này không?")) return;
    try {
      const res = await fetch(`/api/auth_ser/users/${userId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: "ACTIVE" })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Kích hoạt tài khoản thành công! 🎉");
        fetchData();
      } else {
        toast.error(data.message || "Lỗi khi kích hoạt tài khoản!");
      }
    } catch { toast.error("Lỗi kết nối Server!"); }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const filtered = users.filter(u => {
    const term = search.toLowerCase();
    const matchSearch =
      (u.full_name?.toLowerCase() || "").includes(term) ||
      (u.username?.toLowerCase() || "").includes(term) ||
      (u.email?.toLowerCase() || "").includes(term) ||
      formatID(u.id).toLowerCase().includes(term);

    const matchRole = roleFilter === "Tất cả" || u.role === roleFilter;

    let matchPermission = false;

    if (currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN") {
      matchPermission = true;
    } else if (currentUser.role === "MANAGER") {
      if (u.role !== "SUPERADMIN" && u.role !== "ADMIN") {
        if (String(u.id) === String(currentUser.id)) {
          matchPermission = true;
        } else if (u.department_id && String(u.department_id) === String(currentUser.department_id)) {
          matchPermission = true;
        }
      }
    } else {
      if (String(u.id) === String(currentUser.id)) {
        matchPermission = true;
      }
    }

    return matchSearch && matchRole && matchPermission;
  });

  const roleBadge = r => {
    if (r === "SUPERADMIN" || r === "ADMIN") return <span className="badge badge-superadmin">Super Admin</span>;
    if (r === "MANAGER") return <span className="badge badge-manager">Quản lý</span>;
    return <span className="badge badge-staff">Nhân viên</span>;
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <FaUsers style={{ color: "var(--primary)" }} /> {currentUser.role === "MANAGER" ? "Nhân sự nhóm" : "Quản lý Nhân sự"}
          <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-sub)", marginLeft: 4 }}>({filtered.length} nhân sự)</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="search-box">
            <FaSearch size={14} />
            <input placeholder="Tìm mã NV, tên, email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* 🔥 Chỉ SUPERADMIN và ADMIN được thấy nút Thêm nhân sự */}
          {(currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN") && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              <FaUserPlus size={12} /> Thêm nhân sự
            </button>
          )}
        </div>
      </div>

      <div className="tab-bar">
        {ROLES.filter(r => {
          if (currentUser.role === "MANAGER" && (r === "SUPERADMIN" || r === "ADMIN")) return false;
          return true;
        }).map(r => (
          <button key={r} className={`tab-item${roleFilter === r ? " active" : ""}`} onClick={() => setRoleFilter(r)}>{r}</button>
        ))}
      </div>

      <div className="table-wrap">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-light)" }}>Đang tải dữ liệu...</div>
        ) : isRateLimited ? (
          <div style={{ padding: 60, textAlign: "center", color: "#EF4444", background: "#FEF2F2", borderRadius: 12 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <h3 style={{ margin: "0 0 8px 0" }}>Hệ thống đang tạm khóa</h3>
            <p style={{ margin: 0, fontSize: 14 }}>Bạn đang thao tác quá nhanh. Vui lòng đợi khoảng 1 phút rồi ấn F5 để tải lại trang.</p>
          </div>
        ) : (
          <div className="table-wrap-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mã NV</th>
                  <th>Nhân sự</th>
                  <th>Vai trò</th>
                  <th>Phòng ban</th>
                  <th>Lương cơ bản</th>
                  <th>Quỹ phép</th>
                  <th>Trạng thái</th>
                  {currentUser.role === "SUPERADMIN" && <th>Hành động</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td><span className="id-chip">{formatID(u.id)}</span></td>
                    <td>
                      <div className="cell-user">
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                          {(u.full_name || u.username || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="cell-name">{u.full_name || u.username}</div>
                          <div className="cell-sub">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{roleBadge(u.role)}</td>
                    <td style={{ fontSize: 13, color: "var(--text-sub)", fontWeight: u.department_name ? "500" : "400" }}>
                      {u.department_name || "Chưa phân bổ"}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                      {u.base_salary ? Number(u.base_salary).toLocaleString("vi-VN") + " ₫" : "0 ₫"}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>{u.max_leave_days || 12}</span>
                      <span style={{ color: "var(--text-light)" }}> ngày</span>
                    </td>
                    <td>
                      {u.status === "ACTIVE" ? (
                        <span className="badge badge-green">Hoạt động</span>
                      ) : u.status === "PENDING_ADMIN" ? (
                        <span className="badge badge-amber">Chờ duyệt</span>
                      ) : (
                        <span className="badge badge-red">Bị khóa / Xóa</span>
                      )}
                    </td>
                    {currentUser.role === "SUPERADMIN" && (
                      <td>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {String(u.id) !== String(currentUser.id) && (
                            <>
                              {u.status === "PENDING_ADMIN" && (
                                <button className="btn btn-sm" style={{ background: "#22c55e", color: "#fff", border: "none" }} onClick={() => handleApprove(u.id)}>
                                  <FaCheck size={10} style={{ marginRight: 4 }} /> Duyệt
                                </button>
                              )}
                              <button className="btn btn-sm" style={{ background: "var(--bg-page)", border: "1px solid var(--border)", color: "var(--text)" }} onClick={() => openEditModal(u)}>
                                <FaEdit size={12} /> Cài đặt
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={currentUser.role === "SUPERADMIN" ? 8 : 7} style={{ textAlign: "center", padding: 20, color: "var(--text-light)" }}>Không có dữ liệu nhân sự phù hợp.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditModal && editingUser && (
        <EditUserModal user={editingUser} departments={departments} token={token} onClose={() => setShowEditModal(false)} onRefresh={fetchData} />
      )}

      {showAddModal && (
        <AddUserModal departments={departments} token={token} currentUser={currentUser} onClose={() => setShowAddModal(false)} onRefresh={fetchData} />
      )}
    </div>
  );
};

// ════ MODAL SỬA CHI TIẾT NHÂN SỰ ════
const EditUserModal = ({ user, departments, token, onClose, onRefresh }) => {
  const [role, setRole] = useState(user.role || "STAFF");
  const [salary, setSalary] = useState(user.base_salary || 0);
  const [departmentId, setDepartmentId] = useState(user.department_id || "");
  const [maxLeaveDays, setMaxLeaveDays] = useState(user.max_leave_days || 12);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/auth_ser/users/${user.id}/hr-details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          role: role,
          base_salary: salary,
          department_id: departmentId,
          max_leave_days: maxLeaveDays
        })
      });
      if (res.ok) {
        toast.success("Cập nhật hồ sơ nhân sự thành công!");
        onRefresh();
        onClose();
      } else {
        toast.error("Lỗi khi lưu dữ liệu!");
      }
    } catch { toast.error("Lỗi kết nối Server!"); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa tài khoản [${user.username}] không?`)) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/auth_ser/users/${user.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Đã xóa tài khoản!");
        onRefresh();
        onClose();
      }
    } catch { toast.error("Lỗi kết nối Server!"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span>Thiết lập Hồ sơ Nhân sự</span>
          <FaTimes style={{ cursor: "pointer", color: "var(--text-light)" }} onClick={onClose} />
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{user.full_name || user.username}</div>
              <div style={{ color: "var(--text-sub)", fontSize: 13 }}>{user.email}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Phòng ban công tác</label>
              <select className="form-control" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                <option value="">-- Chưa phân bổ --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quỹ phép tiêu chuẩn (ngày/năm)</label>
              <input className="form-control" type="number" value={maxLeaveDays} onChange={e => setMaxLeaveDays(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Lương cơ bản (VND)</label>
              <input className="form-control" type="number" value={salary} onChange={e => setSalary(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Vai trò chức vụ</label>
              <select className="form-control" value={role} onChange={e => setRole(e.target.value)}>
                <option value="STAFF">Nhân viên (STAFF)</option>
                <option value="MANAGER">Quản lý (MANAGER)</option>
                <option value="ADMIN">Quản trị viên (ADMIN)</option>
                <option value="SUPERADMIN">Giám đốc (SUPERADMIN)</option>
              </select>
            </div>
          </div>
          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={isSubmitting}>
              <FaTrashAlt /> Xóa tài khoản
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>Lưu thay đổi</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ════ MODAL THÊM MỚI NHÂN VIÊN ════
const AddUserModal = ({ departments, token, currentUser, onClose, onRefresh }) => {
  const isManager = currentUser.role === "MANAGER";

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    role: "STAFF",
    department_id: isManager ? (currentUser.department_id || "") : ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth_ser/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success("Thêm nhân viên thành công!");
        onRefresh();
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.message || "Lỗi khi thêm nhân viên!");
      }
    } catch { toast.error("Lỗi kết nối Server!"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
        <div className="modal-header">
          <span>Thêm Nhân Sự Mới</span>
          <FaTimes style={{ cursor: "pointer", color: "var(--text-light)" }} onClick={onClose} />
        </div>
        {/* 🔥 TẮT TÍNH NĂNG TỰ ĐỘNG ĐIỀN CỦA TRÌNH DUYỆT Ở CẤP FORM */}
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Tên đăng nhập *</label>
              {/* 🔥 Tắt auto-fill cho tên đăng nhập */}
              <input
                className="form-control"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                className="form-control"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu *</label>
              {/* 🔥 BUỘC TRÌNH DUYỆT NHẬN DIỆN ĐÂY LÀ MẬT KHẨU MỚI BẰNG "new-password" */}
              <input
                className="form-control"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Họ và Tên</label>
              <input
                className="form-control"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phòng ban ban đầu</label>
              <select
                className="form-control"
                name="department_id"
                value={formData.department_id}
                onChange={handleChange}
                disabled={isManager}
              >
                <option value="">-- Chưa phân bổ --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {isManager && (
                <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 4 }}>
                  * Bạn chỉ có thể tạo tài khoản cho nhân viên thuộc phòng ban của mình.
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Vai trò</label>
              <select
                className="form-control"
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={isManager}
              >
                <option value="STAFF">Nhân viên (STAFF)</option>
                {!isManager && <option value="MANAGER">Quản lý (MANAGER)</option>}
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>Thêm mới</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserManagement;