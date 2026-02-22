-- ============================================
-- MySQL 自动化初始化脚本
-- ============================================
-- 此文件会在服务器启动时自动执行
-- 创建内容：表、索引
-- ============================================

-- ============================================
-- 1. 表定义
-- ============================================

-- 邮件日志表
CREATE TABLE IF NOT EXISTS email_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    template VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    retry_count TINYINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. 索引定义
-- ============================================

-- 用户资料表索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_deleted ON user_profiles(deleted_at);

-- SSH 会话表索引
CREATE INDEX IF NOT EXISTS idx_ssh_sessions_user_id ON ssh_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ssh_sessions_group ON ssh_sessions(group_name);
CREATE INDEX IF NOT EXISTS idx_ssh_sessions_deleted ON ssh_sessions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_ssh_sessions_server_ver ON ssh_sessions(server_ver);

-- 邮件日志表索引
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email ON email_logs(email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);

-- ============================================
-- 注意事项
-- ============================================
-- 1. MySQL 使用 ON UPDATE CURRENT_TIMESTAMP 自动更新时间戳，已在表定义中
-- 2. server_ver 字段在应用层（Repository）中自动递增
-- 3. 无需创建触发器
