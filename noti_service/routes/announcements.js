const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");
const NotificationLog = require("../models/NotificationLog"); // 🔥 Import Model Mongo

const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || "bi_mat_khong_the_bat_mi");
        next();
    } catch (err) {
        return res.status(403).json({ message: "Token không hợp lệ!" });
    }
};

// 1. LẤY DANH SÁCH THÔNG BÁO NHẬN ĐƯỢC
router.get("/", authenticate, async (req, res) => {
    try {
        const userRes = await pool.query("SELECT email FROM users WHERE id = $1", [req.user.id]);
        const userEmail = userRes.rows[0]?.email || "";

        const query = `
            SELECT a.*, 
                   CASE WHEN ar.read_at IS NOT NULL THEN true ELSE false END as is_read,
                   u.full_name as sender_name, u.role as sender_role
            FROM announcements a
            LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
            LEFT JOIN users u ON a.sender_id = u.id
            WHERE a.target_type = 'ALL' 
               OR (a.target_type = 'ROLE' AND a.target_role = $2)
               OR (a.target_type = 'DEPT_STAFF' AND a.department_id = $3)
               OR (a.target_type = 'INDIVIDUAL' AND a.target_email = $4)
            ORDER BY a.created_at DESC
        `;

        const safeDeptId = (req.user.department_id && !isNaN(req.user.department_id)) ? parseInt(req.user.department_id) : null;
        const result = await pool.query(query, [req.user.id, req.user.role, safeDeptId, userEmail]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

// 1.5. ĐẾM THÔNG BÁO CHƯA ĐỌC
router.get("/unread-count", authenticate, async (req, res) => {
    try {
        const userRes = await pool.query("SELECT email FROM users WHERE id = $1", [req.user.id]);
        const userEmail = userRes.rows[0]?.email || "";
        const safeDeptId = (req.user.department_id && !isNaN(req.user.department_id)) ? parseInt(req.user.department_id) : null;

        const query = `
            SELECT COUNT(a.id) as unread_count
            FROM announcements a
            LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
            WHERE (a.target_type = 'ALL' OR (a.target_type = 'ROLE' AND a.target_role = $2) OR (a.target_type = 'DEPT_STAFF' AND a.department_id = $3) OR (a.target_type = 'INDIVIDUAL' AND a.target_email = $4))
            AND ar.read_at IS NULL
        `;
        const result = await pool.query(query, [req.user.id, req.user.role, safeDeptId, userEmail]);
        res.json({ unread_count: parseInt(result.rows[0].unread_count) });
    } catch (err) { res.status(500).json({ message: "Lỗi đếm thông báo" }); }
});

// 2. LỊCH SỬ ĐÃ PHÁT ĐI
router.get("/history", authenticate, async (req, res) => {
    try {
        if (!["SUPERADMIN", "ADMIN", "MANAGER"].includes(req.user.role)) return res.status(403).json({ message: "Cấm" });
        const result = await pool.query("SELECT a.*, u.full_name as sender_name, u.role as sender_role FROM announcements a LEFT JOIN users u ON a.sender_id = u.id WHERE a.sender_id = $1 ORDER BY a.created_at DESC", [req.user.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ message: "Lỗi lịch sử" }); }
});

// 3. PHÁT THÔNG BÁO MỚI
router.post("/", authenticate, async (req, res) => {
    const { title, content, target_type, target_role, department_id, target_email } = req.body;
    try {
        if (!["SUPERADMIN", "ADMIN", "MANAGER"].includes(req.user.role)) return res.status(403).json({ message: "Cấm" });

        const result = await pool.query(
            `INSERT INTO announcements (title, content, sender_id, target_type, target_role, department_id, target_email) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [title, content, req.user.id, target_type, target_role || null, department_id || null, target_email || null]
        );
        const newAnnouncement = result.rows[0];

        // Tự động đánh dấu đọc cho người gửi
        await pool.query(`INSERT INTO announcement_reads (announcement_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [newAnnouncement.id, req.user.id]);

        // 🔥 LƯU LOG VÀO MONGODB
        await NotificationLog.create({
            announcement_id: newAnnouncement.id, title: title, sender_id: req.user.id, target_type: target_type, action: 'SENT', performed_by: req.user.id
        });

        newAnnouncement.sender_name = req.user.full_name || req.user.username;
        newAnnouncement.sender_role = req.user.role;

        const io = req.app.get("socketio");
        if (io) io.emit("new_announcement", newAnnouncement);

        res.status(201).json({ message: "Phát thông báo thành công", announcement: newAnnouncement });
    } catch (err) { res.status(500).json({ message: "Lỗi gửi thông báo" }); }
});

// 4. ĐÁNH DẤU ĐÃ ĐỌC
router.put("/:id/read", authenticate, async (req, res) => {
    try {
        await pool.query(`INSERT INTO announcement_reads (announcement_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [req.params.id, req.user.id]);

        // 🔥 LƯU LOG ĐỌC VÀO MONGODB
        await NotificationLog.create({
            announcement_id: req.params.id, title: "N/A", sender_id: 0, target_type: "N/A", action: 'READ', performed_by: req.user.id
        });

        res.json({ message: "Đã đánh dấu đọc" });
    } catch (err) { res.status(500).json({ message: "Lỗi đánh dấu đọc" }); }
});

module.exports = router;