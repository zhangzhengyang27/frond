      <div class="zf-stats-goal-fill" :style="{ width: `${goalPct}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@components/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    workCount?: number
    workDuration?: number
    streak?: { current: number; longest: number; activeToday: boolean }
  }>(),
  {
    workCount: 0,
    workDuration: 25,
    streak: () => ({ current: 0, longest: 0, activeToday: false })
  }
)

const DAILY_GOAL = 8

const focusMinutes = computed(() => props.workCount * props.workDuration)
const goalPct = computed(() => Math.min(100, (props.workCount / DAILY_GOAL) * 100))
</script>

<style scoped>
/* 单行紧凑数据条：连续专注 + 今日番茄（替代原两张大卡片，高度 44px） */
.zf-stats-bar {
  padding: 10px 12px 8px;
  background: var(--pomo-surface-container-low);
  border: 1px solid var(--pomo-glass-border);
  border-radius: 12px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.zf-stats-bar.active {
  border-color: rgba(245, 158, 11, 0.35);
}

.zf-stats-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zf-stat-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: 12px;
  color: var(--pomo-text-soft);
  white-space: nowrap;
}
