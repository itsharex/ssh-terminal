<template>
  <n-space vertical size="large">
    <n-card>
      <template #header>
        <n-space align="center">
          <n-icon size="20">
            <Icon icon="mdi:account" />
          </n-icon>
          <span>个人资料</span>
        </n-space>
      </template>

      <n-spin :show="userStore.loading">
        <!-- 头像和个人信息区域 -->
        <div class="profile-header">
          <div class="avatar-container">
            <div class="avatar-wrapper">
              <img
                v-if="formData.avatar_data && formData.avatar_mime_type"
                :src="getAvatarSrc()"
                alt="头像"
                class="avatar-image"
              />
              <div v-else class="avatar-initials" :style="{ backgroundColor: avatarColor }">
                {{ getInitials() }}
              </div>
            </div>
          </div>
          <div class="profile-info">
            <h2 class="profile-name">{{ displayName }}</h2>
            <n-text depth="3" class="profile-email">
              <n-icon size="14">
                <Icon icon="mdi:email" />
              </n-icon>
              {{ userStore.profile?.email || '未登录' }}
            </n-text>
          </div>
          <n-button secondary @click="handleAvatarClick">
            <template #icon>
              <n-icon><Icon icon="mdi:upload" /></n-icon>
            </template>
            更换头像
          </n-button>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml"
            @change="handleFileChange"
            class="hidden-input"
          />
        </div>

        <n-divider />

        <!-- 表单部分 -->
        <n-form
          ref="formRef"
          :model="formData"
          label-placement="left"
          label-width="100px"
          require-mark-placement="right-hanging"
        >
          <n-form-item label="用户名">
            <n-input v-model:value="formData.username" placeholder="请输入用户名" />
          </n-form-item>
          <n-form-item label="邮箱">
            <n-input :value="userStore.profile?.email" disabled />
          </n-form-item>
          <n-form-item label="个人简介">
            <n-input
              v-model:value="formData.bio"
              type="textarea"
              placeholder="请输入个人简介"
              :rows="4"
            />
          </n-form-item>
          <n-form-item label="手机">
            <n-input v-model:value="formData.phone" placeholder="请输入手机号" />
          </n-form-item>
          <n-form-item label="QQ">
            <n-input v-model:value="formData.qq" placeholder="请输入 QQ 号" />
          </n-form-item>
          <n-form-item label="微信">
            <n-input v-model:value="formData.wechat" placeholder="请输入微信号" />
          </n-form-item>
        </n-form>
      </n-spin>
      <template #footer>
        <n-space justify="end">
          <n-button type="primary" :loading="userStore.loading" @click="handleSave">
            保存
          </n-button>
        </n-space>
      </template>
    </n-card>

    <n-card title="账号管理">
      <n-space vertical>
        <n-text>删除账号将永久删除您的所有数据，此操作不可恢复。</n-text>
        <n-button type="error" @click="showDeleteModal = true">
          删除账号
        </n-button>
      </n-space>
    </n-card>

    <n-modal
      v-model:show="showDeleteModal"
      preset="dialog"
      title="确认删除账号"
      type="error"
    >
      <n-space vertical>
        <n-text>删除账号将永久删除您的所有数据，此操作不可恢复。</n-text>
        <n-input
          v-model:value="deletePassword"
          type="password"
          placeholder="请输入密码确认删除"
          show-password-on="click"
        />
      </n-space>
      <template #action>
        <n-button @click="showDeleteModal = false">取消</n-button>
        <n-button type="error" :loading="deleting" @click="handleDeleteAccount">
          确认删除
        </n-button>
      </template>
    </n-modal>
  </n-space>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore, useAuthStore } from '@/stores'
import { useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'

const router = useRouter()
const userStore = useUserStore()
const authStore = useAuthStore()
const message = useMessage()

const showDeleteModal = ref(false)
const deletePassword = ref('')
const deleting = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const formData = reactive({
  username: '',
  phone: '',
  qq: '',
  wechat: '',
  bio: '',
  avatar_data: '',
  avatar_mime_type: ''
})

// 计算属性
const displayName = computed(() => {
  return formData.username || userStore.profile?.email?.split('@')[0] || '用户'
})

const avatarColor = computed(() => {
  const colors = ['#18a058', '#2080f0', '#f0a020', '#d03050', '#722ed1']
  const index = (formData.username || userStore.profile?.email || 'u').charCodeAt(0) % colors.length
  return colors[index]
})

// 获取头像源
const getAvatarSrc = () => {
  if (formData.avatar_data && formData.avatar_mime_type) {
    return `data:${formData.avatar_mime_type};base64,${formData.avatar_data}`
  }
  return undefined
}

// 获取首字母
const getInitials = () => {
  const name = formData.username || userStore.profile?.email || 'u'
  return name.slice(0, 2).toUpperCase()
}

// 最大头像大小：5MB
const MAX_AVATAR_SIZE = 5 * 1024 * 1024
// 支持的图片格式
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml']

/**
 * 将文件转换为 Base64 并裁剪为正方形
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // 创建 canvas 进行裁剪
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法创建 canvas 上下文'))
          return
        }

        // 计算正方形裁剪区域
        const size = Math.min(img.width, img.height)
        const offsetX = (img.width - size) / 2
        const offsetY = (img.height - size) / 2

        // 设置 canvas 大小
        canvas.width = 200
        canvas.height = 200

        // 裁剪并绘制图片
        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 200, 200)

        // 转换为 Base64
        const result = canvas.toDataURL('image/jpeg', 0.85)
        // 移除 data:image/jpeg;base64, 前缀
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 验证图片文件
 */
function validateImageFile(file: File): { valid: boolean; errorKey?: string } {
  // 检查文件类型
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      errorKey: '不支持的图片格式',
    }
  }

  // 检查文件大小
  if (file.size > MAX_AVATAR_SIZE) {
    return {
      valid: false,
      errorKey: `图片大小超过限制 (${(file.size / 1024 / 1024).toFixed(2)}MB > 5MB)`,
    }
  }

  return { valid: true }
}

// 点击更换头像按钮
const handleAvatarClick = () => {
  fileInputRef.value?.click()
}

// 处理文件选择
const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // 验证文件
  const validation = validateImageFile(file)
  if (!validation.valid) {
    message.error(validation.errorKey || '图片验证失败')
    return
  }

  try {
    // 转换为 Base64
    const base64 = await fileToBase64(file)

    formData.avatar_data = base64
    formData.avatar_mime_type = file.type

    message.success('图片已选择，请点击保存按钮保存更改')
  } catch (error) {
    console.error('[Profile.vue] 图片处理失败:', error)
    message.error('图片处理失败，请重试')
  }

  // 清空 input，允许重复选择同一文件
  target.value = ''
}

onMounted(async () => {
  await userStore.fetchProfile()
  if (userStore.profile) {
    formData.username = userStore.profile.username || ''
    formData.phone = userStore.profile.phone || ''
    formData.qq = userStore.profile.qq || ''
    formData.wechat = userStore.profile.wechat || ''
    formData.bio = userStore.profile.bio || ''
    formData.avatar_data = userStore.profile.avatar_data || ''
    formData.avatar_mime_type = userStore.profile.avatar_mime_type || ''
  }
})

async function handleSave() {
  try {
    await userStore.updateProfile(formData)
    message.success('保存成功')
  } catch (error: any) {
    console.error('Save error:', error)
    const errorMsg = error.response?.data?.message || error.message || '保存失败'
    message.error(errorMsg)
  }
}

async function handleDeleteAccount() {
  if (!deletePassword.value) {
    message.warning('请输入密码')
    return
  }

  // 如果用户信息不存在，先获取用户信息
  if (!authStore.user?.id) {
    try {
      await userStore.fetchProfile()
      // 再次检查
      if (!authStore.user?.id) {
        message.error('用户信息不存在，请重新登录')
        return
      }
    } catch (error: any) {
      console.error('Fetch profile error:', error)
      const errorMsg = error.response?.data?.message || error.message || '获取用户信息失败'
      message.error(errorMsg)
      return
    }
  }

  deleting.value = true
  try {
    await authStore.deleteAccount(authStore.user.id, deletePassword.value)
    message.success('账号已删除')
    router.push({ name: 'Login' })
  } catch (error: any) {
    console.error('Delete error:', error)
    const errorMsg = error.response?.data?.message || error.message || '删除失败，请检查密码是否正确'
    message.error(errorMsg)
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  border-radius: 8px;
  background-color: var(--n-color-modal);
  border: 1px solid var(--n-border-color);
}

.avatar-container {
  position: relative;
  width: 80px;
  height: 80px;
}

.avatar-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-initials {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
  color: white;
  border-radius: 50%;
}

.profile-info {
  flex: 1;
}

.profile-name {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.profile-email {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.avatar-initials {
  font-size: 28px;
  font-weight: 600;
  color: white;
}

.hidden-input {
  display: none !important;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .profile-header {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }

  .profile-name {
    font-size: 18px;
  }

  .avatar-initials {
    font-size: 24px;
  }
}
</style>