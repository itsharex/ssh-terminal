export type AuthMethod =
  | { Password: { password: string } }
  | { PublicKey: { private_key_path: string; passphrase?: string } };

export interface SessionConfig {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: AuthMethod;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  terminal_type?: string;
  columns?: number;
  rows?: number;
  /** 是否需要持久化保存到存储 */
  persist?: boolean;
  /** 是否启用严格的主机密钥验证（默认true） */
  strict_host_key_checking?: boolean;
  /** 会话分组（默认为"默认分组"） */
  group?: string;
  /** 心跳间隔（秒），0表示禁用（默认30秒） */
  keepAliveInterval?: number;
}

export type SessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SessionInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  status: SessionStatus;
  connectedAt?: string;
  error?: string;
  group: string;
}
