const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");
const LeaveLog = require("../models/LeaveLog");

// --- 1. ADMIN: Lấy thống kê tổng quan (Giữ nguyên) ---
router.get("/stats/admin-summary", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });
    const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

    let totalUsers = 0;
    let absentToday = 0;
    let pendingLeaves = 0;

    if (currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN") {
      const userRes = await pool.query("SELECT COUNT(*) FROM users");
      const absentRes = await pool.query(`SELECT COUNT(*) FROM leave_requests WHERE status = 'APPROVED' AND CURRENT_DATE BETWEEN start_date AND end_date`);

      // Giám đốc CHỈ đếm đơn chờ duyệt CỦA MANAGER (vì Manager xin nghỉ thì Giám đốc duyệt)
      const pendingRes = await pool.query(`
        SELECT COUNT(*) FROM leave_requests lr
        JOIN users u ON lr.user_id = u.id
        WHERE lr.status = 'PENDING' AND u.role = 'MANAGER'
      `);

      totalUsers = parseInt(userRes.rows[0].count);
      absentToday = parseInt(absentRes.rows[0].count);
      pendingLeaves = parseInt(pendingRes.rows[0].count);

    } else if (currentUser.role === "MANAGER") {
      const getDept = await pool.query("SELECT id FROM departments WHERE manager_id = $1", [currentUser.id]);
      if (getDept.rows.length > 0) {
        const deptId = getDept.rows[0].id;
        const userRes = await pool.query("SELECT COUNT(*) FROM users WHERE department_id = $1 OR id = $2", [deptId, currentUser.id]);
        const absentRes = await pool.query(`
          SELECT COUNT(*) FROM leave_requests lr JOIN users u ON lr.user_id = u.id
          WHERE lr.status = 'APPROVED' AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date AND (u.department_id = $1 OR u.id = $2)
        `, [deptId, currentUser.id]);

        // Trưởng phòng CHỈ đếm đơn chờ duyệt CỦA NHÂN VIÊN dưới quyền (Không đếm đơn của chính mình)
        const pendingRes = await pool.query(`
          SELECT COUNT(*) FROM leave_requests lr JOIN users u ON lr.user_id = u.id
          WHERE lr.status = 'PENDING' AND u.department_id = $1 AND u.id != $2
        `, [deptId, currentUser.id]);

        totalUsers = parseInt(userRes.rows[0].count);
        absentToday = parseInt(absentRes.rows[0].count);
        pendingLeaves = parseInt(pendingRes.rows[0].count);
      } else {
        totalUsers = 1;
        const absentSelf = await pool.query(`SELECT COUNT(*) FROM leave_requests WHERE status = 'APPROVED' AND user_id = $1 AND CURRENT_DATE BETWEEN start_date AND end_date`, [currentUser.id]);
        absentToday = parseInt(absentSelf.rows[0].count);
        pendingLeaves = 0; // Không có phòng thì làm gì có ai trình đơn lên mà đếm
      }
    }
    res.json({ totalUsers: totalUsers, absentToday: absentToday, checkedIn: 0, pendingLeaves: pendingLeaves });
  } catch (err) { res.status(500).json({ message: "Lỗi thống kê admin" }); }
});

// --- 2. Xem số dư phép (Giữ nguyên) ---
router.get("/balance/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const currentYear = new Date().getFullYear();
  try {
    const userRes = await pool.query("SELECT max_leave_days FROM users WHERE id = $1", [user_id]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: "User not found" });

    const maxDays = userRes.rows[0].max_leave_days || 12;
    const usedRes = await pool.query(`SELECT SUM(total_days) as used FROM leave_requests WHERE user_id = $1 AND status = 'APPROVED' AND EXTRACT(YEAR FROM start_date) = $2`, [user_id, currentYear]);
    const usedDays = parseInt(usedRes.rows[0].used) || 0;
    res.json({ used: usedDays, max: maxDays, remaining: maxDays - usedDays });
  } catch (err) { res.status(500).json({ message: "Lỗi lấy số dư phép" }); }
});

// --- 3. Tạo đơn nghỉ phép (Đã sửa logic bắn Socket thông minh) ---
router.post("/", async (req, res) => {
  const { user_id, reason, start_date, end_date, total_days } = req.body;
  const currentYear = new Date().getFullYear();

  try {
    if (total_days > 3) return res.status(400).json({ message: "Không được nghỉ liên tiếp quá 3 ngày để đảm bảo vận hành ca!" });

    const userRes = await pool.query("SELECT full_name, max_leave_days, role, department_id FROM users WHERE id = $1", [user_id]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: "User not found" });

    const sender = userRes.rows[0];
    const fullName = sender.full_name;
    const maxDays = sender.max_leave_days || 12;

    const usedRes = await pool.query(`SELECT SUM(total_days) as used FROM leave_requests WHERE user_id = $1 AND status = 'APPROVED' AND EXTRACT(YEAR FROM start_date) = $2`, [user_id, currentYear]);
    const usedDays = parseInt(usedRes.rows[0].used) || 0;

    if (usedDays + total_days > maxDays) return res.status(400).json({ message: `Không đủ ngày phép! (Đã dùng: ${usedDays}/${maxDays})` });

    const checkLimit = await pool.query(`SELECT COUNT(*) as count FROM leave_requests WHERE status = 'APPROVED' AND (start_date <= $2 AND end_date >= $1)`, [start_date, end_date]);
    if (parseInt(checkLimit.rows[0].count) >= 5) return res.status(400).json({ message: "Số người nghỉ trong ngày này 5/5 người!" });

    const result = await pool.query(`INSERT INTO leave_requests (user_id, reason, start_date, end_date, total_days, status) VALUES ($1, $2, $3, $4, $5, 'PENDING') RETURNING *`, [user_id, reason, start_date, end_date, total_days]);
    const newLeave = result.rows[0];

    await LeaveLog.create({
      leave_request_id: newLeave.id, user_id: user_id, action: "CREATE", performed_by: "USER",
      details: { full_name: fullName, reason_text: reason, start_date: start_date, end_date: end_date, total_days: total_days, old_status: null, new_status: "PENDING", applied_at: newLeave.created_at, note: "Nhân viên gửi đơn mới" },
    });

    // 🔥 XÁC ĐỊNH ĐÍCH ĐẾN CỦA SOCKET (Tránh báo sai người)
    try {
      const io = req.app.get("socketio");
      if (io) {
        if (sender.role === "MANAGER") {
          // Trưởng phòng gửi -> Báo cho Giám đốc duyệt
          io.emit("new_leave_request", { target_role: "SUPERADMIN", message: `🔔 Quản lý ${fullName} vừa gửi đơn nghỉ phép!`, leave: newLeave });
        } else {
          // Nhân viên gửi -> Báo cho Trưởng phòng của họ duyệt
          io.emit("new_leave_request", { target_role: "MANAGER", target_department: sender.department_id, message: `🔔 Nhân viên ${fullName} gửi đơn xin nghỉ mới!`, leave: newLeave });
        }
      }
    } catch (err) { console.error("Lỗi Socket:", err); }

    res.json({ message: "Gửi đơn thành công!", leave: newLeave });
  } catch (err) { res.status(500).json({ message: "Lỗi tạo đơn" }); }
});

// --- 4. Lấy TỔNG SỐ PENDING_COUNT ĐỂ HIỂN THỊ CHUÔNG BÁO (Tuyệt đối không đếm đơn của mình) ---
router.get("/pending-count", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

    let count = 0;
    if (currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN") {
      // Giám đốc chỉ đếm số đơn Pending do các ông Manager trình lên
      const result = await pool.query(`
        SELECT COUNT(*) FROM leave_requests lr JOIN users u ON lr.user_id = u.id
        WHERE lr.status = 'PENDING' AND u.role = 'MANAGER'
      `);
      count = parseInt(result.rows[0].count);
    } else if (currentUser.role === "MANAGER") {
      // Trưởng phòng chỉ đếm đơn của nhân viên phòng mình (loại bỏ ID của chính mình)
      const getDept = await pool.query("SELECT id FROM departments WHERE manager_id = $1", [currentUser.id]);
      if (getDept.rows.length > 0) {
        const result = await pool.query(`
          SELECT COUNT(*) FROM leave_requests lr JOIN users u ON lr.user_id = u.id
          WHERE lr.status = 'PENDING' AND u.department_id = $1 AND u.id != $2
        `, [getDept.rows[0].id, currentUser.id]);
        count = parseInt(result.rows[0].count);
      }
    }
    res.json({ count });
  } catch (err) { res.status(500).json({ count: 0 }); }
});

// --- 5. Lấy lịch sử đơn CỦA CÁ NHÂN ---
router.get("/:user_id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM leave_requests WHERE user_id = $1 ORDER BY created_at DESC", [req.params.user_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: "Lỗi danh sách" }); }
});

// --- 6. Lấy TOÀN BỘ đơn để duyệt (Phân quyền chuẩn) ---
router.get("/", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });
    const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

    const statusFilter = req.query.status;

    let query = `
      SELECT lr.*, u.full_name, u.avatar_url, u.department_id, u.role as user_role
      FROM leave_requests lr JOIN users u ON lr.user_id = u.id
      WHERE 1=1
    `;
    let params = [];
    let paramIndex = 1;

    if (statusFilter) {
      query += ` AND lr.status = $${paramIndex}`;
      params.push(statusFilter);
      paramIndex++;
    }

    if (currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN") {
      // Giám đốc: Chỉ thấy đơn của Trưởng phòng trình lên
      query += ` AND u.role = 'MANAGER'`;
    } else if (currentUser.role === "MANAGER") {
      // Trưởng phòng: Lấy đơn của nhân sự dưới quyền (LOẠI BỎ ĐƠN CỦA CHÍNH MÌNH KHỎI MÀN DUYỆT)
      const getDept = await pool.query("SELECT id FROM departments WHERE manager_id = $1", [currentUser.id]);
      if (getDept.rows.length > 0) {
        query += ` AND u.department_id = $${paramIndex} AND u.id != $${paramIndex + 1}`;
        params.push(getDept.rows[0].id, currentUser.id);
      } else {
        return res.json([]); // Không có phòng thì lấy gì mà duyệt
      }
    }

    query += " ORDER BY lr.created_at DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

// --- 7. ADMIN: Duyệt đơn (Đã khóa quyền duyệt chéo) ---
router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });
    const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

    const leaveRes = await pool.query(`SELECT lr.*, u.full_name, u.department_id, u.role as target_role FROM leave_requests lr JOIN users u ON lr.user_id = u.id WHERE lr.id = $1`, [id]);
    if (leaveRes.rows.length === 0) return res.status(404).json({ message: "Không tìm thấy đơn!" });
    const data = leaveRes.rows[0];

    // Bảo mật: Giám đốc duyệt Trưởng phòng. Trưởng phòng duyệt Nhân viên. Cấm vượt cấp.
    if (currentUser.role === "MANAGER") {
      if (data.target_role === "MANAGER" || data.target_role === "SUPERADMIN") {
        return res.status(403).json({ message: "Bạn không thể tự duyệt đơn hoặc duyệt cho cấp trên!" });
      }
      const getDept = await pool.query("SELECT id FROM departments WHERE manager_id = $1", [currentUser.id]);
      if (getDept.rows.length === 0 || data.department_id !== getDept.rows[0].id) {
        return res.status(403).json({ message: "Bạn không có quyền duyệt đơn của nhân viên phòng khác!" });
      }
    }

    await pool.query("UPDATE leave_requests SET status = $1, approved_at = NOW(), rejection_reason = $2 WHERE id = $3", [status, rejection_reason || null, id]);

    await LeaveLog.create({
      leave_request_id: id, user_id: data.user_id, action: status, performed_by: "ADMIN",
      details: { full_name: data.full_name, reason_text: data.reason, start_date: data.start_date, end_date: data.end_date, total_days: data.total_days, old_status: "PENDING", new_status: status, rejection_reason: rejection_reason || null, status_at: new Date(), note: status === "APPROVED" ? "Sếp đã đồng ý duyệt đơn" : "Sếp đã từ chối đơn" },
    });

    const io = req.app.get("socketio");
    if (io) {
      io.emit("leave_status_update", {
        target_user_id: data.user_id,
        message: `📢 Đơn nghỉ phép "${data.reason}" của bạn đã ${status === "APPROVED" ? "được DUYỆT ✅" : "bị TỪ CHỐI ❌"}`,
        status: status,
      });
    }
    res.json({ message: "Cập nhật trạng thái thành công" });
  } catch (err) { res.status(500).json({ message: "Lỗi cập nhật trạng thái" }); }
});

module.exports = router;