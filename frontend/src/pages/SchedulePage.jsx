import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
    FaCalendarCheck, FaChevronLeft, FaChevronRight,
    FaUserAlt, FaCheckCircle, FaTimesCircle, FaCoffee, FaCalendarDay,
    FaExclamationTriangle, FaClock
} from "react-icons/fa";

// ─── COMPONENT: MINI CALENDAR (BỘ CHỌN LỊCH CUSTOM) ───
const MiniCalendar = ({ selectedDate, onSelectDate, onClose }) => {
    const [currentMonth, setCurrentMonth] = useState(selectedDate ? new Date(selectedDate) : new Date());

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayIndex = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    // Điều chỉnh để Thứ 2 là ngày đầu tuần (0: T2, 1: T3, ..., 6: CN)
    const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));

    return (
        <div className="mini-calendar-popup">
            <div className="mini-calendar-header">
                <div style={{ fontWeight: 600 }}>Tháng {currentMonth.getMonth() + 1}-{currentMonth.getFullYear()}</div>
                <div style={{ display: "flex", gap: 10 }}>
                    <FaChevronLeft style={{ cursor: "pointer", opacity: 0.8 }} onClick={handlePrevMonth} />
                    <FaChevronRight style={{ cursor: "pointer", opacity: 0.8 }} onClick={handleNextMonth} />
                </div>
            </div>
            <div className="mini-calendar-grid header">
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="mini-calendar-grid body">
                {days.map((date, idx) => {
                    if (!date) return <div key={idx} className="empty-day"></div>;
                    const isSelected = selectedDate && date.toDateString() === new Date(selectedDate).toDateString();
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                        <div
                            key={idx}
                            className={`day-cell ${isSelected ? "selected" : ""} ${isToday && !isSelected ? "today" : ""}`}
                            onClick={() => onSelectDate(date)}
                        >
                            {date.getDate()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── COMPONENT CHÍNH: TRANG LỊCH TRÌNH ───
const SchedulePage = () => {
    const token = localStorage.getItem("token");
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

    const [scheduleData, setScheduleData] = useState([]);
    const [weekStart, setWeekStart] = useState("");
    const [weekEnd, setWeekEnd] = useState("");
    const [loading, setLoading] = useState(true);
    const [targetDate, setTargetDate] = useState("");

    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) setShowPicker(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getDaysArray = (start) => {
        if (!start) return [];
        const result = [];
        const startDate = new Date(start);
        for (let i = 0; i < 7; i++) {
            const nextDate = new Date(startDate);
            nextDate.setDate(startDate.getDate() + i);
            result.push(nextDate);
        }
        return result;
    };

    const fetchWeeklySchedule = async () => {
        setLoading(true);
        try {
            let url = "/api/leave_ser/schedule/weekly";
            if (targetDate) url += `?start_date=${targetDate}`;

            const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                
                // Đọc dữ liệu thật từ Backend, không dùng random giả lập nữa
                setScheduleData(data.schedule || []);
                setWeekStart(data.week_start);
                setWeekEnd(data.week_end);
            } else {
                toast.error("Không thể tải dữ liệu lịch làm việc.");
            }
        } catch (error) {
            toast.error("Lỗi kết nối đến máy chủ!");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchWeeklySchedule(); }, [targetDate]);

    const handlePrevWeek = () => {
        const current = new Date(weekStart);
        current.setDate(current.getDate() - 7);
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, "0");
        const day = String(current.getDate()).padStart(2, "0");
        setTargetDate(`${year}-${month}-${day}`);
    };

    const handleNextWeek = () => {
        const current = new Date(weekStart);
        current.setDate(current.getDate() + 7);
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, "0");
        const day = String(current.getDate()).padStart(2, "0");
        setTargetDate(`${year}-${month}-${day}`);
    };

    const handleDatePick = (date) => {
        const d = new Date(date);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - (day - 1)); 
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const dom = String(d.getDate()).padStart(2, "0");
        setTargetDate(`${year}-${month}-${dom}`);
        setShowPicker(false);
    };

    const formatDateHeader = (dateObj) => {
        const day = String(dateObj.getDate()).padStart(2, "0");
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        return `${day}/${month}`;
    };

    const dayLabels = ["THỨ 2", "THỨ 3", "THỨ 4", "THỨ 5", "THỨ 6", "THỨ 7", "CHỦ NHẬT"];
    const daysInWeek = getDaysArray(weekStart);

    const renderWeekRange = () => {
        if (!weekStart || !weekEnd) return "Đang tải...";
        const start = new Date(weekStart);
        const end = new Date(weekEnd);
        return `Tuần ${getWeekNumber(start)} · ${start.getDate().toString().padStart(2, '0')}/${(start.getMonth() + 1).toString().padStart(2, '0')} - ${end.getDate().toString().padStart(2, '0')}/${(end.getMonth() + 1).toString().padStart(2, '0')}`;
    };

    // Helper tính tuần thứ mấy trong năm
    const getWeekNumber = (d) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

    return (
        <div>
            {/* ─── HEADER ─── */}
            <div className="flex-between mb-16" style={{ flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                        <FaCalendarCheck style={{ color: "var(--primary)" }} /> Lịch làm việc
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 3 }}>
                        Theo dõi quân số, phép năm và tình trạng chấm công
                    </div>
                </div>

                {/* ─── BỘ ĐIỀU HƯỚNG TÙY BIẾN ─── */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" style={{ padding: "8px 12px", background: "#1E293B", color: "#fff", border: "none" }} onClick={handlePrevWeek}>
                        <FaChevronLeft size={10} />
                    </button>

                    <div style={{ position: "relative" }} ref={pickerRef}>
                        <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontWeight: 600, padding: "8px 16px", background: "#1E293B", color: "#fff", border: "none" }}
                            onClick={() => setShowPicker(!showPicker)}
                        >
                            {renderWeekRange()}
                        </button>

                        {showPicker && (
                            <MiniCalendar
                                selectedDate={weekStart}
                                onSelectDate={handleDatePick}
                                onClose={() => setShowPicker(false)}
                            />
                        )}
                    </div>

                    <button className="btn btn-secondary btn-sm" style={{ padding: "8px 12px", background: "#1E293B", color: "#fff", border: "none" }} onClick={handleNextWeek}>
                        <FaChevronRight size={10} />
                    </button>

                    <button className="btn btn-sm" style={{ marginLeft: 8, padding: "8px 16px", border: "1px solid var(--border)", background: "#fff", fontWeight: 600 }} onClick={() => setTargetDate("")}>
                        Trở về Hiện tại
                    </button>
                </div>
            </div>

            {/* ─── BẢNG ĐIỀU PHỐI (GRID SCHEDULE) ─── */}
            <div className="table-wrap" style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border-light)" }}>
                {loading ? (
                    <div style={{ padding: 60, textAlign: "center", color: "var(--text-light)" }}>Đang tải ma trận lịch trực...</div>
                ) : scheduleData.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--text-light)" }}>Không tìm thấy danh sách nhân sự.</div>
                ) : (
                    <div className="table-wrap-scroll custom-scrollbar">
                        <table className="schedule-table">
                            <thead>
                                <tr>
                                    <th style={{ minWidth: 220, textAlign: "left", paddingLeft: 20 }}>NHÂN SỰ BAN NGÀNH</th>
                                    {daysInWeek.map((dateObj, index) => (
                                        <th key={index} style={{ textAlign: "center", width: "11%" }}>
                                            <div style={{ fontWeight: 700, color: "var(--text-sub)", fontSize: 12, letterSpacing: 0.5 }}>{dayLabels[index]}</div>
                                            <div style={{ fontSize: 12, color: "var(--text-light)", fontWeight: 500, marginTop: 4 }}>
                                                {formatDateHeader(dateObj)}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {scheduleData.map((item, userIdx) => {
                                    const initials = item.user.full_name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();
                                    return (
                                        <tr key={userIdx}>
                                            <td style={{ paddingLeft: 20 }}>
                                                <div className="cell-user">
                                                    {item.user.avatar_url ? (
                                                        <div className="avatar-circle" style={{ width: 36, height: 36 }}>
                                                            <img src={item.user.avatar_url} alt="avatar" />
                                                        </div>
                                                    ) : (
                                                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                                            {initials || <FaUserAlt size={12} />}
                                                        </div>
                                                    )}
                                                    <div style={{ minWidth: 0 }}>
                                                        <div className="cell-name" style={{ fontSize: 14 }}>{item.user.full_name}</div>
                                                        <div className="cell-sub" style={{ fontSize: 11.5 }}>
                                                            {item.user.role === "MANAGER" ? "Quản lý phòng" : "Nhân viên"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 7 Cột biểu diễn trạng thái */}
                                            {item.days.map((day, dayIdx) => (
                                                <td key={dayIdx} style={{ padding: "8px 10px", verticalAlign: "middle" }}>

                                                    {/* TRẠNG THÁI: ĐI LÀM (Kèm Check Đi muộn/Về sớm) */}
                                                    {day.status === "WORKING" && (
                                                        <div className="pill-block" 
                                                            style={
                                                                (!day.attendance_status || day.attendance_status === "Chưa chấm công") 
                                                                ? { background: "#F1F5F9", color: "#64748B", border: "1px dashed #CBD5E1" } 
                                                                : (day.attendance_status.toLowerCase().includes("muộn") || day.attendance_status.toLowerCase().includes("sớm"))
                                                                ? { background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A" }
                                                                : (day.attendance_status === "Đang Làm")
                                                                ? { background: "#DBEAFE", color: "#2563EB", border: "1px solid #BFDBFE" }
                                                                : { background: "#DCFCE7", color: "#16A34A", border: "1px solid #BBF7D0" }
                                                            }>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                                                                {day.attendance_status && day.attendance_status !== "Chưa chấm công" ? <FaCheckCircle size={13} /> : <FaCalendarDay size={13} />}
                                                                <span style={{ fontWeight: 600 }}>{day.attendance_status === "Chưa chấm công" ? "Chưa chấm công" : (!day.attendance_status ? "Lịch đi làm" : day.attendance_status)}</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* TRẠNG THÁI: NGHỈ CUỐI TUẦN */}
                                                    {day.status === "WEEKEND" && (
                                                        <div className="pill-block pill-weekend">
                                                            <FaCoffee size={13} />
                                                            <span>Ngày nghỉ</span>
                                                        </div>
                                                    )}

                                                    {/* TRẠNG THÁI: NGHỈ CÓ PHÉP */}
                                                    {day.status === "LEAVE" && (
                                                        <div className="pill-block pill-leave" title={`Lý do: ${day.reason || "Không có nội dung"}`}>
                                                            <FaTimesCircle size={13} />
                                                            <span>Nghỉ phép</span>
                                                        </div>
                                                    )}

                                                    {/* TRẠNG THÁI: NGHỈ KHÔNG PHÉP (Mới thêm) */}
                                                    {day.status === "UNEXCUSED" && (
                                                        <div className="pill-block pill-unexcused" title={day.reason || "Không chấm công"}>
                                                            <FaExclamationTriangle size={13} />
                                                            <span>Không phép</span>
                                                        </div>
                                                    )}

                                                    {/* TRẠNG THÁI: NGHỈ LỄ */}
                                                    {day.status === "HOLIDAY" && (
                                                        <div className="pill-block" style={{ background: "#F3E8FF", color: "#9333EA", border: "1px dashed #D8B4FE" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                                                                <FaCalendarDay size={13} />
                                                                <span style={{ fontWeight: 600 }}>{day.attendance_status || "Nghỉ lễ"}</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* TRẠNG THÁI: CHƯA CÓ DỮ LIỆU (NOT_JOINED) */}
                                                    {day.status === "NOT_JOINED" && (
                                                        <div className="pill-block" style={{ background: "#F8FAFC", color: "#94A3B8", border: "1px dashed #CBD5E1" }}>
                                                            <span>Chưa có dữ liệu</span>
                                                        </div>
                                                    )}

                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── PHẦN CHÚ THÍCH (GUIDE BADGE) ─── */}
            <div className="schedule-legend">
                <div style={{ fontWeight: 700, color: "var(--text)", marginRight: 10 }}>Chú thích ký hiệu:</div>
                <div className="legend-item">
                    <div className="dot" style={{ background: "#22C55E" }} /> Đã đi làm
                </div>
                <div className="legend-item">
                    <div className="dot" style={{ background: "#CBD5E1", border: "1px dashed #94A3B8" }} /> Lịch làm việc (chưa chấm)
                </div>
                <div className="legend-item">
                    <div className="dot" style={{ background: "#94A3B8" }} /> Ngày nghỉ
                </div>
                <div className="legend-item">
                    <div className="dot" style={{ background: "#9333EA" }} /> Lễ / Tết
                </div>
                <div className="legend-item">
                    <div className="dot" style={{ background: "#F59E0B" }} /> Đi muộn / Về sớm
                </div>
                <div className="legend-item">
                    <div className="dot" style={{ background: "#3B82F6" }} /> Nghỉ có phép
                </div>
                <div className="legend-item">
                    <div className="dot" style={{ background: "#EF4444" }} /> Nghỉ không phép
                </div>
            </div>
        </div>
    );
};

export default SchedulePage;