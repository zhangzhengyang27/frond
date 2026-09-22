import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/shell/CommandPalette.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { useRouter } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue-router.js?v=ea0f6108";
import AppIcon from "/src/components/AppIcon.vue";
import { useCommandPalette } from "/src/composables/useCommandPalette.ts";
import {
  buildStaticCommands,
  buildSystemCommands,
  buildQuicklinkCommands,
  addPinyinAliases
} from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/commands.ts";
import { searchEntries } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/search.ts?t=1789709850689";
import { evaluateExpression } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/calculator.ts";
import { useUsageBoost } from "/src/composables/useUsageBoost.ts";
import { executeCommand } from "/src/utils/commandRunner.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "CommandPalette",
  setup(__props, { expose: __expose }) {
    __expose();
    const router = useRouter();
    const palette = useCommandPalette();
    const query = ref("");
    const inputRef = ref(null);
    const activeIdx = ref(0);
    const aliasEpoch = ref(0);
    const staticCommands = buildStaticCommands();
    const pluginCommands = ref([]);
    const apps = ref([]);
    const extraCommands = ref([]);
    let dynamicLoaded = false;
    async function loadDynamicCommands() {
      try {
        const plugins = await window.api.launcher.listPlugins();
        pluginCommands.value = plugins.filter((p) => p.enabled && Array.isArray(p.commands)).flatMap(
          (p) => p.commands.map((cmd) => ({
            key: `plugin:${p.id}:${cmd.code}`,
            icon: "plug-2",
            title: cmd.title,
            subtitle: `${p.name}${cmd.description ? " · " + cmd.description : ""}`,
            badge: "插件",
            action: { type: "plugin", pluginId: p.id, cmd: cmd.code }
          }))
        );
      } catch {
      }
      if (!dynamicLoaded) {
        dynamicLoaded = true;
        try {
          const list = await window.api.getApplications();
          apps.value = list.map((app) => ({
            key: `app:${app.path}`,
            icon: app.icon ? "apps" : "window-2",
            title: app.name,
            subtitle: app.path,
            badge: "应用",
            action: { type: "app", path: app.path }
          }));
        } catch {
        }
      }
      try {
        const ids = await window.api.sysCmd.ids();
        const links = await window.api.launcher.quicklinksList();
        extraCommands.value = [...buildSystemCommands(ids), ...buildQuicklinkCommands(links)];
      } catch {
      }
      try {
        await refreshUsage();
      } catch {
      }
      await addPinyinAliases(staticCommands);
      await addPinyinAliases(pluginCommands.value);
      await addPinyinAliases(apps.value);
      await addPinyinAliases(extraCommands.value);
      aliasEpoch.value++;
    }
    const allEntries = computed(() => {
      void aliasEpoch.value;
      return [...staticCommands, ...pluginCommands.value, ...extraCommands.value, ...apps.value];
    });
    const filtered = computed(() => {
      const q = query.value.trim();
      if (!q) {
        return staticCommands.map((entry) => ({ entry, highlight: null, score: 0 }));
      }
      const rows = searchEntries(allEntries.value, q, 12, usageBoost);
      const calc = evaluateExpression(q);
      if (calc) {
        rows.unshift({
          entry: {
            key: "calc:result",
            icon: "function-line",
            title: `= ${calc.formatted}`,
            subtitle: calc.expr,
            badge: "计算",
            action: { type: "copyText", text: calc.formatted }
          },
          highlight: null,
          score: Number.MAX_SAFE_INTEGER
        });
      }
      return rows;
    });
    const { refresh: refreshUsage, boost: usageBoost } = useUsageBoost();
    watch(filtered, () => {
      activeIdx.value = 0;
    });
    const run = async (item) => {
      await executeCommand(item.entry, {
        router,
        inMainWindow: true,
        close: () => {
          palette.close();
          query.value = "";
        }
      });
    };
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K") && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        palette.toggle();
        return;
      }
      if (!palette.isOpen.value) return;
      if (e.key === "Escape") {
        e.preventDefault();
        palette.close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIdx.value = Math.min(activeIdx.value + 1, filtered.value.length - 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIdx.value = Math.max(activeIdx.value - 1, 0);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered.value[activeIdx.value];
        if (item) void run(item);
      }
    };
    watch(
      () => palette.isOpen.value,
      async (open) => {
        if (open) {
          void loadDynamicCommands();
          await nextTick();
          inputRef.value?.focus();
        } else {
          query.value = "";
        }
      }
    );
    onMounted(() => {
      window.addEventListener("keydown", onKeyDown);
    });
    onBeforeUnmount(() => {
      window.removeEventListener("keydown", onKeyDown);
    });
    const __returned__ = { router, palette, query, inputRef, activeIdx, aliasEpoch, staticCommands, pluginCommands, apps, extraCommands, get dynamicLoaded() {
      return dynamicLoaded;
    }, set dynamicLoaded(v) {
      dynamicLoaded = v;
    }, loadDynamicCommands, allEntries, filtered, refreshUsage, usageBoost, run, onKeyDown, AppIcon };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, createElementVNode as _createElementVNode, createVNode as _createVNode, vModelText as _vModelText, withDirectives as _withDirectives, toDisplayString as _toDisplayString, openBlock as _openBlock, createElementBlock as _createElementBlock, renderList as _renderList, Fragment as _Fragment, normalizeClass as _normalizeClass, createBlock as _createBlock, createTextVNode as _createTextVNode, withModifiers as _withModifiers, Transition as _Transition, withCtx as _withCtx } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = { class: "relative w-[600px] max-w-[92vw] overflow-hidden rounded-lg border border-glass-border bg-glass-bg-strong shadow-lg backdrop-blur-[var(--glass-blur)]" };
const _hoisted_2 = { class: "flex h-12 items-center gap-3 border-b border-line-subtle px-4" };
const _hoisted_3 = { class: "max-h-[400px] overflow-y-auto py-2" };
const _hoisted_4 = {
  key: 0,
  class: "px-4 py-10 text-center text-sm text-fg-muted"
};
const _hoisted_5 = ["onMouseenter", "onClick"];
const _hoisted_6 = { class: "min-w-0 flex-1" };
const _hoisted_7 = { class: "truncate text-xs text-fg-muted" };
const _hoisted_8 = { class: "shrink-0 rounded-full border border-line-subtle px-2 py-0.5 text-[10px] text-fg-muted" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock(_Transition, {
    "enter-active-class": "transition duration-200 ease-out",
    "enter-from-class": "opacity-0",
    "enter-to-class": "opacity-100",
    "leave-active-class": "transition duration-150 ease-in",
    "leave-from-class": "opacity-100",
    "leave-to-class": "opacity-0"
  }, {
    default: _withCtx(() => [
      $setup.palette.isOpen.value ? (_openBlock(), _createElementBlock("div", {
        key: 0,
        class: "fixed inset-0 z-[1200] flex items-start justify-center bg-overlay pt-[14vh] backdrop-blur-[6px]",
        onClick: _cache[1] || (_cache[1] = _withModifiers(($event) => $setup.palette.close(), ["self"]))
      }, [
        _createElementVNode("div", _hoisted_1, [
          _createCommentVNode(" 顶部 1px 内高光 "),
          _cache[3] || (_cache[3] = _createElementVNode(
            "div",
            {
              class: "pointer-events-none absolute inset-x-0 top-0 h-px bg-glass-highlight",
              "aria-hidden": "true"
            },
            null,
            -1
            /* CACHED */
          )),
          _createCommentVNode(" 搜索框 "),
          _createElementVNode("div", _hoisted_2, [
            _createVNode($setup["AppIcon"], {
              icon: "search",
              size: 18,
              class: "shrink-0 text-fg-muted"
            }),
            _withDirectives(_createElementVNode(
              "input",
              {
                ref: "inputRef",
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.query = $event),
                type: "text",
                placeholder: "搜索功能 / 页面 / 动作 / 插件 / 应用…",
                class: "flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-muted focus:outline-none"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [_vModelText, $setup.query]
            ]),
            _cache[2] || (_cache[2] = _createElementVNode(
              "kbd",
              { class: "rounded border border-line-subtle bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-fg-tertiary" },
              "ESC",
              -1
              /* CACHED */
            ))
          ]),
          _createCommentVNode(" 结果列表 "),
          _createElementVNode("div", _hoisted_3, [
            $setup.filtered.length === 0 ? (_openBlock(), _createElementBlock(
              "p",
              _hoisted_4,
              " 没有匹配「" + _toDisplayString($setup.query) + "」的命令 ",
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true),
            (_openBlock(true), _createElementBlock(
              _Fragment,
              null,
              _renderList($setup.filtered, (it, idx) => {
                return _openBlock(), _createElementBlock("button", {
                  key: it.entry.key,
                  type: "button",
                  class: _normalizeClass([
                    "mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-instant",
                    idx === $setup.activeIdx ? "bg-brand-500/10 text-fg-brand" : "text-fg-secondary hover:bg-surface-hover"
                  ]),
                  onMouseenter: ($event) => $setup.activeIdx = idx,
                  onClick: ($event) => $setup.run(it)
                }, [
                  _createElementVNode(
                    "div",
                    {
                      class: _normalizeClass([
                        "flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors",
                        idx === $setup.activeIdx ? "border-brand-500/20 bg-brand-500/15 text-fg-brand" : "border-line-subtle bg-surface-2 text-fg-tertiary"
                      ])
                    },
                    [
                      _createVNode($setup["AppIcon"], {
                        icon: it.entry.icon,
                        size: 18
                      }, null, 8, ["icon"])
                    ],
                    2
                    /* CLASS */
                  ),
                  _createElementVNode("div", _hoisted_6, [
                    _createElementVNode(
                      "div",
                      {
                        class: _normalizeClass(["text-sm font-medium", idx === $setup.activeIdx ? "text-fg-brand" : "text-fg-primary"])
                      },
                      _toDisplayString(it.entry.title),
                      3
                      /* TEXT, CLASS */
                    ),
                    _createElementVNode(
                      "div",
                      _hoisted_7,
                      _toDisplayString(it.entry.subtitle),
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode(
                    "span",
                    _hoisted_8,
                    _toDisplayString(it.entry.badge),
                    1
                    /* TEXT */
                  ),
                  idx === $setup.activeIdx ? (_openBlock(), _createBlock($setup["AppIcon"], {
                    key: 0,
                    icon: "corner-down-left",
                    size: 14,
                    class: "shrink-0 text-fg-muted"
                  })) : _createCommentVNode("v-if", true)
                ], 42, _hoisted_5);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ]),
          _createCommentVNode(" 底部提示 "),
          _cache[4] || (_cache[4] = _createElementVNode(
            "div",
            { class: "flex h-8 items-center gap-3 border-t border-line-subtle px-4 text-[11px] text-fg-muted" },
            [
              _createElementVNode("span", { class: "inline-flex items-center gap-1" }, [
                _createElementVNode("kbd", { class: "rounded bg-surface-hover px-1 py-0.5 font-mono" }, "↑"),
                _createElementVNode("kbd", { class: "rounded bg-surface-hover px-1 py-0.5 font-mono" }, "↓"),
                _createTextVNode(" 导航 ")
              ]),
              _createElementVNode("span", { class: "inline-flex items-center gap-1" }, [
                _createElementVNode("kbd", { class: "rounded bg-surface-hover px-1 py-0.5 font-mono" }, "↵"),
                _createTextVNode(" 执行 ")
              ]),
              _createElementVNode("span", { class: "ml-auto" }, "与启动台共用同一命令注册表")
            ],
            -1
            /* CACHED */
          ))
        ])
      ])) : _createCommentVNode("v-if", true)
    ]),
    _: 1
    /* STABLE */
  });
}
_sfc_main.__hmrId = "810bd890";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/components/shell/CommandPalette.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QUFnQztBQUFBLGdCQUMxQyxvQkFBbUUsU0FBOUQsT0FBTSxpREFBZ0QsR0FBQyxHQUFDO0FBQUEsaUNBQU0sTUFFckU7QUFBQTtjQUNBLG9CQUEwQyxVQUFwQyxPQUFNLFVBQVMsR0FBQyxlQUFhO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkNvbW1hbmRQYWxldHRlLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgY29tcHV0ZWQsIG5leHRUaWNrLCBvbkJlZm9yZVVubW91bnQsIG9uTW91bnRlZCwgcmVmLCB3YXRjaCB9IGZyb20gJ3Z1ZSdcbmltcG9ydCB7IHVzZVJvdXRlciB9IGZyb20gJ3Z1ZS1yb3V0ZXInXG5pbXBvcnQgQXBwSWNvbiBmcm9tICdAY29tcG9uZW50cy9BcHBJY29uLnZ1ZSdcbmltcG9ydCB7IHVzZUNvbW1hbmRQYWxldHRlIH0gZnJvbSAnLi4vLi4vY29tcG9zYWJsZXMvdXNlQ29tbWFuZFBhbGV0dGUnXG5pbXBvcnQge1xuICBidWlsZFN0YXRpY0NvbW1hbmRzLFxuICBidWlsZFN5c3RlbUNvbW1hbmRzLFxuICBidWlsZFF1aWNrbGlua0NvbW1hbmRzLFxuICBhZGRQaW55aW5BbGlhc2VzLFxuICB0eXBlIENvbW1hbmRFbnRyeVxufSBmcm9tICdAc2hhcmVkL2NvbW1hbmRzJ1xuaW1wb3J0IHsgc2VhcmNoRW50cmllcywgdHlwZSBTY29yZWRFbnRyeSB9IGZyb20gJ0BzaGFyZWQvc2VhcmNoJ1xuaW1wb3J0IHsgZXZhbHVhdGVFeHByZXNzaW9uIH0gZnJvbSAnQHNoYXJlZC9jYWxjdWxhdG9yJ1xuaW1wb3J0IHsgdXNlVXNhZ2VCb29zdCB9IGZyb20gJ0ByZW5kZXJlci9jb21wb3NhYmxlcy91c2VVc2FnZUJvb3N0J1xuaW1wb3J0IHsgZXhlY3V0ZUNvbW1hbmQgfSBmcm9tICdAcmVuZGVyZXIvdXRpbHMvY29tbWFuZFJ1bm5lcidcblxuY29uc3Qgcm91dGVyID0gdXNlUm91dGVyKClcbmNvbnN0IHBhbGV0dGUgPSB1c2VDb21tYW5kUGFsZXR0ZSgpXG5cbmNvbnN0IHF1ZXJ5ID0gcmVmKCcnKVxuY29uc3QgaW5wdXRSZWYgPSByZWY8SFRNTElucHV0RWxlbWVudCB8IG51bGw+KG51bGwpXG5jb25zdCBhY3RpdmVJZHggPSByZWYoMClcblxuLyoqIOaLvOmfs+WIq+WQjeWwsee7quagh+iusO+8iE0xLjHvvIkgKi9cbmNvbnN0IGFsaWFzRXBvY2ggPSByZWYoMClcblxuLyoqIOmdmeaAgeWRveS7pO+8iOaooeWdlyArIFBFTkRJTkcgKyDns7vnu5/pobUgKyDliqjkvZzvvInmnaXoh6ogc2hhcmVkIOazqOWGjOihqCAqL1xuY29uc3Qgc3RhdGljQ29tbWFuZHMgPSBidWlsZFN0YXRpY0NvbW1hbmRzKClcblxuLyoqIOWKqOaAgeWRveS7pO+8muaPkuS7tuWRveS7pCArIOacrOacuuW6lOeUqCArIOezu+e7n+WRveS7pC9RdWlja2xpbmtz77yI6aaW5qyh5omT5byA5pe25oeS5Yqg6L2977yJICovXG5jb25zdCBwbHVnaW5Db21tYW5kcyA9IHJlZjxDb21tYW5kRW50cnlbXT4oW10pXG5jb25zdCBhcHBzID0gcmVmPENvbW1hbmRFbnRyeVtdPihbXSlcbmNvbnN0IGV4dHJhQ29tbWFuZHMgPSByZWY8Q29tbWFuZEVudHJ5W10+KFtdKVxubGV0IGR5bmFtaWNMb2FkZWQgPSBmYWxzZVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkRHluYW1pY0NvbW1hbmRzKCk6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHBsdWdpbnMgPSAoYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5saXN0UGx1Z2lucygpKSBhcyBBcnJheTx7XG4gICAgICBpZDogc3RyaW5nXG4gICAgICBuYW1lOiBzdHJpbmdcbiAgICAgIGVuYWJsZWQ6IGJvb2xlYW5cbiAgICAgIGNvbW1hbmRzPzogQXJyYXk8eyBjb2RlOiBzdHJpbmc7IHRpdGxlOiBzdHJpbmc7IGRlc2NyaXB0aW9uPzogc3RyaW5nIH0+XG4gICAgfT5cbiAgICBwbHVnaW5Db21tYW5kcy52YWx1ZSA9IHBsdWdpbnNcbiAgICAgIC5maWx0ZXIoKHApID0+IHAuZW5hYmxlZCAmJiBBcnJheS5pc0FycmF5KHAuY29tbWFuZHMpKVxuICAgICAgLmZsYXRNYXAoKHApID0+XG4gICAgICAgIHAuY29tbWFuZHMhLm1hcCgoY21kKSA9PiAoe1xuICAgICAgICAgIGtleTogYHBsdWdpbjoke3AuaWR9OiR7Y21kLmNvZGV9YCxcbiAgICAgICAgICBpY29uOiAncGx1Zy0yJyxcbiAgICAgICAgICB0aXRsZTogY21kLnRpdGxlLFxuICAgICAgICAgIHN1YnRpdGxlOiBgJHtwLm5hbWV9JHtjbWQuZGVzY3JpcHRpb24gPyAnIMK3ICcgKyBjbWQuZGVzY3JpcHRpb24gOiAnJ31gLFxuICAgICAgICAgIGJhZGdlOiAn5o+S5Lu2JyxcbiAgICAgICAgICBhY3Rpb246IHsgdHlwZTogJ3BsdWdpbicgYXMgY29uc3QsIHBsdWdpbklkOiBwLmlkLCBjbWQ6IGNtZC5jb2RlIH1cbiAgICAgICAgfSkpXG4gICAgICApXG4gIH0gY2F0Y2gge1xuICAgIC8qIOaPkuS7tuivu+WPluWksei0peS4jemYu+WhnumdouadvyAqL1xuICB9XG4gIGlmICghZHluYW1pY0xvYWRlZCkge1xuICAgIGR5bmFtaWNMb2FkZWQgPSB0cnVlXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGxpc3QgPSBhd2FpdCB3aW5kb3cuYXBpLmdldEFwcGxpY2F0aW9ucygpXG4gICAgICBhcHBzLnZhbHVlID0gbGlzdC5tYXAoKGFwcDogeyBuYW1lOiBzdHJpbmc7IHBhdGg6IHN0cmluZzsgaWNvbj86IHN0cmluZyB9KSA9PiAoe1xuICAgICAgICBrZXk6IGBhcHA6JHthcHAucGF0aH1gLFxuICAgICAgICBpY29uOiBhcHAuaWNvbiA/ICdhcHBzJyA6ICd3aW5kb3ctMicsXG4gICAgICAgIHRpdGxlOiBhcHAubmFtZSxcbiAgICAgICAgc3VidGl0bGU6IGFwcC5wYXRoLFxuICAgICAgICBiYWRnZTogJ+W6lOeUqCcsXG4gICAgICAgIGFjdGlvbjogeyB0eXBlOiAnYXBwJyBhcyBjb25zdCwgcGF0aDogYXBwLnBhdGggfVxuICAgICAgfSkpXG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiDlupTnlKjmiavmj4/lpLHotKXkuI3pmLvloZ7pnaLmnb8gKi9cbiAgICB9XG4gIH1cbiAgdHJ5IHtcbiAgICBjb25zdCBpZHMgPSBhd2FpdCB3aW5kb3cuYXBpLnN5c0NtZC5pZHMoKVxuICAgIGNvbnN0IGxpbmtzID0gYXdhaXQgd2luZG93LmFwaS5sYXVuY2hlci5xdWlja2xpbmtzTGlzdCgpXG4gICAgZXh0cmFDb21tYW5kcy52YWx1ZSA9IFsuLi5idWlsZFN5c3RlbUNvbW1hbmRzKGlkcyksIC4uLmJ1aWxkUXVpY2tsaW5rQ29tbWFuZHMobGlua3MpXVxuICB9IGNhdGNoIHtcbiAgICAvKiDns7vnu5/lkb3ku6QgLyBRdWlja2xpbmtzIOivu+WPluWksei0peS4jemYu+WhnumdouadvyAqL1xuICB9XG4gIHRyeSB7XG4gICAgYXdhaXQgcmVmcmVzaFVzYWdlKClcbiAgfSBjYXRjaCB7XG4gICAgLyog5L2/55So6K6w5b2V6K+75Y+W5aSx6LSl5LiN5Y+C5LiO5Yqg5p2DICovXG4gIH1cbiAgYXdhaXQgYWRkUGlueWluQWxpYXNlcyhzdGF0aWNDb21tYW5kcylcbiAgYXdhaXQgYWRkUGlueWluQWxpYXNlcyhwbHVnaW5Db21tYW5kcy52YWx1ZSlcbiAgYXdhaXQgYWRkUGlueWluQWxpYXNlcyhhcHBzLnZhbHVlKVxuICBhd2FpdCBhZGRQaW55aW5BbGlhc2VzKGV4dHJhQ29tbWFuZHMudmFsdWUpXG4gIGFsaWFzRXBvY2gudmFsdWUrK1xufVxuXG5jb25zdCBhbGxFbnRyaWVzID0gY29tcHV0ZWQ8Q29tbWFuZEVudHJ5W10+KCgpID0+IHtcbiAgdm9pZCBhbGlhc0Vwb2NoLnZhbHVlIC8vIOaLvOmfs+WIq+WQjeW8guatpeWwsee7quWQjumHjeeul1xuICByZXR1cm4gWy4uLnN0YXRpY0NvbW1hbmRzLCAuLi5wbHVnaW5Db21tYW5kcy52YWx1ZSwgLi4uZXh0cmFDb21tYW5kcy52YWx1ZSwgLi4uYXBwcy52YWx1ZV1cbn0pXG5cbmNvbnN0IGZpbHRlcmVkID0gY29tcHV0ZWQ8U2NvcmVkRW50cnlbXT4oKCkgPT4ge1xuICBjb25zdCBxID0gcXVlcnkudmFsdWUudHJpbSgpXG4gIC8vIOepunF1ZXJ5IOKGkiDpnZnmgIHlkb3ku6TlhajliJfvvIjmqKHlnZcgLyDpobXpnaIgLyDliqjkvZzvvInvvJvmnIkgcXVlcnkg4oaSIOWFqOmHj+WRveS7pOe7n+S4gOaQnOe0ouW8leaTjlxuICBpZiAoIXEpIHtcbiAgICByZXR1cm4gc3RhdGljQ29tbWFuZHMubWFwKChlbnRyeSkgPT4gKHsgZW50cnksIGhpZ2hsaWdodDogbnVsbCwgc2NvcmU6IDAgfSkpXG4gIH1cbiAgY29uc3Qgcm93cyA9IHNlYXJjaEVudHJpZXMoYWxsRW50cmllcy52YWx1ZSwgcSwgMTIsIHVzYWdlQm9vc3QpXG4gIC8vIOiuoeeul+WZqOWFnOW6le+8iOS4juiDtuWbiuWQjOasvu+8ie+8mue7k+aenOe9rumhtu+8jOWbnui9puWkjeWItlxuICBjb25zdCBjYWxjID0gZXZhbHVhdGVFeHByZXNzaW9uKHEpXG4gIGlmIChjYWxjKSB7XG4gICAgcm93cy51bnNoaWZ0KHtcbiAgICAgIGVudHJ5OiB7XG4gICAgICAgIGtleTogJ2NhbGM6cmVzdWx0JyxcbiAgICAgICAgaWNvbjogJ2Z1bmN0aW9uLWxpbmUnLFxuICAgICAgICB0aXRsZTogYD0gJHtjYWxjLmZvcm1hdHRlZH1gLFxuICAgICAgICBzdWJ0aXRsZTogY2FsYy5leHByLFxuICAgICAgICBiYWRnZTogJ+iuoeeulycsXG4gICAgICAgIGFjdGlvbjogeyB0eXBlOiAnY29weVRleHQnLCB0ZXh0OiBjYWxjLmZvcm1hdHRlZCB9XG4gICAgICB9LFxuICAgICAgaGlnaGxpZ2h0OiBudWxsLFxuICAgICAgc2NvcmU6IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSXG4gICAgfSlcbiAgfVxuICByZXR1cm4gcm93c1xufSlcblxuLyoqIOS9v+eUqOe7n+iuoe+8iOaOkuW6j+iHquWtpuS5oO+8ie+8muS4juiDtuWbiuWQjOS4gOWKoOadg+etlueVpe+8iOmikeasoSDDlyDmlrDov5HvvIkgKi9cbmNvbnN0IHsgcmVmcmVzaDogcmVmcmVzaFVzYWdlLCBib29zdDogdXNhZ2VCb29zdCB9ID0gdXNlVXNhZ2VCb29zdCgpXG5cbndhdGNoKGZpbHRlcmVkLCAoKSA9PiB7XG4gIGFjdGl2ZUlkeC52YWx1ZSA9IDBcbn0pXG5cbmNvbnN0IHJ1biA9IGFzeW5jIChpdGVtOiBTY29yZWRFbnRyeSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICBhd2FpdCBleGVjdXRlQ29tbWFuZChpdGVtLmVudHJ5LCB7XG4gICAgcm91dGVyLFxuICAgIGluTWFpbldpbmRvdzogdHJ1ZSxcbiAgICBjbG9zZTogKCkgPT4ge1xuICAgICAgcGFsZXR0ZS5jbG9zZSgpXG4gICAgICBxdWVyeS52YWx1ZSA9ICcnXG4gICAgfVxuICB9KVxufVxuXG5jb25zdCBvbktleURvd24gPSAoZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQgPT4ge1xuICAvLyDijJhLIC8gQ3RybCtLIOWUpOi1t++8iOWcqCBBcHBTaGVsbCBtb3VudCDml7bms6jlhozvvIlcbiAgaWYgKChlLm1ldGFLZXkgfHwgZS5jdHJsS2V5KSAmJiAoZS5rZXkgPT09ICdrJyB8fCBlLmtleSA9PT0gJ0snKSAmJiAhZS5hbHRLZXkgJiYgIWUuc2hpZnRLZXkpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBwYWxldHRlLnRvZ2dsZSgpXG4gICAgcmV0dXJuXG4gIH1cblxuICAvLyDpnaLmnb/lhoXvvJrihpHihpMgRW50ZXIgRXNjXG4gIGlmICghcGFsZXR0ZS5pc09wZW4udmFsdWUpIHJldHVyblxuICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgcGFsZXR0ZS5jbG9zZSgpXG4gICAgcmV0dXJuXG4gIH1cbiAgaWYgKGUua2V5ID09PSAnQXJyb3dEb3duJykge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGFjdGl2ZUlkeC52YWx1ZSA9IE1hdGgubWluKGFjdGl2ZUlkeC52YWx1ZSArIDEsIGZpbHRlcmVkLnZhbHVlLmxlbmd0aCAtIDEpXG4gICAgcmV0dXJuXG4gIH1cbiAgaWYgKGUua2V5ID09PSAnQXJyb3dVcCcpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBhY3RpdmVJZHgudmFsdWUgPSBNYXRoLm1heChhY3RpdmVJZHgudmFsdWUgLSAxLCAwKVxuICAgIHJldHVyblxuICB9XG4gIGlmIChlLmtleSA9PT0gJ0VudGVyJykge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGNvbnN0IGl0ZW0gPSBmaWx0ZXJlZC52YWx1ZVthY3RpdmVJZHgudmFsdWVdXG4gICAgaWYgKGl0ZW0pIHZvaWQgcnVuKGl0ZW0pXG4gIH1cbn1cblxud2F0Y2goXG4gICgpID0+IHBhbGV0dGUuaXNPcGVuLnZhbHVlLFxuICBhc3luYyAob3BlbikgPT4ge1xuICAgIGlmIChvcGVuKSB7XG4gICAgICB2b2lkIGxvYWREeW5hbWljQ29tbWFuZHMoKVxuICAgICAgYXdhaXQgbmV4dFRpY2soKVxuICAgICAgaW5wdXRSZWYudmFsdWU/LmZvY3VzKClcbiAgICB9IGVsc2Uge1xuICAgICAgcXVlcnkudmFsdWUgPSAnJ1xuICAgIH1cbiAgfVxuKVxuXG5vbk1vdW50ZWQoKCkgPT4ge1xuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9uS2V5RG93bilcbn0pXG5vbkJlZm9yZVVubW91bnQoKCkgPT4ge1xuICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9uS2V5RG93bilcbn0pXG48L3NjcmlwdD5cblxuPHRlbXBsYXRlPlxuICA8VHJhbnNpdGlvblxuICAgIGVudGVyLWFjdGl2ZS1jbGFzcz1cInRyYW5zaXRpb24gZHVyYXRpb24tMjAwIGVhc2Utb3V0XCJcbiAgICBlbnRlci1mcm9tLWNsYXNzPVwib3BhY2l0eS0wXCJcbiAgICBlbnRlci10by1jbGFzcz1cIm9wYWNpdHktMTAwXCJcbiAgICBsZWF2ZS1hY3RpdmUtY2xhc3M9XCJ0cmFuc2l0aW9uIGR1cmF0aW9uLTE1MCBlYXNlLWluXCJcbiAgICBsZWF2ZS1mcm9tLWNsYXNzPVwib3BhY2l0eS0xMDBcIlxuICAgIGxlYXZlLXRvLWNsYXNzPVwib3BhY2l0eS0wXCJcbiAgPlxuICAgIDxkaXZcbiAgICAgIHYtaWY9XCJwYWxldHRlLmlzT3Blbi52YWx1ZVwiXG4gICAgICBjbGFzcz1cImZpeGVkIGluc2V0LTAgei1bMTIwMF0gZmxleCBpdGVtcy1zdGFydCBqdXN0aWZ5LWNlbnRlciBiZy1vdmVybGF5IHB0LVsxNHZoXSBiYWNrZHJvcC1ibHVyLVs2cHhdXCJcbiAgICAgIEBjbGljay5zZWxmPVwicGFsZXR0ZS5jbG9zZSgpXCJcbiAgICA+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPVwicmVsYXRpdmUgdy1bNjAwcHhdIG1heC13LVs5MnZ3XSBvdmVyZmxvdy1oaWRkZW4gcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLWdsYXNzLWJvcmRlciBiZy1nbGFzcy1iZy1zdHJvbmcgc2hhZG93LWxnIGJhY2tkcm9wLWJsdXItW3ZhcigtLWdsYXNzLWJsdXIpXVwiXG4gICAgICA+XG4gICAgICAgIDwhLS0g6aG26YOoIDFweCDlhoXpq5jlhYkgLS0+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBjbGFzcz1cInBvaW50ZXItZXZlbnRzLW5vbmUgYWJzb2x1dGUgaW5zZXQteC0wIHRvcC0wIGgtcHggYmctZ2xhc3MtaGlnaGxpZ2h0XCJcbiAgICAgICAgICBhcmlhLWhpZGRlbj1cInRydWVcIlxuICAgICAgICAvPlxuXG4gICAgICAgIDwhLS0g5pCc57Si5qGGIC0tPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBoLTEyIGl0ZW1zLWNlbnRlciBnYXAtMyBib3JkZXItYiBib3JkZXItbGluZS1zdWJ0bGUgcHgtNFwiPlxuICAgICAgICAgIDxBcHBJY29uIGljb249XCJzZWFyY2hcIiA6c2l6ZT1cIjE4XCIgY2xhc3M9XCJzaHJpbmstMCB0ZXh0LWZnLW11dGVkXCIgLz5cbiAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgIHJlZj1cImlucHV0UmVmXCJcbiAgICAgICAgICAgIHYtbW9kZWw9XCJxdWVyeVwiXG4gICAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgICBwbGFjZWhvbGRlcj1cIuaQnOe0ouWKn+iDvSAvIOmhtemdoiAvIOWKqOS9nCAvIOaPkuS7tiAvIOW6lOeUqOKAplwiXG4gICAgICAgICAgICBjbGFzcz1cImZsZXgtMSBiZy10cmFuc3BhcmVudCB0ZXh0LXNtIHRleHQtZmctcHJpbWFyeSBwbGFjZWhvbGRlcjp0ZXh0LWZnLW11dGVkIGZvY3VzOm91dGxpbmUtbm9uZVwiXG4gICAgICAgICAgLz5cbiAgICAgICAgICA8a2JkXG4gICAgICAgICAgICBjbGFzcz1cInJvdW5kZWQgYm9yZGVyIGJvcmRlci1saW5lLXN1YnRsZSBiZy1zdXJmYWNlLWhvdmVyIHB4LTEuNSBweS0wLjUgZm9udC1tb25vIHRleHQtWzEwcHhdIHRleHQtZmctdGVydGlhcnlcIlxuICAgICAgICAgICAgPkVTQzwva2JkXG4gICAgICAgICAgPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8IS0tIOe7k+aenOWIl+ihqCAtLT5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm1heC1oLVs0MDBweF0gb3ZlcmZsb3cteS1hdXRvIHB5LTJcIj5cbiAgICAgICAgICA8cCB2LWlmPVwiZmlsdGVyZWQubGVuZ3RoID09PSAwXCIgY2xhc3M9XCJweC00IHB5LTEwIHRleHQtY2VudGVyIHRleHQtc20gdGV4dC1mZy1tdXRlZFwiPlxuICAgICAgICAgICAg5rKh5pyJ5Yy56YWN44CMe3sgcXVlcnkgfX3jgI3nmoTlkb3ku6RcbiAgICAgICAgICA8L3A+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgdi1mb3I9XCIoaXQsIGlkeCkgaW4gZmlsdGVyZWRcIlxuICAgICAgICAgICAgOmtleT1cIml0LmVudHJ5LmtleVwiXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgIGNsYXNzPVwibXgtMiBmbGV4IHctW2NhbGMoMTAwJS0xcmVtKV0gaXRlbXMtY2VudGVyIGdhcC0zIHJvdW5kZWQtbWQgcHgtMi41IHB5LTIgdGV4dC1sZWZ0IHRyYW5zaXRpb24tY29sb3JzIGR1cmF0aW9uLWluc3RhbnRcIlxuICAgICAgICAgICAgOmNsYXNzPVwiXG4gICAgICAgICAgICAgIGlkeCA9PT0gYWN0aXZlSWR4XG4gICAgICAgICAgICAgICAgPyAnYmctYnJhbmQtNTAwLzEwIHRleHQtZmctYnJhbmQnXG4gICAgICAgICAgICAgICAgOiAndGV4dC1mZy1zZWNvbmRhcnkgaG92ZXI6Ymctc3VyZmFjZS1ob3ZlcidcbiAgICAgICAgICAgIFwiXG4gICAgICAgICAgICBAbW91c2VlbnRlcj1cImFjdGl2ZUlkeCA9IGlkeFwiXG4gICAgICAgICAgICBAY2xpY2s9XCJydW4oaXQpXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgIGNsYXNzPVwiZmxleCBzaXplLTkgc2hyaW5rLTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbWQgYm9yZGVyIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgOmNsYXNzPVwiXG4gICAgICAgICAgICAgICAgaWR4ID09PSBhY3RpdmVJZHhcbiAgICAgICAgICAgICAgICAgID8gJ2JvcmRlci1icmFuZC01MDAvMjAgYmctYnJhbmQtNTAwLzE1IHRleHQtZmctYnJhbmQnXG4gICAgICAgICAgICAgICAgICA6ICdib3JkZXItbGluZS1zdWJ0bGUgYmctc3VyZmFjZS0yIHRleHQtZmctdGVydGlhcnknXG4gICAgICAgICAgICAgIFwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxBcHBJY29uIDppY29uPVwiaXQuZW50cnkuaWNvblwiIDpzaXplPVwiMThcIiAvPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1zbSBmb250LW1lZGl1bVwiXG4gICAgICAgICAgICAgICAgOmNsYXNzPVwiaWR4ID09PSBhY3RpdmVJZHggPyAndGV4dC1mZy1icmFuZCcgOiAndGV4dC1mZy1wcmltYXJ5J1wiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7eyBpdC5lbnRyeS50aXRsZSB9fVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRydW5jYXRlIHRleHQteHMgdGV4dC1mZy1tdXRlZFwiPlxuICAgICAgICAgICAgICAgIHt7IGl0LmVudHJ5LnN1YnRpdGxlIH19XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgICBjbGFzcz1cInNocmluay0wIHJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLWxpbmUtc3VidGxlIHB4LTIgcHktMC41IHRleHQtWzEwcHhdIHRleHQtZmctbXV0ZWRcIlxuICAgICAgICAgICAgICA+e3sgaXQuZW50cnkuYmFkZ2UgfX08L3NwYW5cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgIDxBcHBJY29uXG4gICAgICAgICAgICAgIHYtaWY9XCJpZHggPT09IGFjdGl2ZUlkeFwiXG4gICAgICAgICAgICAgIGljb249XCJjb3JuZXItZG93bi1sZWZ0XCJcbiAgICAgICAgICAgICAgOnNpemU9XCIxNFwiXG4gICAgICAgICAgICAgIGNsYXNzPVwic2hyaW5rLTAgdGV4dC1mZy1tdXRlZFwiXG4gICAgICAgICAgICAvPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8IS0tIOW6lemDqOaPkOekuiAtLT5cbiAgICAgICAgPGRpdlxuICAgICAgICAgIGNsYXNzPVwiZmxleCBoLTggaXRlbXMtY2VudGVyIGdhcC0zIGJvcmRlci10IGJvcmRlci1saW5lLXN1YnRsZSBweC00IHRleHQtWzExcHhdIHRleHQtZmctbXV0ZWRcIlxuICAgICAgICA+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTFcIj5cbiAgICAgICAgICAgIDxrYmQgY2xhc3M9XCJyb3VuZGVkIGJnLXN1cmZhY2UtaG92ZXIgcHgtMSBweS0wLjUgZm9udC1tb25vXCI+4oaRPC9rYmQ+XG4gICAgICAgICAgICA8a2JkIGNsYXNzPVwicm91bmRlZCBiZy1zdXJmYWNlLWhvdmVyIHB4LTEgcHktMC41IGZvbnQtbW9ub1wiPuKGkzwva2JkPlxuICAgICAgICAgICAg5a+86IiqXG4gICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGdhcC0xXCI+XG4gICAgICAgICAgICA8a2JkIGNsYXNzPVwicm91bmRlZCBiZy1zdXJmYWNlLWhvdmVyIHB4LTEgcHktMC41IGZvbnQtbW9ub1wiPuKGtTwva2JkPlxuICAgICAgICAgICAg5omn6KGMXG4gICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwibWwtYXV0b1wiPuS4juWQr+WKqOWPsOWFseeUqOWQjOS4gOWRveS7pOazqOWGjOihqDwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgPC9UcmFuc2l0aW9uPlxuPC90ZW1wbGF0ZT5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvY29tcG9uZW50cy9zaGVsbC9Db21tYW5kUGFsZXR0ZS52dWUifQ==