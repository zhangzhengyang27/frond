<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { PomodoroRecord } from '../../../stores/pomodoro'

/** 里程碑：累计专注小时数 → 徽章资产 */
const MILESTONES = [
  { hours: 1, label: '初试啼声', icon: '🌱' },
