<script setup lang="ts">
/**
 * Frond · 系统权限面板（P-3.5）
 *
 * 引导页第 2 步与设置页共用这一块——跳过引导的用户之后必须有地方补授权，
 * 否则「没授权 = 按了没反应」这个病灶只修了一半。
 *
 * 读取时机 = 组件挂载时（引导页里它只在第 2 步存在，所以天然懒加载）。
 *
 * 状态与申请能力都来自 permissions:* 三条通道，界面只如实转达：
 * 读不到就是「读不到状态」，不给绿的；屏幕录制没有编程申请口，就不出「申请」按钮。
 */

import { onMounted, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UButton from '@components/ui/UButton.vue'

type PermissionRow = Awaited<ReturnType<typeof window.api.permissions.probe>>[number]

const rows = ref<PermissionRow[]>([])
const loading = ref(false)
const busyId = ref<string | null>(null)
const notice = ref<string | null>(null)

const STATE_TEXT: Record<PermissionRow['state'], string> = {
  granted: '已授权',
  denied: '未授权',
  'not-determined': '还没问过你',
  restricted: '被系统策略限制',
  unknown: '读不到状态',
  unsupported: '本系统不需要'
}

/** 只有 granted 是品牌色、unsupported 是中灰，其它都是「还没好」的暖色——不把「读不到」粉饰成正常 */
const stateTone = (state: PermissionRow['state']): string => {
  if (state === 'granted') return 'text-fg-brand'
  if (state === 'unsupported') return 'text-fg-tertiary'
  return 'text-warning'
}

const probe = async (): Promise<void> => {
  loading.value = true
  try {
    rows.value = await window.api.permissions.probe()
  } catch {
    rows.value = []
    notice.value = '权限状态读取失败（不影响继续）'
  } finally {
    loading.value = false
  }
}

const ask = async (row: PermissionRow): Promise<void> => {
  busyId.value = row.id
  notice.value = null
  try {
    const result = await window.api.permissions.request(row.id)
    notice.value = result.note ?? (result.fired ? '已发起，请在系统弹窗里确认' : '无法就地申请')
    await probe()
  } finally {
    busyId.value = null
  }
}

const openSettings = async (row: PermissionRow): Promise<void> => {
  busyId.value = row.id
  try {
    const result = await window.api.permissions.openSettings(row.id)
    if (!result.ok) notice.value = result.error ?? '打不开系统设置'
  } finally {
    busyId.value = null
  }
}

// 挂上即读：引导页里本组件只在第 2 步渲染，而日历那项要起 osascript 进程，
// 没走到那一步就不该付这个钱
onMounted(() => {
  void probe()
})
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="loading && rows.length === 0"
      class="flex items-center gap-2 rounded-md border border-line-subtle bg-surface-0 p-4 text-sm text-fg-tertiary"
    >
      <AppIcon icon="loader-line" class="animate-spin" />
      <span>正在读取系统权限状态…</span>
    </div>
    <div
      v-for="row in rows"
      :key="row.id"
      class="flex items-start gap-4 rounded-md border border-line-subtle bg-surface-0 p-4"
      :data-perm-row="row.id"
      :data-perm-state="row.state"
    >
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-fg-primary">{{ row.label }}</span>
          <span class="text-xs font-medium" :class="stateTone(row.state)">
            {{ STATE_TEXT[row.state] }}
          </span>
        </div>
        <div class="mt-1 text-xs leading-relaxed text-fg-secondary">用在：{{ row.usedBy }}</div>
        <div v-if="row.note" class="mt-1 text-xs text-fg-tertiary">{{ row.note }}</div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <UButton
          v-if="row.canRequest && row.state !== 'granted'"
          size="sm"
          data-perm-action="request"
          :loading="busyId === row.id"
          @click="ask(row)"
        >
          申请
        </UButton>
        <UButton
          v-if="row.state !== 'granted' && row.state !== 'unsupported'"
          size="sm"
          variant="ghost"
          data-perm-action="settings"
          :loading="busyId === row.id"
          @click="openSettings(row)"
        >
          打开设置
        </UButton>
        <AppIcon
          v-if="row.state === 'granted'"
          icon="checkbox-circle-fill"
          class="text-lg text-fg-brand"
        />
      </div>
    </div>
    <p v-if="notice" class="text-center text-xs text-fg-tertiary">{{ notice }}</p>
    <div class="flex items-center justify-center gap-2">
      <UButton size="sm" variant="ghost" :loading="loading" @click="probe">重新读取</UButton>
    </div>
  </div>
</template>
