// 后端模块声明

// 所有平台都使用 russh（纯 Rust 实现，包括 Android）
pub mod russh;

// SFTP channel 包装器
pub mod sftp_channel;

// 桌面平台使用系统 SSH（可选）
#[cfg(not(target_os = "android"))]
pub mod system_ssh;

// 所有平台默认使用 russh（纯 Rust 实现）
pub use russh::RusshBackend as DefaultBackend;
