const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");

// 1. Lấy danh sách nhân viên (Cô lập biên giới phòng ban bằng SQL)
router.get("/", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });

        const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

        let query = `
            SELECT u.id, u.username, u.email, u.full_name, u.role, u.status, 
                   u.base_salary, u.max_leave_days, u.department_id,
                   d.name AS department_name 
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE 1=1
        `;
        let params = [];

        // 🔥 QUY TẮC HIỂN THỊ CỐT LÕI
        if (currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN") {
            // Giám đốc: TUYỆT ĐỐI CHỈ nhìn thấy cấp Quản lý trở lên
            query += ` AND u.role IN ('SUPERADMIN', 'ADMIN', 'MANAGER')`;
        } else if (currentUser.role === "MANAGER") {
            // Trưởng phòng: Lấy ID phòng ban của Trưởng phòng này
            const getDept = await pool.query("SELECT id FROM departments WHERE manager_id = $1", [currentUser.id]);
            if (getDept.rows.length > 0) {
                const managerDeptId = getDept.rows[0].id;
                // Thấy chính mình HOẶC bất cứ ai (Staff, Pending) nằm trong phòng ban của mình
                query += ` AND (u.department_id = $1 OR u.id = $2)`;
                params.push(managerDeptId, currentUser.id);
            } else {
                // Nếu Trưởng phòng chưa có phòng, chỉ thấy chính mình
                query += ` AND u.id = $1`;
                params.push(currentUser.id);
            }
        } else {
            // Nhân viên thường (Nếu lỡ gọi API này) chỉ thấy chính mình
            query += ` AND u.id = $1`;
            params.push(currentUser.id);
        }

        query += " ORDER BY u.id DESC";
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi lấy danh sách NV:", err);
        res.status(500).json({ message: "Lỗi server khi lấy danh sách user" });
    }
});

// 2. Cập nhật Nhân sự (Giữ nguyên)
router.put("/:id/hr-details", async (req, res) => {
    try {
        const { id } = req.params;
        const { base_salary, role } = req.body;
        const result = await pool.query(
            `UPDATE users SET base_salary = $1, role = $2 WHERE id = $3 RETURNING *`,
            [base_salary || 0, role, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ message: "Không tìm thấy nhân viên này!" });
        res.json({ message: "Cập nhật thông tin nhân sự thành công! 🎉", user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ message: "Lỗi server khi cập nhật thông tin nhân sự" });
    }
});

// 3. API Kích hoạt/Duyệt tài khoản (Khóa chặt: Chỉ cho Manager duyệt)
router.put("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });

        const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

        // KHÔNG cho phép SUPERADMIN duyệt đơn hoặc duyệt người
        if (currentUser.role !== "MANAGER") {
            return res.status(403).json({ message: "Chỉ Trưởng phòng mới có thẩm quyền duyệt nhân viên!" });
        }

        // Đảm bảo không duyệt trộm người của phòng khác
        const targetUser = await pool.query("SELECT department_id FROM users WHERE id = $1", [id]);
        const managerDept = await pool.query("SELECT id FROM departments WHERE manager_id = $1", [currentUser.id]);

        if (managerDept.rows.length === 0 || targetUser.rows[0].department_id !== managerDept.rows[0].id) {
            return res.status(403).json({ message: "Bạn không thể duyệt nhân sự của phòng ban khác!" });
        }

        const result = await pool.query("UPDATE users SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
        res.json({ message: "Cập nhật trạng thái thành công", user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ message: "Lỗi server khi cập nhật trạng thái" });
    }
});

// 4. Xóa tài khoản (Giữ nguyên)
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