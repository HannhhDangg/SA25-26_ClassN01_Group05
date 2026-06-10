#!/bin/bash
# ==============================================================================
# Wrapper script for Cron Job Backup
# Chứa các cấu hình biến môi trường cần thiết để chạy ngầm từ cron
# ==============================================================================

# Khai báo các biến môi trường bắt buộc (bạn có thể thay đổi nếu cần)
export BACKUP_ROOT="/home/ubuntu01/Desktop/Code/SA25-26_ClassN01_Group05/backup_data"
export PG_PASSWORD="rootpassword"

# Chuyển hướng Terminal về đúng thư mục chứa Docker Compose
cd "/home/ubuntu01/Desktop/Code/SA25-26_ClassN01_Group05"

# Thực thi script backup chính
./backup/backup.sh
