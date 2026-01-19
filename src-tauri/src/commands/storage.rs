use crate::error::Result;
use crate::config::Storage;
use crate::ssh::session::SessionConfig;
use tauri::State;

use super::session::SSHManagerState;

/// 保存所有标记为持久化的会话到存储
#[tauri::command]
pub async fn storage_save_sessions(
    manager: State<'_, SSHManagerState>,
) -> Result<()> {
    let manager = manager.as_ref();

    // 获取所有会话的完整配置
    let all_session_configs = manager.get_all_session_configs().await;
    let total_count = all_session_configs.len();

    // 只保存标记为 persist 的会话
    let session_configs: Vec<_> = all_session_configs
        .into_iter()
        .filter(|config| config.persist)
        .collect();

    println!("Saving {} persistent sessions out of {} total sessions",
        session_configs.len(),
        total_count);

    let storage = Storage::new()?;
    storage.save_sessions(&session_configs)?;

    Ok(())
}

/// 从存储加载所有保存的会话
#[tauri::command]
pub async fn storage_load_sessions() -> std::result::Result<Vec<SessionConfig>, String> {
    let storage = Storage::new().map_err(|e| e.to_string())?;
    let sessions = storage.load_sessions().map_err(|e| e.to_string())?;
    Ok(sessions)
}

/// 清除所有保存的会话
#[tauri::command]
pub async fn storage_clear() -> std::result::Result<(), String> {
    let storage = Storage::new().map_err(|e| e.to_string())?;
    storage.clear().map_err(|e| e.to_string())?;
    Ok(())
}
