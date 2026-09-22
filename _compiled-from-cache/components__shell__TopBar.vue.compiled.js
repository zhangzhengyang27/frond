import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/shell/TopBar.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { computed } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { useRouter } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue-router.js?v=ea0f6108";
import AppIcon from "/src/components/AppIcon.vue";
import UTooltip from "/src/components/ui/UTooltip.vue";
import { useCommandPalette } from "/src/composables/useCommandPalette.ts";
import { useTheme } from "/src/composables/useTheme.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "TopBar",
  setup(__props, { expose: __expose }) {
    __expose();
    const router = useRouter();
    const palette = useCommandPalette();
    const { setTheme } = useTheme();
    const goSettings = () => {
      router.push("/settings").catch(() => {
      });
    };
    const goAbout = () => {
      router.push("/about").catch(() => {
      });
    };
    const openCommandPalette = () => {
      palette.open();
    };
    const isDarkNow = () => document.documentElement.classList.contains("dark");
    const themeIcon = computed(() => isDarkNow() ? "sun-line" : "moon-line");
    const toggleTheme = () => {
      void setTheme(isDarkNow() ? "light" : "dark");
    };
    const __returned__ = { router, palette, setTheme, goSettings, goAbout, openCommandPalette, isDarkNow, themeIcon, toggleTheme, AppIcon, UTooltip };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, createElementVNode as _createElementVNode, createVNode as _createVNode, withCtx as _withCtx, openBlock as _openBlock, createElementBlock as _createElementBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = { class: "LeafTopBar relative z-20 flex h-10 shrink-0 items-center justify-between border-b border-line-subtle bg-glass-bg px-4 backdrop-blur-[var(--glass-blur)]" };
const _hoisted_2 = { class: "flex items-center gap-0.5" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("header", _hoisted_1, [
    _createCommentVNode(" 顶部 1px 内高光 "),
    _cache[2] || (_cache[2] = _createElementVNode(
      "div",
      {
        class: "pointer-events-none absolute inset-x-0 top-0 h-px bg-glass-highlight",
        "aria-hidden": "true"
      },
      null,
      -1
      /* CACHED */
    )),
    _createCommentVNode(" 左：Logo + 名称 "),
    _cache[3] || (_cache[3] = _createElementVNode(
      "div",
      { class: "flex items-center gap-2 select-none" },
      [
        _createElementVNode("span", { class: "text-lg leading-none" }, "🌿"),
        _createElementVNode("span", { class: "text-sm font-semibold text-fg-primary" }, "Leaf")
      ],
      -1
      /* CACHED */
    )),
    _createCommentVNode(" 中：命令面板入口（⌘K）—— 独立浮层，不挤占两侧 "),
    _createElementVNode("button", {
      type: "button",
      class: "group absolute left-1/2 top-1/2 flex h-7 w-72 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-line-default bg-surface-1 px-3 text-xs text-fg-muted shadow-xs transition-all duration-normal hover:border-line-strong hover:shadow-md focus-visible:shadow-ring-focus focus-visible:outline-none",
      onClick: $setup.openCommandPalette
    }, [
      _createVNode($setup["AppIcon"], {
        icon: "search",
        size: 14,
        class: "shrink-0"
      }),
      _cache[0] || (_cache[0] = _createElementVNode(
        "span",
        { class: "flex-1 truncate text-left" },
        "搜索模块、跳转、命令…",
        -1
        /* CACHED */
      )),
      _cache[1] || (_cache[1] = _createElementVNode(
        "kbd",
        { class: "hidden shrink-0 rounded border border-line-subtle bg-surface-hover px-1.5 py-0.5 font-mono text-[10px]" },
        "⌘K",
        -1
        /* CACHED */
      ))
    ]),
    _createCommentVNode(" 右：主题切换 + 设置 + 关于 "),
    _createElementVNode("div", _hoisted_2, [
      _createVNode($setup["UTooltip"], {
        content: "切换主题",
        position: "bottom"
      }, {
        default: _withCtx(() => [
          _createElementVNode("button", {
            type: "button",
            class: "flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-primary focus-visible:shadow-ring-focus focus-visible:outline-none",
            "aria-label": "切换主题",
            onClick: $setup.toggleTheme
          }, [
            _createVNode($setup["AppIcon"], {
              icon: $setup.themeIcon,
              size: 17
            }, null, 8, ["icon"])
          ])
        ]),
        _: 1
        /* STABLE */
      }),
      _createVNode($setup["UTooltip"], {
        content: "设置",
        position: "bottom"
      }, {
        default: _withCtx(() => [
          _createElementVNode("button", {
            type: "button",
            class: "flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-primary focus-visible:shadow-ring-focus focus-visible:outline-none",
            "aria-label": "设置",
            onClick: $setup.goSettings
          }, [
            _createVNode($setup["AppIcon"], {
              icon: "settings-3-line",
              size: 17
            })
          ])
        ]),
        _: 1
        /* STABLE */
      }),
      _createVNode($setup["UTooltip"], {
        content: "关于",
        position: "bottom"
      }, {
        default: _withCtx(() => [
          _createElementVNode("button", {
            type: "button",
            class: "flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-primary focus-visible:shadow-ring-focus focus-visible:outline-none",
            "aria-label": "关于",
            onClick: $setup.goAbout
          }, [
            _createVNode($setup["AppIcon"], {
              icon: "information-line",
              size: 17
            })
          ])
        ]),
        _: 1
        /* STABLE */
      })
    ])
  ]);
}
_sfc_main.__hmrId = "ca8d46d3";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/components/shell/TopBar.vue"]]);

//# sourceMappingURL=data:application/json;base64,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IjpbXSwic291cmNlcyI6WyJUb3BCYXIudnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQgc2V0dXAgbGFuZz1cInRzXCI+XG5pbXBvcnQgeyBjb21wdXRlZCB9IGZyb20gJ3Z1ZSdcbmltcG9ydCB7IHVzZVJvdXRlciB9IGZyb20gJ3Z1ZS1yb3V0ZXInXG5pbXBvcnQgQXBwSWNvbiBmcm9tICdAY29tcG9uZW50cy9BcHBJY29uLnZ1ZSdcbmltcG9ydCBVVG9vbHRpcCBmcm9tICcuLi91aS9VVG9vbHRpcC52dWUnXG5pbXBvcnQgeyB1c2VDb21tYW5kUGFsZXR0ZSB9IGZyb20gJy4uLy4uL2NvbXBvc2FibGVzL3VzZUNvbW1hbmRQYWxldHRlJ1xuaW1wb3J0IHsgdXNlVGhlbWUgfSBmcm9tICcuLi8uLi9jb21wb3NhYmxlcy91c2VUaGVtZSdcblxuY29uc3Qgcm91dGVyID0gdXNlUm91dGVyKClcbmNvbnN0IHBhbGV0dGUgPSB1c2VDb21tYW5kUGFsZXR0ZSgpXG5jb25zdCB7IHNldFRoZW1lIH0gPSB1c2VUaGVtZSgpXG5cbmNvbnN0IGdvU2V0dGluZ3MgPSAoKTogdm9pZCA9PiB7XG4gIHJvdXRlci5wdXNoKCcvc2V0dGluZ3MnKS5jYXRjaCgoKSA9PiB7XG4gICAgLyogaWdub3JlICovXG4gIH0pXG59XG5cbmNvbnN0IGdvQWJvdXQgPSAoKTogdm9pZCA9PiB7XG4gIHJvdXRlci5wdXNoKCcvYWJvdXQnKS5jYXRjaCgoKSA9PiB7XG4gICAgLyogaWdub3JlICovXG4gIH0pXG59XG5cbmNvbnN0IG9wZW5Db21tYW5kUGFsZXR0ZSA9ICgpOiB2b2lkID0+IHtcbiAgcGFsZXR0ZS5vcGVuKClcbn1cblxuLyog5Li76aKY5b+r5o235YiH5o2i77ya6K+75b2T5YmN6KeG6KeJ54q25oCB77yIY2xhc3NMaXN077yJ77yM6ICM5LiN5pivIHRoZW1lIHJlZlxuICAg4oCU4oCUIHRoZW1lIHJlZiDlnKggYXV0byDmqKHlvI/kuIvkuI3lj43mmKDlrp7pmYXmmI7mmpcgKi9cbmNvbnN0IGlzRGFya05vdyA9ICgpOiBib29sZWFuID0+IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2RhcmsnKVxuXG5jb25zdCB0aGVtZUljb24gPSBjb21wdXRlZCgoKSA9PiAoaXNEYXJrTm93KCkgPyAnc3VuLWxpbmUnIDogJ21vb24tbGluZScpKVxuXG5jb25zdCB0b2dnbGVUaGVtZSA9ICgpOiB2b2lkID0+IHtcbiAgdm9pZCBzZXRUaGVtZShpc0RhcmtOb3coKSA/ICdsaWdodCcgOiAnZGFyaycpXG59XG48L3NjcmlwdD5cblxuPHRlbXBsYXRlPlxuICA8aGVhZGVyXG4gICAgY2xhc3M9XCJMZWFmVG9wQmFyIHJlbGF0aXZlIHotMjAgZmxleCBoLTEwIHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gYm9yZGVyLWIgYm9yZGVyLWxpbmUtc3VidGxlIGJnLWdsYXNzLWJnIHB4LTQgYmFja2Ryb3AtYmx1ci1bdmFyKC0tZ2xhc3MtYmx1cildXCJcbiAgPlxuICAgIDwhLS0g6aG26YOoIDFweCDlhoXpq5jlhYkgLS0+XG4gICAgPGRpdlxuICAgICAgY2xhc3M9XCJwb2ludGVyLWV2ZW50cy1ub25lIGFic29sdXRlIGluc2V0LXgtMCB0b3AtMCBoLXB4IGJnLWdsYXNzLWhpZ2hsaWdodFwiXG4gICAgICBhcmlhLWhpZGRlbj1cInRydWVcIlxuICAgIC8+XG5cbiAgICA8IS0tIOW3pu+8mkxvZ28gKyDlkI3np7AgLS0+XG4gICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHNlbGVjdC1ub25lXCI+XG4gICAgICA8c3BhbiBjbGFzcz1cInRleHQtbGcgbGVhZGluZy1ub25lXCI+8J+Mvzwvc3Bhbj5cbiAgICAgIDxzcGFuIGNsYXNzPVwidGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtZmctcHJpbWFyeVwiPkxlYWY8L3NwYW4+XG4gICAgPC9kaXY+XG5cbiAgICA8IS0tIOS4re+8muWRveS7pOmdouadv+WFpeWPo++8iOKMmEvvvInigJTigJQg54us56uL5rWu5bGC77yM5LiN5oyk5Y2g5Lik5L6nIC0tPlxuICAgIDxidXR0b25cbiAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgY2xhc3M9XCJncm91cCBhYnNvbHV0ZSBsZWZ0LTEvMiB0b3AtMS8yIGZsZXggaC03IHctNzIgLXRyYW5zbGF0ZS14LTEvMiAtdHJhbnNsYXRlLXktMS8yIGl0ZW1zLWNlbnRlciBnYXAtMiByb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci1saW5lLWRlZmF1bHQgYmctc3VyZmFjZS0xIHB4LTMgdGV4dC14cyB0ZXh0LWZnLW11dGVkIHNoYWRvdy14cyB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi1ub3JtYWwgaG92ZXI6Ym9yZGVyLWxpbmUtc3Ryb25nIGhvdmVyOnNoYWRvdy1tZCBmb2N1cy12aXNpYmxlOnNoYWRvdy1yaW5nLWZvY3VzIGZvY3VzLXZpc2libGU6b3V0bGluZS1ub25lXCJcbiAgICAgIEBjbGljaz1cIm9wZW5Db21tYW5kUGFsZXR0ZVwiXG4gICAgPlxuICAgICAgPEFwcEljb24gaWNvbj1cInNlYXJjaFwiIDpzaXplPVwiMTRcIiBjbGFzcz1cInNocmluay0wXCIgLz5cbiAgICAgIDxzcGFuIGNsYXNzPVwiZmxleC0xIHRydW5jYXRlIHRleHQtbGVmdFwiPuaQnOe0ouaooeWdl+OAgei3s+i9rOOAgeWRveS7pOKApjwvc3Bhbj5cbiAgICAgIDxrYmRcbiAgICAgICAgY2xhc3M9XCJoaWRkZW4gc2hyaW5rLTAgcm91bmRlZCBib3JkZXIgYm9yZGVyLWxpbmUtc3VidGxlIGJnLXN1cmZhY2UtaG92ZXIgcHgtMS41IHB5LTAuNSBmb250LW1vbm8gdGV4dC1bMTBweF1cIlxuICAgICAgICA+4oyYSzwva2JkXG4gICAgICA+XG4gICAgPC9idXR0b24+XG5cbiAgICA8IS0tIOWPs++8muS4u+mimOWIh+aNoiArIOiuvue9riArIOWFs+S6jiAtLT5cbiAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTAuNVwiPlxuICAgICAgPFVUb29sdGlwIGNvbnRlbnQ9XCLliIfmjaLkuLvpophcIiBwb3NpdGlvbj1cImJvdHRvbVwiPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgY2xhc3M9XCJmbGV4IGgtOCB3LTggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbWQgdGV4dC1mZy1zZWNvbmRhcnkgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6Ymctc3VyZmFjZS1ob3ZlciBob3Zlcjp0ZXh0LWZnLXByaW1hcnkgZm9jdXMtdmlzaWJsZTpzaGFkb3ctcmluZy1mb2N1cyBmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZVwiXG4gICAgICAgICAgYXJpYS1sYWJlbD1cIuWIh+aNouS4u+mimFwiXG4gICAgICAgICAgQGNsaWNrPVwidG9nZ2xlVGhlbWVcIlxuICAgICAgICA+XG4gICAgICAgICAgPEFwcEljb24gOmljb249XCJ0aGVtZUljb25cIiA6c2l6ZT1cIjE3XCIgLz5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L1VUb29sdGlwPlxuICAgICAgPFVUb29sdGlwIGNvbnRlbnQ9XCLorr7nva5cIiBwb3NpdGlvbj1cImJvdHRvbVwiPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgY2xhc3M9XCJmbGV4IGgtOCB3LTggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbWQgdGV4dC1mZy1zZWNvbmRhcnkgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6Ymctc3VyZmFjZS1ob3ZlciBob3Zlcjp0ZXh0LWZnLXByaW1hcnkgZm9jdXMtdmlzaWJsZTpzaGFkb3ctcmluZy1mb2N1cyBmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZVwiXG4gICAgICAgICAgYXJpYS1sYWJlbD1cIuiuvue9rlwiXG4gICAgICAgICAgQGNsaWNrPVwiZ29TZXR0aW5nc1wiXG4gICAgICAgID5cbiAgICAgICAgICA8QXBwSWNvbiBpY29uPVwic2V0dGluZ3MtMy1saW5lXCIgOnNpemU9XCIxN1wiIC8+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9VVG9vbHRpcD5cbiAgICAgIDxVVG9vbHRpcCBjb250ZW50PVwi5YWz5LqOXCIgcG9zaXRpb249XCJib3R0b21cIj5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgIGNsYXNzPVwiZmxleCBoLTggdy04IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIHRleHQtZmctc2Vjb25kYXJ5IHRyYW5zaXRpb24tY29sb3JzIGhvdmVyOmJnLXN1cmZhY2UtaG92ZXIgaG92ZXI6dGV4dC1mZy1wcmltYXJ5IGZvY3VzLXZpc2libGU6c2hhZG93LXJpbmctZm9jdXMgZm9jdXMtdmlzaWJsZTpvdXRsaW5lLW5vbmVcIlxuICAgICAgICAgIGFyaWEtbGFiZWw9XCLlhbPkuo5cIlxuICAgICAgICAgIEBjbGljaz1cImdvQWJvdXRcIlxuICAgICAgICA+XG4gICAgICAgICAgPEFwcEljb24gaWNvbj1cImluZm9ybWF0aW9uLWxpbmVcIiA6c2l6ZT1cIjE3XCIgLz5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L1VUb29sdGlwPlxuICAgIDwvZGl2PlxuICA8L2hlYWRlcj5cbjwvdGVtcGxhdGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL2NvbXBvbmVudHMvc2hlbGwvVG9wQmFyLnZ1ZSJ9