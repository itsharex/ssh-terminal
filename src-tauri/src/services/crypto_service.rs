use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};

use crate::models::ssh_session::AuthMethod;

/// 加密服务
pub struct CryptoService;

impl CryptoService {
    /// 从用户密码派生密钥（用于 SSH 认证信息加密）
    /// 使用 PBKDF2 + SHA256，迭代 100,000 次
    pub fn derive_key_from_password(password: &str, salt: &[u8]) -> Result<[u8; 32]> {
        use pbkdf2::pbkdf2_hmac;
        use sha2::Sha256;

        let mut key = [0u8; 32];
        pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 100_000, &mut key);

        Ok(key)
    }

    /// 生成随机 salt（16 字节）
    pub fn generate_salt() -> Result<[u8; 16]> {
        let mut salt = [0u8; 16];
        use rand::RngCore;
        OsRng.fill_bytes(&mut salt);
        Ok(salt)
    }

    /// 加密 SSH 认证信息（端到端加密）
    /// 返回：, > (加密数据 Base64, nonce Base64, salt Base64)
    pub fn encrypt_auth_method(
        auth_method: &AuthMethod,
        user_password: &str,
    ) -> Result<(String, String, String)> {
        // 1. 生成随机 salt 和 nonce
        let salt = Self::generate_salt()?;
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        // 2. 从用户密码派生密钥
        let key = Self::derive_key_from_password(user_password, &salt)?;
        let cipher = Aes256Gcm::new(&key.into());

        // 3. 序列化认证信息
        let auth_json = serde_json::to_string(auth_method)?;

        // 4. 加密
        let ciphertext = cipher
            .encrypt(&nonce, auth_json.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // 5. Base64 编码
        let encrypted = general_purpose::STANDARD.encode(ciphertext);
        let nonce_b64 = general_purpose::STANDARD.encode(nonce.as_slice());
        let salt_b64 = general_purpose::STANDARD.encode(&salt);

        Ok((encrypted, nonce_b64, salt_b64))
    }

    /// 解密 SSH 认证信息
    pub fn decrypt_auth_method(
        encrypted: &str,
        nonce_b64: &str,
        salt_b64: &str,
        user_password: &str,
    ) -> Result<AuthMethod> {
        // 1. Base64 解码
        let ciphertext = general_purpose::STANDARD.decode(encrypted)?;
        let nonce_bytes = general_purpose::STANDARD.decode(nonce_b64)?;
        let salt = general_purpose::STANDARD.decode(salt_b64)?;

        // 2. 从用户密码派生密钥
        let key = Self::derive_key_from_password(user_password, &salt)?;
        let cipher = Aes256Gcm::new(&key.into());

        // 3. 解密
        let nonce = Nonce::from_slice(&nonce_bytes);
        let plaintext = cipher
            .decrypt(nonce, &*ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        // 4. 反序列化
        let auth_method: AuthMethod = serde_json::from_slice(&plaintext)?;

        Ok(auth_method)
    }

    /// 从 device_id 派生密钥（用于 Token 加密）
    pub fn derive_key_from_device_id(device_id: &str) -> Result<[u8; 32]> {
        // 使用固定的盐值（因为 device_id 已是唯一标识）
        let salt = b"ssh-terminal-device-id-salt-v1";
        Self::derive_key_from_password(device_id, salt)
    }

    /// 加密 Token（使用 device_id 派生的密钥）
    pub fn encrypt_token(token: &str, device_id: &str) -> Result<String> {
        let key = Self::derive_key_from_device_id(device_id)?;
        let cipher = Aes256Gcm::new(&key.into());
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher
            .encrypt(&nonce, token.as_bytes())
            .map_err(|e| anyhow::anyhow!("Token encryption failed: {}", e))?;

        let combined = [nonce.as_slice(), &ciphertext].concat();
        Ok(general_purpose::STANDARD.encode(combined))
    }

    /// 解密 Token
    pub fn decrypt_token(encrypted: &str, device_id: &str) -> Result<String> {
        let key = Self::derive_key_from_device_id(device_id)?;
        let cipher = Aes256Gcm::new(&key.into());

        let combined = general_purpose::STANDARD.decode(encrypted)?;

        if combined.len() < 12 {
            return Err(anyhow::anyhow!("Invalid encrypted token length"));
        }

        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Token decryption failed: {}", e))?;

        String::from_utf8(plaintext).map_err(|e| anyhow::anyhow!("Invalid UTF-8: {}", e))
    }

    /// 加密字符串（通用方法）
    pub fn encrypt_string(data: &str, password: &str) -> Result<String> {
        let salt = Self::generate_salt()?;
        let key = Self::derive_key_from_password(password, &salt)?;
        let cipher = Aes256Gcm::new(&key.into());
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher
            .encrypt(&nonce, data.as_bytes())
            .map_err(|e| anyhow::anyhow!("String encryption failed: {}", e))?;

        let combined = [&salt, nonce.as_slice(), &ciphertext].concat();
        Ok(general_purpose::STANDARD.encode(combined))
    }

    /// 解密字符串（通用方法）
    pub fn decrypt_string(encrypted: &str, password: &str) -> Result<String> {
        let combined = general_purpose::STANDARD.decode(encrypted)?;

        if combined.len() < 28 {
            // 16 bytes salt + 12 bytes nonce minimum
            return Err(anyhow::anyhow!("Invalid encrypted data length"));
        }

        let (salt, rest) = combined.split_at(16);
        let (nonce_bytes, ciphertext) = rest.split_at(12);

        let key = Self::derive_key_from_password(password, salt)?;
        let cipher = Aes256Gcm::new(&key.into());
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("String decryption failed: {}", e))?;

        String::from_utf8(plaintext).map_err(|e| anyhow::anyhow!("Invalid UTF-8: {}", e))
    }

    /// 加密用户密码（用于存储到数据库，使用 device_id 派生密钥）
    /// 返回：, > (加密数据 Base64, nonce Base64)
    pub fn encrypt_password(password: &str, device_id: &str) -> Result<(String, String)> {
        let key = Self::derive_key_from_device_id(device_id)?;
        let cipher = Aes256Gcm::new(&key.into());
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher
            .encrypt(&nonce, password.as_bytes())
            .map_err(|e| anyhow::anyhow!("Password encryption failed: {}", e))?;

        let encrypted = general_purpose::STANDARD.encode(ciphertext);
        let nonce_b64 = general_purpose::STANDARD.encode(nonce.as_slice());

        Ok((encrypted, nonce_b64))
    }

    /// 解密用户密码（从数据库读取）
    pub fn decrypt_password(encrypted: &str, nonce_b64: &str, device_id: &str) -> Result<String> {
        let key = Self::derive_key_from_device_id(device_id)?;
        let cipher = Aes256Gcm::new(&key.into());

        let ciphertext = general_purpose::STANDARD.decode(encrypted)?;
        let nonce_bytes = general_purpose::STANDARD.decode(nonce_b64)?;
        let nonce = Nonce::from_slice(&nonce_bytes);

        let plaintext = cipher
            .decrypt(nonce, &*ciphertext)
            .map_err(|e| anyhow::anyhow!("Password decryption failed: {}", e))?;

        String::from_utf8(plaintext).map_err(|e| anyhow::anyhow!("Invalid UTF-8: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_auth_method() {
        let auth_method = AuthMethod::Password {
            password: "test_password".to_string(),
        };

        let user_password = "my_user_password";

        let (encrypted, nonce, salt) =
            CryptoService::encrypt_auth_method(&auth_method, user_password)
                .expect("Encryption failed");

        let decrypted =
            CryptoService::decrypt_auth_method(&encrypted, &nonce, &salt, user_password)
                .expect("Decryption failed");

        match decrypted {
            AuthMethod::Password { password } => {
                assert_eq!(password, "test_password");
            }
            _ => panic!("Wrong auth method type"),
        }
    }

    #[test]
    fn test_encrypt_decrypt_token() {
        let token = "my_access_token";
        let device_id = "device-123";

        let encrypted =
            CryptoService::encrypt_token(token, device_id).expect("Encryption failed");

        let decrypted =
            CryptoService::decrypt_token(&encrypted, device_id).expect("Decryption failed");

        assert_eq!(decrypted, token);
    }

    #[test]
    fn test_wrong_password_fails() {
        let auth_method = AuthMethod::Password {
            password: "test_password".to_string(),
        };

        let (encrypted, nonce, salt) =
            CryptoService::encrypt_auth_method(&auth_method, "correct_password")
                .expect("Encryption failed");

        let result =
            CryptoService::decrypt_auth_method(&encrypted, &nonce, &salt, "wrong_password");

        assert!(result.is_err());
    }
}
