use crate::error::Result;
use tauri::State;

use super::session::SSHManagerState;

/// 向会话写入数据
#[tauri::command]
pub async fn terminal_write(
    manager: State<'_, SSHManagerState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<()> {
    manager.write_to_session(&session_id, data).await
}

/// 调整终端大小
#[tauri::command]
pub async fn terminal_resize(
    manager: State<'_, SSHManagerState>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<()> {
    manager.resize_session(&session_id, rows, cols).await
}
