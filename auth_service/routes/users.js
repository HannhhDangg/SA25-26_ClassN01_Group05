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
            // Giám đốc: Thấy tất cả
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

// 1.5. Lấy số lượng nhân sự chờ duyệt (Đếm thông báo)
router.get("/pending-count", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ count: 0 });
        const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

        let count = 0;
        if (currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN") {
            const result = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'PENDING_ADMIN'");
            count = parseInt(result.rows[0].count);
        } else if (currentUser.role === "MANAGER") {
            const getDept = await pool.query("SELECT department_id FROM users WHERE id = $1", [currentUser.id]);
            if (getDept.rows.length > 0 && getDept.rows[0].department_id) {
                const result = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'PENDING_ADMIN' AND department_id = $1", [getDept.rows[0].department_id]);
                count = parseInt(result.rows[0].count);
            }
        }
        res.json({ count });
    } catch (err) {
        console.error("Lỗi đếm số nhân sự chờ duyệt:", err);
        res.status(500).json({ count: 0 });
    }
});

// 2. Cập nhật Nhân sự
router.put("/:id/hr-details", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });
        const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

        if (currentUser.role !== "SUPERADMIN") {
            return res.status(403).json({ message: "Chỉ SUPERADMIN mới có quyền cập nhật!" });
        }

        const { id } = req.params;
        const { base_salary, role, department_id, max_leave_days } = req.body;

        // Lấy thông tin cũ để so sánh
        const oldUserRes = await pool.query("SELECT department_id FROM users WHERE id = $1", [id]);

        const result = await pool.query(
            `UPDATE users SET base_salary = $1, role = $2, department_id = $3, max_leave_days = $4 WHERE id = $5 RETURNING *`,
            [base_salary || 0, role, department_id || null, max_leave_days || 12, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ message: "Không tìm thấy nhân viên này!" });

        const updatedUser = result.rows[0];

        // 🔥 Bắn thông báo Socket.io nếu nhân sự được phân bổ/chuyển sang phòng ban mới
        try {
            const oldDeptId = oldUserRes.rows[0]?.department_id;
            if (department_id && String(oldDeptId) !== String(department_id)) {
                const io = req.app.get("socketio");
                if (io) {
                    io.emit("new_user_registered", {
                        target_role: "MANAGER",
                        target_department: department_id,
                        message: `🔔 Phòng ban của bạn vừa được bổ nhiệm nhân sự mới: ${updatedUser.full_name || updatedUser.username}!`
                    });
                }
            }
        } catch (err) {
            console.error("Lỗi Socket khi cập nhật nhân sự:", err);
        }

        res.json({ message: "Cập nhật thông tin nhân sự thành công! 🎉", user: updatedUser });
    } catch (err) {
        console.error("Lỗi cập nhật chi tiết nhân sự:", err);
        res.status(500).json({ message: "Lỗi server khi cập nhật thông tin nhân sự" });
    }
});

// 3. API Kích hoạt/Duyệt tài khoản
router.put("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });

        const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

        if (currentUser.role !== "SUPERADMIN") {
            return res.status(403).json({ message: "Chỉ SUPERADMIN mới có thẩm quyền duyệt nhân viên!" });
        }

        const result = await pool.query("UPDATE users SET status = $1 WHERE id = $2 RETURNING *", [status, id]);

        // Bắn Socket để Sếp và Manager tự động tải lại UI / Gạch đi số đếm chuông thông báo
        try {
            const io = req.app.get("socketio");
            if (io) {
                io.emit("new_user_registered", { target_role: "SUPERADMIN" }); // Chỉ để update UI
                if (result.rows[0].department_id) {
                    io.emit("new_user_registered", {
                        target_role: "MANAGER",
                        target_department: result.rows[0].department_id
                    });
                }
            }
        } catch (err) { }

        res.json({ message: "Cập nhật trạng thái thành công", user: result.rows[0] });
    } catch (err) {
        console.error("Lỗi cập nhật trạng thái user:", err);
        res.status(500).json({ message: "Lỗi server khi cập nhật trạng thái" });
    }
});

// 4. Xóa tài khoản
router.delete("/:id", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });
        const currentUser = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");

        if (currentUser.role !== "SUPERADMIN") {
            return res.status(403).json({ message: "Chỉ SUPERADMIN mới có quyền xóa tài khoản!" });
        }

        const { id } = req.params;
        const oldUser = await pool.query("SELECT department_id FROM users WHERE id = $1", [id]);

        const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: "Không tìm thấy user!" });

        // Bắn Socket để Sếp và Manager tự động tải lại UI / Gạch đi số đếm chuông thông báo
        try {
            const io = req.app.get("socketio");
            if (io) {
                io.emit("new_user_registered", { target_role: "SUPERADMIN" }); // Cập nhật UI
                if (oldUser.rows.length > 0 && oldUser.rows[0].department_id) {
                    io.emit("new_user_registered", {
                        target_role: "MANAGER",
                        target_department: oldUser.rows[0].department_id
                    });
                }
            }
        } catch (err) { }

        res.status(200).json({ message: "Đã xóa tài khoản thành công!" });
    } catch (error) {
        console.error("Lỗi xóa tài khoản:", error);
        res.status(500).json({ message: "Lỗi server khi xóa tài khoản." });
    }
});

module.exports = router;