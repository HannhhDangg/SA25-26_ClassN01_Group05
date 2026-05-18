const express = require("express");
const cors = require("cors");
const pool = require("./db");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const mongoose = require("mongoose");

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const otpRoute = require("./routes/otp");
const departmentRoutes = require("./routes/departments"); // 🔥 ĐÃ BỔ SUNG DÒNG NÀY

const app = express();
const server = http.createServer(app);

const port = process.env.PORT || 3000;
const redisHost = process.env.REDIS_HOST || "redis";
const redisPort = process.env.REDIS_PORT || 6379;

// --- CẤU HÌNH SOCKET.IO ---
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// --- CẤU HÌNH REDIS ---
const redisUrl = `redis://${redisHost}:${redisPort}`;
(async () => {
  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log(`✅ Socket.io đã kết nối Redis tại ${redisUrl}`);
  } catch (err) {
    console.warn("⚠️ Không thể kết nối Redis, chạy mặc định.");
  }
})();

app.set("socketio", io);
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- SỬ DỤNG ROUTES CHUẨN XÁC ---
app.use("/api/auth_ser", authRoutes);
app.use("/api/auth_ser/users", userRoutes);
app.use("/api/otp", otpRoute);
app.use("/api/auth_ser/departments", departmentRoutes); // 🔥 ĐÃ BỔ SUNG DÒNG NÀY ĐỂ KÍCH HOẠT API

// --- KẾT NỐI MONGODB ---
const mongoURI = process.env.MONGO_URI || "mongodb://db-mongo:27017/leave_logs";
mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ Đã kết nối MongoDB thành công!"))
  .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

server.listen(port, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${port}`);
});