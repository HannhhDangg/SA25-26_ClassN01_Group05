import { useNavigate, useLocation } from "react-router-dom";
import {
  FaBuilding, FaThLarge, FaClipboardCheck, FaCalendarAlt,
  FaCalendarCheck, FaCoins, FaUsers, FaBell, FaCog,
  FaSignOutAlt, FaPlusCircle, FaHistory
} from "react-icons/fa";

const getInitials = (name = "") =>
  name.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase();

const MenuItem = ({ icon: Icon, label, badge, active, onClick }) => (
  <button className={`menu-item${active ? " active" : ""}`} onClick={onClick}>
    <Icon />
    {label}
    {badge > 0 && <span className="menu-badge">{badge}</span>}
  </button>
);

const Sidebar = ({ pendingLeaves = 0, pendingUsers = 0, unreadNoti = 0 }) => {
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

  const isActive = (path) => {
    // Với các trang gốc hoặc trang cha (có trang con lồng bên trong), ta phải bắt buộc khớp chính xác 100%
    const exactPaths = ["/admin", "/employee", "/admin/leaves", "/employee/leaves"];

    if (exactPaths.includes(path)) {
      return location.pathname === path;
    }

    // Với các trang khác, vẫn dùng logic bắt đầu bằng để hỗ trợ các ID động (vd: /admin/users/123)
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc muốn đăng xuất?")) {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          await fetch("/api/auth_ser/logout", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
          });
        } catch (err) { console.error("Lỗi đăng xuất:", err); }
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  return (
    <div className="sidebar">
      <div className="logo-area">
        <div className="logo-icon"><FaBuilding size={16} /></div>
        <div>
          <div>HRM System</div>
          <span className="logo-sub">Quản lý nhân sự</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>

        {/* ════ 1. SUPERADMIN / ADMIN (Giám đốc) ════ */}
        {(role === "SUPERADMIN" || role === "ADMIN") && (
          <>
            <div className="menu-label">Tổng quan</div>
            <MenuItem icon={FaThLarge} label="Trang chủ" active={isActive("/admin")} onClick={() => navigate("/admin")} />

            <div className="menu-label">Nghiệp vụ</div>
            <MenuItem icon={FaCalendarAlt} label="Quản lý nghỉ phép" active={isActive("/admin/leaves")} onClick={() => navigate("/admin/leaves")} badge={pendingLeaves} />
            <MenuItem icon={FaCalendarCheck} label="Lịch & Ca làm" active={isActive("/admin/schedule")} onClick={() => navigate("/admin/schedule")} />
            <MenuItem icon={FaCoins} label="Tính lương" active={isActive("/admin/salary")} onClick={() => navigate("/admin/salary")} />

            <div className="menu-label">Quản trị</div>
            <MenuItem icon={FaUsers} label="Quản lý nhân sự" active={isActive("/admin/users")} onClick={() => navigate("/admin/users")} badge={pendingUsers} />
            {/* Đã có cho Superadmin */}
            <MenuItem icon={FaBell} label="Thông báo" active={isActive("/admin/announcements")} onClick={() => navigate("/admin/announcements")} badge={unreadNoti} />
            <MenuItem icon={FaCog} label="Cài đặt" active={isActive("/admin/settings")} onClick={() => navigate("/admin/settings")} />
          </>
        )}

        {/* ════ 2. MANAGER (Quản lý cấp trung) ════ */}
        {role === "MANAGER" && (
          <>
            <div className="menu-label">Tổng quan</div>
            <MenuItem icon={FaThLarge} label="Trang chủ" active={isActive("/admin")} onClick={() => navigate("/admin")} />

            <div className="menu-label">Nghiệp vụ</div>
            <MenuItem icon={FaClipboardCheck} label="Chấm công" active={isActive("/admin/attendance")} onClick={() => navigate("/admin/attendance")} />

            <MenuItem icon={FaPlusCircle} label="Tạo đơn nghỉ phép" active={isActive("/admin/leaves/new")} onClick={() => navigate("/admin/leaves/new")} />
            <MenuItem icon={FaHistory} label="Lịch sử nghỉ phép" active={isActive("/admin/leaves/history")} onClick={() => navigate("/admin/leaves/history")} />
            <MenuItem icon={FaCalendarAlt} label="Duyệt nghỉ phép" active={isActive("/admin/leaves")} onClick={() => navigate("/admin/leaves")} badge={pendingLeaves} />

            <MenuItem icon={FaCalendarCheck} label="Lịch & Ca làm" active={isActive("/admin/schedule")} onClick={() => navigate("/admin/schedule")} />
            <MenuItem icon={FaCoins} label="Tính lương" active={isActive("/admin/salary")} onClick={() => navigate("/admin/salary")} />
            <MenuItem icon={FaUsers} label="Nhân sự nhóm" active={isActive("/admin/users")} onClick={() => navigate("/admin/users")} badge={pendingUsers} />

            {/* 🔥 MỚI THÊM: Trạm thông báo cho MANAGER */}
            <MenuItem icon={FaBell} label="Thông báo" active={isActive("/admin/announcements")} onClick={() => navigate("/admin/announcements")} badge={unreadNoti} />
          </>
        )}

        {/* ════ 3. STAFF (Nhân viên) ════ */}
        {role === "STAFF" && (
          <>
            <div className="menu-label">Cá nhân</div>
            <MenuItem icon={FaThLarge} label="Trang chủ" active={isActive("/employee")} onClick={() => navigate("/employee")} />
            <MenuItem icon={FaClipboardCheck} label="Chấm công" active={isActive("/employee/attendance")} onClick={() => navigate("/employee/attendance")} />
            <MenuItem icon={FaPlusCircle} label="Tạo đơn nghỉ phép" active={isActive("/employee/leaves/new")} onClick={() => navigate("/employee/leaves/new")} />
            <MenuItem icon={FaHistory} label="Lịch sử nghỉ phép" active={isActive("/employee/leaves/history")} onClick={() => navigate("/employee/leaves/history")} />
            <MenuItem icon={FaCalendarCheck} label="Lịch làm việc" active={isActive("/employee/schedule")} onClick={() => navigate("/employee/schedule")} />
            <MenuItem icon={FaCoins} label="Xem lương" active={isActive("/employee/salary")} onClick={() => navigate("/employee/salary")} />

            {/* 🔥 MỚI THÊM: Hòm thư thông báo cho STAFF */}
            <MenuItem icon={FaBell} label="Thông báo" active={isActive("/employee/announcements")} onClick={() => navigate("/employee/announcements")} badge={unreadNoti} />
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          {avatar_url ? (
            <img src={avatar_url} alt={displayName}
              style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.2)", flexShrink: 0 }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ) : (
            <div style={{
              width: 30, height: 30, borderRadius: "50%", background: "var(--primary)",
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