use crate::error::Result;
use tauri::State;

use super::session::SSHManagerState;

#[tauri::command]
pub async fn ssh_write(
    manager: State<'_, SSHManagerState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<()> {
    manager.write_to_session(&session_id, data).await
}

#[tauri::command]
pub async fn ssh_resize_pty(
    manager: State<'_, SSHManagerState>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<()> {
    manager.resize_session(&session_id, rows, cols).await
}

#[tauri::command]
pub async fn ssh_read_start(
    manager: State<'_, SSHManagerState>,
    session_id: String,
) -> Result<String> {
    // TODO: 实现开始读取SSH输出
    // 这应该返回一个事件通道ID
    // 需要使用Tauri的Event系统来推送输出
    let _ = (manager, session_id);
    Ok("event_channel_id".to_string())
}

#[tauri::command]
pub async fn ssh_read_stop(
    manager: State<'_, SSHManagerState>,
    session_id: String,
) -> Result<()> {
    // TODO: 实现停止读取SSH输出
    let _ = (manager, session_id);
    Ok(())
}
