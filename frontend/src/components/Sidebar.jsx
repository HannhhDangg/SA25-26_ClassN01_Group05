import { useNavigate, useLocation } from "react-router-dom";
import {
  FaChartPie,
  FaUsers,
  FaUserCircle,
  FaPlusCircle,
  FaSignOutAlt,
  FaLeaf,
} from "react-icons/fa";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const goTo = (path) => navigate(path);

  // Logic kiểm tra Active chuẩn xác (để đổi màu menu khi đang ở trang đó)
  const isActive = (path) => {
    // Nếu là trang gốc (/admin hoặc /employee) -> Phải giống hệt mới sáng
    if (path === "/admin" || path === "/employee") {
      return location.pathname === path ? "menu-item active" : "menu-item";
    }
    // Các trang con -> Dùng startsWith để bao gồm cả các trang sâu hơn
    return location.pathname.startsWith(path)
      ? "menu-item active"
      : "menu-item";
  };

  // Logic đăng xuất
  const handleLogout = () => {
    if (window.confirm("Bạn có chắc muốn đăng xuất?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  return (
    <div className="sidebar">
      <div className="logo-area">
        <FaLeaf size={24} /> LeaveApp
      </div>

      {/* --- MENU QUẢN TRỊ (Chỉ hiển thị cho SUPERADMIN và MANAGER) --- */}
      {(user.role === "SUPERADMIN" || user.role === "MANAGER") && (
        <>
          <div className="menu-label">Quản lý hệ thống</div>

          <div className={isActive("/admin")} onClick={() => goTo("/admin")}>
            <FaChartPie /> Tổng quan
          </div>

          <div
            className={isActive("/admin/leaves")}
            onClick={() => goTo("/admin/leaves")}
          >
            <FaPlusCircle /> Duyệt đơn nghỉ
          </div>

          {/* CHỈ MỘT MÌNH SUPERADMIN MỚI ĐƯỢC THẤY VÀ VÀO QUẢN LÝ NHÂN SỰ */}
          {user.role === "SUPERADMIN" && (
            <div
              className={isActive("/admin/users")}
              onClick={() => goTo("/admin/users")}
            >
              <FaUsers /> Quản lý nhân sự
            </div>
          )}
        </>
      )}

      {/* --- MENU CÁ NHÂN (Hiển thị cho TẤT CẢ mọi người, kể cả STAFF) --- */}
      <div className="menu-label">Khu vực cá nhân</div>
      <div
        className={isActive("/employee")}
        onClick={() => goTo("/employee")}
      >
        <FaUserCircle /> Bảng tin của tôi
      </div>
      <div
        className={isActive("/employee/leaves")}
        onClick={() => goTo("/employee/leaves")}
      >
        <FaPlusCircle /> Quản lý nghỉ phép
      </div>

      {/* Nút Đăng xuất luôn nằm ở dưới cùng */}
      <button
        className="menu-item logout-btn"
        onClick={handleLogout}
        style={{ marginTop: "auto" }}
      >
        <FaSignOutAlt /> Đăng xuất
      </button>
    </div>
  );
};

export default Sidebar;