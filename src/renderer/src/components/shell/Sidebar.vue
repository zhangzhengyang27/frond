<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  PENDING_MODULES,
  getModulesByCategory,
  type ModuleMeta
} from '../../constants/modules'
import { SYSTEM_PAGES } from '@shared/commands'
import AppIcon from '@components/AppIcon.vue'
