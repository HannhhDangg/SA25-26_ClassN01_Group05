import { useState, useEffect, useCallback } from "react";
import { FaBell } from "react-icons/fa";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import ProfileModal from "./ProfileModal";
import { io } from "socket.io-client";
import { toast } from "react-toastify";

const MainLayout = ({ children }) => {
  const [currentUser, setCurrentUser] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0); // 🔥 THÊM STATE UNREAD NOTI

  const fetchPendingCount = useCallback(async (userObj) => {
    if (!userObj || !userObj.role) return;
    try {
      const token = localStorage.getItem("token");

      // Đề phòng tài khoản cũ lưu trong trình duyệt bị mất email/phòng ban
      const safeEmail = userObj.email || "";
      const safeDept = userObj.department_id || "";

      // 🔥 Lấy thông báo chưa đọc cho TẤT CẢ các Role
      const resNoti = await fetch(`/api/noti_ser/announcements?role=${userObj.role}&email=${safeEmail}&department_id=${safeDept}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (resNoti.ok) {
        const dataNoti = await resNoti.json();
        const unreadCount = Array.isArray(dataNoti) ? dataNoti.filter(a => !a.is_read).length : 0;
        setUnreadAnnouncements(unreadCount);
      }

      // Nếu là STAFF thì dừng lại, không cần fetch pending leaves / pending users
      if (userObj.role === "STAFF") return;

      const res = await fetch("/api/leave_ser/pending-count", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.status === 429) return;
      if (res.ok) {
        const data = await res.json();
        setPendingLeavesCount(data.count || 0); // Backend đã đếm sẵn, trả về bao nhiêu hiện bấy nhiêu
      }

      // Đếm số nhân sự mới chờ duyệt
      const resUsers = await fetch("/api/auth_ser/users/pending-count", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (resUsers.ok) {
        const dataUsers = await resUsers.json();
        setPendingUsersCount(dataUsers.count || 0);
      }
    } catch (error) { console.error("Lỗi lấy số đếm:", error); }
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setCurrentUser(user);
    fetchPendingCount(user);

    const socket = io("/", { transports: ["websocket", "polling"], upgrade: true });

    // 1. NGHE TIẾNG GỌI: Có người nộp đơn!
    socket.on("new_leave_request", (data) => {
      // Bao trọn cả 2 role ADMIN và SUPERADMIN để Sếp chắc chắn nhận được
      const isDirector = user.role === "SUPERADMIN" || user.role === "ADMIN";

      if (data.target_role === "SUPERADMIN" && isDirector) {
        fetchPendingCount(user); // Tăng số đếm ở chuông đỏ
        toast.info(data.message); // 🔥 HIỆN THÔNG BÁO NỔI CHO GIÁM ĐỐC
      } else if (data.target_role === "MANAGER" && user.role === "MANAGER" && String(data.target_department) === String(user.department_id)) {
        fetchPendingCount(user); // Tăng số đếm ở chuông đỏ
        toast.info(data.message); // 🔥 HIỆN THÔNG BÁO NỔI CHO TRƯỞNG PHÒNG
      }
    });

    // 2. NGHE TIẾNG TRẢ LỜI: Đơn đã được Sếp duyệt xong! 
    socket.on("leave_status_update", (data) => {
      fetchPendingCount(user); // Tụt số chuông đỏ xuống

      // NẾU LÀ ĐƠN CỦA MÌNH THÌ HIỆN THÔNG BÁO BÁO KẾT QUẢ
      if (String(data.target_user_id) === String(user.id)) {
        if (data.status === "APPROVED") {
          toast.success(data.message);
        } else if (data.status === "REJECTED") {
          toast.error(data.message);
        } else {
          toast.info(data.message);
        }
      }
    });

    // 3. NGHE TIẾNG GỌI: Có nhân sự mới đăng ký!
    socket.on("new_user_registered", (data) => {
      const isDirector = user.role === "SUPERADMIN" || user.role === "ADMIN";
      if (data.target_role === "SUPERADMIN" && isDirector) {
        fetchPendingCount(user);
        if (data.message) toast.info(data.message);
      } else if (data.target_role === "MANAGER" && user.role === "MANAGER" && String(data.target_department) === String(user.department_id)) {
        fetchPendingCount(user);
        if (data.message) toast.info(data.message);
      }
    });

    // 4. NGHE TIẾNG GỌI: Có thông báo chung mới!
    socket.on("new_announcement", (data) => {
        let shouldShow = false;
        const safeEmail = user.email || "";
        const safeDept = user.department_id || "";

        if (data.target_type === "ALL") shouldShow = true;
        if (data.target_type === "ROLE" && data.target_role === user.role) shouldShow = true;
        if (data.target_type === "DEPT_STAFF" && user.role === "STAFF" && String(data.department_id) === String(safeDept)) shouldShow = true;
        if (data.target_type === "INDIVIDUAL" && data.target_email === safeEmail) shouldShow = true;

        if (shouldShow) {
            fetchPendingCount(user);
            toast.info("🔔 Bạn có một thông báo mới từ hệ thống!"); // Hiển thị popup góc phải
        }
    });

    return () => socket.disconnect();
  }, [fetchPendingCount]);

  const handleUpdateUser = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  const initials = (currentUser.full_name || currentUser.username || "")
    .split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();

  return (
    <div className="dashboard-container">
      <Sidebar pendingLeaves={pendingLeavesCount} pendingUsers={pendingUsersCount} unreadNoti={unreadAnnouncements} />

      <div className="main-content">
        <div className="top-header">
          <div
            style={{
              position: "relative", width: 34, height: 34, border: "1px solid var(--border)",
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--text-sub)", transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-page)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <FaBell size={15} />
            {/* THÔNG BÁO ĐỎ CỦA CHUÔNG */}
            {(pendingLeavesCount + pendingUsersCount + unreadAnnouncements) > 0 && (
              <span style={{
                position: "absolute", top: -6, right: -6, background: "#EF4444", color: "#fff",
                fontSize: 10, fontWeight: "bold", minWidth: 16, height: 16, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                border: "2px solid #fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}>
                {pendingLeavesCount + pendingUsersCount + unreadAnnouncements}
              </span>
            )}
          </div>

          <div className="user-profile-box" onClick={() => setShowModal(true)} style={{ cursor: "pointer" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{currentUser.full_name || currentUser.username}</div>
              <div style={{ fontSize: 11, color: "var(--text-light)" }}>{currentUser.role === "SUPERADMIN" ? "Super Admin" : currentUser.role === "MANAGER" ? "Quản lý" : "Nhân viên"}</div>
            </div>
            {currentUser.avatar_url ? (
              <div className="avatar-circle"><img src={currentUser.avatar_url} alt="User" onError={e => e.target.style.display = "none"} /></div>
            ) : <div className="avatar-initials">{initials}</div>}
          </div>
        </div>

        <div className="page-scroll">
          {children ? children : <Outlet />}
        </div>
      </div>

      <ProfileModal isOpen={showModal} onClose={() => setShowModal(false)} user={currentUser} onUpdateUser={handleUpdateUser} />
    </div>
  );
};

export default MainLayout;