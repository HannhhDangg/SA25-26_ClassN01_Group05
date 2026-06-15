const express = require("express");
const cors = require("cors");
const pool = require("./db");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const mongoose = require("mongoose");
const fs = require("fs");
const client = require("prom-client");

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

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const otpRoute = require("./routes/otp");

// 🔥 Bọc Try-Catch để nếu thiếu file hệ thống cũng không bị sập
let departmentRoutes, settingsRoutes;
try { departmentRoutes = require("./routes/departments"); } catch (e) { console.warn("⚠️ Chưa có file departments.js"); }
try { settingsRoutes = require("./routes/settings"); } catch (e) { console.warn("⚠️ Chưa có file settings.js"); }

const app = express();
const server = http.createServer(app);

const port = process.env.PORT || 3000;
const redisHost = process.env.REDIS_HOST || "redis";
const redisPort = process.env.REDIS_PORT || 6379;
const redisUrl = `redis://${redisHost}:${redisPort}`;
let redisClient;
let redisReady = false;
// const announcementRoutes = require("./routes/announcements"); Da tach sang noti_service rui nen khong can nua

// --- CẤU HÌNH SOCKET.IO ---
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// --- CẤU HÌNH REDIS ---
(async () => {
  try {
    redisClient = createClient({ url: redisUrl });
    const subClient = redisClient.duplicate();
    await Promise.all([redisClient.connect(), subClient.connect()]);
    await redisClient.ping();
    redisReady = true;
    io.adapter(createAdapter(redisClient, subClient));
    console.log(`✅ Socket.io đã kết nối Redis tại ${redisUrl}`);
  } catch (err) {
    redisReady = false;
    console.warn("⚠️ Không thể kết nối Redis, chạy mặc định.", err.message);
  }
})();

app.set("socketio", io);
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    const labels = { method: req.method, route: req.route?.path || req.path, status: res.statusCode };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.get('/health', (req, res) => res.status(200).json({ status: 'UP', service: 'auth_service' }));
app.get('/health/live', (req, res) => res.status(200).json({ status: 'UP' }));
app.get('/health/ready', async (req, res) => {
  const checks = { db: 'DOWN', redis: 'DOWN', disk: 'DOWN' };

  try {
    await pool.query('SELECT 1');
    checks.db = 'UP';
  } catch (err) {
    checks.db = 'DOWN';
  }

  try {
    if (redisClient) {
      await redisClient.ping();
      checks.redis = 'UP';
    }
  } catch (err) {
    checks.redis = 'DOWN';
  }

  try {
    const stats = fs.statfsSync('/');
    const freePercent = (stats.bfree / stats.blocks) * 100;
    checks.disk = freePercent > 10 ? 'UP' : 'LOW_SPACE';
  } catch (err) {
    checks.disk = 'DOWN';
  }

  const isReady = checks.db === 'UP' && checks.redis === 'UP' && checks.disk === 'UP';
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'UP' : 'DOWN',
    checks,
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- SỬ DỤNG ROUTES CHUẨN XÁC ---
app.use("/api/auth_ser", authRoutes);
app.use("/api/auth_ser/users", userRoutes);
app.use("/api/otp", otpRoute);
if (departmentRoutes) app.use("/api/auth_ser/departments", departmentRoutes); 
if (settingsRoutes) app.use("/api/auth_ser/settings", settingsRoutes); 
// app.use("/api/auth_ser/announcements", announcementRoutes); da tach sang noti_service rui nen khong can nua

// --- KẾT NỐI MONGODB ---
const mongoURI = process.env.MONGO_URI || "mongodb://db-mongo:27017/leave_logs";
mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ Đã kết nối MongoDB thành công!"))
  .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

server.listen(port, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${port}`);
});