import {useEffect, useState} from "react";
import {FaCheckCircle, FaTimesCircle, FaClock, FaChevronLeft, FaChevronRight} from "react-icons/fa";
import {toast} from "react-toastify";
const Attendance =() =>{
  const [now, setNow] = useState(new Date());
  const [workedDates, setWorkedDates] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}")); // Giả sử thông tin user được lưu trong localStorage sau khi đăng nhập, bao gồm user_id và device_id
  const [logs, setLogs] = useState([]);
  const token = localStorage.getItem("token");
  const [deviceId,setDeviceId] = useState("");
  const [teamAttendance, setTeamAttendance] = useState([]);
  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();
  const monthLabel = calendarDate.toLocaleDateString("vi-VN", { month: "long" });
  const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // new Date(currentYear, currentMonth, 1).getDay() = 5  xong rồi + 6 = 11 %7  = 4 (dư) => 4 ô trống 
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate(); // new Date(currentYear, currentMonth + 1, 0).getDate() = 0 của tháng 6 không có thì sẽ tự động lùi về ngày cuối cùng của tháng 5 => 31 ngày 
  
  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) calendarDays.push(null); // thêm ô trống của 1 tháng bằng cách pull vào
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(new Date(currentYear, currentMonth, day));

  const formatDateKey = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const workedDatesSet = new Set(workedDates.map(date => date));
  
  // tư động suy luận trạng thái
  const todayDateString = new Date().toLocaleDateString("vi-VN");
  const todayLog = logs.find(log => new Date(log.work_date).toLocaleDateString("vi-VN") === todayDateString);
  // console.log(todayLog) // ra 1 object có workdate = todayDateString;
  const hasCheckedIn = !!(todayLog && todayLog.check_in_time); // !! ép sang kiểu boolean
  // console.log(hasCheckedIn);
  const hasCheckedOut = !!(todayLog && todayLog.check_out_time);
  const currenHours = now.getHours();

  // các điều kiện ràng buộc 
  const isDoneToday = hasCheckedIn && hasCheckedOut;
  const canCheckedIn = !hasCheckedIn;
  const canCheckedOut = hasCheckedIn && !hasCheckedOut;

  const checkedIn = hasCheckedIn && ! hasCheckedOut;
  const statusText = isDoneToday ? "Tan Làm" : (hasCheckedIn ? "Đang Làm" : "Chưa Vào Làm");

  // Kiểm tra ngày nghỉ & Lễ
  const getHolidayReason = (date) => {
    const mmdd = String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    if (mmdd === "01-01") return "Tết Dương Lịch";
    if (mmdd === "04-26") return "Giỗ Tổ Hùng Vương";
    if (mmdd === "04-30") return "Giải Phóng Miền Nam";
    if (mmdd === "05-01") return "Quốc Tế Lao Động";
    if (mmdd === "09-02") return "Quốc Khánh";
    return null;
  };
  const holidayReason = getHolidayReason(now);
  const isDayOff = now.getDay() === 0 || holidayReason !== null;


  useEffect(() =>{
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  },[]);

  useEffect(() => {
    fetchHistory(); // bổ trợ chho Kiểm tra log (todayLog)
    fetchTeamAttendance();
  }, []);

  // Lấy hoặc tạo device_id khi component mount
  useEffect(() => {
    let storedDeviceId = localStorage.getItem("device_id");
    if (!storedDeviceId) {
      // Tạo một ID ngẫu nhiên đơn giản và duy nhất cho thiết bị này
      storedDeviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem("device_id", storedDeviceId);
    }
    setDeviceId(storedDeviceId);
  }, []);

    // tính tổng số ngày trong tháng hiện 
  const workedDaysInCurrentMonth = workedDates.filter(dateString =>{
    const date = new Date(dateString);
    return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
  }).length;
  
// Nút check-in check-out
  const handleAttendance = async() => {
    if (!user.id) {
      toast.error("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
      return;
    }
    if (isDayOff) {
      toast.error("Không thể chấm công vào ngày nghỉ!");
      return;
    }
    if(hasCheckedIn && !window.confirm("Bạn có muốn chắc chắn chấm công tan làm không")){
      return;
    }

    //  tính toán số phút trước khi gửi đi 
    const Check_In_Hour = 8;
    const Check_In_Minute = 30;
    const Check_Out_Hour = 17;
    const Check_Out_Minute = 0;
    const GRACE_PERIOD_MINUTES = 10; // Số phút đi muộn được cho phép
    const nowInMinutes = now.getHours() * 60 + now.getMinutes();

    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    
    // Khai báo type và các biến dùng để hiển thị toast
    const type = hasCheckedIn ? "check-out" : "check-in";
    let checkInTimeNow = 0;
    let checkOutTimeNow = 0;

    if(type === "check-in"){
      const checkInTimeInMinute = Check_In_Hour * 60 + Check_In_Minute;
      checkInTimeNow = nowInMinutes - checkInTimeInMinute; // thời gian vào 
      if(checkInTimeNow > 0){
        lateMinutes = checkInTimeNow;
      }
    }else{ // trường hợp check-out 
      const checkOutTimeInMinute = Check_Out_Hour * 60 + Check_Out_Minute;
      checkOutTimeNow = nowInMinutes - checkOutTimeInMinute;
      if(checkOutTimeNow < 0){
        earlyLeaveMinutes = Math.abs(checkOutTimeNow);
      }
    }
    
    try{
      const res = await fetch("/api/attendance/verify-code",{
        method: "POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          device_id: deviceId,
          late_minutes: lateMinutes,
          early_leave_minutes: earlyLeaveMinutes,
          type: type 
        })
      });

      if(res.ok){
        if(type === "check-in"){
          if(checkInTimeNow < 0){
            toast.warning(`Chấm công thành công! Bạn đã đi sớm ${Math.abs(checkInTimeNow)} phút`);
          }else if(checkInTimeNow > GRACE_PERIOD_MINUTES){
            toast.warning(`Chấm công thành công! Bạn đã đi muộn ${checkInTimeNow} phút`);
          }else{
            toast.success(`Chấm công thành công`);
          }
        }else{ //trường hợp checkout 
          if(checkOutTimeNow < 0){
            toast.warning(`Kết thúc ca làm việc! Bạn đã về sớm ${Math.abs(checkOutTimeNow)} phút`);
          }else if(checkOutTimeNow > 0){
            toast.info(`Kết thúc ca làm việc! Bạn đã về trễ ${checkOutTimeNow} phút (ghi nhận tăng ca).`);
          }
          else{
            toast.info("Kết thúc ca làm việc. Đã ghi nhận giờ ra !");
          }
        }      
        fetchHistory();
      }else{
        const data = await res.json();
        toast.error(data.message || "Chấm công thất bại. Vui lòng thử lại!");
      } 
    }catch(err){
      toast.error("Lỗi kết nối máy chủ");
    }
  }
  const timeString = now.toLocaleTimeString("vi-VN",{
    hour:"2-digit",
    minute:"2-digit",
    second:"2-digit",
  });
  const dateString = now.toLocaleDateString("vi-VN",{
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const handlePrevMonth =() =>{
    setCalendarDate(new Date(currentYear, currentMonth - 1, 1)); 
  }
  const handleNextMonth =() =>{
    setCalendarDate(new Date(currentYear, currentMonth + 1, 1));
  }
  
  const fetchHistory = async() => {
    if(!user.id)return;
    try{
      const res = await fetch(`/api/attendance/history/${user.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if(res.ok){
        const data = await res.json();
        const logsArray = Array.isArray(data) ? data : []; // Tránh sập trang web nếu dữ liệu sai định dạng
        setLogs(logsArray);

        // trích suất những ngày đi làm
        const dates = logsArray
          .filter(log => log.check_out_time)
          .map(log => formatDateKey(new Date(log.work_date)));
        setWorkedDates(dates);

      }
    }catch(err){
      console.log("Lỗi lấy lịch sử chấm công: ",err);
    }
  }

  const fetchTeamAttendance = async () => {
    if (user.role === "MANAGER" && user.department_id) {
      try {
        const res = await fetch(`/api/attendance/team-today/${user.department_id}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTeamAttendance(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.log("Lỗi lấy danh sách chấm công nhóm: ", err);
      }
    }
  };
  return(
    <div className="attendance-page">
      <div className="page-header" style={{marginBottom: 18}}>
        <div>
          <h1 style={{fontSize: 24, fontweight: 700, marginBottom: 6}}>Chấm Công</h1>
          <p style={{color: "var(--text-sub)", fontSize: 14, margin: 0}}>
            Quản lý giờ vào/ra, ghi nhận lịch sử chấm công và trạng thái hiện tại.
          </p>
        </div>
      </div>

      <div className="two-col" style={{gap:18, marginBottom: 20, padding: 0}}>
        <div className="card attendance-status-card">
          <div className="attendance-status-top">
            <div>
              <div className="attendance-status-label">Chấm công hôm nay</div>
              <div className="attendance-status-time">{timeString}</div>
              <div className="attendance-status-sub">{dateString}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="attendance-status-label">Công tháng {monthLabel}</div>
              <div className="attendance-status-time" style={{ color: "var(--success, #22c55e)" }}>{workedDaysInCurrentMonth}</div>
              <div className="attendance-status-sub">/{daysInMonth} ngày</div>
            </div>
          </div>
          <div className="attendance-schedule-bottom">
            <div className="attendance-calender">
              <div className="calender-header">
                <div>
                  <div className="calender-sub">Lịch chấm công tháng</div>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", background:"#223771",margin:"10px 0"}}>
                  <div className="calender-month-title" style={{display:"flex", alignItems:"center", fontSize:"20px", fontWeight:"600", color:"#fff",paddingLeft:"10px"
                  }}>{monthLabel} {currentYear}</div>
                  <div style={{display:"flex",justifyContent:"end", gap:"8px", margin:"10px"}}>
                    <button onClick={handlePrevMonth} style={{background:"var(--pg-page)", borderRadius:"6px",border:"none", color:"#fff"}}>
                      <FaChevronLeft size={20} />
                    </button>
                    <button onClick={handleNextMonth} style={{background:"var(--pg-page)", borderRadius:"6px",border:"none",color:"#fff"}}>
                      <FaChevronRight size={20}/>
                    </button> 
                  </div>
                </div>
              </div>
              <div className="calendar-grid">
                {['T2','T3','T4','T5','T6','T7','CN'].map((label) =>(
                  <div key={label} className="calender-day-header">{label}</div>
                ))}
                {calendarDays.map((day, index) =>{
                  if(!day){
                    return <div key={`empty-${index}`} className="calendar-day-cell empty"></div>
                  }
                  const dayString = formatDateKey(day);
                  const isWorked = workedDatesSet.has(dayString);
                  const isToday = day.toDateString() === new Date().toDateString();
                  
                  let cellClass = "calendar-day-cell";
                  if(isWorked) cellClass += " worked-day";
                  if(isToday) cellClass += " today";
                  return (
                    <div
                      key={index}
                      className={cellClass}
                    >
                      {day.getDate()}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="attendance-clock-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 20px", background: "var(--bg-page, #fff)", borderRadius: "12px", border: "1px solid var(--border, #e5e7eb)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", gap: "20px" }}>
          <div style={{
            width: "72px", 
            height: "72px", 
            borderRadius: "50%", 
            background: checkedIn ? "#FEE2E2" : "#DBEAFE", 
            color: checkedIn ? "#EF4444" : "#2563eb", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            fontSize: "30px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.05)"
          }}>
            <FaClock />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--text)", marginBottom: "4px" }}>
              Trạng thái: {statusText}
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-sub)" }}>
              {checkedIn ? "Nhớ chấm công ra khi kết thúc ngày làm việc nhé!" : "Hãy chấm công vào để bắt đầu tính giờ làm việc."}
            </div>
          </div>
          {/* ẨN HIỆN Ô NHẬP MÃ THEO THỜI GIAN VÀ TRẠNG THÁI */}
          {isDayOff ? (
             <div style={{ padding: "15px", textAlign: "center", background: "#f1f5f9", borderRadius: "8px", width: "100%", maxWidth: "280px" }}>
               <span style={{ color: "#3b82f6", fontWeight: "bold", fontSize: "14px" }}>🎉 Hôm nay là ngày nghỉ</span>
               <div style={{ fontSize: "13px", color: "var(--text-sub)", marginTop: "4px" }}>
                 {holidayReason ? `Nghỉ lễ: ${holidayReason}` : "Nghỉ cuối tuần (Chủ Nhật)"}
               </div>
               <div style={{ fontSize: "12px", color: "#EF4444", marginTop: "8px" }}>Hệ thống đóng chấm công.</div>
             </div>
          ) : (canCheckedIn || canCheckedOut) ? (
            <>
              <button 
                onClick={handleAttendance} 
                style={{ cursor: "pointer", border: "none", borderRadius: "8px", padding: "14px 32px", fontWeight: 600, fontSize: "16px", color: "#fff", background: canCheckedOut ? "#EF4444" : "var(--primary, #2563eb)", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)", transition: "all 0.2s ease-in-out", display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: "280px", gap: "8px" }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
              >
                {canCheckedOut ? "Chấm công Ra" : "Chấm công Vào"}
              </button>
            </>
          ) : (
             <div style={{ padding: "15px", textAlign: "center", background: "#f1f5f9", borderRadius: "8px", width: "100%", maxWidth: "280px" }}>
               {isDoneToday ? (
                 <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: "14px" }}> Đã chấm công hôm nay!</span>
               ) : hasCheckedIn ? (
                 <span style={{ color: "#ea580c", fontWeight: "bold", fontSize: "14px" }}>⏳ Chưa đến giờ tan làm (17:00)</span>
               ) : (
                 <span style={{ color: "#ea580c", fontWeight: "bold", fontSize: "14px" }}>⏳ Chưa đến giờ làm việc (8:00)</span>
               )}
             </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{padding: "16px 20px", fontWeight: 600, fontSize: "20px", color: "var(--text)"}}> Lịch Sử Chấm Công</div>
        <div className="table-wrap-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{fontSize:"15px", fontWeight:500}}>Ngày</th>
                  <th style={{fontSize:"15px", fontWeight:500}}>Giờ Vào</th>
                  <th style={{fontSize:"15px", fontWeight:500}}>Giờ Ra</th>
                  <th style={{fontSize:"15px", fontWeight:500}}>Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr></tr>
                ) : (
                  logs.map((log)=>(
                    <tr key={log.id}>
                      <td>{new Date(log.work_date).toLocaleDateString("vi-VN")}</td>
                      <td>{log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) : "---"}</td>
                      <td>{log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) : "---"}</td>
                      <td style={{color: log.status === "Đang Làm" ? "#eab308" : log.status === "Tan Làm" ? "#22c55e" : "var(--text)", fontWeight:600}}>
                        {log.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </div>
      </div>

      {/* HIỂN THỊ BẢNG THEO DÕI NHÓM NẾU LÀ MANAGER */}
      {user.role === "MANAGER" && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{padding: "16px 20px", fontWeight: 600, fontSize: "20px", color: "var(--text)"}}>Trạng Thái Điểm Danh Nhóm Hôm Nay</div>
          <div className="table-wrap-scroll">
              <table>
                <thead>
                  <tr>
                    <th style={{fontSize:"15px", fontWeight:500}}>Nhân viên</th>
                    <th style={{fontSize:"15px", fontWeight:500}}>Giờ Vào</th>
                    <th style={{fontSize:"15px", fontWeight:500}}>Giờ Ra</th>
                    <th style={{fontSize:"15px", fontWeight:500}}>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {teamAttendance.length === 0 ? (
                    <tr><td colSpan="4" style={{textAlign:"center"}}>Chưa có dữ liệu nhóm hoặc nhóm chưa có nhân viên</td></tr>
                  ) : (
                    teamAttendance.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt={member.full_name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold" }}>
                                {member.full_name?.split(" ").slice(-1)[0][0] || "U"}
                              </div>
                            )}
                            <span style={{ fontWeight: 500 }}>{member.full_name}</span>
                          </div>
                        </td>
                        <td>{member.check_in_time ? new Date(member.check_in_time).toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit"}) : "---"}</td>
                        <td>{member.check_out_time ? new Date(member.check_out_time).toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit"}) : "---"}</td>
                        <td style={{color: member.status === "Đang Làm" ? "#eab308" : member.status === "Tan Làm" ? "#22c55e" : "var(--text-sub)", fontWeight: 600}}>
                          {member.status || "Chưa Vào Làm"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default Attendance;