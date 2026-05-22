const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const redis = require("redis");

// Khởi tạo Redis Client
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis for Auth'));

// --- 1. API ĐĂNG KÝ (Register) ---
router.post("/register", async (req, res) => {
  const {
    username, password, fullName, full_name, email,
    phone, phone_number, role, department_id, departmentId
  } = req.body;

  const actualFullName = full_name || fullName || null;
  const actualPhone = phone_number || phone || null;
  const inputDept = department_id || departmentId || null;

  try {
    const userExist = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const status = "PENDING_ADMIN";
    const finalRole = (role === "MANAGER") ? "MANAGER" : "STAFF";

    // 🔥 XỬ LÝ ID PHÒNG BAN CHUẨN XÁC, CHỐNG LỖI NaN
    let parsedDeptId = null;
    if (inputDept && String(inputDept).trim() !== "") {
      const num = parseInt(inputDept, 10);
      if (!isNaN(num)) {
        parsedDeptId = num;
      } else {
        // Fallback: Nếu gửi lên tên phòng ban bằng chữ
        const deptCheck = await pool.query(
          "SELECT id FROM departments WHERE name ILIKE $1 OR name ILIKE $2",
          [inputDept, `%${inputDept}%`]
        );
        if (deptCheck.rows.length > 0) {
          parsedDeptId = deptCheck.rows[0].id;
        }
      }
    }

    const newUser = await pool.query(
      `INSERT INTO users (username, password, full_name, email, phone_number, role, status, department_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [username, hashedPassword, actualFullName, email, actualPhone, finalRole, status, parsedDeptId]
    );

    // 🔥 Bắn Socket thông báo có nhân sự mới đăng ký
    try {
      const io = req.app.get("socketio");
      if (io) {
        if (parsedDeptId) {
          io.emit("new_user_registered", {
            target_role: "MANAGER",
            target_department: parsedDeptId,
            message: `🔔 Phòng ban của bạn vừa có nhân sự mới đăng ký: ${actualFullName || username}!`
          });
        }
        io.emit("new_user_registered", {
          target_role: "SUPERADMIN",
          message: `🔔 Có nhân sự mới đăng ký vào hệ thống: ${actualFullName || username}!`
        });
      }
    } catch (err) {
      console.error("Lỗi Socket khi đăng ký:", err);
    }

    res.status(201).json({
      message: "Đăng ký thành công! Vui lòng chờ Trưởng phòng phê duyệt.",
      user: newUser.rows[0],
    });
  } catch (err) {
    console.error("Lỗi đăng ký:", err);
    res.status(500).json({ message: "Lỗi server khi đăng ký" });
  }
});

// --- 2. API ĐĂNG NHẬP (Login) --- 
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
<<<<<<< HEAD

  // Kiểm tra dữ liệu đầu vào, tránh lỗi undefined ở hàm bcrypt gây sập server
  if (!username || !password) {
    return res.status(400).json({ message: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!" });
  }

=======
>>>>>>> 3e3137ab30e1b271efd059ccf6918c0b64c0d4e3
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];

    if (!user) return res.status(400).json({ message: "Sai tên đăng nhập hoặc mật khẩu" });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ message: "Sai tên đăng nhập hoặc mật khẩu" });

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ message: "Tài khoản chưa được kích hoạt hoặc đang chờ duyệt." });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username, department_id: user.department_id },
      process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi",
      { expiresIn: "1d" }
    );

    await redisClient.set(`session:${user.id}`, token, { EX: 86400 });

    const { password: hashedPassword, ...userInfo } = user;
    res.json({ message: "Đăng nhập thành công!", token: token, user: userInfo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server khi đăng nhập" });
  }
});

// --- 3. API ĐĂNG XUẤT (Logout) ---
router.post("/logout", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "Cần userId để đăng xuất" });
  try {
    await redisClient.del(`session:${userId}`);
    res.json({ message: "Đăng xuất thành công!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server khi đăng xuất" });
  }
});

module.exports = router;