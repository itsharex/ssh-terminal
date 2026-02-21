<template>
  <n-layout class="main-layout">
    <n-layout-header bordered class="header">
      <div class="header-content">
        <div class="logo">
          <n-icon size="24" color="#18a058">
            <Icon icon="mdi:console" />
          </n-icon>
          <span class="logo-text">SSH Terminal</span>
        </div>
        
        <!-- 桌面端菜单 -->
        <n-menu
          class="desktop-menu"
          mode="horizontal"
          :value="activeKey"
          :options="menuOptions"
          responsive
          @update:value="handleMenuSelect"
        />
        
        <!-- 移动端菜单按钮 -->
        <n-button class="mobile-menu-btn" text @click="showMobileMenu = true">
          <n-icon size="24">
            <Icon icon="mdi:menu" />
          </n-icon>
        </n-button>
        
        <div class="header-actions">
          <n-dropdown :options="userMenuOptions" @select="handleUserMenuSelect" class="user-dropdown">
            <n-button text>
              <template #icon>
                <n-icon><Icon icon="mdi:account" /></n-icon>
              </template>
              <span class="user-email">{{ authStore.user?.email || '用户' }}</span>
            </n-button>
          </n-dropdown>
        </div>
      </div>
    </n-layout-header>
    <n-layout-content class="content">
      <router-view />
    </n-layout-content>
    
    <!-- 移动端抽屉菜单 -->
    <n-drawer v-model:show="showMobileMenu" :width="280" placement="right">
      <n-drawer-content title="菜单" :native-scrollbar="false">
        <n-menu
          :value="activeKey"
          :options="menuOptions"
          @update:value="handleMobileMenuSelect"
        />
      </n-drawer-content>
    </n-drawer>
  </n-layout>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores'
import { useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const message = useMessage()
const showMobileMenu = ref(false)

const activeKey = computed(() => route.name as string)

const menuOptions = [
  {
    label: '首页',
    key: 'Dashboard',
    icon: () => h(Icon, { icon: 'mdi:home' })
  },
  {
    label: 'SSH 会话',
    key: 'Sessions',
    icon: () => h(Icon, { icon: 'mdi:server' })
  },
  {
    label: '设置',
    key: 'Settings',
    icon: () => h(Icon, { icon: 'mdi:cog' })
  }
]

const userMenuOptions = [
  {
    label: '个人设置',
    key: 'settings',
    icon: () => h(Icon, { icon: 'mdi:cog' })
  },
  {
    type: 'divider'
  },
  {
    label: '退出登录',
    key: 'logout',
    icon: () => h(Icon, { icon: 'mdi:logout' })
  }
]

function handleMenuSelect(key: string) {
  router.push({ name: key })
}

function handleMobileMenuSelect(key: string) {
  handleMenuSelect(key)
  showMobileMenu.value = false
}

async function handleUserMenuSelect(key: string) {
  if (key === 'settings') {
    router.push({ name: 'Settings' })
  } else if (key === 'logout') {
    try {
      await authStore.logout()
      message.success('已退出登录')
      router.push({ name: 'Login' })
    } catch (error: any) {
      console.error('Logout error:', error)
      const errorMsg = error.response?.data?.message || error.message || '登出失败'
      message.error(errorMsg)
      router.push({ name: 'Login' })
    }
  }
}
</script>

<style scoped>
.main-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 0 16px;
  height: 56px;
  display: flex;
  align-items: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.header-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 18px;
  white-space: nowrap;
}

.logo-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.content > * {
  max-width: 1200px;
  margin: 0 auto;
}

.header-actions {
  margin-left: auto;
}

.desktop-menu {
  flex: 1;
  display: flex;
  justify-content: center;
}

.mobile-menu-btn {
  display: none;
}

.user-email {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 平板尺寸 */
@media (max-width: 768px) {
  .header {
    padding: 0 12px;
    height: 52px;
  }

  .logo {
    font-size: 16px;
    gap: 10px;
  }

  .logo .n-icon {
    width: 20px !important;
    height: 20px !important;
  }

  .content {
    padding: 12px;
  }

  .user-email {
    max-width: 80px;
    font-size: 13px;
  }

  .desktop-menu {
    display: none;
  }

  .mobile-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
  }

  .mobile-menu-btn .n-icon {
    width: 28px !important;
    height: 28px !important;
  }

  .user-dropdown {
    display: none;
  }
}

/* 移动端 */
@media (max-width: 480px) {
  .header {
    padding: 0 10px;
    height: 48px;
  }

  .header-content {
    gap: 8px;
  }

  .logo {
    font-size: 14px;
    gap: 8px;
  }

  .logo .n-icon {
    width: 18px !important;
    height: 18px !important;
  }

  .content {
    padding: 10px;
  }

  .header-actions .n-button {
    padding: 0 4px;
    font-size: 13px;
  }

  .user-email {
    max-width: 60px;
    font-size: 12px;
  }

  .mobile-menu-btn {
    display: none;
  }

  .user-dropdown {
    display: none;
  }
}
</style>