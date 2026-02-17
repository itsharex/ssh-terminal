// 认证类型定义
export interface User {
  id: string;
  email: string;
  serverUrl: string;
  deviceId: string;
  lastSyncAt?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

// 服务器返回类型（用于 Tauri 后端与服务器通信）
export interface ServerLoginResult {
  accessToken: string;
  refreshToken: string;
}

export interface ServerRegisterResult {
  userId: string;
  email: string;
  createdAt: string;
  accessToken: string;
  refreshToken: string;
}

export interface ServerRefreshResult {
  accessToken: string;
  refreshToken: string;
}

// 客户端期望的 AuthResponse（包含 serverUrl）
export interface AuthResponse {
  token: string;
  refreshToken: string;
  userId: string;
  email: string;
  serverUrl: string;
  deviceId: string;
  expiresAt: number;
}

export interface AccountWithProfile {
  userId: string;
  email: string;
  serverUrl: string;
  isCurrent: boolean;
  lastSyncAt?: number;
  username?: string;
  avatarData?: string;
}
