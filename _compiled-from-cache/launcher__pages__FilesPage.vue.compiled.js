import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/launcher/pages/FilesPage.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { computed, onMounted, ref, watch } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import AppIcon from "/src/components/AppIcon.vue";
import CapsulePage from "/src/launcher/pages/CapsulePage.vue";
import { formatSmartDate } from "/src/utils/format.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "FilesPage",
  props: {
    query: { type: String, required: true }
  },
  setup(__props, { expose: __expose }) {
    const props = __props;
    const items = ref([]);
    const loading = ref(false);
    const supported = ref(true);
    const selectedIndex = ref(0);
    const mode = ref("name");
    const onlyIn = ref("");
    let searchTimer = null;
    const selected = computed(() => items.value[selectedIndex.value] ?? null);
    const hints = [
      { keys: "↵", label: "打开" },
      { keys: "⌘R", label: "在 Finder 显示" },
      { keys: "⌘C", label: "复制路径" },
      { keys: "ESC", label: "返回" }
    ];
    function fileIcon(name) {
      const ext = name.split(".").pop()?.toLowerCase() ?? "";
      const iconMap = {
        // 图片
        png: "image-line",
        jpg: "image-line",
        jpeg: "image-line",
        gif: "image-line",
        svg: "image-line",
        webp: "image-line",
        bmp: "image-line",
        ico: "image-line",
        // 文档
        pdf: "file-pdf-line",
        doc: "file-text-line",
        docx: "file-text-line",
        txt: "file-text-line",
        md: "file-text-line",
        rtf: "file-text-line",
        // 表格
        xls: "file-excel-line",
        xlsx: "file-excel-line",
        csv: "file-excel-line",
        // 演示
        ppt: "file-ppt-line",
        pptx: "file-ppt-line",
        key: "file-ppt-line",
        // 代码
        js: "code-line",
        ts: "code-line",
        jsx: "code-line",
        tsx: "code-line",
        py: "code-line",
        java: "code-line",
        c: "code-line",
        cpp: "code-line",
        h: "code-line",
        go: "code-line",
        rs: "code-line",
        rb: "code-line",
        php: "code-line",
        swift: "code-line",
        kt: "code-line",
        json: "braces-line",
        xml: "code-line",
        html: "code-line",
        css: "code-line",
        scss: "code-line",
        less: "code-line",
        vue: "code-line",
        sql: "code-line",
        sh: "terminal-line",
        bash: "terminal-line",
        zsh: "terminal-line",
        // 压缩
        zip: "file-zip-line",
        rar: "file-zip-line",
        "7z": "file-zip-line",
        tar: "file-zip-line",
        gz: "file-zip-line",
        // 视频
        mp4: "film-line",
        mov: "film-line",
        avi: "film-line",
        mkv: "film-line",
        flv: "film-line",
        wmv: "film-line",
        webm: "film-line",
        // 音频
        mp3: "music-line",
        wav: "music-line",
        flac: "music-line",
        aac: "music-line",
        ogg: "music-line",
        m4a: "music-line",
        // 字体
        ttf: "font-size",
        otf: "font-size",
        woff: "font-size",
        woff2: "font-size",
        // 可执行
        app: "app-line",
        exe: "app-line",
        dmg: "hard-drive-line",
        pkg: "hard-drive-line",
        msi: "hard-drive-line",
        // 设计
        psd: "palette-line",
        ai: "palette-line",
        sketch: "palette-line",
        fig: "palette-line",
        xd: "palette-line"
      };
      return iconMap[ext] ?? "file-line";
    }
    function formatSize(bytes) {
      if (bytes === void 0 || bytes === null) return "";
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
      return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
    }
    const formatTime = (ts) => ts ? formatSmartDate(ts) : "";
    watch([() => props.query, mode, onlyIn], ([q]) => {
      selectedIndex.value = 0;
      if (searchTimer) clearTimeout(searchTimer);
      if (!q.trim()) {
        items.value = [];
        return;
      }
      searchTimer = setTimeout(() => {
        void runSearch(q);
      }, 300);
    });
    let searchSeq = 0;
    async function runSearch(q) {
      const seq = ++searchSeq;
      loading.value = true;
      try {
        const result = await window.api.fileSearch.query(q, 30, {
          mode: mode.value,
          onlyIn: onlyIn.value.trim() || void 0
        });
        if (seq !== searchSeq) return;
        supported.value = result.supported;
        items.value = result.items ?? [];
      } catch {
        if (seq !== searchSeq) return;
        items.value = [];
      } finally {
        if (seq === searchSeq) {
          loading.value = false;
        }
      }
    }
    function openSelected() {
      const item = selected.value;
      if (!item) return;
      void window.api.system.openPath(item.path);
      window.api.launcher.hide();
    }
    function revealSelected() {
      const item = selected.value;
      if (!item) return;
      void window.api.fileSearch.reveal(item.path);
      window.api.launcher.hide();
    }
    function copyPath() {
      const item = selected.value;
      if (!item) return;
      navigator.clipboard.writeText(item.path).catch(() => {
      });
    }
    function moveSelection(delta) {
      if (items.value.length === 0) return;
      selectedIndex.value = (selectedIndex.value + delta + items.value.length) % items.value.length;
      document.querySelectorAll(".files-item")[selectedIndex.value]?.scrollIntoView({ block: "nearest" });
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
        openSelected();
        return true;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "r" || e.key === "R")) {
        revealSelected();
        return true;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
        copyPath();
        return true;
      }
      return false;
    }
    __expose({ handleKey });
    onMounted(() => {
      void window.api.fileSearch.query("", 1).then((r) => {
        supported.value = r.supported;
      });
    });
    const __returned__ = { props, items, loading, supported, selectedIndex, mode, onlyIn, get searchTimer() {
      return searchTimer;
    }, set searchTimer(v) {
      searchTimer = v;
    }, selected, hints, fileIcon, formatSize, formatTime, get searchSeq() {
      return searchSeq;
    }, set searchSeq(v) {
      searchSeq = v;
    }, runSearch, openSelected, revealSelected, copyPath, moveSelection, handleKey, AppIcon, CapsulePage };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { normalizeClass as _normalizeClass, createElementVNode as _createElementVNode, vModelText as _vModelText, withDirectives as _withDirectives, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, toDisplayString as _toDisplayString, renderList as _renderList, Fragment as _Fragment, createVNode as _createVNode, withCtx as _withCtx, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = { class: "files-page" };
const _hoisted_2 = { class: "files-toolbar" };
const _hoisted_3 = { class: "files-mode" };
const _hoisted_4 = {
  key: 0,
  class: "files-empty"
};
const _hoisted_5 = {
  key: 1,
  class: "files-empty"
};
const _hoisted_6 = {
  key: 2,
  class: "files-empty"
};
const _hoisted_7 = {
  key: 3,
  class: "files-empty"
};
const _hoisted_8 = {
  key: 4,
  class: "files-list"
};
const _hoisted_9 = ["onMouseenter"];
const _hoisted_10 = { class: "files-icon" };
const _hoisted_11 = { class: "files-text" };
const _hoisted_12 = { class: "files-title" };
const _hoisted_13 = { class: "files-sub" };
const _hoisted_14 = {
  key: 0,
  class: "files-meta"
};
const _hoisted_15 = {
  key: 1,
  class: "files-meta"
};
const _hoisted_16 = {
  key: 0,
  class: "files-detail"
};
const _hoisted_17 = { class: "files-detail-name" };
const _hoisted_18 = { class: "files-detail-path" };
const _hoisted_19 = {
  key: 1,
  class: "files-empty"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["CapsulePage"], { hints: $setup.hints }, {
    detail: _withCtx(() => [
      $setup.selected ? (_openBlock(), _createElementBlock("div", _hoisted_16, [
        _createElementVNode(
          "div",
          _hoisted_17,
          _toDisplayString($setup.selected.name),
          1
          /* TEXT */
        ),
        _createElementVNode(
          "pre",
          _hoisted_18,
          _toDisplayString($setup.selected.path),
          1
          /* TEXT */
        )
      ])) : (_openBlock(), _createElementBlock("div", _hoisted_19, "选择左侧文件查看路径"))
    ]),
    default: _withCtx(() => [
      _createElementVNode("div", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, [
          _createElementVNode("div", _hoisted_3, [
            _createElementVNode(
              "button",
              {
                type: "button",
                class: _normalizeClass(["files-mode-btn", { active: $setup.mode === "name" }]),
                onClick: _cache[0] || (_cache[0] = ($event) => $setup.mode = "name")
              },
              " 文件名 ",
              2
              /* CLASS */
            ),
            _createElementVNode(
              "button",
              {
                type: "button",
                class: _normalizeClass(["files-mode-btn", { active: $setup.mode === "content" }]),
                onClick: _cache[1] || (_cache[1] = ($event) => $setup.mode = "content")
              },
              " 全文 ",
              2
              /* CLASS */
            )
          ]),
          _withDirectives(_createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $setup.onlyIn = $event),
              class: "files-dir",
              type: "text",
              placeholder: "限定目录（可选）",
              spellcheck: "false"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [_vModelText, $setup.onlyIn]
          ])
        ]),
        !$setup.supported ? (_openBlock(), _createElementBlock("div", _hoisted_4, "文件搜索当前仅支持 macOS")) : !$props.query.trim() ? (_openBlock(), _createElementBlock(
          "div",
          _hoisted_5,
          _toDisplayString($setup.mode === "content" ? "输入关键词搜索文件内容（较慢）" : "输入文件名开始搜索（Spotlight 索引）"),
          1
          /* TEXT */
        )) : $setup.loading ? (_openBlock(), _createElementBlock("div", _hoisted_6, "搜索中…")) : $setup.items.length === 0 ? (_openBlock(), _createElementBlock(
          "div",
          _hoisted_7,
          "没有匹配「" + _toDisplayString($props.query) + "」的文件",
          1
          /* TEXT */
        )) : (_openBlock(), _createElementBlock("div", _hoisted_8, [
          (_openBlock(true), _createElementBlock(
            _Fragment,
            null,
            _renderList($setup.items, (item, index) => {
              return _openBlock(), _createElementBlock("div", {
                key: item.path,
                class: _normalizeClass(["files-item", { selected: index === $setup.selectedIndex }]),
                onMouseenter: ($event) => $setup.selectedIndex = index,
                onClick: _cache[3] || (_cache[3] = ($event) => $setup.openSelected())
              }, [
                _createElementVNode("div", _hoisted_10, [
                  _createVNode($setup["AppIcon"], {
                    icon: $setup.fileIcon(item.name),
                    size: 16
                  }, null, 8, ["icon"])
                ]),
                _createElementVNode("div", _hoisted_11, [
                  _createElementVNode(
                    "div",
                    _hoisted_12,
                    _toDisplayString(item.name),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode("div", _hoisted_13, [
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(item.dir),
                      1
                      /* TEXT */
                    ),
                    item.size !== void 0 ? (_openBlock(), _createElementBlock(
                      "span",
                      _hoisted_14,
                      _toDisplayString($setup.formatSize(item.size)),
                      1
                      /* TEXT */
                    )) : _createCommentVNode("v-if", true),
                    item.modifiedAt ? (_openBlock(), _createElementBlock(
                      "span",
                      _hoisted_15,
                      _toDisplayString($setup.formatTime(item.modifiedAt)),
                      1
                      /* TEXT */
                    )) : _createCommentVNode("v-if", true)
                  ])
                ])
              ], 42, _hoisted_9);
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
import "/src/launcher/pages/FilesPage.vue?vue&type=style&index=0&scoped=30cb882c&lang.css";
_sfc_main.__hmrId = "30cb882c";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-30cb882c"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/launcher/pages/FilesPage.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQStFQSxTQUFTLFVBQVUsV0FBVyxLQUFLLGFBQWE7QUFDaEQsT0FBTyxhQUFhO0FBQ3BCLE9BQU8saUJBQWlCO0FBQ3hCLFNBQVMsdUJBQXVCOzs7Ozs7O0FBVWhDLFVBQU0sUUFBUTtBQUVkLFVBQU0sUUFBUSxJQUFlLENBQUMsQ0FBQztBQUMvQixVQUFNLFVBQVUsSUFBSSxLQUFLO0FBQ3pCLFVBQU0sWUFBWSxJQUFJLElBQUk7QUFDMUIsVUFBTSxnQkFBZ0IsSUFBSSxDQUFDO0FBRTNCLFVBQU0sT0FBTyxJQUF3QixNQUFNO0FBRTNDLFVBQU0sU0FBUyxJQUFJLEVBQUU7QUFDckIsUUFBSSxjQUFvRDtBQUV4RCxVQUFNLFdBQVcsU0FBUyxNQUFNLE1BQU0sTUFBTSxjQUFjLEtBQUssS0FBSyxJQUFJO0FBRXhFLFVBQU0sUUFBUTtBQUFBLE1BQ1osRUFBRSxNQUFNLEtBQUssT0FBTyxLQUFLO0FBQUEsTUFDekIsRUFBRSxNQUFNLE1BQU0sT0FBTyxjQUFjO0FBQUEsTUFDbkMsRUFBRSxNQUFNLE1BQU0sT0FBTyxPQUFPO0FBQUEsTUFDNUIsRUFBRSxNQUFNLE9BQU8sT0FBTyxLQUFLO0FBQUEsSUFDN0I7QUFHQSxhQUFTLFNBQVMsTUFBc0I7QUFDdEMsWUFBTSxNQUFNLEtBQUssTUFBTSxHQUFHLEVBQUUsSUFBSSxHQUFHLFlBQVksS0FBSztBQUNwRCxZQUFNLFVBQWtDO0FBQUE7QUFBQSxRQUV0QyxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsUUFDTixLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsUUFDTixLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUE7QUFBQSxRQUVMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLElBQUk7QUFBQSxRQUNKLEtBQUs7QUFBQTtBQUFBLFFBRUwsS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLFFBQ04sS0FBSztBQUFBO0FBQUEsUUFFTCxLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsUUFDTixLQUFLO0FBQUE7QUFBQSxRQUVMLElBQUk7QUFBQSxRQUNKLElBQUk7QUFBQSxRQUNKLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLElBQUk7QUFBQSxRQUNKLE1BQU07QUFBQSxRQUNOLEdBQUc7QUFBQSxRQUNILEtBQUs7QUFBQSxRQUNMLEdBQUc7QUFBQSxRQUNILElBQUk7QUFBQSxRQUNKLElBQUk7QUFBQSxRQUNKLElBQUk7QUFBQSxRQUNKLEtBQUs7QUFBQSxRQUNMLE9BQU87QUFBQSxRQUNQLElBQUk7QUFBQSxRQUNKLE1BQU07QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxRQUNOLE1BQU07QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLElBQUk7QUFBQSxRQUNKLE1BQU07QUFBQSxRQUNOLEtBQUs7QUFBQTtBQUFBLFFBRUwsS0FBSztBQUFBLFFBQ0wsS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsSUFBSTtBQUFBO0FBQUEsUUFFSixLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUE7QUFBQSxRQUVOLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQTtBQUFBLFFBRUwsS0FBSztBQUFBLFFBQ0wsS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLFFBQ04sT0FBTztBQUFBO0FBQUEsUUFFUCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUE7QUFBQSxRQUVMLEtBQUs7QUFBQSxRQUNMLElBQUk7QUFBQSxRQUNKLFFBQVE7QUFBQSxRQUNSLEtBQUs7QUFBQSxRQUNMLElBQUk7QUFBQSxNQUNOO0FBQ0EsYUFBTyxRQUFRLEdBQUcsS0FBSztBQUFBLElBQ3pCO0FBR0EsYUFBUyxXQUFXLE9BQXdCO0FBQzFDLFVBQUksVUFBVSxVQUFhLFVBQVUsS0FBTSxRQUFPO0FBQ2xELFVBQUksUUFBUSxLQUFNLFFBQU8sUUFBUTtBQUNqQyxVQUFJLFFBQVEsT0FBTyxLQUFNLFNBQVEsUUFBUSxNQUFNLFFBQVEsQ0FBQyxJQUFJO0FBQzVELFVBQUksUUFBUSxPQUFPLE9BQU8sS0FBTSxTQUFRLFNBQVMsT0FBTyxPQUFPLFFBQVEsQ0FBQyxJQUFJO0FBQzVFLGNBQVEsU0FBUyxPQUFPLE9BQU8sT0FBTyxRQUFRLENBQUMsSUFBSTtBQUFBLElBQ3JEO0FBR0EsVUFBTSxhQUFhLENBQUMsT0FBeUIsS0FBSyxnQkFBZ0IsRUFBRSxJQUFJO0FBRXhFLFVBQU0sQ0FBQyxNQUFNLE1BQU0sT0FBTyxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNO0FBQ2hELG9CQUFjLFFBQVE7QUFDdEIsVUFBSSxZQUFhLGNBQWEsV0FBVztBQUN6QyxVQUFJLENBQUMsRUFBRSxLQUFLLEdBQUc7QUFDYixjQUFNLFFBQVEsQ0FBQztBQUNmO0FBQUEsTUFDRjtBQUVBLG9CQUFjLFdBQVcsTUFBTTtBQUM3QixhQUFLLFVBQVUsQ0FBQztBQUFBLE1BQ2xCLEdBQUcsR0FBRztBQUFBLElBQ1IsQ0FBQztBQUdELFFBQUksWUFBWTtBQUVoQixtQkFBZSxVQUFVLEdBQTBCO0FBQ2pELFlBQU0sTUFBTSxFQUFFO0FBQ2QsY0FBUSxRQUFRO0FBQ2hCLFVBQUk7QUFDRixjQUFNLFNBQVMsTUFBTSxPQUFPLElBQUksV0FBVyxNQUFNLEdBQUcsSUFBSTtBQUFBLFVBQ3RELE1BQU0sS0FBSztBQUFBLFVBQ1gsUUFBUSxPQUFPLE1BQU0sS0FBSyxLQUFLO0FBQUEsUUFDakMsQ0FBQztBQUNELFlBQUksUUFBUSxVQUFXO0FBQ3ZCLGtCQUFVLFFBQVEsT0FBTztBQUN6QixjQUFNLFFBQVEsT0FBTyxTQUFTLENBQUM7QUFBQSxNQUNqQyxRQUFRO0FBQ04sWUFBSSxRQUFRLFVBQVc7QUFDdkIsY0FBTSxRQUFRLENBQUM7QUFBQSxNQUNqQixVQUFFO0FBQ0EsWUFBSSxRQUFRLFdBQVc7QUFDckIsa0JBQVEsUUFBUTtBQUFBLFFBQ2xCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFFQSxhQUFTLGVBQXFCO0FBQzVCLFlBQU0sT0FBTyxTQUFTO0FBQ3RCLFVBQUksQ0FBQyxLQUFNO0FBQ1gsV0FBSyxPQUFPLElBQUksT0FBTyxTQUFTLEtBQUssSUFBSTtBQUN6QyxhQUFPLElBQUksU0FBUyxLQUFLO0FBQUEsSUFDM0I7QUFFQSxhQUFTLGlCQUF1QjtBQUM5QixZQUFNLE9BQU8sU0FBUztBQUN0QixVQUFJLENBQUMsS0FBTTtBQUNYLFdBQUssT0FBTyxJQUFJLFdBQVcsT0FBTyxLQUFLLElBQUk7QUFDM0MsYUFBTyxJQUFJLFNBQVMsS0FBSztBQUFBLElBQzNCO0FBRUEsYUFBUyxXQUFpQjtBQUN4QixZQUFNLE9BQU8sU0FBUztBQUN0QixVQUFJLENBQUMsS0FBTTtBQUNYLGdCQUFVLFVBQVUsVUFBVSxLQUFLLElBQUksRUFBRSxNQUFNLE1BQU07QUFBQSxNQUVyRCxDQUFDO0FBQUEsSUFDSDtBQUVBLGFBQVMsY0FBYyxPQUFxQjtBQUMxQyxVQUFJLE1BQU0sTUFBTSxXQUFXLEVBQUc7QUFDOUIsb0JBQWMsU0FBUyxjQUFjLFFBQVEsUUFBUSxNQUFNLE1BQU0sVUFBVSxNQUFNLE1BQU07QUFDdkYsZUFDRyxpQkFBaUIsYUFBYSxFQUM5QixjQUFjLEtBQUssR0FBRyxlQUFlLEVBQUUsT0FBTyxVQUFVLENBQUM7QUFBQSxJQUM5RDtBQUdBLGFBQVMsVUFBVSxHQUEyQjtBQUM1QyxVQUFJLEVBQUUsUUFBUSxhQUFhO0FBQ3pCLHNCQUFjLENBQUM7QUFDZixlQUFPO0FBQUEsTUFDVDtBQUNBLFVBQUksRUFBRSxRQUFRLFdBQVc7QUFDdkIsc0JBQWMsRUFBRTtBQUNoQixlQUFPO0FBQUEsTUFDVDtBQUNBLFVBQUksRUFBRSxRQUFRLFNBQVM7QUFDckIscUJBQWE7QUFDYixlQUFPO0FBQUEsTUFDVDtBQUNBLFdBQUssRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLFFBQVEsT0FBTyxFQUFFLFFBQVEsTUFBTTtBQUNoRSx1QkFBZTtBQUNmLGVBQU87QUFBQSxNQUNUO0FBQ0EsV0FBSyxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsUUFBUSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQ2hFLGlCQUFTO0FBQ1QsZUFBTztBQUFBLE1BQ1Q7QUFDQSxhQUFPO0FBQUEsSUFDVDtBQUVBLGFBQWEsRUFBRSxVQUFVLENBQUM7QUFFMUIsY0FBVSxNQUFNO0FBRWQsV0FBSyxPQUFPLElBQUksV0FBVyxNQUFNLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNO0FBQ2xELGtCQUFVLFFBQVEsRUFBRTtBQUFBLE1BQ3RCLENBQUM7QUFBQSxJQUNILENBQUM7Ozs7Ozs7Ozs7Ozs7OztxQkEvVFEsT0FBTSxhQUFZO3FCQUNoQixPQUFNLGdCQUFlO3FCQUNuQixPQUFNLGFBQVk7OztFQTBCRixPQUFNOzs7O0VBQ0UsT0FBTTs7OztFQU9aLE9BQU07Ozs7RUFDSyxPQUFNOzs7O0VBQzlCLE9BQU07OztzQkFTVCxPQUFNLGFBQVk7c0JBR2xCLE9BQU0sYUFBWTtzQkFDaEIsT0FBTSxjQUFhO3NCQUNuQixPQUFNLFlBQVc7OztFQUVpQixPQUFNOzs7O0VBR2QsT0FBTTs7OztFQVV0QixPQUFNOztzQkFDcEIsT0FBTSxvQkFBbUI7c0JBQ3pCLE9BQU0sb0JBQW1COzs7RUFFcEIsT0FBTTs7O3VCQXhFdEIsYUEwRWMseUJBMUVBLE9BQU8sYUFBSztBQUFBLElBbUViLFFBQU0sU0FDZixNQUdNO0FBQUEsTUFISyxpQ0FBWCxvQkFHTSxPQUhOLGFBR007QUFBQSxRQUZKO0FBQUEsVUFBd0Q7QUFBQSxVQUF4RDtBQUFBLFVBQXdELGlCQUF0QixnQkFBUyxJQUFJO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFDL0M7QUFBQSxVQUF3RDtBQUFBLFVBQXhEO0FBQUEsVUFBd0QsaUJBQXRCLGdCQUFTLElBQUk7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFFakQsb0JBQWdELE9BQWhELGFBQWdDLFlBQVU7QUFBQTtzQkF2RTVDLE1BZ0VNO0FBQUEsTUFoRU4sb0JBZ0VNLE9BaEVOLFlBZ0VNO0FBQUEsUUEvREosb0JBMEJNLE9BMUJOLFlBMEJNO0FBQUEsVUF6Qkosb0JBaUJNLE9BakJOLFlBaUJNO0FBQUEsWUFoQko7QUFBQSxjQU9TO0FBQUE7QUFBQSxnQkFOUCxNQUFLO0FBQUEsZ0JBQ0wsT0FBSyxpQkFBQyxrQkFBZ0IsVUFDSixnQkFBSTtBQUFBLGdCQUNyQixTQUFLLHNDQUFFLGNBQUk7QUFBQTtjQUNiO0FBQUEsY0FFRDtBQUFBO0FBQUE7QUFBQSxZQUNBO0FBQUEsY0FPUztBQUFBO0FBQUEsZ0JBTlAsTUFBSztBQUFBLGdCQUNMLE9BQUssaUJBQUMsa0JBQWdCLFVBQ0osZ0JBQUk7QUFBQSxnQkFDckIsU0FBSyxzQ0FBRSxjQUFJO0FBQUE7Y0FDYjtBQUFBLGNBRUQ7QUFBQTtBQUFBO0FBQUE7MEJBRUY7QUFBQSxZQU1FO0FBQUE7QUFBQSwyRUFMUyxnQkFBTTtBQUFBLGNBQ2YsT0FBTTtBQUFBLGNBQ04sTUFBSztBQUFBLGNBQ0wsYUFBWTtBQUFBLGNBQ1osWUFBVztBQUFBOzs7OzswQkFKRixhQUFNO0FBQUE7O1NBT1Asa0NBQVosb0JBQWdFLE9BQWhFLFlBQTJDLGlCQUFlLE1BQ3pDLGFBQU0sS0FBSSxtQkFBM0I7QUFBQSxVQU1NO0FBQUEsVUFOTjtBQUFBLFVBTU0saUJBSkYsZ0JBQUk7OzthQUtRLGdDQUFoQixvQkFBdUQsT0FBdkQsWUFBNkMsTUFBSSxLQUNqQyxhQUFNLFdBQU0sbUJBQTVCO0FBQUEsVUFBa0Y7QUFBQSxVQUFsRjtBQUFBLFVBQXdELFVBQUssaUJBQUcsWUFBSyxJQUFHO0FBQUEsVUFBSTtBQUFBO0FBQUEsNEJBQzVFLG9CQXlCTSxPQXpCTixZQXlCTTtBQUFBLDZCQXhCSjtBQUFBLFlBdUJNO0FBQUE7QUFBQSx3QkF0Qm9CLGNBQUssQ0FBckIsTUFBTSxVQUFLO21DQURyQixvQkF1Qk07QUFBQSxnQkFyQkgsS0FBSyxLQUFLO0FBQUEsZ0JBQ1gsT0FBSyxpQkFBQyxjQUFZLFlBQ0UsVUFBVSxxQkFBYTtBQUFBLGdCQUMxQyxjQUFVLFlBQUUsdUJBQWdCO0FBQUEsZ0JBQzVCLFNBQUssc0NBQUUsb0JBQVk7QUFBQTtnQkFFcEIsb0JBRU0sT0FGTixhQUVNO0FBQUEsa0JBREosYUFBa0Q7QUFBQSxvQkFBeEMsTUFBTSxnQkFBUyxLQUFLLElBQUk7QUFBQSxvQkFBSSxNQUFNO0FBQUE7O2dCQUU5QyxvQkFXTSxPQVhOLGFBV007QUFBQSxrQkFWSjtBQUFBLG9CQUE4QztBQUFBLG9CQUE5QztBQUFBLG9CQUE4QyxpQkFBbEIsS0FBSyxJQUFJO0FBQUE7QUFBQTtBQUFBO0FBQUEsa0JBQ3JDLG9CQVFNLE9BUk4sYUFRTTtBQUFBLG9CQVBKO0FBQUEsc0JBQTJCO0FBQUE7QUFBQSx1Q0FBbEIsS0FBSyxHQUFHO0FBQUE7QUFBQTtBQUFBO0FBQUEsb0JBQ0wsS0FBSyxTQUFTLHdCQUExQjtBQUFBLHNCQUVTO0FBQUEsc0JBRlQ7QUFBQSxzQkFFUyxpQkFEUCxrQkFBVyxLQUFLLElBQUk7QUFBQTtBQUFBO0FBQUE7b0JBRVYsS0FBSyw0QkFBakI7QUFBQSxzQkFFUztBQUFBLHNCQUZUO0FBQUEsc0JBRVMsaUJBRFAsa0JBQVcsS0FBSyxVQUFVO0FBQUE7QUFBQTtBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJGaWxlc1BhZ2UudnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjx0ZW1wbGF0ZT5cbiAgPENhcHN1bGVQYWdlIDpoaW50cz1cImhpbnRzXCI+XG4gICAgPGRpdiBjbGFzcz1cImZpbGVzLXBhZ2VcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmaWxlcy10b29sYmFyXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWxlcy1tb2RlXCI+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICBjbGFzcz1cImZpbGVzLW1vZGUtYnRuXCJcbiAgICAgICAgICAgIDpjbGFzcz1cInsgYWN0aXZlOiBtb2RlID09PSAnbmFtZScgfVwiXG4gICAgICAgICAgICBAY2xpY2s9XCJtb2RlID0gJ25hbWUnXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICDmlofku7blkI1cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgIGNsYXNzPVwiZmlsZXMtbW9kZS1idG5cIlxuICAgICAgICAgICAgOmNsYXNzPVwieyBhY3RpdmU6IG1vZGUgPT09ICdjb250ZW50JyB9XCJcbiAgICAgICAgICAgIEBjbGljaz1cIm1vZGUgPSAnY29udGVudCdcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIOWFqOaWh1xuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGlucHV0XG4gICAgICAgICAgdi1tb2RlbD1cIm9ubHlJblwiXG4gICAgICAgICAgY2xhc3M9XCJmaWxlcy1kaXJcIlxuICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgICBwbGFjZWhvbGRlcj1cIumZkOWumuebruW9le+8iOWPr+mAie+8iVwiXG4gICAgICAgICAgc3BlbGxjaGVjaz1cImZhbHNlXCJcbiAgICAgICAgLz5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiB2LWlmPVwiIXN1cHBvcnRlZFwiIGNsYXNzPVwiZmlsZXMtZW1wdHlcIj7mlofku7bmkJzntKLlvZPliY3ku4XmlK/mjIEgbWFjT1M8L2Rpdj5cbiAgICAgIDxkaXYgdi1lbHNlLWlmPVwiIXF1ZXJ5LnRyaW0oKVwiIGNsYXNzPVwiZmlsZXMtZW1wdHlcIj5cbiAgICAgICAge3tcbiAgICAgICAgICBtb2RlID09PSAnY29udGVudCdcbiAgICAgICAgICAgID8gJ+i+k+WFpeWFs+mUruivjeaQnOe0ouaWh+S7tuWGheWuue+8iOi+g+aFou+8iSdcbiAgICAgICAgICAgIDogJ+i+k+WFpeaWh+S7tuWQjeW8gOWni+aQnOe0ou+8iFNwb3RsaWdodCDntKLlvJXvvIknXG4gICAgICAgIH19XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgdi1lbHNlLWlmPVwibG9hZGluZ1wiIGNsYXNzPVwiZmlsZXMtZW1wdHlcIj7mkJzntKLkuK3igKY8L2Rpdj5cbiAgICAgIDxkaXYgdi1lbHNlLWlmPVwiaXRlbXMubGVuZ3RoID09PSAwXCIgY2xhc3M9XCJmaWxlcy1lbXB0eVwiPuayoeacieWMuemFjeOAjHt7IHF1ZXJ5IH1944CN55qE5paH5Lu2PC9kaXY+XG4gICAgICA8ZGl2IHYtZWxzZSBjbGFzcz1cImZpbGVzLWxpc3RcIj5cbiAgICAgICAgPGRpdlxuICAgICAgICAgIHYtZm9yPVwiKGl0ZW0sIGluZGV4KSBpbiBpdGVtc1wiXG4gICAgICAgICAgOmtleT1cIml0ZW0ucGF0aFwiXG4gICAgICAgICAgY2xhc3M9XCJmaWxlcy1pdGVtXCJcbiAgICAgICAgICA6Y2xhc3M9XCJ7IHNlbGVjdGVkOiBpbmRleCA9PT0gc2VsZWN0ZWRJbmRleCB9XCJcbiAgICAgICAgICBAbW91c2VlbnRlcj1cInNlbGVjdGVkSW5kZXggPSBpbmRleFwiXG4gICAgICAgICAgQGNsaWNrPVwib3BlblNlbGVjdGVkKClcIlxuICAgICAgICA+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZpbGVzLWljb25cIj5cbiAgICAgICAgICAgIDxBcHBJY29uIDppY29uPVwiZmlsZUljb24oaXRlbS5uYW1lKVwiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmaWxlcy10ZXh0XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmlsZXMtdGl0bGVcIj57eyBpdGVtLm5hbWUgfX08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmaWxlcy1zdWJcIj5cbiAgICAgICAgICAgICAgPHNwYW4+e3sgaXRlbS5kaXIgfX08L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuIHYtaWY9XCJpdGVtLnNpemUgIT09IHVuZGVmaW5lZFwiIGNsYXNzPVwiZmlsZXMtbWV0YVwiPnt7XG4gICAgICAgICAgICAgICAgZm9ybWF0U2l6ZShpdGVtLnNpemUpXG4gICAgICAgICAgICAgIH19PC9zcGFuPlxuICAgICAgICAgICAgICA8c3BhbiB2LWlmPVwiaXRlbS5tb2RpZmllZEF0XCIgY2xhc3M9XCJmaWxlcy1tZXRhXCI+e3tcbiAgICAgICAgICAgICAgICBmb3JtYXRUaW1lKGl0ZW0ubW9kaWZpZWRBdClcbiAgICAgICAgICAgICAgfX08L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICA8IS0tIERldGFpbO+8mumAieS4reaWh+S7tueahOWujOaVtOi3r+W+hCAtLT5cbiAgICA8dGVtcGxhdGUgI2RldGFpbD5cbiAgICAgIDxkaXYgdi1pZj1cInNlbGVjdGVkXCIgY2xhc3M9XCJmaWxlcy1kZXRhaWxcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZpbGVzLWRldGFpbC1uYW1lXCI+e3sgc2VsZWN0ZWQubmFtZSB9fTwvZGl2PlxuICAgICAgICA8cHJlIGNsYXNzPVwiZmlsZXMtZGV0YWlsLXBhdGhcIj57eyBzZWxlY3RlZC5wYXRoIH19PC9wcmU+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgdi1lbHNlIGNsYXNzPVwiZmlsZXMtZW1wdHlcIj7pgInmi6nlt6bkvqfmlofku7bmn6XnnIvot6/lvoQ8L2Rpdj5cbiAgICA8L3RlbXBsYXRlPlxuICA8L0NhcHN1bGVQYWdlPlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IGNvbXB1dGVkLCBvbk1vdW50ZWQsIHJlZiwgd2F0Y2ggfSBmcm9tICd2dWUnXG5pbXBvcnQgQXBwSWNvbiBmcm9tICdAY29tcG9uZW50cy9BcHBJY29uLnZ1ZSdcbmltcG9ydCBDYXBzdWxlUGFnZSBmcm9tICcuL0NhcHN1bGVQYWdlLnZ1ZSdcbmltcG9ydCB7IGZvcm1hdFNtYXJ0RGF0ZSB9IGZyb20gJ0B1dGlscy9mb3JtYXQnXG5cbmludGVyZmFjZSBGaWxlSGl0IHtcbiAgcGF0aDogc3RyaW5nXG4gIG5hbWU6IHN0cmluZ1xuICBkaXI6IHN0cmluZ1xuICBzaXplPzogbnVtYmVyXG4gIG1vZGlmaWVkQXQ/OiBudW1iZXJcbn1cblxuY29uc3QgcHJvcHMgPSBkZWZpbmVQcm9wczx7IHF1ZXJ5OiBzdHJpbmcgfT4oKVxuXG5jb25zdCBpdGVtcyA9IHJlZjxGaWxlSGl0W10+KFtdKVxuY29uc3QgbG9hZGluZyA9IHJlZihmYWxzZSlcbmNvbnN0IHN1cHBvcnRlZCA9IHJlZih0cnVlKVxuY29uc3Qgc2VsZWN0ZWRJbmRleCA9IHJlZigwKVxuLyoqIOaQnOe0ouaooeW8j++8muaWh+S7tuWQje+8iC1uYW1l77yJLyDlhajmlofvvIjlhoXlrrnkuI7lhYPmlbDmja7vvIzovoPmhaLvvIkgKi9cbmNvbnN0IG1vZGUgPSByZWY8J25hbWUnIHwgJ2NvbnRlbnQnPignbmFtZScpXG4vKiog6ZmQ5a6a55uu5b2V77yI5Y+v6YCJ77yJ77ya5aGr57ud5a+56Lev5b6E5pe25YqgIG1kZmluZCAtb25seWluICovXG5jb25zdCBvbmx5SW4gPSByZWYoJycpXG5sZXQgc2VhcmNoVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGxcblxuY29uc3Qgc2VsZWN0ZWQgPSBjb21wdXRlZCgoKSA9PiBpdGVtcy52YWx1ZVtzZWxlY3RlZEluZGV4LnZhbHVlXSA/PyBudWxsKVxuXG5jb25zdCBoaW50cyA9IFtcbiAgeyBrZXlzOiAn4oa1JywgbGFiZWw6ICfmiZPlvIAnIH0sXG4gIHsga2V5czogJ+KMmFInLCBsYWJlbDogJ+WcqCBGaW5kZXIg5pi+56S6JyB9LFxuICB7IGtleXM6ICfijJhDJywgbGFiZWw6ICflpI3liLbot6/lvoQnIH0sXG4gIHsga2V5czogJ0VTQycsIGxhYmVsOiAn6L+U5ZueJyB9XG5dXG5cbi8qKiDmoLnmja7mlofku7bmianlsZXlkI3ov5Tlm57lr7nlupTlm77moIcgKi9cbmZ1bmN0aW9uIGZpbGVJY29uKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGV4dCA9IG5hbWUuc3BsaXQoJy4nKS5wb3AoKT8udG9Mb3dlckNhc2UoKSA/PyAnJ1xuICBjb25zdCBpY29uTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgIC8vIOWbvueJh1xuICAgIHBuZzogJ2ltYWdlLWxpbmUnLFxuICAgIGpwZzogJ2ltYWdlLWxpbmUnLFxuICAgIGpwZWc6ICdpbWFnZS1saW5lJyxcbiAgICBnaWY6ICdpbWFnZS1saW5lJyxcbiAgICBzdmc6ICdpbWFnZS1saW5lJyxcbiAgICB3ZWJwOiAnaW1hZ2UtbGluZScsXG4gICAgYm1wOiAnaW1hZ2UtbGluZScsXG4gICAgaWNvOiAnaW1hZ2UtbGluZScsXG4gICAgLy8g5paH5qGjXG4gICAgcGRmOiAnZmlsZS1wZGYtbGluZScsXG4gICAgZG9jOiAnZmlsZS10ZXh0LWxpbmUnLFxuICAgIGRvY3g6ICdmaWxlLXRleHQtbGluZScsXG4gICAgdHh0OiAnZmlsZS10ZXh0LWxpbmUnLFxuICAgIG1kOiAnZmlsZS10ZXh0LWxpbmUnLFxuICAgIHJ0ZjogJ2ZpbGUtdGV4dC1saW5lJyxcbiAgICAvLyDooajmoLxcbiAgICB4bHM6ICdmaWxlLWV4Y2VsLWxpbmUnLFxuICAgIHhsc3g6ICdmaWxlLWV4Y2VsLWxpbmUnLFxuICAgIGNzdjogJ2ZpbGUtZXhjZWwtbGluZScsXG4gICAgLy8g5ryU56S6XG4gICAgcHB0OiAnZmlsZS1wcHQtbGluZScsXG4gICAgcHB0eDogJ2ZpbGUtcHB0LWxpbmUnLFxuICAgIGtleTogJ2ZpbGUtcHB0LWxpbmUnLFxuICAgIC8vIOS7o+eggVxuICAgIGpzOiAnY29kZS1saW5lJyxcbiAgICB0czogJ2NvZGUtbGluZScsXG4gICAganN4OiAnY29kZS1saW5lJyxcbiAgICB0c3g6ICdjb2RlLWxpbmUnLFxuICAgIHB5OiAnY29kZS1saW5lJyxcbiAgICBqYXZhOiAnY29kZS1saW5lJyxcbiAgICBjOiAnY29kZS1saW5lJyxcbiAgICBjcHA6ICdjb2RlLWxpbmUnLFxuICAgIGg6ICdjb2RlLWxpbmUnLFxuICAgIGdvOiAnY29kZS1saW5lJyxcbiAgICByczogJ2NvZGUtbGluZScsXG4gICAgcmI6ICdjb2RlLWxpbmUnLFxuICAgIHBocDogJ2NvZGUtbGluZScsXG4gICAgc3dpZnQ6ICdjb2RlLWxpbmUnLFxuICAgIGt0OiAnY29kZS1saW5lJyxcbiAgICBqc29uOiAnYnJhY2VzLWxpbmUnLFxuICAgIHhtbDogJ2NvZGUtbGluZScsXG4gICAgaHRtbDogJ2NvZGUtbGluZScsXG4gICAgY3NzOiAnY29kZS1saW5lJyxcbiAgICBzY3NzOiAnY29kZS1saW5lJyxcbiAgICBsZXNzOiAnY29kZS1saW5lJyxcbiAgICB2dWU6ICdjb2RlLWxpbmUnLFxuICAgIHNxbDogJ2NvZGUtbGluZScsXG4gICAgc2g6ICd0ZXJtaW5hbC1saW5lJyxcbiAgICBiYXNoOiAndGVybWluYWwtbGluZScsXG4gICAgenNoOiAndGVybWluYWwtbGluZScsXG4gICAgLy8g5Y6L57ypXG4gICAgemlwOiAnZmlsZS16aXAtbGluZScsXG4gICAgcmFyOiAnZmlsZS16aXAtbGluZScsXG4gICAgJzd6JzogJ2ZpbGUtemlwLWxpbmUnLFxuICAgIHRhcjogJ2ZpbGUtemlwLWxpbmUnLFxuICAgIGd6OiAnZmlsZS16aXAtbGluZScsXG4gICAgLy8g6KeG6aKRXG4gICAgbXA0OiAnZmlsbS1saW5lJyxcbiAgICBtb3Y6ICdmaWxtLWxpbmUnLFxuICAgIGF2aTogJ2ZpbG0tbGluZScsXG4gICAgbWt2OiAnZmlsbS1saW5lJyxcbiAgICBmbHY6ICdmaWxtLWxpbmUnLFxuICAgIHdtdjogJ2ZpbG0tbGluZScsXG4gICAgd2VibTogJ2ZpbG0tbGluZScsXG4gICAgLy8g6Z+z6aKRXG4gICAgbXAzOiAnbXVzaWMtbGluZScsXG4gICAgd2F2OiAnbXVzaWMtbGluZScsXG4gICAgZmxhYzogJ211c2ljLWxpbmUnLFxuICAgIGFhYzogJ211c2ljLWxpbmUnLFxuICAgIG9nZzogJ211c2ljLWxpbmUnLFxuICAgIG00YTogJ211c2ljLWxpbmUnLFxuICAgIC8vIOWtl+S9k1xuICAgIHR0ZjogJ2ZvbnQtc2l6ZScsXG4gICAgb3RmOiAnZm9udC1zaXplJyxcbiAgICB3b2ZmOiAnZm9udC1zaXplJyxcbiAgICB3b2ZmMjogJ2ZvbnQtc2l6ZScsXG4gICAgLy8g5Y+v5omn6KGMXG4gICAgYXBwOiAnYXBwLWxpbmUnLFxuICAgIGV4ZTogJ2FwcC1saW5lJyxcbiAgICBkbWc6ICdoYXJkLWRyaXZlLWxpbmUnLFxuICAgIHBrZzogJ2hhcmQtZHJpdmUtbGluZScsXG4gICAgbXNpOiAnaGFyZC1kcml2ZS1saW5lJyxcbiAgICAvLyDorr7orqFcbiAgICBwc2Q6ICdwYWxldHRlLWxpbmUnLFxuICAgIGFpOiAncGFsZXR0ZS1saW5lJyxcbiAgICBza2V0Y2g6ICdwYWxldHRlLWxpbmUnLFxuICAgIGZpZzogJ3BhbGV0dGUtbGluZScsXG4gICAgeGQ6ICdwYWxldHRlLWxpbmUnXG4gIH1cbiAgcmV0dXJuIGljb25NYXBbZXh0XSA/PyAnZmlsZS1saW5lJ1xufVxuXG4vKiog5qC85byP5YyW5paH5Lu25aSn5bCPICovXG5mdW5jdGlvbiBmb3JtYXRTaXplKGJ5dGVzPzogbnVtYmVyKTogc3RyaW5nIHtcbiAgaWYgKGJ5dGVzID09PSB1bmRlZmluZWQgfHwgYnl0ZXMgPT09IG51bGwpIHJldHVybiAnJ1xuICBpZiAoYnl0ZXMgPCAxMDI0KSByZXR1cm4gYnl0ZXMgKyAnIEInXG4gIGlmIChieXRlcyA8IDEwMjQgKiAxMDI0KSByZXR1cm4gKGJ5dGVzIC8gMTAyNCkudG9GaXhlZCgxKSArICcgS0InXG4gIGlmIChieXRlcyA8IDEwMjQgKiAxMDI0ICogMTAyNCkgcmV0dXJuIChieXRlcyAvICgxMDI0ICogMTAyNCkpLnRvRml4ZWQoMSkgKyAnIE1CJ1xuICByZXR1cm4gKGJ5dGVzIC8gKDEwMjQgKiAxMDI0ICogMTAyNCkpLnRvRml4ZWQoMSkgKyAnIEdCJ1xufVxuXG4vKiog5qC85byP5YyW5L+u5pS55pe26Ze0ICovXG5jb25zdCBmb3JtYXRUaW1lID0gKHRzPzogbnVtYmVyKTogc3RyaW5nID0+ICh0cyA/IGZvcm1hdFNtYXJ0RGF0ZSh0cykgOiAnJylcblxud2F0Y2goWygpID0+IHByb3BzLnF1ZXJ5LCBtb2RlLCBvbmx5SW5dLCAoW3FdKSA9PiB7XG4gIHNlbGVjdGVkSW5kZXgudmFsdWUgPSAwXG4gIGlmIChzZWFyY2hUaW1lcikgY2xlYXJUaW1lb3V0KHNlYXJjaFRpbWVyKVxuICBpZiAoIXEudHJpbSgpKSB7XG4gICAgaXRlbXMudmFsdWUgPSBbXVxuICAgIHJldHVyblxuICB9XG4gIC8vIDMwMG1zIOmYsuaKluWQjui1sCBtZGZpbmRcbiAgc2VhcmNoVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICB2b2lkIHJ1blNlYXJjaChxKVxuICB9LCAzMDApXG59KVxuXG4vLyDov4fmnJ/or7fmsYLlrojljavvvJptb2RlL+WFs+mUruivjeWIh+aNouWQju+8jOaFoueahOaXp+WTjeW6lOS4jeW+l+imhuebluaWsOe7k+aenFxubGV0IHNlYXJjaFNlcSA9IDBcblxuYXN5bmMgZnVuY3Rpb24gcnVuU2VhcmNoKHE6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBzZXEgPSArK3NlYXJjaFNlcVxuICBsb2FkaW5nLnZhbHVlID0gdHJ1ZVxuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpbmRvdy5hcGkuZmlsZVNlYXJjaC5xdWVyeShxLCAzMCwge1xuICAgICAgbW9kZTogbW9kZS52YWx1ZSxcbiAgICAgIG9ubHlJbjogb25seUluLnZhbHVlLnRyaW0oKSB8fCB1bmRlZmluZWRcbiAgICB9KVxuICAgIGlmIChzZXEgIT09IHNlYXJjaFNlcSkgcmV0dXJuXG4gICAgc3VwcG9ydGVkLnZhbHVlID0gcmVzdWx0LnN1cHBvcnRlZFxuICAgIGl0ZW1zLnZhbHVlID0gcmVzdWx0Lml0ZW1zID8/IFtdXG4gIH0gY2F0Y2gge1xuICAgIGlmIChzZXEgIT09IHNlYXJjaFNlcSkgcmV0dXJuXG4gICAgaXRlbXMudmFsdWUgPSBbXVxuICB9IGZpbmFsbHkge1xuICAgIGlmIChzZXEgPT09IHNlYXJjaFNlcSkge1xuICAgICAgbG9hZGluZy52YWx1ZSA9IGZhbHNlXG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG9wZW5TZWxlY3RlZCgpOiB2b2lkIHtcbiAgY29uc3QgaXRlbSA9IHNlbGVjdGVkLnZhbHVlXG4gIGlmICghaXRlbSkgcmV0dXJuXG4gIHZvaWQgd2luZG93LmFwaS5zeXN0ZW0ub3BlblBhdGgoaXRlbS5wYXRoKVxuICB3aW5kb3cuYXBpLmxhdW5jaGVyLmhpZGUoKVxufVxuXG5mdW5jdGlvbiByZXZlYWxTZWxlY3RlZCgpOiB2b2lkIHtcbiAgY29uc3QgaXRlbSA9IHNlbGVjdGVkLnZhbHVlXG4gIGlmICghaXRlbSkgcmV0dXJuXG4gIHZvaWQgd2luZG93LmFwaS5maWxlU2VhcmNoLnJldmVhbChpdGVtLnBhdGgpXG4gIHdpbmRvdy5hcGkubGF1bmNoZXIuaGlkZSgpXG59XG5cbmZ1bmN0aW9uIGNvcHlQYXRoKCk6IHZvaWQge1xuICBjb25zdCBpdGVtID0gc2VsZWN0ZWQudmFsdWVcbiAgaWYgKCFpdGVtKSByZXR1cm5cbiAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoaXRlbS5wYXRoKS5jYXRjaCgoKSA9PiB7XG4gICAgLyog5Ymq6LS05p2/5YaZ5YWl5aSx6LSl5pe26Z2Z6buYICovXG4gIH0pXG59XG5cbmZ1bmN0aW9uIG1vdmVTZWxlY3Rpb24oZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICBpZiAoaXRlbXMudmFsdWUubGVuZ3RoID09PSAwKSByZXR1cm5cbiAgc2VsZWN0ZWRJbmRleC52YWx1ZSA9IChzZWxlY3RlZEluZGV4LnZhbHVlICsgZGVsdGEgKyBpdGVtcy52YWx1ZS5sZW5ndGgpICUgaXRlbXMudmFsdWUubGVuZ3RoXG4gIGRvY3VtZW50XG4gICAgLnF1ZXJ5U2VsZWN0b3JBbGwoJy5maWxlcy1pdGVtJylcbiAgICBbc2VsZWN0ZWRJbmRleC52YWx1ZV0/LnNjcm9sbEludG9WaWV3KHsgYmxvY2s6ICduZWFyZXN0JyB9KVxufVxuXG4vKiog6ZSu55uY5YiG5Y+R77yITGF1bmNoZXJBcHAg6ZuG5Lit6L2s5Y+R77yJ77yb6L+U5ZueIHRydWUg6KGo56S65bey5raI6LS5ICovXG5mdW5jdGlvbiBoYW5kbGVLZXkoZTogS2V5Ym9hcmRFdmVudCk6IGJvb2xlYW4ge1xuICBpZiAoZS5rZXkgPT09ICdBcnJvd0Rvd24nKSB7XG4gICAgbW92ZVNlbGVjdGlvbigxKVxuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgaWYgKGUua2V5ID09PSAnQXJyb3dVcCcpIHtcbiAgICBtb3ZlU2VsZWN0aW9uKC0xKVxuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XG4gICAgb3BlblNlbGVjdGVkKClcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIGlmICgoZS5tZXRhS2V5IHx8IGUuY3RybEtleSkgJiYgKGUua2V5ID09PSAncicgfHwgZS5rZXkgPT09ICdSJykpIHtcbiAgICByZXZlYWxTZWxlY3RlZCgpXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICBpZiAoKGUubWV0YUtleSB8fCBlLmN0cmxLZXkpICYmIChlLmtleSA9PT0gJ2MnIHx8IGUua2V5ID09PSAnQycpKSB7XG4gICAgY29weVBhdGgoKVxuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgcmV0dXJuIGZhbHNlXG59XG5cbmRlZmluZUV4cG9zZSh7IGhhbmRsZUtleSB9KVxuXG5vbk1vdW50ZWQoKCkgPT4ge1xuICAvLyDmjILovb3ml7bkuLvov5vnqIvmjqLmtYvlubPlj7DmlK/mjIHvvIjmuIXnqbogaXRlbXMg5Y2z5pi+56S65LiN5pSv5oyB5paH5qGI77yJXG4gIHZvaWQgd2luZG93LmFwaS5maWxlU2VhcmNoLnF1ZXJ5KCcnLCAxKS50aGVuKChyKSA9PiB7XG4gICAgc3VwcG9ydGVkLnZhbHVlID0gci5zdXBwb3J0ZWRcbiAgfSlcbn0pXG48L3NjcmlwdD5cblxuPHN0eWxlIHNjb3BlZD5cbi5maWxlcy1wYWdlIHtcbiAgcGFkZGluZzogNnB4O1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBnYXA6IDZweDtcbn1cblxuLmZpbGVzLXRvb2xiYXIge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDhweDtcbn1cblxuLmZpbGVzLW1vZGUge1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LXNocmluazogMDtcbiAgZ2FwOiAycHg7XG4gIHBhZGRpbmc6IDJweDtcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYm9yZGVyKTtcbiAgYm9yZGVyLXJhZGl1czogOHB4O1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1iZy1lbGV2YXRlZCk7XG59XG5cbi5maWxlcy1tb2RlLWJ0biB7XG4gIGJvcmRlcjogbm9uZTtcbiAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LWRpbSk7XG4gIGZvbnQtc2l6ZTogMTFweDtcbiAgbGluZS1oZWlnaHQ6IDE7XG4gIHBhZGRpbmc6IDRweCA5cHg7XG4gIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgY3Vyc29yOiBwb2ludGVyO1xufVxuXG4uZmlsZXMtbW9kZS1idG4uYWN0aXZlIHtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50LXNvZnQpO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbn1cblxuLmZpbGVzLWRpciB7XG4gIGZsZXg6IDE7XG4gIG1pbi13aWR0aDogMDtcbiAgcGFkZGluZzogNXB4IDlweDtcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYm9yZGVyKTtcbiAgYm9yZGVyLXJhZGl1czogOHB4O1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1iZy1lbGV2YXRlZCk7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0KTtcbiAgZm9udC1zaXplOiAxMXB4O1xuICBvdXRsaW5lOiBub25lO1xufVxuXG4uZmlsZXMtZGlyOjpwbGFjZWhvbGRlciB7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbn1cblxuLmZpbGVzLWxpc3Qge1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBnYXA6IDJweDtcbn1cblxuLmZpbGVzLWl0ZW0ge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDEwcHg7XG4gIHBhZGRpbmc6IDdweCAxMHB4O1xuICBib3JkZXItcmFkaXVzOiA5cHg7XG4gIGN1cnNvcjogcG9pbnRlcjtcbn1cblxuLmZpbGVzLWl0ZW0uc2VsZWN0ZWQge1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQtc29mdCk7XG59XG5cbi5maWxlcy1pY29uIHtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gIHdpZHRoOiAzMHB4O1xuICBoZWlnaHQ6IDMwcHg7XG4gIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYmctZWxldmF0ZWQpO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1kaW0pO1xuICBmbGV4LXNocmluazogMDtcbn1cblxuLmZpbGVzLWl0ZW0uc2VsZWN0ZWQgLmZpbGVzLWljb24ge1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbn1cblxuLmZpbGVzLXRleHQge1xuICBmbGV4OiAxO1xuICBtaW4td2lkdGg6IDA7XG59XG5cbi5maWxlcy10aXRsZSB7XG4gIGZvbnQtc2l6ZTogMTNweDtcbiAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQpO1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbn1cblxuLmZpbGVzLXN1YiB7XG4gIGZvbnQtc2l6ZTogMTFweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgbWFyZ2luLXRvcDogMXB4O1xuICBkaXJlY3Rpb246IHJ0bDtcbiAgdGV4dC1hbGlnbjogbGVmdDtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgZ2FwOiA4cHg7XG59XG5cbi5maWxlcy1tZXRhIHtcbiAgZmxleC1zaHJpbms6IDA7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LWZhaW50KTtcbiAgZGlyZWN0aW9uOiBsdHI7XG59XG5cbi5maWxlcy1kZXRhaWwge1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBnYXA6IDhweDtcbiAgbWluLWhlaWdodDogMDtcbn1cblxuLmZpbGVzLWRldGFpbC1uYW1lIHtcbiAgZm9udC1zaXplOiAxMnB4O1xuICBmb250LXdlaWdodDogNTAwO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIHdvcmQtYnJlYWs6IGJyZWFrLWFsbDtcbn1cblxuLmZpbGVzLWRldGFpbC1wYXRoIHtcbiAgbWFyZ2luOiAwO1xuICBwYWRkaW5nOiAxMHB4O1xuICBib3JkZXItcmFkaXVzOiA4cHg7XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnLWVsZXZhdGVkKTtcbiAgZm9udC1mYW1pbHk6IHZhcigtLWZvbnQtbW9ubywgdWktbW9ub3NwYWNlLCBNZW5sbywgbW9ub3NwYWNlKTtcbiAgZm9udC1zaXplOiAxMXB4O1xuICBsaW5lLWhlaWdodDogMS41O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1kaW0pO1xuICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XG4gIHdvcmQtYnJlYWs6IGJyZWFrLWFsbDtcbn1cblxuLmZpbGVzLWVtcHR5IHtcbiAgcGFkZGluZzogMjJweCAwO1xuICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xufVxuPC9zdHlsZT5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvbGF1bmNoZXIvcGFnZXMvRmlsZXNQYWdlLnZ1ZSJ9