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

      const pendingRes = await pool.query(`
        SELECT COUNT(*) FROM leave_requests lr
        JOIN users u ON lr.user_id = u.id
        WHERE lr.status = 'PENDING' AND u.role = 'MANAGER'
      `);

      totalUsers = parseInt(userRes.rows[0].count);
      absentToday = parseInt(absentRes.rows[0].count);
      pendingLeaves = parseInt(pendingRes.rows[0].count);

    } else if (currentUser.role === "MANAGER") {
      const getDept = await pool.query("SELECT department_id as id FROM users WHERE id = $1", [currentUser.id]);
      if (getDept.rows.length > 0 && getDept.rows[0].id) {
        const deptId = getDept.rows[0].id;
        const userRes = await pool.query("SELECT COUNT(*) FROM users WHERE department_id = $1 OR id = $2", [deptId, currentUser.id]);
        const absentRes = await pool.query(`
          SELECT COUNT(*) FROM leave_requests lr JOIN users u ON lr.user_id = u.id
          WHERE lr.status = 'APPROVED' AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date AND (u.department_id = $1 OR u.id = $2)
        `, [deptId, currentUser.id]);

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
        pendingLeaves = 0;
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

// --- 2.5. EMPLOYEE: Lấy số người đang nghỉ hôm nay ---
router.get("/stats/today", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count 
      FROM leave_requests 
      WHERE status = 'APPROVED' 
        AND CURRENT_DATE BETWEEN start_date AND end_date
    `);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) { res.status(500).json({ count: 0 }); }
});

// --- 3. Tạo đơn nghỉ phép (Giữ nguyên) ---
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

    try {
      const io = req.app.get("socketio");
      if (io) {
        if (sender.role === "MANAGER") {
          io.emit("new_leave_request", { target_role: "SUPERADMIN", message: `🔔 Quản lý ${fullName} vừa gửi đơn nghỉ phép!`, leave: newLeave });
        } else {
          io.emit("new_leave_request", { target_role: "MANAGER", target_department: sender.department_id, message: `🔔 Nhân viên ${fullName} gửi đơn xin nghỉ mới!`, leave: newLeave });
        }
      }
    } catch (err) { console.error("Lỗi Socket:", err); }

    res.json({ message: "Gửi đơn thành công!", leave: newLeave });
  } catch (err) { res.status(500).json({ message: "Lỗi tạo đơn" }); }
});

// --- 4. Lấy TỔNG SỐ PENDING_COUNT (ĐÃ FIX: Lấy phòng ban từ bảng users) ---
router.get("/pending-count", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

    let count = 0;
    if (currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN") {
      const result = await pool.query(`
        SELECT COUNT(*) FROM leave_requests lr JOIN users u ON lr.user_id = u.id
        WHERE lr.status = 'PENDING' AND u.role = 'MANAGER'
      `);
      count = parseInt(result.rows[0].count);
    } else if (currentUser.role === "MANAGER") {
      // 🔥 Lấy ID phòng ban của chính Manager từ bảng users
      const getDept = await pool.query("SELECT department_id as id FROM users WHERE id = $1", [currentUser.id]);
      if (getDept.rows.length > 0 && getDept.rows[0].id) {
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

// --- 5. Lấy lịch sử đơn CỦA CÁ NHÂN (Giữ nguyên) ---
router.get("/:user_id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM leave_requests WHERE user_id = $1 ORDER BY created_at DESC", [req.params.user_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: "Lỗi danh sách" }); }
});

// --- 6. Lấy TOÀN BỘ đơn để duyệt (ĐÃ FIX: Lấy phòng ban từ bảng users) ---
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
      query += ` AND u.role = 'MANAGER'`;
    } else if (currentUser.role === "MANAGER") {
      // 🔥 Lấy ID phòng ban của chính Manager từ bảng users
      const getDept = await pool.query("SELECT department_id as id FROM users WHERE id = $1", [currentUser.id]);
      if (getDept.rows.length > 0 && getDept.rows[0].id) {
        query += ` AND u.department_id = $${paramIndex} AND u.id != $${paramIndex + 1}`;
        params.push(getDept.rows[0].id, currentUser.id);
      } else {
        return res.json([]); // Nếu Sếp chưa được gán phòng ban thì báo rỗng
      }
    }

    query += " ORDER BY lr.created_at DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

// --- 7. ADMIN: Duyệt đơn (Giữ nguyên) ---
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

    if (currentUser.role === "MANAGER") {
      if (data.target_role === "MANAGER" || data.target_role === "SUPERADMIN") {
        return res.status(403).json({ message: "Bạn không thể tự duyệt đơn hoặc duyệt cho cấp trên!" });
      }
      const getDept = await pool.query("SELECT department_id as id FROM users WHERE id = $1", [currentUser.id]);
      if (getDept.rows.length === 0 || data.department_id !== getDept.rows[0].id) {
        return res.status(403).json({ message: "Bạn không có quyền duyệt đơn của nhân viên phòng khác!" });
      }
    }

    await pool.query("UPDATE leave_requests SET status = $1, approved_at = NOW(), rejection_reason = $2 WHERE id = $3", [status, rejection_reason || null, id]);

    await LeaveLog.create({
      leave_request_id: id, user_id: data.user_id, action: status, performed_by: "ADMIN",
      details: { full_name: data.full_name, reason_text: data.reason, start_date: data.start_date, end_date: data.end_date, total_days: data.total_days, old_status: "PENDING", new_status: status, rejection_reason: rejection_reason || null, status_at: new Date(), note: status === "APPROVED" ? "Sếp đã đồng ý duyệt đơn" : "Sếp đã từ chối đơn" },
    });

    // 🔥 Ghi vào bảng announcements để tạo thông báo hệ thống cho nhân viên (Để đọc được khi online lại)
    try {
        const targetUserRes = await pool.query("SELECT email FROM users WHERE id = $1", [data.user_id]);
        if (targetUserRes.rows.length > 0) {
            const targetEmail = targetUserRes.rows[0].email;
            const notiTitle = `Kết quả xét duyệt đơn nghỉ phép`;
            let notiContent = `Đơn xin nghỉ phép của bạn (Lý do: ${data.reason}) từ ngày ${new Date(data.start_date).toLocaleDateString("vi-VN")} đến ${new Date(data.end_date).toLocaleDateString("vi-VN")} đã ${status === "APPROVED" ? "được DUYỆT ✅" : "bị TỪ CHỐI ❌"}.`;
            
            await pool.query(`
                INSERT INTO announcements (title, content, sender_id, target_type, target_email)
                VALUES ($1, $2, $3, 'INDIVIDUAL', $4)
            `, [notiTitle, notiContent, currentUser.id, targetEmail]);

            // Phát tín hiệu Real-time để quả chuông đỏ của Frontend cập nhật số lập tức
            const io = req.app.get("socketio");
            if (io) {
                io.emit("new_announcement", { target_type: 'INDIVIDUAL', target_email: targetEmail });
            }
        }
    } catch (err) {
        console.error("Lỗi tạo thông báo kết quả duyệt đơn:", err);
    }

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

// ============================================================================
// --- 8. LẤY DỮ LIỆU BẢNG LỊCH LÀM VIỆC (SCHEDULE) CHO 1 TUẦN ---
// ============================================================================
router.get("/schedule/weekly", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });
    const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

    // Nhận tham số ngày bắt đầu của tuần từ Frontend (nếu không có thì lấy tuần hiện tại)
    // Format: YYYY-MM-DD
    const startDateParam = req.query.start_date;

    let targetUsersQuery = "";
    let params = [];
    let paramIndex = 1;

    // 1. Phân quyền hiển thị (Ai được xem lịch của ai)
    if (currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN") {
      // Giám đốc xem lịch của TẤT CẢ MANAGER
      targetUsersQuery = `SELECT id, full_name, role, department_id, avatar_url, TO_CHAR(created_at, 'YYYY-MM-DD') as created_at_str FROM users WHERE role = 'MANAGER' AND status = 'ACTIVE' ORDER BY full_name ASC`;
    } else if (currentUser.role === "MANAGER") {
      // Trưởng phòng xem lịch của CHÍNH MÌNH và TẤT CẢ NHÂN VIÊN TRONG PHÒNG
      const getDept = await pool.query("SELECT department_id as id FROM users WHERE id = $1", [currentUser.id]);
      if (getDept.rows.length > 0 && getDept.rows[0].id) {
        targetUsersQuery = `
                    SELECT id, full_name, role, department_id, avatar_url, TO_CHAR(created_at, 'YYYY-MM-DD') as created_at_str 
                    FROM users 
                    WHERE status = 'ACTIVE' AND (department_id = $1 OR id = $2) 
                    ORDER BY role DESC, full_name ASC
                `;
        params.push(getDept.rows[0].id, currentUser.id);
        paramIndex = 3;
      } else {
        return res.json([]); // Chưa có phòng thì không xem được lịch
      }
    } else {
      // Nhân viên thường: CHỈ XEM ĐƯỢC LỊCH CỦA CHÍNH MÌNH (Không xem của đồng nghiệp)
      targetUsersQuery = `SELECT id, full_name, role, department_id, avatar_url, TO_CHAR(created_at, 'YYYY-MM-DD') as created_at_str FROM users WHERE id = $1`;
      params.push(currentUser.id);
      paramIndex = 2;
    }

    // Thực thi lấy danh sách user
    const targetUsers = await pool.query(targetUsersQuery, params);
    if (targetUsers.rows.length === 0) return res.json([]);

    // Lấy danh sách ID để query bảng nghỉ phép
    const userIds = targetUsers.rows.map(u => u.id);

    // 2. Xử lý Logic Ngày Tháng (Lấy 7 ngày trong tuần)
    // PostgreSQL xử lý rất tốt việc này bằng hàm generate_series
    let dateQuery = `
            SELECT TO_CHAR(
                generate_series(
                    CAST($1 AS DATE), 
                    CAST($1 AS DATE) + interval '6 days', 
                    interval '1 day'
                ), 'YYYY-MM-DD'
            ) as day_date
        `;
    // Nếu Frontend không gửi start_date, lấy ngày thứ 2 của tuần hiện tại làm mốc
    let weekStart = startDateParam || new Date().toISOString().split('T')[0];

    // Nếu không truyền start_date, tự tính Thứ 2 của tuần này trong Backend (Backup logic)
    if (!startDateParam) {
      const vnTime = new Date();
      const day = vnTime.getDay() || 7;
      vnTime.setDate(vnTime.getDate() - (day - 1));
      const year = vnTime.getFullYear();
      const month = String(vnTime.getMonth() + 1).padStart(2, "0");
      const d = String(vnTime.getDate()).padStart(2, "0");
      weekStart = `${year}-${month}-${d}`;
    }

    // Lấy danh sách 7 ngày trong tuần
    const weekDaysRes = await pool.query(dateQuery, [weekStart]);
    const weekDays = weekDaysRes.rows.map(row => row.day_date); // ["2023-10-23", "2023-10-24", ...]

    // 3. Query bảng Nghỉ phép (Chỉ lấy những đơn đã APPROVED trong 7 ngày này của nhóm user trên)
    const placeholders = userIds.map((_, i) => `$${i + 3}`).join(',');
    const leavesQuery = `
            SELECT user_id, start_date, end_date, leave_type, reason
            FROM leave_requests
            WHERE status = 'APPROVED'
              AND user_id IN (${placeholders})
              AND start_date <= $2 
              AND end_date >= $1
        `;
    const leavesParams = [weekDays[0], weekDays[6], ...userIds];
    const leavesRes = await pool.query(leavesQuery, leavesParams);
    const leaves = leavesRes.rows;

    // 3.5. Query bảng Chấm công (attendance_logs) để ĐỒNG BỘ DỮ LIỆU THẬT
    const attendanceQuery = `
        SELECT user_id, TO_CHAR(work_date, 'YYYY-MM-DD') as work_date_str, check_in_time, check_out_time, status, late_minutes, early_leave_minutes
        FROM attendance_logs
        WHERE user_id IN (${placeholders})
          AND work_date >= $1 
          AND work_date <= $2
    `;
    const attendanceRes = await pool.query(attendanceQuery, leavesParams);
    const attendanceLogs = attendanceRes.rows;

    // --- LẤY CẤU HÌNH NGÀY LỄ TỪ DB ---
    const leavesSettingsRes = await pool.query("SELECT value FROM system_settings WHERE key = 'leaves'");
    const holidaysStr = leavesSettingsRes.rows.length > 0 ? leavesSettingsRes.rows[0].value.holidays : "";
    const holidayLines = holidaysStr.split('\n').filter(l => l.trim());

    // --- HÀM KIỂM TRA NGÀY LỄ ---
    const getHolidayReason = (dateStr) => {
      const mmdd = dateStr.substring(5);
      for (let line of holidayLines) {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const datePart = parts[0].trim();
            const namePart = parts.slice(1).join(':').trim();
            if (datePart === mmdd || datePart === dateStr) return namePart;
        }
      }
      return null;
    };

    // Lấy ngày hôm nay
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 4. "Nhào nặn" (Map) dữ liệu: Tạo ma trận User x 7 Ngày
    const scheduleData = targetUsers.rows.map(user => {
      const userSchedule = {
        user: {
          id: user.id,
          full_name: user.full_name,
          role: user.role,
          avatar_url: user.avatar_url
        },
        days: []
      };

      // Duyệt qua 7 ngày trong tuần
      weekDays.forEach(dateStr => {
        const currentDate = new Date(dateStr);
        const dayOfWeek = currentDate.getDay(); // 0 (CN) -> 6 (T7)
        const holidayReason = getHolidayReason(dateStr);

        // Lấy ngày tạo tài khoản trực tiếp từ DB format (Tránh lỗi múi giờ của Javascript làm lệch ngày)
        const userCreatedAtStr = user.created_at_str || "2026-01-01";

        // Kiểm tra xem user này có đơn nghỉ phép APPROVED nào bao phủ ngày này không?
        const isOnLeave = leaves.find(l => {
          const start = new Date(l.start_date);
          const end = new Date(l.end_date);
          // Reset thời gian về 00:00:00 để so sánh cho chuẩn xác
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          currentDate.setHours(0, 0, 0, 0);
          return l.user_id === user.id && currentDate >= start && currentDate <= end;
        });

        if (isOnLeave) {
          userSchedule.days.push({
            date: dateStr,
            status: "LEAVE",
            leave_type: isOnLeave.leave_type, // ANNUAL, UNPAID, SICK
            reason: isOnLeave.reason
          });
        } else if (holidayReason) {
          // Các ngày lễ lớn của Việt Nam
          userSchedule.days.push({
            date: dateStr,
            status: "HOLIDAY",
            reason: holidayReason,
            attendance_status: holidayReason // Bổ sung để Frontend có thể hiển thị chữ thay vì để trắng
          });
        } else if (dayOfWeek === 0) {
          // Bỏ Thứ 7, chỉ áp dụng Chủ Nhật là ngày nghỉ
          userSchedule.days.push({
            date: dateStr,
            status: "WEEKEND",
            reason: "Chủ Nhật",
            attendance_status: "Cuối Tuần" // Bổ sung để Frontend có thể hiển thị chữ 
          });
        } else {
          // Nếu là ngày thường và không xin nghỉ -> Gắn nhãn Đi làm
          let dayData = {
            date: dateStr,
            status: "WORKING",
          };

          // Kiểm tra xem có dữ liệu chấm công THẬT từ CSDL không
          const actualLog = attendanceLogs.find(a => a.user_id === user.id && a.work_date_str === dateStr);
          
          // Nếu ngày đang xét là ngày TRƯỚC KHI nhân viên vào làm (trước ngày tạo TK)
          if (dateStr < userCreatedAtStr) {
            dayData.status = "NOT_JOINED";
            dayData.attendance_status = "Chưa gia nhập"; // Ngày nhân viên chưa bắt đầu đi làm
          } else if (actualLog) {
            dayData.check_in_time = actualLog.check_in_time;
            dayData.check_out_time = actualLog.check_out_time;
            
            // Xử lý để ưu tiên hiển thị đúng dữ liệu "vắng mặt" từ seeding DB
            if (actualLog.status && (actualLog.status.toLowerCase().includes('vắng') || actualLog.status === 'UNEXCUSED' || actualLog.status.toLowerCase().includes('không phép'))) {
              dayData.status = "UNEXCUSED";
              dayData.reason = actualLog.status;
              dayData.attendance_status = actualLog.status;
            } else {
              // Ưu tiên hiển thị trạng thái Đi muộn / Về sớm thay vì chỉ "Đang Làm" hoặc "Tan Làm"
              let attStatus = actualLog.status === 'Tan Làm' ? 'Đúng Giờ' : actualLog.status;
              
              let isLate = actualLog.late_minutes > 0;
              let isEarly = actualLog.early_leave_minutes > 0;

              // Tự động tính toán lại Đi muộn / Về sớm từ giờ thực tế (Nếu DB không lưu late_minutes)
              if (actualLog.check_in_time) {
                 const d = new Date(actualLog.check_in_time);
                 let h = d.getHours();
                 let m = d.getMinutes();

                 // Ca làm bắt đầu 8:30 sáng, cho trễ 10 phút -> 8:40
                 if (h > 8 || (h === 8 && m > 40)) isLate = true;
              }
              if (actualLog.check_out_time) {
                 const d = new Date(actualLog.check_out_time);
                 let h = d.getHours();

                 // Ca làm kết thúc 17:00 chiều (h > 10 để tránh nhầm với rạng sáng)
                 if (h < 17) isEarly = true;
              }

              if (actualLog.status && actualLog.status.toLowerCase().includes('muộn')) isLate = true;
              if (actualLog.status && actualLog.status.toLowerCase().includes('sớm')) isEarly = true;

              if (isLate && isEarly) {
                 attStatus = "Đi muộn & Về sớm";
              } else if (isLate) {
                 attStatus = "Đi muộn";
              } else if (isEarly) {
                 attStatus = "Về sớm";
              }
              dayData.attendance_status = attStatus;
            }
          } else if (dateStr < todayStr) {
            // Quá khứ mà KHÔNG có log thật -> Đánh dấu nghỉ không phép
            dayData.status = "UNEXCUSED";
            dayData.reason = "Không chấm công";
          } else if (dateStr === todayStr) {
             // Hôm nay nhưng chưa chấm công
             dayData.attendance_status = "Chưa chấm công";
          }
          // Tương lai (dateStr > todayStr) -> status = "WORKING", attendance_status = undefined (Chờ chấm công thủ công)

          userSchedule.days.push(dayData);
        }
      });

      return userSchedule;
    });

    res.json({
      week_start: weekDays[0],
      week_end: weekDays[6],
      schedule: scheduleData
    });

  } catch (err) {
    console.error("Lỗi lấy lịch làm việc:", err);
    res.status(500).json({ message: "Lỗi server khi tải lịch làm việc" });
  }
});

module.exports = router;