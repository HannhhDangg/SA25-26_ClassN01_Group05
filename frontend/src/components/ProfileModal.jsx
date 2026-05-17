import { useState, useRef, useEffect } from "react";
import { FaCamera } from "react-icons/fa";

const ProfileModal = ({ isOpen, onClose, user, onUpdateUser }) => {
  const [formData, setFormData] = useState({ full_name: "", phone_number: "", email: "" });
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        phone_number: user.phone_number || "",
        email: user.email || "",
      });
      setPreviewUrl(user.avatar_url || "");
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const dataToSend = new FormData();
      dataToSend.append("full_name", formData.full_name);
      dataToSend.append("phone_number", formData.phone_number);

      if (selectedFile) dataToSend.append("avatar", selectedFile);
      else dataToSend.append("avatar_url", user.avatar_url || "");

      const res = await fetch(`/api/users/${user.id}`, { method: "PUT", body: dataToSend });
      const data = await res.json();

      if (res.ok) {
        alert("Cập nhật thành công!");
        const updatedUser = { ...user, ...data.user };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        onUpdateUser(updatedUser);
        onClose();
      } else {
        alert("Lỗi: " + (data.message || "Không thể lưu"));
      }
    } catch (err) {
      alert("Lỗi kết nối server!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">Cập nhật Hồ Sơ</div>

        <div className="modal-avatar-upload">
          <div style={{ cursor: "pointer", position: "relative", display: "inline-block" }} onClick={() => fileInputRef.current.click()}>
            <img src={previewUrl || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} alt="Avatar" className="modal-avatar-img" onError={(e) => { e.target.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, textAlign: "center", borderRadius: "0 0 50px 50px", padding: "5px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <FaCamera size={11} /> Đổi ảnh
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} accept="image/*" />
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Họ và tên</label>
            <input name="full_name" value={formData.full_name} onChange={handleChange} className="form-control" placeholder="Nhập họ tên của bạn..." />
          </div>
          <div className="form-group">
            <label className="form-label">Số điện thoại</label>
            <input name="phone_number" value={formData.phone_number} onChange={handleChange} className="form-control" placeholder="Nhập số điện thoại..." />
          </div>
          <div className="form-group">
            <label className="form-label">Email <span style={{ fontSize: 11, color: "var(--text-light)", fontWeight: 400 }}>(không thể sửa)</span></label>
            <input value={formData.email} disabled className="form-control" />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Hủy bỏ</button>
          <button className="btn-save" onClick={handleSave} disabled={loading}>{loading ? "Đang lưu..." : "Lưu thay đổi"}</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;