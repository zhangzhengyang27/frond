import { createRouter, createWebHashHistory } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue-router.js?v=c8635d8b";
import { ref } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { cancelRouteTiming, finishRouteTiming, startRouteTiming } from "/src/utils/routePerf.ts";
export const onboardingState = ref(null);
export function resetOnboardingState() {
  onboardingState.value = false;
}
export function markOnboardingCompleted() {
  onboardingState.value = true;
}
const router = createRouter({
  history: createWebHashHistory(),
  // 配置滚动行为，处理自定义滚动容器
  // B3 修复：滚动容器有两个 —— 沉浸式分支的 .App-router 与
  // AppShell 分支的 .app-scroll；window 本身不可滚（h-screen + 内部滚动），
  // 声明式 return { top: 0 } / savedPosition 对自定义容器无效，必须命令式处理
  scrollBehavior(_to, _from, savedPosition) {
    const scrollContainer = document.querySelector(".App-router") ?? document.querySelector(".app-scroll");
    if (!scrollContainer) return { top: 0 };
    scrollContainer.scrollTop = savedPosition?.top ?? 0;
    return { top: 0 };
  },
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("/src/views/Home.vue")
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("/src/views/SettingsView.vue?t=1788665009603"),
      // Raycast 化：设置页独立渲染，无 AppShell 顶栏
      meta: { window: "overlay" }
    },
    {
      path: "/onboarding",
      name: "onboarding",
      component: () => import("/src/views/OnboardingView.vue"),
      // onboarding 本身就是路由表，redirect 没用，去掉；
      // 不在 MODULES 中，天然不进侧边栏/⌘K
      meta: { bypassOnboarding: true }
    },
    {
      path: "/migration",
      name: "migration",
      component: () => import("/src/views/MigrationCenterView.vue")
    },
    {
      path: "/about",
      name: "about",
      component: () => import("/src/views/AboutView.vue")
    },
    {
      // 启动器管理页（IA v2：fastSearch → launcher 改名，2026-09）
      path: "/launcher",
      name: "launcher",
      component: () => import("/src/views/launcher/index.vue")
    },
    // 旧路径兼容重定向
    { path: "/fastSearch", redirect: "/launcher" },
    {
      path: "/pomodoro",
      name: "pomodoro",
      component: () => import("/src/views/pomodoro/index.vue")
    },
    {
      // 迷你番茄钟悬浮窗：miniWindow.ts 以 hash 直接加载
      path: "/mini-timer",
      name: "miniTimer",
      component: () => import("/src/views/pomodoro/MiniTimer.vue"),
      meta: { window: "floating" }
    },
    {
      // 浮动笔记悬浮窗：floatingNote.ts 以 hash 直接加载
      path: "/floating-note",
      name: "floatingNote",
      component: () => import("/src/views/notes/FloatingNote.vue"),
      meta: { window: "floating" }
    },
    {
      path: "/snippets",
      name: "snippets",
      component: () => import("/src/views/snippets/index.vue")
    },
    {
      path: "/screenRecorder",
      component: () => import("/src/views/screenRecorder/Layout.vue"),
      redirect: "/screenRecorder/record",
      children: [
        {
          path: "record",
          name: "screenRecorderRecord",
          component: () => import("/src/views/screenRecorder/pages/RecordPage.vue")
        },
        {
          path: "history",
          name: "screenRecorderHistory",
          component: () => import("/src/views/screenRecorder/pages/HistoryPage.vue")
        },
        {
          path: "playback",
          name: "screenRecorderPlayback",
          component: () => import("/src/views/screenRecorder/pages/PlaybackPage.vue")
        },
        {
          path: "clip",
          name: "screenRecorderClip",
          component: () => import("/src/views/screenRecorder/pages/ClipPage.vue"),
          // 剪辑画布：主窗口内沉浸式覆盖层（AppShell 隐藏）
          meta: { window: "overlay" }
        }
      ]
    },
    {
      path: "/screenshot",
      name: "screenshot",
      component: () => import("/src/views/screenshot/index.vue")
    },
    {
      path: "/screenshot/capture",
      name: "screenshotCapture",
      component: () => import("/src/views/screenshot/pages/CapturePage.vue"),
      // 截图捕获层：主窗口内沉浸式覆盖层（AppShell 隐藏）
      meta: { window: "overlay" }
    },
    {
      // 贴图窗口（B1）：主进程 PinService 创建无边框置顶窗口并以 hash 加载此路由，
      // 此前路由表缺失导致窗口永远空白
      path: "/screenshot/pin",
      name: "screenshotPin",
      component: () => import("/src/views/screenshot/pages/PinPage.vue"),
      meta: { window: "floating", bypassOnboarding: true }
    }
  ]
});
router.beforeEach((to, _from, next) => {
  startRouteTiming(to);
  if (to.path === "/onboarding" || to.meta?.bypassOnboarding) {
    next();
    return;
  }
  let settled = false;
  const timer = setTimeout(() => {
    if (!settled) {
      settled = true;
      next();
    }
  }, 3e3);
  void (async () => {
    try {
      const cached = onboardingState.value;
      if (cached === null) {
        const real = await window.api.preferences.isOnboardingCompleted();
        onboardingState.value = real;
      }
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (onboardingState.value === false) {
        next({ path: "/onboarding", replace: true });
        return;
      }
    } catch {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
    }
    next();
  })();
});
router.afterEach((to, _from, failure) => {
  if (failure) {
    cancelRouteTiming(to);
    return;
  }
  finishRouteTiming(to);
});
export default router;

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNyZWF0ZVJvdXRlciwgY3JlYXRlV2ViSGFzaEhpc3RvcnkgfSBmcm9tICd2dWUtcm91dGVyJ1xuaW1wb3J0IHsgcmVmIH0gZnJvbSAndnVlJ1xuaW1wb3J0IHR5cGUgeyBSb3V0ZU1ldGEgfSBmcm9tICd2dWUtcm91dGVyJ1xuaW1wb3J0IHsgY2FuY2VsUm91dGVUaW1pbmcsIGZpbmlzaFJvdXRlVGltaW5nLCBzdGFydFJvdXRlVGltaW5nIH0gZnJvbSAnLi4vdXRpbHMvcm91dGVQZXJmJ1xuXG4vKipcbiAqIOi3r+eUseeql+WPo+ivreS5ie+8iElBIHYy44CM6Lev55Sx5LiO56qX5Y+j6K+t5LmJ5q2j5byP5YyW44CN77yJXG4gKlxuICog5LiA5Liq6Lev55Sx6KGo5Y+q5o+P6L+w5LiJ57G75Lic6KW/77yM55SoIG1ldGEud2luZG93IOWMuuWIhu+8jOS4jeWGjemdoOWRveWQjee6puWumuWSjOehrOe8lueggeWQjeWNle+8mlxuICogLSBzaGVsbO+8iOm7mOiupO+8iSDihpIg5Li756qX5Y+j6aG16Z2i77yMQXBwU2hlbGwg5YyF6KO577yb5a+86Iiq5Y+v6KeB5oCn55SxIE1PRFVMRVMg5Yaz5a6aXG4gKiAgICAgICAgICAgICAgICAgIO+8iOS+p+i+ueagjy/ijJhLIOWPquivuyBNT0RVTEVT77yM6Z2e5qih5Z2X6aG16Z2i5aSp54S25LiN6L+b5a+86Iiq77yJXG4gKiAtIG92ZXJsYXkgICAgICAg4oaSIOS4u+eql+WPo+WGheeahOayiea1uOW8j+imhuebluWxgu+8iOaXoOWjs++8ie+8muaIquWbvuaNleiOt+OAgeW9leWxj+WJqui+keeUu+W4g1xuICogLSBmbG9hdGluZyAgICAgIOKGkiDkuLvov5vnqIvliJvlu7rnmoTni6znq4vmgqzmta7nqpfvvIzku6UgaGFzaCDnm7TmjqXliqDovb3vvJpcbiAqICAgICAgICAgICAgICAgICAg6LS05Zu+IC9zY3JlZW5zaG90L3Bpbu+8iFBpblNlcnZpY2XvvInjgIHov7fkvaDnlarojITpkp8gL21pbmktdGltZXLvvIhtaW5pV2luZG9377yJXG4gKiAtIGNhcHN1bGUgICAgICAg4oaSIOWQr+WKqOWPsOiDtuWbiueql++8mueLrOeri+WFpeWPoyBsYXVuY2hlci5odG1s77yM5peg5a+55bqU6Lev55Sx77yM5YiX5Ye65LuF5Li66K+t5LmJ5a6M5pW0XG4gKi9cbmRlY2xhcmUgbW9kdWxlICd2dWUtcm91dGVyJyB7XG4gIGludGVyZmFjZSBSb3V0ZU1ldGEge1xuICAgIC8qKiDnqpflj6Por63kuYnvvIznvLrnnIHkuLogJ3NoZWxsJyAqL1xuICAgIHdpbmRvdz86ICdzaGVsbCcgfCAnb3ZlcmxheScgfCAnZmxvYXRpbmcnIHwgJ2NhcHN1bGUnXG4gICAgLyoqIOmmluWQr+W8leWvvOacquWujOaIkOaXtuS7jeaUvuihjO+8iHJvdXRlci5iZWZvcmVFYWNoIOa2iOi0ue+8iSAqL1xuICAgIGJ5cGFzc09uYm9hcmRpbmc/OiBib29sZWFuXG4gIH1cbn1cblxuLyoqXG4gKiBPbmJvYXJkaW5nIOeKtuaAgeWNleS+i++8iHJvdXRlciDlhbHkuqvvvIlcbiAqIC0gZmFsc2U6IOacquWujOaIkO+8iOmmluasoeWQr+WKqO+8ie+8jHJvdXRlciDlrojljavmjqjliLAgL29uYm9hcmRpbmdcbiAqIC0gdHJ1ZTog5bey5a6M5oiQ77yM5q2j5bi46Lez6L2sXG4gKiAtIG51bGw6IOacquefpe+8iOmmluasoeWQr+WKqOaXtiBJUEMg6L+Y5rKh6Zeu77yJXG4gKiDorr7nva7pobXjgIzph43mlrDlvIDlp4vlvJXlr7zjgI3lj6/osIMgcmVzZXRPbmJvYXJkaW5nU3RhdGUoKSDph43nva7kuLogZmFsc2VcbiAqL1xuZXhwb3J0IGNvbnN0IG9uYm9hcmRpbmdTdGF0ZSA9IHJlZjxib29sZWFuIHwgbnVsbD4obnVsbClcblxuLyoqIOmHjee9ruS4uuOAjOacquWujOaIkOOAjeKAlOKAlOS+m+iuvue9rumhteiuqeeUqOaIt+mHjeeci+W8leWvvCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0T25ib2FyZGluZ1N0YXRlKCk6IHZvaWQge1xuICBvbmJvYXJkaW5nU3RhdGUudmFsdWUgPSBmYWxzZVxufVxuXG4vKiog5qCH6K6w5a6M5oiQ77yI6K6+572u6aG15Li75Yqo6LCD77yM5oiWIE9uYm9hcmRpbmdWaWV3IOWGhemDqOinpuWPke+8iSAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hcmtPbmJvYXJkaW5nQ29tcGxldGVkKCk6IHZvaWQge1xuICBvbmJvYXJkaW5nU3RhdGUudmFsdWUgPSB0cnVlXG59XG5cbmNvbnN0IHJvdXRlciA9IGNyZWF0ZVJvdXRlcih7XG4gIGhpc3Rvcnk6IGNyZWF0ZVdlYkhhc2hIaXN0b3J5KCksXG4gIC8vIOmFjee9rua7muWKqOihjOS4uu+8jOWkhOeQhuiHquWumuS5iea7muWKqOWuueWZqFxuICAvLyBCMyDkv67lpI3vvJrmu5rliqjlrrnlmajmnInkuKTkuKog4oCU4oCUIOayiea1uOW8j+WIhuaUr+eahCAuQXBwLXJvdXRlciDkuI5cbiAgLy8gQXBwU2hlbGwg5YiG5pSv55qEIC5hcHAtc2Nyb2xs77ybd2luZG93IOacrOi6q+S4jeWPr+a7mu+8iGgtc2NyZWVuICsg5YaF6YOo5rua5Yqo77yJ77yMXG4gIC8vIOWjsOaYjuW8jyByZXR1cm4geyB0b3A6IDAgfSAvIHNhdmVkUG9zaXRpb24g5a+56Ieq5a6a5LmJ5a655Zmo5peg5pWI77yM5b+F6aG75ZG95Luk5byP5aSE55CGXG4gIHNjcm9sbEJlaGF2aW9yKF90bywgX2Zyb20sIHNhdmVkUG9zaXRpb24pIHtcbiAgICBjb25zdCBzY3JvbGxDb250YWluZXIgPVxuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5BcHAtcm91dGVyJykgPz9cbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuYXBwLXNjcm9sbCcpXG4gICAgaWYgKCFzY3JvbGxDb250YWluZXIpIHJldHVybiB7IHRvcDogMCB9XG5cbiAgICAvLyDliY3ov5sv5ZCO6YCA77ya5oGi5aSN5L+d5a2Y55qE5L2N572u77yb5pmu6YCa5a+86Iiq77ya5aSN5L2N5Yiw6aG2XG4gICAgc2Nyb2xsQ29udGFpbmVyLnNjcm9sbFRvcCA9IHNhdmVkUG9zaXRpb24/LnRvcCA/PyAwXG4gICAgcmV0dXJuIHsgdG9wOiAwIH1cbiAgfSxcbiAgcm91dGVzOiBbXG4gICAge1xuICAgICAgcGF0aDogJy8nLFxuICAgICAgbmFtZTogJ2hvbWUnLFxuICAgICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJy4uL3ZpZXdzL0hvbWUudnVlJylcbiAgICB9LFxuICAgIHtcbiAgICAgIHBhdGg6ICcvc2V0dGluZ3MnLFxuICAgICAgbmFtZTogJ3NldHRpbmdzJyxcbiAgICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCcuLi92aWV3cy9TZXR0aW5nc1ZpZXcudnVlJyksXG4gICAgICAvLyBSYXljYXN0IOWMlu+8muiuvue9rumhteeLrOeri+a4suafk++8jOaXoCBBcHBTaGVsbCDpobbmoI9cbiAgICAgIG1ldGE6IHsgd2luZG93OiAnb3ZlcmxheScgfVxuICAgIH0sXG4gICAge1xuICAgICAgcGF0aDogJy9vbmJvYXJkaW5nJyxcbiAgICAgIG5hbWU6ICdvbmJvYXJkaW5nJyxcbiAgICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCcuLi92aWV3cy9PbmJvYXJkaW5nVmlldy52dWUnKSxcbiAgICAgIC8vIG9uYm9hcmRpbmcg5pys6Lqr5bCx5piv6Lev55Sx6KGo77yMcmVkaXJlY3Qg5rKh55So77yM5Y675o6J77ybXG4gICAgICAvLyDkuI3lnKggTU9EVUxFUyDkuK3vvIzlpKnnhLbkuI3ov5vkvqfovrnmoI8v4oyYS1xuICAgICAgbWV0YTogeyBieXBhc3NPbmJvYXJkaW5nOiB0cnVlIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIHBhdGg6ICcvbWlncmF0aW9uJyxcbiAgICAgIG5hbWU6ICdtaWdyYXRpb24nLFxuICAgICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJy4uL3ZpZXdzL01pZ3JhdGlvbkNlbnRlclZpZXcudnVlJylcbiAgICB9LFxuICAgIHtcbiAgICAgIHBhdGg6ICcvYWJvdXQnLFxuICAgICAgbmFtZTogJ2Fib3V0JyxcbiAgICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCcuLi92aWV3cy9BYm91dFZpZXcudnVlJylcbiAgICB9LFxuICAgIHtcbiAgICAgIC8vIOWQr+WKqOWZqOeuoeeQhumhte+8iElBIHYy77yaZmFzdFNlYXJjaCDihpIgbGF1bmNoZXIg5pS55ZCN77yMMjAyNi0wOe+8iVxuICAgICAgcGF0aDogJy9sYXVuY2hlcicsXG4gICAgICBuYW1lOiAnbGF1bmNoZXInLFxuICAgICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJy4uL3ZpZXdzL2xhdW5jaGVyL2luZGV4LnZ1ZScpXG4gICAgfSxcbiAgICAvLyDml6fot6/lvoTlhbzlrrnph43lrprlkJFcbiAgICB7IHBhdGg6ICcvZmFzdFNlYXJjaCcsIHJlZGlyZWN0OiAnL2xhdW5jaGVyJyB9LFxuICAgIHtcbiAgICAgIHBhdGg6ICcvcG9tb2Rvcm8nLFxuICAgICAgbmFtZTogJ3BvbW9kb3JvJyxcbiAgICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCcuLi92aWV3cy9wb21vZG9yby9pbmRleC52dWUnKVxuICAgIH0sXG4gICAge1xuICAgICAgLy8g6L+35L2g55Wq6IyE6ZKf5oKs5rWu56qX77yabWluaVdpbmRvdy50cyDku6UgaGFzaCDnm7TmjqXliqDovb1cbiAgICAgIHBhdGg6ICcvbWluaS10aW1lcicsXG4gICAgICBuYW1lOiAnbWluaVRpbWVyJyxcbiAgICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCcuLi92aWV3cy9wb21vZG9yby9NaW5pVGltZXIudnVlJyksXG4gICAgICBtZXRhOiB7IHdpbmRvdzogJ2Zsb2F0aW5nJyB9XG4gICAgfSxcbiAgICB7XG4gICAgICAvLyDmta7liqjnrJTorrDmgqzmta7nqpfvvJpmbG9hdGluZ05vdGUudHMg5LulIGhhc2gg55u05o6l5Yqg6L29XG4gICAgICBwYXRoOiAnL2Zsb2F0aW5nLW5vdGUnLFxuICAgICAgbmFtZTogJ2Zsb2F0aW5nTm90ZScsXG4gICAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnLi4vdmlld3Mvbm90ZXMvRmxvYXRpbmdOb3RlLnZ1ZScpLFxuICAgICAgbWV0YTogeyB3aW5kb3c6ICdmbG9hdGluZycgfVxuICAgIH0sXG4gICAge1xuICAgICAgcGF0aDogJy9zbmlwcGV0cycsXG4gICAgICBuYW1lOiAnc25pcHBldHMnLFxuICAgICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJy4uL3ZpZXdzL3NuaXBwZXRzL2luZGV4LnZ1ZScpXG4gICAgfSxcbiAgICB7XG4gICAgICBwYXRoOiAnL3NjcmVlblJlY29yZGVyJyxcbiAgICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCcuLi92aWV3cy9zY3JlZW5SZWNvcmRlci9MYXlvdXQudnVlJyksXG4gICAgICByZWRpcmVjdDogJy9zY3JlZW5SZWNvcmRlci9yZWNvcmQnLFxuICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAge1xuICAgICAgICAgIHBhdGg6ICdyZWNvcmQnLFxuICAgICAgICAgIG5hbWU6ICdzY3JlZW5SZWNvcmRlclJlY29yZCcsXG4gICAgICAgICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJy4uL3ZpZXdzL3NjcmVlblJlY29yZGVyL3BhZ2VzL1JlY29yZFBhZ2UudnVlJylcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHBhdGg6ICdoaXN0b3J5JyxcbiAgICAgICAgICBuYW1lOiAnc2NyZWVuUmVjb3JkZXJIaXN0b3J5JyxcbiAgICAgICAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnLi4vdmlld3Mvc2NyZWVuUmVjb3JkZXIvcGFnZXMvSGlzdG9yeVBhZ2UudnVlJylcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHBhdGg6ICdwbGF5YmFjaycsXG4gICAgICAgICAgbmFtZTogJ3NjcmVlblJlY29yZGVyUGxheWJhY2snLFxuICAgICAgICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCcuLi92aWV3cy9zY3JlZW5SZWNvcmRlci9wYWdlcy9QbGF5YmFja1BhZ2UudnVlJylcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHBhdGg6ICdjbGlwJyxcbiAgICAgICAgICBuYW1lOiAnc2NyZWVuUmVjb3JkZXJDbGlwJyxcbiAgICAgICAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnLi4vdmlld3Mvc2NyZWVuUmVjb3JkZXIvcGFnZXMvQ2xpcFBhZ2UudnVlJyksXG4gICAgICAgICAgLy8g5Ymq6L6R55S75biD77ya5Li756qX5Y+j5YaF5rKJ5rW45byP6KaG55uW5bGC77yIQXBwU2hlbGwg6ZqQ6JeP77yJXG4gICAgICAgICAgbWV0YTogeyB3aW5kb3c6ICdvdmVybGF5JyB9XG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgIHBhdGg6ICcvc2NyZWVuc2hvdCcsXG4gICAgICBuYW1lOiAnc2NyZWVuc2hvdCcsXG4gICAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnLi4vdmlld3Mvc2NyZWVuc2hvdC9pbmRleC52dWUnKVxuICAgIH0sXG4gICAge1xuICAgICAgcGF0aDogJy9zY3JlZW5zaG90L2NhcHR1cmUnLFxuICAgICAgbmFtZTogJ3NjcmVlbnNob3RDYXB0dXJlJyxcbiAgICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCcuLi92aWV3cy9zY3JlZW5zaG90L3BhZ2VzL0NhcHR1cmVQYWdlLnZ1ZScpLFxuICAgICAgLy8g5oiq5Zu+5o2V6I635bGC77ya5Li756qX5Y+j5YaF5rKJ5rW45byP6KaG55uW5bGC77yIQXBwU2hlbGwg6ZqQ6JeP77yJXG4gICAgICBtZXRhOiB7IHdpbmRvdzogJ292ZXJsYXknIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIC8vIOi0tOWbvueql+WPo++8iEIx77yJ77ya5Li76L+b56iLIFBpblNlcnZpY2Ug5Yib5bu65peg6L655qGG572u6aG256qX5Y+j5bm25LulIGhhc2gg5Yqg6L295q2k6Lev55Sx77yMXG4gICAgICAvLyDmraTliY3ot6/nlLHooajnvLrlpLHlr7zoh7Tnqpflj6PmsLjov5znqbrnmb1cbiAgICAgIHBhdGg6ICcvc2NyZWVuc2hvdC9waW4nLFxuICAgICAgbmFtZTogJ3NjcmVlbnNob3RQaW4nLFxuICAgICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJy4uL3ZpZXdzL3NjcmVlbnNob3QvcGFnZXMvUGluUGFnZS52dWUnKSxcbiAgICAgIG1ldGE6IHsgd2luZG93OiAnZmxvYXRpbmcnLCBieXBhc3NPbmJvYXJkaW5nOiB0cnVlIH1cbiAgICB9XG4gIF1cbn0pXG5cbnJvdXRlci5iZWZvcmVFYWNoKCh0bywgX2Zyb20sIG5leHQpID0+IHtcbiAgc3RhcnRSb3V0ZVRpbWluZyh0bylcblxuICAvLyDpppbmrKHlkK/liqjlvJXlr7zvvJrmnKrlrozmiJAgb25ib2FyZGluZyDkuJTorr/pl67pnZ4gb25ib2FyZGluZyDot6/nlLEg4oaSIOaOqOWIsCAvb25ib2FyZGluZ1xuICAvLyDpobrluo/vvJrlhYggYXdhaXQgaXBjIOaLv+eKtuaAge+8jOWGjeWGs+WumiBuZXh0IOaYr+aUvuihjOi/mOaYr+mHjeWumuWQkVxuICAvLyDvvIh2dWUtcm91dGVyIDMg6aOO5qC8IG5leHQg5Y+l5p+E5pu0566A5Y2V77yM5byC5q2l5Lmf5YW85a6577yJXG4gIGlmICh0by5wYXRoID09PSAnL29uYm9hcmRpbmcnIHx8IHRvLm1ldGE/LmJ5cGFzc09uYm9hcmRpbmcpIHtcbiAgICBuZXh0KClcbiAgICByZXR1cm5cbiAgfVxuXG4gIC8vIOi2heaXtuWFnOW6le+8mklQQyDmjILotbfml7bkuI3pmLvloZ7ot6/nlLHvvIgzcyDlkI7lvLrliLbmlL7ooYzvvIlcbiAgbGV0IHNldHRsZWQgPSBmYWxzZVxuICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGlmICghc2V0dGxlZCkge1xuICAgICAgc2V0dGxlZCA9IHRydWVcbiAgICAgIG5leHQoKVxuICAgIH1cbiAgfSwgMzAwMClcblxuICB2b2lkIChhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNhY2hlZCA9IG9uYm9hcmRpbmdTdGF0ZS52YWx1ZVxuICAgICAgaWYgKGNhY2hlZCA9PT0gbnVsbCkge1xuICAgICAgICBjb25zdCByZWFsID0gYXdhaXQgd2luZG93LmFwaS5wcmVmZXJlbmNlcy5pc09uYm9hcmRpbmdDb21wbGV0ZWQoKVxuICAgICAgICBvbmJvYXJkaW5nU3RhdGUudmFsdWUgPSByZWFsXG4gICAgICB9XG4gICAgICBpZiAoc2V0dGxlZCkgcmV0dXJuIC8vIOi2heaXtuW3suaUvuihjFxuICAgICAgc2V0dGxlZCA9IHRydWVcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lcilcbiAgICAgIGlmIChvbmJvYXJkaW5nU3RhdGUudmFsdWUgPT09IGZhbHNlKSB7XG4gICAgICAgIG5leHQoeyBwYXRoOiAnL29uYm9hcmRpbmcnLCByZXBsYWNlOiB0cnVlIH0pXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gSVBDIOWksei0peS4jemYu+aWrVxuICAgICAgaWYgKHNldHRsZWQpIHJldHVyblxuICAgICAgc2V0dGxlZCA9IHRydWVcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lcilcbiAgICB9XG4gICAgbmV4dCgpXG4gIH0pKClcbn0pXG5cbnJvdXRlci5hZnRlckVhY2goKHRvLCBfZnJvbSwgZmFpbHVyZSkgPT4ge1xuICBpZiAoZmFpbHVyZSkge1xuICAgIGNhbmNlbFJvdXRlVGltaW5nKHRvKVxuICAgIHJldHVyblxuICB9XG5cbiAgZmluaXNoUm91dGVUaW1pbmcodG8pXG59KVxuXG5leHBvcnQgZGVmYXVsdCByb3V0ZXJcbiJdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxjQUFjLDRCQUE0QjtBQUNuRCxTQUFTLFdBQVc7QUFFcEIsU0FBUyxtQkFBbUIsbUJB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