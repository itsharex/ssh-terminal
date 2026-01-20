mod error;
mod commands;
mod ssh;
mod config;

use commands::session::SSHManagerState;
use ssh::manager::SSHManager;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // 初始化SSH管理器，传入AppHandle
            let ssh_manager = Arc::new(SSHManager::new(app.handle().clone()));
            app.manage(ssh_manager as SSHManagerState);

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // SSH会话管理命令
            commands::ssh_create_session,
            commands::ssh_connect,
            commands::ssh_disconnect,
            commands::ssh_list_sessions,
            commands::ssh_get_session,
            commands::ssh_delete_session,
            commands::ssh_update_session,
            // SSH终端命令
            commands::ssh_write,
            commands::ssh_resize_pty,
            commands::ssh_read_start,
            commands::ssh_read_stop,
            // 存储命令
            commands::storage_save_sessions,
            commands::storage_load_sessions,
            commands::storage_clear,
            commands::storage_delete_session,
            commands::storage_save_app_config,
            commands::storage_load_app_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
