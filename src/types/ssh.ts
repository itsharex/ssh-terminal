export interface SessionConfig {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: 'password' | 'publicKey';
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  terminal_type?: string;
  columns?: number;
  rows?: number;
  /** 是否需要持久化保存到存储 */
  persist?: boolean;
}

export type SessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SessionInfo extends SessionConfig {
  id: string;
  status: SessionStatus;
  connectedAt?: string;
  error?: string;
}

export interface AuthMethod {
  type: 'password' | 'publicKey';
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

export interface CreateSessionOptions {
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: AuthMethod;
  terminal_type?: string;
  columns?: number;
  rows?: number;
  persist?: boolean;
}
