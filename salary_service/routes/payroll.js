const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");
const PayrollLog = require("../models/PayrollLog");

// Middleware xác thực Token
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Chưa đăng nhập!" });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(403).json({ message: "Token không hợp lệ!" });
    }
};

// --- HÀM ĐỒNG BỘ LƯƠNG THỜI GIAN THỰC (REAL-TIME) ---
// Được gọi tự động mỗi khi tải trang bảng lương
const syncPayrollRealtime = async (year, month) => {
        // 1. Tính số ngày công chuẩn trong tháng (Trừ ngày Chủ Nhật)
        const daysInMonth = new Date(year, month, 0).getDate();
        let standardWorkDays = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            if (date.getDay() !== 0) standardWorkDays++; // 0 là Chủ Nhật
        }

        // 2. Lấy dữ liệu Nhân viên, Chấm công và Nghỉ phép của tháng
        const usersRes = await pool.query("SELECT * FROM users WHERE status = 'ACTIVE'");
        const users = usersRes.rows;

        const logsRes = await pool.query(`
            SELECT * FROM attendance_logs 
            WHERE EXTRACT(MONTH FROM work_date) = $1 AND EXTRACT(YEAR FROM work_date) = $2
        `, [month, year]);
        const allLogs = logsRes.rows;

        const leavesRes = await pool.query(`
            SELECT * FROM leave_requests 
            WHERE status = 'APPROVED' AND EXTRACT(MONTH FROM start_date) = $1 AND EXTRACT(YEAR FROM start_date) = $2
        `, [month, year]);
        const allLeaves = leavesRes.rows;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // --- LẤY CẤU HÌNH NGÀY LỄ TỪ DB ---
        const leavesSettingsRes = await pool.query("SELECT value FROM system_settings WHERE key = 'leaves'");
        const holidaysStr = leavesSettingsRes.rows.length > 0 ? leavesSettingsRes.rows[0].value.holidays : "";
        const holidayLines = holidaysStr.split('\n').filter(l => l.trim());
        
        const getHolidayReason = (date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, "0");
            const dd = String(date.getDate()).padStart(2, "0");
            const mmdd = `${mm}-${dd}`;
            const fullDate = `${yyyy}-${mm}-${dd}`;
            for (let line of holidayLines) {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const datePart = parts[0].trim();
                    const namePart = parts.slice(1).join(':').trim();
                    if (datePart === mmdd || datePart === fullDate) return namePart;
                }
            }
            return null;
        };

        // Xóa bảng lương nháp (DRAFT) cũ để tránh trùng lặp khi tính lại
        await pool.query(`DELETE FROM monthly_payrolls WHERE payroll_month = $1 AND payroll_year = $2 AND status = 'DRAFT'`, [month, year]);

        // 3. Vòng lặp tính toán cho từng nhân sự
        for (const user of users) {
            const baseSalary = parseFloat(user.base_salary) || 0;
            const dailySalary = baseSalary / standardWorkDays; // Lương 1 ngày

            let totalWorkingDays = 0;
            let totalLateDays = 0;
            let totalUnexcusedDays = 0;
            let totalLeaveDays = 0;
            let totalUnpaidLeaveDays = 0;
            let totalBonus = 0;
            let totalPenalty = 0;

            // Kiểm tra xem bảng lương tháng này của nhân viên đã chốt (PAID) chưa
            // Nếu đã PAID thì tuyệt đối không được ghi đè, đảm bảo an toàn dữ liệu
            const existing = await pool.query(
                `SELECT status FROM monthly_payrolls WHERE user_id = $1 AND payroll_month = $2 AND payroll_year = $3`,
                [user.id, month, year]
            );
            if (existing.rows.length > 0 && existing.rows[0].status === 'PAID') continue;

            // Lặp qua từng ngày trong tháng
            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(year, month - 1, day);
                currentDate.setHours(0, 0, 0, 0);
                if (currentDate > today) break; // Ngày chưa diễn ra thì chưa tính
                
                const userCreatedAt = new Date(user.created_at || "2026-01-01");
                userCreatedAt.setHours(0, 0, 0, 0);
                if (currentDate < userCreatedAt) continue; // Ngày trước khi nhân viên vào làm thì bỏ qua

                const isSunday = currentDate.getDay() === 0;
                const isHoliday = getHolidayReason(currentDate) !== null;

                const log = allLogs.find(l => {
                    const d = new Date(l.work_date);
                    return l.user_id === user.id && d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
                });
                const leave = allLeaves.find(l => {
                    const start = new Date(l.start_date);
                    const end = new Date(l.end_date);
                    start.setHours(0, 0, 0, 0);
                    end.setHours(0, 0, 0, 0);
                    return l.user_id === user.id && currentDate >= start && currentDate <= end;
                });

                if (isSunday) {
                    // Cuối tuần không làm gì, không trừ lương
                } else if (isHoliday) {
                    totalWorkingDays += 1; // Lễ vẫn được tính 1 công
                } else if (leave) {
                    if (leave.leave_type === 'UNPAID') {
                        totalUnpaidLeaveDays += 1; // Nghỉ không lương -> mất 1 công (không bị phạt)
                    } else {
                        totalLeaveDays += 1; // Nghỉ phép năm, ốm -> Hưởng nguyên lương
                    }
                } else if (log) {
                    // CÓ LOG CHẤM CÔNG
                    const status = log.status || "";
                    let isLate = false, isEarly = false;
                    
                    // Tính đi muộn
                    if (log.check_in_time) {
                        const d = new Date(log.check_in_time);
                        let h = d.getHours();
                        let m = d.getMinutes();
                        if (h > 8 || (h === 8 && m > 40)) isLate = true;
                    }

                    // Tính về sớm / Tăng ca
                    if (log.check_out_time) {
                        const d = new Date(log.check_out_time);
                        let h = d.getHours();
                        
                        if (h < 17 && h > 10) isEarly = true; // Về sớm
                        if (h >= 18) totalBonus += (dailySalary / 8) * 1.5; // Tăng ca sau 18h thưởng 1.5h lương
                    }

                    if (status.toLowerCase().includes('muộn')) isLate = true;
                    if (status.toLowerCase().includes('sớm')) isEarly = true;

                    if (status.toLowerCase().includes('không phép') || status.toLowerCase().includes('vắng mặt') || status === 'UNEXCUSED') {
                        totalUnexcusedDays += 1;
                        totalPenalty += 100000; // Phạt 100k
                    } else {
                        totalWorkingDays += 1; // Đi làm bình thường
                        if (isLate || isEarly) {
                            totalLateDays += 1;
                            totalPenalty += 50000; // Đi muộn về sớm phạt 50k
                        }
                    }
                } else {
                    // Ngày làm việc trong quá khứ không có log -> Không phép (Đã có SQL Seeding lo phần đi làm đầy đủ)
                    totalUnexcusedDays += 1;
                    totalPenalty += 100000;
                }
            }

            // TÍNH LƯƠNG THỰC NHẬN
            let netSalary = (dailySalary * (totalWorkingDays + totalLeaveDays)) + totalBonus - totalPenalty;
            if (netSalary < 0) netSalary = 0; // Lương không được âm

            // LƯU VÀO DATABASE
            await pool.query(`
                INSERT INTO monthly_payrolls (
                    user_id, payroll_month, payroll_year, base_salary, standard_work_days,
                    total_working_days, total_leave_days, total_unpaid_leave_days,
                    total_late_days, total_unexcused_days, total_bonus, total_penalty, net_salary, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'DRAFT')
                ON CONFLICT (user_id, payroll_month, payroll_year) 
                DO UPDATE SET 
                    base_salary = EXCLUDED.base_salary, standard_work_days = EXCLUDED.standard_work_days,
                    total_working_days = EXCLUDED.total_working_days, total_leave_days = EXCLUDED.total_leave_days,
                    total_unpaid_leave_days = EXCLUDED.total_unpaid_leave_days, total_late_days = EXCLUDED.total_late_days,
                    total_unexcused_days = EXCLUDED.total_unexcused_days, total_bonus = EXCLUDED.total_bonus,
                    total_penalty = EXCLUDED.total_penalty, net_salary = EXCLUDED.net_salary
            `, [
                user.id, month, year, baseSalary, standardWorkDays,
                totalWorkingDays, totalLeaveDays, totalUnpaidLeaveDays,
                totalLateDays, totalUnexcusedDays, totalBonus, totalPenalty, Math.round(netSalary)
            ]);
        }
};

// --- 1. CHẠY TÍNH LƯƠNG TỰ ĐỘNG TỪ GIAO DIỆN (GIỮ LẠI LÀM DỰ PHÒNG) ---
router.post("/calculate/:year/:month", authenticate, async (req, res) => {
    // Chỉ Giám đốc và Trưởng phòng mới được quyền tính lương
    if (!["SUPERADMIN", "ADMIN", "MANAGER"].includes(req.user.role)) {
        return res.status(403).json({ message: "Bạn không có quyền tính lương!" });
    }

    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    try {
        // Thay vì code dài dòng, ta gọi hàm tái sử dụng ở trên
        await syncPayrollRealtime(year, month);

        // 🔥 GHI LOG VÀO MONGODB
        await PayrollLog.create({
            action: "CALCULATE_PAYROLL",
            performed_by: req.user.id,
            target_month: month,
            target_year: year,
            details: { status: "DRAFT" }
        });

        res.json({ message: `Đã tính lương thành công cho tháng ${month}/${year}` });
    } catch (err) {
        console.error("Lỗi tính lương:", err);
        res.status(500).json({ message: "Lỗi server khi tính lương" });
    }
});

// --- 2. LẤY DANH SÁCH BẢNG LƯƠNG ---
router.get("/:year/:month", authenticate, async (req, res) => {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    try {
        // 🔥 ĐỒNG BỘ THỜI GIAN THỰC (REAL-TIME) KHI VÀO TRANG BẢNG LƯƠNG
        await syncPayrollRealtime(year, month);

        let query = `
            SELECT p.*, u.full_name as name, u.avatar_url, u.role
            FROM monthly_payrolls p
            JOIN users u ON p.user_id = u.id
            WHERE p.payroll_month = $1 AND p.payroll_year = $2
        `;
        let params = [month, year];

        // Phân quyền hiển thị
        if (req.user.role === "MANAGER") {
            const getDept = await pool.query("SELECT department_id as id FROM users WHERE id = $1", [req.user.id]);
            if (getDept.rows.length > 0 && getDept.rows[0].id) {
                query += ` AND (u.department_id = $3 OR u.id = $4)`;
                params.push(getDept.rows[0].id, req.user.id);
            } else {
                query += ` AND u.id = $3`;
                params.push(req.user.id);
            }
        } 
        else if (req.user.role === "STAFF") {
            query += ` AND u.id = $3`;
            params.push(req.user.id);
        }

        query += " ORDER BY p.net_salary DESC";
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi lấy danh sách lương:", err);
        res.status(500).json({ message: "Lỗi server khi tải bảng lương" });
    }
});

// --- 3. CẬP NHẬT TRẠNG THÁI TRẢ LƯƠNG ---
router.put("/:id/status", authenticate, async (req, res) => {
    // Chỉ Giám đốc và Trưởng phòng được đánh dấu đã trả lương
    if (!["SUPERADMIN", "ADMIN", "MANAGER"].includes(req.user.role)) {
        return res.status(403).json({ message: "Không có quyền cập nhật trạng thái!" });
    }

    try {
        const result = await pool.query(
            "UPDATE monthly_payrolls SET status = 'PAID' WHERE id = $1 RETURNING *",
            [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ message: "Không tìm thấy bảng lương!" });
        res.json({ message: "Đã đánh dấu thanh toán lương thành công!", data: result.rows[0] });
    } catch (err) {
        console.error("Lỗi cập nhật trạng thái lương:", err);
        res.status(500).json({ message: "Lỗi server!" });
    }
});

// --- 4. LẤY CHI TIẾT CÁC NGÀY BỊ PHẠT / KHẤU TRỪ ---
router.get("/:year/:month/:user_id/penalties", authenticate, async (req, res) => {
    const { year, month, user_id } = req.params;

    // H9: Chặn IDOR xem chi tiết phạt của người khác
    if (req.user.role === "STAFF" && req.user.id !== parseInt(user_id)) {
        return res.status(403).json({ message: "Không được xem chi tiết phạt của người khác!" });
    }

    try {
        const logsRes = await pool.query(`
            SELECT work_date, status, late_minutes, early_leave_minutes
            FROM attendance_logs
            WHERE user_id = $1 AND EXTRACT(YEAR FROM work_date) = $2 AND EXTRACT(MONTH FROM work_date) = $3
            AND (late_minutes > 0 OR early_leave_minutes > 0 OR status ILIKE '%muộn%' OR status ILIKE '%sớm%' OR status ILIKE '%không phép%' OR status ILIKE '%vắng%' OR status = 'UNEXCUSED')
            ORDER BY work_date ASC
        `, [user_id, year, month]);
        res.json(logsRes.rows);
    } catch (err) {
        console.error("Lỗi lấy chi tiết phạt:", err);
        res.status(500).json({ message: "Lỗi server!" });
    }
});

module.exports = router;