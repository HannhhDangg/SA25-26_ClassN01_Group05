const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");

// Middleware xác thực Token (Bảo vệ an ninh API)
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

// =========================================================
// 1. LẤY DANH SÁCH THÔNG BÁO NHẬN ĐƯỢC (Dành cho TẤT CẢ)
// =========================================================
router.get("/", authenticate, async (req, res) => {
    try {
        // Lấy Email thực tế của user từ DB để hứng tin nhắn "INDIVIDUAL"
        const userRes = await pool.query("SELECT email FROM users WHERE id = $1", [req.user.id]);
        const userEmail = userRes.rows[0]?.email || "";

        // TRUY VẤN CỰC CHUẨN: Lấy thông báo theo đúng phân quyền
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

        // Xử lý an toàn department_id, tránh lỗi PostgreSQL "invalid input syntax for type integer"
        const safeDeptId = (req.user.department_id && !isNaN(req.user.department_id)) ? parseInt(req.user.department_id) : null;
        const values = [req.user.id, req.user.role, safeDeptId, userEmail];
        const result = await pool.query(query, values);

        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi lấy thông báo:", err);
        res.status(500).json({ message: "Lỗi server khi tải thông báo" });
    }
});

// =========================================================
// 1.5. LẤY SỐ LƯỢNG THÔNG BÁO CHƯA ĐỌC (Dành cho UI Quả chuông)
// =========================================================
router.get("/unread-count", authenticate, async (req, res) => {
    try {
        const userRes = await pool.query("SELECT email FROM users WHERE id = $1", [req.user.id]);
        const userEmail = userRes.rows[0]?.email || "";
        const safeDeptId = (req.user.department_id && !isNaN(req.user.department_id)) ? parseInt(req.user.department_id) : null;

        const query = `
            SELECT COUNT(a.id) as unread_count
            FROM announcements a
            LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
            WHERE (
                   a.target_type = 'ALL' 
                OR (a.target_type = 'ROLE' AND a.target_role = $2)
                OR (a.target_type = 'DEPT_STAFF' AND a.department_id = $3)
                OR (a.target_type = 'INDIVIDUAL' AND a.target_email = $4)
            )
            AND ar.read_at IS NULL
        `;

        const values = [req.user.id, req.user.role, safeDeptId, userEmail];
        const result = await pool.query(query, values);

        res.json({ unread_count: parseInt(result.rows[0].unread_count) });
    } catch (err) {
        console.error("Lỗi đếm thông báo chưa đọc:", err);
        res.status(500).json({ message: "Lỗi server khi đếm thông báo" });
    }
});

// =========================================================
// 2. LẤY LỊCH SỬ ĐÃ PHÁT ĐI (Chỉ Sếp mới được xem)
// =========================================================
router.get("/history", authenticate, async (req, res) => {
    try {
        if (req.user.role !== "SUPERADMIN" && req.user.role !== "ADMIN" && req.user.role !== "MANAGER") {
            return res.status(403).json({ message: "Không có quyền xem lịch sử!" });
        }

        const query = `
            SELECT a.*, u.full_name as sender_name, u.role as sender_role
            FROM announcements a
            LEFT JOIN users u ON a.sender_id = u.id
            WHERE a.sender_id = $1
            ORDER BY a.created_at DESC
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi lấy lịch sử gửi:", err);
        res.status(500).json({ message: "Lỗi server khi tải lịch sử" });
    }
});

// =========================================================
// 3. GỬI THÔNG BÁO MỚI (Viết vào DB & Bắn Socket)
// =========================================================
router.post("/", authenticate, async (req, res) => {
    const { title, content, target_type, target_role, department_id, target_email } = req.body;

    try {
        // Chặn quyền: Chỉ Manager/Admin/SuperAdmin mới được gửi
        if (req.user.role !== "SUPERADMIN" && req.user.role !== "ADMIN" && req.user.role !== "MANAGER") {
            return res.status(403).json({ message: "Chỉ Quản lý hoặc Giám đốc mới được phát thông báo!" });
        }

        const query = `
            INSERT INTO announcements (title, content, sender_id, target_type, target_role, department_id, target_email)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `;
        const values = [title, content, req.user.id, target_type, target_role || null, department_id || null, target_email || null];

        const result = await pool.query(query, values);
        const newAnnouncement = result.rows[0];

        // Tự động đánh dấu đã đọc cho chính người gửi, để họ không bị hiện dấu chấm đỏ cho thông báo do chính mình phát đi
        await pool.query(
            `INSERT INTO announcement_reads (announcement_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [newAnnouncement.id, req.user.id]
        );

        // Gắn thêm tên người gửi để đẩy qua Socket hiển thị lên màn hình người nhận ngay lập tức
        newAnnouncement.sender_name = req.user.full_name || req.user.username;
        newAnnouncement.sender_role = req.user.role;

        // 🔥 Bắn Socket.io Real-time
        try {
            const io = req.app.get("socketio");
            if (io) {
                io.emit("new_announcement", newAnnouncement);
            }
        } catch (err) {
            console.error("Lỗi Socket khi gửi thông báo:", err);
        }

        res.status(201).json({ message: "Phát thông báo thành công", announcement: newAnnouncement });
    } catch (err) {
        console.error("Lỗi tạo thông báo:", err);
        res.status(500).json({ message: "Lỗi server khi gửi thông báo" });
    }
});

// =========================================================
// 4. ĐÁNH DẤU ĐÃ ĐỌC (Lưu vào bảng announcement_reads)
// =========================================================
router.put("/:id/read", authenticate, async (req, res) => {
    try {
        const announcement_id = req.params.id;

        // Dùng ON CONFLICT DO NOTHING: Nếu đã đọc rồi mà gọi API lại thì bỏ qua, không bị crash DB
        const query = `
            INSERT INTO announcement_reads (announcement_id, user_id) 
            VALUES ($1, $2) 
            ON CONFLICT (announcement_id, user_id) DO NOTHING
        `;
        await pool.query(query, [announcement_id, req.user.id]);

        res.json({ message: "Đã đánh dấu đọc" });
    } catch (err) {
        console.error("Lỗi đánh dấu đọc:", err);
        res.status(500).json({ message: "Lỗi server khi đánh dấu đọc" });
    }
});

module.exports = router;