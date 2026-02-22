-- ============================================
-- SQLite 自动化初始化脚本
-- ============================================
-- 此文件会在服务器启动时自动执行
-- 创建内容：表、索引
-- ============================================
-- 注意：
-- - updated_at 的更新在应用层（Repository）统一处理
-- - server_ver 的递增也在应用层（Repository）统一处理
-- ============================================

-- ============================================
-- 1. 表定义
-- ============================================

-- 邮件日志表
CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    template TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

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

