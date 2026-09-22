import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/launcher/pages/SnippetsPage.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { computed, onMounted, ref, watch } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import AppIcon from "/src/components/AppIcon.vue";
import CapsulePage from "/src/launcher/pages/CapsulePage.vue";
import { searchEntries } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/search.ts?t=1789709850689";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "SnippetsPage",
  props: {
    query: { type: String, required: true }
  },
  emits: ["copied", "navigate"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const all = ref([]);
    const loading = ref(true);
    const selectedIndex = ref(0);
    const copiedFlash = ref("");
    let flashTimer = null;
    const results = computed(() => {
      if (!props.query.trim()) {
        return all.value.slice(0, 8).map((entry) => ({ entry, highlight: null, score: 0 }));
      }
      return searchEntries(all.value, props.query, 8);
    });
    const selected = computed(() => results.value[selectedIndex.value]?.entry ?? null);
    watch(results, () => {
      selectedIndex.value = 0;
    });
    const hints = [
      { keys: "↵", label: "复制并关闭" },
      { keys: "⌘C", label: "复制" },
      { keys: "⌘↵", label: "打开片段库" },
      { keys: "ESC", label: "返回" }
    ];
    function currentEntry() {
      return results.value[selectedIndex.value]?.entry ?? null;
    }
    async function runSelected(close = true) {
      const item = currentEntry();
      if (!item) return;
      try {
        await navigator.clipboard.writeText(item.value);
        if (close) {
          emit("copied", item.title);
        } else {
          flashCopied(item.title);
        }
      } catch {
      }
    }
    function flashCopied(title) {
      copiedFlash.value = title;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        copiedFlash.value = "";
      }, 1500);
    }
    function openLibrary() {
      window.api.launcher.openModule("snippets", "/snippets");
      emit("navigate");
    }
    function moveSelection(delta) {
      if (results.value.length === 0) return;
      selectedIndex.value = (selectedIndex.value + delta + results.value.length) % results.value.length;
      document.querySelectorAll(".snip-item")[selectedIndex.value]?.scrollIntoView({ block: "nearest" });
    }
    function handleKey(e) {
      if (e.key === "ArrowDown") {
        moveSelection(1);
        return true;
      }
      if (e.key === "ArrowUp") {
        moveSelection(-1);
        return true;
      }
      if (e.key === "Enter") {
        if (e.metaKey || e.ctrlKey) {
          openLibrary();
        } else {
          void runSelected(true);
        }
        return true;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
        void runSelected(false);
        return true;
      }
      return false;
    }
    __expose({ handleKey });
    onMounted(async () => {
      try {
        const snippets = await window.api.snippet.getSnippets();
        all.value = snippets.map((s) => {
          const first = s.contents?.[0];
          const preview = (first?.value ?? "").replace(/\s+/g, " ").slice(0, 80);
          return {
            key: `snippet:${s.id}`,
            icon: "file-code-line",
            title: s.name,
            subtitle: s.description || preview || "空片段",
            language: first?.language ?? "",
            value: first?.value ?? ""
          };
        });
      } catch {
      } finally {
        loading.value = false;
      }
    });
    const __returned__ = { props, emit, all, loading, selectedIndex, copiedFlash, get flashTimer() {
      return flashTimer;
    }, set flashTimer(v) {
      flashTimer = v;
    }, results, selected, hints, currentEntry, runSelected, flashCopied, openLibrary, moveSelection, handleKey, AppIcon, CapsulePage };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { toDisplayString as _toDisplayString, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, renderList as _renderList, Fragment as _Fragment, createVNode as _createVNode, createElementVNode as _createElementVNode, normalizeClass as _normalizeClass, withCtx as _withCtx, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = { class: "snip-page" };
const _hoisted_2 = {
  key: 0,
  class: "snip-flash"
};
const _hoisted_3 = {
  key: 1,
  class: "snip-empty"
};
const _hoisted_4 = {
  key: 2,
  class: "snip-empty"
};
const _hoisted_5 = {
  key: 3,
  class: "snip-list"
};
const _hoisted_6 = ["onMouseenter"];
const _hoisted_7 = { class: "snip-icon" };
const _hoisted_8 = { class: "snip-text" };
const _hoisted_9 = { class: "snip-title" };
const _hoisted_10 = { class: "snip-sub" };
const _hoisted_11 = { class: "snip-lang" };
const _hoisted_12 = {
  key: 0,
  class: "snip-detail"
};
const _hoisted_13 = { class: "snip-detail-head" };
const _hoisted_14 = { class: "snip-detail-name" };
const _hoisted_15 = {
  key: 0,
  class: "snip-lang"
};
const _hoisted_16 = { class: "snip-detail-code" };
const _hoisted_17 = {
  key: 1,
  class: "snip-empty"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["CapsulePage"], { hints: $setup.hints }, {
    detail: _withCtx(() => [
      $setup.selected ? (_openBlock(), _createElementBlock("div", _hoisted_12, [
        _createElementVNode("div", _hoisted_13, [
          _createElementVNode(
            "span",
            _hoisted_14,
            _toDisplayString($setup.selected.title),
            1
            /* TEXT */
          ),
          $setup.selected.language ? (_openBlock(), _createElementBlock(
            "span",
            _hoisted_15,
            _toDisplayString($setup.selected.language),
            1
            /* TEXT */
          )) : _createCommentVNode("v-if", true)
        ]),
        _createElementVNode(
          "pre",
          _hoisted_16,
          _toDisplayString($setup.selected.value),
          1
          /* TEXT */
        )
      ])) : (_openBlock(), _createElementBlock("div", _hoisted_17, "选择左侧片段查看内容"))
    ]),
    default: _withCtx(() => [
      _createElementVNode("div", _hoisted_1, [
        $setup.copiedFlash ? (_openBlock(), _createElementBlock(
          "div",
          _hoisted_2,
          "已复制「" + _toDisplayString($setup.copiedFlash) + "」",
          1
          /* TEXT */
        )) : _createCommentVNode("v-if", true),
        $setup.loading ? (_openBlock(), _createElementBlock("div", _hoisted_3, "加载片段中…")) : $setup.results.length === 0 ? (_openBlock(), _createElementBlock(
          "div",
          _hoisted_4,
          _toDisplayString($props.query ? `没有匹配「${$props.query}」的片段` : "还没有代码片段"),
          1
          /* TEXT */
        )) : (_openBlock(), _createElementBlock("div", _hoisted_5, [
          (_openBlock(true), _createElementBlock(
            _Fragment,
            null,
            _renderList($setup.results, (item, index) => {
              return _openBlock(), _createElementBlock("div", {
                key: item.entry.key,
                class: _normalizeClass(["snip-item", { selected: index === $setup.selectedIndex }]),
                onMouseenter: ($event) => $setup.selectedIndex = index,
                onClick: _cache[0] || (_cache[0] = ($event) => $setup.runSelected(true))
              }, [
                _createElementVNode("div", _hoisted_7, [
                  _createVNode($setup["AppIcon"], {
                    icon: "file-code-line",
                    size: 16
                  })
                ]),
                _createElementVNode("div", _hoisted_8, [
                  _createElementVNode(
                    "div",
                    _hoisted_9,
                    _toDisplayString(item.entry.title),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode(
                    "div",
                    _hoisted_10,
                    _toDisplayString(item.entry.subtitle),
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode(
                  "span",
                  _hoisted_11,
                  _toDisplayString(item.entry.language),
                  1
                  /* TEXT */
                )
              ], 42, _hoisted_6);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]))
      ])
    ]),
    _: 1
    /* STABLE */
  });
}
import "/src/launcher/pages/SnippetsPage.vue?vue&type=style&index=0&scoped=e76c5c8e&lang.css";
_sfc_main.__hmrId = "e76c5c8e";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-e76c5c8e"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/launcher/pages/SnippetsPage.vue"]]);

//# sourceMappingURL=data:application/json;base64,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O0FBQUE7O2dCQUV4QyxvQkFHTSxPQUhOLFlBR007QUFBQSxrQkFGSjtBQUFBLG9CQUFvRDtBQUFBLG9CQUFwRDtBQUFBLG9CQUFvRCxpQkFBekIsS0FBSyxNQUFNLEtBQUs7QUFBQTtBQUFBO0FBQUE7QUFBQSxrQkFDM0M7QUFBQSxvQkFBcUQ7QUFBQSxvQkFBckQ7QUFBQSxvQkFBcUQsaUJBQTVCLEtBQUssTUFBTSxRQUFRO0FBQUE7QUFBQTtBQUFBO0FBQUE7Z0JBRTlDO0FBQUEsa0JBQXdEO0FBQUEsa0JBQXhEO0FBQUEsa0JBQXdELGlCQUE3QixLQUFLLE1BQU0sUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJTbmlwcGV0c1BhZ2UudnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjx0ZW1wbGF0ZT5cbiAgPENhcHN1bGVQYWdlIDpoaW50cz1cImhpbnRzXCI+XG4gICAgPGRpdiBjbGFzcz1cInNuaXAtcGFnZVwiPlxuICAgICAgPGRpdiB2LWlmPVwiY29waWVkRmxhc2hcIiBjbGFzcz1cInNuaXAtZmxhc2hcIj7lt7LlpI3liLbjgIx7eyBjb3BpZWRGbGFzaCB9feOAjTwvZGl2PlxuICAgICAgPGRpdiB2LWlmPVwibG9hZGluZ1wiIGNsYXNzPVwic25pcC1lbXB0eVwiPuWKoOi9veeJh+auteS4reKApjwvZGl2PlxuICAgICAgPGRpdiB2LWVsc2UtaWY9XCJyZXN1bHRzLmxlbmd0aCA9PT0gMFwiIGNsYXNzPVwic25pcC1lbXB0eVwiPlxuICAgICAgICB7eyBxdWVyeSA/IGDmsqHmnInljLnphY3jgIwke3F1ZXJ5feOAjeeahOeJh+autWAgOiAn6L+Y5rKh5pyJ5Luj56CB54mH5q61JyB9fVxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IHYtZWxzZSBjbGFzcz1cInNuaXAtbGlzdFwiPlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgdi1mb3I9XCIoaXRlbSwgaW5kZXgpIGluIHJlc3VsdHNcIlxuICAgICAgICAgIDprZXk9XCJpdGVtLmVudHJ5LmtleVwiXG4gICAgICAgICAgY2xhc3M9XCJzbmlwLWl0ZW1cIlxuICAgICAgICAgIDpjbGFzcz1cInsgc2VsZWN0ZWQ6IGluZGV4ID09PSBzZWxlY3RlZEluZGV4IH1cIlxuICAgICAgICAgIEBtb3VzZWVudGVyPVwic2VsZWN0ZWRJbmRleCA9IGluZGV4XCJcbiAgICAgICAgICBAY2xpY2s9XCJydW5TZWxlY3RlZCh0cnVlKVwiXG4gICAgICAgID5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwic25pcC1pY29uXCI+XG4gICAgICAgICAgICA8QXBwSWNvbiBpY29uPVwiZmlsZS1jb2RlLWxpbmVcIiA6c2l6ZT1cIjE2XCIgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwic25pcC10ZXh0XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic25pcC10aXRsZVwiPnt7IGl0ZW0uZW50cnkudGl0bGUgfX08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzbmlwLXN1YlwiPnt7IGl0ZW0uZW50cnkuc3VidGl0bGUgfX08L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cInNuaXAtbGFuZ1wiPnt7IGl0ZW0uZW50cnkubGFuZ3VhZ2UgfX08L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPCEtLSBEZXRhaWzvvJrpgInkuK3niYfmrrXnmoTlrozmlbTlhoXlrrnpooTop4ggLS0+XG4gICAgPHRlbXBsYXRlICNkZXRhaWw+XG4gICAgICA8ZGl2IHYtaWY9XCJzZWxlY3RlZFwiIGNsYXNzPVwic25pcC1kZXRhaWxcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInNuaXAtZGV0YWlsLWhlYWRcIj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cInNuaXAtZGV0YWlsLW5hbWVcIj57eyBzZWxlY3RlZC50aXRsZSB9fTwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiB2LWlmPVwic2VsZWN0ZWQubGFuZ3VhZ2VcIiBjbGFzcz1cInNuaXAtbGFuZ1wiPnt7IHNlbGVjdGVkLmxhbmd1YWdlIH19PC9zcGFuPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPHByZSBjbGFzcz1cInNuaXAtZGV0YWlsLWNvZGVcIj57eyBzZWxlY3RlZC52YWx1ZSB9fTwvcHJlPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IHYtZWxzZSBjbGFzcz1cInNuaXAtZW1wdHlcIj7pgInmi6nlt6bkvqfniYfmrrXmn6XnnIvlhoXlrrk8L2Rpdj5cbiAgICA8L3RlbXBsYXRlPlxuICA8L0NhcHN1bGVQYWdlPlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IGNvbXB1dGVkLCBvbk1vdW50ZWQsIHJlZiwgd2F0Y2ggfSBmcm9tICd2dWUnXG5pbXBvcnQgQXBwSWNvbiBmcm9tICdAY29tcG9uZW50cy9BcHBJY29uLnZ1ZSdcbmltcG9ydCBDYXBzdWxlUGFnZSBmcm9tICcuL0NhcHN1bGVQYWdlLnZ1ZSdcbmltcG9ydCB7IHNlYXJjaEVudHJpZXMsIHR5cGUgU2NvcmVkRW50cnksIHR5cGUgU2VhcmNoRW50cnlCYXNlIH0gZnJvbSAnQHNoYXJlZC9zZWFyY2gnXG5cbmludGVyZmFjZSBTbmlwcGV0SXRlbSB7XG4gIGlkOiBzdHJpbmdcbiAgbmFtZTogc3RyaW5nXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nXG4gIGNvbnRlbnRzOiBBcnJheTx7IHZhbHVlOiBzdHJpbmc7IGxhbmd1YWdlOiBzdHJpbmcgfT5cbn1cblxuaW50ZXJmYWNlIFNuaXBFbnRyeSBleHRlbmRzIFNlYXJjaEVudHJ5QmFzZSB7XG4gIGxhbmd1YWdlOiBzdHJpbmdcbiAgdmFsdWU6IHN0cmluZ1xufVxuXG5jb25zdCBwcm9wcyA9IGRlZmluZVByb3BzPHsgcXVlcnk6IHN0cmluZyB9PigpXG5jb25zdCBlbWl0ID0gZGVmaW5lRW1pdHM8eyBjb3BpZWQ6IFt0aXRsZTogc3RyaW5nXTsgbmF2aWdhdGU6IFtdIH0+KClcblxuY29uc3QgYWxsID0gcmVmPFNuaXBFbnRyeVtdPihbXSlcbmNvbnN0IGxvYWRpbmcgPSByZWYodHJ1ZSlcbmNvbnN0IHNlbGVjdGVkSW5kZXggPSByZWYoMClcbmNvbnN0IGNvcGllZEZsYXNoID0gcmVmKCcnKVxubGV0IGZsYXNoVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGxcblxuY29uc3QgcmVzdWx0cyA9IGNvbXB1dGVkPFNjb3JlZEVudHJ5PFNuaXBFbnRyeT5bXT4oKCkgPT4ge1xuICBpZiAoIXByb3BzLnF1ZXJ5LnRyaW0oKSkge1xuICAgIHJldHVybiBhbGwudmFsdWUuc2xpY2UoMCwgOCkubWFwKChlbnRyeSkgPT4gKHsgZW50cnksIGhpZ2hsaWdodDogbnVsbCwgc2NvcmU6IDAgfSkpXG4gIH1cbiAgcmV0dXJuIHNlYXJjaEVudHJpZXMoYWxsLnZhbHVlLCBwcm9wcy5xdWVyeSwgOClcbn0pXG5cbmNvbnN0IHNlbGVjdGVkID0gY29tcHV0ZWQoKCkgPT4gcmVzdWx0cy52YWx1ZVtzZWxlY3RlZEluZGV4LnZhbHVlXT8uZW50cnkgPz8gbnVsbClcblxud2F0Y2gocmVzdWx0cywgKCkgPT4ge1xuICBzZWxlY3RlZEluZGV4LnZhbHVlID0gMFxufSlcblxuY29uc3QgaGludHMgPSBbXG4gIHsga2V5czogJ+KGtScsIGxhYmVsOiAn5aSN5Yi25bm25YWz6ZetJyB9LFxuICB7IGtleXM6ICfijJhDJywgbGFiZWw6ICflpI3liLYnIH0sXG4gIHsga2V5czogJ+KMmOKGtScsIGxhYmVsOiAn5omT5byA54mH5q615bqTJyB9LFxuICB7IGtleXM6ICdFU0MnLCBsYWJlbDogJ+i/lOWbnicgfVxuXVxuXG5mdW5jdGlvbiBjdXJyZW50RW50cnkoKTogU25pcEVudHJ5IHwgbnVsbCB7XG4gIHJldHVybiByZXN1bHRzLnZhbHVlW3NlbGVjdGVkSW5kZXgudmFsdWVdPy5lbnRyeSA/PyBudWxsXG59XG5cbi8qKiDlpI3liLbvvJtjbG9zZT10cnVlIOaXtumAmuefpeWkluWxguaUtui1t+iDtuWbiu+8iGNvcHktdGhlbi1jbG9zZe+8iSAqL1xuYXN5bmMgZnVuY3Rpb24gcnVuU2VsZWN0ZWQoY2xvc2UgPSB0cnVlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGl0ZW0gPSBjdXJyZW50RW50cnkoKVxuICBpZiAoIWl0ZW0pIHJldHVyblxuICB0cnkge1xuICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGl0ZW0udmFsdWUpXG4gICAgaWYgKGNsb3NlKSB7XG4gICAgICBlbWl0KCdjb3BpZWQnLCBpdGVtLnRpdGxlKVxuICAgIH0gZWxzZSB7XG4gICAgICBmbGFzaENvcGllZChpdGVtLnRpdGxlKVxuICAgIH1cbiAgfSBjYXRjaCB7XG4gICAgLyog5Ymq6LS05p2/5aSx6LSl6Z2Z6buY77yI56qX5Y+j5aSx54Sm562J77yJICovXG4gIH1cbn1cblxuZnVuY3Rpb24gZmxhc2hDb3BpZWQodGl0bGU6IHN0cmluZyk6IHZvaWQge1xuICBjb3BpZWRGbGFzaC52YWx1ZSA9IHRpdGxlXG4gIGlmIChmbGFzaFRpbWVyKSBjbGVhclRpbWVvdXQoZmxhc2hUaW1lcilcbiAgZmxhc2hUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGNvcGllZEZsYXNoLnZhbHVlID0gJydcbiAgfSwgMTUwMClcbn1cblxuZnVuY3Rpb24gb3BlbkxpYnJhcnkoKTogdm9pZCB7XG4gIHdpbmRvdy5hcGkubGF1bmNoZXIub3Blbk1vZHVsZSgnc25pcHBldHMnLCAnL3NuaXBwZXRzJylcbiAgZW1pdCgnbmF2aWdhdGUnKVxufVxuXG5mdW5jdGlvbiBtb3ZlU2VsZWN0aW9uKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgaWYgKHJlc3VsdHMudmFsdWUubGVuZ3RoID09PSAwKSByZXR1cm5cbiAgc2VsZWN0ZWRJbmRleC52YWx1ZSA9IChzZWxlY3RlZEluZGV4LnZhbHVlICsgZGVsdGEgKyByZXN1bHRzLnZhbHVlLmxlbmd0aCkgJSByZXN1bHRzLnZhbHVlLmxlbmd0aFxuICAvLyDplK7nm5jmtY/op4jml7bkv53or4HpgInkuK3pobnlj6/op4HvvIhEZXRhaWwg6IGU5Yqo77yJXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5zbmlwLWl0ZW0nKVtzZWxlY3RlZEluZGV4LnZhbHVlXT8uc2Nyb2xsSW50b1ZpZXcoeyBibG9jazogJ25lYXJlc3QnIH0pXG59XG5cbi8qKiDplK7nm5jliIblj5HvvIhMYXVuY2hlckFwcCDpm4bkuK3ovazlj5HvvInvvJvov5Tlm54gdHJ1ZSDooajnpLrlt7LmtojotLkgKi9cbmZ1bmN0aW9uIGhhbmRsZUtleShlOiBLZXlib2FyZEV2ZW50KTogYm9vbGVhbiB7XG4gIGlmIChlLmtleSA9PT0gJ0Fycm93RG93bicpIHtcbiAgICBtb3ZlU2VsZWN0aW9uKDEpXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICBpZiAoZS5rZXkgPT09ICdBcnJvd1VwJykge1xuICAgIG1vdmVTZWxlY3Rpb24oLTEpXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICBpZiAoZS5rZXkgPT09ICdFbnRlcicpIHtcbiAgICBpZiAoZS5tZXRhS2V5IHx8IGUuY3RybEtleSkge1xuICAgICAgb3BlbkxpYnJhcnkoKVxuICAgIH0gZWxzZSB7XG4gICAgICB2b2lkIHJ1blNlbGVjdGVkKHRydWUpXG4gICAgfVxuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgaWYgKChlLm1ldGFLZXkgfHwgZS5jdHJsS2V5KSAmJiAoZS5rZXkgPT09ICdjJyB8fCBlLmtleSA9PT0gJ0MnKSkge1xuICAgIHZvaWQgcnVuU2VsZWN0ZWQoZmFsc2UpXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICByZXR1cm4gZmFsc2Vcbn1cblxuZGVmaW5lRXhwb3NlKHsgaGFuZGxlS2V5IH0pXG5cbm9uTW91bnRlZChhc3luYyAoKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc25pcHBldHMgPSAoYXdhaXQgd2luZG93LmFwaS5zbmlwcGV0LmdldFNuaXBwZXRzKCkpIGFzIFNuaXBwZXRJdGVtW11cbiAgICBhbGwudmFsdWUgPSBzbmlwcGV0cy5tYXAoKHMpID0+IHtcbiAgICAgIGNvbnN0IGZpcnN0ID0gcy5jb250ZW50cz8uWzBdXG4gICAgICBjb25zdCBwcmV2aWV3ID0gKGZpcnN0Py52YWx1ZSA/PyAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnNsaWNlKDAsIDgwKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2V5OiBgc25pcHBldDoke3MuaWR9YCxcbiAgICAgICAgaWNvbjogJ2ZpbGUtY29kZS1saW5lJyxcbiAgICAgICAgdGl0bGU6IHMubmFtZSxcbiAgICAgICAgc3VidGl0bGU6IHMuZGVzY3JpcHRpb24gfHwgcHJldmlldyB8fCAn56m654mH5q61JyxcbiAgICAgICAgbGFuZ3VhZ2U6IGZpcnN0Py5sYW5ndWFnZSA/PyAnJyxcbiAgICAgICAgdmFsdWU6IGZpcnN0Py52YWx1ZSA/PyAnJ1xuICAgICAgfVxuICAgIH0pXG4gIH0gY2F0Y2gge1xuICAgIC8qIOeJh+auteivu+WPluWksei0peaYvuekuuepuuaAgSAqL1xuICB9IGZpbmFsbHkge1xuICAgIGxvYWRpbmcudmFsdWUgPSBmYWxzZVxuICB9XG59KVxuPC9zY3JpcHQ+XG5cbjxzdHlsZSBzY29wZWQ+XG4uc25pcC1wYWdlIHtcbiAgcGFkZGluZzogNnB4O1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBnYXA6IDZweDtcbiAgcG9zaXRpb246IHJlbGF0aXZlO1xufVxuXG4uc25pcC1mbGFzaCB7XG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgdG9wOiA2cHg7XG4gIGxlZnQ6IDUwJTtcbiAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICB6LWluZGV4OiAxMDtcbiAgcGFkZGluZzogNHB4IDEycHg7XG4gIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xuICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1sYXVuY2hlci1ib3JkZXIpO1xuICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOTUpO1xuICBmb250LXNpemU6IDExcHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQpO1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICBtYXgtd2lkdGg6IDkwJTtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG59XG5cbi5zbmlwLWxpc3Qge1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBnYXA6IDJweDtcbn1cblxuLnNuaXAtaXRlbSB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGdhcDogMTBweDtcbiAgcGFkZGluZzogOHB4IDEwcHg7XG4gIGJvcmRlci1yYWRpdXM6IDlweDtcbiAgY3Vyc29yOiBwb2ludGVyO1xufVxuXG4uc25pcC1pdGVtLnNlbGVjdGVkIHtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50LXNvZnQpO1xufVxuXG4uc25pcC1pY29uIHtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gIHdpZHRoOiAzMHB4O1xuICBoZWlnaHQ6IDMwcHg7XG4gIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA3KTtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtZGltKTtcbiAgZmxleC1zaHJpbms6IDA7XG59XG5cbi5zbmlwLWl0ZW0uc2VsZWN0ZWQgLnNuaXAtaWNvbiB7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQpO1xufVxuXG4uc25pcC10ZXh0IHtcbiAgZmxleDogMTtcbiAgbWluLXdpZHRoOiAwO1xufVxuXG4uc25pcC10aXRsZSB7XG4gIGZvbnQtc2l6ZTogMTNweDtcbiAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQpO1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbn1cblxuLnNuaXAtc3ViIHtcbiAgZm9udC1zaXplOiAxMXB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1tdXRlZCk7XG4gIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gIG92ZXJmbG93OiBoaWRkZW47XG4gIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICBtYXJnaW4tdG9wOiAxcHg7XG59XG5cbi5zbmlwLWxhbmcge1xuICBmb250LXNpemU6IDEwcHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYm9yZGVyKTtcbiAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gIHBhZGRpbmc6IDJweCA4cHg7XG4gIGZsZXgtc2hyaW5rOiAwO1xuICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xufVxuXG4uc25pcC1lbXB0eSB7XG4gIHBhZGRpbmc6IDIycHggMDtcbiAgdGV4dC1hbGlnbjogY2VudGVyO1xuICBmb250LXNpemU6IDEycHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbn1cblxuLnNuaXAtZGV0YWlsIHtcbiAgZGlzcGxheTogZmxleDtcbiAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgZ2FwOiA4cHg7XG4gIG1pbi1oZWlnaHQ6IDA7XG59XG5cbi5zbmlwLWRldGFpbC1oZWFkIHtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgZ2FwOiA4cHg7XG4gIG1pbi13aWR0aDogMDtcbn1cblxuLnNuaXAtZGV0YWlsLW5hbWUge1xuICBmb250LXNpemU6IDEycHg7XG4gIGZvbnQtd2VpZ2h0OiA1MDA7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0KTtcbiAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gIG1pbi13aWR0aDogMDtcbn1cblxuLnNuaXAtZGV0YWlsLWNvZGUge1xuICBtYXJnaW46IDA7XG4gIHBhZGRpbmc6IDEwcHg7XG4gIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYm9yZGVyKTtcbiAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA0KTtcbiAgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubywgdWktbW9ub3NwYWNlLCBNZW5sbywgbW9ub3NwYWNlKTtcbiAgZm9udC1zaXplOiAxMXB4O1xuICBsaW5lLWhlaWdodDogMS41O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1kaW0pO1xuICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XG4gIHdvcmQtYnJlYWs6IGJyZWFrLWFsbDtcbiAgb3ZlcmZsb3cteTogYXV0bztcbiAgbWF4LWhlaWdodDogMzAwcHg7XG59XG48L3N0eWxlPlxuIl0sImZpbGUiOiIvVXNlcnMveGlhb3llL0Rlc2t0b3AvZWxlY3Ryb24tdG9vbHMvc3JjL3JlbmRlcmVyL3NyYy9sYXVuY2hlci9wYWdlcy9TbmlwcGV0c1BhZ2UudnVlIn0=