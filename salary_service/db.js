const { Pool } = require("pg");
require("dotenv").config();

// Lấy thông tin từ biến môi trường
const pool = new Pool({
  user: process.env.DB_USER || "admin",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "leave_management",
  password: process.env.DB_PASSWORD || "rootpassword",
  port: process.env.DB_PORT || 5432,
  // Đã bật lại SSL để PostgreSQL chịu kết nối
  ssl: {
    rejectUnauthorized: false,
  }
});

// Hàm kiểm tra kết nối
pool.connect((err, client, release) => {
  if (err) {
    return console.error("❌ Lỗi kết nối Database:", err.stack);
  }
  console.log("✅ Đã kết nối thành công tới PostgreSQL!");
  release();
});

module.exports = pool;