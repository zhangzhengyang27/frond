/**
 * Leaf · 专注护盾遮罩窗入口（轻量独立页，勿引入重组件——
 * 该窗口在命中屏蔽应用时即时创建，加载速度就是护盾生效速度）
 */
import { createApp } from 'vue'
import FocusShield from './components/FocusShield.vue'

createApp(FocusShield).mount('#app')
