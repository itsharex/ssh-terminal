<template>
  <n-space vertical :size="isMobile ? 'medium' : 'large'" class="dashboard-container">
    <n-card title="欢迎回来">
      <n-space vertical>
        <n-text depth="3">欢迎使用 SSH Terminal Web 版！</n-text>
        <n-text>{{ authStore.user?.email || '用户' }}</n-text>
      </n-space>
    </n-card>

    <div class="stats-grid-container">
    <n-grid :cols="gridCols" :x-gap="isMobile ? 12 : 20" :y-gap="isMobile ? 12 : 20" responsive="screen">
      <n-gi :span="gridItemSpan('ssh')">
        <n-statistic label="SSH 会话数" :value="sshStore.total" :value-style="{ fontSize: valueFontSize + 'px', lineHeight: 1.3, wordBreak: 'break-all' }">
          <template #prefix>
            <n-icon color="#18a058">
              <Icon icon="mdi:console" />
            </n-icon>
          </template>
        </n-statistic>
      </n-gi>
      <n-gi :span="gridItemSpan('update')">
        <n-statistic
          label="最近更新"
          :value="lastUpdateStore.lastUpdatedTime"
          :loading="lastUpdateStore.loading"
          :value-style="{ fontSize: valueFontSize + 'px', lineHeight: 1.3, wordBreak: 'break-all' }"
        >
          <template #prefix>
            <n-icon color="#2080f0">
              <Icon icon="mdi:clock" />
            </n-icon>
          </template>
          <template #suffix>
            <n-button
              text
              size="tiny"
              @click="lastUpdateStore.fetchLastUpdate()"
              :loading="lastUpdateStore.loading"
            >
              <n-icon>
                <Icon icon="mdi:refresh" />
              </n-icon>
            </n-button>
          </template>
        </n-statistic>
      </n-gi>
      <n-gi :span="gridItemSpan('status')">
        <n-statistic label="账户状态" value="正常" :value-style="{ fontSize: valueFontSize + 'px', lineHeight: 1.3, wordBreak: 'break-all' }">
          <template #prefix>
            <n-icon color="#f0a020">
              <Icon icon="mdi:account" />
            </n-icon>
          </template>
        </n-statistic>
      </n-gi>
    </n-grid>
  </div>

    <n-card title="快捷操作">
      <n-space :vertical="isMobile" :size="isMobile ? 12 : undefined">
        <n-button type="primary" @click="router.push({ name: 'NewSession' })" :block="isMobile">
          <template #icon>
            <n-icon><Icon icon="mdi:plus" /></n-icon>
          </template>
          新建 SSH 会话
        </n-button>
        <n-button @click="router.push({ name: 'Sessions' })" :block="isMobile">
          <template #icon>
            <n-icon><Icon icon="mdi:server" /></n-icon>
          </template>
          管理会话
        </n-button>
        <n-button @click="router.push({ name: 'Settings' })" :block="isMobile">
          <template #icon>
            <n-icon><Icon icon="mdi:cog" /></n-icon>
          </template>
          个人设置
        </n-button>
      </n-space>
    </n-card>

    <n-card title="最近会话">
      <n-spin :show="sshStore.loading">
        <n-list v-if="recentSessions.length > 0" bordered>
          <n-list-item v-for="session in recentSessions" :key="session.id">
            <template #prefix>
              <n-icon color="#18a058">
                <Icon icon="mdi:console" />
              </n-icon>
            </template>
            <n-thing :title="session.name" :description="`${session.username}@${session.host}:${session.port}`" />
            <template #suffix>
              <n-button text type="primary" @click="router.push({ name: 'EditSession', params: { id: session.id } })">
                编辑
              </n-button>
            </template>
          </n-list-item>
        </n-list>
        <n-empty v-else description="暂无会话" />
      </n-spin>
    </n-card>
  </n-space>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, useSshStore, useLastUpdateStore } from '@/stores'
import { useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'

const router = useRouter()
const authStore = useAuthStore()
const sshStore = useSshStore()
const lastUpdateStore = useLastUpdateStore()
const message = useMessage()

const isMobile = computed(() => window.innerWidth < 768)

const valueFontSize = computed(() => {
  if (window.innerWidth <= 380) return 10
  if (window.innerWidth <= 480) return 11
  if (window.innerWidth <= 768) return 12
  if (window.innerWidth <= 1024) return 13
  return 14
})

const gridCols = computed(() => {
  if (window.innerWidth < 480) return 1
  if (window.innerWidth < 768) return 3
  // 桌面端使用4列，SSH会话数和最近更新各占1列，账户状态占2列
  return 4
})

const gridItemSpan = (type: 'ssh' | 'update' | 'status') => {
  if (window.innerWidth < 480) return 1
  if (window.innerWidth < 768) {
    // 平板端（480-768px）：使用3列，SSH会话数占1列，最近更新占2列，账户状态占1列
    if (type === 'update') return 2
    return 1
  }
  // 桌面端：SSH会话数和最近更新各占1列（各1/4），账户状态占2列（1/2）
  if (type === 'status') return 2
  return 1
}

const recentSessions = computed(() => {
  return sshStore.sessions.slice(0, 5)
})

onMounted(async () => {
  try {
    await sshStore.fetchSessions()
  } catch (error: any) {
    console.error('Fetch sessions error:', error)
    const errorMsg = error.response?.data?.message || error.message || '获取会话列表失败'
    message.error(errorMsg)
  }

  // 获取最近更新时间
  lastUpdateStore.fetchLastUpdate()
})
</script>

<style scoped>
.dashboard-container {
  padding: 0;
}

/* 统计卡片容器 */
.stats-grid-container {
  max-width: 1200px;
  margin: 0 auto;
  padding-left: 20px;
  padding-right: 20px;
}

/* 平板尺寸 480-768px */
@media (max-width: 768px) {
  .stats-grid-container {
    padding-left: 16px;
    padding-right: 16px;
  }

  .dashboard-container :deep(.n-card) {
    font-size: 13px;
  }

  .dashboard-container :deep(.n-card .n-card-header) {
    font-size: 14px;
    padding: 14px;
  }

  .dashboard-container :deep(.n-card .n-card__content) {
    padding: 14px;
  }

  .dashboard-container :deep(.n-button) {
    font-size: 13px;
    padding: 0 14px;
    height: 34px;
  }

  .dashboard-container :deep(.n-list-item) {
    padding: 10px;
  }

  .dashboard-container :deep(.n-thing .n-thing__title) {
    font-size: 13px;
  }

  .dashboard-container :deep(.n-thing .n-thing__description) {
    font-size: 11px;
  }
}

/* 小屏移动端 380-480px */
@media (max-width: 480px) and (min-width: 381px) {
  .stats-grid-container {
    padding-left: 12px;
    padding-right: 12px;
  }

  .dashboard-container :deep(.n-card) {
    font-size: 12px;
    margin-bottom: 6px;
  }

  .dashboard-container :deep(.n-card .n-card-header) {
    font-size: 13px;
    padding: 10px;
  }

  .dashboard-container :deep(.n-card .n-card__content) {
    padding: 10px;
  }

  .dashboard-container :deep(.n-button) {
    font-size: 12px;
    padding: 0 10px;
    height: 32px;
  }

  .dashboard-container :deep(.n-button .n-button__content) {
    gap: 3px;
  }

  .dashboard-container :deep(.n-list-item) {
    padding: 8px;
  }

  .dashboard-container :deep(.n-list-item__prefix) {
    margin-right: 6px;
  }

  .dashboard-container :deep(.n-thing) {
    flex: 1;
    min-width: 0;
  }

  .dashboard-container :deep(.n-thing .n-thing__title) {
    font-size: 12px;
  }

  .dashboard-container :deep(.n-thing .n-thing__description) {
    font-size: 10px;
  }

  .dashboard-container :deep(.n-empty) {
    padding: 16px;
    font-size: 12px;
  }
}

/* 超小屏移动端 ≤380px */
@media (max-width: 380px) {
  .stats-grid-container {
    padding-left: 10px;
    padding-right: 10px;
  }

  .dashboard-container :deep(.n-card) {
    font-size: 11px;
    margin-bottom: 4px;
  }

  .dashboard-container :deep(.n-card .n-card-header) {
    font-size: 12px;
    padding: 8px;
  }

  .dashboard-container :deep(.n-card .n-card__content) {
    padding: 8px;
  }

  .dashboard-container :deep(.n-button) {
    font-size: 11px;
    padding: 0 8px;
    height: 30px;
  }

  .dashboard-container :deep(.n-button .n-button__content) {
    gap: 2px;
  }

  .dashboard-container :deep(.n-list-item) {
    padding: 6px;
  }

  .dashboard-container :deep(.n-list-item__prefix) {
    margin-right: 4px;
  }

  .dashboard-container :deep(.n-thing) {
    flex: 1;
    min-width: 0;
  }

  .dashboard-container :deep(.n-thing .n-thing__title) {
    font-size: 11px;
  }

  .dashboard-container :deep(.n-thing .n-thing__description) {
    font-size: 9px;
  }

  .dashboard-container :deep(.n-empty) {
    padding: 12px;
    font-size: 11px;
  }
}
</style>