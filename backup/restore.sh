#!/bin/bash
set -euo pipefail

# ==============================================================================
# HR Microservices Restore Script (Docker Exec Version)
# ==============================================================================

RESTORE_DATE=${1:-}
RESTORE_TIME=${2:-}

if [[ -z "$RESTORE_DATE" ]]; then
    echo "Lỗi: Vui lòng cung cấp ngày cần khôi phục."
    echo "Cách dùng: $0 <YYYY-MM-DD> [HH-MM]"
    exit 1
fi

# === CONFIGURATION & DEFAULTS ===
BACKUP_ROOT="${BACKUP_ROOT:-/backup}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-}"
PG_CONTAINER="${PG_CONTAINER:-postgres-1}"
MONGO_CONTAINER="${MONGO_CONTAINER:-mongo-1}"
MONGO_LOCAL_URI="mongodb://localhost:27017/?directConnection=true"
PG_DATA_DIR="${PG_DATA_DIR:-/var/lib/postgresql/data}"

# === DATABASES ===
PG_DBS=("postgres")

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$1] $2"; }
info() { log "INFO" "$1"; }
warn() { log "WARN" "$1"; }
error() { log "ERROR" "$1"; }

# --- 1. RESTORE POSTGRESQL ---
restore_postgres() {
    info "--- Bắt đầu khôi phục PostgreSQL ---"
    
    local target_inc=""
    if [[ -n "$RESTORE_TIME" ]]; then
        target_inc="${BACKUP_ROOT}/incremental/postgres/${RESTORE_DATE}_${RESTORE_TIME}"
    else
        if [[ -d "${BACKUP_ROOT}/incremental/postgres" ]]; then
            target_inc=$(find "${BACKUP_ROOT}/incremental/postgres" -mindepth 1 -maxdepth 1 -type d -name "${RESTORE_DATE}_*" 2>/dev/null | sort | tail -n 1 || true)
        fi
    fi

    if [[ -n "$target_inc" && -d "$target_inc" ]]; then
        info "Tìm thấy bản sao lưu Logical Dump tại: $target_inc"
        for db in "${PG_DBS[@]}"; do
            local dump_file="${target_inc}/${db}.dump"
            if [[ -f "$dump_file" ]]; then
                info "Đang khôi phục logical dump cho Database: $db..."
                # Dùng docker exec với STDIN (<)
                docker exec -i -e PGPASSWORD="${PG_PASSWORD}" "${PG_CONTAINER}" pg_restore -U "${PG_USER}" -d "$db" --clean --if-exists < "$dump_file" || warn "Lỗi khi khôi phục $db"
            else
                warn "Không tìm thấy file $dump_file!"
            fi
        done
    else
        local full_dir="${BACKUP_ROOT}/full/postgres/${RESTORE_DATE}"
        if [[ -d "$full_dir" ]]; then
            info "Khôi phục từ bản Full Backup Logical..."
            for db in "${PG_DBS[@]}"; do
                local dump_file="${full_dir}/${db}.dump"
                if [[ -f "$dump_file" ]]; then
                    info "Đang khôi phục logical dump (FULL) cho Database: $db..."
                    docker exec -i -e PGPASSWORD="${PG_PASSWORD}" "${PG_CONTAINER}" pg_restore -U "${PG_USER}" -d "$db" --clean --if-exists < "$dump_file" || warn "Lỗi khi khôi phục $db"
                fi
            done
        else
            error "Không tìm thấy bất kỳ bản sao lưu PostgreSQL nào cho ngày $RESTORE_DATE"
        fi
    fi
}

# --- 2. RESTORE MONGODB ---
restore_mongodb() {
    info "--- Bắt đầu khôi phục MongoDB ---"
    
    local full_dir="${BACKUP_ROOT}/full/mongodb/${RESTORE_DATE}"
    if [[ -d "$full_dir" ]]; then
        info "Đang áp dụng bản MongoDB Full Backup từ ${full_dir}..."
        for archive in "${full_dir}"/*.archive.gz; do
            info "Khôi phục Full: $(basename "$archive")"
            docker exec -i "${MONGO_CONTAINER}" mongorestore --uri="${MONGO_LOCAL_URI}" --archive --gzip --drop < "${archive}" || warn "Lỗi khi khôi phục ${archive}"
        done
    else
        warn "Không tìm thấy MongoDB Full Backup cho ngày $RESTORE_DATE tại $full_dir"
        return
    fi
    
    local inc_dirs=""
    if [[ -d "${BACKUP_ROOT}/incremental/mongodb" ]]; then
        inc_dirs=$(find "${BACKUP_ROOT}/incremental/mongodb" -mindepth 1 -maxdepth 1 -type d -name "${RESTORE_DATE}_*" 2>/dev/null | sort || true)
    fi
    
    if [[ -z "$inc_dirs" ]]; then
        info "Không có bản backup Incremental nào cho MongoDB."
        return
    fi

    for dir in $inc_dirs; do
        local dir_time
        dir_time=$(basename "$dir" | awk -F'_' '{print $2}')
        if [[ -n "$RESTORE_TIME" && "$dir_time" > "$RESTORE_TIME" ]]; then
            continue
        fi
        
        if [[ -f "${dir}/oplog.archive.gz" ]]; then
            info "Đang Replay Oplog từ ${dir}/oplog.archive.gz..."
            docker exec -i "${MONGO_CONTAINER}" mongorestore --uri="${MONGO_LOCAL_URI}" --oplogReplay --archive --gzip < "${dir}/oplog.archive.gz" || warn "Lỗi khi replay oplog từ $dir"
        else
            for inc_dump in "${dir}"/*.archive.gz; do
                if [[ "$(basename "$inc_dump")" != "oplog.archive.gz" ]]; then
                    info "Khôi phục Incremental Fallback: $(basename "$inc_dump")"
                    docker exec -i "${MONGO_CONTAINER}" mongorestore --uri="${MONGO_LOCAL_URI}" --archive --gzip < "${inc_dump}" || warn "Lỗi khi khôi phục $inc_dump"
                fi
            done
        fi
    done
}

# --- MAIN ---
echo "====================================================="
echo " HỆ THỐNG KHÔI PHỤC DỮ LIỆU HR SYSTEM"
echo " Ngày mục tiêu: $RESTORE_DATE"
[[ -n "$RESTORE_TIME" ]] && echo " Giờ mục tiêu: $RESTORE_TIME"
echo "====================================================="

read -p "CẢNH BÁO: Ghi đè dữ liệu! Bạn có chắc chắn muốn tiếp tục? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

restore_postgres
restore_mongodb

info "Quá trình khôi phục dữ liệu hoàn tất."