import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/launcher/pages/SchedulePage.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { onMounted, ref } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { beginBusy, endBusy } from "/src/launcher/composables/useLauncherBusy.ts";
import CapsulePage from "/src/launcher/pages/CapsulePage.vue";
import { groupSchedule, timeRange } from "/src/launcher/pages/scheduleLogic.ts";
import { isOpenUrlAllowed } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/openUrl.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "SchedulePage",
  emits: ["close"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const emit = __emit;
    const loading = ref(true);
    const auth = ref("authorized");
    const groups = ref([]);
    const flat = ref([]);
    const selectedItem = ref(null);
    const hints = [
      { keys: "↑↓", label: "选择" },
      { keys: "↵", label: "入会" },
      { keys: "ESC", label: "返回" }
    ];
    async function load() {
      beginBusy();
      try {
        const result = await window.api.calendar.schedule();
        auth.value = result.auth;
        flat.value = result.events;
        groups.value = groupSchedule(result.events, /* @__PURE__ */ new Date());
        selectedItem.value = groups.value[0]?.items[0] ?? null;
      } finally {
        loading.value = false;
        endBusy();
      }
    }
    async function requestAccess() {
      await window.api.calendar.requestAccess();
      await load();
    }
    function openMeeting(item) {
      if (!item.meeting) return;
      if (!isOpenUrlAllowed(item.meeting.url)) return;
      void window.api.system.openExternal(item.meeting.url);
      emit("close");
    }
    function detailTime(item) {
      const d = new Date(item.startMs);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${timeRange(item)}`;
    }
    function moveSelection(delta) {
      if (flat.value.length === 0) return;
      const idx = selectedItem.value ? flat.value.indexOf(selectedItem.value) : -1;
      const next = idx === -1 ? 0 : (idx + delta + flat.value.length) % flat.value.length;
      selectedItem.value = flat.value[next];
    }
    function handleKey(e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1);
        return true;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedItem.value) openMeeting(selectedItem.value);
        return true;
      }
      return false;
    }
    __expose({ handleKey });
    onMounted(() => {
      void load();
    });
    const __returned__ = { emit, loading, auth, groups, flat, selectedItem, hints, load, requestAccess, openMeeting, detailTime, moveSelection, handleKey, CapsulePage, get timeRange() {
      return timeRange;
    } };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, toDisplayString as _toDisplayString, createTextVNode as _createTextVNode, renderList as _renderList, Fragment as _Fragment, createElementVNode as _createElementVNode, normalizeClass as _normalizeClass, withCtx as _withCtx, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = { class: "sched" };
const _hoisted_2 = {
  key: 0,
  class: "sched-empty"
};
const _hoisted_3 = {
  key: 1,
  class: "sched-empty"
};
const _hoisted_4 = {
  key: 2,
  class: "sched-empty"
};
const _hoisted_5 = {
  key: 3,
  class: "sched-body"
};
const _hoisted_6 = { class: "sched-list" };
const _hoisted_7 = { class: "sched-day" };
const _hoisted_8 = ["onMouseenter", "onClick"];
const _hoisted_9 = { class: "sched-item-main" };
const _hoisted_10 = { class: "sched-title" };
const _hoisted_11 = {
  key: 0,
  class: "sched-allday"
};
const _hoisted_12 = { class: "sched-sub" };
const _hoisted_13 = {
  key: 0,
  class: "sched-meeting-badge"
};
const _hoisted_14 = { class: "sched-detail" };
const _hoisted_15 = { class: "sched-detail-title" };
const _hoisted_16 = { class: "sched-detail-row" };
const _hoisted_17 = { class: "sched-detail-row" };
const _hoisted_18 = {
  key: 1,
  class: "sched-empty"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["CapsulePage"], { hints: $setup.hints }, {
    default: _withCtx(() => [
      _createElementVNode("div", _hoisted_1, [
        $setup.auth === "denied" ? (_openBlock(), _createElementBlock("div", _hoisted_2, " 日历访问被拒绝：系统设置 → 隐私与安全性 → 日历，允许本应用后重试 ")) : $setup.loading ? (_openBlock(), _createElementBlock("div", _hoisted_3, "加载日程中…")) : $setup.groups.length === 0 ? (_openBlock(), _createElementBlock("div", _hoisted_4, [
          _createTextVNode(
            _toDisplayString($setup.auth === "authorized" ? "未来 7 天没有日程" : "日历尚未授权：回车或点击下方按钮发起授权") + " ",
            1
            /* TEXT */
          ),
          $setup.auth === "notDetermined" ? (_openBlock(), _createElementBlock("button", {
            key: 0,
            class: "sched-auth-btn",
            type: "button",
            onClick: $setup.requestAccess
          }, " 发起日历授权 ")) : _createCommentVNode("v-if", true)
        ])) : (_openBlock(), _createElementBlock("div", _hoisted_5, [
          _createCommentVNode(" 左栏：按天分组列表 "),
          _createElementVNode("div", _hoisted_6, [
            (_openBlock(true), _createElementBlock(
              _Fragment,
              null,
              _renderList($setup.groups, (group) => {
                return _openBlock(), _createElementBlock("div", {
                  key: group.label,
                  class: "sched-group"
                }, [
                  _createElementVNode(
                    "div",
                    _hoisted_7,
                    _toDisplayString(group.label),
                    1
                    /* TEXT */
                  ),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(group.items, (item) => {
                      return _openBlock(), _createElementBlock("div", {
                        key: item.startMs + item.title,
                        class: _normalizeClass(["sched-item", { selected: $setup.selectedItem === item }]),
                        onMouseenter: ($event) => $setup.selectedItem = item,
                        onClick: ($event) => $setup.openMeeting(item)
                      }, [
                        _createElementVNode("div", _hoisted_9, [
                          _createElementVNode("div", _hoisted_10, [
                            item.isAllDay ? (_openBlock(), _createElementBlock("span", _hoisted_11, "全天")) : _createCommentVNode("v-if", true),
                            _createTextVNode(
                              " " + _toDisplayString(item.title),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "div",
                            _hoisted_12,
                            _toDisplayString($setup.timeRange(item)),
                            1
                            /* TEXT */
                          )
                        ]),
                        item.meeting ? (_openBlock(), _createElementBlock("span", _hoisted_13, "会议")) : _createCommentVNode("v-if", true)
                      ], 42, _hoisted_8);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ]),
          _createCommentVNode(" 右栏：详情 "),
          _createElementVNode("div", _hoisted_14, [
            $setup.selectedItem ? (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 0 },
              [
                _createElementVNode(
                  "div",
                  _hoisted_15,
                  _toDisplayString($setup.selectedItem.title),
                  1
                  /* TEXT */
                ),
                _createElementVNode("div", _hoisted_16, [
                  _cache[1] || (_cache[1] = _createElementVNode(
                    "span",
                    { class: "k" },
                    "时间",
                    -1
                    /* CACHED */
                  )),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString($setup.detailTime($setup.selectedItem)),
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode("div", _hoisted_17, [
                  _cache[2] || (_cache[2] = _createElementVNode(
                    "span",
                    { class: "k" },
                    "会议",
                    -1
                    /* CACHED */
                  )),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString($setup.selectedItem.meeting ? $setup.selectedItem.meeting.provider : "—"),
                    1
                    /* TEXT */
                  )
                ]),
                $setup.selectedItem.meeting ? (_openBlock(), _createElementBlock("button", {
                  key: 0,
                  class: "sched-join-btn",
                  type: "button",
                  onClick: _cache[0] || (_cache[0] = ($event) => $setup.openMeeting($setup.selectedItem))
                }, " 入会 ")) : _createCommentVNode("v-if", true)
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (_openBlock(), _createElementBlock("div", _hoisted_18, "选择左侧日程查看详情"))
          ])
        ]))
      ])
    ]),
    _: 1
    /* STABLE */
  });
}
import "/src/launcher/pages/SchedulePage.vue?vue&type=style&index=0&scoped=cabb84a4&lang.css";
_sfc_main.__hmrId = "cabb84a4";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-cabb84a4"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/launcher/pages/SchedulePage.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QkFBYSxRQUFRLFdBQVE7QUFBQTtBQUFBO0FBQUE7QUFBQTtnQkFHdkQsb0JBQWEseUJBRHJCLG9CQU9TO0FBQUE7a0JBTFAsT0FBTTtBQUFBLGtCQUNOLE1BQUs7QUFBQSxrQkFDSixTQUFLLHNDQUFFLG1CQUFZLG1CQUFZO0FBQUEsbUJBQ2pDLE1BRUQ7Ozs7Z0NBRUYsb0JBQWdELE9BQWhELGFBQWdDLFlBQVU7QUFBQSIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiU2NoZWR1bGVQYWdlLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDxDYXBzdWxlUGFnZSA6aGludHM9XCJoaW50c1wiPlxuICAgIDxkaXYgY2xhc3M9XCJzY2hlZFwiPlxuICAgICAgPGRpdiB2LWlmPVwiYXV0aCA9PT0gJ2RlbmllZCdcIiBjbGFzcz1cInNjaGVkLWVtcHR5XCI+XG4gICAgICAgIOaXpeWOhuiuv+mXruiiq+aLkue7ne+8muezu+e7n+iuvue9riDihpIg6ZqQ56eB5LiO5a6J5YWo5oCnIOKGkiDml6XljobvvIzlhYHorrjmnKzlupTnlKjlkI7ph43or5VcbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiB2LWVsc2UtaWY9XCJsb2FkaW5nXCIgY2xhc3M9XCJzY2hlZC1lbXB0eVwiPuWKoOi9veaXpeeoi+S4reKApjwvZGl2PlxuICAgICAgPGRpdiB2LWVsc2UtaWY9XCJncm91cHMubGVuZ3RoID09PSAwXCIgY2xhc3M9XCJzY2hlZC1lbXB0eVwiPlxuICAgICAgICB7e1xuICAgICAgICAgIGF1dGggPT09ICdhdXRob3JpemVkJyA/ICfmnKrmnaUgNyDlpKnmsqHmnInml6XnqIsnIDogJ+aXpeWOhuWwmuacquaOiOadg++8muWbnui9puaIlueCueWHu+S4i+aWueaMiemSruWPkei1t+aOiOadgydcbiAgICAgICAgfX1cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIHYtaWY9XCJhdXRoID09PSAnbm90RGV0ZXJtaW5lZCdcIlxuICAgICAgICAgIGNsYXNzPVwic2NoZWQtYXV0aC1idG5cIlxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgIEBjbGljaz1cInJlcXVlc3RBY2Nlc3NcIlxuICAgICAgICA+XG4gICAgICAgICAg5Y+R6LW35pel5Y6G5o6I5p2DXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IHYtZWxzZSBjbGFzcz1cInNjaGVkLWJvZHlcIj5cbiAgICAgICAgPCEtLSDlt6bmoI/vvJrmjInlpKnliIbnu4TliJfooaggLS0+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzY2hlZC1saXN0XCI+XG4gICAgICAgICAgPGRpdiB2LWZvcj1cImdyb3VwIGluIGdyb3Vwc1wiIDprZXk9XCJncm91cC5sYWJlbFwiIGNsYXNzPVwic2NoZWQtZ3JvdXBcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzY2hlZC1kYXlcIj57eyBncm91cC5sYWJlbCB9fTwvZGl2PlxuICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICB2LWZvcj1cIml0ZW0gaW4gZ3JvdXAuaXRlbXNcIlxuICAgICAgICAgICAgICA6a2V5PVwiaXRlbS5zdGFydE1zICsgaXRlbS50aXRsZVwiXG4gICAgICAgICAgICAgIGNsYXNzPVwic2NoZWQtaXRlbVwiXG4gICAgICAgICAgICAgIDpjbGFzcz1cInsgc2VsZWN0ZWQ6IHNlbGVjdGVkSXRlbSA9PT0gaXRlbSB9XCJcbiAgICAgICAgICAgICAgQG1vdXNlZW50ZXI9XCJzZWxlY3RlZEl0ZW0gPSBpdGVtXCJcbiAgICAgICAgICAgICAgQGNsaWNrPVwib3Blbk1lZXRpbmcoaXRlbSlcIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2NoZWQtaXRlbS1tYWluXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNjaGVkLXRpdGxlXCI+XG4gICAgICAgICAgICAgICAgICA8c3BhbiB2LWlmPVwiaXRlbS5pc0FsbERheVwiIGNsYXNzPVwic2NoZWQtYWxsZGF5XCI+5YWo5aSpPC9zcGFuPlxuICAgICAgICAgICAgICAgICAge3sgaXRlbS50aXRsZSB9fVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzY2hlZC1zdWJcIj57eyB0aW1lUmFuZ2UoaXRlbSkgfX08L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxzcGFuIHYtaWY9XCJpdGVtLm1lZXRpbmdcIiBjbGFzcz1cInNjaGVkLW1lZXRpbmctYmFkZ2VcIj7kvJrorq48L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDwhLS0g5Y+z5qCP77ya6K+m5oOFIC0tPlxuICAgICAgICA8ZGl2IGNsYXNzPVwic2NoZWQtZGV0YWlsXCI+XG4gICAgICAgICAgPHRlbXBsYXRlIHYtaWY9XCJzZWxlY3RlZEl0ZW1cIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzY2hlZC1kZXRhaWwtdGl0bGVcIj57eyBzZWxlY3RlZEl0ZW0udGl0bGUgfX08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzY2hlZC1kZXRhaWwtcm93XCI+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwia1wiPuaXtumXtDwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4+e3sgZGV0YWlsVGltZShzZWxlY3RlZEl0ZW0pIH19PC9zcGFuPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2NoZWQtZGV0YWlsLXJvd1wiPlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImtcIj7kvJrorq48L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuPnt7IHNlbGVjdGVkSXRlbS5tZWV0aW5nID8gc2VsZWN0ZWRJdGVtLm1lZXRpbmcucHJvdmlkZXIgOiAn4oCUJyB9fTwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICB2LWlmPVwic2VsZWN0ZWRJdGVtLm1lZXRpbmdcIlxuICAgICAgICAgICAgICBjbGFzcz1cInNjaGVkLWpvaW4tYnRuXCJcbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgIEBjbGljaz1cIm9wZW5NZWV0aW5nKHNlbGVjdGVkSXRlbSlcIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICDlhaXkvJpcbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDwvdGVtcGxhdGU+XG4gICAgICAgICAgPGRpdiB2LWVsc2UgY2xhc3M9XCJzY2hlZC1lbXB0eVwiPumAieaLqeW3puS+p+aXpeeoi+afpeeci+ivpuaDhTwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICA8L0NhcHN1bGVQYWdlPlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbi8qKlxuICogTXkgU2NoZWR1bGUg5YaF6IGU6aG177yIVjQgUDAtMSDmibnmrKE0IOesrOS6jOaho++8ie+8muacquadpSA3IOWkqeaXpeeoi+aMieWkqeWIhue7hO+8jFxuICog4oaR4oaTIOmAieaLqeOAgeWbnui9puWFpeS8mu+8iOacieS8muiurumTvuaOpeaXtu+8ie+8m2RlbmllZCAvIG5vdERldGVybWluZWQg57uZ5Ye65o6I5p2D5byV5a+844CCXG4gKi9cbmltcG9ydCB7IG9uTW91bnRlZCwgcmVmIH0gZnJvbSAndnVlJ1xuaW1wb3J0IHsgYmVnaW5CdXN5LCBlbmRCdXN5IH0gZnJvbSAnLi4vY29tcG9zYWJsZXMvdXNlTGF1bmNoZXJCdXN5J1xuaW1wb3J0IENhcHN1bGVQYWdlIGZyb20gJy4vQ2Fwc3VsZVBhZ2UudnVlJ1xuaW1wb3J0IHsgZ3JvdXBTY2hlZHVsZSwgdGltZVJhbmdlLCB0eXBlIFNjaGVkdWxlRXZlbnQsIHR5cGUgU2NoZWR1bGVHcm91cCB9IGZyb20gJy4vc2NoZWR1bGVMb2dpYydcbmltcG9ydCB7IGlzT3BlblVybEFsbG93ZWQgfSBmcm9tICdAc2hhcmVkL29wZW5VcmwnXG5cbmNvbnN0IGVtaXQgPSBkZWZpbmVFbWl0czx7IGNsb3NlOiBbXSB9PigpXG5cbmNvbnN0IGxvYWRpbmcgPSByZWYodHJ1ZSlcbmNvbnN0IGF1dGggPSByZWY8J2F1dGhvcml6ZWQnIHwgJ2RlbmllZCcgfCAnbm90RGV0ZXJtaW5lZCcgfCAndW5zdXBwb3J0ZWQnPignYXV0aG9yaXplZCcpXG5jb25zdCBncm91cHMgPSByZWY8U2NoZWR1bGVHcm91cFtdPihbXSlcbmNvbnN0IGZsYXQgPSByZWY8U2NoZWR1bGVFdmVudFtdPihbXSlcbmNvbnN0IHNlbGVjdGVkSXRlbSA9IHJlZjxTY2hlZHVsZUV2ZW50IHwgbnVsbD4obnVsbClcblxuY29uc3QgaGludHMgPSBbXG4gIHsga2V5czogJ+KGkeKGkycsIGxhYmVsOiAn6YCJ5oupJyB9LFxuICB7IGtleXM6ICfihrUnLCBsYWJlbDogJ+WFpeS8micgfSxcbiAgeyBrZXlzOiAnRVNDJywgbGFiZWw6ICfov5Tlm54nIH1cbl1cblxuYXN5bmMgZnVuY3Rpb24gbG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYmVnaW5CdXN5KCkgLy8gSTkg57uf5LiA5Yqg6L295oCBXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2luZG93LmFwaS5jYWxlbmRhci5zY2hlZHVsZSgpXG4gICAgYXV0aC52YWx1ZSA9IHJlc3VsdC5hdXRoXG4gICAgZmxhdC52YWx1ZSA9IHJlc3VsdC5ldmVudHNcbiAgICBncm91cHMudmFsdWUgPSBncm91cFNjaGVkdWxlKHJlc3VsdC5ldmVudHMsIG5ldyBEYXRlKCkpXG4gICAgc2VsZWN0ZWRJdGVtLnZhbHVlID0gZ3JvdXBzLnZhbHVlWzBdPy5pdGVtc1swXSA/PyBudWxsXG4gIH0gZmluYWxseSB7XG4gICAgbG9hZGluZy52YWx1ZSA9IGZhbHNlXG4gICAgZW5kQnVzeSgpXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVxdWVzdEFjY2VzcygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgd2luZG93LmFwaS5jYWxlbmRhci5yZXF1ZXN0QWNjZXNzKClcbiAgYXdhaXQgbG9hZCgpXG59XG5cbmZ1bmN0aW9uIG9wZW5NZWV0aW5nKGl0ZW06IFNjaGVkdWxlRXZlbnQpOiB2b2lkIHtcbiAgaWYgKCFpdGVtLm1lZXRpbmcpIHJldHVyblxuICBpZiAoIWlzT3BlblVybEFsbG93ZWQoaXRlbS5tZWV0aW5nLnVybCkpIHJldHVyblxuICB2b2lkIHdpbmRvdy5hcGkuc3lzdGVtLm9wZW5FeHRlcm5hbChpdGVtLm1lZXRpbmcudXJsKVxuICBlbWl0KCdjbG9zZScpXG59XG5cbmZ1bmN0aW9uIGRldGFpbFRpbWUoaXRlbTogU2NoZWR1bGVFdmVudCk6IHN0cmluZyB7XG4gIGNvbnN0IGQgPSBuZXcgRGF0ZShpdGVtLnN0YXJ0TXMpXG4gIHJldHVybiBgJHtkLmdldEZ1bGxZZWFyKCl9LyR7U3RyaW5nKGQuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsICcwJyl9LyR7U3RyaW5nKGQuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCAnMCcpfSAke3RpbWVSYW5nZShpdGVtKX1gXG59XG5cbmZ1bmN0aW9uIG1vdmVTZWxlY3Rpb24oZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICBpZiAoZmxhdC52YWx1ZS5sZW5ndGggPT09IDApIHJldHVyblxuICBjb25zdCBpZHggPSBzZWxlY3RlZEl0ZW0udmFsdWUgPyBmbGF0LnZhbHVlLmluZGV4T2Yoc2VsZWN0ZWRJdGVtLnZhbHVlKSA6IC0xXG4gIGNvbnN0IG5leHQgPSBpZHggPT09IC0xID8gMCA6IChpZHggKyBkZWx0YSArIGZsYXQudmFsdWUubGVuZ3RoKSAlIGZsYXQudmFsdWUubGVuZ3RoXG4gIHNlbGVjdGVkSXRlbS52YWx1ZSA9IGZsYXQudmFsdWVbbmV4dF1cbn1cblxuZnVuY3Rpb24gaGFuZGxlS2V5KGU6IEtleWJvYXJkRXZlbnQpOiBib29sZWFuIHtcbiAgaWYgKGUua2V5ID09PSAnQXJyb3dEb3duJykge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIG1vdmVTZWxlY3Rpb24oMSlcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIGlmIChlLmtleSA9PT0gJ0Fycm93VXAnKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgbW92ZVNlbGVjdGlvbigtMSlcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIGlmIChlLmtleSA9PT0gJ0VudGVyJykge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGlmIChzZWxlY3RlZEl0ZW0udmFsdWUpIG9wZW5NZWV0aW5nKHNlbGVjdGVkSXRlbS52YWx1ZSlcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIHJldHVybiBmYWxzZVxufVxuXG5kZWZpbmVFeHBvc2UoeyBoYW5kbGVLZXkgfSlcblxub25Nb3VudGVkKCgpID0+IHtcbiAgdm9pZCBsb2FkKClcbn0pXG48L3NjcmlwdD5cblxuPHN0eWxlIHNjb3BlZD5cbi5zY2hlZCB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIG1pbi1oZWlnaHQ6IDA7XG4gIGZsZXg6IDE7XG4gIGhlaWdodDogMTAwJTtcbn1cblxuLnNjaGVkLWVtcHR5IHtcbiAgcGFkZGluZzogMjRweCAxNnB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1tdXRlZCk7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgdGV4dC1hbGlnbjogY2VudGVyO1xuICB3aWR0aDogMTAwJTtcbn1cblxuLnNjaGVkLWF1dGgtYnRuIHtcbiAgZGlzcGxheTogYmxvY2s7XG4gIG1hcmdpbjogMTBweCBhdXRvIDA7XG4gIHBhZGRpbmc6IDRweCAxMnB4O1xuICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1sYXVuY2hlci1ib3JkZXIpO1xuICBib3JkZXItcmFkaXVzOiA2cHg7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnLWVsZXZhdGVkKTtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQpO1xuICBjdXJzb3I6IHBvaW50ZXI7XG4gIGZvbnQtc2l6ZTogMTFweDtcbn1cblxuLnNjaGVkLWJvZHkge1xuICBkaXNwbGF5OiBmbGV4O1xuICBtaW4taGVpZ2h0OiAwO1xuICBmbGV4OiAxO1xufVxuXG4uc2NoZWQtbGlzdCB7XG4gIGZsZXg6IDE7XG4gIG1pbi13aWR0aDogMDtcbiAgb3ZlcmZsb3cteTogYXV0bztcbiAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYm9yZGVyKTtcbn1cblxuLnNjaGVkLWRheSB7XG4gIHBhZGRpbmc6IDVweCAxMnB4O1xuICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYm9yZGVyKTtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICBmb250LXNpemU6IDEwcHg7XG59XG5cbi5zY2hlZC1pdGVtIHtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgZ2FwOiA4cHg7XG4gIHBhZGRpbmc6IDZweCAxMnB4O1xuICBjdXJzb3I6IHBvaW50ZXI7XG59XG5cbi5zY2hlZC1pdGVtLnNlbGVjdGVkIHtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50LXNvZnQpO1xufVxuXG4uc2NoZWQtaXRlbS1tYWluIHtcbiAgbWluLXdpZHRoOiAwO1xuICBmbGV4OiAxO1xufVxuXG4uc2NoZWQtdGl0bGUge1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gIHdoaXRlLXNwYWNlOiBub3dyYXA7XG59XG5cbi5zY2hlZC1hbGxkYXkge1xuICBtYXJnaW4tcmlnaHQ6IDRweDtcbiAgcGFkZGluZzogMCA0cHg7XG4gIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50LXNvZnQpO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1kaW0pO1xuICBmb250LXNpemU6IDEwcHg7XG59XG5cbi5zY2hlZC1zdWIge1xuICBtYXJnaW4tdG9wOiAxcHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbiAgZm9udC1zaXplOiAxMHB4O1xufVxuXG4uc2NoZWQtbWVldGluZy1iYWRnZSB7XG4gIGZsZXgtc2hyaW5rOiAwO1xuICBwYWRkaW5nOiAxcHggNnB4O1xuICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50LXNvZnQpO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbiAgZm9udC1zaXplOiAxMHB4O1xufVxuXG4uc2NoZWQtZGV0YWlsIHtcbiAgZGlzcGxheTogZmxleDtcbiAgd2lkdGg6IDI2MHB4O1xuICBmbGV4LXNocmluazogMDtcbiAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgZ2FwOiA4cHg7XG4gIHBhZGRpbmc6IDEycHg7XG59XG5cbi5zY2hlZC1kZXRhaWwtdGl0bGUge1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIGZvbnQtc2l6ZTogMTNweDtcbiAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgd29yZC1icmVhazogYnJlYWstd29yZDtcbn1cblxuLnNjaGVkLWRldGFpbC1yb3cge1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1kaW0pO1xuICBmb250LXNpemU6IDExcHg7XG59XG5cbi5zY2hlZC1kZXRhaWwtcm93IC5rIHtcbiAgbWFyZ2luLXJpZ2h0OiA2cHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbn1cblxuLnNjaGVkLWpvaW4tYnRuIHtcbiAgYWxpZ24tc2VsZjogZmxleC1zdGFydDtcbiAgcGFkZGluZzogNHB4IDE0cHg7XG4gIGJvcmRlcjogbm9uZTtcbiAgYm9yZGVyLXJhZGl1czogNnB4O1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQpO1xuICBjb2xvcjogI2ZmZjtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBmb250LXNpemU6IDExcHg7XG59XG48L3N0eWxlPlxuIl0sImZpbGUiOiIvVXNlcnMveGlhb3llL0Rlc2t0b3AvZWxlY3Ryb24tdG9vbHMvc3JjL3JlbmRlcmVyL3NyYy9sYXVuY2hlci9wYWdlcy9TY2hlZHVsZVBhZ2UudnVlIn0=