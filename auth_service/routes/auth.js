const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

// --- 1. API ĐĂNG KÝ (Register) ---
router.post("/register", async (req, res) => {
  // Nhận dữ liệu từ Frontend (Frontend gửi fullName, phone...)
  const { username, password, fullName, email, phone, role } = req.body;

  try {
    // Kiểm tra user tồn tại
    const userExist = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username],
    );
    if (userExist.rows.length > 0) {
      return res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Trạng thái mặc định
    const status = "PENDING_ADMIN";
    // Xác định role cuối cùng (nếu có role MANAGER thì giữ nguyên, còn lại mặc định là STAFF)
    const finalRole = (role === "MANAGER") ? "MANAGER" : "STAFF";
    // Lưu vào DB
    const newUser = await pool.query(
      `INSERT INTO users (username, password, full_name, email, phone_number, role, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        username,
        hashedPassword,
        fullName,
        email,
        phone,
        finalRole, // <--- Truyền biến finalRole đã được kiểm duyệt vào đây
        status,
      ],
    );

    res.status(201).json({
      message: "Đăng ký thành công! Vui lòng chờ Admin phê duyệt.",
      user: newUser.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server khi đăng ký" });
  }
});

// --- 2. API ĐĂNG NHẬP (Login) ---
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. Lấy TẤT CẢ thông tin user
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    const user = result.rows[0];

    // Kiểm tra tồn tại
    if (!user)
      return res
        .status(400)
        .json({ message: "Sai tên đăng nhập hoặc mật khẩu" });

    // Kiểm tra mật khẩu
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass)
      return res
        .status(400)
        .json({ message: "Sai tên đăng nhập hoặc mật khẩu" });

    // Kiểm tra trạng thái
    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Tài khoản chưa được kích hoạt hoặc đang chờ duyệt.",
      });
    }

    // Tạo Token
    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi",
      { expiresIn: "1d" },
    );

    // --- QUAN TRỌNG: Tách mật khẩu ra, trả về toàn bộ thông tin còn lại ---
    const { password: hashedPassword, ...userInfo } = user;

    res.json({
      message: "Đăng nhập thành công!",
      token: token,
      user: userInfo, // <--- User này chứa đầy đủ: email, avatar_url, full_name...
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server khi đăng nhập" });
  }
});

module.exports = router;
