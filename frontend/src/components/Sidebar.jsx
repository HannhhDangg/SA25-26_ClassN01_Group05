import { useNavigate, useLocation } from "react-router-dom";
import {
  FaBuilding, FaThLarge, FaClipboardCheck, FaCalendarAlt,
  FaCalendarCheck, FaCoins, FaUsers, FaBell, FaCog,
  FaSignOutAlt, FaPlusCircle,
} from "react-icons/fa";

// ── Chữ viết tắt tên ────────────────────────────────────────
const getInitials = (name = "") =>
  name.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase();

// ── Dòng menu đơn lẻ ────────────────────────────────────────
const MenuItem = ({ icon: Icon, label, badge, active, onClick }) => (
  <button className={`menu-item${active ? " active" : ""}`} onClick={onClick}>
    <Icon />
    {label}
    {badge > 0 && <span className="menu-badge">{badge}</span>}
  </button>
);

// ════════════════════════════════════════════════════════════
const Sidebar = ({ pendingLeaves = 0 }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const { role, full_name, username, avatar_url } = user;

  const displayName = full_name || username || "Người dùng";
  const initials = getInitials(displayName);
  const roleLabel = {
    SUPERADMIN: "Super Admin",
    ADMIN: "Super Admin",
    MANAGER: "Quản lý",
    STAFF: "Nhân viên",
  }[role] || role;

  // Kiểm tra active: trang gốc khớp chính xác, trang con dùng startsWith
  const isActive = (path) => {
    const exactRoots = ["/admin", "/employee", "/manager"];
    return exactRoots.includes(path)
      ? location.pathname === path
      : location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    if (window.confirm("Bạn có chắc muốn đăng xuất?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  return (
    <div className="sidebar">
      {/* ── Logo ─────────────────────────────────────────── */}
      <div className="logo-area">
        <div className="logo-icon"><FaBuilding size={16} /></div>
        <div>
          <div>HRM System</div>
          <span className="logo-sub">Quản lý nhân sự</span>
        </div>
      </div>

      {/* ── Menu theo role ────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>

        {/* ════ SUPERADMIN / ADMIN ════ */}
        {(role === "SUPERADMIN" || role === "ADMIN") && (
          <>
            <div className="menu-label">Tổng quan</div>
            <MenuItem icon={FaThLarge} label="Trang chủ" active={isActive("/admin")} onClick={() => navigate("/admin")} />

            <div className="menu-label">Nghiệp vụ</div>
            <MenuItem icon={FaClipboardCheck} label="Chấm công" active={isActive("/admin/attendance")} onClick={() => navigate("/admin/attendance")} />
            {/* SuperAdmin KHÔNG có tạo đơn nghỉ phép, chỉ duyệt */}
            <MenuItem icon={FaCalendarAlt} label="Quản lý nghỉ phép" active={isActive("/admin/leaves")} onClick={() => navigate("/admin/leaves")} badge={pendingLeaves} />
            <MenuItem icon={FaCalendarCheck} label="Lịch & Ca làm" active={isActive("/admin/schedule")} onClick={() => navigate("/admin/schedule")} />
            <MenuItem icon={FaCoins} label="Tính lương" active={isActive("/admin/salary")} onClick={() => navigate("/admin/salary")} />

            <div className="menu-label">Quản trị</div>
            <MenuItem icon={FaUsers} label="Quản lý nhân sự" active={isActive("/admin/users")} onClick={() => navigate("/admin/users")} />
            {/* Chỉ SuperAdmin mới gửi thông báo chung thời gian thực */}
            <MenuItem icon={FaBell} label="Thông báo chung" active={isActive("/admin/announcements")} onClick={() => navigate("/admin/announcements")} />
            <MenuItem icon={FaCog} label="Cài đặt" active={isActive("/admin/settings")} onClick={() => navigate("/admin/settings")} />
          </>
        )}

        {/* ════ MANAGER (Quản lý) ════ */}
        {role === "MANAGER" && (
          <>
            <div className="menu-label">Tổng quan</div>
            <MenuItem icon={FaThLarge} label="Trang chủ" active={isActive("/manager")} onClick={() => navigate("/manager")} />

            <div className="menu-label">Nghiệp vụ</div>
            <MenuItem icon={FaClipboardCheck} label="Chấm công" active={isActive("/manager/attendance")} onClick={() => navigate("/manager/attendance")} />
            {/* Manager có thể tạo đơn nghỉ cho bản thân */}
            <MenuItem icon={FaPlusCircle} label="Tạo đơn nghỉ phép" active={isActive("/manager/leaves/new")} onClick={() => navigate("/manager/leaves/new")} />
            <MenuItem icon={FaCalendarAlt} label="Duyệt nghỉ phép" active={isActive("/manager/leaves")} onClick={() => navigate("/manager/leaves")} badge={pendingLeaves} />
            <MenuItem icon={FaCalendarCheck} label="Lịch & Ca làm" active={isActive("/manager/schedule")} onClick={() => navigate("/manager/schedule")} />
            <MenuItem icon={FaUsers} label="Nhân sự nhóm" active={isActive("/manager/users")} onClick={() => navigate("/manager/users")} />
          </>
        )}

        {/* ════ STAFF (Nhân viên) ════ */}
        {role === "STAFF" && (
          <>
            <div className="menu-label">Cá nhân</div>
            <MenuItem icon={FaThLarge} label="Trang chủ" active={isActive("/employee")} onClick={() => navigate("/employee")} />
            <MenuItem icon={FaClipboardCheck} label="Chấm công" active={isActive("/employee/attendance")} onClick={() => navigate("/employee/attendance")} />
            {/* Nhân viên có thể tạo đơn nghỉ phép */}
            <MenuItem icon={FaPlusCircle} label="Tạo đơn nghỉ phép" active={isActive("/employee/leaves/new")} onClick={() => navigate("/employee/leaves/new")} />
            <MenuItem icon={FaCalendarAlt} label="Lịch sử nghỉ phép" active={isActive("/employee/leaves")} onClick={() => navigate("/employee/leaves")} />
            <MenuItem icon={FaCalendarCheck} label="Lịch làm việc" active={isActive("/employee/schedule")} onClick={() => navigate("/employee/schedule")} />
            <MenuItem icon={FaCoins} label="Xem lương" active={isActive("/employee/salary")} onClick={() => navigate("/employee/salary")} />
          </>
        )}
      </div>

      {/* ── Footer: user + logout ─────────────────────────── */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          {avatar_url ? (
            <img src={avatar_url} alt={displayName}
              style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.2)", flexShrink: 0 }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ) : (
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "#3B5BDB",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600, color: "#fff", flexShrink: 0,
            }}>
              {initials}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-user-name">{displayName}</div>
            <div className="sidebar-user-role">{roleLabel}</div>
          </div>
        </div>
        <button className="menu-item logout-btn" onClick={handleLogout}>
          <FaSignOutAlt /> Đăng xuất
        </button>
      </div>
    </div>
  );
};

export default Sidebar;