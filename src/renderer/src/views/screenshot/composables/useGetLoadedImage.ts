import { ref, watch, onUnmounted, type Ref } from 'vue'

export default function useGetLoadedImage(url?: string): Ref<HTMLImageElement | null> {
  const image = ref<HTMLImageElement | null>(null)

  // Bug#6: 保存旧 Image 引用以便清理
  let prevImg: HTMLImageElement | null = null

  watch(
    () => url,
    (newUrl) => {
      // Bug#6: 清理旧 Image 对象，释放内存
      if (prevImg) {
        prevImg.onload = null
        prevImg.onerror = null
        prevImg.src = ''
        prevImg = null
      }

      if (!newUrl) {
        image.value = null
        return
      }

      const img = new Image()
      prevImg = img
      img.onload = () => {
        image.value = img
      }
      img.onerror = () => {
        image.value = null
      }
      img.src = newUrl
    },
    { immediate: true }
  )

  // 组件卸载时清理
  onUnmounted(() => {
    if (prevImg) {
      prevImg.onload = null
      prevImg.onerror = null
      prevImg.src = ''
      prevImg = null
    }
    image.value = null
  })

  return image
}
