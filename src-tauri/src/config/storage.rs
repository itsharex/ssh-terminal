use crate::config::SessionConfig;
use crate::error::{Result, SSHError};
use std::fs;
use std::path::PathBuf;
use dirs::home_dir;
use serde::{Deserialize, Serialize};

/// 会话存储结构
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionStorage {
    pub version: String,
    pub sessions: Vec<SavedSession>,
}

/// 保存的会话（密码已加密）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedSession {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method_encrypted: String, // 加密的认证信息
    pub terminal_type: Option<String>,
    pub columns: Option<u16>,
    pub rows: Option<u16>,
    pub created_at: String,
    pub last_connected: Option<String>,
}

/// 存储管理器
pub struct Storage {
    storage_path: PathBuf,
}

impl Storage {
    /// 创建新的存储实例
    pub fn new() -> Result<Self> {
        let storage_dir = Self::get_storage_dir()?;

        // 确保存储目录存在
        fs::create_dir_all(&storage_dir)
            .map_err(|e| SSHError::Storage(format!("Failed to create storage directory: {}", e)))?;

        let storage_path = storage_dir.join("sessions.json");

        Ok(Self {
            storage_path,
        })
    }

    /// 获取存储目录
    fn get_storage_dir() -> Result<PathBuf> {
        let home = home_dir()
            .ok_or_else(|| SSHError::Storage("Failed to get home directory".to_string()))?;

        let config_dir = if cfg!(target_os = "windows") {
            home.join(".tauri-terminal")
        } else if cfg!(target_os = "macos") {
            home.join("Library/Application Support/tauri-terminal")
        } else {
            // Linux
            home.join(".config/tauri-terminal")
        };

        Ok(config_dir)
    }

    /// 加载所有保存的会话
    pub fn load_sessions(&self) -> Result<Vec<SessionConfig>> {
        if !self.storage_path.exists() {
            // 如果文件不存在，返回空列表
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&self.storage_path)
            .map_err(|e| SSHError::Storage(format!("Failed to read storage file: {}", e)))?;

        let storage: SessionStorage = serde_json::from_str(&content)
            .map_err(|e| SSHError::Storage(format!("Failed to parse storage file: {}", e)))?;

        // 解密并转换为 SessionConfig
        let sessions: Result<Vec<SessionConfig>> = storage.sessions
            .into_iter()
            .map(|s| self.decrypt_session(s))
            .collect();

        sessions
    }

    /// 保存会话列表
    pub fn save_sessions(&self, sessions: &[SessionConfig]) -> Result<()> {
        let saved_sessions: Result<Vec<SavedSession>> = sessions
            .iter()
            .map(|s| self.encrypt_session(s.clone()))
            .collect();

        let saved_sessions = saved_sessions?;

        let storage = SessionStorage {
            version: "1.0".to_string(),
            sessions: saved_sessions,
        };

        let content = serde_json::to_string_pretty(&storage)
            .map_err(|e| SSHError::Storage(format!("Failed to serialize sessions: {}", e)))?;

        fs::write(&self.storage_path, content)
            .map_err(|e| SSHError::Storage(format!("Failed to write storage file: {}", e)))?;

        Ok(())
    }

    /// 加密会话（简化版：使用 base64 编码）
    fn encrypt_session(&self, session: SessionConfig) -> Result<SavedSession> {
        // 将 AuthMethod 序列化为 JSON，然后 base64 编码
        let auth_json = serde_json::to_string(&session.auth_method)
            .map_err(|e| SSHError::Crypto(format!("Failed to serialize auth method: {}", e)))?;

        let auth_method_encrypted = base64::encode(&auth_json);

        Ok(SavedSession {
            name: session.name,
            host: session.host,
            port: session.port,
            username: session.username,
            auth_method_encrypted,
            terminal_type: session.terminal_type,
            columns: session.columns,
            rows: session.rows,
            created_at: chrono::Utc::now().to_rfc3339(),
            last_connected: None,
        })
    }

    /// 解密会话
    fn decrypt_session(&self, saved: SavedSession) -> Result<SessionConfig> {
        // base64 解码
        let auth_json = base64::decode(&saved.auth_method_encrypted)
            .map_err(|e| SSHError::Crypto(format!("Failed to decode auth method: {}", e)))?;

        // 反序列化 AuthMethod
        let auth_method = serde_json::from_slice(&auth_json)
            .map_err(|e| SSHError::Crypto(format!("Failed to deserialize auth method: {}", e)))?;

        Ok(SessionConfig {
            name: saved.name,
            host: saved.host,
            port: saved.port,
            username: saved.username,
            auth_method,
            terminal_type: saved.terminal_type,
            columns: saved.columns,
            rows: saved.rows,
            persist: true, // 从存储加载的会话都是持久化的
        })
    }

    /// 删除存储文件
    pub fn clear(&self) -> Result<()> {
        if self.storage_path.exists() {
            fs::remove_file(&self.storage_path)
                .map_err(|e| SSHError::Storage(format!("Failed to remove storage file: {}", e)))?;
        }
        Ok(())
    }

    /// 删除单个会话配置（根据名称匹配）
    pub fn delete_session(&self, session_name: &str) -> Result<bool> {
        if !self.storage_path.exists() {
            return Ok(false);
        }

        // 加载现有会话
        let sessions = self.load_sessions()?;
        let original_count = sessions.len();

        // 过滤掉要删除的会话
        let updated_sessions: Vec<_> = sessions
            .into_iter()
            .filter(|s| s.name != session_name)
            .collect();

        // 如果会话数量没变，说明没找到
        if updated_sessions.len() == original_count {
            return Ok(false);
        }

        // 保存更新后的列表
        self.save_sessions(&updated_sessions)?;

        Ok(true)
    }
}

impl Default for Storage {
    fn default() -> Self {
        Self::new().expect("Failed to create storage")
    }
}

// 简单的 base64 编解码模块
mod base64 {
    use std::u8;

    pub fn encode(input: &str) -> String {
        let bytes = input.as_bytes();
        let mut result = String::new();

        for chunk in bytes.chunks(3) {
            let b0 = chunk[0];
            let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
            let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

            let combined = (b0 as u32) << 16 | (b1 as u32) << 8 | (b2 as u32);

            result.push(encode_char((combined >> 18) & 0x3F));
            result.push(encode_char((combined >> 12) & 0x3F));
            result.push(if chunk.len() > 1 { encode_char((combined >> 6) & 0x3F) } else { '=' });
            result.push(if chunk.len() > 2 { encode_char(combined & 0x3F) } else { '=' });
        }

        result
    }

    pub fn decode(input: &str) -> Result<Vec<u8>, String> {
        let mut result = Vec::new();
        let chars: Vec<u8> = input.chars()
            .map(|c| decode_char(c).ok_or(format!("Invalid base64 character: {}", c)))
            .collect::<Result<_, _>>()?;

        for chunk in chars.chunks(4) {
            if chunk.len() < 4 {
                return Err("Invalid base64 input length".to_string());
            }

            let c0 = chunk[0] as u32;
            let c1 = chunk[1] as u32;
            let c2 = chunk[2] as u32;
            let c3 = chunk[3] as u32;

            let combined = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;

            result.push((combined >> 16) as u8);
            if chunk[2] != 64 { // '=' is 64 in our decode
                result.push((combined >> 8) as u8);
            }
            if chunk[3] != 64 {
                result.push(combined as u8);
            }
        }

        Ok(result)
    }

    const fn encode_char(value: u32) -> char {
        let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        alphabet[value as usize] as char
    }

    fn decode_char(c: char) -> Option<u8> {
        let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        if c == '=' {
            return Some(64);
        }
        alphabet.iter().position(|&ch| ch == c as u8).map(|p| p as u8)
    }
}
