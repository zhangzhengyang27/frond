import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/launcher/pages/FocusStatsPage.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { computed, onMounted, ref } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import CapsulePage from "/src/launcher/pages/CapsulePage.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "FocusStatsPage",
  emits: ["navigate"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const emit = __emit;
    const trend = ref([]);
    const projects = ref([]);
    const loading = ref(true);
    const today = computed(() => trend.value[trend.value.length - 1] ?? null);
    const weekMinutes = computed(() => trend.value.reduce((sum, p) => sum + p.workMinutes, 0));
    const maxMinutes = computed(() => Math.max(1, ...trend.value.map((p) => p.workMinutes)));
    const hints = [
      { keys: "⌘↵", label: "打开番茄钟" },
      { keys: "ESC", label: "返回" }
    ];
    function barHeight(minutes) {
      return Math.max(4, Math.round(minutes / maxMinutes.value * 100));
    }
    function dayLabel(date) {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return date.slice(-2);
      const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
      return `周${week}`;
    }
    function openPomodoro() {
      window.api.launcher.openModule("pomodoro", "/pomodoro");
      emit("navigate");
    }
    function handleKey(e) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        openPomodoro();
        return true;
      }
      return false;
    }
    __expose({ handleKey });
    onMounted(async () => {
      try {
        const [trendResult, distResult] = await Promise.all([
          window.api.pomodoro.stats.getDailyTrend(7),
          window.api.pomodoro.stats.getProjectDistribution(Date.now() - 7 * 864e5, Date.now())
        ]);
        trend.value = trendResult ?? [];
        projects.value = (distResult ?? []).filter((p) => p.workMinutes > 0).sort((a, b) => b.workMinutes - a.workMinutes).slice(0, 4);
      } catch {
      } finally {
        loading.value = false;
      }
    });
    const __returned__ = { emit, trend, projects, loading, today, weekMinutes, maxMinutes, hints, barHeight, dayLabel, openPomodoro, handleKey, CapsulePage };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, createTextVNode as _createTextVNode, renderList as _renderList, Fragment as _Fragment, normalizeStyle as _normalizeStyle, withCtx as _withCtx, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = { class: "fstat-page" };
const _hoisted_2 = {
  key: 0,
  class: "fstat-empty"
};
const _hoisted_3 = { class: "fstat-today" };
const _hoisted_4 = { class: "fstat-cell" };
const _hoisted_5 = { class: "fstat-num" };
const _hoisted_6 = { class: "fstat-cell" };
const _hoisted_7 = { class: "fstat-num" };
const _hoisted_8 = { class: "fstat-cell" };
const _hoisted_9 = { class: "fstat-num" };
const _hoisted_10 = { class: "fstat-bars" };
const _hoisted_11 = { class: "fstat-bar-wrap" };
const _hoisted_12 = ["title"];
const _hoisted_13 = { class: "fstat-bar-label" };
const _hoisted_14 = {
  key: 0,
  class: "fstat-section-title"
};
const _hoisted_15 = {
  key: 1,
  class: "fstat-projects"
};
const _hoisted_16 = { class: "fstat-project-name" };
const _hoisted_17 = { class: "fstat-project-min" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["CapsulePage"], { hints: $setup.hints }, {
    default: _withCtx(() => [
      _createElementVNode("div", _hoisted_1, [
        $setup.loading ? (_openBlock(), _createElementBlock("div", _hoisted_2, "加载统计中…")) : (_openBlock(), _createElementBlock(
          _Fragment,
          { key: 1 },
          [
            _createCommentVNode(" 今日概览 "),
            _createElementVNode("div", _hoisted_3, [
              _createElementVNode("div", _hoisted_4, [
                _createElementVNode("div", _hoisted_5, [
                  _createTextVNode(
                    _toDisplayString($setup.today?.workMinutes ?? 0),
                    1
                    /* TEXT */
                  ),
                  _cache[0] || (_cache[0] = _createElementVNode(
                    "small",
                    null,
                    " 分",
                    -1
                    /* CACHED */
                  ))
                ]),
                _cache[1] || (_cache[1] = _createElementVNode(
                  "div",
                  { class: "fstat-label" },
                  "今日专注",
                  -1
                  /* CACHED */
                ))
              ]),
              _createElementVNode("div", _hoisted_6, [
                _createElementVNode("div", _hoisted_7, [
                  _createTextVNode(
                    _toDisplayString($setup.today?.completedPomodoros ?? 0),
                    1
                    /* TEXT */
                  ),
                  _cache[2] || (_cache[2] = _createElementVNode(
                    "small",
                    null,
                    " 🍅",
                    -1
                    /* CACHED */
                  ))
                ]),
                _cache[3] || (_cache[3] = _createElementVNode(
                  "div",
                  { class: "fstat-label" },
                  "完成番茄",
                  -1
                  /* CACHED */
                ))
              ]),
              _createElementVNode("div", _hoisted_8, [
                _createElementVNode("div", _hoisted_9, [
                  _createTextVNode(
                    _toDisplayString($setup.weekMinutes),
                    1
                    /* TEXT */
                  ),
                  _cache[4] || (_cache[4] = _createElementVNode(
                    "small",
                    null,
                    " 分",
                    -1
                    /* CACHED */
                  ))
                ]),
                _cache[5] || (_cache[5] = _createElementVNode(
                  "div",
                  { class: "fstat-label" },
                  "近 7 天",
                  -1
                  /* CACHED */
                ))
              ])
            ]),
            _createCommentVNode(" 近 7 天柱状 "),
            _cache[6] || (_cache[6] = _createElementVNode(
              "div",
              { class: "fstat-section-title" },
              "近 7 天",
              -1
              /* CACHED */
            )),
            _createElementVNode("div", _hoisted_10, [
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList($setup.trend, (p) => {
                  return _openBlock(), _createElementBlock("div", {
                    key: p.date,
                    class: "fstat-bar-col"
                  }, [
                    _createElementVNode("div", _hoisted_11, [
                      _createElementVNode("div", {
                        class: "fstat-bar",
                        style: _normalizeStyle({ height: $setup.barHeight(p.workMinutes) + "%" }),
                        title: `${p.date} · ${p.workMinutes} 分`
                      }, null, 12, _hoisted_12)
                    ]),
                    _createElementVNode(
                      "div",
                      _hoisted_13,
                      _toDisplayString($setup.dayLabel(p.date)),
                      1
                      /* TEXT */
                    )
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]),
            _createCommentVNode(" 项目分布 "),
            $setup.projects.length > 0 ? (_openBlock(), _createElementBlock("div", _hoisted_14, "项目分布（7 天）")) : _createCommentVNode("v-if", true),
            $setup.projects.length > 0 ? (_openBlock(), _createElementBlock("div", _hoisted_15, [
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList($setup.projects, (p) => {
                  return _openBlock(), _createElementBlock("div", {
                    key: p.projectId ?? "none",
                    class: "fstat-project"
                  }, [
                    _createElementVNode(
                      "span",
                      {
                        class: "fstat-dot",
                        style: _normalizeStyle({ background: p.color || "#888" })
                      },
                      null,
                      4
                      /* STYLE */
                    ),
                    _createElementVNode(
                      "span",
                      _hoisted_16,
                      _toDisplayString(p.projectName || "未归属"),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "span",
                      _hoisted_17,
                      _toDisplayString(p.workMinutes) + " 分",
                      1
                      /* TEXT */
                    )
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : _createCommentVNode("v-if", true)
          ],
          64
          /* STABLE_FRAGMENT */
        ))
      ])
    ]),
    _: 1
    /* STABLE */
  });
}
import "/src/launcher/pages/FocusStatsPage.vue?vue&type=style&index=0&scoped=679252ac&lang.css";
_sfc_main.__hmrId = "679252ac";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-679252ac"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/launcher/pages/FocusStatsPage.vue"]]);

//# sourceMappingURL=data:application/json;base64,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ZXMiOlsiRm9jdXNTdGF0c1BhZ2UudnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjx0ZW1wbGF0ZT5cbiAgPENhcHN1bGVQYWdlIDpoaW50cz1cImhpbnRzXCI+XG4gICAgPGRpdiBjbGFzcz1cImZzdGF0LXBhZ2VcIj5cbiAgICAgIDxkaXYgdi1pZj1cImxvYWRpbmdcIiBjbGFzcz1cImZzdGF0LWVtcHR5XCI+5Yqg6L2957uf6K6h5Lit4oCmPC9kaXY+XG4gICAgICA8dGVtcGxhdGUgdi1lbHNlPlxuICAgICAgICA8IS0tIOS7iuaXpeamguiniCAtLT5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZzdGF0LXRvZGF5XCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZzdGF0LWNlbGxcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmc3RhdC1udW1cIj57eyB0b2RheT8ud29ya01pbnV0ZXMgPz8gMCB9fTxzbWFsbD4g5YiGPC9zbWFsbD48L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmc3RhdC1sYWJlbFwiPuS7iuaXpeS4k+azqDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmc3RhdC1jZWxsXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZnN0YXQtbnVtXCI+e3sgdG9kYXk/LmNvbXBsZXRlZFBvbW9kb3JvcyA/PyAwIH19PHNtYWxsPiDwn42FPC9zbWFsbD48L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmc3RhdC1sYWJlbFwiPuWujOaIkOeVquiMhDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmc3RhdC1jZWxsXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZnN0YXQtbnVtXCI+e3sgd2Vla01pbnV0ZXMgfX08c21hbGw+IOWIhjwvc21hbGw+PC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZnN0YXQtbGFiZWxcIj7ov5EgNyDlpKk8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPCEtLSDov5EgNyDlpKnmn7HnirYgLS0+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmc3RhdC1zZWN0aW9uLXRpdGxlXCI+6L+RIDcg5aSpPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmc3RhdC1iYXJzXCI+XG4gICAgICAgICAgPGRpdiB2LWZvcj1cInAgaW4gdHJlbmRcIiA6a2V5PVwicC5kYXRlXCIgY2xhc3M9XCJmc3RhdC1iYXItY29sXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZnN0YXQtYmFyLXdyYXBcIj5cbiAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgIGNsYXNzPVwiZnN0YXQtYmFyXCJcbiAgICAgICAgICAgICAgICA6c3R5bGU9XCJ7IGhlaWdodDogYmFySGVpZ2h0KHAud29ya01pbnV0ZXMpICsgJyUnIH1cIlxuICAgICAgICAgICAgICAgIDp0aXRsZT1cImAke3AuZGF0ZX0gwrcgJHtwLndvcmtNaW51dGVzfSDliIZgXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZzdGF0LWJhci1sYWJlbFwiPnt7IGRheUxhYmVsKHAuZGF0ZSkgfX08L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPCEtLSDpobnnm67liIbluIMgLS0+XG4gICAgICAgIDxkaXYgdi1pZj1cInByb2plY3RzLmxlbmd0aCA+IDBcIiBjbGFzcz1cImZzdGF0LXNlY3Rpb24tdGl0bGVcIj7pobnnm67liIbluIPvvIg3IOWkqe+8iTwvZGl2PlxuICAgICAgICA8ZGl2IHYtaWY9XCJwcm9qZWN0cy5sZW5ndGggPiAwXCIgY2xhc3M9XCJmc3RhdC1wcm9qZWN0c1wiPlxuICAgICAgICAgIDxkaXYgdi1mb3I9XCJwIGluIHByb2plY3RzXCIgOmtleT1cInAucHJvamVjdElkID8/ICdub25lJ1wiIGNsYXNzPVwiZnN0YXQtcHJvamVjdFwiPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmc3RhdC1kb3RcIiA6c3R5bGU9XCJ7IGJhY2tncm91bmQ6IHAuY29sb3IgfHwgJyM4ODgnIH1cIiAvPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmc3RhdC1wcm9qZWN0LW5hbWVcIj57eyBwLnByb2plY3ROYW1lIHx8ICfmnKrlvZLlsZ4nIH19PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmc3RhdC1wcm9qZWN0LW1pblwiPnt7IHAud29ya01pbnV0ZXMgfX0g5YiGPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvdGVtcGxhdGU+XG4gICAgPC9kaXY+XG4gIDwvQ2Fwc3VsZVBhZ2U+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgY29tcHV0ZWQsIG9uTW91bnRlZCwgcmVmIH0gZnJvbSAndnVlJ1xuaW1wb3J0IENhcHN1bGVQYWdlIGZyb20gJy4vQ2Fwc3VsZVBhZ2UudnVlJ1xuXG5pbnRlcmZhY2UgVHJlbmRQb2ludCB7XG4gIGRhdGU6IHN0cmluZ1xuICB3b3JrTWludXRlczogbnVtYmVyXG4gIGNvbXBsZXRlZFBvbW9kb3JvczogbnVtYmVyXG59XG5cbmludGVyZmFjZSBQcm9qZWN0UG9pbnQge1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGxcbiAgcHJvamVjdE5hbWU6IHN0cmluZ1xuICBjb2xvcjogc3RyaW5nXG4gIHdvcmtNaW51dGVzOiBudW1iZXJcbn1cblxuY29uc3QgZW1pdCA9IGRlZmluZUVtaXRzPHsgbmF2aWdhdGU6IFtdIH0+KClcblxuY29uc3QgdHJlbmQgPSByZWY8VHJlbmRQb2ludFtdPihbXSlcbmNvbnN0IHByb2plY3RzID0gcmVmPFByb2plY3RQb2ludFtdPihbXSlcbmNvbnN0IGxvYWRpbmcgPSByZWYodHJ1ZSlcblxuY29uc3QgdG9kYXkgPSBjb21wdXRlZCgoKSA9PiB0cmVuZC52YWx1ZVt0cmVuZC52YWx1ZS5sZW5ndGggLSAxXSA/PyBudWxsKVxuY29uc3Qgd2Vla01pbnV0ZXMgPSBjb21wdXRlZCgoKSA9PiB0cmVuZC52YWx1ZS5yZWR1Y2UoKHN1bSwgcCkgPT4gc3VtICsgcC53b3JrTWludXRlcywgMCkpXG5jb25zdCBtYXhNaW51dGVzID0gY29tcHV0ZWQoKCkgPT4gTWF0aC5tYXgoMSwgLi4udHJlbmQudmFsdWUubWFwKChwKSA9PiBwLndvcmtNaW51dGVzKSkpXG5cbmNvbnN0IGhpbnRzID0gW1xuICB7IGtleXM6ICfijJjihrUnLCBsYWJlbDogJ+aJk+W8gOeVquiMhOmSnycgfSxcbiAgeyBrZXlzOiAnRVNDJywgbGFiZWw6ICfov5Tlm54nIH1cbl1cblxuZnVuY3Rpb24gYmFySGVpZ2h0KG1pbnV0ZXM6IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiBNYXRoLm1heCg0LCBNYXRoLnJvdW5kKChtaW51dGVzIC8gbWF4TWludXRlcy52YWx1ZSkgKiAxMDApKVxufVxuXG5mdW5jdGlvbiBkYXlMYWJlbChkYXRlOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBkID0gbmV3IERhdGUoZGF0ZSlcbiAgaWYgKE51bWJlci5pc05hTihkLmdldFRpbWUoKSkpIHJldHVybiBkYXRlLnNsaWNlKC0yKVxuICBjb25zdCB3ZWVrID0gWyfml6UnLCAn5LiAJywgJ+S6jCcsICfkuIknLCAn5ZubJywgJ+S6lCcsICflha0nXVtkLmdldERheSgpXVxuICByZXR1cm4gYOWRqCR7d2Vla31gXG59XG5cbmZ1bmN0aW9uIG9wZW5Qb21vZG9ybygpOiB2b2lkIHtcbiAgd2luZG93LmFwaS5sYXVuY2hlci5vcGVuTW9kdWxlKCdwb21vZG9ybycsICcvcG9tb2Rvcm8nKVxuICBlbWl0KCduYXZpZ2F0ZScpXG59XG5cbi8qKiDplK7nm5jliIblj5HvvIhMYXVuY2hlckFwcCDpm4bkuK3ovazlj5HvvInvvJvov5Tlm54gdHJ1ZSDooajnpLrlt7LmtojotLkgKi9cbmZ1bmN0aW9uIGhhbmRsZUtleShlOiBLZXlib2FyZEV2ZW50KTogYm9vbGVhbiB7XG4gIGlmIChlLmtleSA9PT0gJ0VudGVyJyAmJiAoZS5tZXRhS2V5IHx8IGUuY3RybEtleSkpIHtcbiAgICBvcGVuUG9tb2Rvcm8oKVxuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgcmV0dXJuIGZhbHNlXG59XG5cbmRlZmluZUV4cG9zZSh7IGhhbmRsZUtleSB9KVxuXG5vbk1vdW50ZWQoYXN5bmMgKCkgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IFt0cmVuZFJlc3VsdCwgZGlzdFJlc3VsdF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICB3aW5kb3cuYXBpLnBvbW9kb3JvLnN0YXRzLmdldERhaWx5VHJlbmQoNyksXG4gICAgICB3aW5kb3cuYXBpLnBvbW9kb3JvLnN0YXRzLmdldFByb2plY3REaXN0cmlidXRpb24oRGF0ZS5ub3coKSAtIDcgKiA4Nl80MDBfMDAwLCBEYXRlLm5vdygpKVxuICAgIF0pXG4gICAgdHJlbmQudmFsdWUgPSAodHJlbmRSZXN1bHQgPz8gW10pIGFzIFRyZW5kUG9pbnRbXVxuICAgIHByb2plY3RzLnZhbHVlID0gKChkaXN0UmVzdWx0ID8/IFtdKSBhcyBQcm9qZWN0UG9pbnRbXSlcbiAgICAgIC5maWx0ZXIoKHApID0+IHAud29ya01pbnV0ZXMgPiAwKVxuICAgICAgLnNvcnQoKGEsIGIpID0+IGIud29ya01pbnV0ZXMgLSBhLndvcmtNaW51dGVzKVxuICAgICAgLnNsaWNlKDAsIDQpXG4gIH0gY2F0Y2gge1xuICAgIC8qIOe7n+iuoeivu+WPluWksei0peaYvuekuuepuuaAgSAqL1xuICB9IGZpbmFsbHkge1xuICAgIGxvYWRpbmcudmFsdWUgPSBmYWxzZVxuICB9XG59KVxuPC9zY3JpcHQ+XG5cbjxzdHlsZSBzY29wZWQ+XG4uZnN0YXQtcGFnZSB7XG4gIHBhZGRpbmc6IDEycHggMTRweDtcbiAgZGlzcGxheTogZmxleDtcbiAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgZ2FwOiAxMnB4O1xufVxuXG4uZnN0YXQtdG9kYXkge1xuICBkaXNwbGF5OiBmbGV4O1xuICBnYXA6IDEwcHg7XG59XG5cbi5mc3RhdC1jZWxsIHtcbiAgZmxleDogMTtcbiAgcGFkZGluZzogMTBweCAxMnB4O1xuICBib3JkZXItcmFkaXVzOiAxMHB4O1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1iZy1lbGV2YXRlZCk7XG59XG5cbi5mc3RhdC1udW0ge1xuICBmb250LXNpemU6IDIycHg7XG4gIGZvbnQtd2VpZ2h0OiA2MDA7XG4gIGZvbnQtdmFyaWFudC1udW1lcmljOiB0YWJ1bGFyLW51bXM7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0KTtcbn1cblxuLmZzdGF0LW51bSBzbWFsbCB7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgZm9udC13ZWlnaHQ6IDQwMDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xufVxuXG4uZnN0YXQtbGFiZWwge1xuICBtYXJnaW4tdG9wOiAycHg7XG4gIGZvbnQtc2l6ZTogMTFweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xufVxuXG4uZnN0YXQtc2VjdGlvbi10aXRsZSB7XG4gIGZvbnQtc2l6ZTogMTFweDtcbiAgbGV0dGVyLXNwYWNpbmc6IDAuMDZlbTtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xufVxuXG4uZnN0YXQtYmFycyB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBmbGV4LWVuZDtcbiAgZ2FwOiAxMHB4O1xuICBoZWlnaHQ6IDkwcHg7XG59XG5cbi5mc3RhdC1iYXItY29sIHtcbiAgZmxleDogMTtcbiAgaGVpZ2h0OiAxMDAlO1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDRweDtcbn1cblxuLmZzdGF0LWJhci13cmFwIHtcbiAgZmxleDogMTtcbiAgd2lkdGg6IDEwMCU7XG4gIG1heC13aWR0aDogMzRweDtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGZsZXgtZW5kO1xuICBib3JkZXItcmFkaXVzOiA2cHg7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnLWVsZXZhdGVkKTtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbn1cblxuLmZzdGF0LWJhciB7XG4gIHdpZHRoOiAxMDAlO1xuICBib3JkZXItcmFkaXVzOiA2cHggNnB4IDAgMDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbiAgb3BhY2l0eTogMC44NTtcbiAgdHJhbnNpdGlvbjogaGVpZ2h0IDAuNHMgZWFzZTtcbn1cblxuLmZzdGF0LWJhci1sYWJlbCB7XG4gIGZvbnQtc2l6ZTogMTBweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xufVxuXG4uZnN0YXQtcHJvamVjdHMge1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBnYXA6IDZweDtcbn1cblxuLmZzdGF0LXByb2plY3Qge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDhweDtcbiAgZm9udC1zaXplOiAxMnB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1kaW0pO1xufVxuXG4uZnN0YXQtZG90IHtcbiAgd2lkdGg6IDhweDtcbiAgaGVpZ2h0OiA4cHg7XG4gIGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgZmxleC1zaHJpbms6IDA7XG59XG5cbi5mc3RhdC1wcm9qZWN0LW5hbWUge1xuICBmbGV4OiAxO1xuICBtaW4td2lkdGg6IDA7XG4gIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gIG92ZXJmbG93OiBoaWRkZW47XG4gIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xufVxuXG4uZnN0YXQtcHJvamVjdC1taW4ge1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1tdXRlZCk7XG4gIGZvbnQtdmFyaWFudC1udW1lcmljOiB0YWJ1bGFyLW51bXM7XG59XG5cbi5mc3RhdC1lbXB0eSB7XG4gIHBhZGRpbmc6IDIycHggMDtcbiAgdGV4dC1hbGlnbjogY2VudGVyO1xuICBmb250LXNpemU6IDEycHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL2xhdW5jaGVyL3BhZ2VzL0ZvY3VzU3RhdHNQYWdlLnZ1ZSJ9