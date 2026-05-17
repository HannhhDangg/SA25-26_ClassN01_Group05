import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { FaUsers, FaSearch, FaUserPlus, FaEdit, FaTimes, FaTrashAlt, FaCheck } from "react-icons/fa";

const ROLES = ["Tất cả", "SUPERADMIN", "MANAGER", "STAFF"];

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("Tất cả");

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const formatID = id => `HD${String(id).padStart(2, "0")}`;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth_ser/users", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { toast.error("Không thể tải danh sách!"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchUsers();
    const socket = io("/", { transports: ["websocket", "polling"], upgrade: true });
    socket.on("new_leave_request", d => toast.info("🔔 " + d.message));
    return () => socket.disconnect();
  }, []);

  // ✅ HÀM KÍCH HOẠT / DUYỆT TÀI KHOẢN MỚI THÊM VÀO
  const handleApprove = async (userId) => {
    if (!window.confirm("Bạn có chắc chắn muốn duyệt và kích hoạt tài khoản này không?")) return;
    try {
      const res = await fetch(`/api/auth_ser/users/${userId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: "ACTIVE" })
      });
      if (res.ok) {
        toast.success("Kích hoạt tài khoản thành công! 🎉");
        fetchUsers(); // Tải lại danh sách sau khi duyệt
      } else {
        const data = await res.json();
        toast.error(data.message || "Lỗi khi kích hoạt tài khoản!");
      }
    } catch (err) {
      toast.error("Lỗi kết nối Server!");
    }
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
    return matchSearch && matchRole;
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
          <FaUsers style={{ color: "var(--primary)" }} /> Quản lý Nhân sự
          <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-sub)", marginLeft: 4 }}>({users.length} nhân viên)</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="search-box">
            <FaSearch size={14} />
            <input placeholder="Tìm mã NV, tên, email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <FaUserPlus size={12} /> Thêm nhân viên
          </button>
        </div>
      </div>

      <div className="tab-bar">
        {ROLES.map(r => (
          <button key={r} className={`tab-item${roleFilter === r ? " active" : ""}`} onClick={() => setRoleFilter(r)}>{r}</button>
        ))}
      </div>

      <div className="table-wrap">
        {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-light)" }}>Đang tải dữ liệu...</div> : (
          <div className="table-wrap-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mã NV</th>
                  <th>Nhân viên</th>
                  <th>Vai trò</th>
                  <th>Phòng ban</th>
                  <th>Lương cơ bản</th>
                  <th>Quỹ phép</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--text-light)" }}>Không tìm thấy nhân viên phù hợp.</td></tr>
                )}
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
                    <td style={{ fontSize: 13, color: "var(--text-sub)" }}>{u.department_name || "Chưa phân bổ"}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                      {u.base_salary ? Number(u.base_salary).toLocaleString("vi-VN") + " ₫" : <span style={{ color: "var(--text-light)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>{u.max_leave_days || 0}</span>
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
                    <td>
                      {!["SUPERADMIN", "ADMIN"].includes(u.role) && (
                        <div style={{ display: "flex", gap: 5 }}>

                          {/* ✅ NÚT DUYỆT CHỈ XUẤT HIỆN KHI TÀI KHOẢN ĐANG CHỜ DUYỆT */}
                          {u.status === "PENDING_ADMIN" && (
                            <button className="btn btn-sm" style={{ background: "#22c55e", color: "#fff", border: "none" }} title="Duyệt tài khoản" onClick={() => handleApprove(u.id)}>
                              <FaCheck size={10} style={{ marginRight: 4 }} /> Duyệt
                            </button>
                          )}

                          <button className="btn btn-sm" style={{ background: "var(--bg-page)", border: "1px solid var(--border)", color: "var(--text)" }} title="Thiết lập" onClick={() => openEditModal(u)}>
                            <FaEdit size={12} /> Cài đặt
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditModal && editingUser && (
        <EditUserModal user={editingUser} token={token} onClose={() => setShowEditModal(false)} onRefresh={fetchUsers} />
      )}

      {showAddModal && (
        <AddUserModal token={token} onClose={() => setShowAddModal(false)} onRefresh={fetchUsers} />
      )}
    </div>
  );
};

const EditUserModal = ({ user, token, onClose, onRefresh }) => {
  const [role, setRole] = useState(user.role || "STAFF");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (role === user.role) return onClose();

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/auth_ser/users/${user.id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        toast.success("Cập nhật vai trò thành công!");
        onRefresh();
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.message || "Lỗi khi cập nhật vai trò!");
      }
    } catch (err) {
      toast.error("Lỗi kết nối Server!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa hoàn toàn tài khoản của [${user.username}] khỏi hệ thống không?`)) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/auth_ser/users/${user.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Đã xóa tài khoản thành công!");
        onRefresh();
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.message || "Lỗi khi xóa tài khoản!");
      }
    } catch (err) {
      toast.error("Lỗi kết nối Server!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Cài đặt Tài khoản</span>
          <FaTimes style={{ cursor: "pointer", color: "var(--text-light)" }} onClick={onClose} />
        </div>

        <div className="modal-body" style={{ textAlign: "center", paddingBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text)" }}>{user.full_name || user.username}</div>
          <div style={{ color: "var(--text-sub)", fontSize: 13, marginBottom: 20 }}>{user.email}</div>
        </div>

        <form onSubmit={handleSaveRole}>
          <div className="modal-body" style={{ paddingTop: 0 }}>
            <div className="form-group">
              <label className="form-label">Phân quyền vai trò</label>
              <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="STAFF">Nhân viên (STAFF)</option>
                <option value="MANAGER">Quản lý (MANAGER)</option>
              </select>
            </div>
          </div>

          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={isSubmitting} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FaTrashAlt /> Xóa tài khoản
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Đang xử lý..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddUserModal = ({ token, onClose, onRefresh }) => {
  const [formData, setFormData] = useState({ username: "", email: "", password: "", full_name: "", role: "STAFF" });
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
      const data = await res.json();
      if (res.ok) {
        toast.success("Thêm nhân viên thành công!");
        onRefresh();
        onClose();
      } else {
        toast.error(data.message || "Lỗi khi thêm nhân viên!");
      }
    } catch (err) {
      toast.error("Lỗi kết nối Server!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Thêm Nhân Viên Mới</span>
          <FaTimes style={{ cursor: "pointer", color: "var(--text-light)" }} onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Tên đăng nhập *</label>
              <input className="form-control" name="username" value={formData.username} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-control" type="email" name="email" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu *</label>
              <input className="form-control" type="password" name="password" value={formData.password} onChange={handleChange} required minLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label">Họ và Tên</label>
              <input className="form-control" name="full_name" value={formData.full_name} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Vai trò</label>
              <select className="form-control" name="role" value={formData.role} onChange={handleChange}>
                <option value="STAFF">Nhân viên (STAFF)</option>
                <option value="MANAGER">Quản lý (MANAGER)</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Đang xử lý..." : "Thêm mới"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserManagement;