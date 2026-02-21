<template>
  <n-space vertical :size="isMobile ? 'medium' : 'large'" class="sessions-container">
    <n-card title="SSH 会话管理">
      <template #header-extra>
        <n-button type="primary" @click="handleCreate" :size="isMobile ? 'small' : 'medium'">
          <template #icon>
            <n-icon><Icon icon="mdi:plus" /></n-icon>
          </template>
          {{ isMobile ? '新建' : '新建会话' }}
        </n-button>
      </template>
      <n-spin :show="sshStore.loading">
        <!-- 移动端使用卡片布局 -->
        <template v-if="isMobile">
          <n-space vertical :size="12">
            <n-card v-for="session in sshStore.sessions" :key="session.id" size="small" :bordered="true">
              <template #header>
                <n-space align="center">
                  <n-icon color="#18a058">
                    <Icon icon="mdi:console" />
                  </n-icon>
                  <n-text strong>{{ session.name }}</n-text>
                </n-space>
              </template>
              <n-space vertical :size="8">
                <n-text depth="3" size="12">
                  {{ session.username }}@{{ session.host }}:{{ session.port }}
                </n-text>
                <n-space>
                  <n-tag v-if="session.group_name" type="info" size="small">
                    {{ session.group_name }}
                  </n-tag>
                  <n-tag v-else size="small" type="default">
                    未分组
                  </n-tag>
                </n-space>
                <n-space justify="end">
                  <n-button size="small" @click="handleEdit(session.id)">
                    <template #icon>
                      <n-icon><Icon icon="mdi:pencil" /></n-icon>
                    </template>
                    编辑
                  </n-button>
                  <n-button size="small" type="error" @click="handleDelete(session.id)">
                    <template #icon>
                      <n-icon><Icon icon="mdi:delete" /></n-icon>
                    </template>
                    删除
                  </n-button>
                </n-space>
              </n-space>
            </n-card>
          </n-space>
          <n-empty v-if="sshStore.sessions.length === 0" description="暂无会话" />
        </template>
        <!-- 桌面端使用表格布局 -->
        <n-data-table
          v-else
          :columns="columns"
          :data="sshStore.sessions"
          :pagination="pagination"
          :bordered="false"
        />
      </n-spin>
    </n-card>

    <n-modal v-model:show="showDeleteModal" preset="dialog" title="确认删除" content="确定要删除这个 SSH 会话吗？" positive-text="删除" negative-text="取消" @positive-click="handleConfirmDelete" />
  </n-space>
</template>

<script setup lang="ts">
import { ref, h, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSshStore } from '@/stores'
import { useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { NButton, NSpace, NTag, NIcon } from 'naive-ui'
import { Icon } from '@iconify/vue'

const router = useRouter()
const sshStore = useSshStore()
const message = useMessage()

const showDeleteModal = ref(false)
const deletingId = ref<string | null>(null)

const isMobile = computed(() => window.innerWidth < 768)

const pagination = {
  pageSize: 10
}

const columns: DataTableColumns<any> = [
  {
    title: '名称',
    key: 'name',
    render(row) {
      return h(NSpace, { align: 'center' }, {
        default: () => [
          h(NIcon, { color: '#18a058' }, { default: () => h(Icon, { icon: 'mdi:console' }) }),
          h('span', {}, { default: () => row.name })
        ]
      })
    }
  },
  {
    title: '主机',
    key: 'host'
  },
  {
    title: '端口',
    key: 'port',
    width: 80
  },
  {
    title: '用户名',
    key: 'username'
  },
  {
    title: '分组',
    key: 'group_name',
    render(row) {
      return row.group_name
        ? h(NTag, { type: 'info' }, { default: () => row.group_name })
        : h('span', { style: { color: '#999' } }, { default: () => '未分组' })
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render(row) {
      return h(NSpace, {}, {
        default: () => [
          h(
            NButton,
            {
              size: 'small',
              onClick: () => handleEdit(row.id)
            },
            {
              default: () => '编辑',
              icon: () => h(NIcon, null, { default: () => h(Icon, { icon: 'mdi:pencil' }) })
            }
          ),
          h(
            NButton,
            {
              size: 'small',
              type: 'error',
              onClick: () => handleDelete(row.id)
            },
            {
              default: () => '删除',
              icon: () => h(NIcon, null, { default: () => h(Icon, { icon: 'mdi:delete' }) })
            }
          )
        ]
      })
    }
  }
]

onMounted(() => {
  sshStore.fetchSessions().catch((error: any) => {
    console.error('Fetch sessions error:', error)
    const errorMsg = error.response?.data?.message || error.message || '获取会话列表失败'
    message.error(errorMsg)
  })
})

function handleCreate() {
  router.push({ name: 'NewSession' })
}

function handleEdit(id: string) {
  router.push({ name: 'EditSession', params: { id } })
}

function handleDelete(id: string) {
  deletingId.value = id
  showDeleteModal.value = true
}

async function handleConfirmDelete() {
  if (deletingId.value) {
    try {
      await sshStore.deleteSession(deletingId.value)
      message.success('会话已删除')
      showDeleteModal.value = false
      deletingId.value = null
    } catch (error: any) {
      console.error('Delete error:', error)
      const errorMsg = error.response?.data?.message || error.message || '删除失败'
      message.error(errorMsg)
    }
  }
}
</script>

<style scoped>
.sessions-container {
  padding: 0;
}

/* 平板尺寸 */
@media (max-width: 768px) {
  .sessions-container :deep(.n-card) {
    font-size: 14px;
  }

  .sessions-container :deep(.n-card .n-card-header) {
    font-size: 15px;
    padding: 16px;
  }

  .sessions-container :deep(.n-card .n-card__content) {
    padding: 16px;
  }

  .sessions-container :deep(.n-button) {
    font-size: 14px;
    padding: 0 16px;
    height: 36px;
  }

  .sessions-container :deep(.n-data-table) {
    font-size: 13px;
  }
}

/* 移动端 */
@media (max-width: 480px) {
  .sessions-container :deep(.n-card) {
    font-size: 13px;
    margin-bottom: 8px;
  }

  .sessions-container :deep(.n-card .n-card-header) {
    font-size: 14px;
    padding: 12px;
  }

  .sessions-container :deep(.n-card .n-card__content) {
    padding: 12px;
  }

  .sessions-container :deep(.n-card[size="small"]) {
    padding: 0;
  }

  .sessions-container :deep(.n-card[size="small"] .n-card__content) {
    padding: 8px;
  }

  .sessions-container :deep(.n-button) {
    font-size: 13px;
    padding: 0 12px;
    height: 34px;
  }

  .sessions-container :deep(.n-button .n-button__content) {
    gap: 4px;
  }

  .sessions-container :deep(.n-tag) {
    font-size: 11px;
    padding: 0 6px;
    height: 20px;
  }

  .sessions-container :deep(.n-text) {
    font-size: 12px;
  }
}
</style>