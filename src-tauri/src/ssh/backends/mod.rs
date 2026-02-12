// 后端模块声明

// 所有平台都使用 russh（纯 Rust 实现，包括 Android）
pub mod russh;

// SFTP channel 包装器
pub mod sftp_channel;

// 所有平台默认使用 russh（纯 Rust 实现）
pub use russh::RusshBackend as DefaultBackend;
