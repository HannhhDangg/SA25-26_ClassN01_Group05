import {useEffect, useState} from "react";
import {FaCheckCircle, FaTimesCircle, FaClock, FaChevronLeft, FaChevronRight} from "react-icons/fa";
import {toast} from "react-toastify";
const Attendance =() =>{
  const [now, setNow] = useState(new Date());
  const [workedDates, setWorkedDates] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [otpCode, setOtpCode] = useState("");
  const [user] = useState(JSON.parse(localStorage.getItem("user") || "{}")); // Giả sử thông tin user được lưu trong localStorage sau khi đăng nhập, bao gồm user_id và device_id
  const [generatedCode, setGeneratedCode] = useState("---");
  const [timeLeft, setTimeLeft] = useState(30);
  const [logs, setLogs] = useState([]);
  const [deviceId,setDeviceId] = useState("");
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
  const canCheckedIn = !hasCheckedIn && currenHours >= 8;
  const canCheckedOut = !hasCheckedOut && currenHours >= 16;
  const isDoneToday = hasCheckedOut;

  const checkedIn = hasCheckedIn && ! hasCheckedOut;
  const statusText = isDoneToday ? "Tan Làm" : (hasCheckedIn ? "Đang Làm" : "Chưa Vào Làm");

  // tính tổng số ngày trong tháng hiện 
  const workedDaysInCurrentMonth = workedDates.filter(dateString =>{
    const date = new Date(dateString);
    return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
  }).length;

  useEffect(() =>{
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  },[]);

  useEffect(() => {
    fetchHistory();
  }, []);
  useEffect(() => {
    if(canCheckedIn || canCheckedOut){
      fetchCode();
    }else{
      setGeneratedCode("---");
      setOtpCode("");
      setTimeLeft(0)
    }
  },[canCheckedIn, canCheckedOut]);

  useEffect( () => {
    if(timeLeft <= 0) {
      if (canCheckedIn || canCheckedOut) {
        fetchCode();
      }
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return() => clearInterval(timer);
  }, [timeLeft, canCheckedIn, canCheckedOut]);


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
  const handleAttendance = async() => {
    if(!otpCode || otpCode.length !== 6){
      toast.error("Vui lòng nhập đủ 6 số OTP: ");
      return;
    }
    
    // const user_id = user.user_id || user.id || 1;
    if (!user.id) {
      toast.error("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
      return;
    }
    try{
      const res = await fetch("/api/attendance/verify-code",{
        method: "POST",
        headers:{
          "Content-Type":"application/json"
        },
        body: JSON.stringify({
          user_id: user.id,
          code: otpCode,
          device_id: deviceId,
          type: hasCheckedIn ? "check-out" : "check-in" // Xác định loại chấm công dựa trên trạng thái hiện tại
        })
      });

      if(res.ok){
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();

        if(!hasCheckedIn){
          const lateMinutes = (currentHour* 60 + currentMinutes) - (8 * 60 +30);
          if(lateMinutes > 10){
            toast.warning(`Chấm công thành công! Bạn đã đi muộn ${lateMinutes} phút`);
          }else{
            toast.success(`Chấm công thành công`);
          }
        }else{
          toast.info("Kết thúc ca làm việc. Đã ghi nhận giờ ra !");
        }      
        setOtpCode("");
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
  const fetchCode = async () => {
    try{
      const res = await fetch("/api/attendance/generate-code");
      if(res.ok){
        const data = await res.json();
        setGeneratedCode(data.code);
        setOtpCode(data.code); // Tự động điền mã vào ô nhập liệu
        setTimeLeft(data.expires_in || 30);
      } else {
        console.error("Lỗi gọi API. HTTP Status:", res.status);
        setGeneratedCode("LỖI");
        setTimeLeft(5); // Thử lại sau 5s nếu lỗi để tránh lặp vô hạn
      }
    }catch(err){
      console.error("Lỗi lấy mã chấm công",err);
      setGeneratedCode("LỖI");
      setTimeLeft(5); // Thử lại sau 5s nếu lỗi
    }
  }
  const fetchHistory = async() => {
    if(!user.id)return;
    try{
      const res = await fetch(`/api/attendance/history/${user.id}`);
      if(res.ok){
        const data = await res.json();
        setLogs(data);

        // trích suất những ngày đi làm
        const dates = data
          .filter(log => log.check_out_time)
          .map(log => formatDateKey(new Date(log.work_date)));
        setWorkedDates(dates);

      }
    }catch(err){
      console.log("Lỗi lấy lịch sử chấm công: ",err);
    }
  }
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
          {(canCheckedIn || canCheckedOut) ? (
            <>
              <div style={{ textAlign: "center", background: "#f8fafc", padding: "10px 20px", borderRadius: "8px", border: "1px dashed var(--border)", width: "100%", maxWidth: "280px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-sub)", marginBottom: "4px" }}>Mã hiển thị trên Terminal:</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", letterSpacing: "6px", color: "var(--primary)" }}>{generatedCode}</div>
                <div style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "4px" }}>Đổi mã sau: <span style={{ color: timeLeft <= 5 ? "red" : "inherit", fontWeight: "bold" }}>{timeLeft}s</span></div>
              </div>
              <input 
                type="text" 
                maxLength="6"
                placeholder="Nhập mã 6 số trên màn hình"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                style={{ width: "100%", maxWidth: "280px", padding: "12px", textAlign: "center", fontSize: "12px", letterSpacing: "4px", borderRadius: "8px", border: "1px solid var(--border)", outline: "none", fontWeight: "600" }}
              />
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
                 <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: "14px" }}>🎉 Đã hoàn thành công việc hôm nay!</span>
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
    </div>
  );
};
export default Attendance;