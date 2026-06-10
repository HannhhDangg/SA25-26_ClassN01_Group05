#!/bin/bash
set -euo pipefail

# ==============================================================================
# HR Microservices Backup Script (Docker Exec Version)
# Chạy hoàn toàn qua docker exec, không cần cài tool (pg_dump, mongodump) trên máy host
# ==============================================================================

# === CONFIGURATION & DEFAULTS ===
BACKUP_ROOT="${BACKUP_ROOT:-/backup}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-}"
PG_CONTAINER="${PG_CONTAINER:-postgres-1}"
MONGO_CONTAINER="${MONGO_CONTAINER:-mongo-1}"
MONGO_LOCAL_URI="mongodb://localhost:27017/?directConnection=true"

S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-}"
GPG_RECIPIENT="${GPG_RECIPIENT:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
PUSHGATEWAY="${PUSHGATEWAY:-}"
FULL_RETENTION_DAYS="${FULL_RETENTION_DAYS:-30}"
INC_RETENTION_DAYS="${INC_RETENTION_DAYS:-7}"

# === DIRECTORIES ===
DATE_FULL="$(date +%Y-%m-%d)"
DATE_INC="$(date +%Y-%m-%d_%H-%M)"
LOG_FILE="${BACKUP_ROOT}/logs/backup_${DATE_FULL}.log"
STATE_FILE="${BACKUP_ROOT}/.backup_state"
LOCK_FILE="/tmp/hr_backup.lock"

# === DATABASES ===
PG_DBS=("postgres")
MONGO_DBS=("logs_db")

# === GLOBALS ===
errors=0
start_time=$(date +%s)
backup_mode="UNKNOWN"

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================
log() {
    local level="$1"
    local msg="$2"
    local timestamp
    timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    echo "[${timestamp}] [${level}] ${msg}" | tee -a "${LOG_FILE}"
}

info() { log "INFO" "$1"; }
warn() { log "WARN" "$1"; }
error() { log "ERROR" "$1"; }

cleanup_lock() { rm -f "${LOCK_FILE}"; }
trap cleanup_lock EXIT

acquire_lock() {
    if [[ -f "${LOCK_FILE}" ]]; then
        local pid
        pid=$(cat "${LOCK_FILE}")
        if kill -0 "${pid}" 2>/dev/null; then
            echo "Backup already running with PID ${pid}. Exiting."
            exit 1
        else
            rm -f "${LOCK_FILE}"
        fi
    fi
    echo $$ > "${LOCK_FILE}"
}

setup_dirs() {
    mkdir -p "${BACKUP_ROOT}/logs"
    mkdir -p "${BACKUP_ROOT}/full/postgres"
    mkdir -p "${BACKUP_ROOT}/full/mongodb"
    mkdir -p "${BACKUP_ROOT}/incremental/postgres"
    mkdir -p "${BACKUP_ROOT}/incremental/mongodb"
    touch "${LOG_FILE}"
}

load_state() {
    if [[ -f "${STATE_FILE}" ]]; then
        source "${STATE_FILE}"
    fi
}

save_state() {
    cat > "${STATE_FILE}" <<EOF
LAST_FULL_DATE="${1:-${LAST_FULL_DATE:-}}"
LAST_PG_LSN="${2:-${LAST_PG_LSN:-}}"
LAST_MONGO_TS="${3:-${LAST_MONGO_TS:-}}"
EOF
}

# ==============================================================================
# POSTGRESQL BACKUP
# ==============================================================================
backup_pg_full() {
    local dest_dir="${BACKUP_ROOT}/full/postgres/${DATE_FULL}"
    mkdir -p "${dest_dir}"
    info "Starting PostgreSQL FULL Backup to ${dest_dir}"
    
    local pg_err=0
    
    info "Running logical full backup (pg_dump -Fc) due to Spilo/Patroni replication restrictions..."
    for db in "${PG_DBS[@]}"; do
        docker exec -e PGPASSWORD="${PG_PASSWORD}" "${PG_CONTAINER}" pg_dump -U "${PG_USER}" -Fc -d "${db}" > "${dest_dir}/${db}.dump" || pg_err=1
    done
        
    info "Dumping PostgreSQL schemas..."
    for db in "${PG_DBS[@]}"; do
        docker exec -e PGPASSWORD="${PG_PASSWORD}" "${PG_CONTAINER}" pg_dump -U "${PG_USER}" --schema-only -d "${db}" > "${dest_dir}/${db}_schema.sql" || pg_err=1
    done
    
    local current_lsn=""
    current_lsn=$(docker exec -e PGPASSWORD="${PG_PASSWORD}" "${PG_CONTAINER}" psql -U "${PG_USER}" -d postgres -tAc "SELECT pg_current_wal_lsn();" || echo "")
    
    if [[ -z "${current_lsn}" ]]; then
        error "Failed to retrieve PostgreSQL LSN"
        pg_err=1
    else
        info "PostgreSQL FULL Backup complete. LSN: ${current_lsn}"
        echo "${current_lsn}" > "${dest_dir}/lsn.txt"
    fi
    
    return $pg_err
}

backup_pg_inc() {
    local dest_dir="${BACKUP_ROOT}/incremental/postgres/${DATE_INC}"
    local last_lsn="${LAST_PG_LSN:-}"
    info "Starting PostgreSQL INCREMENTAL Backup to ${dest_dir} (Since LSN: ${last_lsn})"
    mkdir -p "${dest_dir}"
    
    local pg_err=0
    
    if [[ -z "${last_lsn}" ]]; then
        warn "No LAST_PG_LSN found. Generating fallback logical dumps."
    else
        info "Forcing PostgreSQL checkpoint..."
        docker exec -e PGPASSWORD="${PG_PASSWORD}" "${PG_CONTAINER}" psql -U "${PG_USER}" -d postgres -c "SELECT pg_checkpoint(); SELECT pg_switch_wal();" >/dev/null 2>&1 || true
    fi
    
    info "Generating incremental fallback (Logical Dumps) via docker..."
    for db in "${PG_DBS[@]}"; do
        docker exec -e PGPASSWORD="${PG_PASSWORD}" "${PG_CONTAINER}" pg_dump -U "${PG_USER}" -Fc -d "${db}" > "${dest_dir}/${db}.dump" || pg_err=1
    done
    
    local current_lsn=""
    current_lsn=$(docker exec -e PGPASSWORD="${PG_PASSWORD}" "${PG_CONTAINER}" psql -U "${PG_USER}" -d postgres -tAc "SELECT pg_current_wal_lsn();" || echo "")
    echo "${current_lsn}" > "${dest_dir}/lsn.txt"
    
    return $pg_err
}

# ==============================================================================
# MONGODB BACKUP
# ==============================================================================
backup_mongo_full() {
    local dest_dir="${BACKUP_ROOT}/full/mongodb/${DATE_FULL}"
    mkdir -p "${dest_dir}"
    info "Starting MongoDB FULL Backup to ${dest_dir}"
    local mongo_err=0
    
    for db in "${MONGO_DBS[@]}"; do
        info "Dumping MongoDB: ${db}"
        docker exec "${MONGO_CONTAINER}" mongodump --uri="${MONGO_LOCAL_URI}" --db="${db}" --archive --gzip > "${dest_dir}/${db}.archive.gz" || mongo_err=1
    done
    
    local oplog_ts=""
    oplog_ts=$(docker exec "${MONGO_CONTAINER}" mongosh "${MONGO_LOCAL_URI}" --quiet --eval "var doc = db.getSiblingDB('local').oplog.rs.find().sort({\$natural:-1}).limit(1).next(); if(doc) print(doc.ts.t + ',' + doc.ts.i);" || echo "")
    
    if [[ -z "${oplog_ts}" ]]; then
        warn "Could not get MongoDB oplog timestamp."
    else
        info "MongoDB FULL Backup complete. TS: ${oplog_ts}"
        echo "${oplog_ts}" > "${dest_dir}/ts.txt"
    fi
    return $mongo_err
}

backup_mongo_inc() {
    local dest_dir="${BACKUP_ROOT}/incremental/mongodb/${DATE_INC}"
    local last_ts="${LAST_MONGO_TS:-}"
    info "Starting MongoDB INCREMENTAL Backup to ${dest_dir} (Since TS: ${last_ts})"
    mkdir -p "${dest_dir}"
    local mongo_err=0
    
    if [[ -z "${last_ts}" ]]; then
        warn "No LAST_MONGO_TS found. Falling back to full logical dump for incremental."
        for db in "${MONGO_DBS[@]}"; do
            docker exec "${MONGO_CONTAINER}" mongodump --uri="${MONGO_LOCAL_URI}" --db="${db}" --archive --gzip > "${dest_dir}/${db}.archive.gz" || mongo_err=1
        done
    else
        local ts_t=$(echo "${last_ts}" | cut -d',' -f1)
        local ts_i=$(echo "${last_ts}" | cut -d',' -f2)
        info "Dumping oplog since ${ts_t},${ts_i}..."
        docker exec "${MONGO_CONTAINER}" mongodump --uri="${MONGO_LOCAL_URI}" --db=local --collection=oplog.rs --query="{\"ts\": {\"\$gt\": {\"\$timestamp\": {\"t\": ${ts_t}, \"i\": ${ts_i}}}}}" --archive --gzip > "${dest_dir}/oplog.archive.gz" || {
            warn "mongodump oplog failed. Falling back."
            mongo_err=1
        }
    fi
    
    local new_oplog_ts=""
    new_oplog_ts=$(docker exec "${MONGO_CONTAINER}" mongosh "${MONGO_LOCAL_URI}" --quiet --eval "var doc = db.getSiblingDB('local').oplog.rs.find().sort({\$natural:-1}).limit(1).next(); if(doc) print(doc.ts.t + ',' + doc.ts.i);" || echo "")
    echo "${new_oplog_ts}" > "${dest_dir}/ts.txt"
    return $mongo_err
}

# ==============================================================================
# MAIN LOGIC
# ==============================================================================
main() {
    acquire_lock
    setup_dirs
    load_state
    
    info "=== Starting HR Microservices Backup ==="
    
    local day_of_week
    day_of_week=$(date +%u)
    
    if [[ ! -f "${STATE_FILE}" ]] || [[ "${day_of_week}" -eq 7 ]]; then
        backup_mode="FULL"
    else
        backup_mode="INCREMENTAL"
    fi
    
    local pg_lsn=""
    local mongo_ts=""
    
    if [[ "${backup_mode}" == "FULL" ]]; then
        info "Mode: FULL BACKUP"
        
        backup_pg_full || ((errors++))
        [[ -f "${BACKUP_ROOT}/full/postgres/${DATE_FULL}/lsn.txt" ]] && pg_lsn=$(cat "${BACKUP_ROOT}/full/postgres/${DATE_FULL}/lsn.txt")
        
        backup_mongo_full || ((errors++))
        [[ -f "${BACKUP_ROOT}/full/mongodb/${DATE_FULL}/ts.txt" ]] && mongo_ts=$(cat "${BACKUP_ROOT}/full/mongodb/${DATE_FULL}/ts.txt")
        
        save_state "${DATE_FULL}" "${pg_lsn}" "${mongo_ts}"
    else
        info "Mode: INCREMENTAL BACKUP"
        
        backup_pg_inc || ((errors++))
        [[ -f "${BACKUP_ROOT}/incremental/postgres/${DATE_INC}/lsn.txt" ]] && pg_lsn=$(cat "${BACKUP_ROOT}/incremental/postgres/${DATE_INC}/lsn.txt")
        
        backup_mongo_inc || ((errors++))
        [[ -f "${BACKUP_ROOT}/incremental/mongodb/${DATE_INC}/ts.txt" ]] && mongo_ts=$(cat "${BACKUP_ROOT}/incremental/mongodb/${DATE_INC}/ts.txt")
        
        save_state "${LAST_FULL_DATE:-}" "${pg_lsn}" "${mongo_ts}"
    fi
    
    # Retention cleanup
    info "Cleaning up old backups (FULL: ${FULL_RETENTION_DAYS}d, INC: ${INC_RETENTION_DAYS}d, LOGS: 30d)"
    find "${BACKUP_ROOT}/full/" -mindepth 2 -maxdepth 2 -type d -mtime "+${FULL_RETENTION_DAYS}" -exec rm -rf {} + || true
    find "${BACKUP_ROOT}/incremental/" -mindepth 2 -maxdepth 2 -type d -mtime "+${INC_RETENTION_DAYS}" -exec rm -rf {} + || true
    
    if [[ ${errors} -gt 0 ]]; then
        error "Backup completed with ${errors} errors."
        exit 1
    else
        info "Backup completed successfully."
    fi
}

main
