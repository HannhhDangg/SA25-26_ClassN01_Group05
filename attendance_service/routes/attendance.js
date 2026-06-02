const express = require("express");
const router = express.Router();
const pool = require("../db");; // PostgreSQL Connection


// / --- 1. API: ỨNG DỤNG SPA CỦA NHÂN VIÊN GỌI ĐỂ CHẤM CÔNG ---
router.post("/verify-code", async (req, res) => {
  const { user_id,device_id,late_minutes,early_leave_minutes, type } = req.body;

  try {

    // Xử lý Kịch bản Thành công -> Lưu Log vào Postgres
    const checkTime = new Date();
    // Chuyển sang múi giờ Việt Nam (UTC+7) để lấy ngày chính xác
    const localCheckTime = new Date(checkTime.getTime() + (7 * 60 * 60 * 1000));
    const workDate = localCheckTime.toISOString().split('T')[0];

    if (type === "check-in") {
      await pool.query(
        `INSERT INTO attendance_logs (user_id, work_date, check_in_time, late_minutes, check_in_device_id, status) VALUES ($1, $2, $3, $4, $5, 'Đang Làm') ON CONFLICT (user_id, work_date) DO UPDATE SET check_in_time = EXCLUDED.check_in_time, late_minutes = EXCLUDED.late_minutes, check_in_device_id = EXCLUDED.check_in_device_id, status = 'Đang Làm'`,
        [user_id, workDate, checkTime,late_minutes, device_id]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance_logs (user_id, work_date, check_out_time, early_leave_minutes, check_out_device_id, status) VALUES ($1, $2, $3, $4, $5, 'Tan Làm') ON CONFLICT (user_id, work_date) DO UPDATE SET check_out_time = EXCLUDED.check_out_time, early_leave_minutes = EXCLUDED.early_leave_minutes, check_out_device_id = EXCLUDED.check_out_device_id, status = 'Tan Làm'`,
        [user_id, workDate, checkTime, early_leave_minutes,device_id]
      );
    }

    // Đẩy Log chuẩn Grafana Loki
    console.info(`[INFO] User ${user_id} successfully checked in/out using code. DeviceID: ${device_id}. Time: ${checkTime.toISOString()}`);
    
    res.json({ message: "Chấm công thành công!" });
  } catch (err) {
    console.error("Lỗi xác thực chấm công:", err);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});



// 2 API History: Lấy lịch sử chấm công của nhân viên
router.get("/history/:user_id",async(req,res)=>{
  const{user_id} = req.params;
  const { start_date } = req.query;

  try {
    let query = `SELECT * FROM attendance_logs WHERE user_id = $1`;
    let params = [user_id];

    if (start_date) {
      // Lọc dữ liệu trong khoảng 7 ngày (1 tuần) kể từ start_date
      query += ` AND work_date >= $2 AND work_date < ($2::date + interval '7 days')`;
      params.push(start_date);
    }

    query += ` ORDER BY work_date DESC`;
    if (!start_date) query += ` LIMIT 30`; // Nếu không có ngày bắt đầu thì giới hạn 30 bản ghi

    const result = await pool.query(query, params);
    res.json(result.rows);
  }catch(err){
    console.log("Lỗi lấy lịch sử chấm công", err);
    res.status(500).json({message:"Lỗi hệ thống"});
  }
})

// --- 3. API Quản lý: Lấy danh sách chấm công hôm nay của nhân viên trong phòng ban ---
router.get("/team-today/:department_id", async (req, res) => {
  const { department_id } = req.params;
  try {
    const query = `
      SELECT u.id, u.full_name, u.avatar_url, a.check_in_time, a.check_out_time, a.status 
      FROM users u
      LEFT JOIN attendance_logs a ON u.id = a.user_id AND a.work_date = CURRENT_DATE
      WHERE u.department_id = $1 AND u.role = 'STAFF'
      ORDER BY a.check_in_time DESC NULLS LAST
    `;
    const result = await pool.query(query, [department_id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Lỗi lấy dữ liệu chấm công nhóm", err);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

module.exports = router;