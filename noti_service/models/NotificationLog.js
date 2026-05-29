const mongoose = require("mongoose");

const NotificationLogSchema = new mongoose.Schema({
  announcement_id: { type: Number },
  title: { type: String, required: true },
  sender_id: { type: Number, required: true },
  target_type: { type: String, required: true },
  action: { type: String, required: true }, // 'SENT' hoặc 'READ'
  performed_by: { type: Number }, // User ID của người thực hiện hành động (người gửi hoặc người đọc)
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("NotificationLog", NotificationLogSchema);