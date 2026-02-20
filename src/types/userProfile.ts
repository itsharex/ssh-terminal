// 服务器返回的 UserProfile VO 格式
export interface UserProfileVO {
  id: number;
  userId: string;
  username?: string;
  phone?: string;
  qq?: string;
  wechat?: string;
  bio?: string;
  avatarData?: string;
  avatarMimeType?: string;
  serverVer: number;
  createdAt: number;
  updatedAt: number;
}

// 客户端内部使用的 UserProfile（时间戳是 number）
export interface UserProfile {
  id: number;
  userId: string;
  username?: string;
  phone?: string;
  qq?: string;
  wechat?: string;
  avatarData?: string;  // Base64 编码的图片数据（不含前缀）
  avatarMimeType?: string;  // 图片 MIME 类型
  bio?: string;
  serverVer?: number;
  createdAt: number;
  updatedAt: number;
}

export interface UpdateProfileRequest {
  username?: string;
  phone?: string;
  qq?: string;
  wechat?: string;
  avatarData?: string;  // Base64 编码的图片数据（不含前缀）
  avatarMimeType?: string;  // 图片 MIME 类型
  bio?: string;
}

