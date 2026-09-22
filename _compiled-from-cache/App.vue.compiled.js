import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/App.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { computed, onBeforeUnmount, onMounted } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { useRoute } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue-router.js?v=ea0f6108";
import RouteLoading from "/src/components/RouteLoading.vue";
import AppShell from "/src/components/shell/AppShell.vue?t=1789709850689";
import { useAppMenu } from "/src/composables/useAppMenu.ts";
import { installTrackpadSwipe } from "/src/composables/useTrackpadGesture.ts";
import { ensurePomodoroBridgeSync } from "/src/composables/usePomodoroAppBridge.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "App",
  setup(__props, { expose: __expose }) {
    __expose();
    const { install: installAppMenu } = useAppMenu();
    const route = useRoute();
    const showShell = computed(
      () => (route.meta.window ?? "shell") === "shell" && route.query.immersive !== "1"
    );
    let uninstallAppMenu = null;
    let uninstallTrackpad = null;
    onMounted(() => {
      uninstallAppMenu = installAppMenu();
      uninstallTrackpad = installTrackpadSwipe(
        window,
        () => window.history.back(),
        () => window.history.forward()
      );
      void installPomodoroBridgeIfPrimary();
    });
    async function installPomodoroBridgeIfPrimary() {
      try {
        if ((route.meta.window ?? "shell") !== "shell") return;
        if (await window.api.isPrimaryWindow()) {
          ensurePomodoroBridgeSync();
        }
      } catch {
      }
    }
    onBeforeUnmount(() => {
      uninstallAppMenu?.();
      uninstallAppMenu = null;
      uninstallTrackpad?.();
      uninstallTrackpad = null;
    });
    const loadingVariant = computed(() => {
      const routeName = String(route.name || "");
      if (routeName === "snippets") {
        return "editor";
      }
      if (routeName === "screenRecorderRecord") {
        return "recorder-record";
      }
      if (routeName === "screenRecorderHistory") {
        return "recorder-history";
      }
      if (routeName === "screenRecorderPlayback") {
        return "recorder-playback";
      }
      if (routeName === "screenRecorderClip") {
        return "recorder-clip";
      }
      return "default";
    });
    const loadingDelay = computed(() => {
      if (loadingVariant.value.startsWith("recorder")) {
        return 160;
      }
      return 120;
    });
    const __returned__ = { installAppMenu, route, showShell, get uninstallAppMenu() {
      return uninstallAppMenu;
    }, set uninstallAppMenu(v) {
      uninstallAppMenu = v;
    }, get uninstallTrackpad() {
      return uninstallTrackpad;
    }, set uninstallTrackpad(v) {
      uninstallTrackpad = v;
    }, installPomodoroBridgeIfPrimary, loadingVariant, loadingDelay, RouteLoading, AppShell };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, resolveDynamicComponent as _resolveDynamicComponent, openBlock as _openBlock, createBlock as _createBlock, createVNode as _createVNode, Suspense as _Suspense, withCtx as _withCtx, resolveComponent as _resolveComponent, createElementBlock as _createElementBlock, Fragment as _Fragment } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = {
  key: 0,
  class: "App-router h-screen overflow-auto"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  const _component_router_view = _resolveComponent("router-view");
  return _openBlock(), _createElementBlock(
    _Fragment,
    null,
    [
      _createCommentVNode(" 沉浸式路由：直接渲染（无壳子） "),
      !$setup.showShell ? (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createVNode(_component_router_view, null, {
          default: _withCtx(({ Component }) => [
            (_openBlock(), _createBlock(
              _Suspense,
              { timeout: "0" },
              {
                fallback: _withCtx(() => [
                  _createVNode($setup["RouteLoading"], {
                    variant: $setup.loadingVariant,
                    delay: $setup.loadingDelay
                  }, null, 8, ["variant", "delay"])
                ]),
                default: _withCtx(() => [
                  (_openBlock(), _createBlock(_resolveDynamicComponent(Component)))
                ]),
                _: 2
                /* DYNAMIC */
              },
              1024
              /* DYNAMIC_SLOTS */
            ))
          ]),
          _: 1
          /* STABLE */
        })
      ])) : (_openBlock(), _createElementBlock(
        _Fragment,
        { key: 1 },
        [
          _createCommentVNode(" 普通路由：AppShell 包裹（顶栏 + 侧边栏） "),
          _createVNode($setup["AppShell"], null, {
            default: _withCtx(() => [
              _createVNode(_component_router_view, null, {
                default: _withCtx(({ Component }) => [
                  (_openBlock(), _createBlock(
                    _Suspense,
                    { timeout: "0" },
                    {
                      fallback: _withCtx(() => [
                        _createVNode($setup["RouteLoading"], {
                          variant: $setup.loadingVariant,
                          delay: $setup.loadingDelay
                        }, null, 8, ["variant", "delay"])
                      ]),
                      default: _withCtx(() => [
                        (_openBlock(), _createBlock(_resolveDynamicComponent(Component)))
                      ]),
                      _: 2
                      /* DYNAMIC */
                    },
                    1024
                    /* DYNAMIC_SLOTS */
                  ))
                ]),
                _: 1
                /* STABLE */
              })
            ]),
            _: 1
            /* STABLE */
          })
        ],
        2112
        /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
      ))
    ],
    2112
    /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
  );
}
_sfc_main.__hmrId = "7a7a37b1";
typeof __VUE_HMR_RUNTIME__ !== "undefined" && __VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId, _sfc_main);
import.meta.hot.on("file-changed", ({ file }) => {
  __VUE_HMR_RUNTIME__.CHANGED_FILE = file;
});
import.meta.hot.accept((mod) => {
  if (!mod) return;
  const { default: updated, _rerender_only } = mod;
  if (_rerender_only) {
    __VUE_HMR_RUNTIME__.rerender(updated.__hmrId, updated.render);
  } else {
    __VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated);
  }
});
import _export_sfc from "/@id/__x00__plugin-vue:export-helper";
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/App.vue"]]);

//# sourceMappingURL=data:application/json;base64,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Il0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQgc2V0dXAgbGFuZz1cInRzXCI+XG5pbXBvcnQgeyBjb21wdXRlZCwgb25CZWZvcmVVbm1vdW50LCBvbk1vdW50ZWQgfSBmcm9tICd2dWUnXG5pbXBvcnQgeyB1c2VSb3V0ZSB9IGZyb20gJ3Z1ZS1yb3V0ZXInXG5pbXBvcnQgUm91dGVMb2FkaW5nIGZyb20gJy4vY29tcG9uZW50cy9Sb3V0ZUxvYWRpbmcudnVlJ1xuaW1wb3J0IEFwcFNoZWxsIGZyb20gJy4vY29tcG9uZW50cy9zaGVsbC9BcHBTaGVsbC52dWUnXG5pbXBvcnQgeyB1c2VBcHBNZW51IH0gZnJvbSAnLi9jb21wb3NhYmxlcy91c2VBcHBNZW51J1xuaW1wb3J0IHsgaW5zdGFsbFRyYWNrcGFkU3dpcGUgfSBmcm9tICcuL2NvbXBvc2FibGVzL3VzZVRyYWNrcGFkR2VzdHVyZSdcbmltcG9ydCB7IGVuc3VyZVBvbW9kb3JvQnJpZGdlU3luYyB9IGZyb20gJy4vY29tcG9zYWJsZXMvdXNlUG9tb2Rvcm9BcHBCcmlkZ2UnXG5cbi8vIHVzZUFwcE1lbnUg6ZyA6KaB5ZyoIHNldHVwIOS4iuS4i+aWh+WGheiwg+eUqO+8iOWGhemDqOWPliByb3V0ZXLvvInvvIxpbnN0YWxsIOaOqOi/n+WIsOaMgui9veaXtlxuY29uc3QgeyBpbnN0YWxsOiBpbnN0YWxsQXBwTWVudSB9ID0gdXNlQXBwTWVudSgpXG5cbnR5cGUgTG9hZGluZ1ZhcmlhbnQgPVxuICB8ICdkZWZhdWx0J1xuICB8ICdlZGl0b3InXG4gIHwgJ3JlY29yZGVyLXJlY29yZCdcbiAgfCAncmVjb3JkZXItaGlzdG9yeSdcbiAgfCAncmVjb3JkZXItcGxheWJhY2snXG4gIHwgJ3JlY29yZGVyLWNsaXAnXG5cbmNvbnN0IHJvdXRlID0gdXNlUm91dGUoKVxuXG4vKipcbiAqIOWjs+aYvumakOeUsei3r+eUsSBtZXRhLndpbmRvdyDpqbHliqjvvIjor63kuYnlrprkuYnop4Egcm91dGVyL2luZGV4LnRz77yJ77yaXG4gKiAtIHNoZWxs77yI6buY6K6k77yJ77yaQXBwU2hlbGwg5YyF6KO577yI6aG25qCPICsg5L6n6L655qCP77yJXG4gKiAtIG92ZXJsYXnvvJrmsonmtbjlvI/opobnm5blsYLnm7TmjqXmuLLmn5PvvIjlvZXlsY/liarovpHnlLvluIPvvIlcbiAqIC0gP2ltbWVyc2l2ZT0x77yISUEgdjIg6Zi25q61Q++8ie+8muWQr+WKqOWPsCAvIOKMmEsg5omT5byA55qE54us56uL5qih5Z2X56qX5Y+j77yMXG4gKiAgIOaXoOWjs+ebtOaOpea4suafk+aooeWdl+acrOi6q+KAlOKAlOaQnOS7gOS5iOWwseWPqueci+S7gOS5iFxuICovXG5jb25zdCBzaG93U2hlbGwgPSBjb21wdXRlZChcbiAgKCkgPT4gKHJvdXRlLm1ldGEud2luZG93ID8/ICdzaGVsbCcpID09PSAnc2hlbGwnICYmIHJvdXRlLnF1ZXJ5LmltbWVyc2l2ZSAhPT0gJzEnXG4pXG5cbi8vIOiuoumYheS4u+i/m+eoi+iPnOWNlSAvIGRvY2sgLyB0cmF5IOi3s+i9rOaMh+S7pFxubGV0IHVuaW5zdGFsbEFwcE1lbnU6ICgoKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsXG5sZXQgdW5pbnN0YWxsVHJhY2twYWQ6ICgoKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsXG5vbk1vdW50ZWQoKCkgPT4ge1xuICB1bmluc3RhbGxBcHBNZW51ID0gaW5zdGFsbEFwcE1lbnUoKVxuXG4gIC8vIFRyYWNrcGFkIOWPjOaMh+awtOW5syBzd2lwZSDihpIg6Kem5Y+R5Li76L+b56iLIGhpc3RvcnkuYmFjay9mb3J3YXJkXG4gIC8vIO+8iG1hY09TIOWOn+eUn+S9k+mqjO+8m3doZWVsIOebkeWQrCBwYXNzaXZlPXRydWUg5LiN6Zi75aGe5Li757q/56iL5rua5Yqo77yJXG4gIHVuaW5zdGFsbFRyYWNrcGFkID0gaW5zdGFsbFRyYWNrcGFkU3dpcGUoXG4gICAgd2luZG93LFxuICAgICgpID0+IHdpbmRvdy5oaXN0b3J5LmJhY2soKSxcbiAgICAoKSA9PiB3aW5kb3cuaGlzdG9yeS5mb3J3YXJkKClcbiAgKVxuXG4gIC8vIOeVquiMhOmSn+ahpe+8iOiuoeaXtuWZqOWNleS+iyArIOWFqOWxgOW/q+aNt+mUriArIHRyYXkg5b+r54Wn77yJ77ya5Y+q5Zyo5Li756qX5Y+j5Yid5aeL5YyW77yMXG4gIC8vIG1pbmkg562JIHdpbmRvdyDot6/nlLHnqpflj6PkuI3oo4XvvIhJQSB2MiDpmLbmrrVB77ya6IO25ZuK44CM5byA5aeL5LiT5rOo44CN5YmN572u77yJXG4gIHZvaWQgaW5zdGFsbFBvbW9kb3JvQnJpZGdlSWZQcmltYXJ5KClcbn0pXG5cbmFzeW5jIGZ1bmN0aW9uIGluc3RhbGxQb21vZG9yb0JyaWRnZUlmUHJpbWFyeSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICBpZiAoKHJvdXRlLm1ldGEud2luZG93ID8/ICdzaGVsbCcpICE9PSAnc2hlbGwnKSByZXR1cm5cbiAgICBpZiAoYXdhaXQgd2luZG93LmFwaS5pc1ByaW1hcnlXaW5kb3coKSkge1xuICAgICAgZW5zdXJlUG9tb2Rvcm9CcmlkZ2VTeW5jKClcbiAgICB9XG4gIH0gY2F0Y2gge1xuICAgIC8qIOWIpOWumuWksei0peS4jemYu+WhnuS4u+a1geeoiyAqL1xuICB9XG59XG5vbkJlZm9yZVVubW91bnQoKCkgPT4ge1xuICB1bmluc3RhbGxBcHBNZW51Py4oKVxuICB1bmluc3RhbGxBcHBNZW51ID0gbnVsbFxuICB1bmluc3RhbGxUcmFja3BhZD8uKClcbiAgdW5pbnN0YWxsVHJhY2twYWQgPSBudWxsXG59KVxuXG5jb25zdCBsb2FkaW5nVmFyaWFudCA9IGNvbXB1dGVkPExvYWRpbmdWYXJpYW50PigoKSA9PiB7XG4gIGNvbnN0IHJvdXRlTmFtZSA9IFN0cmluZyhyb3V0ZS5uYW1lIHx8ICcnKVxuXG4gIGlmIChyb3V0ZU5hbWUgPT09ICdzbmlwcGV0cycpIHtcbiAgICByZXR1cm4gJ2VkaXRvcidcbiAgfVxuXG4gIGlmIChyb3V0ZU5hbWUgPT09ICdzY3JlZW5SZWNvcmRlclJlY29yZCcpIHtcbiAgICByZXR1cm4gJ3JlY29yZGVyLXJlY29yZCdcbiAgfVxuXG4gIGlmIChyb3V0ZU5hbWUgPT09ICdzY3JlZW5SZWNvcmRlckhpc3RvcnknKSB7XG4gICAgcmV0dXJuICdyZWNvcmRlci1oaXN0b3J5J1xuICB9XG5cbiAgaWYgKHJvdXRlTmFtZSA9PT0gJ3NjcmVlblJlY29yZGVyUGxheWJhY2snKSB7XG4gICAgcmV0dXJuICdyZWNvcmRlci1wbGF5YmFjaydcbiAgfVxuXG4gIGlmIChyb3V0ZU5hbWUgPT09ICdzY3JlZW5SZWNvcmRlckNsaXAnKSB7XG4gICAgcmV0dXJuICdyZWNvcmRlci1jbGlwJ1xuICB9XG5cbiAgcmV0dXJuICdkZWZhdWx0J1xufSlcblxuY29uc3QgbG9hZGluZ0RlbGF5ID0gY29tcHV0ZWQoKCkgPT4ge1xuICBpZiAobG9hZGluZ1ZhcmlhbnQudmFsdWUuc3RhcnRzV2l0aCgncmVjb3JkZXInKSkge1xuICAgIHJldHVybiAxNjBcbiAgfVxuXG4gIHJldHVybiAxMjBcbn0pXG48L3NjcmlwdD5cblxuPHRlbXBsYXRlPlxuICA8IS0tIOayiea1uOW8j+i3r+eUse+8muebtOaOpea4suafk++8iOaXoOWjs+WtkO+8iSAtLT5cbiAgPGRpdiB2LWlmPVwiIXNob3dTaGVsbFwiIGNsYXNzPVwiQXBwLXJvdXRlciBoLXNjcmVlbiBvdmVyZmxvdy1hdXRvXCI+XG4gICAgPHJvdXRlci12aWV3IHYtc2xvdD1cInsgQ29tcG9uZW50IH1cIj5cbiAgICAgIDxTdXNwZW5zZSB0aW1lb3V0PVwiMFwiPlxuICAgICAgICA8Y29tcG9uZW50IDppcz1cIkNvbXBvbmVudFwiIC8+XG4gICAgICAgIDx0ZW1wbGF0ZSAjZmFsbGJhY2s+XG4gICAgICAgICAgPFJvdXRlTG9hZGluZyA6dmFyaWFudD1cImxvYWRpbmdWYXJpYW50XCIgOmRlbGF5PVwibG9hZGluZ0RlbGF5XCIgLz5cbiAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgIDwvU3VzcGVuc2U+XG4gICAgPC9yb3V0ZXItdmlldz5cbiAgPC9kaXY+XG5cbiAgPCEtLSDmma7pgJrot6/nlLHvvJpBcHBTaGVsbCDljIXoo7nvvIjpobbmoI8gKyDkvqfovrnmoI/vvIkgLS0+XG4gIDxBcHBTaGVsbCB2LWVsc2U+XG4gICAgPHJvdXRlci12aWV3IHYtc2xvdD1cInsgQ29tcG9uZW50IH1cIj5cbiAgICAgIDxTdXNwZW5zZSB0aW1lb3V0PVwiMFwiPlxuICAgICAgICA8Y29tcG9uZW50IDppcz1cIkNvbXBvbmVudFwiIC8+XG4gICAgICAgIDx0ZW1wbGF0ZSAjZmFsbGJhY2s+XG4gICAgICAgICAgPFJvdXRlTG9hZGluZyA6dmFyaWFudD1cImxvYWRpbmdWYXJpYW50XCIgOmRlbGF5PVwibG9hZGluZ0RlbGF5XCIgLz5cbiAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgIDwvU3VzcGVuc2U+XG4gICAgPC9yb3V0ZXItdmlldz5cbiAgPC9BcHBTaGVsbD5cbjwvdGVtcGxhdGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL0FwcC52dWUifQ==