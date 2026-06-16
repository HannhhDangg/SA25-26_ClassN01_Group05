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

// 1. Lấy danh sách tất cả phòng ban (Kèm tên Trưởng phòng nếu có)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT d.id, d.name, d.description, d.created_at, d.manager_id,
                   u.full_name AS manager_name, u.email AS manager_email
            FROM departments d
            LEFT JOIN users u ON d.manager_id = u.id
            ORDER BY d.id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi lấy danh sách phòng ban:", err);
        res.status(500).json({ message: "Lỗi server khi lấy danh sách phòng ban" });
    }
});

// 2. Tạo phòng ban mới
router.post("/", authenticate, async (req, res) => {
    // C4: Kiểm tra quyền truy cập
    if (req.user.role !== "SUPERADMIN" && req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Không có quyền tạo phòng ban!" });
    }

    try {
        const { name, description, manager_id } = req.body;
        if (!name) return res.status(400).json({ message: "Tên phòng ban không được để trống!" });

        const result = await pool.query(
            `INSERT INTO departments (name, description, manager_id) 
             VALUES ($1, $2, $3) RETURNING *`,
            [name, description, manager_id || null]
        );
        res.status(201).json({ message: "Tạo phòng ban thành công!", department: result.rows[0] });
    } catch (err) {
        console.error("Lỗi tạo phòng ban:", err);
        if (err.code === "23505") {
            return res.status(400).json({ message: "Tên phòng ban này đã tồn tại!" });
        }
        res.status(500).json({ message: "Lỗi server khi tạo phòng ban" });
    }
});

// 3. Cập nhật thông tin phòng ban
router.put("/:id", authenticate, async (req, res) => {
    // C4: Kiểm tra quyền truy cập
    if (req.user.role !== "SUPERADMIN" && req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Không có quyền cập nhật phòng ban!" });
    }

    try {
        const { id } = req.params;
        const { name, description, manager_id } = req.body;

        const result = await pool.query(
            `UPDATE departments 
             SET name = $1, description = $2, manager_id = $3 
             WHERE id = $4 RETURNING *`,
            [name, description, manager_id || null, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Không tìm thấy phòng ban để cập nhật!" });
        }

        res.json({ message: "Cập nhật phòng ban thành công!", department: result.rows[0] });
    } catch (err) {
        console.error("Lỗi cập nhật phòng ban:", err);
        res.status(500).json({ message: "Lỗi server khi cập nhật phòng ban" });
    }
});

// 4. Xóa phòng ban
router.delete("/:id", authenticate, async (req, res) => {
    // C4: Kiểm tra quyền truy cập
    if (req.user.role !== "SUPERADMIN" && req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Không có quyền xóa phòng ban!" });
    }

    try {
        const { id } = req.params;

        // Không cho phép xóa Ban Giám Đốc gốc (ID = 1)
        if (parseInt(id) === 1) {
            return res.status(400).json({ message: "Không được xóa phòng ban quản trị mặc định này!" });
        }

        const result = await pool.query("DELETE FROM departments WHERE id = $1 RETURNING id", [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Không tìm thấy phòng ban để xóa!" });
        }

        res.json({ message: "Đã xóa phòng ban thành công!" });
    } catch (err) {
        console.error("Lỗi xóa phòng ban:", err);
        res.status(500).json({ message: "Lỗi server khi xóa phòng ban" });
    }
});

module.exports = router;