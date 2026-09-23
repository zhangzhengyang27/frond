<script setup lang="ts">
/**
 * OcrResult · 截图 OCR 结果浮层
 * 2026-09-23 重建：原文件被截断，仅存脚本尾 80 行，脚本头部（imports / Props）与模板为重建
 */
// 待核：浮层结构与样式为重建（原件未留存），字段绑定照存留脚本
import { onMounted, onUnmounted, ref } from 'vue'

interface Props {
  imageSrc: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  result: [text: string]
}>()

const loading = ref(true)
const progress = ref(0)
const recognizedText = ref('')
const confidence = ref(0)
const error = ref('')
let isCanceled = false

onMounted(async () => {
  await performOcr()
})

onUnmounted(() => {
  // 标记取消：在飞的 recognize 会在下一个进度回调中止。
  // 不销毁 ocrService 单例——worker + 语言包（数十 MB）创建/加载耗数秒，
  // 每次关浮层即重建会让每次 OCR 都付出首次级延迟；worker 随应用退出回收
  isCanceled = true
})

const performOcr = async (): Promise<void> => {
  loading.value = true
  progress.value = 0
  error.value = ''
  isCanceled = false

  try {
    const { ocrService } = await import('../../../services/OcrService')

    const result = await ocrService.recognize(props.imageSrc, {
      lang: 'chi_sim+eng',
      onProgress: (p) => {
        if (isCanceled) {
          throw new Error('OCR cancelled')
        }
        progress.value = p
      }
    })

    if (isCanceled) return

    recognizedText.value = result.text
    confidence.value = Math.round(result.confidence)

    if (result.text) {
      emit('result', result.text)
    } else {
      error.value = '未检测到文字'
    }
  } catch (err) {
    if (isCanceled) {
      emit('close')
      return
    }
    console.error('[OcrResult] OCR failed:', err)
    error.value = '识别失败: ' + (err as Error).message
  } finally {
    loading.value = false
  }
}

const handleCancel = (): void => {
  isCanceled = true
  emit('close')
}

const handleCopy = async (): Promise<void> => {
  if (!recognizedText.value) return

  try {
    await navigator.clipboard.writeText(recognizedText.value)
    // 可以添加一个 toast 提示
  } catch (err) {
    console.error('[OcrResult] Copy failed:', err)
  }
}
</script>
<template>
  <div class="ocr-result">
    <header class="ocr-header">
      <span class="ocr-title">文字识别</span>
      <span v-if="!loading && confidence" class="ocr-confidence">置信度 {{ confidence }}%</span>
      <button class="ocr-icon-btn" type="button" title="关闭" @click="handleCancel">✕</button>
    </header>

    <div v-if="loading" class="ocr-progress">
      <div class="ocr-progress-track">
        <div class="ocr-progress-fill" :style="{ width: `${Math.round(progress * 100)}%` }" />
      </div>
      <span>识别中… {{ Math.round(progress * 100) }}%</span>
    </div>

    <p v-else-if="error" class="ocr-error">{{ error }}</p>

    <textarea
      v-else
      v-model="recognizedText"
      class="ocr-text"
      rows="10"
      spellcheck="false"
      placeholder="未检测到文字"
    />

    <footer class="ocr-actions">
      <button class="ocr-btn" type="button" :disabled="loading" @click="handleCopy">复制</button>
      <button class="ocr-btn primary" type="button" @click="handleCancel">完成</button>
    </footer>
  </div>
</template>

<style scoped>
.ocr-result {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 420px;
  max-width: 90vw;
  padding: 14px 16px;
  border: 1px solid var(--shot-border);
  border-radius: 10px;
  background: var(--shot-panel);
  color: var(--shot-text);
  box-shadow: var(--shot-shadow);
  font-size: 13px;
}

.ocr-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ocr-title {
  flex: 1;
  font-weight: 600;
}

.ocr-confidence {
  color: var(--shot-text-muted);
}

.ocr-icon-btn {
  border: 0;
  background: none;
  color: var(--shot-text-dim);
  cursor: pointer;
}

.ocr-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--shot-text-dim);
}

.ocr-progress-track {
  height: 4px;
  border-radius: 999px;
  background: var(--shot-panel-raised);
  overflow: hidden;
}

.ocr-progress-fill {
  height: 100%;
  background: var(--shot-accent);
  transition: width 0.2s;
}

.ocr-error {
  margin: 0;
  color: var(--shot-text-dim);
}

.ocr-text {
  width: 100%;
  min-height: 180px;
  padding: 8px 10px;
  border: 1px solid var(--shot-border);
  border-radius: 6px;
  background: var(--shot-panel-raised);
  color: var(--shot-text);
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
}

.ocr-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.ocr-btn {
  padding: 5px 14px;
  border: 1px solid var(--shot-border);
  border-radius: 6px;
  background: none;
  color: var(--shot-text);
  cursor: pointer;
}

.ocr-btn.primary {
  border-color: var(--shot-accent);
  background: var(--shot-accent);
  color: #fff;
}
</style>
