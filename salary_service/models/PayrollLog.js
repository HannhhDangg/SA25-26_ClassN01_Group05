const mongoose = require("mongoose");

const PayrollLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // VD: 'CALCULATE_PAYROLL', 'APPROVE_PAYROLL'
  performed_by: { type: Number, required: true }, // User ID của người thực hiện (Admin / Manager)
  target_month: { type: Number }, // Tháng được tính lương
  target_year: { type: Number }, // Năm được tính lương
  details: { type: Object }, // Lưu thêm thông tin phụ (VD: Số lượng nhân sự đã tính lương)
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PayrollLog", PayrollLogSchema);