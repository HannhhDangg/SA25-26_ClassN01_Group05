const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");

// Hỗ trợ xác thực Token
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) { return res.status(403).json({ message: "Token không hợp lệ!" }); }
};

// 1. Lấy cấu hình theo key
router.get("/:key", async (req, res) => {
    try {
        const { key } = req.params;
        const result = await pool.query("SELECT value FROM system_settings WHERE key = $1", [key]);
        if (result.rows.length > 0) {
            res.json(result.rows[0].value);
        } else {
            res.json({});
        }
    } catch (err) {
        console.error(`Lỗi lấy cấu hình ${req.params.key}:`, err);
        res.status(500).json({ message: "Lỗi server khi lấy cấu hình" });
    }
});

// 2. Cập nhật cấu hình theo key
router.put("/:key", authenticate, async (req, res) => {
    // C3: Chặn người dùng không có quyền (Chỉ Giám đốc/Admin mới được sửa hệ thống)
    if (req.user.role !== "SUPERADMIN" && req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Bạn không có quyền thay đổi cấu hình hệ thống!" });
    }

    try {
        const { key } = req.params;
        const value = req.body;

        await pool.query(
            `INSERT INTO system_settings (key, value) 
             VALUES ($1, $2) 
             ON CONFLICT (key) DO UPDATE 
             SET value = $2, updated_at = CURRENT_TIMESTAMP`,
            [key, value]
        );

        res.json({ message: "Cập nhật cấu hình thành công" });
    } catch (err) {
        console.error(`Lỗi cập nhật cấu hình ${req.params.key}:`, err);
        res.status(500).json({ message: "Lỗi server khi cập nhật cấu hình" });
    }
});

module.exports = router;
