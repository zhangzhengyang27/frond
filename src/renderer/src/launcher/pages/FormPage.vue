        <template v-else>
          <label class="form-label" :for="`ff-${index}`">{{ field.label }}</label>
          <input
            :id="`ff-${index}`"
            :ref="(el) => setFieldRef(index, el)"
            v-model="values[field.key]"
            class="form-input"
            :type="fieldType(field) === 'date' ? 'date' : 'text'"
            :placeholder="field.placeholder || ''"
            :data-field-index="index"
            spellcheck="false"
            @keydown="onFieldKeydown($event, index)"
          />
        </template>
      </div>
    </div>
  </CapsulePage>
</template>

<script setup lang="ts">
/**
 * Form 基元（M5.2）：胶囊内的字段式表单（Raycast Form 模式）。
 * 字段类型：text（缺省）/ textarea / select / checkbox / date。
 * Tab/↑↓ 在字段间移动，⌘↵ 提交，ESC 取消（ESC 由外层导航栈先处理）；
 * checkbox 用 ↵/Space 切换，select 聚焦时 ←→ 换选项。
 */
import { computed, onMounted, ref, watch } from 'vue'
import CapsulePage from './CapsulePage.vue'
import type { FormField, FormFieldType } from '@shared/plugin-protocol'

export type { FormField }

/** 字段提交值：checkbox 为 boolean，其余为 string */
type FieldValue = string | boolean

const props = defineProps<{
  fields: FormField[]
  submitLabel?: string
  initial?: Record<string, FieldValue>
}>()
