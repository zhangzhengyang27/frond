<template>
  <div class="dict-page">
    <div class="dict-scroll">
      <div v-if="!word" class="dict-prompt">
        <AppIcon icon="book-2" :size="28" />
        <span>输入要查询的英文单词</span>
      </div>
      <div v-else-if="loading" class="dict-loading">
        <AppIcon icon="loader-4" :size="18" class="spin" />
        <span>查询 {{ word }}…</span>
      </div>
      <div v-else-if="definitions.length === 0" class="dict-empty">
        <AppIcon icon="error-warning" :size="24" />
        <span>未找到 "{{ word }}" 的释义</span>
        <button class="dict-open-btn" @click="openInMacDictionary">在 macOS 词典中打开</button>
      </div>
      <div v-else class="dict-content">
        <div class="dict-header">
          <span class="dict-word">{{ word }}</span>
          <span v-if="definitions[0]?.phonetic" class="dict-phonetic">
            {{ definitions[0].phonetic }}
          </span>
          <button class="dict-open-btn" @click="openInMacDictionary">
            <AppIcon icon="external-link" :size="12" />
            <span>词典</span>
          </button>
        </div>
        <div class="dict-meanings">
          <div v-for="(meaning, mi) in definitions[0].meanings" :key="mi" class="dict-meaning">
            <div class="dict-pos">{{ meaning.partOfSpeech }}</div>
            <ol class="dict-defs">
              <li v-for="(def, di) in meaning.definitions.slice(0, 3)" :key="di" class="dict-def">
                <span>{{ def.definition }}</span>
                <span v-if="def.example" class="dict-example">"{{ def.example }}"</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
    <PageFooterBar />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import PageFooterBar from './PageFooterBar.vue'
import AppIcon from '@components/AppIcon.vue'

interface DictionaryDefinition {
  word: string
  phonetic?: string
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{
      definition: string
      example?: string
    }>
  }>
}

const props = defineProps<{ query?: string }>()

const word = ref('')
const loading = ref(false)
const definitions = ref<DictionaryDefinition[]>([])

// props.query 是胶囊传入的搜索词；本页查询动作的函数名避免与 prop 重名（vue/no-dupe-keys）
async function queryWord(w: string): Promise<void> {
  if (!w.trim()) {
    definitions.value = []
    return
  }
  loading.value = true
  try {
    definitions.value = (await window.api.dictionary.query(w.trim())) as DictionaryDefinition[]
  } catch (err) {
    console.warn('DictionaryPage: query failed', err)
    definitions.value = []
  } finally {
    loading.value = false
  }
}

function openInMacDictionary(): void {
  if (word.value) void window.api.dictionary.open(word.value)
}

watch(
  () => props.query,
  (q) => {
    if (q && q.trim()) {
      word.value = q.trim()
      void queryWord(word.value)
    }
  }
)

onMounted(() => {
  if (props.query?.trim()) {
    word.value = props.query.trim()
    void queryWord(word.value)
  }
})
</script>

<style scoped>
.dict-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.dict-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.dict-prompt,
.dict-loading,
.dict-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 10px;
  color: var(--launcher-text-muted);
  font-size: 13px;
}

.dict-empty {
  gap: 14px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.dict-open-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: 1px solid var(--launcher-accent-strong);
  border-radius: 6px;
  background: var(--launcher-accent-soft);
  color: var(--launcher-accent);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.dict-open-btn:hover {
  background: var(--launcher-accent-soft);
}

.dict-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--launcher-border);
}

.dict-word {
  font-size: 22px;
  font-weight: 600;
  color: var(--launcher-text);
}

.dict-phonetic {
  font-size: 14px;
  color: var(--launcher-text-muted);
  font-family: 'SF Mono', Menlo, monospace;
}

.dict-header .dict-open-btn {
  margin-left: auto;
}

.dict-meanings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dict-pos {
  font-size: 12px;
  font-weight: 600;
  color: var(--launcher-accent);
  text-transform: lowercase;
  font-style: italic;
  margin-bottom: 8px;
}

.dict-defs {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dict-def {
  font-size: 13px;
  color: var(--launcher-text);
  line-height: 1.5;
}

.dict-example {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--launcher-text-muted);
  font-style: italic;
}
</style>
