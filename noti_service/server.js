const express = require("express");
const cors = require("cors");
const pool = require("./db");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const mongoose = require("mongoose");

// CHỈ IMPORT ROUTE THÔNG BÁO
const announcementRoutes = require("./routes/announcements");

const app = express();
const server = http.createServer(app);

// 🔥 ĐỔI PORT THÀNH 3004
const port = process.env.PORT || 3000;
const redisHost = process.env.REDIS_HOST || "redis";
const redisPort = process.env.REDIS_PORT || 6379;

// --- CẤU HÌNH SOCKET.IO ---
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT"] },
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

// --- SỬ DỤNG ROUTE MỚI ---
app.use("/api/noti_ser/announcements", announcementRoutes);

// --- KẾT NỐI MONGODB TỚI DATABASE RIÊNG CHO NOTI ---
const mongoURI = process.env.MONGO_URI || "mongodb://db-mongo:27017/noti_logs";
mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ Đã kết nối MongoDB (Noti Logs) thành công!"))
  .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

server.listen(port, () => {
  console.log(`🚀 Noti Service đang chạy tại http://localhost:${port}`);
});