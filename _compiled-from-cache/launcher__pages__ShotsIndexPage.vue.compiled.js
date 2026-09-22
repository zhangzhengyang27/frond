import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/launcher/pages/ShotsIndexPage.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { beginBusy, endBusy } from "/src/launcher/composables/useLauncherBusy.ts";
import CapsulePage from "/src/launcher/pages/CapsulePage.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "ShotsIndexPage",
  props: {
    query: { type: String, required: false }
  },
  emits: ["ask-ai"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const loading = ref(true);
    const items = ref([]);
    const selectedIndex = ref(0);
    const status = ref({ total: 0, pending: 0, done: 0, failed: 0, scanning: false });
    const flash = ref("");
    const all = ref([]);
    const selected = computed(() => items.value[selectedIndex.value] ?? null);
    const hints = [
      { keys: "↵", label: "粘贴到前台" },
      { keys: "⌘C", label: "复制文字" },
      { keys: "⌘A", label: "问 AI" },
      { keys: "⌘O", label: "Finder 显示" },
      { keys: "R", label: "重新扫描" },
      { keys: "ESC", label: "返回" }
    ];
    const emptyText = computed(() => {
      if (status.value.total === 0) return "未索引到截图：截一张图或点「重新扫描」";
      if ((props.query ?? "").trim()) return `没有匹配「${props.query}」的截图`;
      return "没有截图";
    });
    let flashTimer = null;
    function showFlash(text) {
      flash.value = text;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => flash.value = "", 1600);
    }
    async function load() {
      beginBusy();
      try {
        const q = (props.query ?? "").trim();
        const result = await window.api.shotIndex.search(q, true);
        if (result.success) {
          all.value = result.items;
          applyFilter();
        }
        status.value = await window.api.shotIndex.status();
      } finally {
        loading.value = false;
        endBusy();
      }
    }
    function applyFilter() {
      const q = (props.query ?? "").trim().toLowerCase();
      if (!q) {
        items.value = all.value;
      } else {
        items.value = all.value.filter(
          (i) => i.fileName.toLowerCase().includes(q) || (i.ocrText ?? "").toLowerCase().includes(q)
        );
      }
      if (selectedIndex.value >= items.value.length) selectedIndex.value = 0;
    }
    watch(
      () => props.query,
      () => {
        applyFilter();
        selectedIndex.value = 0;
      }
    );
    async function refreshStatus() {
      status.value = await window.api.shotIndex.status();
      const result = await window.api.shotIndex.search((props.query ?? "").trim());
      if (result.success) {
        all.value = result.items;
        applyFilter();
      }
    }
    async function rescan() {
      showFlash("扫描中…");
      await window.api.shotIndex.scan();
      await refreshStatus();
    }
    function ocrSnippet(item) {
      const t = (item.ocrText ?? "").replace(/\s+/g, " ").trim();
      return t.length > 26 ? `${t.slice(0, 26)}…` : t;
    }
    function timeLabel(ts) {
      const d = new Date(ts);
      const now = /* @__PURE__ */ new Date();
      const sameDay = d.toDateString() === now.toDateString();
      const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      if (sameDay) return hm;
      return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
    }
    function fullTimeLabel(ts) {
      const d = new Date(ts);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    function sizeLabel(bytes) {
      if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
      if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
      return `${bytes} B`;
    }
    async function pasteSelected() {
      const item = selected.value;
      if (!item) return;
      const result = await window.api.shotIndex.pastePath(item.filePath);
      if (!result.ok) {
        showFlash(result.error ?? "粘贴失败（内容已复制，可手动 ⌘V）");
      }
    }
    async function copyOcrText() {
      const item = selected.value;
      if (!item?.ocrText) {
        showFlash("该截图暂无识别文本");
        return;
      }
      try {
        await navigator.clipboard.writeText(item.ocrText);
        showFlash("已复制文字");
      } catch {
        showFlash("复制失败");
      }
    }
    function reveal() {
      const item = selected.value;
      if (item) void window.api.fileSearch.reveal(item.filePath);
    }
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const item = selected.value;
        if (item?.ocrText) {
          emit("ask-ai", `以下是从截图 OCR 识别的文字，请按内容判断并解释或翻译：

${item.ocrText}`);
        }
        return true;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void copyOcrText();
        return true;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        reveal();
        return true;
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        void rescan();
        return true;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (items.value.length > 0) selectedIndex.value = (selectedIndex.value + 1) % items.value.length;
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (items.value.length > 0)
          selectedIndex.value = (selectedIndex.value - 1 + items.value.length) % items.value.length;
        return true;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        void pasteSelected();
        return true;
      }
      return false;
    }
    __expose({ handleKey });
    const offChanged = window.api.shotIndex.onChanged(() => void refreshStatus());
    onBeforeUnmount(() => {
      offChanged();
    });
    onMounted(() => {
      void load();
    });
    const __returned__ = { props, emit, loading, items, selectedIndex, status, flash, all, selected, hints, emptyText, get flashTimer() {
      return flashTimer;
    }, set flashTimer(v) {
      flashTimer = v;
    }, showFlash, load, applyFilter, refreshStatus, rescan, ocrSnippet, timeLabel, fullTimeLabel, sizeLabel, pasteSelected, copyOcrText, reveal, handleKey, offChanged, CapsulePage };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { toDisplayString as _toDisplayString, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, createTextVNode as _createTextVNode, Fragment as _Fragment, createElementVNode as _createElementVNode, renderList as _renderList, normalizeClass as _normalizeClass, withCtx as _withCtx, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = { class: "shots-idx" };
const _hoisted_2 = {
  key: 0,
  class: "shots-flash"
};
const _hoisted_3 = { class: "shots-list-pane" };
const _hoisted_4 = { class: "shots-status" };
const _hoisted_5 = {
  key: 0,
  class: "shots-empty"
};
const _hoisted_6 = {
  key: 1,
  class: "shots-empty"
};
const _hoisted_7 = {
  key: 2,
  class: "shots-list"
};
const _hoisted_8 = ["onMouseenter"];
const _hoisted_9 = ["src"];
const _hoisted_10 = { class: "shots-text" };
const _hoisted_11 = { class: "shots-title" };
const _hoisted_12 = { class: "shots-sub" };
const _hoisted_13 = { class: "shots-detail-pane" };
const _hoisted_14 = {
  key: 0,
  class: "shots-detail"
};
const _hoisted_15 = ["src"];
const _hoisted_16 = { class: "shots-meta" };
const _hoisted_17 = { class: "shots-meta-row" };
const _hoisted_18 = { class: "shots-meta-val" };
const _hoisted_19 = { class: "shots-meta-row" };
const _hoisted_20 = { class: "shots-meta-val" };
const _hoisted_21 = { class: "shots-meta-row" };
const _hoisted_22 = { class: "shots-meta-val" };
const _hoisted_23 = {
  key: 0,
  class: "shots-ocr"
};
const _hoisted_24 = {
  key: 1,
  class: "shots-empty"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["CapsulePage"], { hints: $setup.hints }, {
    default: _withCtx(() => [
      _createElementVNode("div", _hoisted_1, [
        $setup.flash ? (_openBlock(), _createElementBlock(
          "div",
          _hoisted_2,
          _toDisplayString($setup.flash),
          1
          /* TEXT */
        )) : _createCommentVNode("v-if", true),
        _createCommentVNode(" 左栏：状态条 + 列表 "),
        _createElementVNode("div", _hoisted_3, [
          _createElementVNode("div", _hoisted_4, [
            $setup.status.scanning || $setup.status.pending > 0 ? (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 0 },
              [
                _createTextVNode(
                  " OCR 索引中 " + _toDisplayString($setup.status.done) + "/" + _toDisplayString($setup.status.total),
                  1
                  /* TEXT */
                )
              ],
              64
              /* STABLE_FRAGMENT */
            )) : $setup.status.total > 0 ? (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 1 },
              [
                _createTextVNode(
                  "已索引 " + _toDisplayString($setup.status.total) + " 张截图",
                  1
                  /* TEXT */
                )
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 2 },
              [
                _createTextVNode("尚未索引")
              ],
              64
              /* STABLE_FRAGMENT */
            )),
            _createElementVNode("button", {
              class: "shots-rescan",
              type: "button",
              onClick: $setup.rescan
            }, "重新扫描")
          ]),
          $setup.loading ? (_openBlock(), _createElementBlock("div", _hoisted_5, "加载截图索引中…")) : $setup.items.length === 0 ? (_openBlock(), _createElementBlock(
            "div",
            _hoisted_6,
            _toDisplayString($setup.emptyText),
            1
            /* TEXT */
          )) : (_openBlock(), _createElementBlock("div", _hoisted_7, [
            (_openBlock(true), _createElementBlock(
              _Fragment,
              null,
              _renderList($setup.items, (item, i) => {
                return _openBlock(), _createElementBlock("div", {
                  key: item.filePath,
                  class: _normalizeClass(["shots-item", { selected: i === $setup.selectedIndex }]),
                  onMouseenter: ($event) => $setup.selectedIndex = i,
                  onClick: _cache[0] || (_cache[0] = ($event) => $setup.pasteSelected())
                }, [
                  _createElementVNode("img", {
                    class: "shots-thumb",
                    src: `image://${encodeURI(item.filePath)}`,
                    alt: ""
                  }, null, 8, _hoisted_9),
                  _createElementVNode("div", _hoisted_10, [
                    _createElementVNode(
                      "div",
                      _hoisted_11,
                      _toDisplayString(item.fileName),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("div", _hoisted_12, [
                      _createTextVNode(
                        _toDisplayString($setup.timeLabel(item.capturedAt)),
                        1
                        /* TEXT */
                      ),
                      $setup.ocrSnippet(item) ? (_openBlock(), _createElementBlock(
                        _Fragment,
                        { key: 0 },
                        [
                          _createTextVNode(
                            " · " + _toDisplayString($setup.ocrSnippet(item)),
                            1
                            /* TEXT */
                          )
                        ],
                        64
                        /* STABLE_FRAGMENT */
                      )) : _createCommentVNode("v-if", true)
                    ])
                  ])
                ], 42, _hoisted_8);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ]))
        ]),
        _createCommentVNode(" 右栏：详情（大图预览 + OCR 文本） "),
        _createElementVNode("div", _hoisted_13, [
          $setup.selected ? (_openBlock(), _createElementBlock("div", _hoisted_14, [
            _createElementVNode("img", {
              class: "shots-preview",
              src: `image://${encodeURI($setup.selected.filePath)}`,
              alt: ""
            }, null, 8, _hoisted_15),
            _createElementVNode("div", _hoisted_16, [
              _createElementVNode("div", _hoisted_17, [
                _cache[1] || (_cache[1] = _createElementVNode(
                  "span",
                  { class: "shots-meta-key" },
                  "名称",
                  -1
                  /* CACHED */
                )),
                _createElementVNode(
                  "span",
                  _hoisted_18,
                  _toDisplayString($setup.selected.fileName),
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("div", _hoisted_19, [
                _cache[2] || (_cache[2] = _createElementVNode(
                  "span",
                  { class: "shots-meta-key" },
                  "大小",
                  -1
                  /* CACHED */
                )),
                _createElementVNode(
                  "span",
                  _hoisted_20,
                  _toDisplayString($setup.sizeLabel($setup.selected.fileSize)),
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("div", _hoisted_21, [
                _cache[3] || (_cache[3] = _createElementVNode(
                  "span",
                  { class: "shots-meta-key" },
                  "时间",
                  -1
                  /* CACHED */
                )),
                _createElementVNode(
                  "span",
                  _hoisted_22,
                  _toDisplayString($setup.fullTimeLabel($setup.selected.capturedAt)),
                  1
                  /* TEXT */
                )
              ]),
              $setup.selected.ocrText ? (_openBlock(), _createElementBlock(
                "div",
                _hoisted_23,
                _toDisplayString($setup.selected.ocrText),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true)
            ])
          ])) : (_openBlock(), _createElementBlock("div", _hoisted_24, "选择左侧截图查看预览"))
        ])
      ])
    ]),
    _: 1
    /* STABLE */
  });
}
import "/src/launcher/pages/ShotsIndexPage.vue?vue&type=style&index=0&scoped=8f50a471&lang.css";
_sfc_main.__hmrId = "8f50a471";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-8f50a471"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/launcher/pages/ShotsIndexPage.vue"]]);

//# sourceMappingURL=data:application/json;base64,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LE9BZE4sYUFjTTtBQUFBLGNBYkosb0JBR00sT0FITixhQUdNO0FBQUEsMENBRko7QUFBQSxrQkFBc0M7QUFBQSxvQkFBaEMsT0FBTSxpQkFBZ0I7QUFBQSxrQkFBQztBQUFBLGtCQUFFO0FBQUE7QUFBQTtBQUFBLGdCQUMvQjtBQUFBLGtCQUEyRDtBQUFBLGtCQUEzRDtBQUFBLGtCQUEyRCxpQkFBM0IsZ0JBQVMsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBO2NBRW5ELG9CQUdNLE9BSE4sYUFHTTtBQUFBLDBDQUZKO0FBQUEsa0JBQXNDO0FBQUEsb0JBQWhDLE9BQU0saUJBQWdCO0FBQUEsa0JBQUM7QUFBQSxrQkFBRTtBQUFBO0FBQUE7QUFBQSxnQkFDL0I7QUFBQSxrQkFBc0U7QUFBQSxrQkFBdEU7QUFBQSxrQkFBc0UsaUJBQXRDLGlCQUFVLGdCQUFTLFFBQVE7QUFBQTtBQUFBO0FBQUE7QUFBQTtjQUU3RCxvQkFHTSxPQUhOLGFBR007QUFBQSwwQ0FGSjtBQUFBLGtCQUFzQztBQUFBLG9CQUFoQyxPQUFNLGlCQUFnQjtBQUFBLGtCQUFDO0FBQUEsa0JBQUU7QUFBQTtBQUFBO0FBQUEsZ0JBQy9CO0FBQUEsa0JBQTRFO0FBQUEsa0JBQTVFO0FBQUEsa0JBQTRFLGlCQUE1QyxxQkFBYyxnQkFBUyxVQUFVO0FBQUE7QUFBQTtBQUFBO0FBQUE7Y0FFeEQsZ0JBQVMseUJBQXBCO0FBQUEsZ0JBQTJFO0FBQUEsZ0JBQTNFO0FBQUEsZ0JBQTJFLGlCQUF6QixnQkFBUyxPQUFPO0FBQUE7QUFBQTtBQUFBOzsrQkFHdEUsb0JBQWdELE9BQWhELGFBQWdDLFlBQVU7QUFBQSIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiU2hvdHNJbmRleFBhZ2UudnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjx0ZW1wbGF0ZT5cbiAgPENhcHN1bGVQYWdlIDpoaW50cz1cImhpbnRzXCI+XG4gICAgPGRpdiBjbGFzcz1cInNob3RzLWlkeFwiPlxuICAgICAgPGRpdiB2LWlmPVwiZmxhc2hcIiBjbGFzcz1cInNob3RzLWZsYXNoXCI+e3sgZmxhc2ggfX08L2Rpdj5cblxuICAgICAgPCEtLSDlt6bmoI/vvJrnirbmgIHmnaEgKyDliJfooaggLS0+XG4gICAgICA8ZGl2IGNsYXNzPVwic2hvdHMtbGlzdC1wYW5lXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzaG90cy1zdGF0dXNcIj5cbiAgICAgICAgICA8dGVtcGxhdGUgdi1pZj1cInN0YXR1cy5zY2FubmluZyB8fCBzdGF0dXMucGVuZGluZyA+IDBcIj5cbiAgICAgICAgICAgIE9DUiDntKLlvJXkuK0ge3sgc3RhdHVzLmRvbmUgfX0ve3sgc3RhdHVzLnRvdGFsIH19XG4gICAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgICAgICA8dGVtcGxhdGUgdi1lbHNlLWlmPVwic3RhdHVzLnRvdGFsID4gMFwiPuW3sue0ouW8lSB7eyBzdGF0dXMudG90YWwgfX0g5byg5oiq5Zu+PC90ZW1wbGF0ZT5cbiAgICAgICAgICA8dGVtcGxhdGUgdi1lbHNlPuWwmuacque0ouW8lTwvdGVtcGxhdGU+XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cInNob3RzLXJlc2NhblwiIHR5cGU9XCJidXR0b25cIiBAY2xpY2s9XCJyZXNjYW5cIj7ph43mlrDmiavmj488L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiB2LWlmPVwibG9hZGluZ1wiIGNsYXNzPVwic2hvdHMtZW1wdHlcIj7liqDovb3miKrlm77ntKLlvJXkuK3igKY8L2Rpdj5cbiAgICAgICAgPGRpdiB2LWVsc2UtaWY9XCJpdGVtcy5sZW5ndGggPT09IDBcIiBjbGFzcz1cInNob3RzLWVtcHR5XCI+XG4gICAgICAgICAge3sgZW1wdHlUZXh0IH19XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IHYtZWxzZSBjbGFzcz1cInNob3RzLWxpc3RcIj5cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICB2LWZvcj1cIihpdGVtLCBpKSBpbiBpdGVtc1wiXG4gICAgICAgICAgICA6a2V5PVwiaXRlbS5maWxlUGF0aFwiXG4gICAgICAgICAgICBjbGFzcz1cInNob3RzLWl0ZW1cIlxuICAgICAgICAgICAgOmNsYXNzPVwieyBzZWxlY3RlZDogaSA9PT0gc2VsZWN0ZWRJbmRleCB9XCJcbiAgICAgICAgICAgIEBtb3VzZWVudGVyPVwic2VsZWN0ZWRJbmRleCA9IGlcIlxuICAgICAgICAgICAgQGNsaWNrPVwicGFzdGVTZWxlY3RlZCgpXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8aW1nIGNsYXNzPVwic2hvdHMtdGh1bWJcIiA6c3JjPVwiYGltYWdlOi8vJHtlbmNvZGVVUkkoaXRlbS5maWxlUGF0aCl9YFwiIGFsdD1cIlwiIC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2hvdHMtdGV4dFwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2hvdHMtdGl0bGVcIj57eyBpdGVtLmZpbGVOYW1lIH19PC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzaG90cy1zdWJcIj5cbiAgICAgICAgICAgICAgICB7eyB0aW1lTGFiZWwoaXRlbS5jYXB0dXJlZEF0KVxuICAgICAgICAgICAgICAgIH19PHRlbXBsYXRlIHYtaWY9XCJvY3JTbmlwcGV0KGl0ZW0pXCI+IMK3IHt7IG9jclNuaXBwZXQoaXRlbSkgfX08L3RlbXBsYXRlPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8IS0tIOWPs+agj++8muivpuaDhe+8iOWkp+WbvumihOiniCArIE9DUiDmlofmnKzvvIkgLS0+XG4gICAgICA8ZGl2IGNsYXNzPVwic2hvdHMtZGV0YWlsLXBhbmVcIj5cbiAgICAgICAgPGRpdiB2LWlmPVwic2VsZWN0ZWRcIiBjbGFzcz1cInNob3RzLWRldGFpbFwiPlxuICAgICAgICAgIDxpbWcgY2xhc3M9XCJzaG90cy1wcmV2aWV3XCIgOnNyYz1cImBpbWFnZTovLyR7ZW5jb2RlVVJJKHNlbGVjdGVkLmZpbGVQYXRoKX1gXCIgYWx0PVwiXCIgLz5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwic2hvdHMtbWV0YVwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNob3RzLW1ldGEtcm93XCI+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic2hvdHMtbWV0YS1rZXlcIj7lkI3np7A8L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic2hvdHMtbWV0YS12YWxcIj57eyBzZWxlY3RlZC5maWxlTmFtZSB9fTwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNob3RzLW1ldGEtcm93XCI+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic2hvdHMtbWV0YS1rZXlcIj7lpKflsI88L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic2hvdHMtbWV0YS12YWxcIj57eyBzaXplTGFiZWwoc2VsZWN0ZWQuZmlsZVNpemUpIH19PC9zcGFuPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2hvdHMtbWV0YS1yb3dcIj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzaG90cy1tZXRhLWtleVwiPuaXtumXtDwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzaG90cy1tZXRhLXZhbFwiPnt7IGZ1bGxUaW1lTGFiZWwoc2VsZWN0ZWQuY2FwdHVyZWRBdCkgfX08L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgdi1pZj1cInNlbGVjdGVkLm9jclRleHRcIiBjbGFzcz1cInNob3RzLW9jclwiPnt7IHNlbGVjdGVkLm9jclRleHQgfX08L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgdi1lbHNlIGNsYXNzPVwic2hvdHMtZW1wdHlcIj7pgInmi6nlt6bkvqfmiKrlm77mn6XnnIvpooTop4g8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICA8L0NhcHN1bGVQYWdlPlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbi8qKlxuICog5oiq5Zu+5bqT5YaF6IGU6aG177yIVjQgUDEtMTDvvIzlr7npvZAgUmF5Y2FzdCBTZWFyY2ggU2NyZWVuc2hvdHPvvInvvJpcbiAqIOaMieWbvuWGheaWh+Wtl++8iE9DUu+8iS8g5paH5Lu25ZCN5pCc57Si5pei5pyJ5oiq5Zu+77yM5Zue6L2m5oqK6YCJ5Lit5oiq5Zu+57KY6LS05Yiw5YmN5Y+w5bqU55So77yMXG4gKiDijJhDIOWkjeWItiBPQ1Ig5paH5pys77yM4oyYTyDlnKggRmluZGVyIOS4reaYvuekuu+8jFIg6YeN5paw5omr5o+P44CCXG4gKiBPQ1Ig6L+b5bqm57uPIHNob3RpZHg6Y2hhbmdlZCDmjqjpgIHliLfmlrDvvIjkuLvov5vnqIvmuJDov5vlm57loavvvInjgIJcbiAqL1xuaW1wb3J0IHsgY29tcHV0ZWQsIG9uQmVmb3JlVW5tb3VudCwgb25Nb3VudGVkLCByZWYsIHdhdGNoIH0gZnJvbSAndnVlJ1xuaW1wb3J0IHsgYmVnaW5CdXN5LCBlbmRCdXN5IH0gZnJvbSAnLi4vY29tcG9zYWJsZXMvdXNlTGF1bmNoZXJCdXN5J1xuaW1wb3J0IENhcHN1bGVQYWdlIGZyb20gJy4vQ2Fwc3VsZVBhZ2UudnVlJ1xuXG5pbnRlcmZhY2UgU2hvdEl0ZW0ge1xuICBmaWxlUGF0aDogc3RyaW5nXG4gIGZpbGVOYW1lOiBzdHJpbmdcbiAgZmlsZVNpemU6IG51bWJlclxuICBtdGltZTogbnVtYmVyXG4gIGNhcHR1cmVkQXQ6IG51bWJlclxuICBvY3JTdGF0dXM6ICdwZW5kaW5nJyB8ICdkb25lJyB8ICdmYWlsZWQnXG4gIG9jclRleHQ6IHN0cmluZyB8IG51bGxcbn1cblxuY29uc3QgcHJvcHMgPSBkZWZpbmVQcm9wczx7IHF1ZXJ5Pzogc3RyaW5nIH0+KClcbmNvbnN0IGVtaXQgPSBkZWZpbmVFbWl0czx7ICdhc2stYWknOiBbdGV4dDogc3RyaW5nXSB9PigpXG5cbmNvbnN0IGxvYWRpbmcgPSByZWYodHJ1ZSlcbmNvbnN0IGl0ZW1zID0gcmVmPFNob3RJdGVtW10+KFtdKVxuY29uc3Qgc2VsZWN0ZWRJbmRleCA9IHJlZigwKVxuY29uc3Qgc3RhdHVzID0gcmVmKHsgdG90YWw6IDAsIHBlbmRpbmc6IDAsIGRvbmU6IDAsIGZhaWxlZDogMCwgc2Nhbm5pbmc6IGZhbHNlIH0pXG5jb25zdCBmbGFzaCA9IHJlZignJylcbmNvbnN0IGFsbCA9IHJlZjxTaG90SXRlbVtdPihbXSlcblxuY29uc3Qgc2VsZWN0ZWQgPSBjb21wdXRlZDxTaG90SXRlbSB8IG51bGw+KCgpID0+IGl0ZW1zLnZhbHVlW3NlbGVjdGVkSW5kZXgudmFsdWVdID8/IG51bGwpXG5cbmNvbnN0IGhpbnRzID0gW1xuICB7IGtleXM6ICfihrUnLCBsYWJlbDogJ+eymOi0tOWIsOWJjeWPsCcgfSxcbiAgeyBrZXlzOiAn4oyYQycsIGxhYmVsOiAn5aSN5Yi25paH5a2XJyB9LFxuICB7IGtleXM6ICfijJhBJywgbGFiZWw6ICfpl64gQUknIH0sXG4gIHsga2V5czogJ+KMmE8nLCBsYWJlbDogJ0ZpbmRlciDmmL7npLonIH0sXG4gIHsga2V5czogJ1InLCBsYWJlbDogJ+mHjeaWsOaJq+aPjycgfSxcbiAgeyBrZXlzOiAnRVNDJywgbGFiZWw6ICfov5Tlm54nIH1cbl1cblxuY29uc3QgZW1wdHlUZXh0ID0gY29tcHV0ZWQoKCkgPT4ge1xuICBpZiAoc3RhdHVzLnZhbHVlLnRvdGFsID09PSAwKSByZXR1cm4gJ+acque0ouW8leWIsOaIquWbvu+8muaIquS4gOW8oOWbvuaIlueCueOAjOmHjeaWsOaJq+aPj+OAjSdcbiAgaWYgKChwcm9wcy5xdWVyeSA/PyAnJykudHJpbSgpKSByZXR1cm4gYOayoeacieWMuemFjeOAjCR7cHJvcHMucXVlcnl944CN55qE5oiq5Zu+YFxuICByZXR1cm4gJ+ayoeacieaIquWbvidcbn0pXG5cbmxldCBmbGFzaFRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGwgPSBudWxsXG5mdW5jdGlvbiBzaG93Rmxhc2godGV4dDogc3RyaW5nKTogdm9pZCB7XG4gIGZsYXNoLnZhbHVlID0gdGV4dFxuICBpZiAoZmxhc2hUaW1lcikgY2xlYXJUaW1lb3V0KGZsYXNoVGltZXIpXG4gIGZsYXNoVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IChmbGFzaC52YWx1ZSA9ICcnKSwgMTYwMClcbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYmVnaW5CdXN5KCkgLy8gSTkg57uf5LiA5Yqg6L295oCBXG4gIHRyeSB7XG4gICAgY29uc3QgcSA9IChwcm9wcy5xdWVyeSA/PyAnJykudHJpbSgpXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2luZG93LmFwaS5zaG90SW5kZXguc2VhcmNoKHEsIHRydWUpXG4gICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICBhbGwudmFsdWUgPSByZXN1bHQuaXRlbXNcbiAgICAgIGFwcGx5RmlsdGVyKClcbiAgICB9XG4gICAgc3RhdHVzLnZhbHVlID0gYXdhaXQgd2luZG93LmFwaS5zaG90SW5kZXguc3RhdHVzKClcbiAgfSBmaW5hbGx5IHtcbiAgICBsb2FkaW5nLnZhbHVlID0gZmFsc2VcbiAgICBlbmRCdXN5KClcbiAgfVxufVxuXG4vKiog5a6i5oi356uv5LqM5qyh6L+H5ruk77yac3RhdHVzL09DUiDov5vluqbmjqjpgIHkvJrph43mi4kgYWxs77yM5L+d55WZ6L6T5YWl5Lit55qE562b6YCJ5L2T6aqMICovXG5mdW5jdGlvbiBhcHBseUZpbHRlcigpOiB2b2lkIHtcbiAgY29uc3QgcSA9IChwcm9wcy5xdWVyeSA/PyAnJykudHJpbSgpLnRvTG93ZXJDYXNlKClcbiAgaWYgKCFxKSB7XG4gICAgaXRlbXMudmFsdWUgPSBhbGwudmFsdWVcbiAgfSBlbHNlIHtcbiAgICBpdGVtcy52YWx1ZSA9IGFsbC52YWx1ZS5maWx0ZXIoXG4gICAgICAoaSkgPT4gaS5maWxlTmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8IChpLm9jclRleHQgPz8gJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSlcbiAgICApXG4gIH1cbiAgaWYgKHNlbGVjdGVkSW5kZXgudmFsdWUgPj0gaXRlbXMudmFsdWUubGVuZ3RoKSBzZWxlY3RlZEluZGV4LnZhbHVlID0gMFxufVxuXG53YXRjaChcbiAgKCkgPT4gcHJvcHMucXVlcnksXG4gICgpID0+IHtcbiAgICBhcHBseUZpbHRlcigpXG4gICAgc2VsZWN0ZWRJbmRleC52YWx1ZSA9IDBcbiAgfVxuKVxuXG5hc3luYyBmdW5jdGlvbiByZWZyZXNoU3RhdHVzKCk6IFByb21pc2U8dm9pZD4ge1xuICBzdGF0dXMudmFsdWUgPSBhd2FpdCB3aW5kb3cuYXBpLnNob3RJbmRleC5zdGF0dXMoKVxuICAvLyBPQ1Ig5riQ6L+b5Zue5aGrIOKGkiDph43mi4nvvIjovbvph4/vvJrku4XliJfooajmlbDmja7vvIlcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2luZG93LmFwaS5zaG90SW5kZXguc2VhcmNoKChwcm9wcy5xdWVyeSA/PyAnJykudHJpbSgpKVxuICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICBhbGwudmFsdWUgPSByZXN1bHQuaXRlbXNcbiAgICBhcHBseUZpbHRlcigpXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVzY2FuKCk6IFByb21pc2U8dm9pZD4ge1xuICBzaG93Rmxhc2goJ+aJq+aPj+S4reKApicpXG4gIGF3YWl0IHdpbmRvdy5hcGkuc2hvdEluZGV4LnNjYW4oKVxuICBhd2FpdCByZWZyZXNoU3RhdHVzKClcbn1cblxuZnVuY3Rpb24gb2NyU25pcHBldChpdGVtOiBTaG90SXRlbSk6IHN0cmluZyB7XG4gIGNvbnN0IHQgPSAoaXRlbS5vY3JUZXh0ID8/ICcnKS5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpXG4gIHJldHVybiB0Lmxlbmd0aCA+IDI2ID8gYCR7dC5zbGljZSgwLCAyNil94oCmYCA6IHRcbn1cblxuZnVuY3Rpb24gdGltZUxhYmVsKHRzOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBkID0gbmV3IERhdGUodHMpXG4gIGNvbnN0IG5vdyA9IG5ldyBEYXRlKClcbiAgY29uc3Qgc2FtZURheSA9IGQudG9EYXRlU3RyaW5nKCkgPT09IG5vdy50b0RhdGVTdHJpbmcoKVxuICBjb25zdCBobSA9IGAke1N0cmluZyhkLmdldEhvdXJzKCkpLnBhZFN0YXJ0KDIsICcwJyl9OiR7U3RyaW5nKGQuZ2V0TWludXRlcygpKS5wYWRTdGFydCgyLCAnMCcpfWBcbiAgaWYgKHNhbWVEYXkpIHJldHVybiBobVxuICByZXR1cm4gYCR7ZC5nZXRNb250aCgpICsgMX0vJHtkLmdldERhdGUoKX0gJHtobX1gXG59XG5cbmZ1bmN0aW9uIGZ1bGxUaW1lTGFiZWwodHM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IGQgPSBuZXcgRGF0ZSh0cylcbiAgY29uc3QgcGFkID0gKG46IG51bWJlcik6IHN0cmluZyA9PiBTdHJpbmcobikucGFkU3RhcnQoMiwgJzAnKVxuICByZXR1cm4gYCR7ZC5nZXRGdWxsWWVhcigpfS0ke3BhZChkLmdldE1vbnRoKCkgKyAxKX0tJHtwYWQoZC5nZXREYXRlKCkpfSAke3BhZChkLmdldEhvdXJzKCkpfToke3BhZChkLmdldE1pbnV0ZXMoKSl9YFxufVxuXG5mdW5jdGlvbiBzaXplTGFiZWwoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmIChieXRlcyA+PSAxMDI0ICogMTAyNCkgcmV0dXJuIGAkeyhieXRlcyAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDEpfSBNQmBcbiAgaWYgKGJ5dGVzID49IDEwMjQpIHJldHVybiBgJHtNYXRoLnJvdW5kKGJ5dGVzIC8gMTAyNCl9IEtCYFxuICByZXR1cm4gYCR7Ynl0ZXN9IEJgXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHBhc3RlU2VsZWN0ZWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGl0ZW0gPSBzZWxlY3RlZC52YWx1ZVxuICBpZiAoIWl0ZW0pIHJldHVyblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCB3aW5kb3cuYXBpLnNob3RJbmRleC5wYXN0ZVBhdGgoaXRlbS5maWxlUGF0aClcbiAgaWYgKCFyZXN1bHQub2spIHtcbiAgICBzaG93Rmxhc2gocmVzdWx0LmVycm9yID8/ICfnspjotLTlpLHotKXvvIjlhoXlrrnlt7LlpI3liLbvvIzlj6/miYvliqgg4oyYVu+8iScpXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY29weU9jclRleHQoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGl0ZW0gPSBzZWxlY3RlZC52YWx1ZVxuICBpZiAoIWl0ZW0/Lm9jclRleHQpIHtcbiAgICBzaG93Rmxhc2goJ+ivpeaIquWbvuaaguaXoOivhuWIq+aWh+acrCcpXG4gICAgcmV0dXJuXG4gIH1cbiAgdHJ5IHtcbiAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChpdGVtLm9jclRleHQpXG4gICAgc2hvd0ZsYXNoKCflt7LlpI3liLbmloflrZcnKVxuICB9IGNhdGNoIHtcbiAgICBzaG93Rmxhc2goJ+WkjeWItuWksei0pScpXG4gIH1cbn1cblxuZnVuY3Rpb24gcmV2ZWFsKCk6IHZvaWQge1xuICBjb25zdCBpdGVtID0gc2VsZWN0ZWQudmFsdWVcbiAgaWYgKGl0ZW0pIHZvaWQgd2luZG93LmFwaS5maWxlU2VhcmNoLnJldmVhbChpdGVtLmZpbGVQYXRoKVxufVxuXG4vKiog6ZSu55uY5YiG5Y+R77yITGF1bmNoZXJBcHAg6ZuG5Lit6L2s5Y+R77yJ77yb6L+U5ZueIHRydWUg6KGo56S65bey5raI6LS5ICovXG5mdW5jdGlvbiBoYW5kbGVLZXkoZTogS2V5Ym9hcmRFdmVudCk6IGJvb2xlYW4ge1xuICAvLyDijJhB77ya5oqK5Zu+5YaF5paH5a2X5Lqk57uZIEFJIOino+mHii/nv7vor5HvvIhWNCDmibnmrKE177yJXG4gIGlmICgoZS5tZXRhS2V5IHx8IGUuY3RybEtleSkgJiYgZS5rZXkudG9Mb3dlckNhc2UoKSA9PT0gJ2EnKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgY29uc3QgaXRlbSA9IHNlbGVjdGVkLnZhbHVlXG4gICAgaWYgKGl0ZW0/Lm9jclRleHQpIHtcbiAgICAgIGVtaXQoJ2Fzay1haScsIGDku6XkuIvmmK/ku47miKrlm74gT0NSIOivhuWIq+eahOaWh+Wtl++8jOivt+aMieWGheWuueWIpOaWreW5tuino+mHiuaIlue/u+ivke+8mlxcblxcbiR7aXRlbS5vY3JUZXh0fWApXG4gICAgfVxuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgaWYgKChlLm1ldGFLZXkgfHwgZS5jdHJsS2V5KSAmJiBlLmtleS50b0xvd2VyQ2FzZSgpID09PSAnYycpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICB2b2lkIGNvcHlPY3JUZXh0KClcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIGlmICgoZS5tZXRhS2V5IHx8IGUuY3RybEtleSkgJiYgZS5rZXkudG9Mb3dlckNhc2UoKSA9PT0gJ28nKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgcmV2ZWFsKClcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIGlmICghZS5tZXRhS2V5ICYmICFlLmN0cmxLZXkgJiYgIWUuYWx0S2V5ICYmIGUua2V5LnRvTG93ZXJDYXNlKCkgPT09ICdyJykge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIHZvaWQgcmVzY2FuKClcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIGlmIChlLmtleSA9PT0gJ0Fycm93RG93bicpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBpZiAoaXRlbXMudmFsdWUubGVuZ3RoID4gMCkgc2VsZWN0ZWRJbmRleC52YWx1ZSA9IChzZWxlY3RlZEluZGV4LnZhbHVlICsgMSkgJSBpdGVtcy52YWx1ZS5sZW5ndGhcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIGlmIChlLmtleSA9PT0gJ0Fycm93VXAnKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgaWYgKGl0ZW1zLnZhbHVlLmxlbmd0aCA+IDApXG4gICAgICBzZWxlY3RlZEluZGV4LnZhbHVlID0gKHNlbGVjdGVkSW5kZXgudmFsdWUgLSAxICsgaXRlbXMudmFsdWUubGVuZ3RoKSAlIGl0ZW1zLnZhbHVlLmxlbmd0aFxuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgdm9pZCBwYXN0ZVNlbGVjdGVkKClcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIHJldHVybiBmYWxzZVxufVxuXG5kZWZpbmVFeHBvc2UoeyBoYW5kbGVLZXkgfSlcblxuY29uc3Qgb2ZmQ2hhbmdlZCA9IHdpbmRvdy5hcGkuc2hvdEluZGV4Lm9uQ2hhbmdlZCgoKSA9PiB2b2lkIHJlZnJlc2hTdGF0dXMoKSlcbm9uQmVmb3JlVW5tb3VudCgoKSA9PiB7XG4gIC8vIOiDtuWbiuaYr+W4uOmpuyBTUEHvvJrot6/nlLHov5vlh7rkuI3op6blj5EgdW5sb2Fk77yM5b+F6aG75pi+5byP6YCA6K6i77yI5a6h5p+lIEky77yJXG4gIG9mZkNoYW5nZWQoKVxufSlcblxub25Nb3VudGVkKCgpID0+IHtcbiAgdm9pZCBsb2FkKClcbn0pXG48L3NjcmlwdD5cblxuPHN0eWxlIHNjb3BlZD5cbi5zaG90cy1pZHgge1xuICBkaXNwbGF5OiBmbGV4O1xuICBtaW4taGVpZ2h0OiAwO1xuICBmbGV4OiAxO1xuICBoZWlnaHQ6IDEwMCU7XG4gIHBvc2l0aW9uOiByZWxhdGl2ZTtcbn1cblxuLnNob3RzLWZsYXNoIHtcbiAgcG9zaXRpb246IGFic29sdXRlO1xuICB0b3A6IDhweDtcbiAgbGVmdDogNTAlO1xuICB6LWluZGV4OiAxMDtcbiAgcGFkZGluZzogNHB4IDEycHg7XG4gIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQpO1xuICBjb2xvcjogI2ZmZjtcbiAgZm9udC1zaXplOiAxMXB4O1xuICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG59XG5cbi5zaG90cy1saXN0LXBhbmUge1xuICBkaXNwbGF5OiBmbGV4O1xuICBtaW4td2lkdGg6IDA7XG4gIGZsZXg6IDE7XG4gIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gIGJvcmRlci1yaWdodDogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG59XG5cbi5zaG90cy1zdGF0dXMge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gIHBhZGRpbmc6IDZweCAxMnB4O1xuICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYm9yZGVyKTtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICBmb250LXNpemU6IDEwcHg7XG59XG5cbi5zaG90cy1yZXNjYW4ge1xuICBib3JkZXI6IG5vbmU7XG4gIGJhY2tncm91bmQ6IG5vbmU7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBmb250LXNpemU6IDEwcHg7XG59XG5cbi5zaG90cy1yZXNjYW46aG92ZXIge1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG59XG5cbi5zaG90cy1lbXB0eSB7XG4gIHBhZGRpbmc6IDI0cHggMTZweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICBmb250LXNpemU6IDEycHg7XG4gIHRleHQtYWxpZ246IGNlbnRlcjtcbn1cblxuLnNob3RzLWxpc3Qge1xuICBmbGV4OiAxO1xuICBvdmVyZmxvdy15OiBhdXRvO1xufVxuXG4uc2hvdHMtaXRlbSB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGdhcDogMTBweDtcbiAgcGFkZGluZzogNnB4IDEycHg7XG4gIGN1cnNvcjogcG9pbnRlcjtcbn1cblxuLnNob3RzLWl0ZW0uc2VsZWN0ZWQge1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQtc29mdCk7XG59XG5cbi5zaG90cy10aHVtYiB7XG4gIHdpZHRoOiA0NHB4O1xuICBoZWlnaHQ6IDMwcHg7XG4gIGZsZXgtc2hyaW5rOiAwO1xuICBib3JkZXItcmFkaXVzOiA0cHg7XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIG9iamVjdC1maXQ6IGNvdmVyO1xufVxuXG4uc2hvdHMtdGV4dCB7XG4gIG1pbi13aWR0aDogMDtcbiAgZmxleDogMTtcbn1cblxuLnNob3RzLXRpdGxlIHtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgZm9udC1zaXplOiAxMnB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xufVxuXG4uc2hvdHMtc3ViIHtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgbWFyZ2luLXRvcDogMXB4O1xuICBmb250LXNpemU6IDEwcHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbiAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gIHdoaXRlLXNwYWNlOiBub3dyYXA7XG59XG5cbi5zaG90cy1kZXRhaWwtcGFuZSB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIHdpZHRoOiAzMDBweDtcbiAgZmxleC1zaHJpbms6IDA7XG4gIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG59XG5cbi5zaG90cy1kZXRhaWwge1xuICBkaXNwbGF5OiBmbGV4O1xuICBtaW4taGVpZ2h0OiAwO1xuICBmbGV4OiAxO1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBwYWRkaW5nOiAxMHB4O1xufVxuXG4uc2hvdHMtcHJldmlldyB7XG4gIG1heC1oZWlnaHQ6IDQwJTtcbiAgd2lkdGg6IDEwMCU7XG4gIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYm9yZGVyKTtcbiAgb2JqZWN0LWZpdDogY29udGFpbjtcbn1cblxuLnNob3RzLW1ldGEge1xuICBtYXJnaW4tdG9wOiA4cHg7XG4gIG92ZXJmbG93LXk6IGF1dG87XG59XG5cbi5zaG90cy1tZXRhLXJvdyB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGdhcDogOHB4O1xuICBtYXJnaW4tYm90dG9tOiA0cHg7XG4gIGZvbnQtc2l6ZTogMTFweDtcbn1cblxuLnNob3RzLW1ldGEta2V5IHtcbiAgZmxleC1zaHJpbms6IDA7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbn1cblxuLnNob3RzLW1ldGEtdmFsIHtcbiAgbWluLXdpZHRoOiAwO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xufVxuXG4uc2hvdHMtb2NyIHtcbiAgbWFyZ2luLXRvcDogNnB4O1xuICBwYWRkaW5nOiA4cHg7XG4gIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYmctZWxldmF0ZWQpO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1kaW0pO1xuICBmb250LXNpemU6IDExcHg7XG4gIGxpbmUtaGVpZ2h0OiAxLjY7XG4gIHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcbiAgd29yZC1icmVhazogYnJlYWstd29yZDtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL2xhdW5jaGVyL3BhZ2VzL1Nob3RzSW5kZXhQYWdlLnZ1ZSJ9