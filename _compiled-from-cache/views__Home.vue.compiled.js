import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/Home.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { computed, onMounted, ref } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useRouter } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue-router.js?v=c8635d8b";
import {
  getModulesByGroup,
  findModule
} from "/src/constants/modules.ts";
import AppIcon from "/src/components/AppIcon.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "Home",
  setup(__props, { expose: __expose }) {
    __expose();
    const router = useRouter();
    const searchQuery = ref("");
    const searchInput = ref(null);
    function openLauncher() {
      void window.api.launcher.show?.();
    }
    function onSearchFocus() {
      openLauncher();
      searchQuery.value = "";
      searchInput.value?.blur();
    }
    const groups = computed(() => getModulesByGroup());
    const navigate = (m) => {
      void window.api.usage.recordUse(m.id);
      router.push(m.path);
    };
    const quickActions = [
      { label: "截图", icon: "camera-line", path: "/screenshot" },
      { label: "录屏", icon: "video-line", path: "/screenRecorder/record" },
      { label: "番茄钟", icon: "timer-line", path: "/pomodoro" },
      { label: "代码片段", icon: "code-s-slash-line", path: "/snippets" },
      { label: "剪贴板", icon: "clipboard-line", action: "clipboard" },
      { label: "文件搜索", icon: "search-2-line", action: "files" },
      { label: "AI 对话", icon: "sparkling-2-line", action: "ai" },
      { label: "笔记", icon: "sticky-note-line", action: "notes" }
    ];
    function onQuickAction(action) {
      if (action.path) {
        router.push(action.path);
      } else if (action.action) {
        void window.api.launcher.show?.();
        setTimeout(() => {
          window.api.launcher.openFirstParty?.(action.action);
        }, 200);
      }
    }
    const recent = ref([]);
    const refresh = async () => {
      const recentIds = await window.api.usage.getRecent(6);
      recent.value = recentIds.map((id) => findModule(id)).filter((m) => !!m);
    };
    onMounted(() => {
      void refresh();
    });
    const __returned__ = { router, searchQuery, searchInput, openLauncher, onSearchFocus, groups, navigate, quickActions, onQuickAction, recent, refresh, AppIcon };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, createVNode as _createVNode, createElementVNode as _createElementVNode, vModelText as _vModelText, withDirectives as _withDirectives, createTextVNode as _createTextVNode, renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, toDisplayString as _toDisplayString } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = { class: "LeafRaycastHome min-h-screen flex flex-col items-center justify-center px-6 py-12" };
const _hoisted_2 = { class: "mb-8 text-center" };
const _hoisted_3 = { class: "mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/25" };
const _hoisted_4 = { class: "relative w-full max-w-[560px] mb-10" };
const _hoisted_5 = { class: "flex items-center gap-3 rounded-xl border border-line-default bg-surface-1 px-4 py-3.5 shadow-lg shadow-black/5 transition-all hover:border-brand-500/40 hover:shadow-xl focus-within:border-brand-500 focus-within:shadow-ring-focus" };
const _hoisted_6 = { class: "w-full max-w-[560px] mb-8" };
const _hoisted_7 = { class: "grid grid-cols-4 gap-2" };
const _hoisted_8 = ["onClick"];
const _hoisted_9 = { class: "flex size-10 items-center justify-center rounded-lg bg-surface-2 text-fg-tertiary transition-all group-hover:bg-brand-500/10 group-hover:text-fg-brand" };
const _hoisted_10 = { class: "text-xs font-medium text-fg-secondary group-hover:text-fg-primary" };
const _hoisted_11 = {
  key: 0,
  class: "w-full max-w-[560px] mb-8"
};
const _hoisted_12 = { class: "flex flex-wrap gap-2" };
const _hoisted_13 = ["onClick"];
const _hoisted_14 = { class: "flex items-center gap-4 text-xs text-fg-tertiary" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    _createCommentVNode(" ═══ Logo + 标题 ═══ "),
    _createElementVNode("div", _hoisted_2, [
      _createElementVNode("div", _hoisted_3, [
        _createVNode($setup["AppIcon"], {
          icon: "search-eye",
          size: 28,
          class: "text-white"
        })
      ]),
      _cache[4] || (_cache[4] = _createElementVNode(
        "h1",
        { class: "text-[28px] font-semibold tracking-tight text-fg-primary" },
        "Leaf",
        -1
        /* CACHED */
      )),
      _cache[5] || (_cache[5] = _createElementVNode(
        "p",
        { class: "mt-1 text-sm text-fg-muted" },
        "你的全能启动器 · 所有功能一键直达",
        -1
        /* CACHED */
      ))
    ]),
    _createCommentVNode(" ═══ 大搜索框（Raycast Root Search 风格）═══ "),
    _createElementVNode("div", _hoisted_4, [
      _createElementVNode("div", _hoisted_5, [
        _createVNode($setup["AppIcon"], {
          icon: "search",
          size: 18,
          class: "shrink-0 text-fg-tertiary"
        }),
        _withDirectives(_createElementVNode(
          "input",
          {
            ref: "searchInput",
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.searchQuery = $event),
            type: "text",
            class: "flex-1 bg-transparent text-[15px] text-fg-primary placeholder:text-fg-tertiary focus:outline-none",
            placeholder: "搜索功能、文件、命令…",
            spellcheck: "false",
            onFocus: $setup.onSearchFocus
          },
          null,
          544
          /* NEED_HYDRATION, NEED_PATCH */
        ), [
          [_vModelText, $setup.searchQuery]
        ]),
        _cache[6] || (_cache[6] = _createElementVNode(
          "kbd",
          { class: "hidden shrink-0 rounded-md border border-line-subtle bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg-tertiary sm:inline-block" },
          " Alt Space ",
          -1
          /* CACHED */
        ))
      ]),
      _cache[7] || (_cache[7] = _createElementVNode(
        "p",
        { class: "mt-2 text-center text-xs text-fg-tertiary" },
        [
          _createTextVNode(" 点击搜索框或按 "),
          _createElementVNode("span", { class: "font-medium text-fg-secondary" }, "Alt + Space"),
          _createTextVNode(" 唤起启动器 ")
        ],
        -1
        /* CACHED */
      ))
    ]),
    _createCommentVNode(" ═══ 常用功能 ═══ "),
    _createElementVNode("div", _hoisted_6, [
      _cache[8] || (_cache[8] = _createElementVNode(
        "div",
        { class: "mb-3 flex items-center gap-2" },
        [
          _createElementVNode("h2", { class: "text-xs font-semibold uppercase tracking-wider text-fg-tertiary" }, "常用功能"),
          _createElementVNode("div", { class: "h-px flex-1 bg-line-subtle" })
        ],
        -1
        /* CACHED */
      )),
      _createElementVNode("div", _hoisted_7, [
        (_openBlock(), _createElementBlock(
          _Fragment,
          null,
          _renderList($setup.quickActions, (action) => {
            return _createElementVNode("button", {
              key: action.label,
              type: "button",
              class: "group flex flex-col items-center gap-2 rounded-lg border border-transparent px-3 py-3 transition-all hover:border-line-default hover:bg-surface-1",
              onClick: ($event) => $setup.onQuickAction(action)
            }, [
              _createElementVNode("div", _hoisted_9, [
                _createVNode($setup["AppIcon"], {
                  icon: action.icon,
                  size: 18
                }, null, 8, ["icon"])
              ]),
              _createElementVNode(
                "span",
                _hoisted_10,
                _toDisplayString(action.label),
                1
                /* TEXT */
              )
            ], 8, _hoisted_8);
          }),
          64
          /* STABLE_FRAGMENT */
        ))
      ])
    ]),
    _createCommentVNode(" ═══ 最近使用 ═══ "),
    $setup.recent.length > 0 ? (_openBlock(), _createElementBlock("div", _hoisted_11, [
      _cache[9] || (_cache[9] = _createElementVNode(
        "div",
        { class: "mb-3 flex items-center gap-2" },
        [
          _createElementVNode("h2", { class: "text-xs font-semibold uppercase tracking-wider text-fg-tertiary" }, "最近使用"),
          _createElementVNode("div", { class: "h-px flex-1 bg-line-subtle" })
        ],
        -1
        /* CACHED */
      )),
      _createElementVNode("div", _hoisted_12, [
        (_openBlock(true), _createElementBlock(
          _Fragment,
          null,
          _renderList($setup.recent, (m) => {
            return _openBlock(), _createElementBlock("button", {
              key: `recent-${m.id}`,
              type: "button",
              class: "inline-flex items-center gap-1.5 rounded-full border border-line-subtle bg-surface-1 px-3 py-1.5 text-sm text-fg-secondary transition-all hover:border-brand-500/40 hover:text-fg-brand",
              onClick: ($event) => $setup.navigate(m)
            }, [
              _createVNode($setup["AppIcon"], {
                icon: m.icon,
                size: 14
              }, null, 8, ["icon"]),
              _createElementVNode(
                "span",
                null,
                _toDisplayString(m.label),
                1
                /* TEXT */
              )
            ], 8, _hoisted_13);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])
    ])) : _createCommentVNode("v-if", true),
    _createCommentVNode(" ═══ 底部快捷入口 ═══ "),
    _createElementVNode("div", _hoisted_14, [
      _createElementVNode("button", {
        class: "inline-flex items-center gap-1.5 hover:text-fg-brand",
        onClick: _cache[1] || (_cache[1] = ($event) => $setup.router.push("/settings"))
      }, [
        _createVNode($setup["AppIcon"], {
          icon: "settings-3-line",
          size: 14
        }),
        _cache[10] || (_cache[10] = _createElementVNode(
          "span",
          null,
          "设置",
          -1
          /* CACHED */
        ))
      ]),
      _cache[13] || (_cache[13] = _createElementVNode(
        "span",
        { class: "text-line-subtle" },
        "·",
        -1
        /* CACHED */
      )),
      _createElementVNode("button", {
        class: "inline-flex items-center gap-1.5 hover:text-fg-brand",
        onClick: _cache[2] || (_cache[2] = ($event) => $setup.router.push("/launcher"))
      }, [
        _createVNode($setup["AppIcon"], {
          icon: "plug-2-line",
          size: 14
        }),
        _cache[11] || (_cache[11] = _createElementVNode(
          "span",
          null,
          "插件管理",
          -1
          /* CACHED */
        ))
      ]),
      _cache[14] || (_cache[14] = _createElementVNode(
        "span",
        { class: "text-line-subtle" },
        "·",
        -1
        /* CACHED */
      )),
      _createElementVNode("button", {
        class: "inline-flex items-center gap-1.5 hover:text-fg-brand",
        onClick: _cache[3] || (_cache[3] = ($event) => $setup.router.push("/about"))
      }, [
        _createVNode($setup["AppIcon"], {
          icon: "information-line",
          size: 14
        }),
        _cache[12] || (_cache[12] = _createElementVNode(
          "span",
          null,
          "关于",
          -1
          /* CACHED */
        ))
      ])
    ])
  ]);
}
_sfc_main.__hmrId = "2dc54a20";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/Home.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QUVWO0FBQUEsUUFBdUM7QUFBQSxVQUFqQyxPQUFNLG1CQUFrQjtBQUFBLFFBQUM7QUFBQSxRQUFDO0FBQUE7QUFBQTtBQUFBLE1BQ2hDLG9CQUdTO0FBQUEsUUFIRCxPQUFNO0FBQUEsUUFBd0QsU0FBSyxzQ0FBRSxjQUFPLEtBQUk7QUFBQTtRQUN0RixhQUF5QztBQUFBLFVBQWhDLE1BQUs7QUFBQSxVQUFlLE1BQU07QUFBQTtvQ0FDbkM7QUFBQSxVQUFpQjtBQUFBO0FBQUEsVUFBWDtBQUFBLFVBQUk7QUFBQTtBQUFBO0FBQUE7a0NBRVo7QUFBQSxRQUF1QztBQUFBLFVBQWpDLE9BQU0sbUJBQWtCO0FBQUEsUUFBQztBQUFBLFFBQUM7QUFBQTtBQUFBO0FBQUEsTUFDaEMsb0JBR1M7QUFBQSxRQUhELE9BQU07QUFBQSxRQUF3RCxTQUFLLHNDQUFFLGNBQU8sS0FBSTtBQUFBO1FBQ3RGLGFBQThDO0FBQUEsVUFBckMsTUFBSztBQUFBLFVBQW9CLE1BQU07QUFBQTtvQ0FDeEM7QUFBQSxVQUFlO0FBQUE7QUFBQSxVQUFUO0FBQUEsVUFBRTtBQUFBO0FBQUE7QUFBQSIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiSG9tZS52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IGNvbXB1dGVkLCBvbk1vdW50ZWQsIHJlZiB9IGZyb20gJ3Z1ZSdcbmltcG9ydCB7IHVzZVJvdXRlciB9IGZyb20gJ3Z1ZS1yb3V0ZXInXG5pbXBvcnQge1xuICBnZXRNb2R1bGVzQnlHcm91cCxcbiAgZmluZE1vZHVsZSxcbiAgdHlwZSBNb2R1bGVNZXRhXG59IGZyb20gJy4uL2NvbnN0YW50cy9tb2R1bGVzJ1xuaW1wb3J0IEFwcEljb24gZnJvbSAnQGNvbXBvbmVudHMvQXBwSWNvbi52dWUnXG5cbmNvbnN0IHJvdXRlciA9IHVzZVJvdXRlcigpXG5jb25zdCBzZWFyY2hRdWVyeSA9IHJlZignJylcbmNvbnN0IHNlYXJjaElucHV0ID0gcmVmPEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsPihudWxsKVxuXG4vKiog5ZSk6LW35ZCv5Yqo5Zmo6IO25ZuK56qXICovXG5mdW5jdGlvbiBvcGVuTGF1bmNoZXIoKTogdm9pZCB7XG4gIHZvaWQgd2luZG93LmFwaS5sYXVuY2hlci5zaG93Py4oKVxufVxuXG4vKiog5pCc57Si5qGG6IGa54Sm5pe25ZSk6LW35ZCv5Yqo5Zmo77yIUmF5Y2FzdCDpo47moLzvvJrmkJzntKLljbPlhaXlj6PvvIkgKi9cbmZ1bmN0aW9uIG9uU2VhcmNoRm9jdXMoKTogdm9pZCB7XG4gIG9wZW5MYXVuY2hlcigpXG4gIHNlYXJjaFF1ZXJ5LnZhbHVlID0gJydcbiAgc2VhcmNoSW5wdXQudmFsdWU/LmJsdXIoKVxufVxuXG5jb25zdCBncm91cHMgPSBjb21wdXRlZCgoKSA9PiBnZXRNb2R1bGVzQnlHcm91cCgpKVxuXG5jb25zdCBuYXZpZ2F0ZSA9IChtOiBNb2R1bGVNZXRhKTogdm9pZCA9PiB7XG4gIHZvaWQgd2luZG93LmFwaS51c2FnZS5yZWNvcmRVc2UobS5pZClcbiAgcm91dGVyLnB1c2gobS5wYXRoKVxufVxuXG4vLyDluLjnlKjlip/og73vvIjlm7rlrprlsZXnpLrvvIlcbmNvbnN0IHF1aWNrQWN0aW9ucyA9IFtcbiAgeyBsYWJlbDogJ+aIquWbvicsIGljb246ICdjYW1lcmEtbGluZScsIHBhdGg6ICcvc2NyZWVuc2hvdCcgfSxcbiAgeyBsYWJlbDogJ+W9leWxjycsIGljb246ICd2aWRlby1saW5lJywgcGF0aDogJy9zY3JlZW5SZWNvcmRlci9yZWNvcmQnIH0sXG4gIHsgbGFiZWw6ICfnlarojITpkp8nLCBpY29uOiAndGltZXItbGluZScsIHBhdGg6ICcvcG9tb2Rvcm8nIH0sXG4gIHsgbGFiZWw6ICfku6PnoIHniYfmrrUnLCBpY29uOiAnY29kZS1zLXNsYXNoLWxpbmUnLCBwYXRoOiAnL3NuaXBwZXRzJyB9LFxuICB7IGxhYmVsOiAn5Ymq6LS05p2/JywgaWNvbjogJ2NsaXBib2FyZC1saW5lJywgYWN0aW9uOiAnY2xpcGJvYXJkJyB9LFxuICB7IGxhYmVsOiAn5paH5Lu25pCc57SiJywgaWNvbjogJ3NlYXJjaC0yLWxpbmUnLCBhY3Rpb246ICdmaWxlcycgfSxcbiAgeyBsYWJlbDogJ0FJIOWvueivnScsIGljb246ICdzcGFya2xpbmctMi1saW5lJywgYWN0aW9uOiAnYWknIH0sXG4gIHsgbGFiZWw6ICfnrJTorrAnLCBpY29uOiAnc3RpY2t5LW5vdGUtbGluZScsIGFjdGlvbjogJ25vdGVzJyB9XG5dXG5cbmZ1bmN0aW9uIG9uUXVpY2tBY3Rpb24oYWN0aW9uOiB7IHBhdGg/OiBzdHJpbmc7IGFjdGlvbj86IHN0cmluZyB9KTogdm9pZCB7XG4gIGlmIChhY3Rpb24ucGF0aCkge1xuICAgIHJvdXRlci5wdXNoKGFjdGlvbi5wYXRoKVxuICB9IGVsc2UgaWYgKGFjdGlvbi5hY3Rpb24pIHtcbiAgICAvLyDllKTotbflkK/liqjlmajlubbmiZPlvIDlr7nlupTpobXpnaJcbiAgICB2b2lkIHdpbmRvdy5hcGkubGF1bmNoZXIuc2hvdz8uKClcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHdpbmRvdy5hcGkubGF1bmNoZXIub3BlbkZpcnN0UGFydHk/LihhY3Rpb24uYWN0aW9uIGFzIGFueSlcbiAgICB9LCAyMDApXG4gIH1cbn1cblxuLy8gLS0tLS0g5pyA6L+R5L2/55SoIC0tLS0tXG5jb25zdCByZWNlbnQgPSByZWY8TW9kdWxlTWV0YVtdPihbXSlcblxuY29uc3QgcmVmcmVzaCA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgcmVjZW50SWRzID0gYXdhaXQgd2luZG93LmFwaS51c2FnZS5nZXRSZWNlbnQoNilcbiAgcmVjZW50LnZhbHVlID0gcmVjZW50SWRzLm1hcCgoaWQpID0+IGZpbmRNb2R1bGUoaWQpKS5maWx0ZXIoKG0pOiBtIGlzIE1vZHVsZU1ldGEgPT4gISFtKVxufVxuXG5vbk1vdW50ZWQoKCkgPT4ge1xuICB2b2lkIHJlZnJlc2goKVxufSlcbjwvc2NyaXB0PlxuXG48dGVtcGxhdGU+XG4gIDxkaXYgY2xhc3M9XCJMZWFmUmF5Y2FzdEhvbWUgbWluLWgtc2NyZWVuIGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHB4LTYgcHktMTJcIj5cbiAgICA8IS0tIOKVkOKVkOKVkCBMb2dvICsg5qCH6aKYIOKVkOKVkOKVkCAtLT5cbiAgICA8ZGl2IGNsYXNzPVwibWItOCB0ZXh0LWNlbnRlclwiPlxuICAgICAgPGRpdiBjbGFzcz1cIm1iLTQgaW5saW5lLWZsZXggc2l6ZS0xNCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC0yeGwgYmctZ3JhZGllbnQtdG8tYnIgZnJvbS1icmFuZC01MDAgdG8tYnJhbmQtNjAwIHNoYWRvdy1sZyBzaGFkb3ctYnJhbmQtNTAwLzI1XCI+XG4gICAgICAgIDxBcHBJY29uIGljb249XCJzZWFyY2gtZXllXCIgOnNpemU9XCIyOFwiIGNsYXNzPVwidGV4dC13aGl0ZVwiIC8+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxoMSBjbGFzcz1cInRleHQtWzI4cHhdIGZvbnQtc2VtaWJvbGQgdHJhY2tpbmctdGlnaHQgdGV4dC1mZy1wcmltYXJ5XCI+TGVhZjwvaDE+XG4gICAgICA8cCBjbGFzcz1cIm10LTEgdGV4dC1zbSB0ZXh0LWZnLW11dGVkXCI+5L2g55qE5YWo6IO95ZCv5Yqo5ZmoIMK3IOaJgOacieWKn+iDveS4gOmUruebtOi+vjwvcD5cbiAgICA8L2Rpdj5cblxuICAgIDwhLS0g4pWQ4pWQ4pWQIOWkp+aQnOe0ouahhu+8iFJheWNhc3QgUm9vdCBTZWFyY2gg6aOO5qC877yJ4pWQ4pWQ4pWQIC0tPlxuICAgIDxkaXYgY2xhc3M9XCJyZWxhdGl2ZSB3LWZ1bGwgbWF4LXctWzU2MHB4XSBtYi0xMFwiPlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1saW5lLWRlZmF1bHQgYmctc3VyZmFjZS0xIHB4LTQgcHktMy41IHNoYWRvdy1sZyBzaGFkb3ctYmxhY2svNSB0cmFuc2l0aW9uLWFsbCBob3Zlcjpib3JkZXItYnJhbmQtNTAwLzQwIGhvdmVyOnNoYWRvdy14bCBmb2N1cy13aXRoaW46Ym9yZGVyLWJyYW5kLTUwMCBmb2N1cy13aXRoaW46c2hhZG93LXJpbmctZm9jdXNcIlxuICAgICAgPlxuICAgICAgICA8QXBwSWNvbiBpY29uPVwic2VhcmNoXCIgOnNpemU9XCIxOFwiIGNsYXNzPVwic2hyaW5rLTAgdGV4dC1mZy10ZXJ0aWFyeVwiIC8+XG4gICAgICAgIDxpbnB1dFxuICAgICAgICAgIHJlZj1cInNlYXJjaElucHV0XCJcbiAgICAgICAgICB2LW1vZGVsPVwic2VhcmNoUXVlcnlcIlxuICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgICBjbGFzcz1cImZsZXgtMSBiZy10cmFuc3BhcmVudCB0ZXh0LVsxNXB4XSB0ZXh0LWZnLXByaW1hcnkgcGxhY2Vob2xkZXI6dGV4dC1mZy10ZXJ0aWFyeSBmb2N1czpvdXRsaW5lLW5vbmVcIlxuICAgICAgICAgIHBsYWNlaG9sZGVyPVwi5pCc57Si5Yqf6IO944CB5paH5Lu244CB5ZG95Luk4oCmXCJcbiAgICAgICAgICBzcGVsbGNoZWNrPVwiZmFsc2VcIlxuICAgICAgICAgIEBmb2N1cz1cIm9uU2VhcmNoRm9jdXNcIlxuICAgICAgICAvPlxuICAgICAgICA8a2JkIGNsYXNzPVwiaGlkZGVuIHNocmluay0wIHJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci1saW5lLXN1YnRsZSBiZy1zdXJmYWNlLTIgcHgtMiBweS0xIGZvbnQtbW9ubyB0ZXh0LVsxMXB4XSB0ZXh0LWZnLXRlcnRpYXJ5IHNtOmlubGluZS1ibG9ja1wiPlxuICAgICAgICAgIEFsdCBTcGFjZVxuICAgICAgICA8L2tiZD5cbiAgICAgIDwvZGl2PlxuICAgICAgPHAgY2xhc3M9XCJtdC0yIHRleHQtY2VudGVyIHRleHQteHMgdGV4dC1mZy10ZXJ0aWFyeVwiPlxuICAgICAgICDngrnlh7vmkJzntKLmoYbmiJbmjIkgPHNwYW4gY2xhc3M9XCJmb250LW1lZGl1bSB0ZXh0LWZnLXNlY29uZGFyeVwiPkFsdCArIFNwYWNlPC9zcGFuPiDllKTotbflkK/liqjlmahcbiAgICAgIDwvcD5cbiAgICA8L2Rpdj5cblxuICAgIDwhLS0g4pWQ4pWQ4pWQIOW4uOeUqOWKn+iDvSDilZDilZDilZAgLS0+XG4gICAgPGRpdiBjbGFzcz1cInctZnVsbCBtYXgtdy1bNTYwcHhdIG1iLThcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYi0zIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgIDxoMiBjbGFzcz1cInRleHQteHMgZm9udC1zZW1pYm9sZCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXIgdGV4dC1mZy10ZXJ0aWFyeVwiPuW4uOeUqOWKn+iDvTwvaDI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJoLXB4IGZsZXgtMSBiZy1saW5lLXN1YnRsZVwiIC8+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJncmlkIGdyaWQtY29scy00IGdhcC0yXCI+XG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICB2LWZvcj1cImFjdGlvbiBpbiBxdWlja0FjdGlvbnNcIlxuICAgICAgICAgIDprZXk9XCJhY3Rpb24ubGFiZWxcIlxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgIGNsYXNzPVwiZ3JvdXAgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIgZ2FwLTIgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXRyYW5zcGFyZW50IHB4LTMgcHktMyB0cmFuc2l0aW9uLWFsbCBob3Zlcjpib3JkZXItbGluZS1kZWZhdWx0IGhvdmVyOmJnLXN1cmZhY2UtMVwiXG4gICAgICAgICAgQGNsaWNrPVwib25RdWlja0FjdGlvbihhY3Rpb24pXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IHNpemUtMTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgYmctc3VyZmFjZS0yIHRleHQtZmctdGVydGlhcnkgdHJhbnNpdGlvbi1hbGwgZ3JvdXAtaG92ZXI6YmctYnJhbmQtNTAwLzEwIGdyb3VwLWhvdmVyOnRleHQtZmctYnJhbmRcIj5cbiAgICAgICAgICAgIDxBcHBJY29uIDppY29uPVwiYWN0aW9uLmljb25cIiA6c2l6ZT1cIjE4XCIgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cInRleHQteHMgZm9udC1tZWRpdW0gdGV4dC1mZy1zZWNvbmRhcnkgZ3JvdXAtaG92ZXI6dGV4dC1mZy1wcmltYXJ5XCI+e3sgYWN0aW9uLmxhYmVsIH19PC9zcGFuPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuXG4gICAgPCEtLSDilZDilZDilZAg5pyA6L+R5L2/55SoIOKVkOKVkOKVkCAtLT5cbiAgICA8ZGl2IHYtaWY9XCJyZWNlbnQubGVuZ3RoID4gMFwiIGNsYXNzPVwidy1mdWxsIG1heC13LVs1NjBweF0gbWItOFwiPlxuICAgICAgPGRpdiBjbGFzcz1cIm1iLTMgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgPGgyIGNsYXNzPVwidGV4dC14cyBmb250LXNlbWlib2xkIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciB0ZXh0LWZnLXRlcnRpYXJ5XCI+5pyA6L+R5L2/55SoPC9oMj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImgtcHggZmxleC0xIGJnLWxpbmUtc3VidGxlXCIgLz5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImZsZXggZmxleC13cmFwIGdhcC0yXCI+XG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICB2LWZvcj1cIm0gaW4gcmVjZW50XCJcbiAgICAgICAgICA6a2V5PVwiYHJlY2VudC0ke20uaWR9YFwiXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgY2xhc3M9XCJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEuNSByb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci1saW5lLXN1YnRsZSBiZy1zdXJmYWNlLTEgcHgtMyBweS0xLjUgdGV4dC1zbSB0ZXh0LWZnLXNlY29uZGFyeSB0cmFuc2l0aW9uLWFsbCBob3Zlcjpib3JkZXItYnJhbmQtNTAwLzQwIGhvdmVyOnRleHQtZmctYnJhbmRcIlxuICAgICAgICAgIEBjbGljaz1cIm5hdmlnYXRlKG0pXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxBcHBJY29uIDppY29uPVwibS5pY29uXCIgOnNpemU9XCIxNFwiIC8+XG4gICAgICAgICAgPHNwYW4+e3sgbS5sYWJlbCB9fTwvc3Bhbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cblxuICAgIDwhLS0g4pWQ4pWQ4pWQIOW6lemDqOW/q+aNt+WFpeWPoyDilZDilZDilZAgLS0+XG4gICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC00IHRleHQteHMgdGV4dC1mZy10ZXJ0aWFyeVwiPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMS41IGhvdmVyOnRleHQtZmctYnJhbmRcIiBAY2xpY2s9XCJyb3V0ZXIucHVzaCgnL3NldHRpbmdzJylcIj5cbiAgICAgICAgPEFwcEljb24gaWNvbj1cInNldHRpbmdzLTMtbGluZVwiIDpzaXplPVwiMTRcIiAvPlxuICAgICAgICA8c3Bhbj7orr7nva48L3NwYW4+XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIDxzcGFuIGNsYXNzPVwidGV4dC1saW5lLXN1YnRsZVwiPsK3PC9zcGFuPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMS41IGhvdmVyOnRleHQtZmctYnJhbmRcIiBAY2xpY2s9XCJyb3V0ZXIucHVzaCgnL2xhdW5jaGVyJylcIj5cbiAgICAgICAgPEFwcEljb24gaWNvbj1cInBsdWctMi1saW5lXCIgOnNpemU9XCIxNFwiIC8+XG4gICAgICAgIDxzcGFuPuaPkuS7tueuoeeQhjwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgPHNwYW4gY2xhc3M9XCJ0ZXh0LWxpbmUtc3VidGxlXCI+wrc8L3NwYW4+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGdhcC0xLjUgaG92ZXI6dGV4dC1mZy1icmFuZFwiIEBjbGljaz1cInJvdXRlci5wdXNoKCcvYWJvdXQnKVwiPlxuICAgICAgICA8QXBwSWNvbiBpY29uPVwiaW5mb3JtYXRpb24tbGluZVwiIDpzaXplPVwiMTRcIiAvPlxuICAgICAgICA8c3Bhbj7lhbPkuo48L3NwYW4+XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+XG48L3RlbXBsYXRlPlxuIl0sImZpbGUiOiIvVXNlcnMveGlhb3llL0Rlc2t0b3AvZWxlY3Ryb24tdG9vbHMvc3JjL3JlbmRlcmVyL3NyYy92aWV3cy9Ib21lLnZ1ZSJ9