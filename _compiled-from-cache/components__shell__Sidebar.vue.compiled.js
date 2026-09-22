import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/shell/Sidebar.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { computed, ref } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useRoute, useRouter } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue-router.js?v=c8635d8b";
import {
  PENDING_MODULES,
  getModulesByCategory
} from "/src/constants/modules.ts";
import { SYSTEM_PAGES } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/commands.ts?t=1788644759837";
import AppIcon from "/src/components/AppIcon.vue";
import UTooltip from "/src/components/ui/UTooltip.vue";
const EXPAND_KEY = "leaf.sidebar-expanded";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "Sidebar",
  setup(__props, { expose: __expose }) {
    __expose();
    const route = useRoute();
    const router = useRouter();
    const expanded = ref(
      typeof localStorage !== "undefined" && localStorage.getItem(EXPAND_KEY) === "1"
    );
    const toggleExpanded = () => {
      expanded.value = !expanded.value;
      try {
        localStorage.setItem(EXPAND_KEY, expanded.value ? "1" : "0");
      } catch {
      }
    };
    const byCategory = getModulesByCategory();
    const toItems = (mods) => mods.map((m) => ({
      key: m.id,
      label: m.label,
      icon: m.icon,
      path: m.path,
      routeName: m.routeName,
      moduleId: m.id
    }));
    const toolItems = computed(() => [
      ...toItems(byCategory.tool),
      ...toItems(PENDING_MODULES)
    ]);
    const launcherItems = computed(() => toItems(byCategory.launcher));
    const systemItems = computed(
      () => SYSTEM_PAGES.map((p) => ({
        key: p.id,
        label: p.label,
        icon: p.icon,
        path: p.path,
        routeName: p.routeName
      }))
    );
    const groups = computed(() => [
      { id: "tools", label: "工具", items: toolItems.value },
      { id: "launcher", label: "启动器", items: launcherItems.value },
      { id: "system", label: "系统", items: systemItems.value }
    ]);
    const isActive = (item) => item.routeName ? String(route.name || "") === item.routeName : route.path === item.path;
    const navigate = (item) => {
      if (item.moduleId) void window.api.usage.recordUse(item.moduleId);
      router.push(item.path);
    };
    function openLauncher() {
      void window.api.launcher.show?.();
    }
    const __returned__ = { route, router, EXPAND_KEY, expanded, toggleExpanded, byCategory, toItems, toolItems, launcherItems, systemItems, groups, isActive, navigate, openLauncher, AppIcon, UTooltip };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, createVNode as _createVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createElementVNode as _createElementVNode, withCtx as _withCtx, renderList as _renderList, Fragment as _Fragment, toDisplayString as _toDisplayString, normalizeClass as _normalizeClass, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = { class: "px-2 pt-3" };
const _hoisted_2 = {
  key: 0,
  class: "whitespace-nowrap text-sm font-medium"
};
const _hoisted_3 = {
  key: 1,
  class: "ml-auto text-[10px] opacity-70"
};
const _hoisted_4 = { class: "flex flex-col gap-0.5 px-2 pt-2" };
const _hoisted_5 = {
  key: 0,
  class: "whitespace-nowrap text-sm font-medium"
};
const _hoisted_6 = { class: "flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3" };
const _hoisted_7 = {
  key: 0,
  class: "mb-1 mt-3 flex items-center gap-2 px-3 first:mt-0"
};
const _hoisted_8 = { class: "text-[10px] font-medium tracking-wider text-fg-muted uppercase" };
const _hoisted_9 = {
  key: 1,
  class: "mx-3 my-2 h-px bg-line-subtle"
};
const _hoisted_10 = ["onClick"];
const _hoisted_11 = {
  key: 0,
  class: "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-500"
};
const _hoisted_12 = {
  key: 1,
  class: "whitespace-nowrap text-sm font-medium"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock(
    _Fragment,
    null,
    [
      _createCommentVNode(" 玻璃浮层式侧栏：flex 容器内自适应高度，\n       依赖 --shell-topbar-h / --shell-sidebar-w token（替代魔法数字，BUGS.md B14） "),
      _createElementVNode(
        "aside",
        {
          class: _normalizeClass(["LeafSidebar sticky z-20 flex h-[calc(100vh-var(--shell-topbar-h))] shrink-0 flex-col overflow-hidden border-r border-line-subtle bg-glass-bg backdrop-blur-[var(--glass-blur)] transition-[width] duration-spring ease-out", $setup.expanded ? "w-[var(--shell-sidebar-w-expanded)]" : "w-[var(--shell-sidebar-w)]"]),
          style: { top: "var(--shell-topbar-h)" }
        },
        [
          _createCommentVNode(" 唤起启动器（核心入口） "),
          _createElementVNode("div", _hoisted_1, [
            _createElementVNode("button", {
              type: "button",
              class: "flex h-11 w-full items-center gap-3 rounded-md bg-gradient-to-r from-brand-500 to-brand-600 px-3 text-left text-white shadow-sm transition-all duration-fast hover:shadow-md hover:brightness-110 focus-visible:shadow-ring-focus focus-visible:outline-none",
              onClick: $setup.openLauncher
            }, [
              _createVNode($setup["AppIcon"], {
                icon: "search-eye",
                size: 20,
                class: "shrink-0"
              }),
              $setup.expanded ? (_openBlock(), _createElementBlock("span", _hoisted_2, "唤起启动器")) : _createCommentVNode("v-if", true),
              $setup.expanded ? (_openBlock(), _createElementBlock("span", _hoisted_3, "⌥Space")) : _createCommentVNode("v-if", true)
            ])
          ]),
          _createCommentVNode(" 折叠 / 展开开关 "),
          _createElementVNode("div", _hoisted_4, [
            _createVNode($setup["UTooltip"], {
              content: $setup.expanded ? "收起侧栏" : "展开侧栏",
              position: "right",
              disabled: $setup.expanded
            }, {
              default: _withCtx(() => [
                _createElementVNode("button", {
                  type: "button",
                  class: "flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-fg-tertiary transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary focus-visible:shadow-ring-focus focus-visible:outline-none",
                  onClick: $setup.toggleExpanded
                }, [
                  _createVNode($setup["AppIcon"], {
                    icon: $setup.expanded ? "ri-menu-fold-line" : "ri-menu-unfold-line",
                    size: 21,
                    class: "shrink-0"
                  }, null, 8, ["icon"]),
                  $setup.expanded ? (_openBlock(), _createElementBlock("span", _hoisted_5, "收起侧栏")) : _createCommentVNode("v-if", true)
                ])
              ]),
              _: 1
              /* STABLE */
            }, 8, ["content", "disabled"])
          ]),
          _createCommentVNode(" 三分组导航（IA v2：工具 / 启动器 / 系统） "),
          _createElementVNode("nav", _hoisted_6, [
            (_openBlock(true), _createElementBlock(
              _Fragment,
              null,
              _renderList($setup.groups, (group, gi) => {
                return _openBlock(), _createElementBlock(
                  _Fragment,
                  {
                    key: group.id
                  },
                  [
                    _createCommentVNode(" 展开态：组标签；折叠态：组间分隔线 "),
                    $setup.expanded && group.items.length > 0 ? (_openBlock(), _createElementBlock("div", _hoisted_7, [
                      _createElementVNode(
                        "span",
                        _hoisted_8,
                        _toDisplayString(group.label),
                        1
                        /* TEXT */
                      ),
                      _cache[0] || (_cache[0] = _createElementVNode(
                        "div",
                        { class: "h-px flex-1 bg-line-subtle" },
                        null,
                        -1
                        /* CACHED */
                      ))
                    ])) : !$setup.expanded && gi > 0 && group.items.length > 0 ? (_openBlock(), _createElementBlock("div", _hoisted_9)) : _createCommentVNode("v-if", true),
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(group.items, (item) => {
                        return _openBlock(), _createBlock($setup["UTooltip"], {
                          key: item.key,
                          content: item.label,
                          position: "right",
                          disabled: $setup.expanded
                        }, {
                          default: _withCtx(() => [
                            _createElementVNode("button", {
                              type: "button",
                              class: _normalizeClass([
                                "group relative flex h-11 w-full items-center gap-3 rounded-md px-3 text-left transition-colors duration-fast focus-visible:shadow-ring-focus focus-visible:outline-none",
                                $setup.isActive(item) ? "bg-brand-500/10 text-fg-brand" : "text-fg-secondary hover:bg-surface-hover hover:text-fg-primary"
                              ]),
                              onClick: ($event) => $setup.navigate(item)
                            }, [
                              _createCommentVNode(" active 指示条 "),
                              $setup.isActive(item) ? (_openBlock(), _createElementBlock("span", _hoisted_11)) : _createCommentVNode("v-if", true),
                              _createVNode($setup["AppIcon"], {
                                icon: item.icon,
                                size: 21,
                                class: "shrink-0"
                              }, null, 8, ["icon"]),
                              $setup.expanded ? (_openBlock(), _createElementBlock(
                                "span",
                                _hoisted_12,
                                _toDisplayString(item.label),
                                1
                                /* TEXT */
                              )) : _createCommentVNode("v-if", true)
                            ], 10, _hoisted_10)
                          ]),
                          _: 2
                          /* DYNAMIC */
                        }, 1032, ["content", "disabled"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ],
                  64
                  /* STABLE_FRAGMENT */
                );
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ],
        2
        /* CLASS */
      )
    ],
    2112
    /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
  );
}
_sfc_main.__hmrId = "a71aa166";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/components/shell/Sidebar.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QUNWLFNBQVMsS0FBSztBQUFBLDBCQUNmLFVBQVM7QUFBQSwwQkFDUixVQUFVO0FBQUE7NENBRVgsTUFtQlM7QUFBQSw0QkFuQlQsb0JBbUJTO0FBQUEsOEJBbEJQLE1BQUs7QUFBQSw4QkFDTCxPQUFLO0FBQUEsZ0NBQUM7QUFBQSxnQ0FDaUIsZ0JBQVMsSUFBSTs7OEJBS25DLFNBQUssWUFBRSxnQkFBUyxJQUFJO0FBQUE7OEJBRXJCO0FBQUEsOEJBRVEsZ0JBQVMsSUFBSSxtQkFEckIsb0JBR0UsUUFIRixXQUdFOzhCQUNGLGFBQXlEO0FBQUEsZ0NBQS9DLE1BQU0sS0FBSztBQUFBLGdDQUFPLE1BQU07QUFBQSxnQ0FBSSxPQUFNO0FBQUE7OEJBQ2hDLGlDQUFaO0FBQUEsZ0NBRVM7QUFBQSxnQ0FGVDtBQUFBLGdDQUVTLGlCQURQLEtBQUssS0FBSztBQUFBO0FBQUE7QUFBQSIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiU2lkZWJhci52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IGNvbXB1dGVkLCByZWYgfSBmcm9tICd2dWUnXG5pbXBvcnQgeyB1c2VSb3V0ZSwgdXNlUm91dGVyIH0gZnJvbSAndnVlLXJvdXRlcidcbmltcG9ydCB7XG4gIE1PRFVMRVMsXG4gIFBFTkRJTkdfTU9EVUxFUyxcbiAgZmluZE1vZHVsZUJ5Um91dGUsXG4gIGdldE1vZHVsZXNCeUNhdGVnb3J5LFxuICB0eXBlIE1vZHVsZU1ldGFcbn0gZnJvbSAnLi4vLi4vY29uc3RhbnRzL21vZHVsZXMnXG5pbXBvcnQgeyBTWVNURU1fUEFHRVMgfSBmcm9tICdAc2hhcmVkL2NvbW1hbmRzJ1xuaW1wb3J0IEFwcEljb24gZnJvbSAnQGNvbXBvbmVudHMvQXBwSWNvbi52dWUnXG5pbXBvcnQgVVRvb2x0aXAgZnJvbSAnLi4vdWkvVVRvb2x0aXAudnVlJ1xuXG5jb25zdCByb3V0ZSA9IHVzZVJvdXRlKClcbmNvbnN0IHJvdXRlciA9IHVzZVJvdXRlcigpXG5cbi8qKiDmipjlj6DnirbmgIHvvJrpu5jorqTmlLbotbfvvIznlLHpobbpg6jlm77moIfmjInpkq7miYvliqjliIfmjaLlubbmjIHkuYXljJbvvIh2NO+8muenu+mZpCBob3ZlciDoh6rliqjlsZXlvIDvvIkgKi9cbmNvbnN0IEVYUEFORF9LRVkgPSAnbGVhZi5zaWRlYmFyLWV4cGFuZGVkJ1xuY29uc3QgZXhwYW5kZWQgPSByZWYoXG4gIHR5cGVvZiBsb2NhbFN0b3JhZ2UgIT09ICd1bmRlZmluZWQnICYmIGxvY2FsU3RvcmFnZS5nZXRJdGVtKEVYUEFORF9LRVkpID09PSAnMSdcbilcblxuY29uc3QgdG9nZ2xlRXhwYW5kZWQgPSAoKTogdm9pZCA9PiB7XG4gIGV4cGFuZGVkLnZhbHVlID0gIWV4cGFuZGVkLnZhbHVlXG4gIHRyeSB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oRVhQQU5EX0tFWSwgZXhwYW5kZWQudmFsdWUgPyAnMScgOiAnMCcpXG4gIH0gY2F0Y2gge1xuICAgIC8qIOmakOengeaooeW8j+etieWcuuaZr+S4i+W/veeVpeaMgeS5heWMluWksei0pSAqL1xuICB9XG59XG5cbi8qKiDkvqfovrnmoI/mnaHnm67vvIhJQSB2MiDkuInliIbnu4TvvJrlt6XlhbcgLyDlkK/liqjlmaggLyDns7vnu5/vvIkgKi9cbmludGVyZmFjZSBTaWRlYmFySXRlbSB7XG4gIGtleTogc3RyaW5nXG4gIGxhYmVsOiBzdHJpbmdcbiAgaWNvbjogc3RyaW5nXG4gIHBhdGg6IHN0cmluZ1xuICAvKiog5ZG95Lit6Lev55Sx5ZCN5oiW6Lev5b6E55qE5Yik5a6a5L6d5o2uICovXG4gIHJvdXRlTmFtZTogc3RyaW5nXG4gIC8qKiDmqKHlnZfnsbvmnaHnm67ot7Povazml7borrDlvZXkvb/nlKjvvIh1c2FnZSDlj6rorqTmqKHlnZcgaWTvvJvns7vnu5/pobXkuI3orrDlvZXvvIkgKi9cbiAgbW9kdWxlSWQ/OiBzdHJpbmdcbn1cblxuY29uc3QgYnlDYXRlZ29yeSA9IGdldE1vZHVsZXNCeUNhdGVnb3J5KClcblxuY29uc3QgdG9JdGVtcyA9IChtb2RzOiBBcnJheTxNb2R1bGVNZXRhIHwgKHR5cGVvZiBQRU5ESU5HX01PRFVMRVMpW251bWJlcl0+KTogU2lkZWJhckl0ZW1bXSA9PlxuICBtb2RzLm1hcCgobSkgPT4gKHtcbiAgICBrZXk6IG0uaWQsXG4gICAgbGFiZWw6IG0ubGFiZWwsXG4gICAgaWNvbjogbS5pY29uLFxuICAgIHBhdGg6IG0ucGF0aCxcbiAgICByb3V0ZU5hbWU6IG0ucm91dGVOYW1lLFxuICAgIG1vZHVsZUlkOiBtLmlkXG4gIH0pKVxuXG4vKiog5bel5YW357uE77ya5qih5Z2XICsgUEVORElOR++8iOS7o+eggeeJh+auteaMguW3peWFt+e7hOWwvu+8jERFQ0lTSU9OUy0wMDLvvIkgKi9cbmNvbnN0IHRvb2xJdGVtcyA9IGNvbXB1dGVkPFNpZGViYXJJdGVtW10+KCgpID0+IFtcbiAgLi4udG9JdGVtcyhieUNhdGVnb3J5LnRvb2wpLFxuICAuLi50b0l0ZW1zKFBFTkRJTkdfTU9EVUxFUylcbl0pXG4vKiog5ZCv5Yqo5Zmo57uEICovXG5jb25zdCBsYXVuY2hlckl0ZW1zID0gY29tcHV0ZWQ8U2lkZWJhckl0ZW1bXT4oKCkgPT4gdG9JdGVtcyhieUNhdGVnb3J5LmxhdW5jaGVyKSlcbi8qKiDns7vnu5/nu4TvvJrorr7nva4gLyDmlbDmja7ov4Hnp7sgLyDlhbPkuo7vvIhzaGFyZWQg5rOo5YaM6KGo77yJICovXG5jb25zdCBzeXN0ZW1JdGVtcyA9IGNvbXB1dGVkPFNpZGViYXJJdGVtW10+KCgpID0+XG4gIFNZU1RFTV9QQUdFUy5tYXAoKHApID0+ICh7XG4gICAga2V5OiBwLmlkLFxuICAgIGxhYmVsOiBwLmxhYmVsLFxuICAgIGljb246IHAuaWNvbixcbiAgICBwYXRoOiBwLnBhdGgsXG4gICAgcm91dGVOYW1lOiBwLnJvdXRlTmFtZVxuICB9KSlcbilcblxuY29uc3QgZ3JvdXBzID0gY29tcHV0ZWQ8QXJyYXk8eyBpZDogc3RyaW5nOyBsYWJlbDogc3RyaW5nOyBpdGVtczogU2lkZWJhckl0ZW1bXSB9Pj4oKCkgPT4gW1xuICB7IGlkOiAndG9vbHMnLCBsYWJlbDogJ+W3peWFtycsIGl0ZW1zOiB0b29sSXRlbXMudmFsdWUgfSxcbiAgeyBpZDogJ2xhdW5jaGVyJywgbGFiZWw6ICflkK/liqjlmagnLCBpdGVtczogbGF1bmNoZXJJdGVtcy52YWx1ZSB9LFxuICB7IGlkOiAnc3lzdGVtJywgbGFiZWw6ICfns7vnu58nLCBpdGVtczogc3lzdGVtSXRlbXMudmFsdWUgfVxuXSlcblxuY29uc3QgaXNBY3RpdmUgPSAoaXRlbTogU2lkZWJhckl0ZW0pOiBib29sZWFuID0+XG4gIGl0ZW0ucm91dGVOYW1lID8gU3RyaW5nKHJvdXRlLm5hbWUgfHwgJycpID09PSBpdGVtLnJvdXRlTmFtZSA6IHJvdXRlLnBhdGggPT09IGl0ZW0ucGF0aFxuXG4vKiog5qih5Z2X6Lez6L2s77ya57uf5LiA5Zyo5b2T5YmN56qX5Y+j5YaF6Lev55Sx6Lez6L2s77yM5LiN5YaN5paw5byA56qX5Y+jICovXG5jb25zdCBuYXZpZ2F0ZSA9IChpdGVtOiBTaWRlYmFySXRlbSk6IHZvaWQgPT4ge1xuICBpZiAoaXRlbS5tb2R1bGVJZCkgdm9pZCB3aW5kb3cuYXBpLnVzYWdlLnJlY29yZFVzZShpdGVtLm1vZHVsZUlkKVxuICByb3V0ZXIucHVzaChpdGVtLnBhdGgpXG59XG5cbi8qKiDllKTotbflkK/liqjlmajog7blm4rnqpcgKi9cbmZ1bmN0aW9uIG9wZW5MYXVuY2hlcigpOiB2b2lkIHtcbiAgdm9pZCB3aW5kb3cuYXBpLmxhdW5jaGVyLnNob3c/LigpXG59XG48L3NjcmlwdD5cblxuPHRlbXBsYXRlPlxuICA8IS0tIOeOu+eSg+a1ruWxguW8j+S+p+agj++8mmZsZXgg5a655Zmo5YaF6Ieq6YCC5bqU6auY5bqm77yMXG4gICAgICAg5L6d6LWWIC0tc2hlbGwtdG9wYmFyLWggLyAtLXNoZWxsLXNpZGViYXItdyB0b2tlbu+8iOabv+S7o+mtlOazleaVsOWtl++8jEJVR1MubWQgQjE077yJIC0tPlxuICA8YXNpZGVcbiAgICBjbGFzcz1cIkxlYWZTaWRlYmFyIHN0aWNreSB6LTIwIGZsZXggaC1bY2FsYygxMDB2aC12YXIoLS1zaGVsbC10b3BiYXItaCkpXSBzaHJpbmstMCBmbGV4LWNvbCBvdmVyZmxvdy1oaWRkZW4gYm9yZGVyLXIgYm9yZGVyLWxpbmUtc3VidGxlIGJnLWdsYXNzLWJnIGJhY2tkcm9wLWJsdXItW3ZhcigtLWdsYXNzLWJsdXIpXSB0cmFuc2l0aW9uLVt3aWR0aF0gZHVyYXRpb24tc3ByaW5nIGVhc2Utb3V0XCJcbiAgICA6Y2xhc3M9XCJleHBhbmRlZCA/ICd3LVt2YXIoLS1zaGVsbC1zaWRlYmFyLXctZXhwYW5kZWQpXScgOiAndy1bdmFyKC0tc2hlbGwtc2lkZWJhci13KV0nXCJcbiAgICA6c3R5bGU9XCJ7IHRvcDogJ3ZhcigtLXNoZWxsLXRvcGJhci1oKScgfVwiXG4gID5cbiAgICA8IS0tIOWUpOi1t+WQr+WKqOWZqO+8iOaguOW/g+WFpeWPo++8iSAtLT5cbiAgICA8ZGl2IGNsYXNzPVwicHgtMiBwdC0zXCI+XG4gICAgICA8YnV0dG9uXG4gICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICBjbGFzcz1cImZsZXggaC0xMSB3LWZ1bGwgaXRlbXMtY2VudGVyIGdhcC0zIHJvdW5kZWQtbWQgYmctZ3JhZGllbnQtdG8tciBmcm9tLWJyYW5kLTUwMCB0by1icmFuZC02MDAgcHgtMyB0ZXh0LWxlZnQgdGV4dC13aGl0ZSBzaGFkb3ctc20gdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tZmFzdCBob3ZlcjpzaGFkb3ctbWQgaG92ZXI6YnJpZ2h0bmVzcy0xMTAgZm9jdXMtdmlzaWJsZTpzaGFkb3ctcmluZy1mb2N1cyBmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZVwiXG4gICAgICAgIEBjbGljaz1cIm9wZW5MYXVuY2hlclwiXG4gICAgICA+XG4gICAgICAgIDxBcHBJY29uIGljb249XCJzZWFyY2gtZXllXCIgOnNpemU9XCIyMFwiIGNsYXNzPVwic2hyaW5rLTBcIiAvPlxuICAgICAgICA8c3BhbiB2LWlmPVwiZXhwYW5kZWRcIiBjbGFzcz1cIndoaXRlc3BhY2Utbm93cmFwIHRleHQtc20gZm9udC1tZWRpdW1cIj7llKTotbflkK/liqjlmag8L3NwYW4+XG4gICAgICAgIDxzcGFuIHYtaWY9XCJleHBhbmRlZFwiIGNsYXNzPVwibWwtYXV0byB0ZXh0LVsxMHB4XSBvcGFjaXR5LTcwXCI+4oylU3BhY2U8L3NwYW4+XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cblxuICAgIDwhLS0g5oqY5Y+gIC8g5bGV5byA5byA5YWzIC0tPlxuICAgIDxkaXYgY2xhc3M9XCJmbGV4IGZsZXgtY29sIGdhcC0wLjUgcHgtMiBwdC0yXCI+XG4gICAgICA8VVRvb2x0aXAgOmNvbnRlbnQ9XCJleHBhbmRlZCA/ICfmlLbotbfkvqfmoI8nIDogJ+WxleW8gOS+p+agjydcIiBwb3NpdGlvbj1cInJpZ2h0XCIgOmRpc2FibGVkPVwiZXhwYW5kZWRcIj5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgIGNsYXNzPVwiZmxleCBoLTExIHctZnVsbCBpdGVtcy1jZW50ZXIgZ2FwLTMgcm91bmRlZC1tZCBweC0zIHRleHQtbGVmdCB0ZXh0LWZnLXRlcnRpYXJ5IHRyYW5zaXRpb24tY29sb3JzIGR1cmF0aW9uLWZhc3QgaG92ZXI6Ymctc3VyZmFjZS1ob3ZlciBob3Zlcjp0ZXh0LWZnLXByaW1hcnkgZm9jdXMtdmlzaWJsZTpzaGFkb3ctcmluZy1mb2N1cyBmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZVwiXG4gICAgICAgICAgQGNsaWNrPVwidG9nZ2xlRXhwYW5kZWRcIlxuICAgICAgICA+XG4gICAgICAgICAgPEFwcEljb25cbiAgICAgICAgICAgIDppY29uPVwiZXhwYW5kZWQgPyAncmktbWVudS1mb2xkLWxpbmUnIDogJ3JpLW1lbnUtdW5mb2xkLWxpbmUnXCJcbiAgICAgICAgICAgIDpzaXplPVwiMjFcIlxuICAgICAgICAgICAgY2xhc3M9XCJzaHJpbmstMFwiXG4gICAgICAgICAgLz5cbiAgICAgICAgICA8c3BhbiB2LWlmPVwiZXhwYW5kZWRcIiBjbGFzcz1cIndoaXRlc3BhY2Utbm93cmFwIHRleHQtc20gZm9udC1tZWRpdW1cIj7mlLbotbfkvqfmoI88L3NwYW4+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9VVG9vbHRpcD5cbiAgICA8L2Rpdj5cblxuICAgIDwhLS0g5LiJ5YiG57uE5a+86Iiq77yISUEgdjLvvJrlt6XlhbcgLyDlkK/liqjlmaggLyDns7vnu5/vvIkgLS0+XG4gICAgPG5hdiBjbGFzcz1cImZsZXggZmxleC0xIGZsZXgtY29sIGdhcC0wLjUgb3ZlcmZsb3cteS1hdXRvIHB4LTIgcHktM1wiPlxuICAgICAgPHRlbXBsYXRlIHYtZm9yPVwiKGdyb3VwLCBnaSkgaW4gZ3JvdXBzXCIgOmtleT1cImdyb3VwLmlkXCI+XG4gICAgICAgIDwhLS0g5bGV5byA5oCB77ya57uE5qCH562+77yb5oqY5Y+g5oCB77ya57uE6Ze05YiG6ZqU57q/IC0tPlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgdi1pZj1cImV4cGFuZGVkICYmIGdyb3VwLml0ZW1zLmxlbmd0aCA+IDBcIlxuICAgICAgICAgIGNsYXNzPVwibWItMSBtdC0zIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHB4LTMgZmlyc3Q6bXQtMFwiXG4gICAgICAgID5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cInRleHQtWzEwcHhdIGZvbnQtbWVkaXVtIHRyYWNraW5nLXdpZGVyIHRleHQtZmctbXV0ZWQgdXBwZXJjYXNlXCI+e3tcbiAgICAgICAgICAgIGdyb3VwLmxhYmVsXG4gICAgICAgICAgfX08L3NwYW4+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImgtcHggZmxleC0xIGJnLWxpbmUtc3VidGxlXCIgLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICB2LWVsc2UtaWY9XCIhZXhwYW5kZWQgJiYgZ2kgPiAwICYmIGdyb3VwLml0ZW1zLmxlbmd0aCA+IDBcIlxuICAgICAgICAgIGNsYXNzPVwibXgtMyBteS0yIGgtcHggYmctbGluZS1zdWJ0bGVcIlxuICAgICAgICAvPlxuXG4gICAgICAgIDxVVG9vbHRpcFxuICAgICAgICAgIHYtZm9yPVwiaXRlbSBpbiBncm91cC5pdGVtc1wiXG4gICAgICAgICAgOmtleT1cIml0ZW0ua2V5XCJcbiAgICAgICAgICA6Y29udGVudD1cIml0ZW0ubGFiZWxcIlxuICAgICAgICAgIHBvc2l0aW9uPVwicmlnaHRcIlxuICAgICAgICAgIDpkaXNhYmxlZD1cImV4cGFuZGVkXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgY2xhc3M9XCJncm91cCByZWxhdGl2ZSBmbGV4IGgtMTEgdy1mdWxsIGl0ZW1zLWNlbnRlciBnYXAtMyByb3VuZGVkLW1kIHB4LTMgdGV4dC1sZWZ0IHRyYW5zaXRpb24tY29sb3JzIGR1cmF0aW9uLWZhc3QgZm9jdXMtdmlzaWJsZTpzaGFkb3ctcmluZy1mb2N1cyBmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZVwiXG4gICAgICAgICAgICA6Y2xhc3M9XCJcbiAgICAgICAgICAgICAgaXNBY3RpdmUoaXRlbSlcbiAgICAgICAgICAgICAgICA/ICdiZy1icmFuZC01MDAvMTAgdGV4dC1mZy1icmFuZCdcbiAgICAgICAgICAgICAgICA6ICd0ZXh0LWZnLXNlY29uZGFyeSBob3ZlcjpiZy1zdXJmYWNlLWhvdmVyIGhvdmVyOnRleHQtZmctcHJpbWFyeSdcbiAgICAgICAgICAgIFwiXG4gICAgICAgICAgICBAY2xpY2s9XCJuYXZpZ2F0ZShpdGVtKVwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPCEtLSBhY3RpdmUg5oyH56S65p2hIC0tPlxuICAgICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgICAgdi1pZj1cImlzQWN0aXZlKGl0ZW0pXCJcbiAgICAgICAgICAgICAgY2xhc3M9XCJhYnNvbHV0ZSBsZWZ0LTAgdG9wLTEvMiBoLTUgdy0wLjUgLXRyYW5zbGF0ZS15LTEvMiByb3VuZGVkLXItZnVsbCBiZy1icmFuZC01MDBcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDxBcHBJY29uIDppY29uPVwiaXRlbS5pY29uXCIgOnNpemU9XCIyMVwiIGNsYXNzPVwic2hyaW5rLTBcIiAvPlxuICAgICAgICAgICAgPHNwYW4gdi1pZj1cImV4cGFuZGVkXCIgY2xhc3M9XCJ3aGl0ZXNwYWNlLW5vd3JhcCB0ZXh0LXNtIGZvbnQtbWVkaXVtXCI+e3tcbiAgICAgICAgICAgICAgaXRlbS5sYWJlbFxuICAgICAgICAgICAgfX08L3NwYW4+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvVVRvb2x0aXA+XG4gICAgICA8L3RlbXBsYXRlPlxuICAgIDwvbmF2PlxuICA8L2FzaWRlPlxuPC90ZW1wbGF0ZT5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvY29tcG9uZW50cy9zaGVsbC9TaWRlYmFyLnZ1ZSJ9