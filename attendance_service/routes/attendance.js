const express = require("express");
const router = express.Router();
const fs = require("fs");
const { createClient } = require("redis");
const pool = require("../db"); // PostgreSQL Connection
const client = require('prom-client');

const redisUrl = `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`;
const redisClient = createClient({ url: redisUrl });
let redisReady = false;
(async () => {
  try {
    await redisClient.connect();
    await redisClient.ping();
    redisReady = true;
  } catch (err) {
    redisReady = false;
    console.warn('Attendance service Redis readiness failed:', err.message);
  }
})();

// --- CẤU HÌNH PROMETHEUS METRICS ---
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Thời gian phản hồi request (giây)',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5]
});
register.registerMetric(httpRequestDurationMicroseconds);

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Tổng số request HTTP',
  labelNames: ['method', 'route', 'status']
});
register.registerMetric(httpRequestsTotal);

// Middleware đo lường từng request
router.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    const labels = { method: req.method, route: req.route?.path || req.path, status: res.statusCode };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
});

// --- HEALTH CHECK SYSTEM ---
router.get("/metrics", async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// 1. Basic Liveness Check
router.get("/health", (req, res) => res.status(200).send("OK"));

// 2. Liveness Probe (Docker/K8s)
router.get("/health/live", (req, res) => res.status(200).json({ status: "UP" }));

// 3. Readiness Check
router.get("/health/ready", async (req, res) => {
  const checks = {
    db: "DOWN",
    redis: "DOWN",
    disk: "DOWN"
  };

  try {
    await pool.query("SELECT 1");
    checks.db = "UP";
  } catch (err) {
    checks.db = "DOWN";
  }

  try {
    if (redisReady) {
      await redisClient.ping();
      checks.redis = "UP";
    }
  } catch (err) {
    checks.redis = "DOWN";
  }

  try {
    const stats = fs.statfsSync("/");
    const freePercent = (stats.bfree / stats.blocks) * 100;
    checks.disk = freePercent > 10 ? "UP" : "LOW_SPACE";
  } catch (err) {
    checks.disk = "DOWN";
  }

  const isReady = checks.db === "UP" && checks.redis === "UP" && checks.disk === "UP";

  res.status(isReady ? 200 : 503).json({
    status: isReady ? "UP" : "DOWN",
    checks,
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});


// / --- 1. API: ỨNG DỤNG SPA CỦA NHÂN VIÊN GỌI ĐỂ CHẤM CÔNG ---
router.post("/verify-code", async (req, res) => {
  const { user_id,device_id,late_minutes,early_leave_minutes, type } = req.body;

  try {
    // Tạo thời gian hiện tại theo múi giờ Việt Nam dưới dạng chuỗi "YYYY-MM-DD HH:mm:ss"
    const now = new Date();
    const vnTimeStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
    const workDate = vnTimeStr.split(' ')[0]; // Tách lấy ngày YYYY-MM-DD

    if (type === "check-in") {
      await pool.query(
        `INSERT INTO attendance_logs (user_id, work_date, check_in_time, late_minutes, check_in_device_id, status) VALUES ($1, $2, $3, $4, $5, 'Đang Làm') ON CONFLICT (user_id, work_date) DO UPDATE SET check_in_time = EXCLUDED.check_in_time, late_minutes = EXCLUDED.late_minutes, check_in_device_id = EXCLUDED.check_in_device_id, status = 'Đang Làm'`,
        [user_id, workDate, vnTimeStr, late_minutes, device_id]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance_logs (user_id, work_date, check_out_time, early_leave_minutes, check_out_device_id, status) VALUES ($1, $2, $3, $4, $5, 'Tan Làm') ON CONFLICT (user_id, work_date) DO UPDATE SET check_out_time = EXCLUDED.check_out_time, early_leave_minutes = EXCLUDED.early_leave_minutes, check_out_device_id = EXCLUDED.check_out_device_id, status = 'Tan Làm'`,
        [user_id, workDate, vnTimeStr, early_leave_minutes, device_id]
      );
    }

    // Đẩy Log chuẩn Grafana Loki
    console.info(`[INFO] User ${user_id} successfully checked in/out. Time: ${vnTimeStr}`);
    
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