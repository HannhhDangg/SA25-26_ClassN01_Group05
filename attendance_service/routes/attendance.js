const express = require("express");
const router = express.Router();
const { createClient } = require("redis");
const pool = require("../db");; // PostgreSQL Connection

// Khởi tạo Redis Client
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`
});
redisClient.connect().catch(err => console.error("Redis Connection Error:", err));

// --- 1. API: MÀN HÌNH TERMINAL GỌI ĐỂ SINH MÃ OTP ---
// (Được gọi liên tục mỗi 30 giây bằng cơ chế polling trên màn hình lớn)
router.get("/generate-code", async (req, res) => {
  try {
    const redisKey = "global_attendance_code";

    // 1. Lấy mã dùng chung hiện tại trong Redis và thời gian sống (TTL)
    let code = await redisClient.get(redisKey);
    let ttl = await redisClient.ttl(redisKey);

    // 2. Nếu mã chưa tồn tại hoặc đã hết hạn, mới tiến hành sinh mã mới
    if (!code || ttl <= 0) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      ttl = 30; // 30 giây
      await redisClient.setEx(redisKey, ttl, code);
    }
    
    // 3. Trả về mã (cũ hoặc mới sinh) và thời gian còn lại
    res.json({ code, expires_in: ttl });
  } catch (err) {
    console.error("Lỗi sinh mã chấm công:", err);
    res.status(500).json({ message: "Lỗi Server" });
  }
});

// --- 2. API: ỨNG DỤNG SPA CỦA NHÂN VIÊN GỌI ĐỂ XÁC THỰC MÃ ---
router.post("/verify-code", async (req, res) => {
  const { user_id, code, device_id, type } = req.body;

  try {
    // Đọc mã dùng chung từ Redis
    const storedCode = await redisClient.get("global_attendance_code");

    // Xử lý Kịch bản Thất bại (Mã sai hoặc mã đã hết hạn)
    if (!storedCode || storedCode !== code) {
      console.warn(`[WARN] Failed attendance attempt for User ${user_id}. Reason: Invalid or expired code. DeviceID: ${device_id}`);
      return res.status(400).json({ message: "Mã không hợp lệ hoặc đã hết hạn. Vui lòng nhìn màn hình và nhập mã mới!" });
    }

    // LƯU Ý: Không xóa mã trong Redis ngay vì trong vòng 30s đó có thể có nhiều người cùng nhập. Mã sẽ tự động bốc hơi khi hết TTL 30s.

    // Xử lý Kịch bản Thành công -> Lưu Log vào Postgres
    const checkTime = new Date();
    const workDate = checkTime.toISOString().split('T')[0];

    if (type === "check-in") {
      await pool.query(
        `INSERT INTO attendance_logs (user_id, work_date, check_in_time, check_in_device_id, status) VALUES ($1, $2, $3, $4, 'Đang Làm') ON CONFLICT (user_id, work_date) DO UPDATE SET check_in_time = EXCLUDED.check_in_time, check_in_device_id = EXCLUDED.check_in_device_id, status = 'Đang Làm'`,
        [user_id, workDate, checkTime, device_id]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance_logs (user_id, work_date, check_out_time, check_out_device_id, status) VALUES ($1, $2, $3, $4, 'Tan Làm') ON CONFLICT (user_id, work_date) DO UPDATE SET check_out_time = EXCLUDED.check_out_time, check_out_device_id = EXCLUDED.check_out_device_id, status = 'Tan Làm'`,
        [user_id, workDate, checkTime, device_id]
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
// 3 API History: Lấy lịch sử chấm công của nhân viên
router.get("/history/:user_id",async(req,res)=>{
  const{user_id} = req.params;
  try{
    const result = await pool.query(`SELECT * FROM attendance_logs WHERE user_id = $1 ORDER BY work_date DESC LIMIT 30`,[user_id]);
    res.json(result.rows);
  }catch(err){
    console.log("Lỗi lấy lịch sử chấm công", err);
    res.status(500).json({message:"Lỗi hệ thống"});
  }
})
module.exports = router;