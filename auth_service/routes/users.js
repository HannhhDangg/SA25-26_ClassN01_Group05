const express = require("express");
const router = express.Router();
const pool = require("../db");

// 1. Lấy danh sách user
router.get("/", async (req, res) => {
    try {
        // ✅ CHỈ LẤY CÁC CỘT CÓ SẴN TRONG init.sql
        const result = await pool.query(`
            SELECT id, username, email, full_name, role, status, 
                   base_salary, max_leave_days 
            FROM users
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi lấy danh sách:", err);
        res.status(500).json({ message: "Lỗi server khi lấy danh sách user" });
    }
});

// 2. Cập nhật trạng thái
router.put("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await pool.query("UPDATE users SET status = $1 WHERE id = $2", [status, id]);
        res.json({ message: "Cập nhật trạng thái thành công" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi server khi cập nhật trạng thái" });
    }
});

// 3. Cập nhật vai trò
router.put("/:id/role", async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const result = await pool.query(
            "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role",
            [role, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ message: "Không tìm thấy user!" });
        res.status(200).json({ message: "Cập nhật vai trò thành công!", user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server khi cập nhật vai trò" });
    }
});

// 4. Xóa tài khoản
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: "Không tìm thấy user!" });
        res.status(200).json({ message: "Đã xóa tài khoản thành công!" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server khi xóa tài khoản." });
    }
});

module.exports = router;