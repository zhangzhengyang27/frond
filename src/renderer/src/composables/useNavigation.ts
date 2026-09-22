/**
 * 导航相关的 composable
 */
import { useRouter } from 'vue-router'

/**
 * 返回上一页
 */
export function useNavigation(): { goBack: () => void } {
  const router = useRouter()

  const goBack = (): void => {
    router.back()
  }

  return {
    goBack
  }
}
