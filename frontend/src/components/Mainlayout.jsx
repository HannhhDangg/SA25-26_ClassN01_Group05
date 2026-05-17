import { useState, useEffect } from "react";
import { FaBell } from "react-icons/fa";
import Sidebar from "./Sidebar";
import ProfileModal from "./ProfileModal";

const MainLayout = ({ children }) => {
  const [currentUser, setCurrentUser] = useState({});
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setCurrentUser(user);
  }, []);

  const handleUpdateUser = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  const displayName = currentUser.full_name || currentUser.username || "";
  const initials = displayName
    .split(" ")
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="main-content">
        <div className="top-header">
          <div
            style={{
              width: 34, height: 34,
              border: "1px solid var(--border)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--text-sub)",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-page)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <FaBell size={15} />
          </div>

          <div
            className="user-profile-box"
            onClick={() => setShowModal(true)}
            style={{ cursor: "pointer" }}
          >
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                {currentUser.full_name || currentUser.username}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-light)" }}>
                {currentUser.role}
              </div>
            </div>

            {currentUser.avatar_url ? (
              <div className="avatar-circle">
                <img
                  src={currentUser.avatar_url}
                  alt="User"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
            ) : (
              <div className="avatar-initials">{initials}</div>
            )}
          </div>
        </div>

        <div className="page-scroll">{children}</div>
      </div>

      <ProfileModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        user={currentUser}
        onUpdateUser={handleUpdateUser}
      />
    </div>
  );
};

export default MainLayout;