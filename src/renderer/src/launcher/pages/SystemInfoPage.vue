<template>
  <div class="system-info-page">
    <div class="system-info-scroll">
      <div v-if="loading" class="system-info-loading">
        <AppIcon icon="loader-4" :size="20" class="spin" />
        <span>读取系统信息…</span>
      </div>
      <div v-else-if="info" class="system-info-content">
        <!-- 概览 -->
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">系统</span>
            <span class="info-value">{{ info.osVersion }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">芯片</span>
            <span class="info-value">{{ info.chip }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">核心</span>
            <span class="info-value">{{ info.cpuCores }} 核</span>
          </div>
          <div class="info-row">
            <span class="info-label">运行时间</span>
            <span class="info-value">{{ formatUptime(info.uptimeHours) }}</span>
          </div>
        </div>

        <!-- CPU -->
        <div class="info-section">
          <div class="info-section-title">CPU</div>
          <div class="usage-bar">
            <div class="usage-bar-fill" :style="{ width: info.cpuUsage + '%' }" />
          </div>
          <div class="usage-text">{{ info.cpuUsage }}% 使用率</div>
        </div>

        <!-- 内存 -->
        <div class="info-section">
          <div class="info-section-title">内存</div>
          <div class="usage-bar">
            <div class="usage-bar-fill memory" :style="{ width: info.memoryUsage + '%' }" />
          </div>
          <div class="usage-text">
            {{ info.memoryUsed }} GB / {{ info.memoryTotal }} GB · {{ info.memoryUsage }}%
          </div>
        </div>

        <!-- 磁盘 -->
        <div class="info-section">
          <div class="info-section-title">磁盘</div>
          <div class="usage-bar">
            <div class="usage-bar-fill disk" :style="{ width: info.diskUsage + '%' }" />
          </div>
          <div class="usage-text">
            {{ info.diskUsed }} GB / {{ info.diskTotal }} GB · {{ info.diskUsage }}%
          </div>
        </div>
      </div>
    </div>
    <PageFooterBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PageFooterBar from './PageFooterBar.vue'
import AppIcon from '@components/AppIcon.vue'

interface HardwareInfo {
  osVersion: string
  chip: string
  cpuCores: number
  cpuUsage: number
  memoryTotal: number
  memoryUsed: number
  memoryUsage: number
  diskTotal: number
  diskUsed: number
  diskUsage: number
  uptimeHours: number
  hostname: string
}

const loading = ref(true)
const info = ref<HardwareInfo | null>(null)

function formatUptime(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} 分钟`
  if (hours < 24) return `${Math.round(hours)} 小时`
  const days = Math.floor(hours / 24)
  const hrs = Math.round(hours % 24)
  return `${days} 天 ${hrs} 小时`
}

onMounted(async () => {
  try {
    info.value = (await window.api.system.hardware()) as HardwareInfo
  } catch (err) {
    console.warn('SystemInfoPage: failed to load', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.system-info-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.system-info-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.system-info-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--launcher-text-muted);
  font-size: 13px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.info-section {
  margin-bottom: 20px;
}

.info-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--launcher-text-faint);
  margin-bottom: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--launcher-hairline);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 13px;
  color: var(--launcher-text-muted);
}

.info-value {
  font-size: 13px;
  color: var(--launcher-text);
  font-weight: 500;
}

.usage-bar {
  height: 6px;
  background: var(--launcher-bg-elevated);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.usage-bar-fill {
  height: 100%;
  background: var(--launcher-accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.usage-bar-fill.memory {
  background: #30d158;
}

.usage-bar-fill.disk {
  background: #ff9f0a;
}

.usage-text {
  font-size: 12px;
  color: var(--launcher-text-muted);
}
</style>
