import request from '@/utils/request'
import type { ApiResponse, UserProfileResult, UpdateProfileRequest } from '@/types'

export function getProfile(): Promise<ApiResponse<UserProfileResult>> {
  return request.get('/api/user/profile').then(res => res.data)
}

export function updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<UserProfileResult>> {
  return request.put('/api/user/profile', data).then(res => res.data)
}

export function deleteProfile(): Promise<ApiResponse<void>> {
  return request.delete('/api/user/profile').then(res => res.data)
}

/**
 * 获取最近更新时间
 */
export function getLastUpdate(): Promise<ApiResponse<{
  last_updated_at: number
  has_data: boolean
}>> {
  return request.get('/api/user/last-update').then(res => res.data)
}