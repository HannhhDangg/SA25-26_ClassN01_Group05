const express = require("express");
const router = express.Router();
const pool = require("../db");
const LeaveLog = require("../models/LeaveLog"); // 🔥 Import Model MongoDB

// --- 1. ADMIN: Lấy thống kê tổng quan ---
router.get("/stats/admin-summary", async (req, res) => {
  try {
    const userCount = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role != 'ADMIN'",
    );
    const absentCount = await pool.query(`
      SELECT COUNT(*) FROM leave_requests 
      WHERE status = 'APPROVED' AND CURRENT_DATE BETWEEN start_date AND end_date
    `);
    res.json({
      totalUsers: parseInt(userCount.rows[0].count),
      absentToday: parseInt(absentCount.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi thống kê admin" });
  }
});

// --- 2. Xem số dư phép ---
router.get("/balance/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const currentYear = new Date().getFullYear();
  try {
    const userRes = await pool.query(
      "SELECT max_leave_days FROM users WHERE id = $1",
      [user_id],
    );
    if (userRes.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const maxDays = userRes.rows[0].max_leave_days || 12;
    const usedRes = await pool.query(
      `SELECT SUM(total_days) as used FROM leave_requests 
       WHERE user_id = $1 AND status = 'APPROVED' AND EXTRACT(YEAR FROM start_date) = $2`,
      [user_id, currentYear],
    );
    const usedDays = parseInt(usedRes.rows[0].used) || 0;
    res.json({ used: usedDays, max: maxDays, remaining: maxDays - usedDays });
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy số dư phép" });
  }
});

// --- 3. Tạo đơn nghỉ phép ---
router.post("/", async (req, res) => {
  const { user_id, reason, start_date, end_date, total_days } = req.body;
  const currentYear = new Date().getFullYear();

  try {
    // Check 0: Không nghỉ liền quá 3 ngày
    if (total_days > 3) {
      return res.status(400).json({ message: "Không được nghỉ liên tiếp quá 3 ngày để đảm bảo vận hành ca!" });
    }

    // Check 1: Quỹ phép
    const userRes = await pool.query(
      "SELECT full_name, max_leave_days FROM users WHERE id = $1",
      [user_id],
    );
    if (userRes.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const fullName = userRes.rows[0].full_name;
    const maxDays = userRes.rows[0].max_leave_days || 12;

    const usedRes = await pool.query(
      `SELECT SUM(total_days) as used FROM leave_requests 
       WHERE user_id = $1 AND status = 'APPROVED' AND EXTRACT(YEAR FROM start_date) = $2`,
      [user_id, currentYear],
    );
    const usedDays = parseInt(usedRes.rows[0].used) || 0;

    if (usedDays + total_days > maxDays)
      return res.status(400).json({
        message: `Không đủ ngày phép! (Đã dùng: ${usedDays}/${maxDays})`,
      });

    // Check 2: Giới hạn 5 người nghỉ cùng lúc
    const checkLimit = await pool.query(
      `SELECT COUNT(*) as count FROM leave_requests 
       WHERE status = 'APPROVED' AND (start_date <= $2 AND end_date >= $1)`,
      [start_date, end_date],
    );
    if (parseInt(checkLimit.rows[0].count) >= 5)
      return res
        .status(400)
        .json({ message: "Số người nghỉ trong ngày này 5/5 người!" });

    // 1. Tạo đơn trong PostgreSQL
    const result = await pool.query(
      `INSERT INTO leave_requests (user_id, reason, start_date, end_date, total_days, status) 
       VALUES ($1, $2, $3, $4, $5, 'PENDING') RETURNING *`,
      [user_id, reason, start_date, end_date, total_days],
    );
    const newLeave = result.rows[0];

    // 2. 🔥 GHI LOG ĐẦY ĐỦ VÀO MONGODB (Sử dụng fullName đã lấy ở trên)
    await LeaveLog.create({
      leave_request_id: newLeave.id,
      user_id: user_id,
      action: "CREATE",
      performed_by: "USER",
      details: {
        full_name: fullName,
        reason_text: reason,
        start_date: start_date,
        end_date: end_date,
        total_days: total_days,
        old_status: null,
        new_status: "PENDING",
        applied_at: newLeave.created_at,
        note: "Nhân viên gửi đơn mới",
      },
    });

    // Socket báo Admin
    try {
      const io = req.app.get("socketio");
      if (io)
        io.emit("new_leave_request", {
          message: `🔔 ${fullName} gửi đơn nghỉ phép mới!`,
          leave: newLeave,
        });
    } catch (err) {
      console.error("Lỗi Socket:", err);
    }

    res.json({ message: "Gửi đơn thành công!", leave: newLeave });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi tạo đơn" });
  }
});

// --- 4. Thống kê hôm nay ---
router.get("/stats/today", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM leave_requests 
      WHERE status = 'APPROVED' AND CURRENT_DATE BETWEEN start_date AND end_date
    `);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// --- 5. Lấy lịch sử đơn của 1 nhân viên ---
router.get("/:user_id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM leave_requests WHERE user_id = $1 ORDER BY created_at DESC",
      [req.params.user_id],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Lỗi danh sách" });
  }
});

// --- 6. ADMIN: Lấy TOÀN BỘ đơn của tất cả nhân viên ---
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lr.*, u.full_name, u.avatar_url FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id ORDER BY lr.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// --- 7. ADMIN: Duyệt đơn ---
router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;

  try {
    // 1. Cập nhật PostgreSQL
    await pool.query(
      "UPDATE leave_requests SET status = $1, approved_at = NOW(), rejection_reason = $2 WHERE id = $3",
      [status, rejection_reason || null, id],
    );

    // 2. Lấy thông tin chi tiết (kèm tên nhân viên) để ghi log MongoDB
    const leaveRes = await pool.query(
      `SELECT lr.*, u.full_name FROM leave_requests lr 
       JOIN users u ON lr.user_id = u.id WHERE lr.id = $1`,
      [id],
    );

    if (leaveRes.rows.length > 0) {
      const data = leaveRes.rows[0];

      // 🔥 GHI LOG DUYỆT ĐƠN CHI TIẾT VÀO MONGODB
      await LeaveLog.create({
        leave_request_id: id,
        user_id: data.user_id,
        action: status, // "APPROVED" hoặc "REJECTED"
        performed_by: "ADMIN",
        details: {
          full_name: data.full_name,
          reason_text: data.reason,
          start_date: data.start_date,
          end_date: data.end_date,
          total_days: data.total_days,
          old_status: "PENDING",
          new_status: status,
          rejection_reason: rejection_reason || null,
          status_at: new Date(),
          note:
            status === "APPROVED"
              ? "Sếp đã đồng ý duyệt đơn"
              : "Sếp đã từ chối đơn",
        },
      });

      // 3. Socket báo lại cho nhân viên
      const io = req.app.get("socketio");
      if (io) {
        io.emit("leave_status_update", {
          target_user_id: data.user_id,
          message: `📢 Đơn nghỉ phép "${data.reason}" của bạn đã ${status === "APPROVED" ? "được DUYỆT ✅" : "bị TỪ CHỐI ❌"}`,
          status: status,
        });
      }
    }
    res.json({ message: "Cập nhật trạng thái thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi cập nhật trạng thái" });
  }
});

module.exports = router;
